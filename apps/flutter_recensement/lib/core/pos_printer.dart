import 'dart:io';

import 'package:flutter/services.dart';

/// Impression coupon via imprimante thermique iPos (POS Q2I).
class PosPrinter {
  static const _channel = MethodChannel('cd.gov.nic/pos_printer');

  static Future<bool> isAvailable() async {
    if (!Platform.isAndroid) return false;
    try {
      final ok = await _channel.invokeMethod<bool>('isAvailable');
      return ok == true;
    } catch (_) {
      return false;
    }
  }

  static Future<void> printCoupon({
    required String title,
    required String subtitle,
    required String name,
    required String sex,
    required String dob,
    required String localId,
    required String qr,
  }) async {
    await _channel.invokeMethod<void>('printCoupon', {
      'title': title,
      'subtitle': subtitle,
      'name': name,
      'sex': sex,
      'dob': dob,
      'localId': localId,
      'qr': qr,
    });
  }
}
