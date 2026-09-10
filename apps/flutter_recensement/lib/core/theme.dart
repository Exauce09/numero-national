import 'package:flutter/material.dart';

/// Charte RDC — blanc + bleu / jaune / rouge.
class NnColors {
  static const rdcBlue = Color(0xFF007FFF);
  static const rdcYellow = Color(0xFFF7D618);
  static const rdcRed = Color(0xFFCE1126);
  static const blue = rdcBlue;
  static const blueDark = Color(0xFF0066CC);
  static const ink = Color(0xFF1A2332);
  static const muted = Color(0xFF5C6B82);
  static const line = Color(0xFFE6EBF2);
  static const page = Color(0xFFF7F9FC);
  static const card = Color(0xFFFFFFFF);
  static const save = rdcRed;
  static const success = Color(0xFF0F6B45);
  static const warning = Color(0xFFB8860B);
  static const danger = Color(0xFFB42318);
  static const softBlue = Color(0xFFEAF4FF);
  static const softGreen = Color(0xFFEEFBF4);
  static const softOrange = Color(0xFFFFF8E6);
  static const softRed = Color(0xFFFFF5F5);
}

class AppTheme {
  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: NnColors.page,
      fontFamily: 'Segoe UI',
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
        backgroundColor: NnColors.card,
        foregroundColor: NnColors.ink,
        titleTextStyle: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: NnColors.ink,
          fontFamily: 'Segoe UI',
        ),
      ),
      cardTheme: CardThemeData(
        color: NnColors.card,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
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
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      navigationBarTheme: const NavigationBarThemeData(
        backgroundColor: NnColors.card,
        indicatorColor: NnColors.softBlue,
      ),
    );
  }
}
