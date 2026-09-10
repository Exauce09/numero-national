package cd.gov.nic.flutter_recensement

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.os.RemoteException
import android.util.Log
import com.iposprinter.iposprinterservice.IPosPrinterCallback
import com.iposprinter.iposprinterservice.IPosPrinterService
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * Liaison + impression iPos hors Flutter (tests ADB / intent).
 * AIDL = TRANSACTION codes firmware ThermalPrinterService v5.1.
 */
object PosThermalPrinter {
  private const val TAG = "PosPrinter"

  fun printCoupon(
    context: Context,
    title: String,
    subtitle: String,
    name: String,
    sex: String,
    dob: String,
    localId: String,
    qr: String,
  ) {
    val safeTitle = ascii(title)
    val safeSubtitle = ascii(subtitle)
    val safeName = ascii(name)
    val safeSex = ascii(sex)
    val safeDob = ascii(dob)
    val safeLocalId = ascii(localId)
    val safeQr = qr // JSON ASCII

    val holder = ServiceHolder()
    if (!holder.bind(context.applicationContext)) {
      throw IllegalStateException("Service imprimante POS indisponible")
    }
    try {
      val svc = holder.service ?: throw IllegalStateException("Imprimante non liée")
      val status = svc.statusSafe()
      Log.i(TAG, "status=$status (${statusMessage(status)})")
      if (status == 1) throw IllegalStateException("Manque de papier")
      if (status == 3) throw IllegalStateException("Couvercle ouvert")
      if (status == 4) {
        Thread.sleep(800)
        val again = svc.statusSafe()
        if (again == 1 || again == 3) throw IllegalStateException(statusMessage(again))
      }

      val (initCb, waitInit) = awaitCb()
      svc.printerInit(initCb)
      waitInit()

      try {
        svc.printerSetInstructionMode(0, emptyCb())
      } catch (_: Exception) {
      }

      svc.setPrinterPrintAlignment(1, emptyCb())
      svc.setPrinterPrintFontSize(24, emptyCb())
      // printText uniquement — printSpecifiedTypeText("ST") plante sur ce firmware.
      svc.printText("$safeTitle\n", emptyCb())
      Thread.sleep(30)
      svc.printText("$safeSubtitle\n", emptyCb())
      svc.printBlankLines(1, 12, emptyCb())

      val qrData =
        when {
          safeQr.length <= 180 -> safeQr
          safeLocalId.isNotBlank() -> safeLocalId
          else -> safeQr.take(180)
        }
      val module = if (qrData.length > 80) 5 else 7
      Log.i(TAG, "printQR len=${qrData.length} module=$module")
      svc.printQRCode(qrData, module, 1, emptyCb())
      svc.printBlankLines(1, 12, emptyCb())

      svc.setPrinterPrintAlignment(0, emptyCb())
      svc.printText("$safeName\n", emptyCb())
      Thread.sleep(30)
      if (safeSex.isNotBlank()) svc.printText("Sexe : $safeSex\n", emptyCb())
      if (safeDob.isNotBlank()) svc.printText("Naissance : $safeDob\n", emptyCb())
      svc.printText("Ref : $safeLocalId\n", emptyCb())
      svc.printBlankLines(1, 10, emptyCb())
      svc.printText("Pas une carte d'identite.\n", emptyCb())
      svc.printText("Carte officielle = ONIP.\n", emptyCb())

      // Le callback onRunResult arrive souvent après la fin réelle ; ne pas échouer trop tôt.
      val (perfCb, waitPerf) = awaitCb(15000)
      svc.printerPerformPrint(120, perfCb)
      val printed = waitPerf()
      Log.i(TAG, "printerPerformPrint callback=$printed")
      // Attendre que le moteur repasse au statut normal (0).
      var finalStatus = svc.statusSafe()
      var spins = 0
      while ((finalStatus == 4 || finalStatus == -99) && spins < 30) {
        Thread.sleep(200)
        finalStatus = svc.statusSafe()
        spins++
      }
      Log.i(TAG, "status after print=$finalStatus (${statusMessage(finalStatus)})")
      if (finalStatus == 1) {
        throw IllegalStateException("Manque de papier (pendant/apres impression)")
      }
      // Succès si callback OK, ou si le service a bien démarré (startPrint) et n'est plus en erreur.
      if (!printed && finalStatus != 0 && finalStatus != 2) {
        Log.w(TAG, "callback false but status=$finalStatus — considérer OK si impression lancée")
      }
      Log.i(TAG, "printCoupon finished")
    } finally {
      holder.unbind(context.applicationContext)
    }
  }

  /** Évite les glyphes non supportés par la police thermique (crash FontMethod). */
  private fun ascii(input: String): String {
    val map =
      mapOf(
        'à' to 'a', 'â' to 'a', 'ä' to 'a', 'á' to 'a',
        'é' to 'e', 'è' to 'e', 'ê' to 'e', 'ë' to 'e',
        'î' to 'i', 'ï' to 'i', 'í' to 'i',
        'ô' to 'o', 'ö' to 'o', 'ó' to 'o',
        'ù' to 'u', 'û' to 'u', 'ü' to 'u', 'ú' to 'u',
        'ç' to 'c', 'ñ' to 'n',
        'À' to 'A', 'Â' to 'A', 'Ä' to 'A', 'Á' to 'A',
        'É' to 'E', 'È' to 'E', 'Ê' to 'E', 'Ë' to 'E',
        'Î' to 'I', 'Ï' to 'I', 'Í' to 'I',
        'Ô' to 'O', 'Ö' to 'O', 'Ó' to 'O',
        'Ù' to 'U', 'Û' to 'U', 'Ü' to 'U', 'Ú' to 'U',
        'Ç' to 'C', 'Ñ' to 'N',
        '—' to '-', '–' to '-', '’' to '\'', '‘' to '\'',
      )
    val sb = StringBuilder(input.length)
    for (ch in input) {
      when {
        map.containsKey(ch) -> sb.append(map[ch])
        ch.code in 32..126 -> sb.append(ch)
        ch == '\n' || ch == '\r' -> sb.append(ch)
        else -> sb.append('?')
      }
    }
    return sb.toString()
  }

  fun printTestCoupon(context: Context) {
    val id = "TEST-${System.currentTimeMillis() % 100000}"
    printCoupon(
      context = context,
      title = "ONIP - Recensement",
      subtitle = "Coupon provisoire",
      name = "TESTPRINT Auto",
      sex = "Masculin",
      dob = "1990-01-15",
      localId = id,
      qr = """{"type":"nn_census_coupon","v":1,"local_id":"$id"}""",
    )
  }

  private fun IPosPrinterService.statusSafe(): Int =
    try {
      getPrinterStatus()
    } catch (_: RemoteException) {
      -99
    }

  private fun statusMessage(code: Int): String =
    when (code) {
      0 -> "OK"
      1 -> "Manque de papier"
      2 -> "Tete impression trop chaude"
      3 -> "Couvercle ouvert"
      4 -> "Imprimante occupee"
      255 -> "Erreur inconnue"
      else -> "Statut=$code"
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
    return cb to {
      latch.await(timeoutMs, TimeUnit.MILLISECONDS)
      ok.get()
    }
  }

  private class ServiceHolder {
    @Volatile var service: IPosPrinterService? = null
    private var bound = false
    private val latch = CountDownLatch(1)
    private val connection =
      object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
          service = IPosPrinterService.Stub.asInterface(binder)
          bound = true
          latch.countDown()
          Log.i(TAG, "bound $name")
        }

        override fun onServiceDisconnected(name: ComponentName?) {
          service = null
          bound = false
        }
      }

    fun bind(ctx: Context): Boolean {
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
      if (!ok) return false
      latch.await(4, TimeUnit.SECONDS)
      return service != null
    }

    fun unbind(ctx: Context) {
      if (!bound && service == null) return
      try {
        ctx.unbindService(connection)
      } catch (_: Exception) {
      }
      bound = false
      service = null
    }
  }
}
