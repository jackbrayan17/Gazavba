import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class AppTheme {
  const AppTheme._();

  static const _whatsAppGreen = Color(0xFF075E54);
  static const _whatsAppLight = Color(0xFFECE5DD);
  static const _accent = Color(0xFF25D366);
  static const _night = Color(0xFF0B141A);

  static const ColorScheme _lightColors = ColorScheme(
    brightness: Brightness.light,
    primary: _whatsAppGreen,
    onPrimary: Colors.white,
    secondary: _accent,
    onSecondary: Colors.white,
    error: Color(0xFFBA1A1A),
    onError: Colors.white,
    background: _whatsAppLight,
    onBackground: Color(0xFF111B21),
    surface: Colors.white,
    onSurface: Color(0xFF111B21),
    surfaceVariant: Color(0xFFF2F5F8),
    onSurfaceVariant: Color(0xFF54656F),
    tertiary: Color(0xFF34B7F1),
    onTertiary: Colors.white,
    outline: Color(0xFFCFD9DE),
    outlineVariant: Color(0xFFD8E2EB),
    shadow: Colors.black54,
    scrim: Colors.black87,
    inverseSurface: Color(0xFF1E2C34),
    onInverseSurface: Colors.white,
    inversePrimary: _accent,
    surfaceTint: _whatsAppGreen,
  );

  static const ColorScheme _darkColors = ColorScheme(
    brightness: Brightness.dark,
    primary: _accent,
    onPrimary: Colors.black,
    secondary: Color(0xFF128C7E),
    onSecondary: Colors.white,
    error: Color(0xFFFFB4AB),
    onError: Color(0xFF690005),
    background: _night,
    onBackground: Color(0xFFE9EDEF),
    surface: Color(0xFF1E2C34),
    onSurface: Color(0xFFE9EDEF),
    surfaceVariant: Color(0xFF24313A),
    onSurfaceVariant: Color(0xFFB3BDC6),
    tertiary: Color(0xFF34B7F1),
    onTertiary: Colors.black,
    outline: Color(0xFF334049),
    outlineVariant: Color(0xFF1A242B),
    shadow: Colors.black,
    scrim: Colors.black87,
    inverseSurface: _whatsAppLight,
    onInverseSurface: Color(0xFF111B21),
    inversePrimary: _whatsAppGreen,
    surfaceTint: Color(0xFF128C7E),
  );

  static ThemeData get light => _buildTheme(_lightColors, Brightness.light);

  static ThemeData get dark => _buildTheme(_darkColors, Brightness.dark);

  static ThemeData _buildTheme(ColorScheme colors, Brightness brightness) {
    final base = ThemeData(
      colorScheme: colors,
      useMaterial3: true,
      brightness: brightness,
      fontFamily: 'Roboto',
    );

    final textTheme = base.textTheme.apply(
      bodyColor: colors.onSurface,
      displayColor: colors.onSurface,
    );

    return base.copyWith(
      scaffoldBackgroundColor:
          brightness == Brightness.dark ? colors.background : colors.background,
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: colors.surface,
        foregroundColor: colors.onSurface,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w700,
        ),
        systemOverlayStyle: brightness == Brightness.dark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: colors.surface,
        indicatorColor: colors.secondary.withOpacity(0.18),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return IconThemeData(color: colors.primary);
          }
          return IconThemeData(color: colors.onSurfaceVariant);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final style = textTheme.labelMedium;
          if (states.contains(WidgetState.selected)) {
            return style?.copyWith(
              color: colors.primary,
              fontWeight: FontWeight.w600,
            );
          }
          return style?.copyWith(color: colors.onSurfaceVariant);
        }),
      ),
      cardTheme: CardTheme(
        color: colors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        elevation: brightness == Brightness.dark ? 0 : 2,
        margin: EdgeInsets.zero,
      ),
      listTileTheme: ListTileThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        iconColor: colors.primary,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: colors.primary,
          foregroundColor: colors.onPrimary,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          textStyle: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          textStyle: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: colors.primary,
          textStyle: textTheme.labelLarge,
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: colors.secondary,
        foregroundColor: colors.onSecondary,
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: colors.surfaceVariant,
        selectedColor: colors.secondary.withOpacity(0.18),
        labelStyle: textTheme.labelMedium,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: brightness == Brightness.dark
            ? colors.surfaceVariant.withOpacity(0.4)
            : colors.surfaceVariant,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24),
          borderSide: BorderSide(color: colors.outline.withOpacity(0.4)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24),
          borderSide: BorderSide(color: colors.primary),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        hintStyle: textTheme.bodyMedium?.copyWith(
          color: colors.onSurfaceVariant,
        ),
      ),
      dividerTheme: DividerThemeData(
        color: colors.outline.withOpacity(0.3),
        space: 0,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: colors.surface,
        contentTextStyle: textTheme.bodyMedium?.copyWith(
          color: colors.onSurface,
        ),
        actionTextColor: colors.secondary,
        elevation: 4,
        behavior: SnackBarBehavior.floating,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return colors.secondary;
          }
          return colors.outlineVariant;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return colors.secondary.withOpacity(0.35);
          }
          return colors.outline.withOpacity(0.2);
        }),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: colors.surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
      ),
    );
  }
}
