import 'package:flutter/material.dart';

import '../../core/auth_service.dart';
import '../../core/secure_storage.dart';
import '../../core/theme.dart';
import '../../sync/sync_lifecycle.dart';

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
    SyncLifecycle.instance.nudge();
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
        _status = 'Appareil enregistré.';
      });
    } catch (e) {
      setState(() => _status = 'Échec enregistrement');
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: NnColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: NnColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Appareil', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 12),
              if (_userEmail != null) ...[
                const Text('Agent', style: TextStyle(color: NnColors.muted, fontSize: 12)),
                Text(_userEmail!, style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 12),
              ],
              const Text('Identifiant', style: TextStyle(color: NnColors.muted, fontSize: 12)),
              SelectableText(
                _deviceUid ?? 'Non enregistré',
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _busy ? null : _register,
                child: Text(_busy ? '…' : 'Enregistrer l’appareil'),
              ),
              if (_status != null) ...[
                const SizedBox(height: 10),
                Text(_status!, style: const TextStyle(fontSize: 13)),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'La synchronisation des fiches se fait automatiquement dès qu’il y a du réseau.',
          style: TextStyle(color: NnColors.muted, fontSize: 13, height: 1.35),
        ),
      ],
    );
  }
}
