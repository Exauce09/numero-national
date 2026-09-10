import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Charte RDC — blanc + bleu / jaune / rouge.
class NnColors {
  static const rdcBlue = Color(0xFF007FFF);
  static const rdcYellow = Color(0xFFF7D618);
  static const rdcRed = Color(0xFFCE1126);
  static const blue = rdcBlue;
  static const blueDark = Color(0xFF005BB5);
  static const ink = Color(0xFF152033);
  static const muted = Color(0xFF5A6B82);
  static const line = Color(0xFFE4EAF2);
  static const page = Color(0xFFF5F7FB);
  static const card = Color(0xFFFFFFFF);
  static const save = rdcRed;
  static const success = Color(0xFF0F6B45);
  static const warning = Color(0xFFB8860B);
  static const danger = Color(0xFFB42318);
  static const softBlue = Color(0xFFEAF3FF);
  static const softGreen = Color(0xFFEEFBF4);
  static const softOrange = Color(0xFFFFF8E6);
  static const softRed = Color(0xFFFFF5F5);
}

/// Bandeau tricolore RDC.
class RdcStripe extends StatelessWidget {
  const RdcStripe({super.key, this.height = 4});
  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: const Row(
        children: [
          Expanded(child: ColoredBox(color: NnColors.rdcBlue)),
          Expanded(child: ColoredBox(color: NnColors.rdcYellow)),
          Expanded(child: ColoredBox(color: NnColors.rdcRed)),
        ],
      ),
    );
  }
}

class AppTheme {
  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: NnColors.page,
      colorScheme: ColorScheme.fromSeed(
        seedColor: NnColors.rdcBlue,
        primary: NnColors.rdcBlue,
        secondary: NnColors.rdcYellow,
        error: NnColors.rdcRed,
        surface: NnColors.card,
        brightness: Brightness.light,
      ),
    );
    return base.copyWith(
      appBarTheme: const AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: NnColors.card,
        foregroundColor: NnColors.ink,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        titleTextStyle: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: NnColors.ink,
        ),
      ),
      cardTheme: CardThemeData(
        color: NnColors.card,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: NnColors.line),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: NnColors.card,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: NnColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: NnColors.rdcBlue, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: NnColors.rdcBlue,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(50),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: NnColors.ink,
          minimumSize: const Size.fromHeight(50),
          side: const BorderSide(color: NnColors.line),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: NnColors.card,
        indicatorColor: NnColors.softBlue,
        labelTextStyle: WidgetStateProperty.resolveWith((s) {
          final selected = s.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? NnColors.rdcBlue : NnColors.muted,
          );
        }),
      ),
    );
  }
}
