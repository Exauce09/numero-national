import 'dart:convert';

import '../../core/api_client.dart';
import '../../sync/local_database.dart';

class CampaignRepository {
  CampaignRepository({ApiClient? client, LocalDatabase? db})
      : _api = client ?? ApiClient(),
        _db = db ?? LocalDatabase.instance;

  final ApiClient _api;
  final LocalDatabase _db;

  Future<List<Map<String, dynamic>>> listCampaigns({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = await _readCache();
      if (cached.isNotEmpty) {
        // Still try network in background path — caller uses forceRefresh on pull-to-refresh.
      }
    }

    try {
      final res = await _api.get('/census/campaigns');
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final list = _api.decodeList(res);
        final mapped = list
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        await _writeCache(mapped);
        return mapped;
      }
    } catch (_) {
      // fall through to cache
    }

    final cached = await _readCache();
    if (cached.isNotEmpty) return cached;
    throw ApiException('Impossible de charger les campagnes (hors ligne, cache vide)');
  }

  Future<List<Map<String, dynamic>>> _readCache() async {
    final rows = await _db.db.query('campaigns_cache', orderBy: 'name ASC');
    return rows.map((r) {
      final payload = r['payload']?.toString();
      if (payload != null && payload.isNotEmpty) {
        try {
          return Map<String, dynamic>.from(jsonDecode(payload) as Map);
        } catch (_) {}
      }
      return <String, dynamic>{
        'id': r['id'],
        'code': r['code'],
        'name': r['name'],
        'status': r['status'],
      };
    }).toList();
  }

  Future<void> _writeCache(List<Map<String, dynamic>> campaigns) async {
    final batch = _db.db.batch();
    batch.delete('campaigns_cache');
    for (final c in campaigns) {
      batch.insert('campaigns_cache', {
        'id': c['id'].toString(),
        'code': c['code']?.toString() ?? '',
        'name': c['name']?.toString() ?? '',
        'status': c['status']?.toString() ?? '',
        'payload': jsonEncode(c),
      });
    }
    await batch.commit(noResult: true);
  }
}
