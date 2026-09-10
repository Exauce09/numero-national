package cd.gov.nic.flutter_recensement;

import android.app.Activity;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.util.Base64;
import android.util.Log;

import com.morpho.android.usb.USBManager;
import com.morpho.morphosmart.sdk.Coder;
import com.morpho.morphosmart.sdk.DetectionMode;
import com.morpho.morphosmart.sdk.EnrollmentType;
import com.morpho.morphosmart.sdk.ErrorCodes;
import com.morpho.morphosmart.sdk.LatentDetection;
import com.morpho.morphosmart.sdk.MorphoDevice;
import com.morpho.morphosmart.sdk.Template;
import com.morpho.morphosmart.sdk.TemplateFVPType;
import com.morpho.morphosmart.sdk.TemplateList;
import com.morpho.morphosmart.sdk.TemplateType;

import java.util.HashMap;
import java.util.Map;
import java.util.Observable;
import java.util.Observer;

/** Capture MorphoSmart (MSO / CBM-E3) — logique Java pure pour l’API Integer JNI. */
public final class MorphoCaptureHelper {
  private static final String TAG = "MorphoCapture";
  private static final String USB_ACTION = "cd.gov.nic.flutter_recensement.USB_ACTION";

  /** Mode enroll (la LED optique CBM-E3 s’allume pendant capture ; WAKEUP_LED_ON n’est pas supporté → -5). */
  private static final int DETECT_MODE = DetectionMode.MORPHO_ENROLL_DETECT_MODE;

  private static MorphoDevice device;
  private static String sensorName;

  private MorphoCaptureHelper() {}

  public static synchronized Map<String, Object> prepare(Activity activity) throws Exception {
    return prepareInternal(activity, false);
  }

  /**
   * @param forceReopen si true, ferme toute session et rouvre (nécessaire avant capture pour LED).
   */
  private static Map<String, Object> prepareInternal(Activity activity, boolean forceReopen)
      throws Exception {
    if (forceReopen) {
      closeQuietlyUnlocked();
    } else if (device != null) {
      Map<String, Object> cached = new HashMap<>();
      cached.put("ok", true);
      cached.put("sensor", sensorName == null ? "" : sensorName);
      cached.put("product", sensorName == null ? "" : sensorName);
      cached.put("count", 1);
      cached.put("cached", true);
      return cached;
    }

    try {
      System.loadLibrary("MSO100");
    } catch (Throwable ignored) {
    }
    System.loadLibrary("NativeMorphoSmartSDK");

    USBManager.getInstance().initialize(activity, USB_ACTION);
    waitUsbPermission(activity);

    MorphoDevice morpho = new MorphoDevice();
    Integer nbUsbDevice = new Integer(0);
    int ret = morpho.initUsbDevicesNameEnum(nbUsbDevice);
    if (ret != ErrorCodes.MORPHO_OK) {
      throw new IllegalStateException(
          "initUsbDevicesNameEnum=" + ret + " " + ErrorCodes.getError(ret, morpho.getInternalError()));
    }
    if (nbUsbDevice.intValue() <= 0) {
      USBManager.getInstance().initialize(activity, USB_ACTION);
      sleepMs(900);
      nbUsbDevice = new Integer(0);
      ret = morpho.initUsbDevicesNameEnum(nbUsbDevice);
      if (ret != ErrorCodes.MORPHO_OK || nbUsbDevice.intValue() <= 0) {
        throw new IllegalStateException(
            "Aucun capteur Morpho détecté. Accordez la permission USB.");
      }
    }

    String name = morpho.getUsbDeviceName(0);
    ret = morpho.openUsbDevice(name, 0);
    if (ret != ErrorCodes.MORPHO_OK) {
      throw new IllegalStateException(
          "openUsbDevice=" + ret + " " + ErrorCodes.getError(ret, morpho.getInternalError()));
    }

    closeQuietlyUnlocked();
    device = morpho;
    sensorName = name;

    String product;
    try {
      product = morpho.getProductDescriptor();
    } catch (Throwable t) {
      product = name;
    }

    Map<String, Object> out = new HashMap<>();
    out.put("ok", true);
    out.put("sensor", name);
    out.put("product", product);
    out.put("count", nbUsbDevice.intValue());
    Log.i(TAG, "Morpho ready: " + name);
    return out;
  }

  public static synchronized Map<String, Object> capture(Activity activity, String hand, int timeoutSec)
      throws Exception {
    // Toujours rouvrir : une session « prepare » au boot n’allume pas la LED ;
    // la LED optique s’allume au début de capture() sur une session fraîche.
    prepareInternal(activity, true);

    MorphoDevice morpho = device;
    if (morpho == null) {
      throw new IllegalStateException("Device Morpho non ouvert");
    }

    try {
      morpho.cancelLiveAcquisition();
    } catch (Throwable ignored) {
    }

    TemplateList templateList = new TemplateList();
    Observer observer =
        new Observer() {
          @Override
          public void update(Observable o, Object arg) {
            Log.d(TAG, "Morpho callback: " + (arg == null ? "null" : arg.getClass().getSimpleName()));
          }
        };

    int timeout = Math.max(5, Math.min(60, timeoutSec));
    Log.i(
        TAG,
        "Capture START hand="
            + hand
            + " timeout="
            + timeout
            + "s — la lumière rouge du lecteur doit s’allumer maintenant");

    int ret =
        morpho.capture(
            timeout,
            0,
            0,
            1,
            TemplateType.MORPHO_PK_ISO_FMR,
            TemplateFVPType.MORPHO_NO_PK_FVP,
            255,
            EnrollmentType.ONE_ACQUISITIONS,
            LatentDetection.LATENT_DETECT_ENABLE,
            Coder.MORPHO_MSO_V9_CODER,
            DETECT_MODE,
            templateList,
            0,
            observer);

    Log.i(TAG, "Capture END ret=" + ret + " templates=" + templateList.getNbTemplate());

    if (ret != ErrorCodes.MORPHO_OK) {
      throw new IllegalStateException(
          "capture=" + ret + " " + ErrorCodes.getError(ret, morpho.getInternalError()));
    }
    if (templateList.getNbTemplate() <= 0) {
      throw new IllegalStateException("Aucun template empreinte reçu");
    }
    Template template = templateList.getTemplate(0);
    if (template == null || template.getData() == null || template.getData().length == 0) {
      throw new IllegalStateException("Template empreinte vide");
    }
    byte[] data = template.getData();
    String b64 = Base64.encodeToString(data, Base64.NO_WRAP);
    int quality = template.getTemplateQuality();
    String ref =
        "morpho-fp://" + hand + "/q" + quality + "/" + System.currentTimeMillis() + "#" + data.length;

    Map<String, Object> out = new HashMap<>();
    out.put("ok", true);
    out.put("hand", hand);
    out.put("quality", quality);
    out.put("template_type", "ISO_FMR");
    out.put("template_b64", b64);
    out.put("template_len", data.length);
    out.put("sensor", sensorName == null ? "" : sensorName);
    out.put("ref", ref);
    Log.i(TAG, "Capture OK hand=" + hand + " q=" + quality + " len=" + data.length);
    return out;
  }

  public static synchronized void closeQuietly() {
    closeQuietlyUnlocked();
  }

  private static void closeQuietlyUnlocked() {
    try {
      if (device != null) {
        try {
          device.cancelLiveAcquisition();
        } catch (Throwable ignored) {
        }
        device.closeDevice();
      }
    } catch (Throwable ignored) {
    }
    device = null;
    sensorName = null;
  }

  private static void waitUsbPermission(Activity activity) {
    UsbManager usbManager = (UsbManager) activity.getSystemService(Activity.USB_SERVICE);
    if (usbManager == null) return;
    for (int attempt = 0; attempt < 15; attempt++) {
      boolean ready = false;
      for (UsbDevice d : usbManager.getDeviceList().values()) {
        if (d.getVendorId() == 0x225D && d.getProductId() == 0x0008) {
          if (usbManager.hasPermission(d)) {
            ready = true;
            break;
          }
          USBManager.getInstance().initialize(activity, USB_ACTION);
        }
      }
      if (ready) break;
      sleepMs(400);
    }
  }

  private static void sleepMs(int ms) {
    try {
      Thread.sleep(ms);
    } catch (InterruptedException ignored) {
    }
  }
}
