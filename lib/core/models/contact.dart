class Contact {
  const Contact({
    required this.id,
    required this.name,
    required this.phone,
    this.avatarUrl,
    this.hasAccount = false,
    this.lastInteraction,
    this.isFavourite = false,
  });

  factory Contact.fromJson(Map<String, dynamic> json) {
    return Contact(
      id: json['id'].toString(),
      name: (json['name'] ?? json['displayName'] ?? 'Contact') as String,
      phone: (json['phone'] ?? json['phoneNumber'] ?? '') as String,
      avatarUrl: json['avatar'] as String? ?? json['avatarUrl'] as String?,
      hasAccount: json['hasAccount'] == true || json['isRegistered'] == true,
      lastInteraction: DateTime.tryParse(
        json['lastInteraction'] as String? ?? json['lastSeen'] as String? ?? '',
      ),
      isFavourite: json['isFavourite'] == true,
    );
  }

  final String id;
  final String name;
  final String phone;
  final String? avatarUrl;
  final bool hasAccount;
  final DateTime? lastInteraction;
  final bool isFavourite;

  Contact copyWith({
    String? name,
    String? phone,
    String? avatarUrl,
    bool? hasAccount,
    DateTime? lastInteraction,
    bool? isFavourite,
  }) {
    return Contact(
      id: id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      hasAccount: hasAccount ?? this.hasAccount,
      lastInteraction: lastInteraction ?? this.lastInteraction,
      isFavourite: isFavourite ?? this.isFavourite,
    );
  }
}
