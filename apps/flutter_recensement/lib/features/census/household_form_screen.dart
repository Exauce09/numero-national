import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:uuid/uuid.dart';

import '../../sync/local_database.dart';
import '../../sync/sync_queue.dart';
import 'geo_cascade_field.dart';

/// Create / edit a household with address + optional GPS.
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
  bool _busy = false;
  String? _gpsError;

  @override
  void dispose() {
    _address.dispose();
    _detail.dispose();
    super.dispose();
  }

  void _rebuildAddress() {
    final parts = <String>[
      if (_geoLabel.trim().isNotEmpty) _geoLabel.trim(),
      if (_detail.text.trim().isNotEmpty) _detail.text.trim(),
    ];
    _address.text = parts.join(' — ');
  }

  Future<void> _captureGps() async {
    setState(() {
      _busy = true;
      _gpsError = null;
    });
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        setState(() => _gpsError = 'Permission GPS refusée');
        return;
      }
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) {
        setState(() => _gpsError = 'Activez la localisation sur l’appareil');
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );
      setState(() {
        _lat = pos.latitude;
        _lng = pos.longitude;
      });
    } catch (e) {
      setState(() => _gpsError = 'GPS indisponible: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    _rebuildAddress();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
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
          },
        ),
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nouveau ménage')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
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
                labelText: 'Complément (avenue, parcelle, repère) *',
                border: OutlineInputBorder(),
                hintText: 'Av. Liberation, parcelle 12…',
              ),
              maxLines: 2,
              onChanged: (_) => _rebuildAddress(),
              validator: (_) {
                _rebuildAddress();
                final t = _address.text.trim();
                if (t.length < 5) {
                  return 'Précisez la localisation (cascade ou complément)';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Géolocalisation', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    if (_lat != null && _lng != null)
                      Text(
                        'Lat ${_lat!.toStringAsFixed(6)} · Lng ${_lng!.toStringAsFixed(6)}',
                        style: Theme.of(context).textTheme.bodyMedium,
                      )
                    else
                      const Text('Non capturée (recommandée hors ligne)'),
                    if (_gpsError != null) ...[
                      const SizedBox(height: 8),
                      Text(_gpsError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    ],
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: _busy ? null : _captureGps,
                      icon: const Icon(Icons.my_location),
                      label: const Text('Capturer GPS'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFE11D48),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
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
