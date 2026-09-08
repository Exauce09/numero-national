import 'package:flutter/material.dart';

import 'auth/login_screen.dart';
import 'core/auth_service.dart';
import 'core/theme.dart';
import 'features/census/campaigns_screen.dart';
import 'features/census/stats_screen.dart';
import 'features/device/device_registration.dart';
import 'sync/local_database.dart';
import 'sync/sync_engine.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await LocalDatabase.instance.init();
  runApp(const RecensementApp());
}

class RecensementApp extends StatelessWidget {
  const RecensementApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Recensement National',
      theme: AppTheme.light(),
      home: const LoginScreen(),
      routes: {
        '/home': (_) => const HomeShell(),
        '/campaigns': (_) => const CampaignsScreen(),
        '/stats': (_) => const StatsScreen(),
        '/device': (_) => const DeviceRegistrationScreen(),
      },
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  final _sync = SyncEngine();
  final _auth = AuthService();

  Future<void> _logout() async {
    await _auth.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final pages = const [
      CampaignsScreen(),
      StatsScreen(),
      DeviceRegistrationScreen(),
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Recensement'),
        actions: [
          IconButton(
            tooltip: 'Synchroniser',
            onPressed: () async {
              final result = await _sync.runOnce();
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(result)),
                );
              }
            },
            icon: const Icon(Icons.sync),
          ),
          IconButton(
            tooltip: 'Déconnexion',
            onPressed: _logout,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: pages[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.map), label: 'Campagnes'),
          NavigationDestination(icon: Icon(Icons.bar_chart), label: 'Stats'),
          NavigationDestination(icon: Icon(Icons.phone_android), label: 'Appareil'),
        ],
      ),
    );
  }
}
