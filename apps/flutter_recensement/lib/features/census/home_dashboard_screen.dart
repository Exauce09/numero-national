import 'package:flutter/material.dart';

import '../../core/secure_storage.dart';
import '../../core/theme.dart';
import '../../sync/local_database.dart';
import '../../sync/sync_engine.dart';
import 'assignment_repository.dart';
import 'conflicts_screen.dart';

/// Home agent — layout type dashboard mobile (cartes KPI + actions), charte E-GOUV.
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
  int _rec = 0;
  int _queued = 0;
  int _conflicts = 0;
  int _assignments = 0;
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
    final rec = await _count(db, 'SELECT COUNT(*) AS c FROM census_records');
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
      _hh = hh;
      _rec = rec;
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
    return NnColors.blue;
  }

  @override
  Widget build(BuildContext context) {
    final shortName = _email.contains('@') ? _email.split('@').first : _email;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          // Hero header
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF5D87FF), Color(0xFF4570EA)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(22),
              boxShadow: [
                BoxShadow(
                  color: NnColors.blue.withValues(alpha: 0.28),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '$_greeting,',
                            style: const TextStyle(color: Colors.white70, fontSize: 14),
                          ),
                          Text(
                            shortName,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.badge_outlined, color: Colors.white),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.circle, size: 10, color: _syncColor()),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Sync · $_syncLabel',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                        ),
                      ),
                      TextButton(
                        onPressed: _busy ? null : _runSync,
                        style: TextButton.styleFrom(
                          foregroundColor: Colors.white,
                          backgroundColor: Colors.white.withValues(alpha: 0.2),
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                        ),
                        child: _busy
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Text('Sync'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Aujourd’hui',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.35,
            children: [
              _KpiCard(
                label: 'Ménages',
                value: '$_hh',
                icon: Icons.home_work_outlined,
                tint: NnColors.softBlue,
                iconColor: NnColors.blue,
              ),
              _KpiCard(
                label: 'Personnes',
                value: '$_rec',
                icon: Icons.groups_outlined,
                tint: NnColors.softGreen,
                iconColor: const Color(0xFF13DEB9),
              ),
              _KpiCard(
                label: 'En attente',
                value: '$_queued',
                icon: Icons.cloud_upload_outlined,
                tint: NnColors.softOrange,
                iconColor: NnColors.warning,
              ),
              _KpiCard(
                label: 'Conflits',
                value: '$_conflicts',
                icon: Icons.warning_amber_rounded,
                tint: NnColors.softRed,
                iconColor: NnColors.danger,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const ConflictsScreen()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
          Text(
            'Actions rapides',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          _ActionTile(
            title: 'Fiche d’identification',
            subtitle: '7 étapes comme le site — Zones → ménage → + Personne',
            icon: Icons.badge_outlined,
            color: const Color(0xFFE11D48),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                    'Zones → campagne → ménage → bouton + Personne (wizard 7 étapes)',
                  ),
                ),
              );
              widget.onOpenTab(1);
            },
          ),
          const SizedBox(height: 10),
          _ActionTile(
            title: 'Mes zones',
            subtitle: '$_assignments affectation(s)',
            icon: Icons.map_outlined,
            color: NnColors.blue,
            onTap: () => widget.onOpenTab(1),
          ),
          const SizedBox(height: 10),
          _ActionTile(
            title: 'Statistiques',
            subtitle: 'Local + serveur',
            icon: Icons.insights_outlined,
            color: const Color(0xFF13DEB9),
            onTap: () => widget.onOpenTab(2),
          ),
          const SizedBox(height: 10),
          _ActionTile(
            title: 'Appareil',
            subtitle: 'Enregistrement device',
            icon: Icons.phone_android_outlined,
            color: NnColors.warning,
            onTap: () => widget.onOpenTab(3),
          ),
        ],
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.tint,
    required this.iconColor,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color tint;
  final Color iconColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: NnColors.card,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: NnColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const Spacer(),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  color: NnColors.ink,
                ),
              ),
              Text(label, style: const TextStyle(color: NnColors.muted, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: NnColors.card,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: NnColors.line),
          ),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    Text(subtitle, style: const TextStyle(color: NnColors.muted, fontSize: 12)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: NnColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}

/// Home KPI dashboard widgets.
