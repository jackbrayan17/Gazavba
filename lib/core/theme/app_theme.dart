import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class AppTheme {
  const AppTheme._();

  // Brand palette
  static const _gazavbaDark = Color(0xFF09392D);
  static const _gazavbaGreen = Color(0xFF389038);
  static const _gazavbaLight = Color(0xFF94D358);
  static const _gazavbaYellow = Color(0xFFFFC80D);

  static const _lightSurface = Color(0xFFF3F8F1);
  static const _darkSurface = Color(0xFF09392D);

  static const ColorScheme _lightColors = ColorScheme(
    brightness: Brightness.light,
    primary: _gazavbaGreen,
    onPrimary: Colors.white,
    secondary: _gazavbaLight,
    onSecondary: _gazavbaDark,
    tertiary: _gazavbaYellow,
    onTertiary: _gazavbaDark,
    error: Color(0xFFBA1A1A),
    onError: Colors.white,
    // background: _lightSurface, // Deprecated
    // onBackground: _gazavbaDark, // Deprecated
    surface: Colors.white,
    onSurface: _gazavbaDark,
    surfaceVariant: Color(0xFFE1EFE0),
    onSurfaceVariant: Color(0xFF3B524B),
    outline: Color(0xFF79747E),
    outlineVariant: Color(0xFFC4C8BB),
    shadow: Colors.black54,
    scrim: Colors.black87,
    inverseSurface: _gazavbaDark,
    onInverseSurface: _gazavbaYellow,
    inversePrimary: _gazavbaLight,
    surfaceTint: _gazavbaGreen,
  );

  static const ColorScheme _darkColors = ColorScheme(
    brightness: Brightness.dark,
    primary: _gazavbaLight,
    onPrimary: _gazavbaDark,
    secondary: _gazavbaYellow,
    onSecondary: _gazavbaDark,
    tertiary: _gazavbaGreen,
    onTertiary: Colors.white,
    error: Color(0xFFFFB4AB),
    onError: Color(0xFF690005),
    // background: _darkSurface, // Deprecated
    // onBackground: Color(0xFFE7F4E5), // Deprecated
    surface: _darkSurface,
    onSurface: Color(0xFFE7F4E5),
    surfaceVariant: Color(0xFF144D3D),
    onSurfaceVariant: Color(0xFFC6D9CF),
    outline: Color(0xFF8D9199),
    outlineVariant: Color(0xFF43474E),
    shadow: Colors.black,
    scrim: Colors.black87,
    inverseSurface: _lightSurface,
    onInverseSurface: _gazavbaDark,
    inversePrimary: _gazavbaGreen,
    surfaceTint: _gazavbaLight,
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
          brightness == Brightness.light ? _lightSurface : _darkSurface,
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: colors.surface,
        foregroundColor: colors.onSurface,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w700,
          color: colors.onSurface,
        ),
        systemOverlayStyle: brightness == Brightness.dark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: colors.surface,
        indicatorColor: colors.primary.withOpacity(0.3),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return IconThemeData(color: colors.onPrimary);
          }
          return IconThemeData(color: colors.onSurfaceVariant);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final style = textTheme.labelMedium;
          if (states.contains(WidgetState.selected)) {
            return style?.copyWith(
              color: colors.onSurface,
              fontWeight: FontWeight.w600,
            );
          }
          return style?.copyWith(color: colors.onSurfaceVariant);
        }),
      ),
      cardTheme: CardThemeData(
        color: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
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
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          textStyle:
              textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          textStyle:
              textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: colors.secondary,
          textStyle:
              textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: colors.tertiary,
        foregroundColor: colors.onTertiary,
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: colors.surfaceVariant,
        selectedColor: colors.primary.withOpacity(0.2),
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
          borderSide: BorderSide(color: colors.primary, width: 2),
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
        backgroundColor: colors.inverseSurface,
        contentTextStyle:
            textTheme.bodyMedium?.copyWith(color: colors.onInverseSurface),
        actionTextColor: colors.primary,
        elevation: 4,
        behavior: SnackBarBehavior.floating,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return colors.primary;
          }
          return colors.outlineVariant;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return colors.primary.withOpacity(0.35);
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
