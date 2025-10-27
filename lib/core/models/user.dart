class User {
  const User({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
    this.avatarUrl,
    this.isOnline = false,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'].toString(),
      name: (json['name'] ?? json['phone'] ?? 'User') as String,
      phone: (json['phone'] ?? '') as String,
      email: json['email'] as String?,
      avatarUrl: json['avatar'] as String? ?? json['avatarUrl'] as String?,
      isOnline: json['isOnline'] == true,
    );
  }

  final String id;
  final String name;
  final String phone;
  final String? email;
  final String? avatarUrl;
  final bool isOnline;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        'email': email,
        'avatar': avatarUrl,
        'isOnline': isOnline,
      };

  User copyWith({
    String? id,
    String? name,
    String? phone,
    String? email,
    String? avatarUrl,
    bool? isOnline,
  }) {
    return User(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      isOnline: isOnline ?? this.isOnline,
    );
  }
}
