import 'secure_storage.dart';

/// Application configuration for census field agents.
class AppConfig {
  /// Compile-time default (emulator / build script).
  /// Override: `flutter run --dart-define=API_BASE_URL=http://192.168.x.x:8000/api/v1`
  static const String compileTimeApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api/v1',
  );

  /// Max hours an agent may work offline after last successful auth.
  static const int offlineAuthMaxHours = 72;

  static const String appVersion = '0.3.2';

  /// Runtime override stored on device (login screen) wins over compile-time.
  static Future<String> effectiveApiBaseUrl() async {
    final override = await SecureStore.instance.apiBaseUrl;
    if (override != null && override.trim().isNotEmpty) {
      return override.trim().replaceAll(RegExp(r'/+$'), '');
    }
    return compileTimeApiBaseUrl.replaceAll(RegExp(r'/+$'), '');
  }

  @Deprecated('Use effectiveApiBaseUrl()')
  static String get apiBaseUrl => compileTimeApiBaseUrl;
}
