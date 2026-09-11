"""Pont local ZK9500 (USB) → capture gabarit réel via libzkfp.dll (SDK ZKFinger).

Usage (PC où le ZK9500 est branché) :
  py -3 scripts/zkteco_bridge.py

Endpoints :
  GET  http://127.0.0.1:18765/health
  POST http://127.0.0.1:18765/capture   → { template_b64, quality, device, algorithm, note }

Variables :
  ZKTECO_DEMO=0|1     forcer démo (défaut: 0 si SDK + appareil OK, sinon 1)
  ZKTECO_CAPTURE_MS   délai max capture (défaut 15000)
  ZKTECO_BRIDGE_HOST / ZKTECO_BRIDGE_PORT
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import sys
import threading
import time
from ctypes import CDLL, POINTER, byref, c_int, c_ubyte, c_uint, c_void_p
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.getenv("ZKTECO_BRIDGE_HOST", "127.0.0.1")
PORT = int(os.getenv("ZKTECO_BRIDGE_PORT", "18765"))
CAPTURE_MS = int(os.getenv("ZKTECO_CAPTURE_MS", "15000"))

# Error codes (ZKFinger SDK)
ZKFP_ERR_OK = 0
ZKFP_ERR_CAPTURE = -8  # no finger / not ready


class ZkFingerNative:
    """ctypes wrapper around libzkfp.dll (ZKFinger Reader SDK)."""

    def __init__(self) -> None:
        self.lib: CDLL | None = None
        self.handle: c_void_p | None = None
        self.width = 256
        self.height = 288
        self.lock = threading.Lock()
        self.last_error = ""

    def load(self) -> bool:
        try:
            lib = CDLL("libzkfp.dll")
        except OSError as exc:
            self.last_error = f"libzkfp.dll introuvable: {exc}"
            return False

        lib.ZKFPM_Init.restype = c_int
        lib.ZKFPM_Terminate.restype = c_int
        lib.ZKFPM_GetDeviceCount.restype = c_int
        lib.ZKFPM_OpenDevice.restype = c_void_p
        lib.ZKFPM_OpenDevice.argtypes = [c_int]
        lib.ZKFPM_CloseDevice.restype = c_int
        lib.ZKFPM_CloseDevice.argtypes = [c_void_p]
        lib.ZKFPM_GetParameters.restype = c_int
        lib.ZKFPM_GetParameters.argtypes = [
            c_void_p,
            c_int,
            POINTER(c_ubyte),
            POINTER(c_uint),
        ]
        lib.ZKFPM_AcquireFingerprint.restype = c_int
        lib.ZKFPM_AcquireFingerprint.argtypes = [
            c_void_p,
            POINTER(c_ubyte),
            POINTER(c_ubyte),
            POINTER(c_uint),
        ]
        self.lib = lib
        return True

    def open(self) -> bool:
        if not self.lib:
            return False
        rc = self.lib.ZKFPM_Init()
        if rc != ZKFP_ERR_OK:
            self.last_error = f"ZKFPM_Init={rc}"
            return False
        count = self.lib.ZKFPM_GetDeviceCount()
        if count < 1:
            self.last_error = "Aucun lecteur ZK détecté (brancher le ZK9500)"
            self.lib.ZKFPM_Terminate()
            return False
        handle = self.lib.ZKFPM_OpenDevice(0)
        if not handle:
            self.last_error = "ZKFPM_OpenDevice a échoué"
            self.lib.ZKFPM_Terminate()
            return False
        self.handle = c_void_p(handle)
        self.width = self._param(1) or 300
        self.height = self._param(2) or 375
        self.last_error = ""
        return True

    def _param(self, code: int) -> int | None:
        assert self.lib and self.handle
        buf = (c_ubyte * 4)()
        size = c_uint(4)
        rc = self.lib.ZKFPM_GetParameters(self.handle, code, buf, byref(size))
        if rc != ZKFP_ERR_OK:
            return None
        return int.from_bytes(bytes(buf[: size.value]), "little")

    def device_count(self) -> int:
        if not self.lib:
            return 0
        try:
            return int(self.lib.ZKFPM_GetDeviceCount())
        except Exception:
            return 0

    def capture(self, timeout_ms: int = CAPTURE_MS) -> dict:
        if not self.lib or not self.handle:
            raise RuntimeError(self.last_error or "SDK non initialisé")

        with self.lock:
            img = (c_ubyte * (self.width * self.height))()
            tmpl = (c_ubyte * 2048)()
            tsz = c_uint(2048)
            deadline = time.time() + (timeout_ms / 1000.0)
            last_rc = ZKFP_ERR_CAPTURE
            while time.time() < deadline:
                tsz.value = 2048
                last_rc = self.lib.ZKFPM_AcquireFingerprint(
                    self.handle, img, tmpl, byref(tsz)
                )
                if last_rc == ZKFP_ERR_OK and tsz.value > 0:
                    raw = bytes(tmpl[: tsz.value])
                    # Rough quality proxy: template length + non-zero density
                    nz = sum(1 for b in raw[:64] if b)
                    quality = min(99.0, 55.0 + (tsz.value / 40.0) + nz * 0.4)
                    return {
                        "ok": True,
                        "demo": False,
                        "device": "ZK9500",
                        "algorithm": "zkfinger-libzkfp",
                        "finger_position": "UNKNOWN",
                        "quality_score": round(quality, 1),
                        "template_b64": base64.b64encode(raw).decode(),
                        "template_sha256": hashlib.sha256(raw).hexdigest(),
                        "template_size": tsz.value,
                        "image_width": self.width,
                        "image_height": self.height,
                        "note": "Capture réelle ZK9500 (libzkfp).",
                    }
                time.sleep(0.15)

            raise TimeoutError(
                f"Aucune empreinte capturée en {timeout_ms} ms "
                f"(posez le doigt sur le ZK9500). code={last_rc}"
            )

    def close(self) -> None:
        if self.lib and self.handle:
            try:
                self.lib.ZKFPM_CloseDevice(self.handle)
            except Exception:
                pass
            self.handle = None
        if self.lib:
            try:
                self.lib.ZKFPM_Terminate()
            except Exception:
                pass


NATIVE = ZkFingerNative()
SDK_OK = False


def _boot_sdk() -> bool:
    global SDK_OK
    if not NATIVE.load():
        print(f"[zkteco-bridge] {NATIVE.last_error}", file=sys.stderr)
        SDK_OK = False
        return False
    if not NATIVE.open():
        print(f"[zkteco-bridge] {NATIVE.last_error}", file=sys.stderr)
        SDK_OK = False
        return False
    SDK_OK = True
    print(
        f"[zkteco-bridge] SDK OK — {NATIVE.device_count()} appareil(s), "
        f"image {NATIVE.width}x{NATIVE.height}",
        file=sys.stderr,
    )
    return True


def _env_demo_forced() -> bool | None:
    raw = os.getenv("ZKTECO_DEMO")
    if raw is None:
        return None
    return raw != "0"


DEMO_MODE = True  # set in main()


def _demo_capture(finger: str = "INDEX_DROIT") -> dict:
    raw = f"ZK9500|DEMO|{finger}|v1".encode()
    return {
        "ok": True,
        "demo": True,
        "device": "ZK9500",
        "algorithm": "zkteco-demo-v1",
        "finger_position": finger,
        "quality_score": 92.0,
        "template_b64": base64.b64encode(raw).decode(),
        "template_sha256": hashlib.sha256(raw).hexdigest(),
        "note": "Capture DEMO forcée (ZKTECO_DEMO=1).",
    }


class Handler(BaseHTTPRequestHandler):
    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.path.startswith("/health"):
            self._json(
                200,
                {
                    "status": "ok",
                    "device_hint": "ZK9500",
                    "demo": DEMO_MODE,
                    "sdk_loaded": SDK_OK,
                    "device_count": NATIVE.device_count() if SDK_OK else 0,
                    "image_size": (
                        [NATIVE.width, NATIVE.height] if SDK_OK else None
                    ),
                    "last_error": NATIVE.last_error or None,
                },
            )
            return
        self._json(404, {"detail": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if not self.path.startswith("/capture"):
            self._json(404, {"detail": "not found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode() or "{}")
        except json.JSONDecodeError:
            body = {}
        finger = str(body.get("finger_position") or "INDEX_DROIT").upper()
        timeout_ms = int(body.get("timeout_ms") or CAPTURE_MS)

        if DEMO_MODE:
            payload = _demo_capture(finger)
            payload["finger_position"] = finger
            self._json(200, payload)
            return

        try:
            payload = NATIVE.capture(timeout_ms=timeout_ms)
            payload["finger_position"] = finger
            self._json(200, payload)
        except TimeoutError as exc:
            self._json(408, {"ok": False, "demo": False, "detail": str(exc)})
        except Exception as exc:  # noqa: BLE001
            self._json(500, {"ok": False, "demo": False, "detail": str(exc)})

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[zkteco-bridge] " + (fmt % args) + "\n")


def main() -> None:
    global DEMO_MODE
    sdk = _boot_sdk()
    forced = _env_demo_forced()
    if forced is True:
        DEMO_MODE = True
    elif forced is False:
        DEMO_MODE = False if sdk else True
        if not sdk:
            print(
                "[zkteco-bridge] ZKTECO_DEMO=0 mais SDK indisponible — "
                "échec démarrage réel.",
                file=sys.stderr,
            )
            sys.exit(1)
    else:
        # Auto: réel si SDK+device OK, sinon démo
        DEMO_MODE = not sdk

    print(f"ZK9500 bridge on http://{HOST}:{PORT}  demo={DEMO_MODE} sdk={sdk}")
    print("Posez le doigt sur le lecteur lors de /capture (mode réel).")
    try:
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    finally:
        NATIVE.close()


if __name__ == "__main__":
    main()
