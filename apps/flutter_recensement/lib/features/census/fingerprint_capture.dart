import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:uuid/uuid.dart';

/// Empreinte via capteur biométrique du téléphone (Android BiometricPrompt).
///
/// Note : le téléphone ne fournit pas l’image AFIS de l’empreinte (sécurité OS).
/// On enregistre une **attestation** : capteur OK + horodatage + id local.
class FingerprintCaptureWidget extends StatefulWidget {
  const FingerprintCaptureWidget({
    super.key,
    required this.onCaptured,
    this.initialRef,
  });

  final ValueChanged<String> onCaptured;
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

  @override
  void initState() {
    super.initState();
    _ref = widget.initialRef;
    _check();
  }

  Future<void> _check() async {
    try {
      final can = await _auth.canCheckBiometrics || await _auth.isDeviceSupported();
      final bios = await _auth.getAvailableBiometrics();
      if (!mounted) return;
      setState(() {
        _available = can && bios.isNotEmpty;
        if (!_available && bios.isEmpty) {
          _error = 'Aucun capteur d’empreinte configuré sur ce téléphone';
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
      final ok = await _auth.authenticate(
        localizedReason: 'Posez le doigt sur le capteur pour enregistrer l’empreinte',
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
          useErrorDialogs: true,
        ),
      );
      if (!ok) {
        setState(() => _error = 'Empreinte non validée');
        return;
      }
      final ref =
          'device-fp://${DateTime.now().toUtc().toIso8601String()}#${const Uuid().v4()}';
      setState(() => _ref = ref);
      widget.onCaptured(ref);
    } catch (e) {
      setState(() => _error = 'Échec empreinte: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final done = _ref != null && _ref!.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          done ? 'Empreinte capturée (capteur téléphone)' : 'Utilise le capteur d’empreinte du téléphone',
          style: TextStyle(
            color: done ? const Color(0xFF13DEB9) : const Color(0xFF5A6A85),
            fontWeight: done ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 6),
          Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ],
        const SizedBox(height: 10),
        FilledButton.icon(
          onPressed: (!_available || _busy) ? null : _capture,
          icon: Icon(done ? Icons.fingerprint : Icons.fingerprint_outlined),
          label: Text(_busy ? 'En cours…' : (done ? 'Reprendre empreinte' : 'Capturer empreinte')),
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFF5D87FF)),
        ),
        if (done) ...[
          const SizedBox(height: 6),
          Text(_ref!, style: const TextStyle(fontSize: 11, color: Color(0xFF5A6A85))),
        ],
      ],
    );
  }
}
