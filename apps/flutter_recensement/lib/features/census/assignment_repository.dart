import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import '../../core/api_client.dart';
import '../../sync/local_database.dart';

class AssignmentRepository {
  AssignmentRepository({ApiClient? client, LocalDatabase? db})
      : _api = client ?? ApiClient(),
        _db = db ?? LocalDatabase.instance;

  final ApiClient _api;
  final LocalDatabase _db;

  Future<List<Map<String, dynamic>>> fetchMyAssignments({bool forceRefresh = true}) async {
    if (forceRefresh) {
      try {
        final res = await _api.get('/census/agents/me/assignments');
        if (res.statusCode >= 200 && res.statusCode < 300) {
          final list = _api
              .decodeList(res)
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
          await _cache(list);
          await _db.setMeta('assignments_synced_at', DateTime.now().toUtc().toIso8601String());
          await _db.setMeta('sync_status', 'SYNCED');
          return list;
        }
        await _db.setMeta('sync_status', 'ERROR');
      } catch (_) {
        await _db.setMeta('sync_status', 'ERROR');
      }
    }
    return _readCache();
  }

  Future<void> _cache(List<Map<String, dynamic>> assignments) async {
    final batch = _db.db.batch();
    batch.delete('assignments_cache');
    for (final a in assignments) {
      final campaign = Map<String, dynamic>.from(a['campaign'] as Map? ?? {});
      final zone = a['zone'] != null ? Map<String, dynamic>.from(a['zone'] as Map) : null;
      final team = Map<String, dynamic>.from(a['team'] as Map? ?? {});
      final campaignId = campaign['id']?.toString() ?? '';
      batch.insert('assignments_cache', {
        'id': a['assignment_id']?.toString() ?? '',
        'campaign_id': campaignId,
        'zone_id': zone?['id']?.toString(),
        'team_id': team['id']?.toString(),
        'role_label': a['role_label']?.toString(),
        'payload': jsonEncode(a),
      });
      if (zone != null) {
        batch.insert(
          'zones_cache',
          {
            'id': zone['id']?.toString() ?? '',
            'campaign_id': campaignId,
            'code': zone['code']?.toString(),
            'name': zone['name']?.toString(),
            'province_code': zone['province_code']?.toString(),
            'commune_code': zone['commune_code']?.toString(),
            'geo_level': zone['geo_level']?.toString(),
            'payload': jsonEncode(zone),
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
      if (campaign.isNotEmpty) {
        batch.insert(
          'campaigns_cache',
          {
            'id': campaignId,
            'code': campaign['code']?.toString() ?? '',
            'name': campaign['name']?.toString() ?? '',
            'status': campaign['status']?.toString() ?? '',
            'payload': jsonEncode(campaign),
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
    }
    await batch.commit(noResult: true);
  }

  Future<List<Map<String, dynamic>>> _readCache() async {
    final rows = await _db.db.query('assignments_cache');
    return rows.map((r) {
      final payload = r['payload']?.toString();
      if (payload != null && payload.isNotEmpty) {
        try {
          return Map<String, dynamic>.from(jsonDecode(payload) as Map);
        } catch (_) {}
      }
      return Map<String, dynamic>.from(r);
    }).toList();
  }

  Future<String> syncStatusLabel() async {
    final status = await _db.getMeta('sync_status') ?? 'UNKNOWN';
    final pending = await _db.db.rawQuery('SELECT COUNT(*) AS c FROM sync_queue');
    final count = (pending.first['c'] as num?)?.toInt() ?? 0;
    if (count > 0) return 'EN_ATTENTE ($count)';
    return status;
  }
}
