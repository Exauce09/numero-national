import 'dart:convert';

import 'package:flutter/services.dart';

/// Bridge MorphoSmart (MorphoTablet optique MSO / CBM-E3).
class MorphoFingerprint {
  MorphoFingerprint._();

  static const _channel = MethodChannel('cd.gov.nic/morpho_fingerprint');

  static Future<bool> isAvailable() async {
    try {
      final v = await _channel.invokeMethod<bool>('isAvailable');
      return v == true;
    } catch (_) {
      return false;
    }
  }

  /// Détection matérielle (modèle MorphoTablet / USB CBM-E3).
  static Future<Map<String, dynamic>> detectHardware() async {
    try {
      final raw = await _channel.invokeMethod<dynamic>('detectHardware');
      if (raw is Map) {
        return raw.map((k, v) => MapEntry(k.toString(), v));
      }
    } catch (_) {}
    return <String, dynamic>{'isMorphoTablet': false, 'hasCbmE3': false};
  }

  /// Initialise USB Morpho + ouvre le capteur.
  static Future<Map<String, dynamic>> prepare() async {
    final raw = await _channel.invokeMethod<dynamic>('prepare');
    if (raw is Map) {
      return raw.map((k, v) => MapEntry(k.toString(), v));
    }
    return <String, dynamic>{'ok': false};
  }

  /// Capture 1 doigt → template ISO FMR + ref.
  static Future<Map<String, dynamic>> capture({
    required String hand,
    int timeout = 30,
  }) async {
    final raw = await _channel.invokeMethod<dynamic>('capture', {
      'hand': hand,
      'timeout': timeout,
    });
    if (raw is Map) {
      return raw.map((k, v) => MapEntry(k.toString(), v));
    }
    throw PlatformException(code: 'CAPTURE_EMPTY', message: 'Réponse Morpho vide');
  }

  static Future<void> close() async {
    try {
      await _channel.invokeMethod<void>('close');
    } catch (_) {}
  }

  static String encodePayload(Map<String, dynamic> capture) {
    return jsonEncode({
      'type': 'morpho_fp',
      'v': 1,
      'hand': capture['hand'],
      'quality': capture['quality'],
      'template_type': capture['template_type'],
      'template_b64': capture['template_b64'],
      'template_len': capture['template_len'],
      'sensor': capture['sensor'],
      'ref': capture['ref'],
      'ts': DateTime.now().toUtc().toIso8601String(),
    });
  }
}
