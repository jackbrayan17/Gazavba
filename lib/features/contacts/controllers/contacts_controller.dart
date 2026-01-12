import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logging/logging.dart';

import '../../../core/models/chat.dart';
import '../../../core/models/contact.dart';
import '../data/contacts_repository.dart';

final contactsControllerProvider =
    StateNotifierProvider<ContactsController, ContactsState>((ref) {
  final repository = ref.watch(contactsRepositoryProvider);
  return ContactsController(repository: repository)..loadContacts();
});

class ContactsState {
  const ContactsState({
    this.contacts = const [],
    this.isLoading = false,
    this.error,
    this.pendingInvites = const [],
    this.searchResults = const [],
    this.isSearching = false,
  });

  final List<Contact> contacts;
  final bool isLoading;
  final String? error;
  final List<String> pendingInvites;
  final List<Contact> searchResults;
  final bool isSearching;

  ContactsState copyWith({
    List<Contact>? contacts,
    bool? isLoading,
    String? error,
    List<String>? pendingInvites,
    List<Contact>? searchResults,
    bool? isSearching,
    bool clearError = false,
  }) {
    return ContactsState(
      contacts: contacts ?? this.contacts,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : error ?? this.error,
      pendingInvites: pendingInvites ?? this.pendingInvites,
      searchResults: searchResults ?? this.searchResults,
      isSearching: isSearching ?? this.isSearching,
    );
  }
}

class ContactsController extends StateNotifier<ContactsState> {
  ContactsController({required this.repository}) : super(const ContactsState());

  final ContactsRepository repository;
  final Logger _logger = Logger('ContactsController');

  Future<void> loadContacts() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final contacts = await repository.fetchContacts();
      state = state.copyWith(contacts: contacts, isLoading: false);
      _logger.info('Loaded ${contacts.length} contacts');
    } catch (error) {
      state = state.copyWith(isLoading: false, error: error.toString());
      _logger.warning('Failed to load contacts: $error');
    }
  }

  Future<void> addContact(Contact contact) async {
    final updated = [...state.contacts, contact];
    updated.sort((a, b) => a.name.compareTo(b.name));
    state = state.copyWith(contacts: updated);
  }

  Future<void> inviteContact(Contact contact) async {
    final phone = contact.phone;
    final pending = {...state.pendingInvites, phone}.toList();
    state = state.copyWith(pendingInvites: pending);
    try {
      await repository.inviteContact(phone);
      await Future<void>.delayed(const Duration(milliseconds: 600));
      final cleared = List<String>.from(state.pendingInvites)..remove(phone);
      state = state.copyWith(pendingInvites: cleared);
    } catch (error) {
      _logger.warning('Invitation failed: $error');
      final cleared = List<String>.from(state.pendingInvites)..remove(phone);
      state = state.copyWith(pendingInvites: cleared, error: error.toString());
    }
  }

  Future<void> searchDirectory(String query) async {
    if (query.trim().isEmpty) {
      state = state.copyWith(searchResults: const [], isSearching: false);
      return;
    }
    state = state.copyWith(isSearching: true, clearError: true);
    try {
      final results = await repository.searchDirectory(query.trim());
      state = state.copyWith(searchResults: results, isSearching: false);
    } catch (error) {
      _logger.warning('Search failed: $error');
      state = state.copyWith(isSearching: false, error: error.toString());
    }
  }

  Future<void> saveContact(Contact contact) async {
    try {
      final contacts = await repository.saveContact(contact);
      contacts.sort((a, b) => a.name.compareTo(b.name));
      state = state.copyWith(contacts: contacts);
      _logger.info('Contact saved: ${contact.phone}');
    } catch (error) {
      _logger.warning('Save contact failed: $error');
      state = state.copyWith(error: error.toString());
    }
  }

  Future<Chat> startChat(Contact contact) async {
    try {
      final chat = await repository.startChat(
        userId: contact.hasAccount ? contact.id : null,
        phone: contact.phone,
      );
      if (chat.title.isEmpty || chat.title == 'Conversation') {
        return chat.copyWith(title: contact.name);
      }
      return chat;
    } catch (error) {
      _logger.severe('Start chat failed: $error');
      rethrow;
    }
  }
}
