import 'package:flutter/material.dart';

import '../../sync/local_database.dart';
import 'citizens_form.dart';
import 'household_form_screen.dart';

class HouseholdsScreen extends StatefulWidget {
  const HouseholdsScreen({
    super.key,
    required this.campaignId,
    required this.campaignName,
    this.zoneId,
  });

  final String campaignId;
  final String campaignName;
  final String? zoneId;

  @override
  State<HouseholdsScreen> createState() => _HouseholdsScreenState();
}

class _HouseholdsScreenState extends State<HouseholdsScreen> {
  List<Map<String, Object?>> _rows = [];
  Map<String, int> _memberCounts = {};
  Map<String, int> _queuedCounts = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final db = LocalDatabase.instance.db;
    final rows = await db.query(
      'households',
      where: 'campaign_id = ?',
      whereArgs: [widget.campaignId],
      orderBy: 'updated_at DESC',
    );
    final counts = <String, int>{};
    final queued = <String, int>{};
    for (final h in rows) {
      final lid = h['local_id']?.toString() ?? '';
      final c = await db.rawQuery(
        'SELECT COUNT(*) AS c FROM census_records WHERE household_local_id = ?',
        [lid],
      );
      counts[lid] = (c.first['c'] as num?)?.toInt() ?? 0;
      final q = await db.rawQuery(
        "SELECT COUNT(*) AS c FROM census_records WHERE household_local_id = ? AND status IN ('QUEUED','DRAFT')",
        [lid],
      );
      queued[lid] = (q.first['c'] as num?)?.toInt() ?? 0;
    }
    if (!mounted) return;
    setState(() {
      _rows = rows;
      _memberCounts = counts;
      _queuedCounts = queued;
    });
  }

  Future<void> _openCreate() async {
    final ok = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => HouseholdFormScreen(
          campaignId: widget.campaignId,
          zoneId: widget.zoneId,
        ),
      ),
    );
    if (ok == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.campaignName)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreate,
        icon: const Icon(Icons.add),
        label: const Text('Ménage'),
        backgroundColor: const Color(0xFF5D87FF),
      ),
      body: _rows.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('Aucun ménage — créez le premier hors ligne.'),
                    const SizedBox(height: 12),
                    FilledButton(onPressed: _openCreate, child: const Text('Nouveau ménage')),
                  ],
                ),
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
                itemCount: _rows.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final h = _rows[i];
                  final lid = h['local_id']?.toString() ?? '';
                  final addr = h['address_line']?.toString() ?? 'Ménage';
                  final lat = h['latitude'];
                  final lng = h['longitude'];
                  final members = _memberCounts[lid] ?? 0;
                  final pending = _queuedCounts[lid] ?? 0;
                  final hasGps = lat != null && lng != null;
                  return Card(
                    child: ListTile(
                      title: Text(addr),
                      subtitle: Text(
                        [
                          '$members membre(s)',
                          if (pending > 0) '$pending en attente sync',
                          if (hasGps) 'GPS OK' else 'GPS manquant',
                        ].join(' · '),
                      ),
                      leading: Icon(
                        hasGps ? Icons.home_work : Icons.home_outlined,
                        color: hasGps ? const Color(0xFF5D87FF) : Colors.orange,
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => HouseholdMembersScreen(
                              campaignId: widget.campaignId,
                              householdLocalId: lid,
                              addressLine: addr,
                            ),
                          ),
                        );
                        await _load();
                      },
                    ),
                  );
                },
              ),
            ),
    );
  }
}

class HouseholdMembersScreen extends StatefulWidget {
  const HouseholdMembersScreen({
    super.key,
    required this.campaignId,
    required this.householdLocalId,
    required this.addressLine,
  });

  final String campaignId;
  final String householdLocalId;
  final String addressLine;

  @override
  State<HouseholdMembersScreen> createState() => _HouseholdMembersScreenState();
}

class _HouseholdMembersScreenState extends State<HouseholdMembersScreen> {
  List<Map<String, Object?>> _members = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final rows = await LocalDatabase.instance.db.query(
      'census_records',
      where: 'household_local_id = ?',
      whereArgs: [widget.householdLocalId],
      orderBy: 'updated_at DESC',
    );
    if (!mounted) return;
    setState(() => _members = rows);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.addressLine)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => CitizensFormScreen(
                campaignId: widget.campaignId,
                householdLocalId: widget.householdLocalId,
              ),
            ),
          );
          await _load();
        },
        icon: const Icon(Icons.person_add),
        label: const Text('Personne'),
        backgroundColor: const Color(0xFF5D87FF),
      ),
      body: _members.isEmpty
          ? const Center(child: Text('Aucun membre — ajoutez la première personne.'))
          : ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
              itemCount: _members.length,
              itemBuilder: (context, i) {
                final m = _members[i];
                final name =
                    '${m['given_names'] ?? ''} ${m['family_name'] ?? ''}'.trim();
                final status = m['status']?.toString() ?? '';
                return Card(
                  child: ListTile(
                    title: Text(name.isEmpty ? 'Sans nom' : name),
                    subtitle: Text(
                      '${m['sex'] ?? ''} · ${m['date_of_birth'] ?? ''} · $status',
                    ),
                    leading: Icon(
                      status == 'SYNCED'
                          ? Icons.cloud_done
                          : status == 'CONFLICT'
                              ? Icons.warning_amber
                              : Icons.cloud_upload,
                      color: status == 'SYNCED'
                          ? Colors.green
                          : status == 'CONFLICT'
                              ? Colors.orange
                              : const Color(0xFF5D87FF),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
