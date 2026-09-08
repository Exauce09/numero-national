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
      backgroundColor: const Color(0xFFEEF5F8),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Card(
                elevation: 4,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Image.asset('assets/logo-rdc.jpg', height: 140),
                      const SizedBox(height: 12),
                      Text(
                        'E-GOUV — Recensement',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF2A3547),
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Connexion agent terrain',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: const Color(0xFF5A6A85),
                            ),
                      ),
                      const SizedBox(height: 28),
                      TextField(
                        controller: _email,
                        decoration: const InputDecoration(
                          labelText: "Nom d'utilisateur",
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _password,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'Mot de Passe',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          _error!,
                          style: TextStyle(color: Theme.of(context).colorScheme.error),
                        ),
                      ],
                      const SizedBox(height: 20),
                      FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF5D87FF),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        onPressed: _busy ? null : _submit,
                        child: _busy
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
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
            ),
          ),
        ),
      ),
    );
  }
}
