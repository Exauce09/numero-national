"""Pont LEGACY libzkfp — préférer scripts/start-zkteco-bridge.ps1 (ZKFPEngX).

Ce script reste pour diagnostic. Capture réelle stable = EngX (biokey.ocx).
"""
from __future__ import annotations

import sys

print(
    "Utilisez plutôt : powershell -File scripts/start-zkteco-bridge.ps1\n"
    "Le pont EngX (fenêtre ZK9500) est requis pour la capture réelle.",
    file=sys.stderr,
)
sys.exit(2)
