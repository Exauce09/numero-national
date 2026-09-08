import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import '../../sync/local_database.dart';
import '../../sync/sync_queue.dart';
import 'citizens_form.dart';

class HouseholdsScreen extends StatefulWidget {
  const HouseholdsScreen({
    super.key,
    required this.campaignId,
    required this.campaignName,
  });

  final String campaignId;
  final String campaignName;

  @override
  State<HouseholdsScreen> createState() => _HouseholdsScreenState();
}

class _HouseholdsScreenState extends State<HouseholdsScreen> {
  List<Map<String, Object?>> _rows = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final rows = await LocalDatabase.instance.db.query(
      'households',
      where: 'campaign_id = ?',
      whereArgs: [widget.campaignId],
      orderBy: 'updated_at DESC',
    );
    setState(() => _rows = rows);
  }

  Future<void> _addHousehold() async {
    final localId = const Uuid().v4();
    final now = DateTime.now().toUtc().toIso8601String();
    final data = {
      'id': localId,
      'local_id': localId,
      'campaign_id': widget.campaignId,
      'address_line': 'Adresse à compléter',
      'member_count': 0,
      'updated_at': now,
    };
    await LocalDatabase.instance.db.insert('households', data);
    await SyncQueue().enqueue(
      SyncQueueItem(
        entityType: 'household',
        localId: localId,
        version: 1,
        payload: {
          ...data,
          'campaign_id': widget.campaignId,
        },
      ),
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.campaignName)),
      floatingActionButton: FloatingActionButton(
        onPressed: _addHousehold,
        child: const Icon(Icons.add),
      ),
      body: _rows.isEmpty
          ? const Center(child: Text('Aucun ménage — créez le premier hors ligne.'))
          : ListView.builder(
              itemCount: _rows.length,
              itemBuilder: (context, i) {
                final h = _rows[i];
                return ListTile(
                  title: Text(h['address_line']?.toString() ?? 'Ménage'),
                  subtitle: Text('local: ${h['local_id']}'),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => CitizensFormScreen(
                          campaignId: widget.campaignId,
                          householdLocalId: h['local_id']!.toString(),
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
