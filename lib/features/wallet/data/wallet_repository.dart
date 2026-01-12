import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logging/logging.dart';

import '../../../core/models/wallet.dart';
import '../../../core/services/api_client.dart';
import '../../auth/controllers/auth_controller.dart';

final Logger _walletLogger = Logger('Wallet');

final walletRepositoryProvider = Provider<WalletRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  return WalletRepository(client);
});

final walletInfoProvider = FutureProvider<WalletInfo?>((ref) async {
  final userId =
      ref.watch(authControllerProvider.select((state) => state.user?.id));
  if (userId == null) return null;
  final repository = ref.watch(walletRepositoryProvider);
  try {
    return await repository.fetchWalletStatus();
  } catch (error, stack) {
    _walletLogger.warning('Wallet fetch failed', error, stack);
    return const WalletInfo(walletExists: false);
  }
});

class WalletRepository {
  WalletRepository(this._client) : _logger = Logger('WalletRepository');

  final ApiClient _client;
  final Logger _logger;

  Future<WalletInfo> fetchWalletStatus({String action = 'dashboard'}) async {
    final payload = await _client.post('/wallet', data: {'action': action});
    final walletExists = payload['wallet_exists'];
    final error = payload['error'];
    if (error != null) {
      _logger.warning('Wallet response error: $error');
    } else {
      _logger.fine('Wallet response wallet_exists=$walletExists');
    }
    return WalletInfo.fromJson(payload);
  }
}
