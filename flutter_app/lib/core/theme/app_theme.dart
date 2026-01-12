import 'package:flutter/material.dart';

class AppTheme {
  const AppTheme._();

  static const _gazavbaDark = Color(0xFF09392D);
  static const _gazavbaGreen = Color(0xFF389038);
  static const _gazavbaLight = Color(0xFF94D358);
  static const _gazavbaYellow = Color(0xFFFFC80D);
  static const _lightSurface = Color(0xFFF3F8F1);

  static const ColorScheme _colorScheme = ColorScheme(
    brightness: Brightness.light,
    primary: _gazavbaGreen,
    onPrimary: Colors.white,
    secondary: _gazavbaLight,
    onSecondary: _gazavbaDark,
    tertiary: _gazavbaYellow,
    onTertiary: _gazavbaDark,
    error: Color(0xFFBA1A1A),
    onError: Colors.white,
    surface: Colors.white,
    onSurface: _gazavbaDark,
    surfaceVariant: Color(0xFFE1EFE0),
    onSurfaceVariant: Color(0xFF3B524B),
    outline: Color(0xFF8A9188),
    outlineVariant: Color(0xFFC7D4C8),
    shadow: Colors.black54,
    scrim: Colors.black87,
    inverseSurface: _gazavbaDark,
    onInverseSurface: _gazavbaYellow,
    inversePrimary: _gazavbaLight,
    surfaceTint: _gazavbaGreen,
  );

  static ThemeData get light {
    final base = ThemeData(
      colorScheme: _colorScheme,
      useMaterial3: true,
    );

    return base.copyWith(
      scaffoldBackgroundColor: _lightSurface,
      appBarTheme: AppBarTheme(
        backgroundColor: _colorScheme.background,
        foregroundColor: _colorScheme.onBackground,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: base.textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w700,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: _colorScheme.primary,
        ),
      ),
    );
  }
}
