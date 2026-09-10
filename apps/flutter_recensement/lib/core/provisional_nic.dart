import 'dart:math';

/// NIC provisoire 14 chiffres (aligné format serveur v3-rdc-14).
/// Attribué dès la finalisation terrain pour le coupon / QR.
class ProvisionalNic {
  ProvisionalNic._();

  /// PP(2) + TTT(3) + S(1) + YYYY(4) + NNNN(4) = 14.
  static String generate({
    required String sex,
    required String dateOfBirth,
    String? provinceCode,
    String? ville,
    String? commune,
  }) {
    final pp = _province(provinceCode);
    final ttt = _territory(ville, commune);
    final s = _sex(sex);
    final yyyy = _year(dateOfBirth);
    final nnnn = (Random.secure().nextInt(10000)).toString().padLeft(4, '0');
    return '$pp$ttt$s$yyyy$nnnn';
  }

  static String _sex(String sex) {
    final k = sex.trim().toUpperCase();
    if (k == 'M' || k.startsWith('H') || k.startsWith('MASC')) return '1';
    if (k == 'F' || k.startsWith('FEM')) return '2';
    return '0';
  }

  static String _year(String dob) {
    final parts = dob.trim().split(RegExp(r'[-/]'));
    if (parts.isEmpty) return '0000';
    final y = int.tryParse(parts.first);
    if (y == null || y < 1900 || y > 2100) return '0000';
    return y.toString().padLeft(4, '0');
  }

  static String _province(String? code) {
    if (code == null || code.trim().isEmpty) return '00';
    final c = code.trim().toUpperCase();
    if (RegExp(r'^\d{1,2}$').hasMatch(c)) {
      final n = int.parse(c);
      if (n >= 1 && n <= 26) return n.toString().padLeft(2, '0');
    }
    final n = (c.hashCode.abs() % 26) + 1;
    return n.toString().padLeft(2, '0');
  }

  static String _territory(String? ville, String? commune) {
    final key = [ville, commune]
        .where((e) => e != null && e.trim().isNotEmpty)
        .map((e) => e!.trim().toUpperCase())
        .join('|');
    if (key.isEmpty) return '000';
    final n = (key.hashCode.abs() % 999) + 1;
    return n.toString().padLeft(3, '0');
  }
}
