import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

/// Capture photo via caméra téléphone (ou galerie en secours).
class PhotoCaptureWidget extends StatefulWidget {
  const PhotoCaptureWidget({super.key, required this.onCaptured, this.initialRef});

  final ValueChanged<String> onCaptured;
  final String? initialRef;

  @override
  State<PhotoCaptureWidget> createState() => _PhotoCaptureWidgetState();
}

class _PhotoCaptureWidgetState extends State<PhotoCaptureWidget> {
  String? _ref;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _ref = widget.initialRef;
  }

  Future<void> _capture({required ImageSource source}) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final picker = ImagePicker();
      final shot = await picker.pickImage(
        source: source,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
        preferredCameraDevice: CameraDevice.rear,
      );
      if (shot == null) {
        setState(() => _error = 'Capture annulée');
        return;
      }
      final dir = await getApplicationDocumentsDirectory();
      final photos = Directory(p.join(dir.path, 'photos'));
      if (!await photos.exists()) await photos.create(recursive: true);
      final dest = p.join(photos.path, '${const Uuid().v4()}.jpg');
      await File(shot.path).copy(dest);
      setState(() => _ref = dest);
      widget.onCaptured(dest);
    } catch (e) {
      setState(() => _error = 'Caméra indisponible: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasFile = _ref != null && !_ref!.startsWith('local-photo://') && File(_ref!).existsSync();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (hasFile) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.file(File(_ref!), height: 160, fit: BoxFit.cover),
          ),
          const SizedBox(height: 8),
          Text('Photo: ${_ref!.split(Platform.pathSeparator).last}',
              style: const TextStyle(fontSize: 12)),
          const SizedBox(height: 8),
        ] else if (_ref != null) ...[
          Text('Réf: $_ref', style: const TextStyle(fontSize: 12)),
          const SizedBox(height: 8),
        ],
        if (_error != null) ...[
          Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          const SizedBox(height: 8),
        ],
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: _busy ? null : () => _capture(source: ImageSource.camera),
                icon: const Icon(Icons.photo_camera),
                label: Text(_busy ? '…' : 'Caméra'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _busy ? null : () => _capture(source: ImageSource.gallery),
                icon: const Icon(Icons.photo_library_outlined),
                label: const Text('Galerie'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
