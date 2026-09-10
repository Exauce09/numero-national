import 'dart:convert';

import 'package:http/http.dart' as http;

import 'gps_capture.dart';

/// Résolution GPS → adresse.
/// - Online : Nominatim (précis).
/// - Offline Kinshasa : approx commune via boîtes englobantes locales.
class GeoFromGps {
  GeoFromGps._();

  static Future<GpsAddress?> resolve() async {
    final pos = await GpsCapture.capture();
    if (pos == null) return null;
    final online = await _tryNominatim(pos.lat, pos.lng);
    if (online != null) return online;
    return _offlineKinshasa(pos.lat, pos.lng);
  }

  static Future<GpsAddress?> _tryNominatim(double lat, double lng) async {
    try {
      final uri = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse'
        '?format=jsonv2&lat=$lat&lon=$lng&addressdetails=1&accept-language=fr',
      );
      final res = await http
          .get(uri, headers: {'User-Agent': 'NumeroNational-Recensement/1.0'})
          .timeout(const Duration(seconds: 8));
      if (res.statusCode != 200) return null;
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final a = (data['address'] as Map?)?.cast<String, dynamic>() ?? {};
      return GpsAddress(
        latitude: lat,
        longitude: lng,
        displayName: data['display_name']?.toString(),
        province: _s(a['state'] ?? a['region']),
        ville: _s(a['city'] ?? a['town'] ?? a['municipality']),
        commune: _s(a['suburb'] ?? a['city_district'] ?? a['municipality']),
        quartier: _s(a['neighbourhood'] ?? a['quarter']),
        avenue: _s(a['road'] ?? a['pedestrian']),
        source: 'online',
      );
    } catch (_) {
      return null;
    }
  }

  /// Approx communes Kinshasa (bbox) — fonctionne hors ligne.
  static GpsAddress _offlineKinshasa(double lat, double lng) {
    String? commune;
    for (final b in _kinCommunes) {
      if (lat <= b.north && lat >= b.south && lng >= b.west && lng <= b.east) {
        commune = b.name;
        break;
      }
    }
    return GpsAddress(
      latitude: lat,
      longitude: lng,
      province: 'Kinshasa',
      ville: 'Kinshasa',
      commune: commune,
      displayName: commune != null
          ? 'Kinshasa · $commune (approx. hors ligne)'
          : 'Position GPS (hors ligne — précisez la cascade)',
      source: 'offline',
    );
  }

  static String? _s(dynamic v) {
    final t = v?.toString().trim();
    return (t == null || t.isEmpty) ? null : t;
  }
}

class GpsAddress {
  GpsAddress({
    required this.latitude,
    required this.longitude,
    this.displayName,
    this.province,
    this.ville,
    this.commune,
    this.quartier,
    this.avenue,
    this.source = 'gps',
  });

  final double latitude;
  final double longitude;
  final String? displayName;
  final String? province;
  final String? ville;
  final String? commune;
  final String? quartier;
  final String? avenue;
  final String source;

  String get label {
    final parts = <String>[
      if (province != null) province!,
      if (ville != null) ville!,
      if (commune != null) commune!,
      if (quartier != null) quartier!,
      if (avenue != null) 'Av. $avenue',
    ];
    if (parts.isNotEmpty) return parts.join(' · ');
    return displayName ??
        'Lat ${latitude.toStringAsFixed(5)}, Lng ${longitude.toStringAsFixed(5)}';
  }
}

class _BBox {
  const _BBox(this.name, this.south, this.north, this.west, this.east);
  final String name;
  final double south, north, west, east;
}

/// Boîtes approximatives (OSM / usage terrain) — pas un cadastre officiel.
const _kinCommunes = <_BBox>[
  _BBox('Gombe', -4.325, -4.295, 15.285, 15.325),
  _BBox('Barumbu', -4.325, -4.300, 15.325, 15.355),
  _BBox('Kinshasa', -4.345, -4.310, 15.300, 15.340),
  _BBox('Lingwala', -4.340, -4.315, 15.280, 15.310),
  _BBox('Kintambo', -4.340, -4.310, 15.250, 15.285),
  _BBox('Ngaliema', -4.380, -4.320, 15.200, 15.270),
  _BBox('Kalamu', -4.360, -4.325, 15.300, 15.350),
  _BBox('Kasa-Vubu', -4.350, -4.325, 15.280, 15.310),
  _BBox('Ngiri-Ngiri', -4.365, -4.340, 15.285, 15.320),
  _BBox('Bandalungwa', -4.370, -4.340, 15.250, 15.290),
  _BBox('Bumbu', -4.390, -4.350, 15.270, 15.320),
  _BBox('Makala', -4.400, -4.360, 15.290, 15.340),
  _BBox('Selembao', -4.410, -4.360, 15.230, 15.290),
  _BBox('Lemba', -4.410, -4.360, 15.310, 15.370),
  _BBox('Limete', -4.390, -4.340, 15.340, 15.410),
  _BBox('Matete', -4.420, -4.370, 15.330, 15.390),
  _BBox('Ngaba', -4.410, -4.370, 15.300, 15.350),
  _BBox('Kisenso', -4.450, -4.390, 15.340, 15.420),
  _BBox('Mont-Ngafula', -4.480, -4.380, 15.200, 15.320),
  _BBox('Masina', -4.400, -4.350, 15.380, 15.460),
  _BBox('Ndjili', -4.420, -4.360, 15.400, 15.480),
  _BBox('Kimbanseke', -4.450, -4.380, 15.430, 15.520),
  _BBox('Nsele', -4.430, -4.300, 15.480, 15.650),
  _BBox('Maluku', -4.350, -4.100, 15.550, 16.200),
];
