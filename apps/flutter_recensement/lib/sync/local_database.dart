import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// Local SQLite store for offline census collection.
class LocalDatabase {
  LocalDatabase._();
  static final LocalDatabase instance = LocalDatabase._();

  Database? _db;

  Future<void> init() async {
    if (_db != null) return;
    final dbPath = await getDatabasesPath();
    _db = await openDatabase(
      p.join(dbPath, 'recensement.db'),
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE households (
            id TEXT PRIMARY KEY,
            local_id TEXT NOT NULL,
            campaign_id TEXT NOT NULL,
            address_line TEXT,
            latitude REAL,
            longitude REAL,
            member_count INTEGER DEFAULT 0,
            updated_at TEXT NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE census_records (
            id TEXT PRIMARY KEY,
            local_id TEXT NOT NULL,
            household_local_id TEXT NOT NULL,
            campaign_id TEXT NOT NULL,
            given_names TEXT,
            family_name TEXT,
            sex TEXT,
            date_of_birth TEXT,
            photo_ref TEXT,
            version INTEGER DEFAULT 1,
            status TEXT DEFAULT 'DRAFT',
            updated_at TEXT NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL,
            local_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL,
            attempts INTEGER DEFAULT 0
          )
        ''');
        await db.execute('''
          CREATE TABLE campaigns_cache (
            id TEXT PRIMARY KEY,
            code TEXT,
            name TEXT,
            status TEXT,
            payload TEXT
          )
        ''');
      },
    );
  }

  Database get db {
    final d = _db;
    if (d == null) {
      throw StateError('LocalDatabase not initialized');
    }
    return d;
  }
}
