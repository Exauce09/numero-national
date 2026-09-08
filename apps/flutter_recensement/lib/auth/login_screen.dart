import 'package:flutter/material.dart';

import '../auth/offline_auth_policy.dart';
import '../core/api_client.dart';
import '../core/auth_service.dart';
import '../core/secure_storage.dart';

/// Agent login: online JWT against API; offline within [OfflineAuthPolicy] window.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _policy = OfflineAuthPolicy();
  final _auth = AuthService();
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _prefillEmail();
  }

  Future<void> _prefillEmail() async {
    final email = await SecureStore.instance.userEmail;
    if (email != null && email.isNotEmpty && mounted) {
      _email.text = email;
    }
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final email = _email.text.trim();
      final password = _password.text;
      if (email.isEmpty || password.isEmpty) {
        setState(() => _error = 'Email et mot de passe requis');
        return;
      }

      await _auth.login(email, password);
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed('/home');
    } on ApiException catch (e) {
      // Offline fallback: existing session still valid.
      if (await _policy.mayCollect() && mounted) {
        Navigator.of(context).pushReplacementNamed('/home');
        return;
      }
      setState(() => _error = e.message);
    } catch (e) {
      if (await _policy.mayCollect() && mounted) {
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
      setState(() => _error = 'Session hors-ligne expirée — reconnectez-vous en ligne.');
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
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
                        keyboardType: TextInputType.emailAddress,
                        autocorrect: false,
                        decoration: const InputDecoration(
                          labelText: 'Email agent',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _password,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'Mot de passe',
                          border: OutlineInputBorder(),
                        ),
                        onSubmitted: (_) => _busy ? null : _submit(),
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
