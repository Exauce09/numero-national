import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import 'assignment_repository.dart';
import 'households_screen.dart';

class CampaignsScreen extends StatefulWidget {
  const CampaignsScreen({super.key});

  @override
  State<CampaignsScreen> createState() => _CampaignsScreenState();
}

class _CampaignsScreenState extends State<CampaignsScreen> {
  final _repo = AssignmentRepository();
  List<Map<String, dynamic>> _assignments = [];
  String _syncLabel = '…';
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool forceRefresh = true}) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await _repo.fetchMyAssignments(forceRefresh: forceRefresh);
      final label = await _repo.syncStatusLabel();
      if (!mounted) return;
      setState(() {
        _assignments = list;
        _syncLabel = label;
        _loading = false;
        if (list.isEmpty) {
          _error = forceRefresh
              ? 'Aucune affectation. Demandez à un admin de vous assigner une zone.'
              : null;
        }
      });
    } on ApiException catch (e) {
      final cached = await _repo.fetchMyAssignments(forceRefresh: false);
      final label = await _repo.syncStatusLabel();
      if (!mounted) return;
      setState(() {
        _assignments = cached;
        _syncLabel = label;
        _loading = false;
        _error = cached.isEmpty ? e.message : 'Hors ligne — cache local (${cached.length})';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    return RefreshIndicator(
      onRefresh: () => _load(forceRefresh: true),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: NnColors.softBlue,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: NnColors.line),
            ),
            child: Row(
              children: [
                const Icon(Icons.cloud_sync_rounded, color: NnColors.blue),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Sync automatique', style: TextStyle(fontWeight: FontWeight.w700)),
                      Text(_syncLabel, style: const TextStyle(color: NnColors.muted, fontSize: 13)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: const TextStyle(color: NnColors.danger)),
          ],
          const SizedBox(height: 18),
          const Text(
            'Mes zones',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: NnColors.ink),
          ),
          const SizedBox(height: 12),
          if (_assignments.isEmpty)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: Text('Aucune zone affectée', style: TextStyle(color: NnColors.muted))),
            )
          else
            ..._assignments.map((a) {
              final campaign = Map<String, dynamic>.from(a['campaign'] as Map? ?? {});
              final zone = a['zone'] != null ? Map<String, dynamic>.from(a['zone'] as Map) : null;
              final name = campaign['name']?.toString() ?? 'Campagne';
              final status = campaign['status']?.toString() ?? '';
              final zoneName = zone?['name']?.toString() ?? 'Zone non définie';
              final id = campaign['id']?.toString() ?? '';
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Material(
                  color: NnColors.card,
                  borderRadius: BorderRadius.circular(18),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(18),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => HouseholdsScreen(
                            campaignId: id,
                            campaignName: '$name — $zoneName',
                            zoneId: zone?['id']?.toString(),
                          ),
                        ),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: NnColors.line),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: NnColors.softGreen,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Icon(Icons.location_on_outlined, color: Color(0xFF13DEB9)),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                                const SizedBox(height: 2),
                                Text(zoneName, style: const TextStyle(color: NnColors.muted)),
                                const SizedBox(height: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: NnColors.softBlue,
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    status,
                                    style: const TextStyle(
                                      color: NnColors.blue,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.chevron_right_rounded, color: NnColors.muted),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
