import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import '../../core/geo_from_gps.dart';
import '../../core/theme.dart';
import '../../sync/local_database.dart';
import '../../sync/sync_lifecycle.dart';
import '../../sync/sync_queue.dart';
import 'geo_cascade_field.dart';

/// Nouveau ménage — GPS (en ligne / hors ligne) + saisie manuelle.
class HouseholdFormScreen extends StatefulWidget {
  const HouseholdFormScreen({
    super.key,
    required this.campaignId,
    this.zoneId,
  });

  final String campaignId;
  final String? zoneId;

  @override
  State<HouseholdFormScreen> createState() => _HouseholdFormScreenState();
}

class _HouseholdFormScreenState extends State<HouseholdFormScreen> {
  final _address = TextEditingController();
  final _detail = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  String _geoLabel = '';
  double? _lat;
  double? _lng;
  String? _gpsLabel;
  String? _gpsSource;
  bool _busy = false;
  String? _status;

  @override
  void dispose() {
    _address.dispose();
    _detail.dispose();
    super.dispose();
  }

  void _rebuildAddress() {
    if (_gpsLabel != null && _gpsLabel!.isNotEmpty) {
      final manual = <String>[
        if (_detail.text.trim().isNotEmpty) _detail.text.trim(),
      ];
      _address.text = [_gpsLabel!, ...manual].where((e) => e.isNotEmpty).join(' — ');
    } else {
      final parts = <String>[
        if (_geoLabel.trim().isNotEmpty) _geoLabel.trim(),
        if (_detail.text.trim().isNotEmpty) _detail.text.trim(),
      ];
      _address.text = parts.join(' — ');
    }
  }

  Future<void> _locateGps() async {
    setState(() {
      _busy = true;
      _status = 'Lecture GPS…';
    });
    try {
      final addr = await GeoFromGps.resolve();
      if (addr == null) {
        setState(() => _status = 'GPS indisponible — saisissez l’adresse manuellement');
        return;
      }
      setState(() {
        _lat = addr.latitude;
        _lng = addr.longitude;
        _gpsLabel = addr.label;
        _gpsSource = addr.source;
        _status = addr.source == 'online'
            ? 'Adresse précise (GPS + internet)'
            : 'Position GPS OK hors ligne — complètez si besoin';
      });
      _rebuildAddress();
    } catch (e) {
      setState(() => _status = 'GPS: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    _rebuildAddress();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _busy = true;
      _status = _lat == null ? 'Capture GPS…' : 'Enregistrement…';
    });

    if (_lat == null || _lng == null) {
      try {
        final addr = await GeoFromGps.resolve();
        if (addr != null) {
          _lat = addr.latitude;
          _lng = addr.longitude;
          _gpsLabel = addr.label;
          _gpsSource = addr.source;
          _rebuildAddress();
        }
      } catch (_) {
        if (!mounted) return;
        final cont = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('GPS non capturé'),
            content: const Text('Enregistrer le ménage sans point GPS ?'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
              FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Sans GPS')),
            ],
          ),
        );
        if (cont != true) {
          setState(() {
            _busy = false;
            _status = null;
          });
          return;
        }
      }
    }

    try {
      final localId = const Uuid().v4();
      final now = DateTime.now().toUtc().toIso8601String();
      final data = <String, Object?>{
        'id': localId,
        'local_id': localId,
        'campaign_id': widget.campaignId,
        'address_line': _address.text.trim(),
        'latitude': _lat,
        'longitude': _lng,
        'member_count': 0,
        'updated_at': now,
      };
      await LocalDatabase.instance.db.insert('households', data);
      await LocalDatabase.instance.setMeta('sync_status', 'EN_ATTENTE');
      await SyncQueue().enqueue(
        SyncQueueItem(
          entityType: 'household',
          localId: localId,
          version: 1,
          payload: {
            ...data,
            'campaign_id': widget.campaignId,
            if (widget.zoneId != null) 'zone_id': widget.zoneId,
            if (_geoLabel.isNotEmpty) 'geo_label': _geoLabel,
            if (_gpsSource != null) 'gps_source': _gpsSource,
          },
        ),
      );
      SyncLifecycle.instance.nudge();
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _status = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nouveau ménage'),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(4),
          child: RdcStripe(height: 4),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: NnColors.softBlue,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: NnColors.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Localisation',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    '1. Bouton GPS (marche avec ou sans internet)\n'
                    '2. Ou saisie manuelle province → ville → commune…',
                    style: TextStyle(fontSize: 12, color: NnColors.muted, height: 1.35),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: _busy ? null : _locateGps,
                    icon: const Icon(Icons.my_location),
                    label: Text(_busy && _status == 'Lecture GPS…' ? 'GPS…' : 'Localiser par GPS'),
                  ),
                  if (_status != null) ...[
                    const SizedBox(height: 8),
                    Text(_status!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ],
                  if (_lat != null && _lng != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      '${_lat!.toStringAsFixed(5)}, ${_lng!.toStringAsFixed(5)}'
                      '${_gpsLabel != null ? '\n$_gpsLabel' : ''}',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 18),
            Text('Saisie manuelle', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            GeoCascadeField(
              onLabelChanged: (label) {
                setState(() => _geoLabel = label);
                _rebuildAddress();
              },
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _detail,
              decoration: const InputDecoration(
                labelText: 'Complément (n°, parcelle, repère)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
              onChanged: (_) => _rebuildAddress(),
              validator: (_) {
                _rebuildAddress();
                if (_address.text.trim().length < 5 && _lat == null) {
                  return 'GPS ou adresse requise';
                }
                return null;
              },
            ),
            const SizedBox(height: 24),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: NnColors.rdcRed),
              onPressed: _busy ? null : _save,
              child: _busy
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Enregistrer le ménage'),
            ),
          ],
        ),
      ),
    );
  }
}
