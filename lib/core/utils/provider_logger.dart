import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logging/logging.dart';

class AppProviderObserver extends ProviderObserver {
  const AppProviderObserver();

  static final _logger = Logger('Provider');

  @override
  void didUpdateProvider(
    ProviderBase<Object?> provider,
    Object? previousValue,
    Object? newValue,
    ProviderContainer container,
  ) {
    _logger.fine(
      'provider=${provider.name ?? provider.runtimeType} '
      'old=${previousValue?.runtimeType} new=${newValue?.runtimeType}',
    );
  }
}
