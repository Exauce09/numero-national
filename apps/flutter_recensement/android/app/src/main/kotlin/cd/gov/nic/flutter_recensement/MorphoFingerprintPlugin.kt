package cd.gov.nic.flutter_recensement

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.util.Log
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.util.concurrent.Executors

/** Channel Flutter → MorphoCaptureHelper (SDK MorphoSmart). */
class MorphoFingerprintPlugin :
  FlutterPlugin,
  MethodChannel.MethodCallHandler,
  ActivityAware {

  private lateinit var channel: MethodChannel
  private var activity: Activity? = null
  private val executor = Executors.newSingleThreadExecutor()
  private val main = Handler(Looper.getMainLooper())

  override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
    channel = MethodChannel(binding.binaryMessenger, CHANNEL)
    channel.setMethodCallHandler(this)
  }

  override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
    channel.setMethodCallHandler(null)
    MorphoCaptureHelper.closeQuietly()
  }

  override fun onAttachedToActivity(binding: ActivityPluginBinding) {
    activity = binding.activity
  }

  override fun onDetachedFromActivityForConfigChanges() {
    activity = null
  }

  override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) {
    activity = binding.activity
  }

  override fun onDetachedFromActivity() {
    MorphoCaptureHelper.closeQuietly()
    activity = null
  }

  override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
    when (call.method) {
      "isAvailable" -> result.success(true)
      "prepare" -> {
        val act = activity
        if (act == null) {
          result.error("NO_ACTIVITY", "Activity required for Morpho USB", null)
          return
        }
        executor.execute {
          try {
            val status = MorphoCaptureHelper.prepare(act)
            main.post { result.success(status) }
          } catch (e: Exception) {
            Log.e(TAG, "prepare failed", e)
            main.post { result.error("PREPARE_FAIL", e.message, null) }
          }
        }
      }
      "capture" -> {
        val act = activity
        if (act == null) {
          result.error("NO_ACTIVITY", "Activity required for Morpho USB", null)
          return
        }
        val hand = call.argument<String>("hand") ?: "doigt"
        val timeout = call.argument<Int>("timeout") ?: 30
        executor.execute {
          try {
            val out = MorphoCaptureHelper.capture(act, hand, timeout)
            main.post { result.success(out) }
          } catch (e: Exception) {
            Log.e(TAG, "capture failed", e)
            main.post { result.error("CAPTURE_FAIL", e.message, null) }
          }
        }
      }
      "close" -> {
        executor.execute {
          MorphoCaptureHelper.closeQuietly()
          main.post { result.success(true) }
        }
      }
      else -> result.notImplemented()
    }
  }

  companion object {
    const val CHANNEL = "cd.gov.nic/morpho_fingerprint"
    private const val TAG = "MorphoFp"
  }
}
