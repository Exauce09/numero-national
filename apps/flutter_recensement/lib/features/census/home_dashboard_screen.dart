import 'package:flutter/material.dart';

import '../../core/secure_storage.dart';
import '../../core/theme.dart';
import '../../sync/local_database.dart';
import '../../sync/sync_lifecycle.dart';
import 'assignment_repository.dart';
import 'conflicts_screen.dart';
import 'new_person_flow_screen.dart';

/// Accueil agent — design sobre : une action principale + indicateurs utiles.
class HomeDashboardScreen extends StatefulWidget {
  const HomeDashboardScreen({super.key, required this.onOpenTab});

  final ValueChanged<int> onOpenTab;

  @override
  State<HomeDashboardScreen> createState() => _HomeDashboardScreenState();
}

class _HomeDashboardScreenState extends State<HomeDashboardScreen> {
  String _email = 'Agent';
  String _syncLabel = '…';
  int _queued = 0;
  int _conflicts = 0;
  int _assignments = 0;

  @override
  void initState() {
    super.initState();
    _load();
    SyncLifecycle.instance.nudge();
  }

  Future<void> _load() async {
    final email = await SecureStore.instance.userEmail;
    final label = await AssignmentRepository().syncStatusLabel();
    final db = LocalDatabase.instance.db;
    final q = await _count(db, 'SELECT COUNT(*) AS c FROM sync_queue');
    final conf = await _count(
      db,
      "SELECT COUNT(*) AS c FROM census_records WHERE status = 'CONFLICT'",
    );
    final asg = await _count(db, 'SELECT COUNT(*) AS c FROM assignments_cache');
    if (!mounted) return;
    setState(() {
      _email = email ?? 'Agent terrain';
      _syncLabel = label;
      _queued = q;
      _conflicts = conf;
      _assignments = asg;
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
      onRefresh: () async {
        SyncLifecycle.instance.nudge();
        await _load();
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        children: [
          Text(
            '$_greeting, $shortName',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: NnColors.ink,
                ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(color: _syncColor(), shape: BoxShape.circle),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Sync auto · $_syncLabel'
                  '${_queued > 0 ? ' · $_queued en file' : ''}',
                  style: const TextStyle(color: NnColors.muted, fontSize: 13),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: NnColors.rdcRed,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const NewPersonFlowScreen()),
              );
            },
            icon: const Icon(Icons.person_add_alt_1),
            label: const Text('Nouvelle fiche'),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _MiniStat(
                  label: 'Zones',
                  value: '$_assignments',
                  onTap: () => widget.onOpenTab(1),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MiniStat(
                  label: 'À sync',
                  value: '$_queued',
                  onTap: () => SyncLifecycle.instance.nudge(),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MiniStat(
                  label: 'Conflits',
                  value: '$_conflicts',
                  alert: _conflicts > 0,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ConflictsScreen()),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({
    required this.label,
    required this.value,
    required this.onTap,
    this.alert = false,
  });

  final String label;
  final String value;
  final VoidCallback onTap;
  final bool alert;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: NnColors.card,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: alert ? NnColors.rdcRed.withValues(alpha: 0.4) : NnColors.line),
          ),
          child: Column(
            children: [
              Text(
                value,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: alert ? NnColors.rdcRed : NnColors.ink,
                ),
              ),
              const SizedBox(height: 2),
              Text(label, style: const TextStyle(fontSize: 12, color: NnColors.muted)),
            ],
          ),
        ),
      ),
    );
  }
}
