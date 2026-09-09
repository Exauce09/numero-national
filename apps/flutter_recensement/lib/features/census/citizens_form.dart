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
    this.existing,
  });

  final String campaignId;
  final String householdLocalId;
  /// When set, edits an existing (e.g. REJECTED) record and re-queues sync.
  final Map<String, Object?>? existing;

  @override
  State<CitizensFormScreen> createState() => _CitizensFormScreenState();
}

class _CitizensFormScreenState extends State<CitizensFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _given;
  late final TextEditingController _family;
  late final TextEditingController _dob;
  String _sex = 'M';
  String _relation = 'AUTRE';
  String? _photoRef;
  bool _busy = false;
  String? _rejectNote;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _given = TextEditingController(text: e?['given_names']?.toString() ?? '');
    _family = TextEditingController(text: e?['family_name']?.toString() ?? '');
    _dob = TextEditingController(text: e?['date_of_birth']?.toString() ?? '');
    _sex = e?['sex']?.toString() ?? 'M';
    _photoRef = e?['photo_ref']?.toString();
    _rejectNote = e?['review_note']?.toString();
  }

  @override
  void dispose() {
    _given.dispose();
    _family.dispose();
    _dob.dispose();
    super.dispose();
  }

  bool _validDate(String raw) {
    final re = RegExp(r'^\d{4}-\d{2}-\d{2}$');
    if (!re.hasMatch(raw)) return false;
    final parts = raw.split('-').map(int.parse).toList();
    try {
      final d = DateTime(parts[0], parts[1], parts[2]);
      if (d.isAfter(DateTime.now())) return false;
      if (parts[0] < 1900) return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    try {
      final db = LocalDatabase.instance.db;
      final now = DateTime.now().toUtc().toIso8601String();

      if (_isEdit) {
        final localId = widget.existing!['local_id']!.toString();
        final prevVersion = (widget.existing!['version'] as int?) ?? 1;
        final nextVersion = prevVersion + 1;
        await db.update(
          'census_records',
          {
            'given_names': _given.text.trim(),
            'family_name': _family.text.trim(),
            'sex': _sex,
            'date_of_birth': _dob.text.trim(),
            'photo_ref': _photoRef,
            'version': nextVersion,
            'status': 'QUEUED',
            'review_note': null,
            'updated_at': now,
          },
          where: 'local_id = ?',
          whereArgs: [localId],
        );
        await LocalDatabase.instance.setMeta('sync_status', 'EN_ATTENTE');
        await SyncQueue().enqueue(
          SyncQueueItem(
            entityType: 'census_record',
            localId: localId,
            version: nextVersion,
            payload: {
              'local_id': localId,
              'household_local_id': widget.householdLocalId,
              'campaign_id': widget.campaignId,
              'given_names': _given.text.trim(),
              'family_name': _family.text.trim(),
              'sex': _sex,
              'date_of_birth': _dob.text.trim(),
              'photo_ref': _photoRef,
              'version': nextVersion,
              'relationship_to_head': _relation,
            },
          ),
        );
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Correction enregistrée — en file de sync')),
        );
        Navigator.of(context).pop(true);
        return;
      }

      final localId = const Uuid().v4();
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
      await db.insert('census_records', row);
      final count = await db.rawQuery(
        'SELECT COUNT(*) AS c FROM census_records WHERE household_local_id = ?',
        [widget.householdLocalId],
      );
      final n = (count.first['c'] as num?)?.toInt() ?? 0;
      await db.update(
        'households',
        {'member_count': n, 'updated_at': now},
        where: 'local_id = ?',
        whereArgs: [widget.householdLocalId],
      );
      await LocalDatabase.instance.setMeta('sync_status', 'EN_ATTENTE');
      await SyncQueue().enqueue(
        SyncQueueItem(
          entityType: 'census_record',
          localId: localId,
          version: 1,
          payload: {
            ...row,
            'household_local_id': widget.householdLocalId,
            'campaign_id': widget.campaignId,
            'relationship_to_head': _relation,
          },
        ),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Fiche enregistrée — en file de sync')),
      );
      Navigator.of(context).pop(true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'Corriger la fiche' : 'Nouvelle fiche citoyen'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_rejectNote != null && _rejectNote!.isNotEmpty)
              Card(
                color: Colors.red.shade50,
                child: ListTile(
                  leading: const Icon(Icons.cancel, color: Colors.red),
                  title: const Text('Motif de rejet'),
                  subtitle: Text(_rejectNote!),
                ),
              ),
            if (_rejectNote != null && _rejectNote!.isNotEmpty) const SizedBox(height: 12),
            TextFormField(
              controller: _given,
              decoration: const InputDecoration(labelText: 'Prénoms *'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Obligatoire' : null,
            ),
            TextFormField(
              controller: _family,
              decoration: const InputDecoration(labelText: 'Nom *'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Obligatoire' : null,
            ),
            TextFormField(
              controller: _dob,
              decoration: const InputDecoration(labelText: 'Date de naissance (YYYY-MM-DD) *'),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Obligatoire';
                if (!_validDate(v.trim())) return 'Format invalide';
                return null;
              },
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _sex,
              decoration: const InputDecoration(labelText: 'Sexe'),
              items: const [
                DropdownMenuItem(value: 'M', child: Text('Masculin')),
                DropdownMenuItem(value: 'F', child: Text('Féminin')),
              ],
              onChanged: (v) => setState(() => _sex = v ?? 'M'),
            ),
            DropdownButtonFormField<String>(
              value: _relation,
              decoration: const InputDecoration(labelText: 'Lien avec le chef de ménage'),
              items: const [
                DropdownMenuItem(value: 'CHEF', child: Text('Chef de ménage')),
                DropdownMenuItem(value: 'CONJOINT', child: Text('Conjoint(e)')),
                DropdownMenuItem(value: 'ENFANT', child: Text('Enfant')),
                DropdownMenuItem(value: 'PARENT', child: Text('Parent')),
                DropdownMenuItem(value: 'AUTRE', child: Text('Autre')),
              ],
              onChanged: (v) => setState(() => _relation = v ?? 'AUTRE'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _busy
                  ? null
                  : () async {
                      final ref = await capturePhotoStub();
                      if (ref != null) setState(() => _photoRef = ref);
                    },
              icon: const Icon(Icons.photo_camera),
              label: Text(_photoRef == null ? 'Photo (stub)' : 'Photo OK'),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _busy ? null : _save,
              child: Text(_isEdit ? 'Corriger et renvoyer' : 'Enregistrer'),
            ),
          ],
        ),
      ),
    );
  }
}
