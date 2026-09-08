import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:http/http.dart' as http;

import '../core/config.dart';
import '../core/secure_storage.dart';
import 'conflict_manager.dart';
import 'local_database.dart';
import 'sync_queue.dart';

/// Coordinates connectivity-aware push/pull against `/api/v1/census/sync/*`.
class SyncEngine {
  SyncEngine({
    SyncQueue? queue,
    LocalDatabase? db,
    http.Client? client,
  })  : _queue = queue ?? SyncQueue(),
        _db = db ?? LocalDatabase.instance,
        _client = client ?? http.Client();

  final SyncQueue _queue;
  final LocalDatabase _db;
  final http.Client _client;

  Future<bool> get isOnline async {
    final result = await Connectivity().checkConnectivity();
    return !result.contains(ConnectivityResult.none);
  }

  Future<String> runOnce({String? campaignId}) async {
    if (!await isOnline) {
      return 'Hors ligne — sync reportée.';
    }
    final deviceUid = await SecureStore.instance.deviceUid ?? 'unregistered-device';
    final pending = await _queue.pending();
    if (pending.isEmpty && campaignId == null) {
      return 'Rien à synchroniser.';
    }

    final items = pending
        .map(
          (row) => {
            'entity_type': row['entity_type'],
            'local_id': row['local_id'],
            'version': row['version'],
            'data': jsonDecode(row['payload'] as String),
          },
        )
        .toList();

    final cid = campaignId ??
        (items.isNotEmpty
            ? (items.first['data'] as Map)['campaign_id']?.toString()
            : null);
    if (cid == null) {
      return 'Campagne inconnue — sync annulée.';
    }

    try {
      if (items.isNotEmpty) {
        final pushUri = Uri.parse('${AppConfig.apiBaseUrl}/census/sync/push');
        final pushRes = await _client.post(
          pushUri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'device_uid': deviceUid,
            'campaign_id': cid,
            'items': items,
          }),
        );
        if (pushRes.statusCode >= 200 && pushRes.statusCode < 300) {
          final body = jsonDecode(pushRes.body) as Map<String, dynamic>;
          final details = (body['details'] as List?) ?? [];
          for (var i = 0; i < pending.length && i < details.length; i++) {
            final detail = details[i] as Map<String, dynamic>;
            final status = detail['status']?.toString() ?? '';
            if (status == 'ACCEPTED') {
              await _queue.remove(pending[i]['id'] as int);
            } else if (status == 'CONFLICT') {
              await _markConflict(pending[i]['local_id'] as String);
              await _queue.remove(pending[i]['id'] as int);
            } else {
              await _queue.bumpAttempts(pending[i]['id'] as int);
            }
          }
        }
      }

      final pullUri = Uri.parse('${AppConfig.apiBaseUrl}/census/sync/pull');
      final pullRes = await _client.post(
        pullUri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'device_uid': deviceUid,
          'campaign_id': cid,
        }),
      );
      if (pullRes.statusCode >= 200 && pullRes.statusCode < 300) {
        final body = jsonDecode(pullRes.body) as Map<String, dynamic>;
        await _applyPull(body);
      }

      return 'Synchronisation terminée (${items.length} envois).';
    } catch (e) {
      return 'Échec sync: $e';
    }
  }

  Future<void> _markConflict(String localId) async {
    await _db.db.update(
      'census_records',
      {'status': 'CONFLICT'},
      where: 'local_id = ?',
      whereArgs: [localId],
    );
  }

  Future<void> _applyPull(Map<String, dynamic> body) async {
    final records = (body['records'] as List?) ?? [];
    for (final raw in records) {
      final r = raw as Map<String, dynamic>;
      final localId = r['local_id']?.toString();
      if (localId == null) continue;
      final existing = await _db.db.query(
        'census_records',
        where: 'local_id = ?',
        whereArgs: [localId],
        limit: 1,
      );
      final serverVersion = (r['version'] as num?)?.toInt() ?? 1;
      if (existing.isEmpty) {
        await _db.db.insert('census_records', {
          'id': r['id']?.toString() ?? localId,
          'local_id': localId,
          'household_local_id': r['household_id']?.toString() ?? '',
          'campaign_id': r['campaign_id']?.toString() ?? '',
          'given_names': r['given_names'],
          'family_name': r['family_name'],
          'sex': r['sex'],
          'date_of_birth': r['date_of_birth'],
          'version': serverVersion,
          'status': r['status'] ?? 'SYNCED',
          'updated_at': DateTime.now().toUtc().toIso8601String(),
        });
      } else {
        final localVersion = (existing.first['version'] as int?) ?? 1;
        final outcome = ConflictManager.resolve(
          localVersion: localVersion,
          serverVersion: serverVersion,
        );
        if (outcome == ConflictOutcome.serverWins) {
          await _db.db.update(
            'census_records',
            {
              'given_names': r['given_names'],
              'family_name': r['family_name'],
              'version': serverVersion,
              'status': 'SYNCED',
              'updated_at': DateTime.now().toUtc().toIso8601String(),
            },
            where: 'local_id = ?',
            whereArgs: [localId],
          );
        } else if (outcome == ConflictOutcome.localWins) {
          // keep local; will re-push
        }
      }
    }
  }
}
