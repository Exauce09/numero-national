import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import '../../core/api_client.dart';
import '../../core/config.dart';
import '../../core/provisional_nic.dart';
import '../../sync/local_database.dart';
import '../../sync/sync_lifecycle.dart';
import '../../sync/sync_queue.dart';
import 'fingerprint_capture.dart';
import 'geo_cascade_field.dart';
import 'iris_capture.dart';
import 'coupon_print_screen.dart';
import 'photo_capture.dart';
import 'rdc_tribus.dart';
import 'situation_familiale.dart';
import 'etudes_et_admin.dart';

/// Type de fiche terrain — l’identité obligatoire dépend de ce choix.
enum FicheKind { personne, bebe, decede, marie }

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
  late final TextEditingController _dateDeces;
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
  late final TextEditingController _etudesRemarques;
  late final TextEditingController _anneeFinEtudes;
  late final TextEditingController _adminNumero;
  late final TextEditingController _adminBureau;
  late final TextEditingController _adminDateOuverture;
  late final TextEditingController _adminAgent;
  late final TextEditingController _adminRemarques;
  late final TextEditingController _expPoste;
  late final TextEditingController _expEmployeur;
  late final TextEditingController _expAnnees;
  late final TextEditingController _expRemarques;
  late final TextEditingController _familleRemarques;

  String _sex = 'M';
  FicheKind _ficheKind = FicheKind.personne;
  String _etatCivil = 'CELIBATAIRE';
  String _handicap = 'NORMAL';
  String _relation = 'AUTRE';
  String _saitLire = '';
  String _saitEcrire = '';
  String _niveauAtteint = '';
  String _expStatut = '';
  String _expSecteur = '';
  String? _photoRef;
  String? _fingerprintRef;
  Map<String, String?> _geoNaissance = {};
  Map<String, String?> _geoActuelle = {};
  Map<String, String?> _geoOrigine = {};
  bool _busy = false;
  String? _rejectNote;
  String? _localId;
  int _version = 1;
  /// Wizard séquentiel 1…7 (une section à la fois).
  int _step = 1;
  static const _stepTitles = <String>[
    '1. Identité',
    '2. Origine',
    '3. Biométrie',
    '4. Études',
    '5. Expérience',
    '6. Admin',
    '7. Famille',
  ];

  bool _aConjoint = false;
  late _MemberEditors _conjoint;
  final List<_MemberEditors> _enfants = [];
  final List<_MemberEditors> _charges = [];
  final List<_ScoEditors> _etablissements = [];
  final List<_UnivEditors> _formations = [];
  final List<_ProEditors> _formationsPro = [];
  final List<_DocEditors> _documents = [];
  final List<_JobEditors> _emplois = [];
  int _nombreEnfants = 0;
  final _conjointSearch = TextEditingController();
  List<Map<String, String>> _conjointSuggestions = [];
  bool _conjointLocked = false;

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
    _dob = TextEditingController(
      text: e?['date_of_birth']?.toString() ??
          payload['date_naissance']?.toString() ??
          '',
    );
    _dateDeces = TextEditingController(text: payload['date_deces']?.toString() ?? '');
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
    for (final f in etudes.formationsProfessionnelles) {
      _formationsPro.add(_ProEditors(f));
    }

    final experience = ExperienceData.parse(
      payload['experience_detail'] ?? payload['parcours_professionnel'],
    );
    _expStatut = experience.statutActuel;
    _expSecteur = experience.secteurActuel;
    _expPoste = TextEditingController(text: experience.posteActuel);
    _expEmployeur = TextEditingController(text: experience.employeurActuel);
    _expAnnees = TextEditingController(text: experience.anneesExperience);
    _expRemarques = TextEditingController(text: experience.remarques);
    for (final j in experience.emplois) {
      _emplois.add(_JobEditors(j));
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

    _sex = e?['sex']?.toString() ?? payload['sex']?.toString() ?? 'M';
    _ficheKind = _parseFicheKind(payload['fiche_kind'] ?? e?['fiche_kind']);
    _etatCivil = payload['etat_civil']?.toString() ?? 'CELIBATAIRE';
    _handicap = payload['handicap']?.toString() ?? 'NORMAL';
    _relation = payload['relationship_to_head']?.toString() ?? 'AUTRE';

    final famille = SituationFamiliale.parse(
      payload['situation_familiale_detail'] ?? payload['situation_familiale'],
    );
    _aConjoint = famille.aConjoint || _etatCivil == 'MARIE';
    _conjoint = _MemberEditors(famille.conjoint);
    _conjointLocked = (famille.conjoint.personId ?? '').isNotEmpty;
    _nombreEnfants = famille.nombreEnfants;
    for (final e in famille.enfants) {
      _enfants.add(_MemberEditors(e));
    }
    for (final c in famille.personnesACharge) {
      _charges.add(_MemberEditors(c));
    }
    _familleRemarques = TextEditingController(text: famille.remarques);

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

  FicheKind _parseFicheKind(Object? raw) {
    switch (raw?.toString().toLowerCase()) {
      case 'bebe':
      case 'bébé':
      case 'baby':
      case 'newborn':
        return FicheKind.bebe;
      case 'decede':
      case 'décédé':
      case 'deceased':
      case 'death':
        return FicheKind.decede;
      case 'marie':
      case 'marié':
      case 'mariee':
      case 'mariée':
      case 'married':
        return FicheKind.marie;
      default:
        return FicheKind.personne;
    }
  }

  String get _ficheKindCode => switch (_ficheKind) {
        FicheKind.personne => 'personne',
        FicheKind.bebe => 'bebe',
        FicheKind.decede => 'decede',
        FicheKind.marie => 'marie',
      };

  String get _ficheKindLabel => switch (_ficheKind) {
        FicheKind.personne => 'Personne vivante',
        FicheKind.bebe => 'Bébé (nouveau-né)',
        FicheKind.decede => 'Personne décédée',
        FicheKind.marie => 'Marié(e)',
      };

  @override
  void dispose() {
    _nom.dispose();
    _postnom.dispose();
    _prenom.dispose();
    _profession.dispose();
    _lieuNaissance.dispose();
    _dob.dispose();
    _dateDeces.dispose();
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
    _etudesRemarques.dispose();
    _anneeFinEtudes.dispose();
    _adminNumero.dispose();
    _adminBureau.dispose();
    _adminDateOuverture.dispose();
    _adminAgent.dispose();
    _adminRemarques.dispose();
    _expPoste.dispose();
    _expEmployeur.dispose();
    _expAnnees.dispose();
    _expRemarques.dispose();
    _familleRemarques.dispose();
    _conjointSearch.dispose();
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
    for (final f in _formationsPro) {
      f.dispose();
    }
    for (final j in _emplois) {
      j.dispose();
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

  bool _validateStep1({bool showMessage = true}) {
    String? err;
    final nom = _nom.text.trim();
    final prenom = _prenom.text.trim();
    final dob = _dob.text.trim();
    final mere = _mere.text.trim();
    final pere = _pere.text.trim();
    final dod = _dateDeces.text.trim();

    switch (_ficheKind) {
      case FicheKind.personne:
        if (nom.isEmpty || prenom.isEmpty || !_validDate(dob)) {
          err = 'Identité personne : nom, prénom et date de naissance (AAAA-MM-JJ) requis';
        }
      case FicheKind.bebe:
        if (nom.isEmpty || !_validDate(dob) || (mere.isEmpty && pere.isEmpty)) {
          err =
              'Identité bébé : nom (ou « Enfant de … »), date de naissance, et nom de la mère ou du père requis';
        }
      case FicheKind.decede:
        if (nom.isEmpty ||
            prenom.isEmpty ||
            !_validDate(dob) ||
            !_validDate(dod)) {
          err =
              'Identité décédé : nom, prénom, date de naissance et date de décès (AAAA-MM-JJ) requis';
        } else if (_validDate(dob) && _validDate(dod)) {
          final b = DateTime.parse(dob);
          final d = DateTime.parse(dod);
          if (d.isBefore(b)) {
            err = 'La date de décès ne peut pas être antérieure à la naissance';
          }
        }
      case FicheKind.marie:
        if (nom.isEmpty || prenom.isEmpty || !_validDate(dob)) {
          err = 'Identité marié(e) : nom, prénom et date de naissance (AAAA-MM-JJ) requis';
        } else {
          final cNom = _conjoint.nom.text.trim();
          final cPrenom = _conjoint.prenom.text.trim();
          if (!_conjointLocked && (cNom.isEmpty || cPrenom.isEmpty)) {
            err =
                'Identité marié(e) : nom et prénom du conjoint(e) requis (ou liez une fiche existante)';
          }
        }
    }

    if (err != null) {
      if (showMessage && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
      }
      return false;
    }
    return true;
  }

  Future<void> _pickDeathDate() async {
    final now = DateTime.now();
    DateTime initial = now;
    final parts = _dateDeces.text.trim().split('-');
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
      initialDate: initial.isAfter(now) ? now : initial,
      firstDate: DateTime(1900),
      lastDate: now,
      helpText: 'Date de décès',
    );
    if (picked == null) return;
    final y = picked.year.toString().padLeft(4, '0');
    final m = picked.month.toString().padLeft(2, '0');
    final d = picked.day.toString().padLeft(2, '0');
    setState(() => _dateDeces.text = '$y-$m-$d');
  }

  Map<String, dynamic> _buildPayload() {
    final lieu = _geoNaissance['label']?.trim().isNotEmpty == true
        ? _geoNaissance['label']
        : _lieuNaissance.text.trim();
    return {
      'fiche_kind': _ficheKindCode,
      'date_deces': _dateDeces.text.trim(),
      'nom': _nom.text.trim(),
      'postnom': _postnom.text.trim(),
      'prenom': _prenom.text.trim(),
      'etat_civil': _ficheKind == FicheKind.marie ? 'MARIE' : _etatCivil,
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
      'parcours_professionnel': _buildExperience().formatSummary(),
      'experience_detail': _buildExperience().toJson(),
      'etudes_detail': _buildEtudes().toJson(),
      'numero_admin': _buildAdmin().numeroDossier.trim(),
      'identite_administrative_detail': _buildAdmin().toJson(),
      'situation_familiale': _buildSituation().formatSummary(),
      'situation_familiale_detail': _buildSituation().toJson(),
      'relationship_to_head': _relation,
    };
  }

  ExperienceData _buildExperience() {
    return ExperienceData(
      statutActuel: _expStatut,
      employeurActuel: _expEmployeur.text,
      posteActuel: _expPoste.text,
      secteurActuel: _expSecteur,
      anneesExperience: _expAnnees.text,
      emplois: _emplois.map((e) => e.snapshot()).toList(),
      remarques: _expRemarques.text,
    );
  }

  EtudesData _buildEtudes() {
    return EtudesData(
      saitLire: _saitLire,
      saitEcrire: _saitEcrire,
      niveauAtteint: _niveauAtteint,
      anneeFinEtudes: _anneeFinEtudes.text,
      etablissements: _etablissements.map((e) => e.snapshot()).toList(),
      formationsUniversitaires: _formations.map((e) => e.snapshot()).toList(),
      formationsProfessionnelles: _formationsPro.map((e) => e.snapshot()).toList(),
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
      aConjoint: _aConjoint || _etatCivil == 'MARIE',
      conjoint: _conjoint.snapshot(),
      nombreEnfants: _nombreEnfants,
      enfants: _enfants.map((e) => e.snapshot()).toList(),
      personnesACharge: _charges.map((e) => e.snapshot()).toList(),
      remarques: _familleRemarques.text,
    );
  }

  Future<void> _searchConjoint(String q) async {
    final query = q.trim().toLowerCase();
    if (query.isEmpty) {
      setState(() => _conjointSuggestions = []);
      return;
    }
    final hits = <Map<String, String>>[];
    final seen = <String>{};

    // 1) Recherche nationale (registre serveur) — prioritaire.
    try {
      final api = ApiClient();
      final encoded = Uri.encodeQueryComponent(q.trim());
      final res = await api.get('/registry/citizens?q=$encoded&page=1&page_size=12');
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final body = api.decodeMap(res);
        final items = (body['items'] as List?) ?? const [];
        for (final raw in items) {
          if (raw is! Map) continue;
          final m = Map<String, dynamic>.from(raw);
          final id = (m['id'] ?? '').toString();
          if (id.isEmpty || seen.contains(id)) continue;
          final given = (m['given_names'] ?? '').toString().trim();
          final parts = given.split(RegExp(r'\s+')).where((e) => e.isNotEmpty).toList();
          final prenom = parts.isEmpty ? '' : parts.first;
          final postnom = parts.length > 1 ? parts.sublist(1).join(' ') : '';
          hits.add({
            'id': id,
            'nom': (m['family_name'] ?? '').toString(),
            'postnom': postnom,
            'prenom': prenom,
            'sexe': (m['sex'] ?? '').toString(),
            'date_naissance': (m['date_of_birth'] ?? '').toString().split('T').first,
            'telephone': '',
            'nic': (m['nic'] ?? '').toString(),
          });
          seen.add(id);
          if (hits.length >= 12) break;
        }
      }
    } catch (_) {
      // Offline / sans droit : on complète avec le cache local.
    }

    // 2) Fallback local (SQLite appareil).
    if (hits.length < 12) {
      final db = LocalDatabase.instance.db;
      final rows = await db.query('census_records', limit: 80, orderBy: 'updated_at DESC');
      for (final r in rows) {
        final payload = _decodePayload(r['payload']);
        final nom = (payload['nom'] ?? r['family_name'] ?? '').toString();
        final postnom = (payload['postnom'] ?? '').toString();
        final prenom = (payload['prenom'] ?? r['given_names'] ?? '').toString();
        final blob = '$nom $postnom $prenom'.toLowerCase();
        final tokens = query.split(RegExp(r'\s+')).where((t) => t.isNotEmpty);
        if (!tokens.every((t) => blob.contains(t))) continue;
        final id = (r['local_id'] ?? r['id'] ?? '').toString();
        if (id.isEmpty || seen.contains(id)) continue;
        hits.add({
          'id': id,
          'nom': nom,
          'postnom': postnom,
          'prenom': prenom,
          'sexe': (payload['sexe'] ?? r['sex'] ?? '').toString(),
          'date_naissance': (payload['date_naissance'] ?? r['date_of_birth'] ?? '').toString(),
          'telephone': (payload['telephone'] ?? '').toString(),
          'nic': '',
        });
        seen.add(id);
        if (hits.length >= 12) break;
      }
    }
    if (mounted) setState(() => _conjointSuggestions = hits);
  }

  void _applyConjointHit(Map<String, String> hit) {
    setState(() {
      _conjoint.personId = hit['id'];
      _conjoint.nom.text = hit['nom'] ?? '';
      _conjoint.postnom.text = hit['postnom'] ?? '';
      _conjoint.prenom.text = hit['prenom'] ?? '';
      _conjoint.sexe = hit['sexe'] ?? '';
      _conjoint.dateNaissance.text = hit['date_naissance'] ?? '';
      _conjoint.telephone.text = hit['telephone'] ?? '';
      _conjointLocked = true;
      _conjointSuggestions = [];
      _conjointSearch.clear();
    });
  }

  void _setNombreEnfants(int n) {
    setState(() {
      _nombreEnfants = n < 0 ? 0 : n;
      while (_enfants.length > _nombreEnfants) {
        _enfants.removeLast().dispose();
      }
      while (_enfants.length < _nombreEnfants) {
        _enfants.add(_MemberEditors(FamilyMember(lien: 'Enfant')));
      }
    });
  }

  Future<void> _save({bool draft = false}) async {
    // Identité obligatoire avant brouillon ou finalisation.
    if (!_validateStep1()) return;
    if (!draft && (_aConjoint || _etatCivil == 'MARIE' || _ficheKind == FicheKind.marie)) {
      final cNom = _conjoint.nom.text.trim();
      final cPrenom = _conjoint.prenom.text.trim();
      if (!_conjointLocked && (cNom.isEmpty || cPrenom.isEmpty)) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Conjoint(e) : liez une fiche ou saisissez nom et prénom',
            ),
          ),
        );
        return;
      }
    }

    setState(() => _busy = true);
    try {
      final db = LocalDatabase.instance.db;
      final now = DateTime.now().toUtc().toIso8601String();
      final dob = _dob.text.trim();
      final payload = _buildPayload();
      // Numéro national dès finalisation (coupon + QR).
      String? nationalId = payload['national_id']?.toString() ?? payload['nic']?.toString();
      if (!draft && (nationalId == null || nationalId.isEmpty)) {
        nationalId = ProvisionalNic.generate(
          sex: _sex,
          dateOfBirth: dob,
          provinceCode: _geoActuelle['province_code'] ?? _geoNaissance['province_code'],
          ville: _geoActuelle['ville_name'] ?? _geoNaissance['ville_name'],
          commune: _geoActuelle['commune_name'] ?? _geoNaissance['commune_name'],
        );
        payload['national_id'] = nationalId;
        payload['nic'] = nationalId;
      }
      final payloadJson = jsonEncode(payload);
      final given = _prenom.text.trim().isEmpty ? '(brouillon)' : _prenom.text.trim();
      final family = _nom.text.trim().isEmpty ? 'Sans nom' : _nom.text.trim();
      final status = draft ? 'DRAFT' : 'QUEUED';

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
            'status': status,
            'payload': payload,
            'relationship_to_head': _relation,
          },
        ),
      );
      SyncLifecycle.instance.nudge();

      // Brouillon partagé aussi via API form-drafts (web / autre agent).
      if (draft) {
        try {
          final api = ApiClient();
          await api.post(
            '/census/form-drafts',
            body: {
              'system': 'flutter_census',
              'form_type': 'census_person',
              'title': '$family $given'.trim(),
              'local_id': localId,
              'campaign_id': widget.campaignId,
              'payload': payload,
              'version': nextVersion,
            },
          );
        } catch (_) {
          // Sync file + local DRAFT restent disponibles hors ligne.
        }
      }

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            draft
                ? 'Brouillon enregistré — un autre agent peut le terminer'
                : (isUpdate
                    ? 'Fiche finalisée — en file de sync'
                    : 'Fiche enregistrée — en file de sync'),
          ),
        ),
      );
      if (!draft) {
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => CouponPrintScreen(
              localId: localId,
              familyName: family,
              givenNames: given,
              sex: _sex,
              dateOfBirth: dob,
              nationalId: nationalId,
              campaignId: widget.campaignId,
              householdLocalId: widget.householdLocalId,
            ),
          ),
        );
        if (!mounted) return;
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
    final isLast = _step >= 7;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            if (_step > 1)
              Expanded(
                child: OutlinedButton(
                  onPressed: _busy ? null : () => setState(() => _step -= 1),
                  child: const Text('Retour'),
                ),
              ),
            if (_step > 1) const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: FilledButton(
                onPressed: _busy
                    ? null
                    : () {
                        if (_step == 1 && !_validateStep1()) return;
                        if (!isLast) {
                          setState(() => _step += 1);
                          return;
                        }
                        _save(draft: false);
                      },
                style: FilledButton.styleFrom(
                  backgroundColor: isLast ? const Color(0xFFE11D48) : const Color(0xFF007FFF),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: Text(isLast ? 'Finaliser + coupon' : 'Étape suivante'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: _busy ? null : () => _save(draft: true),
          icon: const Icon(Icons.save_outlined),
          label: const Text('Sauvegarder brouillon'),
        ),
        const SizedBox(height: 6),
        Text(
          'Étape $_step / 7 — ${_stepTitles[_step - 1]}',
          style: const TextStyle(fontSize: 12, color: Color(0xFF5A6A85)),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildIdentityBlock() {
    final isBebe = _ficheKind == FicheKind.bebe;
    final isDecede = _ficheKind == FicheKind.decede;
    final isMarie = _ficheKind == FicheKind.marie;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _section('Type de fiche *', [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final kind in FicheKind.values)
                ChoiceChip(
                  label: Text(switch (kind) {
                    FicheKind.personne => 'Personne vivante',
                    FicheKind.bebe => 'Bébé',
                    FicheKind.decede => 'Décédé(e)',
                    FicheKind.marie => 'Marié(e)',
                  }),
                  selected: _ficheKind == kind,
                  onSelected: (sel) {
                    if (!sel) return;
                    setState(() {
                      _ficheKind = kind;
                      if (kind == FicheKind.marie) {
                        _etatCivil = 'MARIE';
                        _aConjoint = true;
                      }
                    });
                  },
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            isBebe
                ? 'Identité bébé obligatoire (nom, sexe, naissance, mère ou père).'
                : isDecede
                    ? 'Identité décédé obligatoire (nom, prénom, naissance, décès).'
                    : isMarie
                        ? 'Identité marié(e) obligatoire + conjoint(e) (nom et prénom).'
                        : 'Identité personne obligatoire (nom, prénom, sexe, naissance).',
            style: const TextStyle(fontSize: 12, color: Color(0xFF5A6A85), height: 1.3),
          ),
        ]),
        _section('1. Identité — $_ficheKindLabel', [
          TextFormField(
            controller: _nom,
            decoration: _dec(
              isBebe ? 'Nom du bébé * (ou « Enfant de … »)' : 'Nom de la personne *',
            ),
            textCapitalization: TextCapitalization.characters,
          ),
          const SizedBox(height: 10),
          TextFormField(
            controller: _postnom,
            decoration: _dec('Post-nom'),
            textCapitalization: TextCapitalization.characters,
          ),
          const SizedBox(height: 10),
          TextFormField(
            controller: _prenom,
            decoration: _dec(isBebe ? 'Prénom' : 'Prénom *'),
            textCapitalization: TextCapitalization.words,
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _sex,
                  decoration: _dec('Sexe *'),
                  items: const [
                    DropdownMenuItem(value: 'M', child: Text('Masculin')),
                    DropdownMenuItem(value: 'F', child: Text('Féminin')),
                  ],
                  onChanged: (v) => setState(() => _sex = v ?? 'M'),
                ),
              ),
              if (!isBebe) ...[
                const SizedBox(width: 10),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: isMarie ? 'MARIE' : _etatCivil,
                    decoration: _dec('État-civil'),
                    items: [
                      for (final o in _etatCivilOptions)
                        DropdownMenuItem(value: o.$1, child: Text(o.$2)),
                    ],
                    onChanged: isMarie
                        ? null
                        : (v) => setState(() {
                              _etatCivil = v ?? 'CELIBATAIRE';
                              if (_etatCivil == 'MARIE') _aConjoint = true;
                            }),
                  ),
                ),
              ],
            ],
          ),
          if (!isBebe) ...[
            const SizedBox(height: 10),
            TextFormField(controller: _profession, decoration: _dec('Profession')),
          ],
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
            readOnly: false,
            decoration: _dec('Date de naissance *', hint: 'AAAA-MM-JJ ou calendrier').copyWith(
              suffixIcon: IconButton(
                icon: const Icon(Icons.calendar_today),
                onPressed: _pickDob,
              ),
            ),
          ),
          if (isDecede) ...[
            const SizedBox(height: 10),
            TextFormField(
              controller: _dateDeces,
              readOnly: false,
              decoration: _dec('Date de décès *', hint: 'AAAA-MM-JJ ou calendrier').copyWith(
                suffixIcon: IconButton(
                  icon: const Icon(Icons.event_busy),
                  onPressed: _pickDeathDate,
                ),
              ),
            ),
          ],
          const SizedBox(height: 10),
          TextFormField(
            controller: _hopitalNaissance,
            decoration: _dec(isBebe ? 'Lieu / hôpital de naissance' : 'Hôpital de naissance'),
          ),
          if (!isBebe) ...[
            const SizedBox(height: 10),
            TextFormField(
              controller: _langues,
              decoration: _dec('Langues parlées', hint: 'Français, Lingala…'),
            ),
          ],
          const SizedBox(height: 10),
          TextFormField(
            controller: _pere,
            decoration: _dec(isBebe ? 'Nom du père * (si pas de mère)' : 'Nom du père'),
          ),
          const SizedBox(height: 10),
          TextFormField(
            controller: _mere,
            decoration: _dec(isBebe ? 'Nom de la mère * (si pas de père)' : 'Nom de la mère'),
          ),
          if (!isBebe) ...[
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
          ],
        ]),
        if (isMarie)
          _section('1c. Conjoint(e) *', [
            const Text(
              'Obligatoire pour une fiche marié(e). Recherchez une fiche ou saisissez nom et prénom.',
              style: TextStyle(fontSize: 12, color: Color(0xFF5A6A85), height: 1.3),
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _conjointSearch,
              decoration: _dec('Rechercher conjoint(e) enregistré(e)'),
              onChanged: _searchConjoint,
            ),
            if (_conjointSuggestions.isNotEmpty)
              ..._conjointSuggestions.map(
                (h) => ListTile(
                  dense: true,
                  title: Text('${h['nom'] ?? ''} ${h['prenom'] ?? ''}'.trim()),
                  subtitle: Text(h['date_naissance'] ?? ''),
                  onTap: () => _applyConjointHit(h),
                ),
              ),
            const SizedBox(height: 8),
            _memberFields(_conjoint, showTelephone: true, locked: _conjointLocked),
          ]),
        if (!isBebe) _section('1b. Adresse actuelle', [
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
        if (AppConfig.isFingerprintDevice)
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF4E5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE6A23C).withValues(alpha: 0.45)),
            ),
            child: const Text(
              'MorphoTablet — commencez par les empreintes (capteur optique en haut à gauche), puis la photo.',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, height: 1.35),
            ),
          ),
        _section('3. Biométrie', [
          if (AppConfig.isFingerprintDevice) ...[
            FingerprintCaptureWidget(
              label: 'Empreinte main gauche',
              hand: 'gauche',
              initialRef: _empreinteGauche.text.trim().isEmpty ? null : _empreinteGauche.text.trim(),
              onCaptured: (ref) => setState(() {
                _empreinteGauche.text = ref;
                _fingerprintRef = ref;
              }),
            ),
            FingerprintCaptureWidget(
              label: 'Empreinte main droite',
              hand: 'droite',
              initialRef: _empreinteDroite.text.trim().isEmpty ? null : _empreinteDroite.text.trim(),
              onCaptured: (ref) => setState(() {
                _empreinteDroite.text = ref;
                _fingerprintRef ??= ref;
              }),
            ),
            const SizedBox(height: 8),
            PhotoCaptureWidget(
              initialRef: _photoRef,
              onCaptured: (ref) => setState(() => _photoRef = ref),
            ),
          ] else ...[
          PhotoCaptureWidget(
            initialRef: _photoRef,
            onCaptured: (ref) => setState(() => _photoRef = ref),
          ),
          const SizedBox(height: 8),
          FingerprintCaptureWidget(
            label: 'Empreinte main gauche',
            hand: 'gauche',
            initialRef: _empreinteGauche.text.trim().isEmpty ? null : _empreinteGauche.text.trim(),
            onCaptured: (ref) => setState(() {
              _empreinteGauche.text = ref;
              _fingerprintRef = ref;
            }),
          ),
          FingerprintCaptureWidget(
            label: 'Empreinte main droite',
            hand: 'droite',
            initialRef: _empreinteDroite.text.trim().isEmpty ? null : _empreinteDroite.text.trim(),
            onCaptured: (ref) => setState(() {
              _empreinteDroite.text = ref;
              _fingerprintRef ??= ref;
            }),
          ),
          ],
          IrisCaptureWidget(
            initialRef: _iris.text.trim().isEmpty ? null : _iris.text.trim(),
            onCaptured: (ref) => setState(() => _iris.text = ref),
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
                color: const Color(0xFFEAF3FF),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF007FFF).withValues(alpha: 0.25)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Étape $_step / 7 — ${_stepTitles[_step - 1]}',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Identité obligatoire — le reste peut être complété plus tard.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF5A6A85), height: 1.3),
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: LinearProgressIndicator(
                      value: _step / 7,
                      minHeight: 6,
                      backgroundColor: const Color(0xFFE6EBF2),
                      color: const Color(0xFF007FFF),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (_step == 1) _buildIdentityBlock(),
            if (_step == 2) _buildOriginBlock(),
            if (_step == 3) _buildBioBlock(),
            if (_step == 4)
              _section('4. Études faites', [
                _buildEtudesBlock(),
              ]),
            if (_step == 5)
              _section('5. Expérience professionnelle', [
                _buildExperienceBlock(),
              ]),
            if (_step == 6)
              _section('6. Identité administrative', [
                _buildAdminBlock(),
              ]),
            if (_step == 7)
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

  Widget _buildExperienceBlock() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DropdownButtonFormField<String>(
          value: _expStatut.isEmpty ? null : _expStatut,
          decoration: _dec('Statut professionnel'),
          items: [
            for (final s in ExperienceData.statuts.where((e) => e.$1.isNotEmpty))
              DropdownMenuItem(value: s.$1, child: Text(s.$2)),
          ],
          onChanged: (v) => setState(() => _expStatut = v ?? ''),
        ),
        const SizedBox(height: 10),
        TextFormField(controller: _expPoste, decoration: _dec('Poste / fonction actuelle')),
        const SizedBox(height: 10),
        TextFormField(controller: _expEmployeur, decoration: _dec('Employeur / structure')),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          value: _expSecteur.isEmpty ? null : _expSecteur,
          decoration: _dec("Secteur d'activité"),
          items: [
            for (final s in ExperienceData.secteurs.where((e) => e.isNotEmpty))
              DropdownMenuItem(value: s, child: Text(s)),
          ],
          onChanged: (v) => setState(() => _expSecteur = v ?? ''),
        ),
        const SizedBox(height: 10),
        TextFormField(
          controller: _expAnnees,
          decoration: _dec("Années d'expérience", hint: 'Ex. 5'),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Text(
                'Emplois précédents (${_emplois.length})',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
            TextButton.icon(
              onPressed: () => setState(() => _emplois.add(_JobEditors(EmploiExperience()))),
              icon: const Icon(Icons.add),
              label: const Text('Ajouter'),
            ),
          ],
        ),
        for (var i = 0; i < _emplois.length; i++) ...[
          const SizedBox(height: 8),
          _memberCard(
            title: 'Emploi ${i + 1}',
            onRemove: () => setState(() {
              _emplois[i].dispose();
              _emplois.removeAt(i);
            }),
            child: _jobFields(_emplois[i]),
          ),
        ],
        const SizedBox(height: 12),
        TextFormField(
          controller: _expRemarques,
          decoration: _dec('Remarques professionnelles'),
          maxLines: 3,
        ),
      ],
    );
  }

  Widget _jobFields(_JobEditors m) {
    return Column(
      children: [
        TextFormField(controller: m.poste, decoration: _dec('Poste')),
        const SizedBox(height: 8),
        TextFormField(controller: m.employeur, decoration: _dec('Employeur')),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          value: m.secteur.isEmpty ? null : m.secteur,
          decoration: _dec('Secteur'),
          items: [
            for (final s in ExperienceData.secteurs.where((e) => e.isNotEmpty))
              DropdownMenuItem(value: s, child: Text(s)),
          ],
          onChanged: (v) => setState(() => m.secteur = v ?? ''),
        ),
        const SizedBox(height: 8),
        TextFormField(controller: m.ville, decoration: _dec('Ville')),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextFormField(controller: m.anneeDebut, decoration: _dec('Début')),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextFormField(
                controller: m.anneeFin,
                enabled: !m.enCours,
                decoration: _dec('Fin'),
              ),
            ),
          ],
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Emploi encore en cours'),
          value: m.enCours,
          onChanged: (v) => setState(() {
            m.enCours = v;
            if (v) m.anneeFin.clear();
          }),
        ),
        TextFormField(
          controller: m.description,
          decoration: _dec('Description / tâches'),
          maxLines: 2,
        ),
      ],
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
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Text(
                'Formations professionnelles (${_formationsPro.length})',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
            TextButton.icon(
              onPressed: () =>
                  setState(() => _formationsPro.add(_ProEditors(FormationProfessionnelle()))),
              icon: const Icon(Icons.add),
              label: const Text('Ajouter'),
            ),
          ],
        ),
        for (var i = 0; i < _formationsPro.length; i++) ...[
          const SizedBox(height: 8),
          _memberCard(
            title: 'Formation pro ${i + 1}',
            onRemove: () => setState(() {
              _formationsPro[i].dispose();
              _formationsPro.removeAt(i);
            }),
            child: _proFields(_formationsPro[i]),
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

  Widget _proFields(_ProEditors m) {
    return Column(
      children: [
        TextFormField(controller: m.etablissement, decoration: _dec('Centre / établissement')),
        const SizedBox(height: 8),
        TextFormField(controller: m.metier, decoration: _dec('Métier / spécialité')),
        const SizedBox(height: 8),
        TextFormField(controller: m.certificat, decoration: _dec('Certificat / diplôme')),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: TextFormField(controller: m.duree, decoration: _dec('Durée'))),
            const SizedBox(width: 10),
            Expanded(
              child: TextFormField(controller: m.anneeObtention, decoration: _dec('Année')),
            ),
          ],
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          value: m.statut.isEmpty ? null : m.statut,
          decoration: _dec('Statut'),
          items: const [
            DropdownMenuItem(value: 'TERMINE', child: Text('Terminé')),
            DropdownMenuItem(value: 'EN_COURS', child: Text('En cours')),
            DropdownMenuItem(value: 'ABANDONNE', child: Text('Abandonné')),
          ],
          onChanged: (v) => setState(() => m.statut = v ?? ''),
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
    final needConjoint = _aConjoint || _etatCivil == 'MARIE';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DropdownButtonFormField<bool>(
          value: needConjoint,
          decoration: _dec('A un conjoint / vit en couple / marié(e)'),
          items: const [
            DropdownMenuItem(value: false, child: Text('Non')),
            DropdownMenuItem(value: true, child: Text('Oui')),
          ],
          onChanged: _etatCivil == 'MARIE'
              ? null
              : (v) => setState(() {
                    _aConjoint = v ?? false;
                    if (!_aConjoint) {
                      _conjointLocked = false;
                      _conjoint.personId = null;
                    }
                  }),
        ),
        if (_etatCivil == 'MARIE')
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text(
              'État civil = Marié(e) : conjoint(e) obligatoire via recherche.',
              style: TextStyle(fontSize: 12, color: Color(0xFF5A6A85)),
            ),
          ),
        if (needConjoint) ...[
          const SizedBox(height: 12),
          Text('Lier une personne déjà enregistrée (obligatoire)',
              style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 6),
          if (_conjointLocked)
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF6EE7B7)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${_conjoint.nom.text} ${_conjoint.postnom.text} ${_conjoint.prenom.text}'.trim(),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  TextButton(
                    onPressed: () => setState(() {
                      _conjointLocked = false;
                      _conjoint.personId = null;
                      _conjoint.nom.clear();
                      _conjoint.postnom.clear();
                      _conjoint.prenom.clear();
                      _conjoint.sexe = '';
                      _conjoint.dateNaissance.clear();
                      _conjoint.telephone.clear();
                    }),
                    child: const Text('Changer'),
                  ),
                ],
              ),
            )
          else ...[
            TextFormField(
              controller: _conjointSearch,
              decoration: _dec('Rechercher une personne…', hint: 'Nom, post-nom, prénom'),
              onChanged: _searchConjoint,
            ),
            if (_conjointSuggestions.isNotEmpty)
              ..._conjointSuggestions.map(
                (h) => ListTile(
                  dense: true,
                  title: Text('${h['nom']} ${h['postnom']} ${h['prenom']}'.trim()),
                  subtitle: Text('${h['sexe']} · ${h['date_naissance']}'),
                  onTap: () => _applyConjointHit(h),
                ),
              ),
            if (_conjointSearch.text.trim().isNotEmpty && _conjointSuggestions.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Text(
                  'Aucun résultat local — enregistrez d’abord la personne, puis reliez-la.',
                  style: TextStyle(fontSize: 12, color: Color(0xFFB45309)),
                ),
              ),
          ],
          const SizedBox(height: 10),
          _memberFields(_conjoint, showTelephone: true, locked: _conjointLocked),
        ],
        const SizedBox(height: 16),
        Text("Nombre d'enfants (0–5)", style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: [
            for (final n in [0, 1, 2, 3, 4, 5])
              ChoiceChip(
                label: Text('$n'),
                selected: _nombreEnfants == n,
                onSelected: (_) => _setNombreEnfants(n),
              ),
          ],
        ),
        if (_nombreEnfants >= 5)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => _setNombreEnfants(_enfants.length + 1),
              icon: const Icon(Icons.person_add_alt_1),
              label: const Text('Ajouter un enfant (>5)'),
            ),
          ),
        for (var i = 0; i < _enfants.length; i++) ...[
          const SizedBox(height: 8),
          _memberCard(
            title: 'Enfant ${i + 1}',
            onRemove: i >= 5 ? () => _setNombreEnfants(_enfants.length - 1) : null,
            child: _memberFields(_enfants[i], showTelephone: true, showLien: true, showCote: true),
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
        const Text(
          'Petit frère, sœur, neveu, travailleur / employé(e)… Indiquez le côté homme/femme.',
          style: TextStyle(fontSize: 12, color: Color(0xFF5A6A85)),
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
            child: _memberFields(_charges[i], showTelephone: true, showLien: true, showCote: true),
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
    VoidCallback? onRemove,
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
              if (onRemove != null)
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
    bool showCote = false,
    bool locked = false,
  }) {
    return Column(
      children: [
        if (showCote) ...[
          DropdownButtonFormField<String>(
            value: m.cote.isEmpty ? null : m.cote,
            decoration: _dec('Côté famille'),
            items: [
              for (final c in FamilyMember.cotes.where((e) => e.$1.isNotEmpty))
                DropdownMenuItem(value: c.$1, child: Text(c.$2)),
            ],
            onChanged: (v) => setState(() => m.cote = v ?? ''),
          ),
          const SizedBox(height: 8),
        ],
        if (showLien) ...[
          DropdownButtonFormField<String>(
            value: m.lien.isEmpty ? null : m.lien,
            decoration: _dec('Lien de parenté'),
            items: [
              for (final l in FamilyMember.liens.where((e) => e.isNotEmpty))
                DropdownMenuItem(value: l, child: Text(l)),
            ],
            onChanged: (v) => setState(() => m.lien = v ?? ''),
          ),
          const SizedBox(height: 8),
        ],
        TextFormField(
          controller: m.nom,
          readOnly: locked,
          decoration: _dec('Nom'),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: m.postnom,
          readOnly: locked,
          decoration: _dec('Post-nom'),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: m.prenom,
          readOnly: locked,
          decoration: _dec('Prénom'),
        ),
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
                onChanged: locked ? null : (v) => setState(() => m.sexe = v ?? ''),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextFormField(
                controller: m.dateNaissance,
                readOnly: locked,
                decoration: _dec('Date naissance', hint: 'AAAA-MM-JJ'),
              ),
            ),
          ],
        ),
        if (showTelephone) ...[
          const SizedBox(height: 8),
          TextFormField(controller: m.telephone, decoration: _dec('Téléphone')),
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
        sexe = m.sexe,
        vitAvec = m.vitAvec,
        lien = m.lien,
        cote = m.cote,
        personId = m.personId;

  final TextEditingController nom;
  final TextEditingController postnom;
  final TextEditingController prenom;
  final TextEditingController dateNaissance;
  final TextEditingController telephone;
  String sexe;
  bool vitAvec;
  String lien;
  String cote;
  String? personId;

  FamilyMember snapshot() => FamilyMember(
        nom: nom.text,
        postnom: postnom.text,
        prenom: prenom.text,
        sexe: sexe,
        dateNaissance: dateNaissance.text.trim(),
        telephone: telephone.text,
        vitAvec: vitAvec,
        lien: lien,
        cote: cote,
        personId: personId,
      );

  void dispose() {
    nom.dispose();
    postnom.dispose();
    prenom.dispose();
    dateNaissance.dispose();
    telephone.dispose();
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

class _ProEditors {
  _ProEditors(FormationProfessionnelle m)
      : etablissement = TextEditingController(text: m.etablissement),
        metier = TextEditingController(text: m.metier),
        certificat = TextEditingController(text: m.certificat),
        anneeObtention = TextEditingController(text: m.anneeObtention),
        duree = TextEditingController(text: m.duree),
        statut = m.statut;

  final TextEditingController etablissement;
  final TextEditingController metier;
  final TextEditingController certificat;
  final TextEditingController anneeObtention;
  final TextEditingController duree;
  String statut;

  FormationProfessionnelle snapshot() => FormationProfessionnelle(
        etablissement: etablissement.text,
        metier: metier.text,
        certificat: certificat.text,
        anneeObtention: anneeObtention.text,
        duree: duree.text,
        statut: statut,
      );

  void dispose() {
    etablissement.dispose();
    metier.dispose();
    certificat.dispose();
    anneeObtention.dispose();
    duree.dispose();
  }
}

class _JobEditors {
  _JobEditors(EmploiExperience m)
      : employeur = TextEditingController(text: m.employeur),
        poste = TextEditingController(text: m.poste),
        ville = TextEditingController(text: m.ville),
        anneeDebut = TextEditingController(text: m.anneeDebut),
        anneeFin = TextEditingController(text: m.anneeFin),
        description = TextEditingController(text: m.description),
        secteur = m.secteur,
        enCours = m.enCours;

  final TextEditingController employeur;
  final TextEditingController poste;
  final TextEditingController ville;
  final TextEditingController anneeDebut;
  final TextEditingController anneeFin;
  final TextEditingController description;
  String secteur;
  bool enCours;

  EmploiExperience snapshot() => EmploiExperience(
        employeur: employeur.text,
        poste: poste.text,
        secteur: secteur,
        ville: ville.text,
        anneeDebut: anneeDebut.text,
        anneeFin: anneeFin.text,
        enCours: enCours,
        description: description.text,
      );

  void dispose() {
    employeur.dispose();
    poste.dispose();
    ville.dispose();
    anneeDebut.dispose();
    anneeFin.dispose();
    description.dispose();
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
