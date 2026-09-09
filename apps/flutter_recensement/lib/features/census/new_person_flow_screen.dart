import 'package:flutter/material.dart';

import '../../core/theme.dart';
import 'assignment_repository.dart';
import 'citizens_form.dart';
import 'household_form_screen.dart';
import 'households_screen.dart';

/// Parcours guidé : affectation → ménage → fiche personne (7 étapes).
class NewPersonFlowScreen extends StatefulWidget {
  const NewPersonFlowScreen({super.key});

  @override
  State<NewPersonFlowScreen> createState() => _NewPersonFlowScreenState();
}

class _NewPersonFlowScreenState extends State<NewPersonFlowScreen> {
  final _repo = AssignmentRepository();
  List<Map<String, dynamic>> _assignments = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await _repo.fetchMyAssignments(forceRefresh: true);
      if (!mounted) return;
      setState(() {
        _assignments = list;
        _loading = false;
        if (list.isEmpty) {
          _error =
              'Aucune zone affectée. Demandez à l’ONIP de vous assigner, puis synchronisez.';
        }
      });
    } catch (e) {
      try {
        final cached = await _repo.fetchMyAssignments(forceRefresh: false);
        if (!mounted) return;
        setState(() {
          _assignments = cached;
          _loading = false;
          _error = cached.isEmpty ? '$e' : 'Hors ligne — zones en cache';
        });
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = '$e';
        });
      }
    }
  }

  Future<void> _openHouseholds(Map<String, dynamic> a) async {
    final campaignId = a['campaign_id']?.toString() ?? '';
    final campaignName =
        a['campaign_name']?.toString() ?? a['campaign_code']?.toString() ?? 'Campagne';
    final zoneId = a['zone_id']?.toString();
    if (campaignId.isEmpty) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => HouseholdsScreen(
          campaignId: campaignId,
          campaignName: campaignName,
          zoneId: zoneId,
        ),
      ),
    );
  }

  Future<void> _quickCreatePerson(Map<String, dynamic> a) async {
    final campaignId = a['campaign_id']?.toString() ?? '';
    final zoneId = a['zone_id']?.toString();
    if (campaignId.isEmpty) return;

    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => HouseholdFormScreen(
          campaignId: campaignId,
          zoneId: zoneId,
        ),
      ),
    );
    if (created != true || !mounted) return;

    // Ouvre la liste pour choisir le ménage fraîchement créé, ou relance flow.
    await _openHouseholds(a);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nouvelle fiche personne')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: NnColors.softBlue,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: NnColors.line),
                  ),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Formulaire complet (7 étapes)',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                      ),
                      SizedBox(height: 6),
                      Text(
                        '1 Identité · 2 Origine · 3 Biométrie · 4 Études · 5 Expérience · 6 Admin · 7 Famille',
                        style: TextStyle(color: NnColors.muted, fontSize: 13, height: 1.35),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Choisissez une zone → créez / ouvrez un ménage → « + Personne ».',
                        style: TextStyle(fontSize: 13),
                      ),
                    ],
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  const SizedBox(height: 8),
                  OutlinedButton(onPressed: _load, child: const Text('Réessayer / sync')),
                ],
                const SizedBox(height: 16),
                Text(
                  'Mes zones',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                if (_assignments.isEmpty)
                  const Text('Aucune affectation disponible.')
                else
                  ..._assignments.map((a) {
                    final title =
                        a['zone_name']?.toString() ?? a['campaign_name']?.toString() ?? 'Zone';
                    final sub = [
                      a['campaign_code']?.toString(),
                      a['team_name']?.toString(),
                    ].where((s) => s != null && s.isNotEmpty).join(' · ');
                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.map_outlined, color: NnColors.blue),
                              title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                              subtitle: Text(sub.isEmpty ? 'Campagne' : sub),
                            ),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () => _openHouseholds(a),
                                    child: const Text('Ménages'),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: FilledButton(
                                    style: FilledButton.styleFrom(
                                      backgroundColor: const Color(0xFFE11D48),
                                    ),
                                    onPressed: () => _quickCreatePerson(a),
                                    child: const Text('Nouveau ménage'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
              ],
            ),
    );
  }
}

/// Après ouverture d’un ménage : bouton clair vers le wizard 7 étapes.
Future<void> openPersonWizard(
  BuildContext context, {
  required String campaignId,
  required String householdLocalId,
  Map<String, Object?>? existing,
}) async {
  await Navigator.of(context).push(
    MaterialPageRoute(
      builder: (_) => CitizensFormScreen(
        campaignId: campaignId,
        householdLocalId: householdLocalId,
        existing: existing,
      ),
    ),
  );
}
