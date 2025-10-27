import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logging/logging.dart';
import 'package:path_provider/path_provider.dart';

final logServiceProvider = Provider<LogService>((ref) {
  throw UnimplementedError('LogService must be initialised before use');
});

class LogService {
  LogService._();

  IOSink? _sink;
  StreamSubscription<LogRecord>? _subscription;
  String? _logFilePath;

  String? get logFilePath => _logFilePath;

  static Future<LogService> create() async {
    final service = LogService._();
    await service._initialise();
    return service;
  }

  Future<void> _initialise() async {
    Logger.root.level = kDebugMode ? Level.ALL : Level.INFO;
    _subscription?.cancel();
    _subscription = Logger.root.onRecord.listen((record) {
      final timestamp = record.time.toIso8601String();
      final message = '[${record.loggerName}] ${record.level.name}: ${record.message}';
      final line = '[$timestamp] $message';
      debugPrint(line);
      _sink?.writeln(line);
      if (record.error != null) {
        _sink?.writeln('Error: ${record.error}');
      }
      if (record.stackTrace != null) {
        _sink?.writeln(record.stackTrace);
      }
    });

    if (kIsWeb) {
      // File logging is not supported on the web. Console output is enough.
      return;
    }

    try {
      final directory = await getApplicationSupportDirectory();
      final logsDirectory = Directory('${directory.path}/logs');
      if (!await logsDirectory.exists()) {
        await logsDirectory.create(recursive: true);
      }
      final file = File('${logsDirectory.path}/gazavba.log');
      _logFilePath = file.path;
      _sink = file.openWrite(mode: FileMode.writeOnlyAppend);
      Logger('LogService').info('Logging to ${file.path}');
    } catch (error, stackTrace) {
      debugPrint('Unable to create log file: $error\n$stackTrace');
    }
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
    await _sink?.flush();
    await _sink?.close();
  }
}
