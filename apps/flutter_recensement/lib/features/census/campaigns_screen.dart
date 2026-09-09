import 'package:flutter/material.dart';

import '../../core/api_client.dart';
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
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            child: ListTile(
              leading: const Icon(Icons.cloud_sync),
              title: const Text('État synchronisation'),
              subtitle: Text(_syncLabel),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 12),
          Text('Mes affectations', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (_assignments.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: Text('Aucune zone affectée')),
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
                padding: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  tileColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                  title: Text(name),
                  subtitle: Text('$zoneName · $status'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => HouseholdsScreen(
                          campaignId: id,
                          campaignName: '$name — $zoneName',
                        ),
                      ),
                    );
                  },
                ),
              );
            }),
        ],
      ),
    );
  }
}
