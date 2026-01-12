import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/contact.dart';
import '../../../core/models/chat.dart';
import '../../../core/models/user.dart';
import '../../../core/services/api_client.dart';

final contactsRepositoryProvider = Provider<ContactsRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  return ContactsRepository(client);
});

class ContactsRepository {
  ContactsRepository(this._client);

  final ApiClient _client;

  Future<List<Contact>> fetchContacts() async {
    final payload = await _client.get('/contacts');
    final data = _extractList(payload, 'contacts');
    if (data.isEmpty) {
      return _generateFallback();
    }
    return data
        .map((json) => Contact.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<void> inviteContact(String phone) async {
    await _client.post('/contacts/save', data: {
      'contact': {'phone': phone, 'name': phone},
    });
  }

  Future<List<Contact>> searchDirectory(String query) async {
    final payload = await _client.get('/contacts/search', query: {'q': query});
    final data = _extractList(payload, 'results');
    return data.map((json) {
      final map = json as Map<String, dynamic>;
      return Contact.fromJson({...map, 'hasAccount': true});
    }).toList();
  }

  Future<List<Contact>> saveContact(Contact contact) async {
    final payload = await _client.post('/contacts/save', data: {
      'contact': {
        'name': contact.name,
        'phone': contact.phone,
        'avatar': contact.avatarUrl,
      },
    });
    final data = _extractList(payload, 'contacts');
    return data
        .map((json) => Contact.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<Chat> startChat({String? userId, String? phone}) async {
    final payload = await _client.post('/contacts/start-chat', data: {
      if (userId != null && userId.isNotEmpty) 'userId': userId,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
    });
    final chatJson = (payload['chat'] ?? {}) as Map<String, dynamic>;
    final participantsJson =
        (payload['participants'] as List<dynamic>? ?? <dynamic>[])
            .map((e) => e as Map<String, dynamic>)
            .toList();
    final participants = participantsJson.map(User.fromJson).toList();
    final enrichedChat = Map<String, dynamic>.from(chatJson)
      ..['participants'] = participantsJson;
    return Chat.fromJson(enrichedChat).copyWith(participants: participants);
  }

  List<Contact> _generateFallback() {
    final random = Random();
    const sampleNames = [
      'Amina Diallo',
      'Youssef Karim',
      'Fatou Ndiaye',
      'Lucas Bernard',
      'Nadia Benali',
      'Sophie Martin',
      'Ibrahim Sow',
      'Camille Dupont',
    ];
    return List<Contact>.generate(sampleNames.length, (index) {
      final name = sampleNames[index];
      final phone =
          '+2376${random.nextInt(9999999).toString().padLeft(7, '0')}';
      final hasAccount = index.isEven;
      return Contact(
        id: 'local-$index',
        name: name,
        phone: phone,
        hasAccount: hasAccount,
        lastInteraction: DateTime.now().subtract(Duration(days: index + 1)),
      );
    });
  }
}

List<dynamic> _extractList(dynamic payload, String key) {
  if (payload is List<dynamic>) return payload;
  if (payload is Map<String, dynamic>) {
    if (payload[key] is List<dynamic>) {
      return payload[key] as List<dynamic>;
    }
    if (payload['data'] is List<dynamic>) {
      return payload['data'] as List<dynamic>;
    }
  }
  return const [];
}
