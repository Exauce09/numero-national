import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

/// Photo capture stub — replace with `camera` package when enabled in pubspec.
class PhotoCaptureStub extends StatelessWidget {
  const PhotoCaptureStub({super.key, required this.onCaptured});

  final ValueChanged<String> onCaptured;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: () {
        // Simulates a local photo file reference without camera plugin.
        final ref = 'local-photo://${const Uuid().v4()}.jpg';
        onCaptured(ref);
      },
      icon: const Icon(Icons.photo_camera_outlined),
      label: const Text('Capturer photo (stub)'),
    );
  }
}
