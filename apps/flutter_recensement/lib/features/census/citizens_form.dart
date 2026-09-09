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
  final _formKey = GlobalKey<FormState>();
  final _given = TextEditingController();
  final _family = TextEditingController();
  final _dob = TextEditingController();
  String _sex = 'M';
  String _relation = 'AUTRE';
  String? _photoRef;
  bool _busy = false;

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
      final db = LocalDatabase.instance.db;
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
      appBar: AppBar(title: const Text('Nouvelle fiche citoyen')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _given,
              decoration: const InputDecoration(
                labelText: 'Prénoms *',
                border: OutlineInputBorder(),
              ),
              validator: (v) =>
                  (v == null || v.trim().length < 2) ? 'Prénoms requis' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _family,
              decoration: const InputDecoration(
                labelText: 'Nom de famille *',
                border: OutlineInputBorder(),
              ),
              validator: (v) =>
                  (v == null || v.trim().length < 2) ? 'Nom requis' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _dob,
              decoration: const InputDecoration(
                labelText: 'Date de naissance * (YYYY-MM-DD)',
                border: OutlineInputBorder(),
                hintText: '1990-05-21',
              ),
              validator: (v) {
                final t = v?.trim() ?? '';
                if (!_validDate(t)) return 'Date invalide (YYYY-MM-DD)';
                return null;
              },
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
              decoration: const InputDecoration(
                labelText: 'Sexe *',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _relation,
              items: const [
                DropdownMenuItem(value: 'CHEF', child: Text('Chef de ménage')),
                DropdownMenuItem(value: 'CONJOINT', child: Text('Conjoint(e)')),
                DropdownMenuItem(value: 'ENFANT', child: Text('Enfant')),
                DropdownMenuItem(value: 'PARENT', child: Text('Parent')),
                DropdownMenuItem(value: 'AUTRE', child: Text('Autre / non apparenté')),
              ],
              onChanged: (v) => setState(() => _relation = v ?? 'AUTRE'),
              decoration: const InputDecoration(
                labelText: 'Lien avec le chef *',
                border: OutlineInputBorder(),
              ),
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
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFE11D48),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: _busy ? null : _save,
              child: _busy
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Enregistrer hors ligne'),
            ),
          ],
        ),
      ),
    );
  }
}
