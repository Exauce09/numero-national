import 'package:flutter/material.dart';

import '../auth/offline_auth_policy.dart';
import '../core/secure_storage.dart';

/// Simple agent login screen. Online login stores tokens; offline continues
/// within [OfflineAuthPolicy] grace window.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _policy = OfflineAuthPolicy();
  bool _busy = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // MVP: accept any non-empty credentials and store a local session marker.
      // Wire to POST /api/v1/auth/login when IAM phase is deployed.
      if (_email.text.isEmpty || _password.text.isEmpty) {
        setState(() => _error = 'Identifiants requis');
        return;
      }
      await SecureStore.instance.saveTokens(
        access: 'local-dev-access',
        refresh: 'local-dev-refresh',
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed('/home');
    } catch (e) {
      final offlineOk = await _policy.canWorkOffline();
      if (offlineOk && mounted) {
        Navigator.of(context).pushReplacementNamed('/home');
        return;
      }
      setState(() => _error = 'Connexion impossible: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _continueOffline() async {
    if (await _policy.mayCollect()) {
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed('/home');
    } else {
      setState(() => _error = 'Session hors-ligne expirée — reconnectez-vous.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 48),
              Text(
                'Recensement National',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              Text(
                'Connexion agent terrain',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _email,
                decoration: const InputDecoration(labelText: 'Email / matricule'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _password,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Mot de passe'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Se connecter'),
              ),
              TextButton(
                onPressed: _busy ? null : _continueOffline,
                child: const Text('Continuer hors ligne'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
