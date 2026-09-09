import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:uuid/uuid.dart';

/// Empreinte via le **capteur biométrique du téléphone** (Android BiometricPrompt).
///
/// L’OS ne livre pas l’image AFIS : on enregistre une attestation
/// (doigt validé sur le capteur + horodatage + id).
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
  /// Ex. "gauche" / "droite" — affiché dans le prompt système.
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
          _error = 'Activez une empreinte dans Réglages → Sécurité du téléphone';
          _sensorHint = '';
        } else if (hasFp || bios.isNotEmpty) {
          _error = null;
          _sensorHint = 'Posez le doigt ${widget.hand} sur le capteur du téléphone';
        } else {
          _sensorHint = 'Biométrie disponible — utilisez le capteur du téléphone';
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _available = false;
        _error = 'Biométrie indisponible: $e';
      });
    }
  }

  Future<void> _capture() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // Relance la vérif au cas où l’utilisateur vient d’enregistrer une empreinte.
      await _check();
      if (!_available) return;

      final ok = await _auth.authenticate(
        localizedReason:
            'Empreinte ${widget.hand} — posez le doigt sur le capteur du téléphone',
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
      final ref =
          'phone-fp://${widget.hand}/${DateTime.now().toUtc().toIso8601String()}#${const Uuid().v4()}';
      setState(() => _ref = ref);
      widget.onCaptured(ref);
    } catch (e) {
      setState(() => _error = 'Échec capteur: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final done = _ref != null && _ref!.isNotEmpty;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.label, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 6),
            Text(
              done
                  ? 'OK — capturée via le capteur du téléphone (${widget.hand})'
                  : (_sensorHint.isNotEmpty
                      ? _sensorHint
                      : 'Utilise le capteur d’empreinte du téléphone'),
              style: TextStyle(
                color: done ? const Color(0xFF0F6B45) : const Color(0xFF5A6A85),
                fontWeight: done ? FontWeight.w700 : FontWeight.w500,
                fontSize: 13,
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 6),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 13)),
            ],
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: _busy ? null : _capture,
              icon: Icon(done ? Icons.fingerprint : Icons.fingerprint_outlined),
              label: Text(
                _busy
                    ? 'Capteur…'
                    : (done ? 'Reprendre (${widget.hand})' : 'Capturer ${widget.hand}'),
              ),
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF007FFF)),
            ),
          ],
        ),
      ),
    );
  }
}
