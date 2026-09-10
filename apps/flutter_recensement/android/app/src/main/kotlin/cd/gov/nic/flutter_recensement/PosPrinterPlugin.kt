package cd.gov.nic.flutter_recensement

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.RemoteException
import android.util.Log
import com.iposprinter.iposprinterservice.IPosPrinterCallback
import com.iposprinter.iposprinterservice.IPosPrinterService
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * Impression thermique native via ThermalPrinterService (iPos Q2I).
 * AIDL aligné sur les TRANSACTION codes firmware v5.1.
 */
class PosPrinterPlugin : FlutterPlugin, MethodChannel.MethodCallHandler {
  private lateinit var channel: MethodChannel
  private var appContext: Context? = null
  private var printer: IPosPrinterService? = null
  private var bound = false
  private val mainHandler = Handler(Looper.getMainLooper())

  private val connection =
    object : ServiceConnection {
      override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
        printer = IPosPrinterService.Stub.asInterface(service)
        bound = true
        Log.i(TAG, "iPos printer bound: $name")
      }

      override fun onServiceDisconnected(name: ComponentName?) {
        printer = null
        bound = false
        Log.w(TAG, "iPos printer disconnected")
      }
    }

  override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
    appContext = binding.applicationContext
    channel = MethodChannel(binding.binaryMessenger, "cd.gov.nic/pos_printer")
    channel.setMethodCallHandler(this)
    bindPrinter()
  }

  override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
    channel.setMethodCallHandler(null)
    unbindPrinter()
    appContext = null
  }

  override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
    when (call.method) {
      "isAvailable" -> {
        Thread {
          val ok = ensureBound()
          val status =
            try {
              if (ok) printer?.printerStatusSafe() else -1
            } catch (_: Exception) {
              -1
            }
          Log.i(TAG, "isAvailable=$ok status=$status")
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
        Thread {
          try {
            printCoupon(title, subtitle, name, sex, dob, localId, qr)
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

  private fun bindPrinter() {
    val ctx = appContext ?: return
    if (printer != null) return
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
      val ok = ctx.bindService(intent, connection, Context.BIND_AUTO_CREATE)
      Log.i(TAG, "bindService=$ok")
    } catch (e: Exception) {
      Log.e(TAG, "bindService error", e)
      bound = false
    }
  }

  private fun unbindPrinter() {
    val ctx = appContext ?: return
    if (!bound && printer == null) return
    try {
      ctx.unbindService(connection)
    } catch (_: Exception) {
    }
    bound = false
    printer = null
  }

  private fun ensureBound(): Boolean {
    if (printer != null) return true
    bindPrinter()
    var i = 0
    while (printer == null && i < 40) {
      try {
        Thread.sleep(100)
      } catch (_: InterruptedException) {
      }
      i++
    }
    return printer != null
  }

  private fun emptyCb(): IPosPrinterCallback.Stub =
    object : IPosPrinterCallback.Stub() {
      override fun onRunResult(isSuccess: Boolean) {}

      override fun onReturnString(value: String?) {}
    }

  private fun awaitCb(timeoutMs: Long = 5000): Pair<IPosPrinterCallback.Stub, () -> Boolean> {
    val latch = CountDownLatch(1)
    val ok = AtomicReference(false)
    val cb =
      object : IPosPrinterCallback.Stub() {
        override fun onRunResult(isSuccess: Boolean) {
          ok.set(isSuccess)
          latch.countDown()
        }

        override fun onReturnString(value: String?) {
          latch.countDown()
        }
      }
    val wait = {
      latch.await(timeoutMs, TimeUnit.MILLISECONDS)
      ok.get()
    }
    return cb to wait
  }

  /** Status firmware : 0 = OK (papier / prêt). Autres codes = erreur (papier, etc.). */
  private fun IPosPrinterService.printerStatusSafe(): Int =
    try {
      getPrinterStatus()
    } catch (_: RemoteException) {
      -99
    }

  private fun statusMessage(code: Int): String =
    when (code) {
      0 -> "OK"
      1 -> "Manque de papier"
      2 -> "Tête d'impression trop chaude"
      3 -> "Couvercle ouvert"
      4 -> "Imprimante occupée"
      255 -> "Erreur imprimante inconnue"
      else -> "Statut=$code"
    }

  private fun printCoupon(
    title: String,
    subtitle: String,
    name: String,
    sex: String,
    dob: String,
    localId: String,
    qr: String,
  ) {
    if (!ensureBound()) {
      throw IllegalStateException("Service imprimante POS indisponible")
    }
    val svc = printer ?: throw IllegalStateException("Imprimante non liée")

    val status = svc.printerStatusSafe()
    Log.i(TAG, "printer status before print: $status (${statusMessage(status)})")
    if (status == 1 || status == 3) {
      throw IllegalStateException(statusMessage(status))
    }
    if (status == 4) {
      // Attendre un peu si busy
      Thread.sleep(800)
      val again = svc.printerStatusSafe()
      if (again == 1 || again == 3) {
        throw IllegalStateException(statusMessage(again))
      }
    }

    try {
      val (initCb, waitInit) = awaitCb()
      svc.printerInit(initCb)
      if (!waitInit()) {
        Log.w(TAG, "printerInit callback timeout/false — continue")
      }

      // Mode ESC/POS standard (0) si supporté
      try {
        svc.printerSetInstructionMode(0, emptyCb())
      } catch (_: Exception) {
      }

      svc.setPrinterPrintAlignment(1, emptyCb()) // centre
      svc.setPrinterPrintFontSize(24, emptyCb())
      svc.printSpecifiedTypeText("$title\n", "ST", 32, emptyCb())
      svc.printText("$subtitle\n", emptyCb())
      svc.printBlankLines(1, 12, emptyCb())

      // QR trop long = échec fréquent sur 58mm — raccourcir si besoin
      val qrData =
        if (qr.length <= 180) {
          qr
        } else if (localId.isNotBlank()) {
          localId
        } else {
          qr.take(180)
        }
      val module = if (qrData.length > 80) 5 else 7
      Log.i(TAG, "printQR len=${qrData.length} module=$module")
      svc.printQRCode(qrData, module, 1, emptyCb())
      svc.printBlankLines(1, 12, emptyCb())

      svc.setPrinterPrintAlignment(0, emptyCb()) // gauche
      svc.printSpecifiedTypeText("$name\n", "ST", 28, emptyCb())
      if (sex.isNotBlank()) svc.printText("Sexe : $sex\n", emptyCb())
      if (dob.isNotBlank()) svc.printText("Naissance : $dob\n", emptyCb())
      svc.printText("Ref : $localId\n", emptyCb())
      svc.printBlankLines(1, 10, emptyCb())
      svc.printText("Pas une carte d'identite.\n", emptyCb())
      svc.printText("Carte officielle = ONIP.\n", emptyCb())

      val (perfCb, waitPerf) = awaitCb(10000)
      svc.printerPerformPrint(120, perfCb)
      val printed = waitPerf()
      Log.i(TAG, "printerPerformPrint ok=$printed")
      if (!printed) {
        // Certains firmwares rappellent tard / pas du tout — ne pas échouer si statut OK
        val after = svc.printerStatusSafe()
        if (after != 0 && after != 2) {
          throw IllegalStateException("Impression non confirmée (${statusMessage(after)})")
        }
      }
    } catch (e: RemoteException) {
      throw IllegalStateException("Erreur imprimante: ${e.message}", e)
    }
  }

  companion object {
    private const val TAG = "PosPrinter"
  }
}
