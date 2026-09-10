import 'package:uuid/uuid.dart';

import 'api_client.dart';
import 'config.dart';
import 'secure_storage.dart';

class AuthUser {
  AuthUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.roles,
  });

  final String id;
  final String email;
  final String fullName;
  final List<String> roles;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'].toString(),
      email: json['email']?.toString() ?? '',
      fullName: json['full_name']?.toString() ?? '',
      roles: (json['roles'] as List?)?.map((e) => e.toString()).toList() ?? const [],
    );
  }
}

class AuthService {
  AuthService({ApiClient? client, SecureStore? store})
      : _api = client ?? ApiClient(),
        _store = store ?? SecureStore.instance;

  final ApiClient _api;
  final SecureStore _store;

  Future<AuthUser> login(String email, String password) async {
    // Drop stale JWT from a previous API/secret before requesting a new pair.
    await _store.clearSession();

    final res = await _api.post(
      '/auth/login',
      auth: false,
      body: {
        'email': email.trim(),
        'password': password,
      },
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      if (res.statusCode == 401) {
        throw ApiException('Email ou mot de passe incorrect', statusCode: 401);
      }
      if (res.statusCode == 429) {
        throw ApiException('Trop de tentatives — réessayez plus tard', statusCode: 429);
      }
      _api.throwFor(res, 'Connexion impossible');
    }
    final tokens = _api.decodeMap(res);
    final access = tokens['access_token']?.toString();
    final refresh = tokens['refresh_token']?.toString();
    if (access == null || access.isEmpty || refresh == null || refresh.isEmpty) {
      throw ApiException('Réponse login incomplete (jetons manquants)');
    }
    await _store.saveTokens(access: access, refresh: refresh);

    final me = await this.me();
    await _store.saveUser(id: me.id, email: me.email);
    await ensureDeviceRegistered(agentUserId: me.id);
    return me;
  }

  Future<AuthUser> me() async {
    final res = await _api.get('/auth/me');
    if (res.statusCode < 200 || res.statusCode >= 300) {
      _api.throwFor(res, 'Session invalide');
    }
    return AuthUser.fromJson(_api.decodeMap(res));
  }

  Future<void> logout() async {
    final refresh = await _store.refreshToken;
    if (refresh != null && refresh.isNotEmpty) {
      try {
        await _api.post('/auth/logout', body: {'refresh_token': refresh}, auth: false);
      } catch (_) {}
    }
    await _store.clearSession();
  }

  Future<String> ensureDeviceRegistered({String? agentUserId}) async {
    var uid = await _store.deviceUid;
    uid ??= const Uuid().v4();
    await _store.saveDeviceUid(uid);

    final body = <String, dynamic>{
      'device_uid': uid,
      'platform': 'android',
      'app_version': AppConfig.appVersion,
    };
    final agent = agentUserId ?? await _store.userId;
    if (agent != null && agent.isNotEmpty) {
      body['agent_user_id'] = agent;
    }

    try {
      final res = await _api.post('/census/devices/register', body: body, auth: true);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return uid;
      }
    } catch (_) {
      // Keep local UID for offline use.
    }
    return uid;
  }
}
