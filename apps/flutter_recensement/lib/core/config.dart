import 'morpho_fingerprint.dart';
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

  static const String appVersion = '0.3.4';

  /// Profil appareil : `standard` | `fingerprint` (MorphoTablet) | `pos`.
  static const String deviceProfile = String.fromEnvironment(
    'DEVICE_PROFILE',
    defaultValue: 'standard',
  );

  /// Rempli au démarrage si MorphoTablet / CBM-E3 détecté (indépendant du dart-define).
  static bool _runtimeMorphoTablet = false;

  static bool get isFingerprintDevice =>
      deviceProfile == 'fingerprint' || _runtimeMorphoTablet;

  static bool get isPosDevice => deviceProfile == 'pos';

  /// Appeler avant runApp pour activer le chemin Morpho sur tablette optique.
  static Future<void> initDeviceProfile() async {
    if (deviceProfile == 'fingerprint') {
      _runtimeMorphoTablet = true;
      return;
    }
    try {
      final hw = await MorphoFingerprint.detectHardware();
      _runtimeMorphoTablet =
          hw['isMorphoTablet'] == true || hw['hasCbmE3'] == true;
    } catch (_) {
      _runtimeMorphoTablet = false;
    }
  }

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
