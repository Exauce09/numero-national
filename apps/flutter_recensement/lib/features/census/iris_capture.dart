import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

/// Capture iris : caméra frontale + guide ovale (cadrage œil uniquement).
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

  Future<void> _openGuidedCapture() async {
    final ok = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Cadrer l’œil'),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '1. Approchez la caméra à ~15–20 cm de l’œil.\n'
              '2. Placez l’œil dans l’ovale (pas tout le visage).\n'
              '3. Évitez le flash violent ; lumière naturelle préférable.\n'
              '4. Un seul œil net (gauche ou droit).',
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Ouvrir la caméra')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await _capture();
  }

  Future<void> _capture() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final picker = ImagePicker();
      // maxWidth/height serrés pour forcer un gros plan type « œil »
      final shot = await picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 900,
        maxHeight: 900,
        imageQuality: 92,
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
            Text('Iris — gros plan œil', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            AspectRatio(
              aspectRatio: 1.2,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (hasFile)
                      Image.file(File(_ref!), fit: BoxFit.cover)
                    else
                      Container(color: const Color(0xFF0F172A)),
                    CustomPaint(painter: _EyeGuidePainter(hasPhoto: hasFile)),
                    if (!hasFile)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(16),
                          child: Text(
                            'Placez uniquement l’œil dans l’ovale',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Référence terrain via caméra téléphone (pas un scanner NIR professionnel).',
              style: TextStyle(fontSize: 12, color: Color(0xFF5A6A85)),
            ),
            if (_error != null) ...[
              const SizedBox(height: 6),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 13)),
            ],
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: _busy ? null : _openGuidedCapture,
              icon: Icon(hasFile ? Icons.visibility : Icons.visibility_outlined),
              label: Text(_busy ? 'Caméra…' : (hasFile ? 'Reprendre (œil seul)' : 'Photographier l’œil')),
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFFCE1126)),
            ),
          ],
        ),
      ),
    );
  }
}

class _EyeGuidePainter extends CustomPainter {
  _EyeGuidePainter({required this.hasPhoto});

  final bool hasPhoto;

  @override
  void paint(Canvas canvas, Size size) {
    final overlay = Paint()..color = Colors.black.withValues(alpha: hasPhoto ? 0.25 : 0.55);
    final path = Path()..addRect(Offset.zero & size);
    final oval = Rect.fromCenter(
      center: Offset(size.width / 2, size.height / 2),
      width: size.width * 0.55,
      height: size.height * 0.38,
    );
    final cut = Path()..addOval(oval);
    canvas.drawPath(
      Path.combine(PathOperation.difference, path, cut),
      overlay,
    );
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..color = const Color(0xFFF7D618);
    canvas.drawOval(oval, ring);
  }

  @override
  bool shouldRepaint(covariant _EyeGuidePainter oldDelegate) => oldDelegate.hasPhoto != hasPhoto;
}
