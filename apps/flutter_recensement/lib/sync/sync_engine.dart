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

    var conflictCount = 0;
    var acceptedCount = 0;

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
          await _db.setMeta('sync_status', 'ERROR');
          return 'Session expirée — reconnectez-vous.';
        }
        if (pushRes.statusCode >= 200 && pushRes.statusCode < 300) {
          final body = _api.decodeMap(pushRes);
          final details = (body['details'] as List?) ?? [];
          final byLocalId = <String, Map<String, dynamic>>{};
          for (final raw in details) {
            final d = Map<String, dynamic>.from(raw as Map);
            final lid = d['local_id']?.toString();
            if (lid != null) byLocalId[lid] = d;
          }

          for (final row in pending) {
            final localId = row['local_id'] as String;
            final detail = byLocalId[localId];
            final status = detail?['status']?.toString() ?? '';
            if (status == 'ACCEPTED') {
              acceptedCount++;
              await _queue.remove(row['id'] as int);
              await _markSynced(localId);
            } else if (status == 'CONFLICT') {
              conflictCount++;
              await _markConflict(
                localId,
                reason: detail?['reason']?.toString(),
                serverVersion: (detail?['server_version'] as num?)?.toInt(),
                serverSnapshot: detail?['server'] is Map
                    ? Map<String, dynamic>.from(detail!['server'] as Map)
                    : null,
              );
              await _queue.remove(row['id'] as int);
            } else if (status == 'REJECTED') {
              await _queue.bumpAttempts(row['id'] as int);
            } else {
              await _queue.bumpAttempts(row['id'] as int);
            }
          }
        } else {
          await _db.setMeta('sync_status', 'ERROR');
          return 'Échec push (${pushRes.statusCode})';
        }
      }

      final pullBody = <String, dynamic>{
        'device_uid': deviceUid,
        'campaign_id': cid,
      };
      final since = await _db.getMeta('last_pull_at');
      if (since != null && since.isNotEmpty) {
        pullBody['since'] = since;
      }
      final pullRes = await _api.post('/census/sync/pull', body: pullBody);
      if (pullRes.statusCode == 401) {
        await _db.setMeta('sync_status', 'ERROR');
        return 'Session expirée — reconnectez-vous.';
      }
      if (pullRes.statusCode >= 200 && pullRes.statusCode < 300) {
        final body = _api.decodeMap(pullRes);
        await _applyPull(body);
        final serverTime = body['server_time']?.toString();
        if (serverTime != null) {
          await _db.setMeta('last_pull_at', serverTime);
        }
      }

      if (conflictCount > 0) {
        await _db.setMeta('sync_status', 'CONFLICT');
        await _db.setMeta('last_sync_at', DateTime.now().toUtc().toIso8601String());
        return 'Sync partielle — $conflictCount conflit(s), $acceptedCount accepté(s).';
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

  /// Keep local edits and re-queue with version = serverVersion + 1 (or local+1).
  Future<void> forcePushLocal(String localId) async {
    final rows = await _db.db.query(
      'census_records',
      where: 'local_id = ?',
      whereArgs: [localId],
      limit: 1,
    );
    if (rows.isEmpty) return;
    final row = rows.first;
    final metaRaw = await _db.getMeta('conflict:$localId');
    var nextVersion = ((row['version'] as int?) ?? 1) + 1;
    if (metaRaw != null) {
      try {
        final meta = jsonDecode(metaRaw) as Map<String, dynamic>;
        final serverV = (meta['server_version'] as num?)?.toInt();
        if (serverV != null && serverV >= nextVersion) {
          nextVersion = serverV + 1;
        }
      } catch (_) {}
    }

    final now = DateTime.now().toUtc().toIso8601String();
    await _db.db.update(
      'census_records',
      {
        'version': nextVersion,
        'status': 'QUEUED',
        'conflict_reason': null,
        'updated_at': now,
      },
      where: 'local_id = ?',
      whereArgs: [localId],
    );
    await _db.db.delete('sync_meta', where: 'key = ?', whereArgs: ['conflict:$localId']);

    final payload = <String, dynamic>{
      'local_id': localId,
      'household_local_id': row['household_local_id'],
      'campaign_id': row['campaign_id'],
      'given_names': row['given_names'],
      'family_name': row['family_name'],
      'sex': row['sex'],
      'date_of_birth': row['date_of_birth'],
      'photo_ref': row['photo_ref'],
      'version': nextVersion,
    };
    await _queue.enqueue(
      SyncQueueItem(
        entityType: 'census_record',
        localId: localId,
        version: nextVersion,
        payload: payload,
      ),
    );
    await _db.setMeta('sync_status', 'EN_ATTENTE');
  }

  /// Accept server snapshot stored at conflict time (or leave SYNCED after pull).
  Future<void> acceptServer(String localId) async {
    final metaRaw = await _db.getMeta('conflict:$localId');
    Map<String, dynamic>? server;
    int? serverVersion;
    if (metaRaw != null) {
      try {
        final meta = jsonDecode(metaRaw) as Map<String, dynamic>;
        serverVersion = (meta['server_version'] as num?)?.toInt();
        if (meta['server'] is Map) {
          server = Map<String, dynamic>.from(meta['server'] as Map);
        }
      } catch (_) {}
    }

    final now = DateTime.now().toUtc().toIso8601String();
    final patch = <String, Object?>{
      'status': 'SYNCED',
      'conflict_reason': null,
      'updated_at': now,
    };
    if (server != null) {
      if (server['given_names'] != null) patch['given_names'] = server['given_names'];
      if (server['family_name'] != null) patch['family_name'] = server['family_name'];
      if (server['sex'] != null) patch['sex'] = server['sex'];
      if (server['date_of_birth'] != null) {
        patch['date_of_birth'] = server['date_of_birth'];
      }
      if (server['version'] != null) {
        patch['version'] = (server['version'] as num).toInt();
      } else if (serverVersion != null) {
        patch['version'] = serverVersion;
      }
    } else if (serverVersion != null) {
      patch['version'] = serverVersion;
    }

    await _db.db.update(
      'census_records',
      patch,
      where: 'local_id = ?',
      whereArgs: [localId],
    );
    await _db.db.delete('sync_meta', where: 'key = ?', whereArgs: ['conflict:$localId']);

    final remaining = await _db.db.rawQuery(
      "SELECT COUNT(*) AS c FROM census_records WHERE status = 'CONFLICT'",
    );
    final left = (remaining.first['c'] as num?)?.toInt() ?? 0;
    await _db.setMeta('sync_status', left > 0 ? 'CONFLICT' : 'SYNCED');
  }

  Future<void> _markConflict(
    String localId, {
    String? reason,
    int? serverVersion,
    Map<String, dynamic>? serverSnapshot,
  }) async {
    await _db.db.update(
      'census_records',
      {
        'status': 'CONFLICT',
        'conflict_reason': reason,
      },
      where: 'local_id = ?',
      whereArgs: [localId],
    );
    await _db.setMeta(
      'conflict:$localId',
      jsonEncode({
        'reason': reason,
        'server_version': serverVersion,
        'server': serverSnapshot,
        'at': DateTime.now().toUtc().toIso8601String(),
      }),
    );
  }

  Future<void> _markSynced(String localId) async {
    await _db.db.update(
      'census_records',
      {'status': 'SYNCED', 'conflict_reason': null},
      where: 'local_id = ?',
      whereArgs: [localId],
    );
    // Households aren't in census_records — also clear household queue targets quietly.
    await _db.db.update(
      'households',
      {'updated_at': DateTime.now().toUtc().toIso8601String()},
      where: 'local_id = ?',
      whereArgs: [localId],
    );
  }

  Future<void> _applyPull(Map<String, dynamic> body) async {
    final households = (body['households'] as List?) ?? [];
    for (final raw in households) {
      final h = Map<String, dynamic>.from(raw as Map);
      final localId = h['local_id']?.toString();
      if (localId == null || localId.isEmpty) continue;
      final existing = await _db.db.query(
        'households',
        where: 'local_id = ?',
        whereArgs: [localId],
        limit: 1,
      );
      final row = {
        'id': h['id']?.toString() ?? localId,
        'local_id': localId,
        'campaign_id': h['campaign_id']?.toString() ??
            (existing.isNotEmpty ? existing.first['campaign_id'] : '') ??
            '',
        'address_line': h['address_line'],
        'latitude': h['latitude'],
        'longitude': h['longitude'],
        'member_count': (h['member_count'] as num?)?.toInt() ?? 0,
        'updated_at': h['updated_at']?.toString() ??
            DateTime.now().toUtc().toIso8601String(),
      };
      if (existing.isEmpty) {
        // campaign_id required — skip if unknown
        if ((row['campaign_id'] as String?)?.isEmpty ?? true) continue;
        await _db.db.insert('households', row);
      } else {
        final pending = await _db.db.query(
          'sync_queue',
          where: "entity_type = 'household' AND local_id = ?",
          whereArgs: [localId],
          limit: 1,
        );
        if (pending.isEmpty) {
          await _db.db.update(
            'households',
            {
              'address_line': row['address_line'],
              'latitude': row['latitude'],
              'longitude': row['longitude'],
              'member_count': row['member_count'],
              'updated_at': row['updated_at'],
            },
            where: 'local_id = ?',
            whereArgs: [localId],
          );
        }
      }
    }

    final records = (body['records'] as List?) ?? [];
    for (final raw in records) {
      final r = raw as Map<String, dynamic>;
      final localId = r['local_id']?.toString();
      if (localId == null) continue;

      final queued = await _db.db.query(
        'sync_queue',
        where: "entity_type = 'census_record' AND local_id = ?",
        whereArgs: [localId],
        limit: 1,
      );
      if (queued.isNotEmpty) continue;

      final existing = await _db.db.query(
        'census_records',
        where: 'local_id = ?',
        whereArgs: [localId],
        limit: 1,
      );
      final serverVersion = (r['version'] as num?)?.toInt() ?? 1;
      final campaignId = r['campaign_id']?.toString() ??
          (existing.isNotEmpty ? existing.first['campaign_id']?.toString() : null) ??
          '';
      final hhLocal = r['household_local_id']?.toString() ??
          (existing.isNotEmpty
              ? existing.first['household_local_id']?.toString()
              : null) ??
          '';

      if (existing.isEmpty) {
        if (campaignId.isEmpty) continue;
        await _db.db.insert('census_records', {
          'id': r['id']?.toString() ?? localId,
          'local_id': localId,
          'household_local_id': hhLocal,
          'campaign_id': campaignId,
          'given_names': r['given_names'],
          'family_name': r['family_name'],
          'sex': r['sex'],
          'date_of_birth': r['date_of_birth'],
          'version': serverVersion,
          'status': r['status'] ?? 'SYNCED',
          'updated_at': DateTime.now().toUtc().toIso8601String(),
        });
      } else {
        final localStatus = existing.first['status']?.toString() ?? '';
        if (localStatus == 'CONFLICT' || localStatus == 'QUEUED') {
          continue;
        }
        final localVersion = (existing.first['version'] as int?) ?? 1;
        final outcome = ConflictManager.resolve(
          localVersion: localVersion,
          serverVersion: serverVersion,
        );
        if (outcome == ConflictOutcome.serverWins ||
            outcome == ConflictOutcome.sameVersion) {
          await _db.db.update(
            'census_records',
            {
              'given_names': r['given_names'],
              'family_name': r['family_name'],
              'sex': r['sex'],
              'date_of_birth': r['date_of_birth'],
              'version': serverVersion,
              'status': r['status'] ?? 'SYNCED',
              'conflict_reason': null,
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
