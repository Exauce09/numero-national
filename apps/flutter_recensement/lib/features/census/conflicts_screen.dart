import 'package:flutter/material.dart';

import '../../sync/local_database.dart';
import '../../sync/sync_engine.dart';

/// Lists local census records in CONFLICT and lets the agent resolve them.
class ConflictsScreen extends StatefulWidget {
  const ConflictsScreen({super.key});

  @override
  State<ConflictsScreen> createState() => _ConflictsScreenState();
}

class _ConflictsScreenState extends State<ConflictsScreen> {
  final _sync = SyncEngine();
  List<Map<String, Object?>> _rows = [];
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final rows = await LocalDatabase.instance.db.query(
      'census_records',
      where: "status = 'CONFLICT'",
      orderBy: 'updated_at DESC',
    );
    if (!mounted) return;
    setState(() => _rows = rows);
  }

  Future<void> _force(String localId) async {
    setState(() => _busy = true);
    try {
      await _sync.forcePushLocal(localId);
      final msg = await _sync.runOnce();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      await _load();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _accept(String localId) async {
    setState(() => _busy = true);
    try {
      await _sync.acceptServer(localId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Version serveur conservée')),
      );
      await _load();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Conflits de sync')),
      body: _busy
          ? const Center(child: CircularProgressIndicator())
          : _rows.isEmpty
              ? const Center(child: Text('Aucun conflit en cours.'))
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) {
                    final m = _rows[i];
                    final name =
                        '${m['given_names'] ?? ''} ${m['family_name'] ?? ''}'.trim();
                    final reason = m['conflict_reason']?.toString() ?? 'conflit';
                    final version = m['version']?.toString() ?? '?';
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name.isEmpty ? 'Fiche sans nom' : name,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 4),
                            Text('Raison: $reason · version locale: $version'),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              children: [
                                OutlinedButton(
                                  onPressed: () => _accept(m['local_id'] as String),
                                  child: const Text('Accepter serveur'),
                                ),
                                FilledButton(
                                  onPressed: () => _force(m['local_id'] as String),
                                  child: const Text('Forcer mon envoi'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
