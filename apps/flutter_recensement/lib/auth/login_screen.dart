import 'package:flutter/material.dart';

import '../auth/offline_auth_policy.dart';
import '../core/api_client.dart';
import '../core/auth_service.dart';
import '../core/secure_storage.dart';
import '../core/theme.dart';

/// Agent login: online JWT against API; offline within [OfflineAuthPolicy] window.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.allowAutoLogin = true});

  /// When false (après déconnexion manuelle), ne pas relancer AUTO_LOGIN.
  final bool allowAutoLogin;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  /// Build with `--dart-define=AUTO_LOGIN=true` to open the seeded agent session.
  static const _autoLogin = bool.fromEnvironment('AUTO_LOGIN');
  static const _demoEmail = 'agent.recensement@example.gov';
  static const _demoPassword = 'CensusAgent123!';

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
    if (_autoLogin && widget.allowAutoLogin) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _busy) return;
        _email.text = _demoEmail;
        _password.text = _demoPassword;
        _submit();
      });
    }
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
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFFE8F0FF), NnColors.page, Color(0xFFE6F7F2)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: NnColors.blue.withValues(alpha: 0.12),
                            blurRadius: 24,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.asset('assets/logo-rdc.jpg', height: 120, fit: BoxFit.contain),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'E-GOUV',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w800,
                              color: NnColors.ink,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Recensement terrain',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: NnColors.muted, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 24),
                          TextField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            autocorrect: false,
                            decoration: const InputDecoration(
                              labelText: 'Email agent',
                              prefixIcon: Icon(Icons.mail_outline),
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _password,
                            obscureText: true,
                            decoration: const InputDecoration(
                              labelText: 'Mot de passe',
                              prefixIcon: Icon(Icons.lock_outline),
                            ),
                            onSubmitted: (_) => _busy ? null : _submit(),
                          ),
                          if (_error != null) ...[
                            const SizedBox(height: 12),
                            Text(_error!, style: const TextStyle(color: NnColors.danger)),
                          ],
                          const SizedBox(height: 20),
                          FilledButton(
                            onPressed: _busy ? null : _submit,
                            child: _busy
                                ? const SizedBox(
                                    height: 18,
                                    width: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
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
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
