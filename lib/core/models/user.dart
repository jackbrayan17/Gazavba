import '../utils/url_utils.dart';

class User {
  const User({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
    this.avatarUrl,
    this.bio,
    this.isOnline = false,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: (json['id'] ?? json['userId'] ?? '').toString(),
      name: (json['name'] ?? json['displayName'] ?? json['phone'] ?? 'User')
          as String,
      phone: (json['phone'] ?? json['phoneNumber'] ?? '') as String,
      email: json['email'] as String?,
      avatarUrl: UrlUtils.resolveMediaUrl(
        json['avatar'] as String? ?? json['avatarUrl'] as String?,
      ),
      bio: json['bio'] as String?,
      isOnline: json['isOnline'] == true,
    );
  }

  final String id;
  final String name;
  final String phone;
  final String? email;
  final String? avatarUrl;
  final String? bio;
  final bool isOnline;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        'email': email,
        'avatar': avatarUrl,
        'bio': bio,
        'isOnline': isOnline,
      };

  User copyWith({
    String? id,
    String? name,
    String? phone,
    String? email,
    String? avatarUrl,
    String? bio,
    bool? isOnline,
  }) {
    return User(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      bio: bio ?? this.bio,
      isOnline: isOnline ?? this.isOnline,
    );
  }
}
