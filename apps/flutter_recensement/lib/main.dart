import 'package:flutter/material.dart';

import 'auth/login_screen.dart';
import 'core/auth_service.dart';
import 'core/theme.dart';
import 'features/census/campaigns_screen.dart';
import 'features/census/conflicts_screen.dart';
import 'features/census/home_dashboard_screen.dart';
import 'features/census/stats_screen.dart';
import 'features/device/device_registration.dart';
import 'sync/local_database.dart';
import 'sync/sync_lifecycle.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await LocalDatabase.instance.init();
  SyncLifecycle.instance.start();
  runApp(const RecensementApp());
}

class RecensementApp extends StatelessWidget {
  const RecensementApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ONIP Recensement',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: const LoginScreen(),
      routes: {
        '/home': (_) => const HomeShell(),
        '/campaigns': (_) => const CampaignsScreen(),
        '/stats': (_) => const StatsScreen(),
        '/device': (_) => const DeviceRegistrationScreen(),
        '/conflicts': (_) => const ConflictsScreen(),
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
  final _auth = AuthService();

  Future<void> _logout() async {
    await _auth.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => const LoginScreen(allowAutoLogin: false),
      ),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final titles = ['Accueil', 'Zones', 'Stats', 'Appareil'];
    final pages = [
      HomeDashboardScreen(onOpenTab: (i) => setState(() => _index = i)),
      const CampaignsScreen(),
      const StatsScreen(),
      const DeviceRegistrationScreen(),
    ];
    return Scaffold(
      backgroundColor: NnColors.page,
      appBar: AppBar(
        title: Text(titles[_index]),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(4),
          child: RdcStripe(height: 4),
        ),
        actions: [
          if (_index == 0)
            IconButton(
              tooltip: 'Conflits',
              onPressed: () => Navigator.of(context).pushNamed('/conflicts'),
              icon: const Icon(Icons.warning_amber_rounded),
            ),
          IconButton(
            tooltip: 'Déconnexion',
            onPressed: _logout,
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      body: pages[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Accueil'),
          NavigationDestination(icon: Icon(Icons.map_outlined), selectedIcon: Icon(Icons.map_rounded), label: 'Zones'),
          NavigationDestination(icon: Icon(Icons.bar_chart_outlined), selectedIcon: Icon(Icons.bar_chart_rounded), label: 'Stats'),
          NavigationDestination(icon: Icon(Icons.smartphone_outlined), selectedIcon: Icon(Icons.smartphone), label: 'Appareil'),
        ],
      ),
    );
  }
}
