import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// E-GOUV RDC tokens — layout inspiré dashboards modernes, pas le look HR.
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
  static const success = Color(0xFF22A06B);
  static const warning = Color(0xFFE2A03F);
  static const danger = Color(0xFFE11D48);
  static const softBlue = Color(0xFFEAF4FF);
  static const softGreen = Color(0xFFEEFBF4);
  static const softOrange = Color(0xFFFFF8E8);
  static const softRed = Color(0xFFFFF5F5);
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
          backgroundColor: NnColors.rdcBlue,
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
