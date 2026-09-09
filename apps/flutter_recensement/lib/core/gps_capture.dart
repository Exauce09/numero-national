import 'package:geolocator/geolocator.dart';

/// Capture GPS at save time. Returns null if permission/service unavailable.
class GpsCapture {
  GpsCapture._();

  static Future<({double lat, double lng})?> capture({
    Duration timeLimit = const Duration(seconds: 20),
  }) async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw StateError('Permission GPS refusée');
    }
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) {
      throw StateError('Activez la localisation sur l’appareil');
    }
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: timeLimit,
      ),
    );
    return (lat: pos.latitude, lng: pos.longitude);
  }
}
