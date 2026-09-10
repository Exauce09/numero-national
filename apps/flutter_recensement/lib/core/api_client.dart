import 'dart:async';
import 'dart:convert';
import 'dart:io';

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

/// HTTP client against [AppConfig.apiBaseUrl] with Bearer + refresh + timeouts.
class ApiClient {
  ApiClient({http.Client? client, SecureStore? store})
      : _client = client ?? http.Client(),
        _store = store ?? SecureStore.instance;

  final http.Client _client;
  final SecureStore _store;

  /// Keep requests snappy on bad Wi‑Fi / wrong IP (was hanging 1–2+ minutes).
  static const Duration requestTimeout = Duration(seconds: 12);

  Future<Uri> _uri(String path) async {
    final base = (await AppConfig.effectiveApiBaseUrl()).replaceAll(RegExp(r'/+$'), '');
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
    return _send(() async {
      final uri = await _uri(path);
      return _client.get(uri, headers: await _headers(auth: auth)).timeout(requestTimeout);
    });
  }

  Future<http.Response> post(
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    return _send(() async {
      final uri = await _uri(path);
      return _client
          .post(
            uri,
            headers: await _headers(auth: auth),
            body: body == null ? null : jsonEncode(body),
          )
          .timeout(requestTimeout);
    });
  }

  Future<http.Response> _send(Future<http.Response> Function() call) async {
    try {
      var res = await call();
      if (res.statusCode != 401) return res;

      final refreshed = await _tryRefresh();
      if (!refreshed) return res;
      return call();
    } on TimeoutException {
      final base = await AppConfig.effectiveApiBaseUrl();
      throw ApiException(
        'Délai dépassé — l’API ne répond pas ($base). '
        'Vérifiez le Wi‑Fi et l’adresse IP du serveur.',
        statusCode: 408,
      );
    } on SocketException catch (e) {
      final base = await AppConfig.effectiveApiBaseUrl();
      throw ApiException(
        'Réseau inaccessible ($base). '
        'Le téléphone doit être sur le même Wi‑Fi que le PC. (${e.message})',
        statusCode: 503,
      );
    } on http.ClientException catch (e) {
      final base = await AppConfig.effectiveApiBaseUrl();
      throw ApiException(
        'Connexion API impossible ($base). ${e.message}',
        statusCode: 503,
      );
    }
  }

  Future<bool> _tryRefresh() async {
    final refresh = await _store.refreshToken;
    if (refresh == null || refresh.isEmpty) return false;
    try {
      final uri = await _uri('/auth/refresh');
      final res = await _client
          .post(
            uri,
            headers: await _headers(auth: false),
            body: jsonEncode({'refresh_token': refresh}),
          )
          .timeout(requestTimeout);
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
    // Map JWT noise to actionable French.
    if (detail.contains('Could not validate credentials') ||
        detail.contains('Not authenticated') ||
        detail.contains('Invalid token')) {
      detail =
          'Session invalide ou serveur différent (jeton JWT). '
          'Reconnectez-vous. Si ça continue : reconstruit l’APK avec la bonne IP API.';
    }
    if (detail.contains('Incorrect email or password')) {
      detail = 'Email ou mot de passe incorrect';
    }
    throw ApiException(detail, statusCode: res.statusCode, body: res.body);
  }
}
