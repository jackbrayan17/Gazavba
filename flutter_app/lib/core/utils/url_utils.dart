class UrlUtils {
  UrlUtils._();

  static const _defaultApiBaseUrl = 'https://www.gazavba.eeuez.com/api/';
  static const _defaultMediaBaseUrl = 'https://www.gazavba.eeuez.com';

  static final String _apiBaseUrl = _resolveApiBaseUrl();
  static final String _mediaBaseUrl = _resolveMediaBaseUrl();

  static String get mediaBaseUrl => _mediaBaseUrl;

  static String? resolveMediaUrl(String? url) {
    if (url == null) return null;
    final trimmed = url.trim();
    if (trimmed.isEmpty) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) {
      return '$_mediaBaseUrl$trimmed';
    }
    return '$_mediaBaseUrl/$trimmed';
  }

  static String _resolveApiBaseUrl() {
    final apiEnv = const String.fromEnvironment('GAZAVBA_API_URL');
    if (apiEnv.isNotEmpty) {
      return apiEnv;
    }
    return _defaultApiBaseUrl;
  }

  static String _resolveMediaBaseUrl() {
    final mediaEnv = const String.fromEnvironment('GAZAVBA_MEDIA_URL');
    if (mediaEnv.isNotEmpty) {
      return _stripTrailingSlash(mediaEnv);
    }
    final apiBase = _stripTrailingSlash(_resolveApiBaseUrl());
    if (apiBase.toLowerCase().endsWith('/api')) {
      return apiBase.substring(0, apiBase.length - 4);
    }
    return apiBase.isEmpty ? _defaultMediaBaseUrl : apiBase;
  }

  static String _stripTrailingSlash(String value) {
    return value.replaceAll(RegExp(r'/+$'), '');
  }
}
