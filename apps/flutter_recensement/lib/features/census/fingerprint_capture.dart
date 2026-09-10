import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:uuid/uuid.dart';

import '../../core/config.dart';
import '../../core/morpho_fingerprint.dart';
import '../../core/theme.dart';

/// Empreinte MorphoTablet (SDK MorphoSmart) ou BiometricPrompt téléphone.
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
  bool _morphoReady = false;
  bool _useMorpho = false;
  String _morphoSensor = '';

  @override
  void initState() {
    super.initState();
    _ref = widget.initialRef;
    _boot();
  }

  Future<void> _boot() async {
    // Toujours détecter Morpho sur cet appareil (ne pas dépendre seulement du dart-define).
    var morpho = AppConfig.isFingerprintDevice;
    if (!morpho) {
      try {
        final hw = await MorphoFingerprint.detectHardware();
        morpho = hw['isMorphoTablet'] == true || hw['hasCbmE3'] == true;
      } catch (_) {
        morpho = false;
      }
    }

    if (!mounted) return;
    setState(() {
      _useMorpho = morpho;
      _error = null;
      if (morpho) {
        _info = 'Initialisation du capteur Morpho optique…';
      }
    });

    if (morpho) {
      try {
        final prep = await MorphoFingerprint.prepare();
        if (!mounted) return;
        setState(() {
          _useMorpho = true;
          _morphoReady = prep['ok'] == true;
          _morphoSensor = prep['sensor']?.toString() ?? '';
          _info = _morphoReady
              ? 'Capteur Morpho prêt (${_morphoSensor.isEmpty ? 'CBM-E3' : _morphoSensor}). Posez le doigt ${widget.hand} puis Capturer.'
              : 'Capteur Morpho non prêt';
          _error = null;
          _systemBio = false;
        });
      } on PlatformException catch (e) {
        if (!mounted) return;
        setState(() {
          _useMorpho = true;
          _morphoReady = false;
          _systemBio = false;
          _error = e.message ?? 'Échec init Morpho';
          _info =
              'Accordez la permission USB Morpho, puis « Préparer le capteur ». Ne pas utiliser Réglages → Sécurité.';
        });
      } catch (e) {
        if (!mounted) return;
        setState(() {
          _useMorpho = true;
          _morphoReady = false;
          _systemBio = false;
          _error = e.toString();
          _info = 'Réessayez « Préparer le capteur Morpho ».';
        });
      }
      return;
    }

    // Téléphone uniquement : biométrie système.
    try {
      final supported = await _auth.isDeviceSupported();
      final can = await _auth.canCheckBiometrics;
      final bios = await _auth.getAvailableBiometrics();
      final hasFp = bios.contains(BiometricType.fingerprint) ||
          bios.contains(BiometricType.strong) ||
          bios.contains(BiometricType.weak);
      if (!mounted) return;
      setState(() {
        _useMorpho = false;
        _systemBio = supported && (can || hasFp || bios.isNotEmpty);
        if (!_systemBio) {
          _error = 'Enregistrez une empreinte dans Réglages → Sécurité';
        } else {
          _info = 'Posez le doigt ${widget.hand} sur le capteur du téléphone';
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _useMorpho = false;
        _systemBio = false;
        _error = 'Biométrie indisponible';
      });
    }
  }

  Future<void> _captureMorpho() async {
    setState(() {
      _busy = true;
      _error = null;
      _info = 'Allumage du lecteur… posez le doigt ${widget.hand} sur le capteur (lumière rouge).';
    });
    try {
      if (!_morphoReady) {
        await _boot();
        if (!_morphoReady) {
          throw PlatformException(code: 'NOT_READY', message: _error ?? 'Capteur Morpho non prêt');
        }
      }
      final out = await MorphoFingerprint.capture(hand: widget.hand, timeout: 35);
      final payload = MorphoFingerprint.encodePayload(out);
      final ref = out['ref']?.toString() ??
          'morpho-fp://${widget.hand}/${DateTime.now().toUtc().toIso8601String()}#${const Uuid().v4()}';
      final stored = '$ref|$payload';
      setState(() {
        _ref = stored;
        _info =
            'Empreinte ${widget.hand} OK — qualité ${out['quality'] ?? '—'} (${out['template_len'] ?? 0} o)';
        _error = null;
      });
      widget.onCaptured(stored);
    } on PlatformException catch (e) {
      setState(() {
        _error = e.message ?? 'Échec capture Morpho';
        _info = 'Reposez le doigt sur le capteur optique et réessayez.';
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _capturePhone() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (!_systemBio) {
        setState(() => _error = 'Aucun capteur biométrique système');
        return;
      }
      final ok = await _auth.authenticate(
        localizedReason: 'Empreinte ${widget.hand}',
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
          'phone-fp://${widget.hand}/${DateTime.now().toUtc().toIso8601String()}#${const Uuid().v4()}';
      setState(() => _ref = ref);
      widget.onCaptured(ref);
    } catch (e) {
      setState(() => _error = 'Échec capteur ($e)');
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
                ? 'Empreinte ${widget.hand} enregistrée'
                : (_info ?? 'Capteur d’empreinte'),
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
            onPressed: _busy
                ? null
                : (_useMorpho ? _captureMorpho : _capturePhone),
            icon: Icon(done ? Icons.fingerprint : Icons.fingerprint_outlined),
            label: Text(
              _busy
                  ? (_useMorpho ? 'Lecture Morpho…' : 'Capteur…')
                  : (done
                      ? 'Reprendre (${widget.hand})'
                      : (_useMorpho
                          ? 'Lire empreinte Morpho (${widget.hand})'
                          : 'Capturer ${widget.hand}')),
            ),
          ),
          if (_useMorpho && !done) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _busy ? null : _boot,
              icon: const Icon(Icons.settings_input_component),
              label: Text(_morphoReady ? 'Reconnecter le capteur' : 'Préparer le capteur Morpho'),
            ),
          ],
        ],
      ),
    );
  }
}
