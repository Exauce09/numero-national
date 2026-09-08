import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

import '../../core/config.dart';
import '../../core/secure_storage.dart';

class DeviceRegistrationScreen extends StatefulWidget {
  const DeviceRegistrationScreen({super.key});

  @override
  State<DeviceRegistrationScreen> createState() => _DeviceRegistrationScreenState();
}

class _DeviceRegistrationScreenState extends State<DeviceRegistrationScreen> {
  String? _deviceUid;
  String? _status;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final uid = await SecureStore.instance.deviceUid;
    setState(() => _deviceUid = uid);
  }

  Future<void> _register() async {
    setState(() {
      _busy = true;
      _status = null;
    });
    final uid = _deviceUid ?? const Uuid().v4();
    try {
      final uri = Uri.parse('${AppConfig.apiBaseUrl}/census/devices/register');
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'device_uid': uid,
          'platform': 'android',
          'app_version': AppConfig.appVersion,
        }),
      );
      await SecureStore.instance.saveDeviceUid(uid);
      setState(() {
        _deviceUid = uid;
        _status = res.statusCode >= 200 && res.statusCode < 300
            ? 'Appareil enregistré (${res.statusCode})'
            : 'Réponse serveur ${res.statusCode} — UID conservé localement';
      });
    } catch (e) {
      await SecureStore.instance.saveDeviceUid(uid);
      setState(() {
        _deviceUid = uid;
        _status = 'Hors ligne — UID local conservé ($e)';
      });
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Identifiant appareil', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          SelectableText(_deviceUid ?? 'Non enregistré'),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _register,
            child: const Text('Enregistrer / renouveler'),
          ),
          if (_status != null) ...[
            const SizedBox(height: 12),
            Text(_status!),
          ],
        ],
      ),
    );
  }
}
