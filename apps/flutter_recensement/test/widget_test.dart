import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_recensement/core/config.dart';

void main() {
  test('AppConfig exposes API base URL', () {
    expect(AppConfig.apiBaseUrl.contains('/api/v1'), isTrue);
    expect(AppConfig.appVersion, isNotEmpty);
  });
}
