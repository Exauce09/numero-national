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

enum GeoCascadePreset {
  /// Province → Ville → Commune → Quartier → Avenue (+ N° hors cascade)
  address,
  /// Province → Ville → Commune
  place,
  /// Province → Ville → Territoire → Secteur/Commune → Village
  origin,
}

/// Cascades géo RDC (API /geo/*) avec ajout village / quartier / avenue.
class GeoCascadeField extends StatefulWidget {
  const GeoCascadeField({
    super.key,
    required this.onLabelChanged,
    this.onSelectionChanged,
    this.preset = GeoCascadePreset.address,
    this.title,
  });

  final ValueChanged<String> onLabelChanged;
  final ValueChanged<Map<String, String?>>? onSelectionChanged;
  final GeoCascadePreset preset;
  final String? title;

  @override
  State<GeoCascadeField> createState() => _GeoCascadeFieldState();
}

class _GeoCascadeFieldState extends State<GeoCascadeField> {
  final _api = ApiClient();
  List<GeoItem> _provinces = [];
  List<GeoItem> _villes = [];
  List<GeoItem> _districts = [];
  List<GeoItem> _communes = [];
  List<GeoItem> _villages = [];
  List<GeoItem> _quartiers = [];
  List<GeoItem> _avenues = [];
  String? _provinceId;
  String? _villeId;
  String? _districtId;
  String? _communeId;
  String? _villageId;
  String? _quartierId;
  String? _avenueId;
  String? _error;
  String? _hint;
  bool _loading = true;

  bool get _showDistrict => widget.preset == GeoCascadePreset.origin;
  /// Village uniquement pour l’origine (rural). Adresse urbaine Kinshasa = commune → quartier → avenue.
  bool get _showVillage => widget.preset == GeoCascadePreset.origin;
  bool get _showQuartierAvenue => widget.preset == GeoCascadePreset.address;

  String get _subtitle {
    switch (widget.preset) {
      case GeoCascadePreset.place:
        return 'Province → Ville → Commune';
      case GeoCascadePreset.origin:
        return 'Province → Ville → Territoire → Secteur/Commune → Village';
      case GeoCascadePreset.address:
        return 'Province → Ville → Commune → Quartier → Avenue';
    }
  }

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
        } else {
          _hint = '${rows.length} provinces';
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

  String? _nameOf(String? id, List<GeoItem> list, {bool voie = false}) {
    if (id == null) return null;
    for (final i in list) {
      if (i.id == id) return voie ? i.displayName : i.name;
    }
    return null;
  }

  void _emit() {
    final parts = <String>[];
    for (final x in [
      _nameOf(_provinceId, _provinces),
      _nameOf(_villeId, _villes),
      if (_showDistrict) _nameOf(_districtId, _districts),
      _nameOf(_communeId, _communes),
      if (_showVillage) _nameOf(_villageId, _villages),
      if (_showQuartierAvenue) _nameOf(_quartierId, _quartiers),
      if (_showQuartierAvenue) _nameOf(_avenueId, _avenues, voie: true),
    ]) {
      if (x != null) parts.add(x);
    }
    final label = parts.join(' · ');
    widget.onLabelChanged(label);
    widget.onSelectionChanged?.call({
      'province_name': _nameOf(_provinceId, _provinces),
      'ville_name': _nameOf(_villeId, _villes),
      'district_name': _nameOf(_districtId, _districts),
      'commune_name': _nameOf(_communeId, _communes),
      'commune_code': () {
        if (_communeId == null) return null;
        for (final i in _communes) {
          if (i.id == _communeId) return i.code;
        }
        return null;
      }(),
      'localite_name': _nameOf(_villageId, _villages),
      'quartier_name': _nameOf(_quartierId, _quartiers),
      'avenue_name': _nameOf(_avenueId, _avenues),
      'label': label,
    });
  }

  Future<void> _onProvince(String? id) async {
    setState(() {
      _provinceId = id;
      _villeId = _districtId = _communeId = _villageId = _quartierId = _avenueId = null;
      _villes = [];
      _districts = [];
      _communes = [];
      _villages = [];
      _quartiers = [];
      _avenues = [];
    });
    _emit();
    if (id == null) return;
    final villes = await _getList('/geo/villes?province_id=$id');
    final districts =
        _showDistrict ? await _getList('/geo/districts?province_id=$id') : <GeoItem>[];
    if (!mounted) return;
    setState(() {
      _villes = villes;
      _districts = districts;
      _hint = '${villes.length} ville(s)';
    });
  }

  Future<void> _onVille(String? id) async {
    setState(() {
      _villeId = id;
      if (!_showDistrict) {
        _communeId = _villageId = _quartierId = _avenueId = null;
        _communes = [];
        _villages = [];
        _quartiers = [];
        _avenues = [];
      }
    });
    _emit();
    if (id == null || _showDistrict) return;
    final rows = await _getList('/geo/communes?ville_id=$id');
    if (!mounted) return;
    setState(() {
      _communes = rows;
      _hint = '${rows.length} commune(s)';
    });
  }

  Future<void> _onDistrict(String? id) async {
    setState(() {
      _districtId = id;
      _communeId = _villageId = null;
      _communes = [];
      _villages = [];
    });
    _emit();
    if (id == null) return;
    final rows = await _getList('/geo/communes?district_id=$id');
    if (!mounted) return;
    setState(() {
      _communes = rows;
      _hint = '${rows.length} secteur(s)/commune(s)';
    });
  }

  Future<void> _onCommune(String? id) async {
    setState(() {
      _communeId = id;
      _villageId = _quartierId = _avenueId = null;
      _villages = [];
      _quartiers = [];
      _avenues = [];
    });
    _emit();
    if (id == null) return;
    if (_showVillage) {
      final villages = await _getList('/geo/localites?commune_id=$id');
      if (!mounted) return;
      setState(() {
        _villages = villages;
        _hint = '${villages.length} village(s)';
      });
    }
    if (_showQuartierAvenue) {
      final quartiers = await _getList('/geo/quartiers?commune_id=$id');
      if (!mounted) return;
      setState(() {
        _quartiers = quartiers;
        _hint = quartiers.isEmpty
            ? 'Aucun quartier pour cette commune — utilisez + Ajouter quartier'
            : '${quartiers.length} quartier(s) de cette commune';
      });
    }
  }

  Future<void> _onVillage(String? id) async {
    setState(() => _villageId = id);
    _emit();
  }

  Future<void> _onQuartier(String? id) async {
    setState(() {
      _quartierId = id;
      _avenueId = null;
      _avenues = [];
    });
    _emit();
    if (id == null) return;
    final rows = await _getList('/geo/voies?quartier_id=$id');
    if (!mounted) return;
    setState(() {
      _avenues = rows;
      _hint = rows.isEmpty
          ? 'Aucune avenue — utilisez + Ajouter avenue'
          : '${rows.length} avenue(s)/rue(s)';
    });
  }

  Future<void> _onAvenue(String? id) async {
    setState(() => _avenueId = id);
    _emit();
  }

  Future<void> _addVillage() async {
    if (_communeId == null) {
      setState(() => _hint = 'Choisissez d’abord une commune');
      return;
    }
    final name = await _askName('Ajouter un village', 'Nom du village');
    if (name == null || name.trim().isEmpty) return;
    try {
      final res = await _api.post(
        '/geo/localites',
        body: {'commune_id': _communeId, 'name': name.trim()},
        auth: false,
      );
      if (res.statusCode == 409) {
        setState(() => _hint = 'Ce village existe déjà');
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        setState(() => _hint = 'Ajout village impossible (${res.statusCode})');
        return;
      }
      final item =
          GeoItem.fromJson(Map<String, dynamic>.from(jsonDecode(res.body) as Map));
      setState(() {
        _villages = [..._villages, item]..sort((a, b) => a.name.compareTo(b.name));
        _villageId = item.id;
        _hint = 'Village ajouté';
      });
      _emit();
    } catch (e) {
      setState(() => _hint = 'Erreur réseau: $e');
    }
  }

  Future<void> _addQuartier() async {
    if (_communeId == null) {
      setState(() => _hint = 'Choisissez d’abord une commune');
      return;
    }
    final name = await _askName('Ajouter un quartier', 'Nom du quartier');
    if (name == null || name.trim().isEmpty) return;
    try {
      final res = await _api.post(
        '/geo/quartiers',
        body: {'commune_id': _communeId, 'name': name.trim()},
        auth: false,
      );
      if (res.statusCode == 409) {
        setState(() => _hint = 'Ce quartier existe déjà');
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        setState(() => _hint = 'Ajout quartier impossible (${res.statusCode})');
        return;
      }
      final item =
          GeoItem.fromJson(Map<String, dynamic>.from(jsonDecode(res.body) as Map));
      setState(() {
        _quartiers = [..._quartiers, item]..sort((a, b) => a.name.compareTo(b.name));
        _quartierId = item.id;
        _avenueId = null;
        _avenues = [];
        _hint = 'Quartier ajouté';
      });
      _emit();
      await _onQuartier(item.id);
    } catch (e) {
      setState(() => _hint = 'Erreur réseau: $e');
    }
  }

  Future<void> _addAvenue() async {
    if (_quartierId == null) {
      setState(() => _hint = 'Choisissez d’abord un quartier');
      return;
    }
    final name = await _askName('Ajouter une avenue', 'Nom (sans le mot Avenue)');
    if (name == null || name.trim().isEmpty) return;
    try {
      final res = await _api.post(
        '/geo/voies',
        body: {
          'quartier_id': _quartierId,
          'name': name.trim(),
          'voie_type': 'AVENUE',
        },
        auth: false,
      );
      if (res.statusCode == 409) {
        setState(() => _hint = 'Cette avenue existe déjà');
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        setState(() => _hint = 'Ajout avenue impossible (${res.statusCode})');
        return;
      }
      final item =
          GeoItem.fromJson(Map<String, dynamic>.from(jsonDecode(res.body) as Map));
      setState(() {
        _avenues = [..._avenues, item];
        _avenueId = item.id;
        _hint = 'Avenue ajoutée';
      });
      _emit();
    } catch (e) {
      setState(() => _hint = 'Erreur réseau: $e');
    }
  }

  Future<String?> _askName(String title, String label) async {
    final ctrl = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: InputDecoration(labelText: label),
          textCapitalization: TextCapitalization.words,
          onSubmitted: (v) => Navigator.of(ctx).pop(v),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Annuler')),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(ctrl.text),
            child: const Text('Ajouter'),
          ),
        ],
      ),
    );
    ctrl.dispose();
    return result;
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
        key: ValueKey('$label-${items.length}-$value'),
        value: value,
        isExpanded: true,
        decoration: InputDecoration(
          labelText: items.isEmpty ? '$label (vide)' : '$label (${items.length})',
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
        onChanged: onChanged,
      ),
    );
  }

  Widget _addBtn(String label, VoidCallback? onPressed) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: const Icon(Icons.add, size: 18),
        label: Text(label),
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
        Text(
          widget.title ?? 'Localisation RDC',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 4),
        Text(
          _subtitle,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: const Color(0xFF5A6A85),
              ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 6),
          Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ],
        if (_hint != null) ...[
          const SizedBox(height: 6),
          Text(_hint!, style: const TextStyle(color: Color(0xFF5D87FF), fontSize: 13)),
        ],
        const SizedBox(height: 8),
        _dd(label: 'Province', value: _provinceId, items: _provinces, onChanged: _onProvince),
        _dd(label: 'Ville', value: _villeId, items: _villes, onChanged: _onVille),
        if (_showDistrict)
          _dd(
            label: 'Territoire',
            value: _districtId,
            items: _districts,
            onChanged: _onDistrict,
          ),
        _dd(
          label: _showDistrict ? 'Secteur / Chefferie / Commune' : 'Commune',
          value: _communeId,
          items: _communes,
          onChanged: _onCommune,
        ),
        if (_showVillage) ...[
          _dd(label: 'Village', value: _villageId, items: _villages, onChanged: _onVillage),
          Align(
            alignment: Alignment.centerLeft,
            child: _addBtn('Ajouter village', _communeId == null ? null : _addVillage),
          ),
        ],
        if (_showQuartierAvenue) ...[
          _dd(
            label: 'Quartier (de la commune)',
            value: _quartierId,
            items: _quartiers,
            onChanged: _onQuartier,
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: _addBtn('Ajouter quartier', _communeId == null ? null : _addQuartier),
          ),
          _dd(
            label: 'Avenue / rue (du quartier)',
            value: _avenueId,
            items: _avenues,
            onChanged: _onAvenue,
            voieLabels: true,
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: _addBtn('Ajouter avenue', _quartierId == null ? null : _addAvenue),
          ),
        ],
      ],
    );
  }
}
