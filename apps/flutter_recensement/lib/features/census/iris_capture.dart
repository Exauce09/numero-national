import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../../core/theme.dart';

/// Capture iris : guide circulaire + recadrage serré sur l’œil (pas le visage).
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
        maxWidth: 2400,
        maxHeight: 2400,
        imageQuality: 96,
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
      setState(() => _error = 'Caméra indisponible');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Recadre ~24 % du centre (zone œil), légèrement au-dessus du milieu du visage.
  Future<File> _cropEyeCenter(File src) async {
    final bytes = await src.readAsBytes();
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    final img = frame.image;
    final w = img.width;
    final h = img.height;
    final side = (w < h ? w : h) * 0.24;
    final left = ((w - side) / 2).round().clamp(0, w);
    final top = ((h - side) / 2 - h * 0.06).round().clamp(0, h);
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
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: NnColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: NnColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Iris — œil uniquement', style: TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          const Text(
            'Approchez la caméra de l’œil. L’image est recadrée sur la pupille / iris, pas le visage entier.',
            style: TextStyle(fontSize: 12, color: NnColors.muted, height: 1.3),
          ),
          const SizedBox(height: 12),
          AspectRatio(
            aspectRatio: 1,
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFF0B1220),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: NnColors.rdcBlue, width: 2),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  if (hasFile)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.file(
                        File(_ref!),
                        fit: BoxFit.cover,
                        width: double.infinity,
                        height: double.infinity,
                      ),
                    )
                  else
                    CustomPaint(size: const Size.square(220), painter: _EyeGuidePainter()),
                  if (!hasFile)
                    const Positioned(
                      bottom: 14,
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
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: NnColors.danger, fontSize: 13)),
          ],
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _busy ? null : _capture,
            icon: const Icon(Icons.visibility),
            label: Text(_busy ? 'Caméra…' : (hasFile ? 'Reprendre l’œil' : 'Photographier l’œil')),
            style: FilledButton.styleFrom(backgroundColor: NnColors.rdcRed),
          ),
        ],
      ),
    );
  }
}

class _EyeGuidePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2 - size.height * 0.02);
    final r = size.shortestSide * 0.22;
    final ring = Paint()
      ..color = NnColors.rdcBlue
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5;
    canvas.drawCircle(c, r, ring);
    canvas.drawCircle(c, r * 0.38, ring..color = NnColors.rdcYellow);
    // croix fine
    final cross = Paint()
      ..color = Colors.white24
      ..strokeWidth = 1;
    canvas.drawLine(Offset(c.dx - r * 0.15, c.dy), Offset(c.dx + r * 0.15, c.dy), cross);
    canvas.drawLine(Offset(c.dx, c.dy - r * 0.15), Offset(c.dx, c.dy + r * 0.15), cross);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
