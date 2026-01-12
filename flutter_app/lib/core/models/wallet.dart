class WalletInfo {
  const WalletInfo({
    required this.walletExists,
    this.balance,
    this.currency,
    this.walletStatus,
    this.kycStatus,
    this.emailVerified,
    this.redirectUrl,
  });

  final bool walletExists;
  final String? balance;
  final String? currency;
  final String? walletStatus;
  final String? kycStatus;
  final bool? emailVerified;
  final String? redirectUrl;

  factory WalletInfo.fromJson(Map<String, dynamic> json) {
    return WalletInfo(
      walletExists:
          json['wallet_exists'] == true || json['walletExists'] == true,
      balance: json['balance']?.toString(),
      currency: json['currency']?.toString(),
      walletStatus:
          json['wallet_status']?.toString() ?? json['walletStatus']?.toString(),
      kycStatus:
          json['kyc_status']?.toString() ?? json['kycStatus']?.toString(),
      emailVerified:
          json['email_verified'] == true || json['emailVerified'] == true,
      redirectUrl:
          json['redirect_url']?.toString() ?? json['redirectUrl']?.toString(),
    );
  }

  String get displayBalance {
    if (!walletExists) return 'No Wallet';
    final amount = balance?.trim();
    final curr = currency?.trim();
    if (amount == null || amount.isEmpty) return 'Wallet';
    if (curr == null || curr.isEmpty) return amount;
    return '$amount $curr';
  }
}
