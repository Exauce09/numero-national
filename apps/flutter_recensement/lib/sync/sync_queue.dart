import 'dart:convert';

import 'local_database.dart';

class SyncQueueItem {
  SyncQueueItem({
    required this.entityType,
    required this.localId,
    required this.version,
    required this.payload,
  });

  final String entityType;
  final String localId;
  final int version;
  final Map<String, dynamic> payload;
}

/// Outbox of mutations waiting for server push.
class SyncQueue {
  SyncQueue({LocalDatabase? db}) : _db = db ?? LocalDatabase.instance;

  final LocalDatabase _db;

  Future<void> enqueue(SyncQueueItem item) async {
    await _db.db.insert('sync_queue', {
      'entity_type': item.entityType,
      'local_id': item.localId,
      'version': item.version,
      'payload': jsonEncode(item.payload),
      'created_at': DateTime.now().toUtc().toIso8601String(),
      'attempts': 0,
    });
  }

  Future<List<Map<String, dynamic>>> pending({int limit = 100}) async {
    return _db.db.query('sync_queue', orderBy: 'id ASC', limit: limit);
  }

  Future<void> remove(int id) async {
    await _db.db.delete('sync_queue', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> bumpAttempts(int id) async {
    await _db.db.rawUpdate(
      'UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?',
      [id],
    );
  }
}
