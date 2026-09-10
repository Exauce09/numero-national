import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

import 'local_database.dart';
import 'sync_engine.dart';
import 'sync_queue.dart';

/// Synchronisation automatique dès qu’il y a du réseau (pas de bouton obligatoire).
class SyncLifecycle {
  SyncLifecycle._();
  static final SyncLifecycle instance = SyncLifecycle._();

  StreamSubscription<List<ConnectivityResult>>? _sub;
  bool _running = false;
  Timer? _debounce;
  Timer? _periodic;

  void start() {
    _sub?.cancel();
    _sub = Connectivity().onConnectivityChanged.listen((results) {
      final online = results.any((r) => r != ConnectivityResult.none);
      if (online) _schedule();
    });
    // Premier essai au démarrage
    _schedule(delayMs: 1500);
    // Relance périodique (sans bouton)
    _periodic?.cancel();
    _periodic = Timer.periodic(const Duration(seconds: 45), (_) => _schedule(delayMs: 200));
  }

  void stop() {
    _debounce?.cancel();
    _periodic?.cancel();
    _sub?.cancel();
    _sub = null;
  }

  /// Appeler après enqueue (ménage / fiche) pour pousser dès que possible.
  void nudge() => _schedule(delayMs: 800);

  void _schedule({int delayMs = 2500}) {
    _debounce?.cancel();
    _debounce = Timer(Duration(milliseconds: delayMs), () {
      unawaited(_tick());
    });
  }

  Future<void> _tick() async {
    if (_running) return;
    _running = true;
    try {
      final online = await SyncEngine().isOnline;
      if (!online) return;
      final pending = await SyncQueue().pending();
      final status = await LocalDatabase.instance.getMeta('sync_status') ?? '';
      if (pending.isEmpty && status.toUpperCase().contains('SYNCED')) return;
      await LocalDatabase.instance.setMeta('sync_status', 'SYNCING');
      final msg = await SyncEngine().runOnce();
      debugPrint('AutoSync: $msg');
    } catch (e) {
      debugPrint('AutoSync error: $e');
    } finally {
      _running = false;
    }
  }
}
