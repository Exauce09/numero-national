import 'package:flutter/material.dart';

import '../../core/auth_service.dart';
import '../../core/secure_storage.dart';

class DeviceRegistrationScreen extends StatefulWidget {
  const DeviceRegistrationScreen({super.key});

  @override
  State<DeviceRegistrationScreen> createState() => _DeviceRegistrationScreenState();
}

class _DeviceRegistrationScreenState extends State<DeviceRegistrationScreen> {
  final _auth = AuthService();
  String? _deviceUid;
  String? _userEmail;
  String? _status;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final uid = await SecureStore.instance.deviceUid;
    final email = await SecureStore.instance.userEmail;
    setState(() {
      _deviceUid = uid;
      _userEmail = email;
    });
  }

  Future<void> _register() async {
    setState(() {
      _busy = true;
      _status = null;
    });
    try {
      final uid = await _auth.ensureDeviceRegistered();
      setState(() {
        _deviceUid = uid;
        _status = 'Appareil enregistré auprès du serveur (ou UID local conservé).';
      });
    } catch (e) {
      setState(() => _status = 'Échec: $e');
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
          if (_userEmail != null) ...[
            Text('Agent', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(_userEmail!),
            const SizedBox(height: 16),
          ],
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
