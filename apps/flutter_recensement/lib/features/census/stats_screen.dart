import 'package:flutter/material.dart';

import '../../sync/local_database.dart';

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
    setState(() {
      households = hh;
      records = rec;
      queued = q;
      conflicts = conf;
    });
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _tile(context, 'Ménages locaux', households),
          _tile(context, 'Fiches citoyens', records),
          _tile(context, 'File de sync', queued),
          _tile(context, 'Conflits', conflicts),
        ],
      ),
    );
  }

  Widget _tile(BuildContext context, String label, int value) {
    return Card(
      child: ListTile(
        title: Text(label),
        trailing: Text(
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
