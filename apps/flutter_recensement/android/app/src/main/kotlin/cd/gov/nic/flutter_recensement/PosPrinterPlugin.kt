package cd.gov.nic.flutter_recensement

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * Bridge Flutter → PosThermalPrinter (iPos Q2I).
 */
class PosPrinterPlugin : FlutterPlugin, MethodChannel.MethodCallHandler {
  private lateinit var channel: MethodChannel
  private var appContext: Context? = null
  private var warmPrinterBound = false
  private val mainHandler = Handler(Looper.getMainLooper())

  private val warmConnection =
    object : ServiceConnection {
      override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
        warmPrinterBound = true
        Log.i(TAG, "warm bind ok: $name")
      }

      override fun onServiceDisconnected(name: ComponentName?) {
        warmPrinterBound = false
      }
    }

  override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
    appContext = binding.applicationContext
    channel = MethodChannel(binding.binaryMessenger, "cd.gov.nic/pos_printer")
    channel.setMethodCallHandler(this)
    // Pré-chauffe du service pour isAvailable() rapide.
    try {
      val intent =
        Intent().apply {
          setPackage("com.iposprinter.iposprinterservice")
          action = "com.iposprinter.iposprinterservice.IPosPrintService"
          component =
            ComponentName(
              "com.iposprinter.iposprinterservice",
              "com.iposprinter.iposprinterservice.IPosPrintService",
            )
        }
      warmPrinterBound =
        binding.applicationContext.bindService(intent, warmConnection, Context.BIND_AUTO_CREATE)
    } catch (e: Exception) {
      Log.w(TAG, "warm bind failed", e)
    }
  }

  override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
    channel.setMethodCallHandler(null)
    try {
      if (warmPrinterBound) binding.applicationContext.unbindService(warmConnection)
    } catch (_: Exception) {
    }
    warmPrinterBound = false
    appContext = null
  }

  override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
    when (call.method) {
      "isAvailable" -> {
        Thread {
          val ctx = appContext
          val ok =
            if (ctx == null) {
              false
            } else {
              try {
                // Tentative courte : si le package est présent, on considère dispo.
                ctx.packageManager.getPackageInfo("com.iposprinter.iposprinterservice", 0)
                true
              } catch (_: Exception) {
                false
              }
            }
          mainHandler.post { result.success(ok) }
        }.start()
      }
      "printCoupon" -> {
        val title = call.argument<String>("title") ?: "ONIP"
        val subtitle = call.argument<String>("subtitle") ?: "Coupon provisoire"
        val name = call.argument<String>("name") ?: "—"
        val sex = call.argument<String>("sex") ?: ""
        val dob = call.argument<String>("dob") ?: ""
        val localId = call.argument<String>("localId") ?: ""
        val qr = call.argument<String>("qr") ?: localId
        val ctx = appContext
        if (ctx == null) {
          result.error("NO_CONTEXT", "Context null", null)
          return
        }
        Thread {
          try {
            PosThermalPrinter.printCoupon(ctx, title, subtitle, name, sex, dob, localId, qr)
            mainHandler.post { result.success(true) }
          } catch (e: Exception) {
            Log.e(TAG, "printCoupon failed", e)
            mainHandler.post { result.error("PRINT_FAILED", e.message, null) }
          }
        }.start()
      }
      else -> result.notImplemented()
    }
  }

  companion object {
    private const val TAG = "PosPrinter"
  }
}
