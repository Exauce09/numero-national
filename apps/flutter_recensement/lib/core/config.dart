/// Application configuration for census field agents.
class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api/v1',
  );

  /// Max hours an agent may work offline after last successful auth.
  static const int offlineAuthMaxHours = 72;

  static const String appVersion = '0.1.0';
}
