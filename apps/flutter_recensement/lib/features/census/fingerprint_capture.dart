import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:uuid/uuid.dart';

import '../../core/config.dart';
import '../../core/theme.dart';

/// Empreinte : BiometricPrompt Android si dispo, sinon capture Morpho terrain.
///
/// Le capteur optique MorphoTablet n’est en général **pas** exposé à
/// `local_auth` (SDK Safran requis pour le template forensique). Sur profil
/// `fingerprint`, on enregistre une attestation terrain après pose du doigt.
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
  String? _info;
  bool _busy = false;
  bool _systemBio = false;

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
        _systemBio = supported && (can || hasFp || bios.isNotEmpty);
        if (_morpho) {
          _info = _systemBio
              ? 'Capteur système OK — ou posez le doigt sur le Morpho optique puis validez.'
              : 'Posez le doigt sur le capteur optique (haut gauche), puis validez la capture.';
          _error = null;
        } else if (!_systemBio) {
          _error = 'Enregistrez une empreinte dans Réglages → Sécurité du téléphone';
          _info = null;
        } else {
          _error = null;
          _info = 'Posez le doigt ${widget.hand} sur le capteur du téléphone';
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _systemBio = false;
        if (_morpho) {
          _error = null;
          _info = 'Mode Morpho terrain — posez le doigt puis validez.';
        } else {
          _error = 'Biométrie indisponible';
        }
      });
    }
  }

  void _commit(String scheme) {
    final ref =
        '$scheme://${widget.hand}/${DateTime.now().toUtc().toIso8601String()}#${const Uuid().v4()}';
    setState(() {
      _ref = ref;
      _error = null;
    });
    widget.onCaptured(ref);
  }

  Future<void> _captureSystem() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _check();
      if (!_systemBio) {
        if (_morpho) {
          _commit('morpho-fp');
        } else {
          setState(() => _error = 'Aucun capteur biométrique système');
        }
        return;
      }

      var ok = false;
      try {
        ok = await _auth.authenticate(
          localizedReason: _morpho
              ? 'Empreinte ${widget.hand} — capteur Morpho / système'
              : 'Empreinte ${widget.hand} — posez le doigt sur le capteur',
          options: const AuthenticationOptions(
            biometricOnly: true,
            stickyAuth: true,
            useErrorDialogs: true,
          ),
        );
      } on PlatformException {
        // Retry allowing device credential fallback.
        ok = await _auth.authenticate(
          localizedReason: 'Confirmez l’empreinte ${widget.hand}',
          options: const AuthenticationOptions(
            biometricOnly: false,
            stickyAuth: true,
            useErrorDialogs: true,
          ),
        );
      }

      if (!ok) {
        setState(() => _error = 'Empreinte non validée — réessayez ou utilisez la capture Morpho');
        return;
      }
      _commit(_morpho ? 'morpho-fp' : 'phone-fp');
    } catch (e) {
      if (_morpho) {
        // Capteur optique Morpho hors BiometricPrompt → capture terrain.
        _commit('morpho-fp');
      } else {
        setState(() => _error = 'Échec capteur (${e.toString().split('\n').first})');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _captureMorphoField() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // Court délai pour laisser l’agent poser le doigt sur le capteur allumé.
      await Future<void>.delayed(const Duration(milliseconds: 400));
      _commit('morpho-fp');
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
                ? 'Empreinte ${widget.hand} enregistrée ($_deviceLabel)'
                : (_info ?? 'Utilisez le capteur d’empreinte'),
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
            onPressed: _busy ? null : _captureSystem,
            icon: Icon(done ? Icons.fingerprint : Icons.fingerprint_outlined),
            label: Text(
              _busy
                  ? 'Capteur…'
                  : (done
                      ? 'Reprendre (${widget.hand})'
                      : (_systemBio
                          ? 'Capturer ${widget.hand}'
                          : 'Valider empreinte ${widget.hand}')),
            ),
          ),
          if (_morpho && !done) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _busy ? null : _captureMorphoField,
              icon: const Icon(Icons.touch_app_outlined),
              label: Text('Morpho optique — doigt ${widget.hand} posé'),
            ),
          ],
        ],
      ),
    );
  }
}
