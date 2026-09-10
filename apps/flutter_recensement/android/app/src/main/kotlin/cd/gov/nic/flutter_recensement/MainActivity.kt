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
    private const val TAG = "PosPrinter"
  }
}
