import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/pos_printer.dart';
import '../../core/theme.dart';
import '../../sync/sync_queue.dart';

/// Coupon terrain imprimable : infos de base + QR scannable + sync serveur.
class CouponPrintScreen extends StatefulWidget {
  const CouponPrintScreen({
    super.key,
    required this.localId,
    required this.familyName,
    required this.givenNames,
    required this.sex,
    required this.dateOfBirth,
    this.campaignId,
    this.householdLocalId,
  });

  final String localId;
  final String familyName;
  final String givenNames;
  final String sex;
  final String dateOfBirth;
  final String? campaignId;
  final String? householdLocalId;

  @override
  State<CouponPrintScreen> createState() => _CouponPrintScreenState();
}

class _CouponPrintScreenState extends State<CouponPrintScreen> {
  String _syncNote = 'Synchronisation coupon…';
  bool _printing = false;

  Map<String, Object?> get _payloadMap => <String, Object?>{
        'type': 'nn_census_coupon',
        'v': 1,
        'local_id': widget.localId,
        'family_name': widget.familyName,
        'given_names': widget.givenNames,
        'sex': widget.sex,
        'dob': widget.dateOfBirth,
        'date_of_birth': widget.dateOfBirth,
        if (widget.campaignId != null) 'campaign_id': widget.campaignId,
        if (widget.householdLocalId != null) 'household_local_id': widget.householdLocalId,
        'ts': DateTime.now().toUtc().toIso8601String(),
      };

  String get _qrPayload => jsonEncode(_payloadMap);

  @override
  void initState() {
    super.initState();
    _enqueueCoupon();
  }

  Future<void> _enqueueCoupon() async {
    try {
      final campaignId = widget.campaignId;
      if (campaignId == null || campaignId.isEmpty) {
        setState(() => _syncNote = 'Coupon local (campagne inconnue) — sync au prochain push.');
        return;
      }
      await SyncQueue().enqueue(
        SyncQueueItem(
          entityType: 'coupon',
          localId: widget.localId,
          version: 1,
          payload: {
            ..._payloadMap,
            'campaign_id': campaignId,
            'qr_payload': _payloadMap,
          },
        ),
      );
      if (mounted) {
        setState(() => _syncNote = 'Coupon mis en file de sync — sera envoyé au serveur.');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _syncNote = 'Coupon local OK — sync reportée ($e)');
      }
    }
  }

  Future<void> _print(BuildContext context) async {
    if (_printing) return;
    setState(() => _printing = true);
    final name = '${widget.familyName} ${widget.givenNames}'.trim();
    final sexLabel = widget.sex == 'F' ? 'Féminin' : 'Masculin';

    try {
      // Terminal POS (iPos) : thermique native. Téléphone / tablette : PDF système.
      if (Platform.isAndroid && await PosPrinter.isAvailable()) {
        final compactQr = jsonEncode(<String, Object?>{
          'type': 'nn_census_coupon',
          'v': 1,
          'local_id': widget.localId,
        });
        await PosPrinter.printCoupon(
          title: 'ONIP - Recensement',
          subtitle: 'Coupon provisoire',
          name: _ascii(name.isEmpty ? '-' : name),
          sex: sexLabel == 'Féminin' ? 'Feminin' : 'Masculin',
          dob: _ascii(widget.dateOfBirth.isEmpty ? '-' : widget.dateOfBirth),
          localId: widget.localId,
          qr: compactQr,
        );
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Coupon imprimé sur l’imprimante POS')),
          );
        }
        return;
      }

      final doc = pw.Document();
      final qrImage = await QrPainter(
        data: _qrPayload,
        version: QrVersions.auto,
        gapless: true,
      ).toImageData(420);
      final qrBytes = qrImage!.buffer.asUint8List();

      doc.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a6,
          margin: const pw.EdgeInsets.all(18),
          build: (ctx) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.center,
            children: [
              pw.Text('ONIP — Recensement national', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 4),
              pw.Text('Coupon provisoire', style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
              pw.SizedBox(height: 10),
              pw.Image(pw.MemoryImage(qrBytes), width: 120, height: 120),
              pw.SizedBox(height: 10),
              pw.Text(name.isEmpty ? '—' : name, style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 6),
              pw.Text('Sexe : $sexLabel', style: const pw.TextStyle(fontSize: 10)),
              pw.Text('Naissance : ${widget.dateOfBirth.isEmpty ? '—' : widget.dateOfBirth}', style: const pw.TextStyle(fontSize: 10)),
              pw.Text('Réf. : ${widget.localId}', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
              pw.SizedBox(height: 8),
              pw.Text(
                'Pas une carte d’identité. Carte officielle = ONIP après validation.',
                textAlign: pw.TextAlign.center,
                style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
              ),
            ],
          ),
        ),
      );

      await Printing.layoutPdf(onLayout: (_) async => doc.save());
    } on PlatformException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Impression impossible : ${e.message ?? e.code}')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Impression impossible : $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _printing = false);
    }
  }

  /// Police thermique POS : ASCII simple (évite plantages font firmware).
  static String _ascii(String input) {
    const map = <String, String>{
      'à': 'a', 'â': 'a', 'ä': 'a', 'á': 'a',
      'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
      'î': 'i', 'ï': 'i', 'í': 'i',
      'ô': 'o', 'ö': 'o', 'ó': 'o',
      'ù': 'u', 'û': 'u', 'ü': 'u', 'ú': 'u',
      'ç': 'c', 'ñ': 'n',
      'À': 'A', 'Â': 'A', 'Ä': 'A', 'Á': 'A',
      'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
      'Î': 'I', 'Ï': 'I', 'Í': 'I',
      'Ô': 'O', 'Ö': 'O', 'Ó': 'O',
      'Ù': 'U', 'Û': 'U', 'Ü': 'U', 'Ú': 'U',
      'Ç': 'C', 'Ñ': 'N',
      '—': '-', '–': '-', '’': "'", '‘': "'", '“': '"', '”': '"',
    };
    final b = StringBuffer();
    for (final r in input.runes) {
      final ch = String.fromCharCode(r);
      b.write(map[ch] ?? (r < 128 ? ch : '?'));
    }
    return b.toString();
  }

  @override
  Widget build(BuildContext context) {
    final name = '${widget.familyName} ${widget.givenNames}'.trim();
    return Scaffold(
      backgroundColor: NnColors.page,
      appBar: AppBar(
        title: const Text('Coupon de recensement'),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(4),
          child: RdcStripe(height: 4),
        ),
        actions: [
          IconButton(
            tooltip: 'Copier la référence',
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: widget.localId));
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Référence copiée')),
                );
              }
            },
            icon: const Icon(Icons.copy),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Présentez ce coupon. Le QR pourra être scanné pour retrouver la fiche.\n$_syncNote',
            style: const TextStyle(color: NnColors.muted, height: 1.35),
          ),
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(
              color: NnColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: NnColors.line),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                const RdcStripe(height: 5),
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 16, 18, 20),
                  child: Column(
                    children: [
                      const Text(
                        'ONIP · Recensement national',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Coupon provisoire',
                        style: TextStyle(color: NnColors.muted, fontSize: 12),
                      ),
                      const SizedBox(height: 16),
                      QrImageView(
                        data: _qrPayload,
                        size: 200,
                        backgroundColor: Colors.white,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        name.isEmpty ? '—' : name,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                      ),
                      const SizedBox(height: 8),
                      Text('Sexe : ${widget.sex == 'F' ? 'Féminin' : 'Masculin'}'),
                      Text('Naissance : ${widget.dateOfBirth.isEmpty ? '—' : widget.dateOfBirth}'),
                      Text('Réf. : ${widget.localId}', style: const TextStyle(color: NnColors.muted, fontSize: 12)),
                      const SizedBox(height: 12),
                      const Text(
                        'Ce coupon n’est pas une carte d’identité. '
                        'La carte officielle est délivrée par l’ONIP après validation.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: NnColors.muted, fontSize: 12, height: 1.3),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: _printing ? null : () => _print(context),
            icon: _printing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.print),
            label: Text(_printing ? 'Impression…' : 'Imprimer le coupon'),
          ),
        ],
      ),
    );
  }
}
