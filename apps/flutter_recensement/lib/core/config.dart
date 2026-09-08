/// Application configuration for census field agents.
class AppConfig {
  /// Override at build/run time:
  /// `flutter run --dart-define=API_BASE_URL=http://192.168.x.x:8000/api/v1`
  ///
  /// Defaults:
  /// - Android emulator → 10.0.2.2
  /// - Physical device → set API_BASE_URL to your PC LAN IP
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api/v1',
  );

  /// Max hours an agent may work offline after last successful auth.
  static const int offlineAuthMaxHours = 72;

  static const String appVersion = '0.1.0';
}
