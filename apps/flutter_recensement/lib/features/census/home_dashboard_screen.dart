import 'package:flutter/material.dart';

import '../../core/secure_storage.dart';
import '../../core/theme.dart';
import '../../sync/local_database.dart';
import '../../sync/sync_engine.dart';
import 'assignment_repository.dart';
import 'conflicts_screen.dart';
import 'new_person_flow_screen.dart';

/// Accueil agent — design épuré (RDC), une action principale.
class HomeDashboardScreen extends StatefulWidget {
  const HomeDashboardScreen({super.key, required this.onOpenTab});

  final ValueChanged<int> onOpenTab;

  @override
  State<HomeDashboardScreen> createState() => _HomeDashboardScreenState();
}

class _HomeDashboardScreenState extends State<HomeDashboardScreen> {
  final _sync = SyncEngine();
  String _email = 'Agent';
  String _syncLabel = '…';
  int _hh = 0;
  int _queued = 0;
  int _conflicts = 0;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final email = await SecureStore.instance.userEmail;
    final label = await AssignmentRepository().syncStatusLabel();
    final db = LocalDatabase.instance.db;
    final hh = await _count(db, 'SELECT COUNT(*) AS c FROM households');
    final q = await _count(db, 'SELECT COUNT(*) AS c FROM sync_queue');
    final conf = await _count(
      db,
      "SELECT COUNT(*) AS c FROM census_records WHERE status = 'CONFLICT'",
    );
    if (!mounted) return;
    setState(() {
      _email = email ?? 'Agent terrain';
      _syncLabel = label;
      _hh = hh;
      _queued = q;
      _conflicts = conf;
    });
  }

  Future<int> _count(dynamic db, String sql) async {
    final rows = await db.rawQuery(sql) as List;
    if (rows.isEmpty) return 0;
    final v = rows.first.values.first;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse('$v') ?? 0;
  }

  Future<void> _runSync() async {
    setState(() => _busy = true);
    await LocalDatabase.instance.setMeta('sync_status', 'SYNCING');
    final msg = await _sync.runOnce();
    await _load();
    if (!mounted) return;
    setState(() => _busy = false);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }

  Color _syncColor() {
    final s = _syncLabel.toUpperCase();
    if (s.contains('SYNCED') || s.contains('OK')) return NnColors.success;
    if (s.contains('OFFLINE') || s.contains('HORS')) return NnColors.muted;
    if (s.contains('ERROR') || s.contains('CONFLICT')) return NnColors.danger;
    if (s.contains('ATTENTE') || s.contains('SYNCING')) return NnColors.warning;
    return NnColors.rdcBlue;
  }

  @override
  Widget build(BuildContext context) {
    final shortName = _email.contains('@') ? _email.split('@').first : _email;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
            decoration: BoxDecoration(
              color: NnColors.card,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: NnColors.line),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 4,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(2),
                    gradient: const LinearGradient(
                      colors: [NnColors.rdcBlue, NnColors.rdcYellow, NnColors.rdcRed],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  '$_greeting,',
                  style: TextStyle(color: NnColors.muted, fontSize: 13, fontWeight: FontWeight.w600),
                ),
                Text(
                  shortName,
                  style: const TextStyle(
                    color: NnColors.ink,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Icon(Icons.circle, size: 9, color: _syncColor()),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _syncLabel,
                        style: const TextStyle(fontWeight: FontWeight.w600, color: NnColors.ink),
                      ),
                    ),
                    FilledButton(
                      onPressed: _busy ? null : _runSync,
                      style: FilledButton.styleFrom(
                        backgroundColor: NnColors.rdcBlue,
                        minimumSize: const Size(0, 40),
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                      ),
                      child: _busy
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Synchroniser'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _StatChip(label: 'Ménages', value: '$_hh', color: NnColors.rdcBlue),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _StatChip(label: 'À envoyer', value: '$_queued', color: NnColors.warning),
              ),
              if (_conflicts > 0) ...[
                const SizedBox(width: 10),
                Expanded(
                  child: _StatChip(
                    label: 'Conflits',
                    value: '$_conflicts',
                    color: NnColors.danger,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ConflictsScreen()),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 22),
          FilledButton.icon(
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const NewPersonFlowScreen()),
              );
            },
            icon: const Icon(Icons.person_add_alt_1),
            label: const Text('Nouvelle fiche'),
            style: FilledButton.styleFrom(
              backgroundColor: NnColors.rdcRed,
              minimumSize: const Size.fromHeight(54),
              textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Identité, adresse, biométrie — puis synchronisation.',
            textAlign: TextAlign.center,
            style: TextStyle(color: NnColors.muted, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.label,
    required this.value,
    required this.color,
    this.onTap,
  });

  final String label;
  final String value;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final child = Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: NnColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: NnColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: NnColors.muted, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color)),
        ],
      ),
    );
    if (onTap == null) return child;
    return Material(
      color: Colors.transparent,
      child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(14), child: child),
    );
  }
}
