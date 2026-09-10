package cd.gov.nic.flutter_recensement

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.RemoteException
import com.iposprinter.iposprinterservice.IPosPrinterCallback
import com.iposprinter.iposprinterservice.IPosPrinterService
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * Impression thermique native via le service système iPosPrinter (POS Q2I / k80).
 * Évite PrintManager PDF qui plante sur ces terminaux.
 */
class PosPrinterPlugin : FlutterPlugin, MethodChannel.MethodCallHandler {
  private lateinit var channel: MethodChannel
  private var appContext: Context? = null
  private var printer: IPosPrinterService? = null
  private var bound = false
  private val mainHandler = Handler(Looper.getMainLooper())

  private val connection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
      printer = IPosPrinterService.Stub.asInterface(service)
      bound = true
    }

    override fun onServiceDisconnected(name: ComponentName?) {
      printer = null
      bound = false
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
            mainHandler.post { result.error("PRINT_FAILED", e.message, null) }
          }
        }.start()
      }
      else -> result.notImplemented()
    }
  }

  private fun bindPrinter() {
    val ctx = appContext ?: return
    if (bound) return
    try {
      val intent = Intent().apply {
        setPackage("com.iposprinter.iposprinterservice")
        action = "com.iposprinter.iposprinterservice.IPosPrintService"
      }
      ctx.bindService(intent, connection, Context.BIND_AUTO_CREATE)
    } catch (_: Exception) {
      bound = false
    }
  }

  private fun unbindPrinter() {
    val ctx = appContext ?: return
    if (!bound) return
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
    while (printer == null && i < 25) {
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

  private fun awaitCb(timeoutMs: Long = 4000): Pair<IPosPrinterCallback.Stub, () -> Boolean> {
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

    try {
      val (initCb, waitInit) = awaitCb()
      svc.printerInit(initCb)
      waitInit()

      svc.setPrinterPrintAlignment(1, emptyCb()) // centre
      svc.printText("$title\n", emptyCb())
      svc.printText("$subtitle\n", emptyCb())
      svc.printBlankLines(1, 16, emptyCb())
      svc.printQRCode(qr, 8, 1, emptyCb())
      svc.printBlankLines(1, 16, emptyCb())
      svc.printText("$name\n", emptyCb())
      if (sex.isNotBlank()) svc.printText("Sexe : $sex\n", emptyCb())
      if (dob.isNotBlank()) svc.printText("Naissance : $dob\n", emptyCb())
      svc.printText("Ref : $localId\n", emptyCb())
      svc.printBlankLines(1, 12, emptyCb())
      svc.printText("Pas une carte d'identite.\n", emptyCb())
      svc.printText("Carte officielle = ONIP.\n", emptyCb())
      val (perfCb, waitPerf) = awaitCb(8000)
      svc.printerPerformPrint(160, perfCb)
      waitPerf()
    } catch (e: RemoteException) {
      throw IllegalStateException("Erreur imprimante: ${e.message}", e)
    }
  }
}
