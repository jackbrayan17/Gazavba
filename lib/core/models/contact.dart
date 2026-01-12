import '../utils/url_utils.dart';

class Contact {
  const Contact({
    required this.id,
    required this.name,
    required this.phone,
    this.avatarUrl,
    this.hasAccount = false,
    this.accountUserId,
    this.lastInteraction,
    this.isFavourite = false,
    this.isInContacts = false,
  });

  factory Contact.fromJson(Map<String, dynamic> json) {
    return Contact(
      id: (json['id'] ?? json['contactId'] ?? json['userId'] ?? '').toString(),
      name: (json['name'] ?? json['displayName'] ?? 'Contact') as String,
      phone: (json['phone'] ?? json['phoneNumber'] ?? '') as String,
      avatarUrl: UrlUtils.resolveMediaUrl(
        json['avatar'] as String? ?? json['avatarUrl'] as String?,
      ),
      hasAccount: json['hasAccount'] == true ||
          json['isRegistered'] == true ||
          json['isInContacts'] == true ||
          json['hasAccountUserId'] != null ||
          (json['contactId'] != null &&
              json['contactId'].toString().isNotEmpty),
      accountUserId: json['hasAccountUserId']?.toString() ??
          json['accountUserId']?.toString() ??
          (json['hasAccount'] == true
              ? json['hasAccountUserId']?.toString() ??
                  json['userId']?.toString()
              : null),
      lastInteraction: DateTime.tryParse(json['viewedAt'] as String? ??
              json['lastInteraction'] as String? ??
              json['lastSeen'] as String? ??
              '') ??
          (json['viewedAt'] is int
              ? DateTime.fromMillisecondsSinceEpoch(json['viewedAt'] as int)
              : null),
      isFavourite: json['isFavourite'] == true,
      isInContacts: json['isInContacts'] == true ||
          (json['contactId'] != null &&
              json['contactId'].toString().isNotEmpty),
    );
  }

  final String id;
  final String name;
  final String phone;
  final String? avatarUrl;
  final bool hasAccount;
  final String? accountUserId;
  final DateTime? lastInteraction;
  final bool isFavourite;
  final bool isInContacts;

  Contact copyWith({
    String? name,
    String? phone,
    String? avatarUrl,
    bool? hasAccount,
    String? accountUserId,
    DateTime? lastInteraction,
    bool? isFavourite,
    bool? isInContacts,
  }) {
    return Contact(
      id: id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      hasAccount: hasAccount ?? this.hasAccount,
      accountUserId: accountUserId ?? this.accountUserId,
      lastInteraction: lastInteraction ?? this.lastInteraction,
      isFavourite: isFavourite ?? this.isFavourite,
      isInContacts: isInContacts ?? this.isInContacts,
    );
  }
}
