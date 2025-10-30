import 'dart:async';
import 'dart:typed_data';

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';
import 'package:sqflite/utils/utils.dart' as sqflite_utils;
import 'package:uuid/uuid.dart';

import '../utils/exceptions.dart';

class AppDatabase {
  AppDatabase._(this._db);

  final Database _db;
  static const _uuid = Uuid();

  static Future<AppDatabase> open() async {
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, 'gazavba.db');
    final db = await openDatabase(
      path,
      version: 1,
      onCreate: (database, version) async {
        await _createSchema(database);
        await _seedStaticUsers(database);
      },
    );
    return AppDatabase._(db);
  }

  Future<void> init() async {
    // No-op for now, kept for parity with previous API client initialisation.
  }

  Future<Map<String, dynamic>> login({
    required String phone,
    required String password,
  }) async {
    final user = await _getUserByPhone(phone);
    if (user == null || (user['password'] as String) != password) {
      throw ApiException('Numéro ou mot de passe invalide', statusCode: 401);
    }

    final userId = user['id'] as int;
    await ensureDemoConversationsForUser(userId);
    final token = await _createSession(userId);
    final json = await _getUserJson(userId);
    return {
      'token': token,
      'user': json,
    };
  }

  Future<Map<String, dynamic>> register({
    required String phone,
    required String password,
    String? name,
    String? email,
    Uint8List? avatar,
  }) async {
    final existing = await _getUserByPhone(phone);
    if (existing != null) {
      throw ApiException('Ce numéro est déjà utilisé', statusCode: 409);
    }

    final now = DateTime.now().toUtc().toIso8601String();
    final userId = await _db.insert(
      'users',
      {
        'phone': phone,
        'password': password,
        'name': name?.isNotEmpty == true ? name!.trim() : phone,
        'email': email?.isNotEmpty == true ? email!.trim() : null,
        'avatar': avatar,
        'is_online': 1,
        'created_at': now,
        'updated_at': now,
      },
      conflictAlgorithm: ConflictAlgorithm.abort,
    );

    await ensureDemoConversationsForUser(userId);
    final token = await _createSession(userId);
    final json = await _getUserJson(userId);

    return {
      'token': token,
      'user': json,
    };
  }

  Future<Map<String, dynamic>> refreshProfile(String token) async {
    final userId = await _ensureUserId(token);
    return _getUserJson(userId);
  }

  Future<void> updateProfile(String token, Map<String, dynamic> data) async {
    final userId = await _ensureUserId(token);
    final updates = <String, Object?>{};
    if (data['name'] is String && (data['name'] as String).isNotEmpty) {
      updates['name'] = (data['name'] as String).trim();
    }
    if (data['email'] is String) {
      final email = (data['email'] as String).trim();
      updates['email'] = email.isEmpty ? null : email;
    }
    if (data['phone'] is String && (data['phone'] as String).isNotEmpty) {
      updates['phone'] = (data['phone'] as String).trim();
    }
    if (updates.isEmpty) {
      return;
    }
    updates['updated_at'] = DateTime.now().toUtc().toIso8601String();
    await _db.update(
      'users',
      updates,
      where: 'id = ?',
      whereArgs: [userId],
    );
  }

  Future<void> logout(String token) async {
    await _db.delete('sessions', where: 'token = ?', whereArgs: [token]);
  }

  Future<void> setOnlineStatus(String token, bool isOnline) async {
    final userId = await _ensureUserId(token);
    await _db.update(
      'users',
      {
        'is_online': isOnline ? 1 : 0,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [userId],
    );
  }

  Future<List<Map<String, dynamic>>> chatsForToken(String token) async {
    final userId = await _ensureUserId(token);
    return chatsForUser(userId);
  }

  Future<List<Map<String, dynamic>>> chatsForUser(int userId) async {
    final rows = await _db.rawQuery(
      '''
      SELECT c.id, c.title, c.updated_at, c.is_muted
      FROM chats c
      INNER JOIN chat_participants cp ON cp.chat_id = c.id
      WHERE cp.user_id = ?
      ORDER BY datetime(c.updated_at) DESC
      '''.trim(),
      [userId],
    );

    final List<Map<String, dynamic>> result = [];
    for (final row in rows) {
      final chatId = row['id'] as int;
      final participants = await _participantsForChat(chatId);
      final title = (row['title'] as String?)?.trim().isNotEmpty == true
          ? (row['title'] as String)
          : _buildChatTitle(participants, userId);
      final lastMessageRows = await _db.query(
        'messages',
        where: 'chat_id = ?',
        whereArgs: [chatId],
        orderBy: 'datetime(created_at) DESC',
        limit: 1,
      );
      Map<String, dynamic>? lastMessage;
      if (lastMessageRows.isNotEmpty) {
        lastMessage = _messageToJson(lastMessageRows.first, viewerId: userId);
      }
      result.add({
        'id': chatId.toString(),
        'title': title,
        'participants': participants,
        'updatedAt': row['updated_at'],
        'lastMessage': lastMessage,
        'unreadCount': 0,
        'isMuted': (row['is_muted'] as int) == 1,
      });
    }
    return result;
  }

  Future<List<Map<String, dynamic>>> messagesForChat({
    required String token,
    required int chatId,
  }) async {
    final userId = await _ensureUserId(token);
    final rows = await _db.query(
      'messages',
      where: 'chat_id = ?',
      whereArgs: [chatId],
      orderBy: 'datetime(created_at) ASC',
    );
    return rows.map((row) => _messageToJson(row, viewerId: userId)).toList();
  }

  Future<Map<String, dynamic>> createMessage({
    required String token,
    required int chatId,
    required String content,
  }) async {
    final userId = await _ensureUserId(token);
    final now = DateTime.now().toUtc().toIso8601String();
    final messageId = await _db.insert('messages', {
      'chat_id': chatId,
      'sender_id': userId,
      'content': content,
      'created_at': now,
      'status': 'sent',
    });
    await _db.update(
      'chats',
      {'updated_at': now},
      where: 'id = ?',
      whereArgs: [chatId],
    );
    final row = await _db.query(
      'messages',
      where: 'id = ?',
      whereArgs: [messageId],
      limit: 1,
    );
    if (row.isEmpty) {
      throw ApiException('Échec de l\'envoi du message');
    }
    return _messageToJson(row.first, viewerId: userId);
  }

  Future<void> muteChat({required String token, required int chatId}) async {
    await _ensureUserId(token);
    await _db.update(
      'chats',
      {
        'is_muted': 1,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [chatId],
    );
  }

  Future<void> ensureDemoConversationsForUser(int userId) async {
    final participantCount = sqflite_utils.firstIntValue(
          await _db.rawQuery(
            'SELECT COUNT(*) FROM chat_participants WHERE user_id = ?',
            [userId],
          ),
        ) ??
        0;
    if (participantCount > 0) {
      return;
    }

    final now = DateTime.now().toUtc();
    final teamId = await _ensureSupportUser();
    final guardianId = await _ensureGuardianUser();

    final welcomeChatId = await _createChat(
      title: 'Équipe Gazavba',
      participantIds: [userId, teamId],
      updatedAt: now.subtract(const Duration(minutes: 3)),
    );
    await _db.insert('messages', {
      'chat_id': welcomeChatId,
      'sender_id': teamId,
      'content':
          "Bienvenue sur Gazavba ! Cette conversation est sécurisée et stockée localement sur votre appareil.",
      'created_at': now.subtract(const Duration(minutes: 3)).toIso8601String(),
      'status': 'delivered',
    });
    await _db.insert('messages', {
      'chat_id': welcomeChatId,
      'sender_id': teamId,
      'content':
          "N'hésitez pas à nous écrire pour découvrir toutes les fonctionnalités de l'application.",
      'created_at': now.subtract(const Duration(minutes: 2, seconds: 10)).toIso8601String(),
      'status': 'delivered',
    });

    final communityChatId = await _createChat(
      title: 'Communauté Gazavba',
      participantIds: [userId, teamId, guardianId],
      updatedAt: now.subtract(const Duration(minutes: 1)),
    );
    await _db.insert('messages', {
      'chat_id': communityChatId,
      'sender_id': guardianId,
      'content':
          "Salut ${await _userName(userId)} ! Nous échangeons ici nos bonnes pratiques de sécurité numérique.",
      'created_at': now.subtract(const Duration(minutes: 1, seconds: 20)).toIso8601String(),
      'status': 'delivered',
    });
    await _db.insert('messages', {
      'chat_id': communityChatId,
      'sender_id': teamId,
      'content':
          'Partagez vos retours, tout est chiffré de bout en bout et conservé hors-ligne.',
      'created_at': now.subtract(const Duration(seconds: 50)).toIso8601String(),
      'status': 'delivered',
    });
  }

  Future<void> clearSessions() async {
    await _db.delete('sessions');
  }

  Future<void> close() async {
    await _db.close();
  }

  Future<int> _ensureUserId(String token) async {
    final rows = await _db.query(
      'sessions',
      columns: ['user_id'],
      where: 'token = ?',
      whereArgs: [token],
      limit: 1,
    );
    if (rows.isEmpty) {
      throw ApiException('Session expirée, veuillez vous reconnecter', statusCode: 401);
    }
    return rows.first['user_id'] as int;
  }

  Future<Map<String, dynamic>> _getUserJson(int userId) async {
    final rows = await _db.query(
      'users',
      where: 'id = ?',
      whereArgs: [userId],
      limit: 1,
    );
    if (rows.isEmpty) {
      throw ApiException('Utilisateur introuvable', statusCode: 404);
    }
    final row = rows.first;
    return {
      'id': row['id'].toString(),
      'name': (row['name'] as String?) ?? '',
      'phone': row['phone'],
      'email': row['email'],
      'avatar': row['avatar'],
      'isOnline': (row['is_online'] as int) == 1,
    };
  }

  Future<Map<String, Object?>?> _getUserByPhone(String phone) async {
    final rows = await _db.query(
      'users',
      where: 'phone = ?',
      whereArgs: [phone],
      limit: 1,
    );
    if (rows.isEmpty) {
      return null;
    }
    return rows.first;
  }

  Future<String> _createSession(int userId) async {
    await _db.delete('sessions', where: 'user_id = ?', whereArgs: [userId]);
    final token = _uuid.v4();
    await _db.insert('sessions', {
      'token': token,
      'user_id': userId,
      'created_at': DateTime.now().toUtc().toIso8601String(),
    });
    return token;
  }

  Future<List<Map<String, dynamic>>> _participantsForChat(int chatId) async {
    final rows = await _db.rawQuery(
      '''
      SELECT u.id, u.name, u.phone, u.email, u.avatar, u.is_online
      FROM users u
      INNER JOIN chat_participants cp ON cp.user_id = u.id
      WHERE cp.chat_id = ?
      ORDER BY u.name COLLATE NOCASE ASC
      '''.trim(),
      [chatId],
    );
    return rows
        .map(
          (row) => {
            'id': row['id'].toString(),
            'name': (row['name'] as String?) ?? row['phone'],
            'phone': row['phone'],
            'email': row['email'],
            'avatar': row['avatar'],
            'isOnline': (row['is_online'] as int) == 1,
          },
        )
        .toList();
  }

  Future<int> _createChat({
    required String title,
    required List<int> participantIds,
    required DateTime updatedAt,
  }) async {
    final chatId = await _db.insert('chats', {
      'title': title,
      'updated_at': updatedAt.toIso8601String(),
      'is_muted': 0,
    });
    for (final participantId in participantIds.toSet()) {
      await _db.insert('chat_participants', {
        'chat_id': chatId,
        'user_id': participantId,
      });
    }
    return chatId;
  }

  String _buildChatTitle(List<Map<String, dynamic>> participants, int viewerId) {
    final others = participants
        .where((participant) => participant['id'] != viewerId.toString())
        .map((participant) => participant['name'] as String)
        .toList();
    if (others.isEmpty) {
      return 'Conversation';
    }
    if (others.length == 1) {
      return others.first;
    }
    return others.join(', ');
  }

  Map<String, dynamic> _messageToJson(Map<String, Object?> row, {required int viewerId}) {
    return {
      'id': row['id'].toString(),
      'chatId': row['chat_id'].toString(),
      'senderId': row['sender_id'].toString(),
      'content': row['content'],
      'createdAt': row['created_at'],
      'status': row['status'],
      'isMine': row['sender_id'] == viewerId,
    };
  }

  Future<String> _userName(int userId) async {
    final rows = await _db.query(
      'users',
      columns: ['name', 'phone'],
      where: 'id = ?',
      whereArgs: [userId],
      limit: 1,
    );
    if (rows.isEmpty) {
      return 'vous';
    }
    final name = rows.first['name'] as String?;
    if (name != null && name.trim().isNotEmpty) {
      return name.trim();
    }
    return rows.first['phone'] as String;
  }

  static Future<void> _createSchema(Database db) async {
    await db.execute('''
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        email TEXT,
        avatar BLOB,
        is_online INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    ''');

    await db.execute('''
      CREATE TABLE chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        updated_at TEXT NOT NULL,
        is_muted INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE chat_participants (
        chat_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        PRIMARY KEY(chat_id, user_id),
        FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    ''');

    await db.execute('''
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT,
        FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE SET NULL
      )
    ''');
  }

  static Future<void> _seedStaticUsers(Database db) async {
    final now = DateTime.now().toUtc().toIso8601String();
    await db.insert('users', {
      'phone': '221700000001',
      'password': 'demo123',
      'name': 'Équipe Gazavba',
      'email': 'support@gazavba.local',
      'is_online': 1,
      'created_at': now,
      'updated_at': now,
    });
    await db.insert('users', {
      'phone': '221700000002',
      'password': 'demo123',
      'name': 'Mariam Diallo',
      'email': 'mariam@gazavba.local',
      'is_online': 1,
      'created_at': now,
      'updated_at': now,
    });
  }

  Future<int> _ensureSupportUser() async {
    final user = await _getUserByPhone('221700000001');
    if (user != null) {
      return user['id'] as int;
    }
    final now = DateTime.now().toUtc().toIso8601String();
    return _db.insert('users', {
      'phone': '221700000001',
      'password': 'demo123',
      'name': 'Équipe Gazavba',
      'email': 'support@gazavba.local',
      'is_online': 1,
      'created_at': now,
      'updated_at': now,
    });
  }

  Future<int> _ensureGuardianUser() async {
    final user = await _getUserByPhone('221700000002');
    if (user != null) {
      return user['id'] as int;
    }
    final now = DateTime.now().toUtc().toIso8601String();
    return _db.insert('users', {
      'phone': '221700000002',
      'password': 'demo123',
      'name': 'Mariam Diallo',
      'email': 'mariam@gazavba.local',
      'is_online': 1,
      'created_at': now,
      'updated_at': now,
    });
  }
}
