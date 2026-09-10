import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/theme.dart';

/// Coupon terrain imprimable : infos de base + QR scannable.
class CouponPrintScreen extends StatelessWidget {
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

  String get _qrPayload {
    final map = <String, Object?>{
      'type': 'nn_census_coupon',
      'v': 1,
      'local_id': localId,
      'family_name': familyName,
      'given_names': givenNames,
      'sex': sex,
      'dob': dateOfBirth,
      if (campaignId != null) 'campaign_id': campaignId,
      if (householdLocalId != null) 'household_id': householdLocalId,
      'ts': DateTime.now().toUtc().toIso8601String(),
    };
    return jsonEncode(map);
  }

  Future<void> _print(BuildContext context) async {
    final name = '$familyName $givenNames'.trim();
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
            pw.Text('Sexe : ${sex == 'F' ? 'Féminin' : 'Masculin'}', style: const pw.TextStyle(fontSize: 10)),
            pw.Text('Naissance : ${dateOfBirth.isEmpty ? '—' : dateOfBirth}', style: const pw.TextStyle(fontSize: 10)),
            pw.Text('Réf. : $localId', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
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
  }

  @override
  Widget build(BuildContext context) {
    final name = '$familyName $givenNames'.trim();
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
              await Clipboard.setData(ClipboardData(text: localId));
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
          const Text(
            'Présentez ce coupon. Le QR pourra être scanné pour retrouver la fiche.',
            style: TextStyle(color: NnColors.muted, height: 1.35),
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
                        version: QrVersions.auto,
                        size: 200,
                        backgroundColor: Colors.white,
                      ),
                      const SizedBox(height: 14),
                      Text(
                        name.isEmpty ? '—' : name,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                      ),
                      const SizedBox(height: 8),
                      _line('Sexe', sex == 'F' ? 'Féminin' : 'Masculin'),
                      _line('Naissance', dateOfBirth.isEmpty ? '—' : dateOfBirth),
                      _line('Réf. locale', localId.length > 12 ? '${localId.substring(0, 12)}…' : localId),
                      const SizedBox(height: 8),
                      const Text(
                        'Ce coupon n’est pas une carte d’identité. '
                        'La carte officielle est émise par l’ONIP après validation.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 11, color: NnColors.muted, height: 1.35),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: () => _print(context),
            icon: const Icon(Icons.print_outlined),
            label: const Text('Imprimer le coupon'),
            style: FilledButton.styleFrom(backgroundColor: NnColors.rdcRed),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Terminer'),
          ),
        ],
      ),
    );
  }

  static Widget _line(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          SizedBox(
            width: 90,
            child: Text(k, style: const TextStyle(color: NnColors.muted, fontSize: 13)),
          ),
          Expanded(
            child: Text(v, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          ),
        ],
      ),
    );
  }
}
