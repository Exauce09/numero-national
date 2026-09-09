class EtablissementScolaire {
  EtablissementScolaire({
    this.etablissement = '',
    this.niveau = '',
    this.anneeDebut = '',
    this.anneeFin = '',
    this.diplome = '',
    this.ville = '',
  });

  String etablissement;
  String niveau;
  String anneeDebut;
  String anneeFin;
  String diplome;
  String ville;

  Map<String, dynamic> toJson() => {
        'etablissement': etablissement,
        'niveau': niveau,
        'annee_debut': anneeDebut,
        'annee_fin': anneeFin,
        'diplome': diplome,
        'ville': ville,
      };

  static EtablissementScolaire fromJson(Map<String, dynamic>? raw) {
    if (raw == null) return EtablissementScolaire();
    return EtablissementScolaire(
      etablissement: raw['etablissement']?.toString() ?? '',
      niveau: raw['niveau']?.toString() ?? '',
      anneeDebut: raw['annee_debut']?.toString() ?? '',
      anneeFin: raw['annee_fin']?.toString() ?? '',
      diplome: raw['diplome']?.toString() ?? '',
      ville: raw['ville']?.toString() ?? '',
    );
  }
}

class FormationUniversitaire {
  FormationUniversitaire({
    this.etablissement = '',
    this.filiere = '',
    this.diplome = '',
    this.anneeObtention = '',
    this.statut = '',
  });

  String etablissement;
  String filiere;
  String diplome;
  String anneeObtention;
  String statut;

  Map<String, dynamic> toJson() => {
        'etablissement': etablissement,
        'filiere': filiere,
        'diplome': diplome,
        'annee_obtention': anneeObtention,
        'statut': statut,
      };

  static FormationUniversitaire fromJson(Map<String, dynamic>? raw) {
    if (raw == null) return FormationUniversitaire();
    return FormationUniversitaire(
      etablissement: raw['etablissement']?.toString() ?? '',
      filiere: raw['filiere']?.toString() ?? '',
      diplome: raw['diplome']?.toString() ?? '',
      anneeObtention: raw['annee_obtention']?.toString() ?? '',
      statut: raw['statut']?.toString() ?? '',
    );
  }
}

class FormationProfessionnelle {
  FormationProfessionnelle({
    this.etablissement = '',
    this.metier = '',
    this.certificat = '',
    this.anneeObtention = '',
    this.duree = '',
    this.statut = '',
  });

  String etablissement;
  String metier;
  String certificat;
  String anneeObtention;
  String duree;
  String statut;

  Map<String, dynamic> toJson() => {
        'etablissement': etablissement,
        'metier': metier,
        'certificat': certificat,
        'annee_obtention': anneeObtention,
        'duree': duree,
        'statut': statut,
      };

  static FormationProfessionnelle fromJson(Map<String, dynamic>? raw) {
    if (raw == null) return FormationProfessionnelle();
    return FormationProfessionnelle(
      etablissement: raw['etablissement']?.toString() ?? '',
      metier: raw['metier']?.toString() ?? '',
      certificat: raw['certificat']?.toString() ?? '',
      anneeObtention: raw['annee_obtention']?.toString() ?? '',
      duree: raw['duree']?.toString() ?? '',
      statut: raw['statut']?.toString() ?? '',
    );
  }
}

class EtudesData {
  EtudesData({
    this.saitLire = '',
    this.saitEcrire = '',
    this.niveauAtteint = '',
    this.anneeFinEtudes = '',
    List<EtablissementScolaire>? etablissements,
    List<FormationUniversitaire>? formationsUniversitaires,
    List<FormationProfessionnelle>? formationsProfessionnelles,
    this.remarques = '',
  })  : etablissements = etablissements ?? <EtablissementScolaire>[],
        formationsUniversitaires =
            formationsUniversitaires ?? <FormationUniversitaire>[],
        formationsProfessionnelles =
            formationsProfessionnelles ?? <FormationProfessionnelle>[];

  String saitLire;
  String saitEcrire;
  String niveauAtteint;
  String anneeFinEtudes;
  List<EtablissementScolaire> etablissements;
  List<FormationUniversitaire> formationsUniversitaires;
  List<FormationProfessionnelle> formationsProfessionnelles;
  String remarques;

  static const niveaux = <(String, String)>[
    ('', '—'),
    ('AUCUN', 'Aucun'),
    ('PRIMAIRE', 'Primaire'),
    ('SECONDAIRE', 'Secondaire'),
    ('TECHNIQUE', 'Technique / professionnel'),
    ('UNIVERSITAIRE', 'Universitaire'),
    ('POST_UNIV', 'Post-universitaire'),
  ];

  static const niveauxScolaires = <String>[
    '',
    'Maternelle',
    'Primaire',
    'Secondaire cycle 1',
    'Secondaire cycle 2',
    'Humanités',
    'Technique',
    'Professionnel',
  ];

  static const diplomesUniv = <String>[
    '',
    'Certificat',
    'Graduat',
    'Licence',
    'Master',
    'Doctorat',
    'Autre',
  ];

  Map<String, dynamic> toJson() => {
        'sait_lire': saitLire,
        'sait_ecrire': saitEcrire,
        'niveau_atteint': niveauAtteint,
        'annee_fin_etudes': anneeFinEtudes,
        'etablissements': etablissements.map((e) => e.toJson()).toList(),
        'formations_universitaires':
            formationsUniversitaires.map((e) => e.toJson()).toList(),
        'formations_professionnelles':
            formationsProfessionnelles.map((e) => e.toJson()).toList(),
        'remarques': remarques,
      };

  String formatScolaire() {
    final lines = <String>[];
    String? niveau;
    for (final n in niveaux) {
      if (n.$1 == niveauAtteint) {
        niveau = n.$2;
        break;
      }
    }
    if (niveau != null && niveau != '—') lines.add('Niveau atteint : $niveau');
    if (saitLire.isNotEmpty) lines.add('Sait lire : $saitLire');
    if (saitEcrire.isNotEmpty) lines.add('Sait écrire : $saitEcrire');
    if (anneeFinEtudes.trim().isNotEmpty) {
      lines.add("Année fin d'études : ${anneeFinEtudes.trim()}");
    }
    if (etablissements.isNotEmpty) {
      lines.add('Établissements (${etablissements.length}) :');
      for (var i = 0; i < etablissements.length; i++) {
        final e = etablissements[i];
        final bits = [
          e.etablissement.trim().isEmpty ? '—' : e.etablissement.trim(),
          if (e.niveau.trim().isNotEmpty) e.niveau.trim(),
          if (e.ville.trim().isNotEmpty) e.ville.trim(),
          [e.anneeDebut, e.anneeFin].where((x) => x.trim().isNotEmpty).join('–'),
          if (e.diplome.trim().isNotEmpty) 'diplôme ${e.diplome.trim()}',
        ].where((x) => x.isNotEmpty);
        lines.add('  ${i + 1}. ${bits.join(', ')}');
      }
    }
    if (remarques.trim().isNotEmpty) lines.add('Remarques : ${remarques.trim()}');
    return lines.join('\n');
  }

  String formatUniversitaire() {
    final lines = <String>[];
    if (formationsUniversitaires.isNotEmpty) {
      lines.add('Formations universitaires (${formationsUniversitaires.length}) :');
      for (var i = 0; i < formationsUniversitaires.length; i++) {
        final f = formationsUniversitaires[i];
        final bits = [
          f.etablissement.trim().isEmpty ? '—' : f.etablissement.trim(),
          if (f.filiere.trim().isNotEmpty) f.filiere.trim(),
          if (f.diplome.trim().isNotEmpty) f.diplome.trim(),
          if (f.anneeObtention.trim().isNotEmpty) f.anneeObtention.trim(),
          if (f.statut.isNotEmpty) f.statut,
        ];
        lines.add('  ${i + 1}. ${bits.join(', ')}');
      }
    }
    if (formationsProfessionnelles.isNotEmpty) {
      lines.add('Formations professionnelles (${formationsProfessionnelles.length}) :');
      for (var i = 0; i < formationsProfessionnelles.length; i++) {
        final f = formationsProfessionnelles[i];
        final bits = [
          f.etablissement.trim().isEmpty ? '—' : f.etablissement.trim(),
          if (f.metier.trim().isNotEmpty) f.metier.trim(),
          if (f.certificat.trim().isNotEmpty) f.certificat.trim(),
          if (f.duree.trim().isNotEmpty) 'durée ${f.duree.trim()}',
          if (f.anneeObtention.trim().isNotEmpty) f.anneeObtention.trim(),
          if (f.statut.isNotEmpty) f.statut,
        ];
        lines.add('  ${i + 1}. ${bits.join(', ')}');
      }
    }
    return lines.join('\n');
  }

  static EtudesData parse(Object? raw) {
    if (raw == null) return EtudesData();
    if (raw is String) {
      final t = raw.trim();
      return t.isEmpty ? EtudesData() : EtudesData(remarques: t);
    }
    if (raw is! Map) return EtudesData();
    final m = Map<String, dynamic>.from(raw);
    final etabs = m['etablissements'];
    final univs = m['formations_universitaires'];
    final pros = m['formations_professionnelles'];
    return EtudesData(
      saitLire: m['sait_lire']?.toString() ?? '',
      saitEcrire: m['sait_ecrire']?.toString() ?? '',
      niveauAtteint: m['niveau_atteint']?.toString() ?? '',
      anneeFinEtudes: m['annee_fin_etudes']?.toString() ?? '',
      etablissements: etabs is List
          ? etabs
              .whereType<Map>()
              .map((e) => EtablissementScolaire.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : <EtablissementScolaire>[],
      formationsUniversitaires: univs is List
          ? univs
              .whereType<Map>()
              .map((e) => FormationUniversitaire.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : <FormationUniversitaire>[],
      formationsProfessionnelles: pros is List
          ? pros
              .whereType<Map>()
              .map((e) => FormationProfessionnelle.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : <FormationProfessionnelle>[],
      remarques: m['remarques']?.toString() ?? '',
    );
  }
}

class DocumentAdmin {
  DocumentAdmin({
    this.type = '',
    this.typeAutre = '',
    this.numero = '',
    this.autorite = '',
    this.dateEmission = '',
    this.dateExpiration = '',
    this.lieuEmission = '',
  });

  String type;
  String typeAutre;
  String numero;
  String autorite;
  String dateEmission;
  String dateExpiration;
  String lieuEmission;

  Map<String, dynamic> toJson() => {
        'type': type,
        'type_autre': typeAutre,
        'numero': numero,
        'autorite': autorite,
        'date_emission': dateEmission,
        'date_expiration': dateExpiration,
        'lieu_emission': lieuEmission,
      };

  static DocumentAdmin fromJson(Map<String, dynamic>? raw) {
    if (raw == null) return DocumentAdmin();
    return DocumentAdmin(
      type: raw['type']?.toString() ?? '',
      typeAutre: raw['type_autre']?.toString() ?? '',
      numero: raw['numero']?.toString() ?? '',
      autorite: raw['autorite']?.toString() ?? '',
      dateEmission: raw['date_emission']?.toString() ?? '',
      dateExpiration: raw['date_expiration']?.toString() ?? '',
      lieuEmission: raw['lieu_emission']?.toString() ?? '',
    );
  }
}

class IdentiteAdminData {
  IdentiteAdminData({
    List<DocumentAdmin>? documents,
    this.numeroDossier = '',
    this.bureauReference = '',
    this.dateOuvertureDossier = '',
    this.agentReference = '',
    this.remarques = '',
  }) : documents = documents ?? <DocumentAdmin>[];

  List<DocumentAdmin> documents;
  String numeroDossier;
  String bureauReference;
  String dateOuvertureDossier;
  String agentReference;
  String remarques;

  static const typesDocument = <(String, String)>[
    ('', '—'),
    ('CARTE_ELECTEUR', "Carte d'électeur"),
    ('PASSEPORT', 'Passeport'),
    ('PERMIS_CONDUIRE', 'Permis de conduire'),
    ('CARTE_SERVICE', 'Carte de service / professionnelle'),
    ('ACTE_NAISSANCE', 'Acte de naissance'),
    ('CARTE_SEJOUR', 'Carte de séjour'),
    ('AUTRE', 'Autre'),
  ];

  Map<String, dynamic> toJson() => {
        'documents': documents.map((e) => e.toJson()).toList(),
        'numero_dossier': numeroDossier,
        'bureau_reference': bureauReference,
        'date_ouverture_dossier': dateOuvertureDossier,
        'agent_reference': agentReference,
        'remarques': remarques,
      };

  String formatSummary() {
    final lines = <String>[];
    if (numeroDossier.trim().isNotEmpty) {
      lines.add('N° dossier : ${numeroDossier.trim()}');
    }
    if (bureauReference.trim().isNotEmpty) {
      lines.add('Bureau : ${bureauReference.trim()}');
    }
    if (dateOuvertureDossier.isNotEmpty) {
      lines.add('Ouverture : $dateOuvertureDossier');
    }
    if (agentReference.trim().isNotEmpty) {
      lines.add('Réf. agent : ${agentReference.trim()}');
    }
    if (documents.isNotEmpty) {
      lines.add('Pièces (${documents.length}) :');
      for (var i = 0; i < documents.length; i++) {
        final d = documents[i];
        String typeLabel = d.type;
        if (d.type == 'AUTRE') {
          typeLabel = d.typeAutre.trim().isEmpty ? 'Autre' : d.typeAutre.trim();
        } else {
          for (final t in typesDocument) {
            if (t.$1 == d.type) {
              typeLabel = t.$2;
              break;
            }
          }
        }
        final bits = [
          typeLabel,
          if (d.numero.trim().isNotEmpty) 'n° ${d.numero.trim()}',
          if (d.autorite.trim().isNotEmpty) d.autorite.trim(),
          if (d.dateEmission.isNotEmpty) 'émis ${d.dateEmission}',
          if (d.dateExpiration.isNotEmpty) 'exp. ${d.dateExpiration}',
          if (d.lieuEmission.trim().isNotEmpty) d.lieuEmission.trim(),
        ];
        lines.add('  ${i + 1}. ${bits.join(', ')}');
      }
    }
    if (remarques.trim().isNotEmpty) lines.add('Remarques : ${remarques.trim()}');
    return lines.join('\n');
  }

  static IdentiteAdminData parse(Object? raw) {
    if (raw == null) return IdentiteAdminData();
    if (raw is String) {
      final t = raw.trim();
      return t.isEmpty ? IdentiteAdminData() : IdentiteAdminData(numeroDossier: t);
    }
    if (raw is! Map) return IdentiteAdminData();
    final m = Map<String, dynamic>.from(raw);
    final docs = m['documents'];
    return IdentiteAdminData(
      documents: docs is List
          ? docs
              .whereType<Map>()
              .map((e) => DocumentAdmin.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : <DocumentAdmin>[],
      numeroDossier: m['numero_dossier']?.toString() ?? '',
      bureauReference: m['bureau_reference']?.toString() ?? '',
      dateOuvertureDossier: m['date_ouverture_dossier']?.toString() ?? '',
      agentReference: m['agent_reference']?.toString() ?? '',
      remarques: m['remarques']?.toString() ?? '',
    );
  }
}
