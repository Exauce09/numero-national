import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;

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
      version: 6,
      onCreate: (db, version) async {
        await _createV1(db);
        await _createV2(db);
        await _createV3(db);
        await _createV4(db);
        await _createV5(db);
        await _createV6(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          await _createV2(db);
        }
        if (oldVersion < 3) {
          await _createV3(db);
        }
        if (oldVersion < 4) {
          await _createV4(db);
        }
        if (oldVersion < 5) {
          await _createV5(db);
        }
        if (oldVersion < 6) {
          await _createV6(db);
        }
      },
    );
  }

  Future<void> _createV1(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS households (
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
      CREATE TABLE IF NOT EXISTS census_records (
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
      CREATE TABLE IF NOT EXISTS sync_queue (
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
      CREATE TABLE IF NOT EXISTS campaigns_cache (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT,
        status TEXT,
        payload TEXT
      )
    ''');
  }

  Future<void> _createV2(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS zones_cache (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        code TEXT,
        name TEXT,
        province_code TEXT,
        commune_code TEXT,
        geo_level TEXT,
        payload TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS assignments_cache (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        zone_id TEXT,
        team_id TEXT,
        role_label TEXT,
        payload TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    ''');
  }

  Future<void> _createV3(Database db) async {
    await db.execute(
      'ALTER TABLE census_records ADD COLUMN conflict_reason TEXT',
    );
  }

  Future<void> _createV4(Database db) async {
    await db.execute(
      'ALTER TABLE census_records ADD COLUMN review_note TEXT',
    );
  }

  Future<void> _createV5(Database db) async {
    await db.execute(
      'ALTER TABLE census_records ADD COLUMN payload TEXT',
    );
  }

  Future<void> _createV6(Database db) async {
    await db.execute(
      'ALTER TABLE households ADD COLUMN address_source TEXT',
    );
  }

  Database get db {
    final d = _db;
    if (d == null) {
      throw StateError('LocalDatabase not initialized');
    }
    return d;
  }

  Future<void> setMeta(String key, String value) async {
    await db.insert(
      'sync_meta',
      {'key': key, 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<String?> getMeta(String key) async {
    final rows = await db.query('sync_meta', where: 'key = ?', whereArgs: [key], limit: 1);
    if (rows.isEmpty) return null;
    return rows.first['value']?.toString();
  }
}
