import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// E-GOUV RDC tokens — layout inspiré dashboards modernes, pas le look HR.
class NnColors {
  static const blue = Color(0xFF5D87FF);
  static const blueDark = Color(0xFF4570EA);
  static const ink = Color(0xFF2A3547);
  static const muted = Color(0xFF5A6A85);
  static const line = Color(0xFFE5EAF2);
  static const page = Color(0xFFF5F7FB);
  static const card = Color(0xFFFFFFFF);
  static const save = Color(0xFFCE1126);
  static const success = Color(0xFF13DEB9);
  static const warning = Color(0xFFFFAE1F);
  static const danger = Color(0xFFFA896B);
  static const softBlue = Color(0xFFEBF3FE);
  static const softGreen = Color(0xFFE6FFFA);
  static const softOrange = Color(0xFFFEF5E5);
  static const softRed = Color(0xFFFBF2EF);
}

class AppTheme {
  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: NnColors.page,
      colorScheme: ColorScheme.fromSeed(
        seedColor: NnColors.blue,
        primary: NnColors.blue,
        secondary: NnColors.success,
        error: NnColors.danger,
        surface: NnColors.card,
        brightness: Brightness.light,
      ),
    );
    return base.copyWith(
      textTheme: GoogleFonts.plusJakartaSansTextTheme(base.textTheme).apply(
        bodyColor: NnColors.ink,
        displayColor: NnColors.ink,
      ),
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        backgroundColor: NnColors.card,
        foregroundColor: NnColors.ink,
        titleTextStyle: GoogleFonts.plusJakartaSans(
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
          borderSide: const BorderSide(color: NnColors.blue, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: NnColors.blue,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: NnColors.card,
        indicatorColor: NnColors.softBlue,
        labelTextStyle: WidgetStatePropertyAll(
          GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}
