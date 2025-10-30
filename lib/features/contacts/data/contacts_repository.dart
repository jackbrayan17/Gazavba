import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/contact.dart';
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
    await _client.post('/contacts/invite', data: {'phone': phone});
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
      final phone = '+2376${random.nextInt(9999999).toString().padLeft(7, '0')}';
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
