import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logging/logging.dart';

import '../storage/secure_storage.dart';
import '../utils/exceptions.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  throw UnimplementedError('ApiClient must be provided before use');
});

final socketBaseUrlProvider = Provider<String>((ref) {
  return ref.watch(apiClientProvider).socketBaseUrl;
});

class ApiClient {
  ApiClient({required AppSecureStorage storage}) : _storage = storage {
    final baseUrlEnv = const String.fromEnvironment('GAZAVBA_API_URL');
    final socketUrlEnv = const String.fromEnvironment('GAZAVBA_SOCKET_URL');

    _baseUrl = baseUrlEnv.isNotEmpty ? baseUrlEnv : _defaultBaseUrl;
    _socketBaseUrl = socketUrlEnv.isNotEmpty ? socketUrlEnv : _defaultSocketUrl;

    _dio = Dio(
      BaseOptions(
        baseUrl: _baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 20),
        sendTimeout: const Duration(seconds: 20),
        headers: const {
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (_token != null && options.extra['auth'] != false) {
            options.headers['Authorization'] = 'Bearer $_token';
          }
          return handler.next(options);
        },
        onError: (error, handler) {
          final response = error.response;
          final status = response?.statusCode;
          final message = response?.data is Map
              ? (response!.data['message'] as String?)
              : response?.statusMessage;
          if (status == 401) {
            _token = null;
          }
          handler.next(
            DioException(
              requestOptions: error.requestOptions,
              response: response,
              type: error.type,
              message: message ?? error.message,
              error: error.error,
            ),
          );
        },
      ),
    );
  }

  static const _defaultBaseUrl = 'https://gazavba.eeuez.com/api';
  static const _defaultSocketUrl = 'https://gazavba.eeuez.com';

  final AppSecureStorage _storage;
  late final Dio _dio;

  late final String _baseUrl;
  late final String _socketBaseUrl;
  String? _token;

  String get socketBaseUrl => _socketBaseUrl;
  String get baseUrl => _baseUrl;

  final Logger _logger = Logger('ApiClient');

  Future<void> init() async {
    _token = await _storage.readToken();
    _logger.info('Initialised api client (hasToken=${_token != null}) -> $_baseUrl');
  }

  Future<void> setToken(String? token) async {
    _token = token;
    await _storage.writeToken(token);
  }

  Future<void> clearToken() async {
    _token = null;
    await _storage.deleteToken();
  }


  Future<String?> currentToken() async {
    if (_token != null) {
      return _token;
    }
    _token = await _storage.readToken();
    return _token;
  }
  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
    bool auth = true,
    CancelToken? cancelToken,
  }) {
    return request(
      path,
      method: 'GET',
      query: query,
      auth: auth,
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? data,
    FormData? formData,
    bool auth = true,
    CancelToken? cancelToken,
  }) {
    return request(
      path,
      method: 'POST',
      data: data,
      formData: formData,
      auth: auth,
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, dynamic>> put(
    String path, {
    Map<String, dynamic>? data,
    bool auth = true,
  }) {
    return request(path, method: 'PUT', data: data, auth: auth);
  }

  Future<Map<String, dynamic>> request(
    String path, {
    required String method,
    Map<String, dynamic>? data,
    FormData? formData,
    Map<String, dynamic>? query,
    bool auth = true,
    CancelToken? cancelToken,
  }) async {
    final options = Options(
      method: method,
      contentType: formData != null ? 'multipart/form-data' : Headers.jsonContentType,
      responseType: ResponseType.json,
      sendTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 20),
      extra: {'auth': auth},
    );

    final normalizedPath = path.startsWith('/') ? path.substring(1) : path;
    try {
      final response = await _dio.request<Map<String, dynamic>>(
        normalizedPath,
        data: formData ?? data,
        queryParameters: query,
        options: options,
        cancelToken: cancelToken,
      );

      final payload = response.data ?? <String, dynamic>{};
      _logger.fine('[$method] $path -> ${jsonEncode(payload)}');
      return payload;
    } on DioException catch (error) {
      final status = error.response?.statusCode;
      final message = _extractMessage(error);
      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout ||
          error.type == DioExceptionType.sendTimeout) {
        throw NetworkException('Network timeout. Please try again.');
      }
      if (error.type == DioExceptionType.badResponse) {
        throw ApiException(message ?? 'Request failed', statusCode: status);
      }
      throw ApiException(message ?? 'Unexpected error', statusCode: status);
    } catch (error, stack) {
      _logger.severe('Unexpected error while calling $path', error, stack);
      throw ApiException('Unexpected error: $error');
    }
  }

  String? _extractMessage(DioException error) {
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final message = data['message'] ?? data['error'];
      if (message is String && message.isNotEmpty) {
        return message;
      }
    }
    return error.message;
  }
}
