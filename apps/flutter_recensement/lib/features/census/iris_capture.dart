import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

/// Capture iris : guide circulaire + recadrage sur la zone œil (pas le visage entier).
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
        maxWidth: 2000,
        maxHeight: 2000,
        imageQuality: 95,
        preferredCameraDevice: CameraDevice.front,
      );
      if (shot == null) {
        setState(() => _error = 'Capture annulée');
        return;
      }
      final cropped = await _cropEyeCenter(File(shot.path));
      final dir = await getApplicationDocumentsDirectory();
      final irisDir = Directory(p.join(dir.path, 'iris'));
      if (!await irisDir.exists()) await irisDir.create(recursive: true);
      final dest = p.join(irisDir.path, 'iris-${const Uuid().v4()}.jpg');
      await cropped.copy(dest);
      setState(() => _ref = dest);
      widget.onCaptured(dest);
    } catch (e) {
      setState(() => _error = 'Caméra indisponible: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Recadre le centre (~40 %) pour garder l’œil, pas le visage entier.
  Future<File> _cropEyeCenter(File src) async {
    final bytes = await src.readAsBytes();
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    final img = frame.image;
    final w = img.width;
    final h = img.height;
    final side = (w < h ? w : h) * 0.28;
    final left = ((w - side) / 2).round();
    final top = ((h - side) / 2 - h * 0.02).round().clamp(0, h);
    final size = side.round().clamp(64, w < h ? w : h);

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    final srcRect = Rect.fromLTWH(left.toDouble(), top.toDouble(), size.toDouble(), size.toDouble());
    final dstRect = Rect.fromLTWH(0, 0, size.toDouble(), size.toDouble());
    canvas.drawImageRect(img, srcRect, dstRect, Paint());
    final picture = recorder.endRecording();
    final out = await picture.toImage(size, size);
    final bd = await out.toByteData(format: ui.ImageByteFormat.png);
    final tmp = File('${src.path}.eye.png');
    await tmp.writeAsBytes(bd!.buffer.asUint8List());
    return tmp;
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
            Text('Iris — cadrage œil', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 6),
            const Text(
              'Approchez la caméra de l’œil. L’image est recadrée sur la zone centrale (œil), pas le visage entier.',
              style: TextStyle(fontSize: 12, color: Color(0xFF5A6A85)),
            ),
            const SizedBox(height: 10),
            AspectRatio(
              aspectRatio: 1,
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF0F1621),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF007FFF), width: 2),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    if (hasFile)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.file(File(_ref!), fit: BoxFit.cover, width: double.infinity, height: double.infinity),
                      )
                    else
                      CustomPaint(size: const Size.square(200), painter: _EyeGuidePainter()),
                    if (!hasFile)
                      const Positioned(
                        bottom: 12,
                        child: Text(
                          'Centrez l’œil dans le cercle',
                          style: TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 6),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 13)),
            ],
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: _busy ? null : _capture,
              icon: const Icon(Icons.visibility),
              label: Text(_busy ? 'Caméra…' : (hasFile ? 'Reprendre l’œil' : 'Photographier l’œil')),
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFFCE1126)),
            ),
          ],
        ),
      ),
    );
  }
}

class _EyeGuidePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.shortestSide * 0.28;
    final ring = Paint()
      ..color = const Color(0xFF007FFF)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    canvas.drawCircle(c, r, ring);
    canvas.drawCircle(c, r * 0.35, ring..color = const Color(0xFFF7D618));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
