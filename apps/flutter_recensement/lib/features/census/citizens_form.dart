import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import '../../sync/local_database.dart';
import '../../sync/sync_queue.dart';
import 'fingerprint_capture.dart';
import 'geo_cascade_field.dart';
import 'photo_capture.dart';
import 'rdc_tribus.dart';
import 'situation_familiale.dart';
import 'etudes_et_admin.dart';

/// Fiche personne — wizard 7 étapes aligné sur le site civil-officer.
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
  late final TextEditingController _email;
  late final TextEditingController _boitePostale;
  late final TextEditingController _numeroAvenue;
  late final TextEditingController _tribu;
  late final TextEditingController _empreinteGauche;
  late final TextEditingController _empreinteDroite;
  late final TextEditingController _iris;
  late final TextEditingController _professionnel;
  late final TextEditingController _etudesRemarques;
  late final TextEditingController _anneeFinEtudes;
  late final TextEditingController _adminNumero;
  late final TextEditingController _adminBureau;
  late final TextEditingController _adminDateOuverture;
  late final TextEditingController _adminAgent;
  late final TextEditingController _adminRemarques;
  late final TextEditingController _familleRemarques;

  String _sex = 'M';
  String _etatCivil = 'CELIBATAIRE';
  String _handicap = 'NORMAL';
  String _relation = 'AUTRE';
  String _saitLire = '';
  String _saitEcrire = '';
  String _niveauAtteint = '';
  String? _photoRef;
  String? _fingerprintRef;
  Map<String, String?> _geoNaissance = {};
  Map<String, String?> _geoActuelle = {};
  Map<String, String?> _geoOrigine = {};
  bool _busy = false;
  String? _rejectNote;
  String? _localId;
  int _version = 1;

  bool _aConjoint = false;
  late _MemberEditors _conjoint;
  final List<_MemberEditors> _enfants = [];
  final List<_MemberEditors> _charges = [];
  final List<_ScoEditors> _etablissements = [];
  final List<_UnivEditors> _formations = [];
  final List<_DocEditors> _documents = [];

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
    _email = TextEditingController(text: payload['email']?.toString() ?? '');
    _boitePostale = TextEditingController(text: payload['boite_postale']?.toString() ?? '');
    _numeroAvenue = TextEditingController(text: payload['numero_avenue']?.toString() ?? '');
    _tribu = TextEditingController(text: payload['tribu']?.toString() ?? '');
    _empreinteGauche =
        TextEditingController(text: payload['empreinte_gauche']?.toString() ?? '');
    _empreinteDroite =
        TextEditingController(text: payload['empreinte_droite']?.toString() ?? '');
    _iris = TextEditingController(text: payload['iris']?.toString() ?? '');
    _professionnel =
        TextEditingController(text: payload['parcours_professionnel']?.toString() ?? '');

    final etudes = EtudesData.parse(
      payload['etudes_detail'] ??
          {
            'remarques': [
              payload['parcours_scolaire']?.toString() ?? '',
              payload['parcours_universitaire']?.toString() ?? '',
            ].where((s) => s.trim().isNotEmpty).join('\n'),
          },
    );
    _saitLire = etudes.saitLire;
    _saitEcrire = etudes.saitEcrire;
    _niveauAtteint = etudes.niveauAtteint;
    _anneeFinEtudes = TextEditingController(text: etudes.anneeFinEtudes);
    _etudesRemarques = TextEditingController(text: etudes.remarques);
    for (final e in etudes.etablissements) {
      _etablissements.add(_ScoEditors(e));
    }
    for (final f in etudes.formationsUniversitaires) {
      _formations.add(_UnivEditors(f));
    }

    final admin = IdentiteAdminData.parse(
      payload['identite_administrative_detail'] ?? payload['numero_admin'],
    );
    _adminNumero = TextEditingController(text: admin.numeroDossier);
    _adminBureau = TextEditingController(text: admin.bureauReference);
    _adminDateOuverture = TextEditingController(text: admin.dateOuvertureDossier);
    _adminAgent = TextEditingController(text: admin.agentReference);
    _adminRemarques = TextEditingController(text: admin.remarques);
    for (final d in admin.documents) {
      _documents.add(_DocEditors(d));
    }

    final famille = SituationFamiliale.parse(
      payload['situation_familiale_detail'] ?? payload['situation_familiale'],
    );
    _aConjoint = famille.aConjoint;
    _conjoint = _MemberEditors(famille.conjoint);
    for (final e in famille.enfants) {
      _enfants.add(_MemberEditors(e));
    }
    for (final c in famille.personnesACharge) {
      _charges.add(_MemberEditors(c));
    }
    _familleRemarques = TextEditingController(text: famille.remarques);

    _sex = e?['sex']?.toString() ?? 'M';
    _etatCivil = payload['etat_civil']?.toString() ?? 'CELIBATAIRE';
    _handicap = payload['handicap']?.toString() ?? 'NORMAL';
    _relation = payload['relationship_to_head']?.toString() ?? 'AUTRE';
    _photoRef = e?['photo_ref']?.toString();
    _fingerprintRef = payload['fingerprint_ref']?.toString();
    _geoNaissance = _asStringMap(payload['geo_naissance']);
    _geoActuelle = _asStringMap(payload['geo_actuelle']);
    _geoOrigine = _asStringMap(payload['geo_origine']);
    _rejectNote = e?['review_note']?.toString();
    _localId = e?['local_id']?.toString();
    _version = (e?['version'] as int?) ?? 1;
  }

  Map<String, String?> _asStringMap(Object? raw) {
    if (raw is! Map) return {};
    return raw.map((k, v) => MapEntry(k.toString(), v?.toString()));
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
    _email.dispose();
    _boitePostale.dispose();
    _numeroAvenue.dispose();
    _tribu.dispose();
    _empreinteGauche.dispose();
    _empreinteDroite.dispose();
    _iris.dispose();
    _professionnel.dispose();
    _etudesRemarques.dispose();
    _anneeFinEtudes.dispose();
    _adminNumero.dispose();
    _adminBureau.dispose();
    _adminDateOuverture.dispose();
    _adminAgent.dispose();
    _adminRemarques.dispose();
    _familleRemarques.dispose();
    _conjoint.dispose();
    for (final e in _enfants) {
      e.dispose();
    }
    for (final c in _charges) {
      c.dispose();
    }
    for (final e in _etablissements) {
      e.dispose();
    }
    for (final f in _formations) {
      f.dispose();
    }
    for (final d in _documents) {
      d.dispose();
    }
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

  Future<void> _pickDob() async {
    final now = DateTime.now();
    DateTime initial = DateTime(now.year - 25);
    final parts = _dob.text.trim().split('-');
    if (parts.length == 3) {
      final y = int.tryParse(parts[0]);
      final m = int.tryParse(parts[1]);
      final d = int.tryParse(parts[2]);
      if (y != null && m != null && d != null) {
        initial = DateTime(y, m, d);
      }
    }
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1900),
      lastDate: now,
      helpText: 'Date de naissance',
    );
    if (picked == null) return;
    final y = picked.year.toString().padLeft(4, '0');
    final m = picked.month.toString().padLeft(2, '0');
    final d = picked.day.toString().padLeft(2, '0');
    setState(() => _dob.text = '$y-$m-$d');
  }

  bool _validateStep1() {
    if (_nom.text.trim().isEmpty ||
        _prenom.text.trim().isEmpty ||
        !_validDate(_dob.text.trim())) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Étape Identité : nom, prénom et date (AAAA-MM-JJ) requis'),
        ),
      );
      return false;
    }
    return true;
  }

  Map<String, dynamic> _buildPayload() {
    final lieu = _geoNaissance['label']?.trim().isNotEmpty == true
        ? _geoNaissance['label']
        : _lieuNaissance.text.trim();
    return {
      'nom': _nom.text.trim(),
      'postnom': _postnom.text.trim(),
      'prenom': _prenom.text.trim(),
      'etat_civil': _etatCivil,
      'profession': _profession.text.trim(),
      'lieu_naissance': lieu,
      'geo_naissance': _geoNaissance,
      'hopital_naissance': _hopitalNaissance.text.trim(),
      'langues_parlees': _langues.text.trim(),
      'nom_pere': _pere.text.trim(),
      'nom_mere': _mere.text.trim(),
      'nationalite': _nationalite.text.trim(),
      'pays_residence': _paysResidence.text.trim(),
      'handicap': _handicap,
      'telephone': _telephone.text.trim(),
      'email': _email.text.trim(),
      'boite_postale': _boitePostale.text.trim(),
      'numero_avenue': _numeroAvenue.text.trim(),
      'geo_actuelle': _geoActuelle,
      'province_actuelle': _geoActuelle['province_name'],
      'ville_actuelle': _geoActuelle['ville_name'],
      'commune_actuelle': _geoActuelle['commune_name'],
      'village_actuel': _geoActuelle['localite_name'],
      'quartier_actuel': _geoActuelle['quartier_name'],
      'avenue_actuelle': _geoActuelle['avenue_name'],
      'geo_origine': _geoOrigine,
      'province_origine': _geoOrigine['province_name'],
      'ville_origine': _geoOrigine['ville_name'],
      'territoire_origine': _geoOrigine['district_name'],
      'secteur_chefferie_commune': _geoOrigine['commune_name'],
      'village_origine': _geoOrigine['localite_name'],
      'tribu': _tribu.text.trim(),
      'empreinte_gauche': _empreinteGauche.text.trim(),
      'empreinte_droite': _empreinteDroite.text.trim(),
      'iris': _iris.text.trim(),
      'fingerprint_ref': _fingerprintRef,
      'parcours_scolaire': _buildEtudes().formatScolaire(),
      'parcours_universitaire': _buildEtudes().formatUniversitaire(),
      'parcours_professionnel': _professionnel.text.trim(),
      'etudes_detail': _buildEtudes().toJson(),
      'numero_admin': _buildAdmin().numeroDossier.trim(),
      'identite_administrative_detail': _buildAdmin().toJson(),
      'situation_familiale': _buildSituation().formatSummary(),
      'situation_familiale_detail': _buildSituation().toJson(),
      'relationship_to_head': _relation,
    };
  }

  EtudesData _buildEtudes() {
    return EtudesData(
      saitLire: _saitLire,
      saitEcrire: _saitEcrire,
      niveauAtteint: _niveauAtteint,
      anneeFinEtudes: _anneeFinEtudes.text,
      etablissements: _etablissements.map((e) => e.snapshot()).toList(),
      formationsUniversitaires: _formations.map((e) => e.snapshot()).toList(),
      remarques: _etudesRemarques.text,
    );
  }

  IdentiteAdminData _buildAdmin() {
    return IdentiteAdminData(
      documents: _documents.map((e) => e.snapshot()).toList(),
      numeroDossier: _adminNumero.text,
      bureauReference: _adminBureau.text,
      dateOuvertureDossier: _adminDateOuverture.text.trim(),
      agentReference: _adminAgent.text,
      remarques: _adminRemarques.text,
    );
  }

  SituationFamiliale _buildSituation() {
    return SituationFamiliale(
      aConjoint: _aConjoint,
      conjoint: _conjoint.snapshot(),
      enfants: _enfants.map((e) => e.snapshot()).toList(),
      personnesACharge: _charges.map((e) => e.snapshot()).toList(),
      remarques: _familleRemarques.text,
    );
  }

  Future<void> _save({bool draft = false}) async {
    if (!draft && !_validateStep1()) return;
    if (draft &&
        _nom.text.trim().isEmpty &&
        _prenom.text.trim().isEmpty &&
        _postnom.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Brouillon : saisissez au moins un nom, post-nom ou prénom'),
        ),
      );
      return;
    }

    setState(() => _busy = true);
    try {
      final db = LocalDatabase.instance.db;
      final now = DateTime.now().toUtc().toIso8601String();
      final payload = _buildPayload();
      final payloadJson = jsonEncode(payload);
      final given = _prenom.text.trim().isEmpty ? '(brouillon)' : _prenom.text.trim();
      final family = _nom.text.trim().isEmpty ? 'Sans nom' : _nom.text.trim();
      final status = draft ? 'DRAFT' : 'QUEUED';
      final dob = _dob.text.trim();

      final isUpdate = _localId != null;
      final localId = _localId ?? const Uuid().v4();
      final nextVersion = isUpdate ? _version + 1 : 1;

      final row = <String, Object?>{
        'given_names': given,
        'family_name': family,
        'sex': _sex,
        'date_of_birth': dob.isEmpty ? null : dob,
        'photo_ref': _photoRef,
        'payload': payloadJson,
        'version': nextVersion,
        'status': status,
        'updated_at': now,
      };

      if (isUpdate) {
        if (!draft) {
          row['review_note'] = null;
        }
        await db.update(
          'census_records',
          row,
          where: 'local_id = ?',
          whereArgs: [localId],
        );
      } else {
        await db.insert('census_records', {
          'id': localId,
          'local_id': localId,
          'household_local_id': widget.householdLocalId,
          'campaign_id': widget.campaignId,
          ...row,
        });
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
      }

      setState(() {
        _localId = localId;
        _version = nextVersion;
      });

      if (!draft) {
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
              'date_of_birth': dob,
              'photo_ref': _photoRef,
              'version': nextVersion,
              'payload': payload,
              'relationship_to_head': _relation,
            },
          ),
        );
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            draft
                ? 'Brouillon enregistré — vous pouvez continuer plus tard'
                : (isUpdate
                    ? 'Fiche finalisée — en file de sync'
                    : 'Fiche enregistrée — en file de sync'),
          ),
        ),
      );
      if (!draft) {
        Navigator.of(context).pop(true);
      }
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

  Widget _saveButtons() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        OutlinedButton.icon(
          onPressed: _busy ? null : () => _save(draft: true),
          icon: const Icon(Icons.save_outlined),
          label: const Text('Sauvegarder temporairement'),
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
            foregroundColor: const Color(0xFF5D87FF),
          ),
        ),
        const SizedBox(height: 10),
        FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFE11D48),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          onPressed: _busy ? null : () => _save(draft: false),
          icon: _busy
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.check_circle_outline),
          label: Text(
            _localId != null && (widget.existing?['status']?.toString() == 'DRAFT' || _isEdit)
                ? 'Finaliser et envoyer'
                : 'Enregistrer toute la fiche',
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Temporaire = brouillon local (pas de sync). Finaliser = file de synchronisation.',
          style: TextStyle(fontSize: 12, color: Color(0xFF5A6A85)),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildIdentityBlock() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _section('1. Identité de la personne', [
          TextFormField(
            controller: _nom,
            decoration: _dec('Nom de la personne *'),
            textCapitalization: TextCapitalization.characters,
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
                  onChanged: (v) => setState(() => _etatCivil = v ?? 'CELIBATAIRE'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextFormField(controller: _profession, decoration: _dec('Profession')),
          const SizedBox(height: 10),
          GeoCascadeField(
            preset: GeoCascadePreset.place,
            title: 'Lieu de naissance',
            onLabelChanged: (label) {
              _lieuNaissance.text = label;
            },
            onSelectionChanged: (sel) => _geoNaissance = sel,
          ),
          const SizedBox(height: 10),
          TextFormField(
            controller: _dob,
            readOnly: true,
            onTap: _pickDob,
            decoration: _dec('Date de naissance *', hint: 'Toucher pour choisir').copyWith(
              suffixIcon: IconButton(
                icon: const Icon(Icons.calendar_today),
                onPressed: _pickDob,
              ),
            ),
          ),
          const SizedBox(height: 10),
          TextFormField(
            controller: _hopitalNaissance,
            decoration: _dec('Hôpital de naissance'),
          ),
          const SizedBox(height: 10),
          TextFormField(
            controller: _langues,
            decoration: _dec('Langues parlées', hint: 'Français, Lingala…'),
          ),
          const SizedBox(height: 10),
          TextFormField(controller: _pere, decoration: _dec('Nom du père')),
          const SizedBox(height: 10),
          TextFormField(controller: _mere, decoration: _dec('Nom de la mère')),
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
        ]),
        _section('1b. Adresse actuelle', [
          GeoCascadeField(
            preset: GeoCascadePreset.address,
            title: 'Adresse actuelle',
            onLabelChanged: (_) {},
            onSelectionChanged: (sel) => _geoActuelle = sel,
          ),
          const SizedBox(height: 10),
          TextFormField(controller: _numeroAvenue, decoration: _dec('N° avenue / parcelle')),
          const SizedBox(height: 10),
          TextFormField(
            controller: _telephone,
            decoration: _dec('Numéro de téléphone'),
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 10),
          TextFormField(
            controller: _email,
            decoration: _dec('Adresse e-mail'),
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 10),
          TextFormField(controller: _boitePostale, decoration: _dec('Boîte postale')),
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
      ],
    );
  }

  Widget _buildOriginBlock() {
    return _section('2. Origine / Originaire', [
      GeoCascadeField(
        preset: GeoCascadePreset.origin,
        title: 'Origine',
        onLabelChanged: (_) {},
        onSelectionChanged: (sel) => _geoOrigine = sel,
      ),
      const SizedBox(height: 10),
      Autocomplete<String>(
        optionsBuilder: (TextEditingValue tev) {
          final q = tev.text.trim().toLowerCase();
          if (q.isEmpty) return kRdcTribus.take(40);
          return kRdcTribus.where((t) => t.toLowerCase().contains(q)).take(60);
        },
        onSelected: (v) {
          _tribu.text = v;
          setState(() {});
        },
        fieldViewBuilder: (context, controller, focus, onSubmit) {
          if (controller.text.isEmpty && _tribu.text.isNotEmpty) {
            controller.text = _tribu.text;
          }
          return TextFormField(
            controller: controller,
            focusNode: focus,
            decoration: _dec(
              'Tribu / ethnie',
              hint: '${kRdcTribus.length} références — ou Autre',
            ),
            onChanged: (v) => _tribu.text = v,
            onFieldSubmitted: (_) => onSubmit(),
          );
        },
      ),
      Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Text(
          kRdcTribusNote,
          style: const TextStyle(fontSize: 11, color: Color(0xFF5A6A85)),
        ),
      ),
    ]);
  }

  Widget _buildBioBlock() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _section('3. Biométrie — Photo', [
          PhotoCaptureWidget(
            initialRef: _photoRef,
            onCaptured: (ref) => setState(() => _photoRef = ref),
          ),
        ]),
        _section('3. Biométrie — Empreintes & iris', [
          TextFormField(
            controller: _empreinteGauche,
            decoration: _dec('Empreinte gauche (réf.)'),
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton(
              onPressed: () {
                final ref =
                    'CAP-G-${DateTime.now().millisecondsSinceEpoch.toRadixString(36).toUpperCase()}';
                setState(() => _empreinteGauche.text = ref);
              },
              child: const Text('Capturer gauche'),
            ),
          ),
          const SizedBox(height: 10),
          TextFormField(
            controller: _empreinteDroite,
            decoration: _dec('Empreinte droite (réf.)'),
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton(
              onPressed: () {
                final ref =
                    'CAP-D-${DateTime.now().millisecondsSinceEpoch.toRadixString(36).toUpperCase()}';
                setState(() => _empreinteDroite.text = ref);
              },
              child: const Text('Capturer droite'),
            ),
          ),
          const SizedBox(height: 10),
          TextFormField(controller: _iris, decoration: _dec('Iris (réf.)')),
          const SizedBox(height: 12),
          FingerprintCaptureWidget(
            initialRef: _fingerprintRef,
            onCaptured: (ref) => setState(() => _fingerprintRef = ref),
          ),
        ]),
      ],
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
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF1F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE11D48).withValues(alpha: 0.35)),
              ),
              child: const Text(
                'Faites défiler vers le bas : toutes les sections sont sur cette page '
                '(Identité, Adresse, Origine, Biométrie, Études, Expérience, Admin, Famille).',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, height: 1.35),
              ),
            ),
            const SizedBox(height: 12),
            _buildIdentityBlock(),
            _buildOriginBlock(),
            _buildBioBlock(),
            _section('4. Études faites', [
              _buildEtudesBlock(),
            ]),
            _section('5. Expérience professionnelle', [
              TextFormField(
                controller: _professionnel,
                decoration: _dec('Expérience professionnelle'),
                maxLines: 6,
              ),
            ]),
            _section('6. Identité administrative', [
              _buildAdminBlock(),
            ]),
            _section('7. Situation familiale', [
              _buildFamilyBlock(),
            ]),
            const SizedBox(height: 8),
            _saveButtons(),
          ],
        ),
      ),
    );
  }

  Widget _buildEtudesBlock() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DropdownButtonFormField<String>(
          value: _niveauAtteint.isEmpty ? null : _niveauAtteint,
          decoration: _dec("Niveau d'études atteint"),
          items: [
            for (final o in EtudesData.niveaux.where((e) => e.$1.isNotEmpty))
              DropdownMenuItem(value: o.$1, child: Text(o.$2)),
          ],
          onChanged: (v) => setState(() => _niveauAtteint = v ?? ''),
        ),
        const SizedBox(height: 10),
        TextFormField(
          controller: _anneeFinEtudes,
          decoration: _dec("Année de fin d'études", hint: 'Ex. 2018'),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                value: _saitLire.isEmpty ? null : _saitLire,
                decoration: _dec('Sait lire'),
                items: const [
                  DropdownMenuItem(value: 'oui', child: Text('Oui')),
                  DropdownMenuItem(value: 'non', child: Text('Non')),
                ],
                onChanged: (v) => setState(() => _saitLire = v ?? ''),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: DropdownButtonFormField<String>(
                value: _saitEcrire.isEmpty ? null : _saitEcrire,
                decoration: _dec('Sait écrire'),
                items: const [
                  DropdownMenuItem(value: 'oui', child: Text('Oui')),
                  DropdownMenuItem(value: 'non', child: Text('Non')),
                ],
                onChanged: (v) => setState(() => _saitEcrire = v ?? ''),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Text(
                'Parcours scolaire (${_etablissements.length})',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
            TextButton.icon(
              onPressed: () => setState(() => _etablissements.add(_ScoEditors(EtablissementScolaire()))),
              icon: const Icon(Icons.add),
              label: const Text('Ajouter'),
            ),
          ],
        ),
        for (var i = 0; i < _etablissements.length; i++) ...[
          const SizedBox(height: 8),
          _memberCard(
            title: 'Établissement ${i + 1}',
            onRemove: () => setState(() {
              _etablissements[i].dispose();
              _etablissements.removeAt(i);
            }),
            child: _scoFields(_etablissements[i]),
          ),
        ],
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Text(
                'Parcours universitaire (${_formations.length})',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
            TextButton.icon(
              onPressed: () => setState(() => _formations.add(_UnivEditors(FormationUniversitaire()))),
              icon: const Icon(Icons.add),
              label: const Text('Ajouter'),
            ),
          ],
        ),
        for (var i = 0; i < _formations.length; i++) ...[
          const SizedBox(height: 8),
          _memberCard(
            title: 'Formation ${i + 1}',
            onRemove: () => setState(() {
              _formations[i].dispose();
              _formations.removeAt(i);
            }),
            child: _univFields(_formations[i]),
          ),
        ],
        const SizedBox(height: 12),
        TextFormField(
          controller: _etudesRemarques,
          decoration: _dec('Remarques études'),
          maxLines: 3,
        ),
      ],
    );
  }

  Widget _scoFields(_ScoEditors m) {
    return Column(
      children: [
        TextFormField(controller: m.etablissement, decoration: _dec('Établissement')),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          value: m.niveau.isEmpty ? null : m.niveau,
          decoration: _dec('Niveau'),
          items: [
            for (final n in EtudesData.niveauxScolaires.where((e) => e.isNotEmpty))
              DropdownMenuItem(value: n, child: Text(n)),
          ],
          onChanged: (v) => setState(() => m.niveau = v ?? ''),
        ),
        const SizedBox(height: 8),
        TextFormField(controller: m.ville, decoration: _dec('Ville / commune')),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextFormField(controller: m.anneeDebut, decoration: _dec('Année début')),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextFormField(controller: m.anneeFin, decoration: _dec('Année fin')),
            ),
          ],
        ),
        const SizedBox(height: 8),
        TextFormField(controller: m.diplome, decoration: _dec('Diplôme / certificat')),
      ],
    );
  }

  Widget _univFields(_UnivEditors m) {
    return Column(
      children: [
        TextFormField(controller: m.etablissement, decoration: _dec('Université / établissement')),
        const SizedBox(height: 8),
        TextFormField(controller: m.filiere, decoration: _dec('Filière / domaine')),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          value: m.diplome.isEmpty ? null : m.diplome,
          decoration: _dec('Diplôme'),
          items: [
            for (final d in EtudesData.diplomesUniv.where((e) => e.isNotEmpty))
              DropdownMenuItem(value: d, child: Text(d)),
          ],
          onChanged: (v) => setState(() => m.diplome = v ?? ''),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextFormField(controller: m.anneeObtention, decoration: _dec('Année')),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: DropdownButtonFormField<String>(
                value: m.statut.isEmpty ? null : m.statut,
                decoration: _dec('Statut'),
                items: const [
                  DropdownMenuItem(value: 'TERMINE', child: Text('Terminé')),
                  DropdownMenuItem(value: 'EN_COURS', child: Text('En cours')),
                  DropdownMenuItem(value: 'ABANDONNE', child: Text('Abandonné')),
                ],
                onChanged: (v) => setState(() => m.statut = v ?? ''),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildAdminBlock() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextFormField(
          controller: _adminNumero,
          decoration: _dec('N° administratif / dossier'),
        ),
        const SizedBox(height: 10),
        TextFormField(
          controller: _adminBureau,
          decoration: _dec('Bureau / service de référence'),
        ),
        const SizedBox(height: 10),
        TextFormField(
          controller: _adminDateOuverture,
          decoration: _dec("Date d'ouverture", hint: 'AAAA-MM-JJ'),
        ),
        const SizedBox(height: 10),
        TextFormField(
          controller: _adminAgent,
          decoration: _dec('Référence agent / matricule'),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Text(
                'Pièces (${_documents.length})',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
            TextButton.icon(
              onPressed: () => setState(() => _documents.add(_DocEditors(DocumentAdmin()))),
              icon: const Icon(Icons.add),
              label: const Text('Ajouter'),
            ),
          ],
        ),
        for (var i = 0; i < _documents.length; i++) ...[
          const SizedBox(height: 8),
          _memberCard(
            title: 'Pièce ${i + 1}',
            onRemove: () => setState(() {
              _documents[i].dispose();
              _documents.removeAt(i);
            }),
            child: _docFields(_documents[i]),
          ),
        ],
        const SizedBox(height: 12),
        TextFormField(
          controller: _adminRemarques,
          decoration: _dec('Remarques administratives'),
          maxLines: 3,
        ),
      ],
    );
  }

  Widget _docFields(_DocEditors m) {
    return Column(
      children: [
        DropdownButtonFormField<String>(
          value: m.type.isEmpty ? null : m.type,
          decoration: _dec('Type de document'),
          items: [
            for (final t in IdentiteAdminData.typesDocument.where((e) => e.$1.isNotEmpty))
              DropdownMenuItem(value: t.$1, child: Text(t.$2)),
          ],
          onChanged: (v) => setState(() => m.type = v ?? ''),
        ),
        if (m.type == 'AUTRE') ...[
          const SizedBox(height: 8),
          TextFormField(controller: m.typeAutre, decoration: _dec('Préciser le type')),
        ],
        const SizedBox(height: 8),
        TextFormField(controller: m.numero, decoration: _dec('Numéro')),
        const SizedBox(height: 8),
        TextFormField(controller: m.autorite, decoration: _dec('Autorité émettrice')),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: m.dateEmission,
                decoration: _dec('Émission', hint: 'AAAA-MM-JJ'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextFormField(
                controller: m.dateExpiration,
                decoration: _dec('Expiration', hint: 'AAAA-MM-JJ'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        TextFormField(controller: m.lieuEmission, decoration: _dec("Lieu d'émission")),
      ],
    );
  }

  Widget _buildFamilyBlock() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DropdownButtonFormField<bool>(
          value: _aConjoint,
          decoration: _dec('A un conjoint / vit en couple'),
          items: const [
            DropdownMenuItem(value: false, child: Text('Non')),
            DropdownMenuItem(value: true, child: Text('Oui')),
          ],
          onChanged: (v) => setState(() => _aConjoint = v ?? false),
        ),
        if (_aConjoint) ...[
          const SizedBox(height: 10),
          Text('Conjoint(e)', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 6),
          _memberFields(_conjoint, showTelephone: true),
        ],
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Text(
                'Enfants (${_enfants.length})',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
            TextButton.icon(
              onPressed: () => setState(() => _enfants.add(_MemberEditors(FamilyMember(lien: 'ENFANT')))),
              icon: const Icon(Icons.person_add_alt_1),
              label: const Text('Ajouter'),
            ),
          ],
        ),
        if (_enfants.isEmpty)
          const Text('Aucun enfant déclaré.', style: TextStyle(color: Color(0xFF5A6A85))),
        for (var i = 0; i < _enfants.length; i++) ...[
          const SizedBox(height: 8),
          _memberCard(
            title: 'Enfant ${i + 1}',
            onRemove: () => setState(() {
              _enfants[i].dispose();
              _enfants.removeAt(i);
            }),
            child: _memberFields(_enfants[i]),
          ),
        ],
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Text(
                'Personnes à charge (${_charges.length})',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
            TextButton.icon(
              onPressed: () => setState(() => _charges.add(_MemberEditors(FamilyMember()))),
              icon: const Icon(Icons.person_add_alt_1),
              label: const Text('Ajouter'),
            ),
          ],
        ),
        if (_charges.isEmpty)
          const Text('Aucune personne à charge.', style: TextStyle(color: Color(0xFF5A6A85))),
        for (var i = 0; i < _charges.length; i++) ...[
          const SizedBox(height: 8),
          _memberCard(
            title: 'Personne à charge ${i + 1}',
            onRemove: () => setState(() {
              _charges[i].dispose();
              _charges.removeAt(i);
            }),
            child: _memberFields(_charges[i], showTelephone: true, showLien: true),
          ),
        ],
        const SizedBox(height: 14),
        TextFormField(
          controller: _familleRemarques,
          decoration: _dec('Remarques', hint: 'Précisions complémentaires…'),
          maxLines: 3,
        ),
      ],
    );
  }

  Widget _memberCard({
    required String title,
    required VoidCallback onRemove,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFFD5DEEE)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700))),
              IconButton(
                onPressed: onRemove,
                icon: const Icon(Icons.delete_outline, color: Color(0xFFE11D48)),
                tooltip: 'Retirer',
              ),
            ],
          ),
          child,
        ],
      ),
    );
  }

  Widget _memberFields(
    _MemberEditors m, {
    bool showTelephone = false,
    bool showLien = false,
  }) {
    return Column(
      children: [
        TextFormField(controller: m.nom, decoration: _dec('Nom')),
        const SizedBox(height: 8),
        TextFormField(controller: m.postnom, decoration: _dec('Post-nom')),
        const SizedBox(height: 8),
        TextFormField(controller: m.prenom, decoration: _dec('Prénom')),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                value: m.sexe.isEmpty ? null : m.sexe,
                decoration: _dec('Sexe'),
                items: const [
                  DropdownMenuItem(value: 'M', child: Text('Masculin')),
                  DropdownMenuItem(value: 'F', child: Text('Féminin')),
                ],
                onChanged: (v) => setState(() => m.sexe = v ?? ''),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextFormField(
                controller: m.dateNaissance,
                decoration: _dec('Date naissance', hint: 'AAAA-MM-JJ'),
              ),
            ),
          ],
        ),
        if (showTelephone) ...[
          const SizedBox(height: 8),
          TextFormField(controller: m.telephone, decoration: _dec('Téléphone')),
        ],
        if (showLien) ...[
          const SizedBox(height: 8),
          TextFormField(
            controller: m.lien,
            decoration: _dec('Lien de parenté', hint: 'Frère, oncle…'),
          ),
        ],
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Vit dans le ménage'),
          value: m.vitAvec,
          onChanged: (v) => setState(() => m.vitAvec = v),
        ),
      ],
    );
  }
}

class _MemberEditors {
  _MemberEditors(FamilyMember m)
      : nom = TextEditingController(text: m.nom),
        postnom = TextEditingController(text: m.postnom),
        prenom = TextEditingController(text: m.prenom),
        dateNaissance = TextEditingController(text: m.dateNaissance),
        telephone = TextEditingController(text: m.telephone),
        lien = TextEditingController(text: m.lien),
        sexe = m.sexe,
        vitAvec = m.vitAvec;

  final TextEditingController nom;
  final TextEditingController postnom;
  final TextEditingController prenom;
  final TextEditingController dateNaissance;
  final TextEditingController telephone;
  final TextEditingController lien;
  String sexe;
  bool vitAvec;

  FamilyMember snapshot() => FamilyMember(
        nom: nom.text,
        postnom: postnom.text,
        prenom: prenom.text,
        sexe: sexe,
        dateNaissance: dateNaissance.text.trim(),
        telephone: telephone.text,
        vitAvec: vitAvec,
        lien: lien.text,
      );

  void dispose() {
    nom.dispose();
    postnom.dispose();
    prenom.dispose();
    dateNaissance.dispose();
    telephone.dispose();
    lien.dispose();
  }
}

class _ScoEditors {
  _ScoEditors(EtablissementScolaire m)
      : etablissement = TextEditingController(text: m.etablissement),
        ville = TextEditingController(text: m.ville),
        anneeDebut = TextEditingController(text: m.anneeDebut),
        anneeFin = TextEditingController(text: m.anneeFin),
        diplome = TextEditingController(text: m.diplome),
        niveau = m.niveau;

  final TextEditingController etablissement;
  final TextEditingController ville;
  final TextEditingController anneeDebut;
  final TextEditingController anneeFin;
  final TextEditingController diplome;
  String niveau;

  EtablissementScolaire snapshot() => EtablissementScolaire(
        etablissement: etablissement.text,
        niveau: niveau,
        anneeDebut: anneeDebut.text,
        anneeFin: anneeFin.text,
        diplome: diplome.text,
        ville: ville.text,
      );

  void dispose() {
    etablissement.dispose();
    ville.dispose();
    anneeDebut.dispose();
    anneeFin.dispose();
    diplome.dispose();
  }
}

class _UnivEditors {
  _UnivEditors(FormationUniversitaire m)
      : etablissement = TextEditingController(text: m.etablissement),
        filiere = TextEditingController(text: m.filiere),
        anneeObtention = TextEditingController(text: m.anneeObtention),
        diplome = m.diplome,
        statut = m.statut;

  final TextEditingController etablissement;
  final TextEditingController filiere;
  final TextEditingController anneeObtention;
  String diplome;
  String statut;

  FormationUniversitaire snapshot() => FormationUniversitaire(
        etablissement: etablissement.text,
        filiere: filiere.text,
        diplome: diplome,
        anneeObtention: anneeObtention.text,
        statut: statut,
      );

  void dispose() {
    etablissement.dispose();
    filiere.dispose();
    anneeObtention.dispose();
  }
}

class _DocEditors {
  _DocEditors(DocumentAdmin m)
      : typeAutre = TextEditingController(text: m.typeAutre),
        numero = TextEditingController(text: m.numero),
        autorite = TextEditingController(text: m.autorite),
        dateEmission = TextEditingController(text: m.dateEmission),
        dateExpiration = TextEditingController(text: m.dateExpiration),
        lieuEmission = TextEditingController(text: m.lieuEmission),
        type = m.type;

  final TextEditingController typeAutre;
  final TextEditingController numero;
  final TextEditingController autorite;
  final TextEditingController dateEmission;
  final TextEditingController dateExpiration;
  final TextEditingController lieuEmission;
  String type;

  DocumentAdmin snapshot() => DocumentAdmin(
        type: type,
        typeAutre: typeAutre.text,
        numero: numero.text,
        autorite: autorite.text,
        dateEmission: dateEmission.text.trim(),
        dateExpiration: dateExpiration.text.trim(),
        lieuEmission: lieuEmission.text,
      );

  void dispose() {
    typeAutre.dispose();
    numero.dispose();
    autorite.dispose();
    dateEmission.dispose();
    dateExpiration.dispose();
    lieuEmission.dispose();
  }
}
