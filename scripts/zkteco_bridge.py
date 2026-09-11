"""Pont local ZK9500 (USB) → capture gabarit pour le site état civil / biometrie.

Usage (PC où le ZK9500 est branché) :
  py -3 scripts/zkteco_bridge.py

Endpoints :
  GET  http://127.0.0.1:18765/health
  POST http://127.0.0.1:18765/capture   → { template_b64, quality, device, algorithm, note }

Sans SDK ZKFinger (libzkfp), le pont tourne en mode DEMO (échantillon déterministe)
afin de valider le flux site → API 1:N. Branchez le SDK constructeur pour la capture réelle.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.getenv("ZKTECO_BRIDGE_HOST", "127.0.0.1")
PORT = int(os.getenv("ZKTECO_BRIDGE_PORT", "18765"))
DEMO = os.getenv("ZKTECO_DEMO", "1") != "0"


def _try_native_capture() -> dict | None:
    """Hook SDK ZKFinger — à brancher avec libzkfp.dll du constructeur."""
    # Placeholder: real integration loads ZKFinger Reader SDK and returns ISO/ANSI template.
    return None


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
        "note": (
            "Capture DEMO — installez le SDK ZKFinger et désactivez ZKTECO_DEMO=0 "
            "pour une capture réelle. Matching Morpho↔ZKTeco nécessite un ABIS."
        ),
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
                    "demo": DEMO,
                    "sdk_loaded": False,
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
        if not DEMO:
            native = _try_native_capture()
            if native:
                self._json(200, native)
                return
        self._json(200, _demo_capture(finger))

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[zkteco-bridge] " + (fmt % args) + "\n")


def main() -> None:
    print(f"ZK9500 bridge on http://{HOST}:{PORT}  demo={DEMO}")
    print("Keep this process running while using Identification biométrique on the site.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
