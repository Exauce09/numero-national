import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/secure_storage.dart';
import '../../sync/local_database.dart';
import 'conflicts_screen.dart';

class StatsScreen extends StatefulWidget {
  const StatsScreen({super.key});

  @override
  State<StatsScreen> createState() => _StatsScreenState();
}

class _StatsScreenState extends State<StatsScreen> {
  int households = 0;
  int records = 0;
  int queued = 0;
  int conflicts = 0;
  String syncStatus = 'UNKNOWN';
  int? serverHouseholds;
  int? serverRecords;
  int? serverSynced;
  String? serverError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final db = LocalDatabase.instance.db;
    final hh = SqfliteFirstIntValue(await db.rawQuery('SELECT COUNT(*) AS c FROM households')) ?? 0;
    final rec = SqfliteFirstIntValue(await db.rawQuery('SELECT COUNT(*) AS c FROM census_records')) ?? 0;
    final q = SqfliteFirstIntValue(await db.rawQuery('SELECT COUNT(*) AS c FROM sync_queue')) ?? 0;
    final conf = SqfliteFirstIntValue(
          await db.rawQuery("SELECT COUNT(*) AS c FROM census_records WHERE status = 'CONFLICT'"),
        ) ??
        0;
    final status = await LocalDatabase.instance.getMeta('sync_status') ?? 'UNKNOWN';

    int? sHh;
    int? sRec;
    int? sSynced;
    String? err;
    final userId = await SecureStore.instance.userId;
    if (userId != null && userId.isNotEmpty) {
      try {
        final api = ApiClient();
        final res = await api.get('/census/agents/$userId/stats');
        if (res.statusCode >= 200 && res.statusCode < 300) {
          final body = api.decodeMap(res);
          sHh = (body['households_collected'] as num?)?.toInt();
          sRec = (body['records_collected'] as num?)?.toInt();
          sSynced = (body['synced_records'] as num?)?.toInt();
        } else {
          err = 'Stats serveur ${res.statusCode}';
        }
      } catch (e) {
        err = 'Stats serveur indisponibles';
      }
    }

    if (!mounted) return;
    setState(() {
      households = hh;
      records = rec;
      queued = q;
      conflicts = conf;
      syncStatus = status;
      serverHouseholds = sHh;
      serverRecords = sRec;
      serverSynced = sSynced;
      serverError = err;
    });
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Local', style: Theme.of(context).textTheme.titleMedium),
          _tile(context, 'Statut sync', null, subtitle: syncStatus),
          _tile(context, 'Ménages locaux', households),
          _tile(context, 'Fiches citoyens', records),
          _tile(context, 'File de sync', queued),
          Card(
            child: ListTile(
              title: const Text('Conflits'),
              trailing: Text(
                '$conflicts',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: conflicts > 0 ? Colors.orange : null,
                    ),
              ),
              subtitle: conflicts > 0
                  ? const Text('Appuyer pour résoudre')
                  : const Text('Aucun conflit'),
              onTap: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const ConflictsScreen()),
                );
                await _load();
              },
            ),
          ),
          const SizedBox(height: 16),
          Text('Serveur', style: Theme.of(context).textTheme.titleMedium),
          if (serverError != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(serverError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          _tile(context, 'Ménages (agent)', serverHouseholds ?? 0),
          _tile(context, 'Fiches (agent)', serverRecords ?? 0),
          _tile(context, 'Fiches synchronisées', serverSynced ?? 0),
        ],
      ),
    );
  }

  Widget _tile(BuildContext context, String label, int? value, {String? subtitle}) {
    return Card(
      child: ListTile(
        title: Text(label),
        subtitle: subtitle != null ? Text(subtitle) : null,
        trailing: value == null
            ? null
            : Text(
                '$value',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
      ),
    );
  }
}

int? SqfliteFirstIntValue(List<Map<String, Object?>> rows) {
  if (rows.isEmpty) return null;
  final v = rows.first.values.first;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse('$v');
}
