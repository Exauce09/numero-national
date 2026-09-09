import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import '../../core/gps_capture.dart';
import '../../sync/local_database.dart';
import '../../sync/sync_queue.dart';
import 'geo_cascade_field.dart';

/// Create a household — GPS is captured automatically on save for cartography.
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
  bool _busy = false;
  String? _status;

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

  Future<void> _save() async {
    _rebuildAddress();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _busy = true;
      _status = 'Capture GPS pour la cartographie…';
    });

    double? lat;
    double? lng;
    String? gpsNote;
    try {
      final pos = await GpsCapture.capture();
      if (pos != null) {
        lat = pos.lat;
        lng = pos.lng;
      }
    } catch (e) {
      gpsNote = e is StateError ? e.message : 'GPS indisponible';
      if (!mounted) return;
      final cont = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('GPS non capturé'),
          content: Text(
            '$gpsNote\n\nEnregistrer le ménage sans point cartographique ?',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Enregistrer sans GPS')),
          ],
        ),
      );
      if (cont != true) {
        if (mounted) {
          setState(() {
            _busy = false;
            _status = null;
          });
        }
        return;
      }
    }

    try {
      setState(() => _status = 'Enregistrement…');
      final localId = const Uuid().v4();
      final now = DateTime.now().toUtc().toIso8601String();
      final data = <String, Object?>{
        'id': localId,
        'local_id': localId,
        'campaign_id': widget.campaignId,
        'address_line': _address.text.trim(),
        'latitude': lat,
        'longitude': lng,
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
                labelText: 'Complément (n°, parcelle, repère) *',
                border: OutlineInputBorder(),
                hintText: 'Parcelle 12, en face du marché…',
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
              color: const Color(0xFFEFF6FF),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.map_outlined, color: Theme.of(context).colorScheme.primary),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _status ??
                            'La position GPS sera capturée automatiquement à l’enregistrement pour alimenter la cartographie.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
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
