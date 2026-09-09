import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';

class GeoItem {
  GeoItem({required this.id, required this.name, this.code, this.voieType});

  final String id;
  final String name;
  final String? code;
  final String? voieType;

  factory GeoItem.fromJson(Map<String, dynamic> j) => GeoItem(
        id: j['id'].toString(),
        name: j['name']?.toString() ?? '',
        code: j['code']?.toString(),
        voieType: j['voie_type']?.toString(),
      );

  String get displayName {
    if (voieType == null || voieType!.isEmpty) return name;
    final t = voieType!.toUpperCase() == 'RUE' ? 'Rue' : 'Avenue';
    return '$t $name';
  }
}

/// Cascade urbaine RDC (même ordre que le site `GeoCascade` preset `address`) :
/// Province → Ville → Commune → Quartier → Avenue.
///
/// Contexte d’appellation (habitat urbain) :
/// - Province, Ville, Commune, Quartier, Avenue/Rue
/// (le profil rural Territoire / Secteur / Village est sur le portail web `origin`).
class GeoCascadeField extends StatefulWidget {
  const GeoCascadeField({super.key, required this.onLabelChanged});

  final ValueChanged<String> onLabelChanged;

  @override
  State<GeoCascadeField> createState() => _GeoCascadeFieldState();
}

class _GeoCascadeFieldState extends State<GeoCascadeField> {
  final _api = ApiClient();
  List<GeoItem> _provinces = [];
  List<GeoItem> _villes = [];
  List<GeoItem> _communes = [];
  List<GeoItem> _quartiers = [];
  List<GeoItem> _avenues = [];
  String? _provinceId;
  String? _villeId;
  String? _communeId;
  String? _quartierId;
  String? _avenueId;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<List<GeoItem>> _getList(String path) async {
    final res = await _api.get(path, auth: false);
    if (res.statusCode < 200 || res.statusCode >= 300) return [];
    final raw = jsonDecode(res.body);
    if (raw is! List) return [];
    return raw
        .map((e) => GeoItem.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _api.post('/geo/seed', body: {}, auth: false);
      final rows = await _getList('/geo/provinces');
      if (!mounted) return;
      setState(() {
        _provinces = rows;
        _loading = false;
        if (rows.isEmpty) {
          _error = 'Géo indisponible — saisissez l’adresse manuellement.';
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Géo hors ligne — adresse manuelle.';
      });
    }
  }

  void _emit() {
    final parts = <String>[];
    String? nameOf(String? id, List<GeoItem> list, {bool voie = false}) {
      if (id == null) return null;
      for (final i in list) {
        if (i.id == id) return voie ? i.displayName : i.name;
      }
      return null;
    }

    final p = nameOf(_provinceId, _provinces);
    final v = nameOf(_villeId, _villes);
    final c = nameOf(_communeId, _communes);
    final q = nameOf(_quartierId, _quartiers);
    final a = nameOf(_avenueId, _avenues, voie: true);
    if (p != null) parts.add(p);
    if (v != null) parts.add(v);
    if (c != null) parts.add(c);
    if (q != null) parts.add(q);
    if (a != null) parts.add(a);
    widget.onLabelChanged(parts.join(' · '));
  }

  Future<void> _onProvince(String? id) async {
    setState(() {
      _provinceId = id;
      _villeId = null;
      _communeId = null;
      _quartierId = null;
      _avenueId = null;
      _villes = [];
      _communes = [];
      _quartiers = [];
      _avenues = [];
    });
    _emit();
    if (id == null) return;
    final rows = await _getList('/geo/villes?province_id=$id');
    if (!mounted) return;
    setState(() => _villes = rows);
  }

  Future<void> _onVille(String? id) async {
    setState(() {
      _villeId = id;
      _communeId = null;
      _quartierId = null;
      _avenueId = null;
      _communes = [];
      _quartiers = [];
      _avenues = [];
    });
    _emit();
    if (id == null) return;
    final rows = await _getList('/geo/communes?ville_id=$id');
    if (!mounted) return;
    setState(() => _communes = rows);
  }

  Future<void> _onCommune(String? id) async {
    setState(() {
      _communeId = id;
      _quartierId = null;
      _avenueId = null;
      _quartiers = [];
      _avenues = [];
    });
    _emit();
    if (id == null) return;
    final rows = await _getList('/geo/quartiers?commune_id=$id');
    if (!mounted) return;
    setState(() => _quartiers = rows);
  }

  Future<void> _onQuartier(String? id) async {
    setState(() {
      _quartierId = id;
      _avenueId = null;
      _avenues = [];
    });
    _emit();
    if (id == null) return;
    var rows = await _getList('/geo/voies?quartier_id=$id&voie_type=AVENUE');
    if (rows.isEmpty) {
      rows = await _getList('/geo/voies?quartier_id=$id');
    }
    if (!mounted) return;
    setState(() => _avenues = rows);
  }

  Future<void> _onAvenue(String? id) async {
    setState(() => _avenueId = id);
    _emit();
  }

  Widget _dd({
    required String label,
    required String? value,
    required List<GeoItem> items,
    required ValueChanged<String?> onChanged,
    bool voieLabels = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: DropdownButtonFormField<String>(
        value: value,
        isExpanded: true,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
        items: [
          const DropdownMenuItem(value: null, child: Text('—')),
          ...items.map(
            (i) => DropdownMenuItem(
              value: i.id,
              child: Text(
                voieLabels ? i.displayName : i.name,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        ],
        onChanged: items.isEmpty && value == null ? null : onChanged,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 12),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Localisation RDC', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        Text(
          'Province → Ville → Commune → Quartier → Avenue',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: const Color(0xFF5A6A85),
              ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 6),
          Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ],
        const SizedBox(height: 8),
        _dd(
          label: 'Province',
          value: _provinceId,
          items: _provinces,
          onChanged: _onProvince,
        ),
        _dd(
          label: 'Ville',
          value: _villeId,
          items: _villes,
          onChanged: _onVille,
        ),
        _dd(
          label: 'Commune',
          value: _communeId,
          items: _communes,
          onChanged: _onCommune,
        ),
        _dd(
          label: 'Quartier',
          value: _quartierId,
          items: _quartiers,
          onChanged: _onQuartier,
        ),
        _dd(
          label: 'Avenue',
          value: _avenueId,
          items: _avenues,
          onChanged: _onAvenue,
          voieLabels: true,
        ),
      ],
    );
  }
}
