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
  });

  String nom;
  String postnom;
  String prenom;
  String sexe;
  String dateNaissance;
  String telephone;
  bool vitAvec;
  String lien;

  Map<String, dynamic> toJson() => {
        'nom': nom,
        'postnom': postnom,
        'prenom': prenom,
        'sexe': sexe,
        'date_naissance': dateNaissance,
        'telephone': telephone,
        'vit_avec': vitAvec,
        'lien': lien,
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
    );
  }

  String get label {
    final name = [nom, postnom, prenom].map((e) => e.trim()).where((e) => e.isNotEmpty).join(' ');
    final bits = <String>[name.isEmpty ? '—' : name];
    if (sexe.isNotEmpty) bits.add(sexe == 'M' ? 'M' : 'F');
    if (dateNaissance.isNotEmpty) bits.add('né(e) $dateNaissance');
    if (telephone.trim().isNotEmpty) bits.add('tél. ${telephone.trim()}');
    if (!vitAvec) bits.add('ne vit pas avec');
    if (lien.trim().isNotEmpty) bits.add('lien: ${lien.trim()}');
    return bits.join(', ');
  }
}

class SituationFamiliale {
  SituationFamiliale({
    this.aConjoint = false,
    FamilyMember? conjoint,
    List<FamilyMember>? enfants,
    List<FamilyMember>? personnesACharge,
    this.remarques = '',
  })  : conjoint = conjoint ?? FamilyMember(lien: 'CONJOINT'),
        enfants = enfants ?? <FamilyMember>[],
        personnesACharge = personnesACharge ?? <FamilyMember>[];

  bool aConjoint;
  FamilyMember conjoint;
  List<FamilyMember> enfants;
  List<FamilyMember> personnesACharge;
  String remarques;

  Map<String, dynamic> toJson() => {
        'a_conjoint': aConjoint,
        'conjoint': conjoint.toJson(),
        'enfants': enfants.map((e) => e.toJson()).toList(),
        'personnes_a_charge': personnesACharge.map((e) => e.toJson()).toList(),
        'remarques': remarques,
      };

  String formatSummary() {
    final lines = <String>[];
    lines.add(aConjoint ? 'Conjoint(e) : ${conjoint.label}' : 'Conjoint(e) : aucun');
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
    return SituationFamiliale(
      aConjoint: m['a_conjoint'] == true,
      conjoint: FamilyMember.fromJson(
        m['conjoint'] is Map ? Map<String, dynamic>.from(m['conjoint'] as Map) : null,
        lien: 'CONJOINT',
      ),
      enfants: enfantsRaw is List
          ? enfantsRaw
              .whereType<Map>()
              .map((e) => FamilyMember.fromJson(Map<String, dynamic>.from(e), lien: 'ENFANT'))
              .toList()
          : <FamilyMember>[],
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
