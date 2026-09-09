import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:sqflite/sqflite.dart';

import '../core/api_client.dart';
import '../core/secure_storage.dart';
import 'conflict_manager.dart';
import 'local_database.dart';
import 'sync_queue.dart';

/// Coordinates connectivity-aware push/pull against `/census/sync/*`.
class SyncEngine {
  SyncEngine({
    SyncQueue? queue,
    LocalDatabase? db,
    ApiClient? api,
    SecureStore? store,
  })  : _queue = queue ?? SyncQueue(),
        _db = db ?? LocalDatabase.instance,
        _api = api ?? ApiClient(),
        _store = store ?? SecureStore.instance;

  final SyncQueue _queue;
  final LocalDatabase _db;
  final ApiClient _api;
  final SecureStore _store;

  Future<bool> get isOnline async {
    final result = await Connectivity().checkConnectivity();
    return !result.contains(ConnectivityResult.none);
  }

  Future<String> runOnce({String? campaignId}) async {
    if (!await isOnline) {
      await _db.setMeta('sync_status', 'OFFLINE');
      return 'Hors ligne — sync reportée.';
    }

    final token = await _store.accessToken;
    if (token == null || token.isEmpty) {
      await _db.setMeta('sync_status', 'ERROR');
      return 'Non authentifié — reconnectez-vous.';
    }

    final deviceUid = await _store.deviceUid ?? 'unregistered-device';
    final agentUserId = await _store.userId;
    final pending = await _queue.pending();
    if (pending.isEmpty && campaignId == null) {
      final cached = await _db.db.query('campaigns_cache', limit: 1);
      if (cached.isEmpty) {
        return 'Rien à synchroniser.';
      }
      campaignId = cached.first['id']?.toString();
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
        final pushBody = <String, dynamic>{
          'device_uid': deviceUid,
          'campaign_id': cid,
          'items': items,
        };
        if (agentUserId != null && agentUserId.isNotEmpty) {
          pushBody['agent_user_id'] = agentUserId;
        }

        final pushRes = await _api.post('/census/sync/push', body: pushBody);
        if (pushRes.statusCode == 401) {
          return 'Session expirée — reconnectez-vous.';
        }
        if (pushRes.statusCode >= 200 && pushRes.statusCode < 300) {
          final body = _api.decodeMap(pushRes);
          final details = (body['details'] as List?) ?? [];
          for (var i = 0; i < pending.length && i < details.length; i++) {
            final detail = details[i] as Map<String, dynamic>;
            final status = detail['status']?.toString() ?? '';
            if (status == 'ACCEPTED') {
              await _queue.remove(pending[i]['id'] as int);
              await _markSynced(pending[i]['local_id'] as String);
            } else if (status == 'CONFLICT') {
              await _markConflict(pending[i]['local_id'] as String);
              await _queue.remove(pending[i]['id'] as int);
            } else {
              await _queue.bumpAttempts(pending[i]['id'] as int);
            }
          }
        } else {
          return 'Échec push (${pushRes.statusCode})';
        }
      }

      final pullBody = <String, dynamic>{
        'device_uid': deviceUid,
        'campaign_id': cid,
      };
      final pullRes = await _api.post('/census/sync/pull', body: pullBody);
      if (pullRes.statusCode == 401) {
        return 'Session expirée — reconnectez-vous.';
      }
      if (pullRes.statusCode >= 200 && pullRes.statusCode < 300) {
        final body = _api.decodeMap(pullRes);
        await _applyPull(body);
      }

      await _db.setMeta('sync_status', 'SYNCED');
      await _db.setMeta('last_sync_at', DateTime.now().toUtc().toIso8601String());
      return 'Synchronisation terminée (${items.length} envois).';
    } on ApiException catch (e) {
      await _db.setMeta('sync_status', 'ERROR');
      return 'Échec sync: ${e.message}';
    } catch (e) {
      await _db.setMeta('sync_status', 'ERROR');
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

  Future<void> _markSynced(String localId) async {
    await _db.db.update(
      'census_records',
      {'status': 'SYNCED'},
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
        }
      }
    }

    final campaigns = (body['campaigns'] as List?) ?? [];
    if (campaigns.isNotEmpty) {
      final batch = _db.db.batch();
      for (final raw in campaigns) {
        final c = Map<String, dynamic>.from(raw as Map);
        batch.insert(
          'campaigns_cache',
          {
            'id': c['id'].toString(),
            'code': c['code']?.toString() ?? '',
            'name': c['name']?.toString() ?? '',
            'status': c['status']?.toString() ?? '',
            'payload': jsonEncode(c),
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
      await batch.commit(noResult: true);
    }
  }
}
