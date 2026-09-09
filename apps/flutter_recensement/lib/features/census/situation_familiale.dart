import 'dart:convert';

class FamilyMember {
  FamilyMember({
    this.nom = '',
    this.postnom = '',
    this.prenom = '',
    this.sexe = '',
    this.dateNaissance = '',
    this.telephone = '',
    this.vitAvec = true,
    this.lien = '',
    this.cote = '',
    this.personId,
  });

  String nom;
  String postnom;
  String prenom;
  String sexe;
  String dateNaissance;
  String telephone;
  bool vitAvec;
  String lien;
  String cote;
  String? personId;

  static const cotes = <(String, String)>[
    ('', '—'),
    ('HOMME', 'Côté homme (époux)'),
    ('FEMME', 'Côté femme (épouse)'),
    ('PERSONNE', 'Côté de la personne recensée'),
  ];

  static const liens = <String>[
    '',
    'Enfant',
    'Petit frère',
    'Petite sœur',
    'Frère',
    'Sœur',
    'Neveu',
    'Nièce',
    'Oncle',
    'Tante',
    'Cousin',
    'Cousine',
    'Beau-père',
    'Belle-mère',
    'Beau-frère',
    'Belle-sœur',
    'Petit-fils',
    'Petite-fille',
    'Grand-père',
    'Grand-mère',
    'Travailleur / employé(e)',
    'Autre personne à charge',
  ];

  Map<String, dynamic> toJson() => {
        'nom': nom,
        'postnom': postnom,
        'prenom': prenom,
        'sexe': sexe,
        'date_naissance': dateNaissance,
        'telephone': telephone,
        'vit_avec': vitAvec,
        'lien': lien,
        'cote': cote,
        'person_id': personId,
      };

  static FamilyMember fromJson(Map<String, dynamic>? raw, {String lien = ''}) {
    if (raw == null) return FamilyMember(lien: lien);
    return FamilyMember(
      nom: raw['nom']?.toString() ?? '',
      postnom: raw['postnom']?.toString() ?? '',
      prenom: raw['prenom']?.toString() ?? '',
      sexe: raw['sexe']?.toString() ?? '',
      dateNaissance: raw['date_naissance']?.toString() ?? '',
      telephone: raw['telephone']?.toString() ?? '',
      vitAvec: raw['vit_avec'] != false,
      lien: raw['lien']?.toString() ?? lien,
      cote: raw['cote']?.toString() ?? '',
      personId: raw['person_id']?.toString(),
    );
  }

  String get label {
    final name = [nom, postnom, prenom].map((e) => e.trim()).where((e) => e.isNotEmpty).join(' ');
    final bits = <String>[name.isEmpty ? '—' : name];
    if (sexe.isNotEmpty) bits.add(sexe == 'M' ? 'M' : 'F');
    if (dateNaissance.isNotEmpty) bits.add('né(e) $dateNaissance');
    if (telephone.trim().isNotEmpty) bits.add('tél. ${telephone.trim()}');
    if (cote.isNotEmpty) {
      for (final c in cotes) {
        if (c.$1 == cote) {
          bits.add(c.$2);
          break;
        }
      }
    }
    if (lien.trim().isNotEmpty) bits.add('lien: ${lien.trim()}');
    if (!vitAvec) bits.add('ne vit pas avec');
    return bits.join(', ');
  }
}

class SituationFamiliale {
  SituationFamiliale({
    this.aConjoint = false,
    FamilyMember? conjoint,
    this.nombreEnfants = 0,
    List<FamilyMember>? enfants,
    List<FamilyMember>? personnesACharge,
    this.remarques = '',
  })  : conjoint = conjoint ?? FamilyMember(lien: 'CONJOINT'),
        enfants = enfants ?? <FamilyMember>[],
        personnesACharge = personnesACharge ?? <FamilyMember>[];

  bool aConjoint;
  FamilyMember conjoint;
  int nombreEnfants;
  List<FamilyMember> enfants;
  List<FamilyMember> personnesACharge;
  String remarques;

  static List<FamilyMember> resizeEnfants(List<FamilyMember> current, int count) {
    final n = count < 0 ? 0 : count;
    if (current.length == n) return current;
    if (current.length > n) return current.sublist(0, n);
    final next = [...current];
    while (next.length < n) {
      next.add(FamilyMember(lien: 'Enfant'));
    }
    return next;
  }

  Map<String, dynamic> toJson() => {
        'a_conjoint': aConjoint,
        'conjoint': conjoint.toJson(),
        'nombre_enfants': nombreEnfants,
        'enfants': enfants.map((e) => e.toJson()).toList(),
        'personnes_a_charge': personnesACharge.map((e) => e.toJson()).toList(),
        'remarques': remarques,
      };

  String formatSummary() {
    final lines = <String>[];
    lines.add(aConjoint ? 'Conjoint(e) : ${conjoint.label}' : 'Conjoint(e) : aucun');
    lines.add("Nombre d'enfants : $nombreEnfants");
    if (enfants.isEmpty) {
      lines.add('Enfants : aucun déclaré');
    } else {
      lines.add('Enfants (${enfants.length}) :');
      for (var i = 0; i < enfants.length; i++) {
        lines.add('  ${i + 1}. ${enfants[i].label}');
      }
    }
    if (personnesACharge.isEmpty) {
      lines.add('Personnes à charge : aucune');
    } else {
      lines.add('Personnes à charge (${personnesACharge.length}) :');
      for (var i = 0; i < personnesACharge.length; i++) {
        lines.add('  ${i + 1}. ${personnesACharge[i].label}');
      }
    }
    if (remarques.trim().isNotEmpty) {
      lines.add('Remarques : ${remarques.trim()}');
    }
    return lines.join('\n');
  }

  static SituationFamiliale parse(Object? raw) {
    if (raw == null) return SituationFamiliale();
    if (raw is String) {
      final t = raw.trim();
      if (t.isEmpty) return SituationFamiliale();
      try {
        final decoded = jsonDecode(t);
        if (decoded is Map) return parse(decoded);
      } catch (_) {}
      return SituationFamiliale(remarques: t);
    }
    if (raw is! Map) return SituationFamiliale();
    final m = Map<String, dynamic>.from(raw);
    final enfantsRaw = m['enfants'];
    final chargesRaw = m['personnes_a_charge'];
    final enfants = enfantsRaw is List
        ? enfantsRaw
            .whereType<Map>()
            .map((e) => FamilyMember.fromJson(Map<String, dynamic>.from(e), lien: 'Enfant'))
            .toList()
        : <FamilyMember>[];
    final nombre = m['nombre_enfants'] is int
        ? m['nombre_enfants'] as int
        : int.tryParse(m['nombre_enfants']?.toString() ?? '') ?? enfants.length;
    return SituationFamiliale(
      aConjoint: m['a_conjoint'] == true,
      conjoint: FamilyMember.fromJson(
        m['conjoint'] is Map ? Map<String, dynamic>.from(m['conjoint'] as Map) : null,
        lien: 'CONJOINT',
      ),
      nombreEnfants: nombre,
      enfants: enfants,
      personnesACharge: chargesRaw is List
          ? chargesRaw
              .whereType<Map>()
              .map((e) => FamilyMember.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : <FamilyMember>[],
      remarques: m['remarques']?.toString() ?? '',
    );
  }
}
