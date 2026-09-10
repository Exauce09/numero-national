import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/pos_printer.dart';
import '../../core/secure_storage.dart';
import '../../core/theme.dart';
import '../../sync/local_database.dart';
import '../../sync/sync_lifecycle.dart';
import 'assignment_repository.dart';
import 'conflicts_screen.dart';
import 'new_person_flow_screen.dart';

/// Accueil agent — design professionnel, actions utiles uniquement.
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
  bool _busyPrint = false;

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

  String get _shortName {
    final e = _email;
    if (e.contains('@')) return e.split('@').first;
    return e;
  }

  Color _syncColor() {
    final s = _syncLabel.toUpperCase();
    if (s.contains('SYNCED') || s.contains('OK')) return NnColors.success;
    if (s.contains('OFFLINE') || s.contains('HORS')) return NnColors.muted;
    if (s.contains('ERROR') || s.contains('CONFLICT')) return NnColors.danger;
    if (s.contains('ATTENTE') || s.contains('SYNCING')) return NnColors.warning;
    return NnColors.rdcBlue;
  }

  String get _syncHuman {
    final s = _syncLabel.toUpperCase();
    if (s.contains('SYNCED') || s.contains('OK')) return 'À jour';
    if (s.contains('OFFLINE') || s.contains('HORS')) return 'Hors ligne';
    if (s.contains('SYNCING')) return 'Synchronisation…';
    if (s.contains('ATTENTE')) return 'En attente réseau';
    if (s.contains('ERROR')) return 'Erreur sync';
    return _syncLabel;
  }

  Future<void> _testPrinter() async {
    if (_busyPrint) return;
    setState(() => _busyPrint = true);
    final id = 'TEST-${DateTime.now().millisecondsSinceEpoch % 100000}';
    try {
      await PosPrinter.printCoupon(
        title: 'ONIP - Recensement',
        subtitle: 'Test imprimante',
        name: _shortName,
        sex: 'Masculin',
        dob: '1990-01-15',
        localId: id,
        qr: '{"type":"nn_census_coupon","v":1,"local_id":"$id"}',
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Test OK — regardez le ticket POS')),
      );
    } on PlatformException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Impression refusee : ${e.message ?? e.code}'),
          backgroundColor: NnColors.danger,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Impression refusee : $e'),
          backgroundColor: NnColors.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _busyPrint = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async {
        SyncLifecycle.instance.nudge();
        await _load();
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          // En-tête marque
          Container(
            decoration: BoxDecoration(
              color: NnColors.card,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: NnColors.line),
              boxShadow: [
                BoxShadow(
                  color: NnColors.ink.withValues(alpha: 0.04),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const RdcStripe(height: 5),
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.asset(
                          'assets/logo-rdc.jpg',
                          width: 52,
                          height: 52,
                          fit: BoxFit.cover,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'ONIP · Recensement',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: NnColors.ink,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _shortName,
                              style: const TextStyle(color: NnColors.muted, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Sync auto (informatif seulement — pas de bouton obligatoire)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: NnColors.softBlue,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: NnColors.line),
            ),
            child: Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(color: _syncColor(), shape: BoxShape.circle),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Sync automatique · $_syncHuman'
                    '${_queued > 0 ? ' · $_queued en file' : ''}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: NnColors.ink,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),

          const Text(
            'Collecte terrain',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: NnColors.ink),
          ),
          const SizedBox(height: 10),

          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: NnColors.rdcRed,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const NewPersonFlowScreen()),
              ).then((_) => _load());
            },
            icon: const Icon(Icons.person_add_alt_1_rounded),
            label: const Text('Nouvelle fiche citoyen'),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => widget.onOpenTab(1),
            icon: const Icon(Icons.home_work_outlined),
            label: const Text('Ménages & zones'),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: _busyPrint ? null : _testPrinter,
            icon: _busyPrint
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.print_outlined),
            label: Text(_busyPrint ? 'Impression…' : 'Tester l’imprimante'),
          ),
          const SizedBox(height: 22),

          Row(
            children: [
              Expanded(
                child: _StatTile(
                  icon: Icons.map_outlined,
                  label: 'Zones',
                  value: '$_assignments',
                  onTap: () => widget.onOpenTab(1),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _StatTile(
                  icon: Icons.warning_amber_rounded,
                  label: 'Conflits',
                  value: '$_conflicts',
                  alert: _conflicts > 0,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ConflictsScreen()),
                  ).then((_) => _load()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const Text(
            'v0.3.0 · GPS · empreinte téléphone · iris œil',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11, color: NnColors.muted),
          ),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
    this.alert = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;
  final bool alert;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: NnColors.card,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 16, 14, 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: alert ? NnColors.rdcRed.withValues(alpha: 0.45) : NnColors.line,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 22, color: alert ? NnColors.rdcRed : NnColors.rdcBlue),
              const SizedBox(height: 10),
              Text(
                value,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: alert ? NnColors.rdcRed : NnColors.ink,
                ),
              ),
              Text(label, style: const TextStyle(fontSize: 12, color: NnColors.muted)),
            ],
          ),
        ),
      ),
    );
  }
}
