import 'package:flutter/material.dart';

import 'households_screen.dart';

class CampaignsScreen extends StatelessWidget {
  const CampaignsScreen({super.key});

  static const _demo = [
    {'id': 'demo-1', 'code': 'RGPH-2026', 'name': 'Recensement général 2026', 'status': 'ACTIVE'},
    {'id': 'demo-2', 'code': 'MAJ-URB', 'name': 'Mise à jour urbaine', 'status': 'DRAFT'},
  ];

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _demo.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final c = _demo[i];
        return ListTile(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          tileColor: Theme.of(context).colorScheme.surfaceContainerHighest,
          title: Text(c['name']!),
          subtitle: Text('${c['code']} · ${c['status']}'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => HouseholdsScreen(
                  campaignId: c['id']!,
                  campaignName: c['name']!,
                ),
              ),
            );
          },
        );
      },
    );
  }
}
