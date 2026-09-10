import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Thin wrapper around platform secure storage for tokens / device secrets.
class SecureStore {
  SecureStore._();
  static final SecureStore instance = SecureStore._();

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  static const _kAccess = 'access_token';
  static const _kRefresh = 'refresh_token';
  static const _kDevice = 'device_uid';
  static const _kLastAuth = 'last_auth_at';
  static const _kUserId = 'user_id';
  static const _kUserEmail = 'user_email';
  static const _kApiBase = 'api_base_url';

  Future<void> saveTokens({required String access, required String refresh}) async {
    await _storage.write(key: _kAccess, value: access);
    await _storage.write(key: _kRefresh, value: refresh);
    await _storage.write(key: _kLastAuth, value: DateTime.now().toUtc().toIso8601String());
  }

  Future<void> saveUser({required String id, required String email}) async {
    await _storage.write(key: _kUserId, value: id);
    await _storage.write(key: _kUserEmail, value: email);
  }

  Future<void> saveApiBaseUrl(String url) =>
      _storage.write(key: _kApiBase, value: url.trim().replaceAll(RegExp(r'/+$'), ''));

  Future<String?> get apiBaseUrl => _storage.read(key: _kApiBase);

  Future<String?> get accessToken => _storage.read(key: _kAccess);
  Future<String?> get refreshToken => _storage.read(key: _kRefresh);
  Future<String?> get lastAuthAt => _storage.read(key: _kLastAuth);
  Future<String?> get userId => _storage.read(key: _kUserId);
  Future<String?> get userEmail => _storage.read(key: _kUserEmail);

  Future<void> saveDeviceUid(String uid) => _storage.write(key: _kDevice, value: uid);
  Future<String?> get deviceUid => _storage.read(key: _kDevice);

  Future<void> clearSession() async {
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
    await _storage.delete(key: _kUserId);
    await _storage.delete(key: _kUserEmail);
    // Empêche la reprise « hors-ligne » après une déconnexion volontaire.
    await _storage.delete(key: _kLastAuth);
  }

  Future<void> clearAll() async {
    await clearSession();
    await _storage.delete(key: _kDevice);
    await _storage.delete(key: _kLastAuth);
    await _storage.delete(key: _kApiBase);
  }
}
