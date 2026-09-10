import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:uuid/uuid.dart';

import '../../core/config.dart';
import '../../core/theme.dart';

/// Empreinte via le capteur biométrique (téléphone ou MorphoTablet).
class FingerprintCaptureWidget extends StatefulWidget {
  const FingerprintCaptureWidget({
    super.key,
    required this.onCaptured,
    required this.label,
    this.hand = 'doigt',
    this.initialRef,
  });

  final ValueChanged<String> onCaptured;
  final String label;
  final String hand;
  final String? initialRef;

  @override
  State<FingerprintCaptureWidget> createState() => _FingerprintCaptureWidgetState();
}

class _FingerprintCaptureWidgetState extends State<FingerprintCaptureWidget> {
  final _auth = LocalAuthentication();
  String? _ref;
  String? _error;
  bool _busy = false;
  bool _available = false;
  String _sensorHint = '';

  bool get _morpho => AppConfig.isFingerprintDevice;

  String get _deviceLabel => _morpho ? 'MorphoTablet' : 'téléphone';

  @override
  void initState() {
    super.initState();
    _ref = widget.initialRef;
    _check();
  }

  Future<void> _check() async {
    try {
      final supported = await _auth.isDeviceSupported();
      final can = await _auth.canCheckBiometrics;
      final bios = await _auth.getAvailableBiometrics();
      final hasFp = bios.contains(BiometricType.fingerprint) ||
          bios.contains(BiometricType.strong) ||
          bios.contains(BiometricType.weak);
      if (!mounted) return;
      setState(() {
        _available = supported && (can || bios.isNotEmpty);
        if (!_available) {
          _error = _morpho
              ? 'Activez l’empreinte dans Réglages MorphoTablet (Sécurité)'
              : 'Enregistrez une empreinte dans Réglages → Sécurité du téléphone';
          _sensorHint = '';
        } else if (hasFp || bios.isNotEmpty) {
          _error = null;
          _sensorHint = _morpho
              ? 'Posez le doigt ${widget.hand} sur le capteur optique Morpho (haut gauche)'
              : 'Posez le doigt ${widget.hand} sur le capteur du téléphone';
        } else {
          _sensorHint = 'Utilisez le capteur biométrique du $_deviceLabel';
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _available = false;
        _error = 'Biométrie indisponible';
      });
    }
  }

  Future<void> _capture() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _check();
      if (!_available) return;

      final ok = await _auth.authenticate(
        localizedReason: _morpho
            ? 'Empreinte ${widget.hand} — posez le doigt sur le capteur Morpho'
            : 'Empreinte ${widget.hand} — posez le doigt sur le capteur',
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
          useErrorDialogs: true,
        ),
      );
      if (!ok) {
        setState(() => _error = 'Empreinte non validée — réessayez');
        return;
      }
      final scheme = _morpho ? 'morpho-fp' : 'phone-fp';
      final ref =
          '$scheme://${widget.hand}/${DateTime.now().toUtc().toIso8601String()}#${const Uuid().v4()}';
      setState(() => _ref = ref);
      widget.onCaptured(ref);
    } catch (e) {
      setState(() => _error = 'Échec capteur');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final done = _ref != null && _ref!.isNotEmpty;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: NnColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: done ? NnColors.success.withValues(alpha: 0.35) : NnColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.label, style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(
            done
                ? 'Validée via le capteur $_deviceLabel (${widget.hand})'
                : (_sensorHint.isNotEmpty
                    ? _sensorHint
                    : 'Utilise le capteur d’empreinte du $_deviceLabel'),
            style: TextStyle(
              color: done ? NnColors.success : NnColors.muted,
              fontWeight: done ? FontWeight.w700 : FontWeight.w500,
              fontSize: 13,
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 6),
            Text(_error!, style: const TextStyle(color: NnColors.danger, fontSize: 13)),
          ],
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _busy ? null : _capture,
            icon: Icon(done ? Icons.fingerprint : Icons.fingerprint_outlined),
            label: Text(
              _busy
                  ? 'Capteur…'
                  : (done ? 'Reprendre (${widget.hand})' : 'Capturer ${widget.hand}'),
            ),
          ),
        ],
      ),
    );
  }
}
