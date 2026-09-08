import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import '../../sync/local_database.dart';
import '../../sync/sync_queue.dart';
import 'photo_capture_stub.dart';

class CitizensFormScreen extends StatefulWidget {
  const CitizensFormScreen({
    super.key,
    required this.campaignId,
    required this.householdLocalId,
  });

  final String campaignId;
  final String householdLocalId;

  @override
  State<CitizensFormScreen> createState() => _CitizensFormScreenState();
}

class _CitizensFormScreenState extends State<CitizensFormScreen> {
  final _given = TextEditingController();
  final _family = TextEditingController();
  final _dob = TextEditingController();
  String _sex = 'M';
  String? _photoRef;

  Future<void> _save() async {
    final localId = const Uuid().v4();
    final now = DateTime.now().toUtc().toIso8601String();
    final row = {
      'id': localId,
      'local_id': localId,
      'household_local_id': widget.householdLocalId,
      'campaign_id': widget.campaignId,
      'given_names': _given.text.trim(),
      'family_name': _family.text.trim(),
      'sex': _sex,
      'date_of_birth': _dob.text.trim(),
      'photo_ref': _photoRef,
      'version': 1,
      'status': 'QUEUED',
      'updated_at': now,
    };
    await LocalDatabase.instance.db.insert('census_records', row);
    await SyncQueue().enqueue(
      SyncQueueItem(
        entityType: 'census_record',
        localId: localId,
        version: 1,
        payload: {
          ...row,
          'household_local_id': widget.householdLocalId,
          'campaign_id': widget.campaignId,
        },
      ),
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Fiche enregistrée localement (file de sync)')),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nouvelle fiche citoyen')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(controller: _given, decoration: const InputDecoration(labelText: 'Prénoms')),
          const SizedBox(height: 12),
          TextField(controller: _family, decoration: const InputDecoration(labelText: 'Nom')),
          const SizedBox(height: 12),
          TextField(
            controller: _dob,
            decoration: const InputDecoration(labelText: 'Date de naissance (YYYY-MM-DD)'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _sex,
            items: const [
              DropdownMenuItem(value: 'M', child: Text('Masculin')),
              DropdownMenuItem(value: 'F', child: Text('Féminin')),
              DropdownMenuItem(value: 'X', child: Text('Autre / ND')),
            ],
            onChanged: (v) => setState(() => _sex = v ?? 'M'),
            decoration: const InputDecoration(labelText: 'Sexe'),
          ),
          const SizedBox(height: 16),
          PhotoCaptureStub(
            onCaptured: (ref) => setState(() => _photoRef = ref),
          ),
          if (_photoRef != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('Photo: $_photoRef', style: Theme.of(context).textTheme.bodySmall),
            ),
          const SizedBox(height: 24),
          FilledButton(onPressed: _save, child: const Text('Enregistrer hors ligne')),
        ],
      ),
    );
  }
}
