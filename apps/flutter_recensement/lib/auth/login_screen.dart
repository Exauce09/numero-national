import 'package:flutter/material.dart';

import '../auth/offline_auth_policy.dart';
import '../core/api_client.dart';
import '../core/auth_service.dart';
import '../core/secure_storage.dart';
import '../core/theme.dart';

/// Connexion agent — écran sobre, marque RDC.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.allowAutoLogin = true});

  final bool allowAutoLogin;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  static const _autoLogin = bool.fromEnvironment('AUTO_LOGIN');
  static const _demoEmail = 'agent.recensement@example.gov';
  static const _demoPassword = 'CensusAgent123!';

  final _email = TextEditingController();
  final _password = TextEditingController();
  final _policy = OfflineAuthPolicy();
  final _auth = AuthService();
  bool _busy = false;
  bool _obscure = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _prefillEmail();
    if (_autoLogin && widget.allowAutoLogin) {
      _email.text = _demoEmail;
      _password.text = _demoPassword;
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
      setState(() => _error = 'Connexion impossible');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _continueOffline() async {
    if (await _policy.mayCollect()) {
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed('/home');
    } else {
      setState(() => _error = 'Session hors ligne expirée — reconnectez-vous.');
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
      backgroundColor: NnColors.page,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      color: NnColors.card,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: NnColors.line),
                      boxShadow: [
                        BoxShadow(
                          color: NnColors.ink.withValues(alpha: 0.05),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const RdcStripe(height: 5),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(22, 22, 22, 24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Center(
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Image.asset(
                                    'assets/logo-rdc.jpg',
                                    height: 88,
                                    fit: BoxFit.contain,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 16),
                              const Text(
                                'ONIP',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w900,
                                  color: NnColors.ink,
                                  letterSpacing: -0.4,
                                ),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                'Recensement national · RDC',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: NnColors.muted,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                ),
                              ),
                              const SizedBox(height: 28),
                              TextField(
                                controller: _email,
                                keyboardType: TextInputType.emailAddress,
                                autocorrect: false,
                                textInputAction: TextInputAction.next,
                                decoration: const InputDecoration(
                                  labelText: 'Identifiant',
                                  prefixIcon: Icon(Icons.person_outline),
                                ),
                              ),
                              const SizedBox(height: 12),
                              TextField(
                                controller: _password,
                                obscureText: _obscure,
                                textInputAction: TextInputAction.done,
                                onSubmitted: (_) => _busy ? null : _submit(),
                                decoration: InputDecoration(
                                  labelText: 'Mot de passe',
                                  prefixIcon: const Icon(Icons.lock_outline),
                                  suffixIcon: IconButton(
                                    onPressed: () => setState(() => _obscure = !_obscure),
                                    icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                                  ),
                                ),
                              ),
                              if (_error != null) ...[
                                const SizedBox(height: 12),
                                Text(
                                  _error!,
                                  style: const TextStyle(color: NnColors.danger, fontSize: 13),
                                ),
                              ],
                              const SizedBox(height: 22),
                              FilledButton(
                                onPressed: _busy ? null : _submit,
                                style: FilledButton.styleFrom(backgroundColor: NnColors.rdcRed),
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
                              const SizedBox(height: 8),
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
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
