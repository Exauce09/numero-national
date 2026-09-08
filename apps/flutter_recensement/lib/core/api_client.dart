import 'dart:convert';

import 'package:http/http.dart' as http;

import 'config.dart';
import 'secure_storage.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.body});

  final String message;
  final int? statusCode;
  final String? body;

  @override
  String toString() => message;
}

/// HTTP client against [AppConfig.apiBaseUrl] with Bearer + refresh.
class ApiClient {
  ApiClient({http.Client? client, SecureStore? store})
      : _client = client ?? http.Client(),
        _store = store ?? SecureStore.instance;

  final http.Client _client;
  final SecureStore _store;

  Uri _uri(String path) {
    final base = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
    final p = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$base$p');
  }

  Future<Map<String, String>> _headers({bool auth = true}) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (auth) {
      final token = await _store.accessToken;
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    return headers;
  }

  Future<http.Response> get(String path, {bool auth = true}) async {
    return _send(() async => _client.get(_uri(path), headers: await _headers(auth: auth)));
  }

  Future<http.Response> post(
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    return _send(
      () async => _client.post(
        _uri(path),
        headers: await _headers(auth: auth),
        body: body == null ? null : jsonEncode(body),
      ),
    );
  }

  Future<http.Response> _send(Future<http.Response> Function() call) async {
    var res = await call();
    if (res.statusCode != 401) return res;

    final refreshed = await _tryRefresh();
    if (!refreshed) return res;
    return call();
  }

  Future<bool> _tryRefresh() async {
    final refresh = await _store.refreshToken;
    if (refresh == null || refresh.isEmpty) return false;
    try {
      final res = await _client.post(
        _uri('/auth/refresh'),
        headers: await _headers(auth: false),
        body: jsonEncode({'refresh_token': refresh}),
      );
      if (res.statusCode < 200 || res.statusCode >= 300) {
        await _store.clearSession();
        return false;
      }
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      await _store.saveTokens(
        access: data['access_token'] as String,
        refresh: data['refresh_token'] as String,
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  Map<String, dynamic> decodeMap(http.Response res) {
    if (res.body.isEmpty) return {};
    final decoded = jsonDecode(res.body);
    if (decoded is Map<String, dynamic>) return decoded;
    throw ApiException('Réponse JSON inattendue', statusCode: res.statusCode, body: res.body);
  }

  List<dynamic> decodeList(http.Response res) {
    if (res.body.isEmpty) return [];
    final decoded = jsonDecode(res.body);
    if (decoded is List) return decoded;
    throw ApiException('Réponse liste inattendue', statusCode: res.statusCode, body: res.body);
  }

  Never throwFor(http.Response res, String fallback) {
    String detail = fallback;
    try {
      final body = jsonDecode(res.body);
      if (body is Map && body['detail'] != null) {
        final d = body['detail'];
        detail = d is String ? d : d.toString();
      }
    } catch (_) {}
    throw ApiException(detail, statusCode: res.statusCode, body: res.body);
  }
}
