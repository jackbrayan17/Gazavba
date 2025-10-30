import 'dart:typed_data';

class User {
  const User({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
    this.avatarUrl,
    this.avatarBytes,
    this.isOnline = false,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    final dynamic avatarValue = json['avatar'] ?? json['avatarUrl'];
    String? avatarUrl;
    Uint8List? avatarBytes;
    if (avatarValue is String) {
      avatarUrl = avatarValue;
    } else if (avatarValue is Uint8List) {
      avatarBytes = avatarValue;
    } else if (avatarValue is List<int>) {
      avatarBytes = Uint8List.fromList(List<int>.from(avatarValue));
    }

    return User(
      id: json['id'].toString(),
      name: (json['name'] ?? json['phone'] ?? 'User') as String,
      phone: (json['phone'] ?? '') as String,
      email: json['email'] as String?,
      avatarUrl: avatarUrl,
      avatarBytes: avatarBytes,
      isOnline: json['isOnline'] == true,
    );
  }

  final String id;
  final String name;
  final String phone;
  final String? email;
  final String? avatarUrl;
  final Uint8List? avatarBytes;
  final bool isOnline;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        'email': email,
        'avatar': avatarUrl ?? avatarBytes,
        'isOnline': isOnline,
      };

  User copyWith({
    String? id,
    String? name,
    String? phone,
    String? email,
    String? avatarUrl,
    Uint8List? avatarBytes,
    bool? isOnline,
  }) {
    return User(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      avatarBytes: avatarBytes ?? this.avatarBytes,
      isOnline: isOnline ?? this.isOnline,
    );
  }
}
