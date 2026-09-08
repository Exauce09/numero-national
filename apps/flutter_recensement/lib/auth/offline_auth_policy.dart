import '../core/config.dart';
import '../core/secure_storage.dart';

/// Offline auth policy: allow limited field work after last online login.
class OfflineAuthPolicy {
  OfflineAuthPolicy({SecureStore? store}) : _store = store ?? SecureStore.instance;

  final SecureStore _store;

  Future<bool> canWorkOffline() async {
    final raw = await _store.lastAuthAt;
    if (raw == null) return false;
    final last = DateTime.tryParse(raw);
    if (last == null) return false;
    final max = Duration(hours: AppConfig.offlineAuthMaxHours);
    return DateTime.now().toUtc().difference(last) <= max;
  }

  Future<bool> hasSession() async {
    final token = await _store.accessToken;
    return token != null && token.isNotEmpty;
  }

  /// Agents may continue collecting if they have a token OR are within the
  /// offline grace window after a successful authentication.
  Future<bool> mayCollect() async {
    if (await hasSession()) return true;
    return canWorkOffline();
  }
}
