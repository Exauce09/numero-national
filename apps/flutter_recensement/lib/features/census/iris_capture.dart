import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

/// Photo d’œil via la caméra du téléphone (référence terrain).
///
/// Ce n’est **pas** un scan iris NIR biométrique officiel — le téléphone
/// grand public n’expose pas d’API iris. Sert de preuve visuelle jusqu’à
/// un scanner dédié.
class IrisCaptureWidget extends StatefulWidget {
  const IrisCaptureWidget({
    super.key,
    required this.onCaptured,
    this.initialRef,
  });

  final ValueChanged<String> onCaptured;
  final String? initialRef;

  @override
  State<IrisCaptureWidget> createState() => _IrisCaptureWidgetState();
}

class _IrisCaptureWidgetState extends State<IrisCaptureWidget> {
  String? _ref;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _ref = widget.initialRef;
  }

  Future<void> _capture() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final picker = ImagePicker();
      final shot = await picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 90,
        preferredCameraDevice: CameraDevice.front,
      );
      if (shot == null) {
        setState(() => _error = 'Capture annulée');
        return;
      }
      final dir = await getApplicationDocumentsDirectory();
      final irisDir = Directory(p.join(dir.path, 'iris'));
      if (!await irisDir.exists()) await irisDir.create(recursive: true);
      final dest = p.join(irisDir.path, 'iris-${const Uuid().v4()}.jpg');
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
    final hasFile = _ref != null && File(_ref!).existsSync();
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Iris (photo téléphone)', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 6),
            const Text(
              'Cadrez l’œil de près avec la caméra. Référence visuelle — pas un scanner iris professionnel.',
              style: TextStyle(fontSize: 12, color: Color(0xFF5A6A85)),
            ),
            if (hasFile) ...[
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(File(_ref!), height: 140, fit: BoxFit.cover),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 6),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 13)),
            ],
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: _busy ? null : _capture,
              icon: Icon(hasFile ? Icons.visibility : Icons.visibility_outlined),
              label: Text(_busy ? 'Caméra…' : (hasFile ? 'Reprendre photo iris' : 'Photographier l’œil')),
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFFCE1126)),
            ),
          ],
        ),
      ),
    );
  }
}
