import 'dart:async';
import 'package:flutter/foundation.dart';

class StreamListenable extends ChangeNotifier {
  late final StreamSubscription _sub;
  StreamListenable(Stream<dynamic> stream) {
    _sub = stream.listen((_) => notifyListeners());
  }
  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}
