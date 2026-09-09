import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import '../../sync/local_database.dart';
import '../../sync/sync_queue.dart';
import 'photo_capture_stub.dart';

/// Fiche personne — alignée sur le formulaire officiel
/// (`frontends/civil-officer` → Recensement / Identité).
class CitizensFormScreen extends StatefulWidget {
  const CitizensFormScreen({
    super.key,
    required this.campaignId,
    required this.householdLocalId,
    this.existing,
  });

  final String campaignId;
  final String householdLocalId;
  final Map<String, Object?>? existing;

  @override
  State<CitizensFormScreen> createState() => _CitizensFormScreenState();
}

class _CitizensFormScreenState extends State<CitizensFormScreen> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _nom;
  late final TextEditingController _postnom;
  late final TextEditingController _prenom;
  late final TextEditingController _profession;
  late final TextEditingController _lieuNaissance;
  late final TextEditingController _dob;
  late final TextEditingController _hopitalNaissance;
  late final TextEditingController _langues;
  late final TextEditingController _pere;
  late final TextEditingController _mere;
  late final TextEditingController _nationalite;
  late final TextEditingController _paysResidence;
  late final TextEditingController _telephone;

  String _sex = 'M';
  String _etatCivil = 'CELIBATAIRE';
  String _handicap = 'NORMAL';
  String _relation = 'AUTRE';
  String? _photoRef;
  bool _busy = false;
  String? _rejectNote;

  bool get _isEdit => widget.existing != null;

  static const _etatCivilOptions = <(String, String)>[
    ('CELIBATAIRE', 'Célibataire'),
    ('MARIE', 'Marié(e)'),
    ('DIVORCE', 'Divorcé(e)'),
    ('VEUF', 'Veuf / Veuve'),
    ('UNKNOWN', 'Inconnu'),
  ];

  static const _handicapOptions = <(String, String)>[
    ('NORMAL', 'Normal'),
    ('PIED', 'Pied'),
    ('BRAS', 'Bras'),
    ('YEUX', 'Yeux'),
    ('INFIRME', 'Infirme'),
    ('INAPTE', 'Inapte'),
  ];

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    final payload = _decodePayload(e?['payload']);

    _nom = TextEditingController(
      text: payload['nom']?.toString() ?? e?['family_name']?.toString() ?? '',
    );
    _postnom = TextEditingController(text: payload['postnom']?.toString() ?? '');
    _prenom = TextEditingController(
      text: payload['prenom']?.toString() ?? e?['given_names']?.toString() ?? '',
    );
    _profession = TextEditingController(text: payload['profession']?.toString() ?? '');
    _lieuNaissance = TextEditingController(
      text: payload['lieu_naissance']?.toString() ?? '',
    );
    _dob = TextEditingController(text: e?['date_of_birth']?.toString() ?? '');
    _hopitalNaissance = TextEditingController(
      text: payload['hopital_naissance']?.toString() ?? '',
    );
    _langues = TextEditingController(text: payload['langues_parlees']?.toString() ?? '');
    _pere = TextEditingController(text: payload['nom_pere']?.toString() ?? '');
    _mere = TextEditingController(text: payload['nom_mere']?.toString() ?? '');
    _nationalite = TextEditingController(
      text: payload['nationalite']?.toString() ?? 'Congolaise',
    );
    _paysResidence = TextEditingController(
      text: payload['pays_residence']?.toString() ?? 'RDC',
    );
    _telephone = TextEditingController(text: payload['telephone']?.toString() ?? '');

    _sex = e?['sex']?.toString() ?? 'M';
    _etatCivil = payload['etat_civil']?.toString() ?? 'CELIBATAIRE';
    _handicap = payload['handicap']?.toString() ?? 'NORMAL';
    _relation = payload['relationship_to_head']?.toString() ?? 'AUTRE';
    _photoRef = e?['photo_ref']?.toString();
    _rejectNote = e?['review_note']?.toString();
  }

  Map<String, dynamic> _decodePayload(Object? raw) {
    if (raw == null) return {};
    if (raw is Map) return Map<String, dynamic>.from(raw);
    if (raw is String && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map) return Map<String, dynamic>.from(decoded);
      } catch (_) {}
    }
    return {};
  }

  @override
  void dispose() {
    _nom.dispose();
    _postnom.dispose();
    _prenom.dispose();
    _profession.dispose();
    _lieuNaissance.dispose();
    _dob.dispose();
    _hopitalNaissance.dispose();
    _langues.dispose();
    _pere.dispose();
    _mere.dispose();
    _nationalite.dispose();
    _paysResidence.dispose();
    _telephone.dispose();
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

  Map<String, dynamic> _buildPayload() {
    return {
      'nom': _nom.text.trim(),
      'postnom': _postnom.text.trim(),
      'prenom': _prenom.text.trim(),
      'etat_civil': _etatCivil,
      'profession': _profession.text.trim(),
      'lieu_naissance': _lieuNaissance.text.trim(),
      'hopital_naissance': _hopitalNaissance.text.trim(),
      'langues_parlees': _langues.text.trim(),
      'nom_pere': _pere.text.trim(),
      'nom_mere': _mere.text.trim(),
      'nationalite': _nationalite.text.trim(),
      'pays_residence': _paysResidence.text.trim(),
      'handicap': _handicap,
      'telephone': _telephone.text.trim(),
      'relationship_to_head': _relation,
    };
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    try {
      final db = LocalDatabase.instance.db;
      final now = DateTime.now().toUtc().toIso8601String();
      final payload = _buildPayload();
      final payloadJson = jsonEncode(payload);
      final given = _prenom.text.trim();
      final family = _nom.text.trim();

      if (_isEdit) {
        final localId = widget.existing!['local_id']!.toString();
        final prevVersion = (widget.existing!['version'] as int?) ?? 1;
        final nextVersion = prevVersion + 1;
        await db.update(
          'census_records',
          {
            'given_names': given,
            'family_name': family,
            'sex': _sex,
            'date_of_birth': _dob.text.trim(),
            'photo_ref': _photoRef,
            'payload': payloadJson,
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
              'given_names': given,
              'family_name': family,
              'sex': _sex,
              'date_of_birth': _dob.text.trim(),
              'photo_ref': _photoRef,
              'version': nextVersion,
              'payload': payload,
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
      final row = <String, Object?>{
        'id': localId,
        'local_id': localId,
        'household_local_id': widget.householdLocalId,
        'campaign_id': widget.campaignId,
        'given_names': given,
        'family_name': family,
        'sex': _sex,
        'date_of_birth': _dob.text.trim(),
        'photo_ref': _photoRef,
        'payload': payloadJson,
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
            'payload': payload,
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

  InputDecoration _dec(String label, {String? hint}) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      border: const OutlineInputBorder(),
      isDense: true,
    );
  }

  Widget _section(String title, List<Widget> children) {
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 15,
                color: Color(0xFF2A3547),
              ),
            ),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'Corriger la fiche' : 'Identification de la personne'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            if (_rejectNote != null && _rejectNote!.isNotEmpty) ...[
              Card(
                color: Colors.red.shade50,
                child: ListTile(
                  leading: const Icon(Icons.cancel, color: Colors.red),
                  title: const Text('Motif de rejet'),
                  subtitle: Text(_rejectNote!),
                ),
              ),
              const SizedBox(height: 8),
            ],
            const Text(
              'Formulaire d’identification — modèle officiel RDC',
              style: TextStyle(color: Color(0xFF5A6A85), fontSize: 13),
            ),
            const SizedBox(height: 12),
            _section('Identité de la personne', [
              TextFormField(
                controller: _nom,
                decoration: _dec('Nom de la personne *'),
                textCapitalization: TextCapitalization.characters,
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Obligatoire' : null,
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _postnom,
                decoration: _dec('Post-nom de la personne'),
                textCapitalization: TextCapitalization.characters,
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _prenom,
                decoration: _dec('Prénom *'),
                textCapitalization: TextCapitalization.words,
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Obligatoire' : null,
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _sex,
                      decoration: _dec('Sexe'),
                      items: const [
                        DropdownMenuItem(value: 'M', child: Text('Masculin')),
                        DropdownMenuItem(value: 'F', child: Text('Féminin')),
                      ],
                      onChanged: (v) => setState(() => _sex = v ?? 'M'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _etatCivil,
                      decoration: _dec('État-civil'),
                      items: [
                        for (final o in _etatCivilOptions)
                          DropdownMenuItem(value: o.$1, child: Text(o.$2)),
                      ],
                      onChanged: (v) =>
                          setState(() => _etatCivil = v ?? 'CELIBATAIRE'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _profession,
                decoration: _dec('Profession'),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _lieuNaissance,
                decoration: _dec('Lieu de naissance'),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _dob,
                decoration: _dec('Date de naissance *', hint: 'AAAA-MM-JJ'),
                keyboardType: TextInputType.datetime,
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Obligatoire';
                  if (!_validDate(v.trim())) return 'Format AAAA-MM-JJ invalide';
                  return null;
                },
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _hopitalNaissance,
                decoration: _dec('Hôpital de naissance'),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _langues,
                decoration: _dec(
                  'Langues parlées',
                  hint: 'Français, Lingala…',
                ),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _pere,
                decoration: _dec('Nom du père'),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _mere,
                decoration: _dec('Nom de la mère'),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _nationalite,
                      decoration: _dec('Nationalité'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextFormField(
                      controller: _paysResidence,
                      decoration: _dec('Pays de résidence'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: _handicap,
                decoration: _dec('Type de handicap'),
                items: [
                  for (final o in _handicapOptions)
                    DropdownMenuItem(value: o.$1, child: Text(o.$2)),
                ],
                onChanged: (v) => setState(() => _handicap = v ?? 'NORMAL'),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _telephone,
                decoration: _dec('Numéro de téléphone'),
                keyboardType: TextInputType.phone,
              ),
            ]),
            _section('Lien dans le ménage', [
              DropdownButtonFormField<String>(
                value: _relation,
                decoration: _dec('Lien avec le chef de ménage'),
                items: const [
                  DropdownMenuItem(value: 'CHEF', child: Text('Chef de ménage')),
                  DropdownMenuItem(value: 'CONJOINT', child: Text('Conjoint(e)')),
                  DropdownMenuItem(value: 'ENFANT', child: Text('Enfant')),
                  DropdownMenuItem(value: 'PARENT', child: Text('Parent')),
                  DropdownMenuItem(value: 'AUTRE', child: Text('Autre')),
                ],
                onChanged: (v) => setState(() => _relation = v ?? 'AUTRE'),
              ),
            ]),
            _section('Photo', [
              PhotoCaptureStub(
                onCaptured: (ref) => setState(() => _photoRef = ref),
              ),
              if (_photoRef != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    'Photo: $_photoRef',
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
            ]),
            const SizedBox(height: 8),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF5D87FF),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: _busy ? null : _save,
              child: _busy
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(_isEdit ? 'Corriger et renvoyer' : 'Enregistrer la fiche'),
            ),
          ],
        ),
      ),
    );
  }
}
