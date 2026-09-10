package cd.gov.nic.flutter_recensement

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterFragmentActivity() {
  override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
    super.configureFlutterEngine(flutterEngine)
    flutterEngine.plugins.add(PosPrinterPlugin())
    flutterEngine.plugins.add(MorphoFingerprintPlugin())
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    maybePrintFromIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    maybePrintFromIntent(intent)
  }

  private fun maybePrintFromIntent(intent: Intent?) {
    if (intent == null) return
    val action = intent.action ?: return
    if (action == ACTION_MORPHO_TEST || intent.getBooleanExtra(EXTRA_MORPHO_TEST, false)) {
      intent.action = Intent.ACTION_MAIN
      intent.removeExtra(EXTRA_MORPHO_TEST)
      Thread {
        try {
          Log.i(TAG_MORPHO, "Morpho self-test starting…")
          val prep = MorphoCaptureHelper.prepare(this)
          Log.i(TAG_MORPHO, "prepare=$prep")
          runOnUiThread {
            Toast.makeText(this, "Morpho OK: ${prep["sensor"]}", Toast.LENGTH_LONG).show()
          }
          // Capture courte pour valider le capteur (doigt requis).
          val cap = MorphoCaptureHelper.capture(this, "test", 25)
          Log.i(TAG_MORPHO, "capture ok len=${cap["template_len"]} q=${cap["quality"]}")
          runOnUiThread {
            Toast.makeText(
              this,
              "Empreinte OK q=${cap["quality"]} ${cap["template_len"]}o",
              Toast.LENGTH_LONG,
            ).show()
          }
        } catch (e: Exception) {
          Log.e(TAG_MORPHO, "Morpho self-test failed", e)
          runOnUiThread {
            Toast.makeText(this, "Morpho: ${e.message}", Toast.LENGTH_LONG).show()
          }
        }
      }.start()
      return
    }
    if (action != ACTION_PRINT_TEST && !intent.getBooleanExtra(EXTRA_PRINT_TEST, false)) {
      return
    }
    // Consommer pour éviter une double impression au recreate.
    intent.action = Intent.ACTION_MAIN
    intent.removeExtra(EXTRA_PRINT_TEST)

    Thread {
      try {
        Log.i(TAG, "Intent print test starting…")
        PosThermalPrinter.printTestCoupon(applicationContext)
        runOnUiThread {
          Toast.makeText(this, "Coupon test imprimé", Toast.LENGTH_LONG).show()
        }
        Log.i(TAG, "Intent print test OK")
      } catch (e: Exception) {
        Log.e(TAG, "Intent print test failed", e)
        runOnUiThread {
          Toast.makeText(this, "Impression: ${e.message}", Toast.LENGTH_LONG).show()
        }
      }
    }.start()
  }

  companion object {
    const val ACTION_PRINT_TEST = "cd.gov.nic.flutter_recensement.PRINT_TEST"
    const val EXTRA_PRINT_TEST = "print_test"
    const val ACTION_MORPHO_TEST = "cd.gov.nic.flutter_recensement.MORPHO_TEST"
    const val EXTRA_MORPHO_TEST = "morpho_test"
    private const val TAG = "PosPrinter"
    private const val TAG_MORPHO = "MorphoFp"
  }
}
