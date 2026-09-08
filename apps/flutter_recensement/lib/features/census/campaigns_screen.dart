import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import 'campaign_repository.dart';
import 'households_screen.dart';

class CampaignsScreen extends StatefulWidget {
  const CampaignsScreen({super.key});

  @override
  State<CampaignsScreen> createState() => _CampaignsScreenState();
}

class _CampaignsScreenState extends State<CampaignsScreen> {
  final _repo = CampaignRepository();
  List<Map<String, dynamic>> _campaigns = [];
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
      final list = await _repo.listCampaigns(forceRefresh: forceRefresh);
      if (!mounted) return;
      setState(() {
        _campaigns = list;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null && _campaigns.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton(onPressed: () => _load(), child: const Text('Réessayer')),
            ],
          ),
        ),
      );
    }
    if (_campaigns.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Aucune campagne disponible'),
            const SizedBox(height: 12),
            FilledButton(onPressed: () => _load(), child: const Text('Actualiser')),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _load(forceRefresh: true),
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _campaigns.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final c = _campaigns[i];
          final name = c['name']?.toString() ?? 'Campagne';
          final code = c['code']?.toString() ?? '';
          final status = c['status']?.toString() ?? '';
          final id = c['id']?.toString() ?? '';
          return ListTile(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            tileColor: Theme.of(context).colorScheme.surfaceContainerHighest,
            title: Text(name),
            subtitle: Text('$code · $status'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => HouseholdsScreen(
                    campaignId: id,
                    campaignName: name,
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
