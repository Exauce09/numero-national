"""Diagnostic capture: image + template. Restart device handle cleanly."""
from __future__ import annotations

import time
from collections import Counter
from ctypes import CDLL, POINTER, byref, c_int, c_ubyte, c_uint, c_void_p, cast
from pathlib import Path

OUT = Path(__file__).resolve().parent / "_zk_last.pgm"

lib = CDLL("libzkfp.dll")
lib.ZKFPM_Init.restype = c_int
lib.ZKFPM_Terminate.restype = c_int
lib.ZKFPM_GetDeviceCount.restype = c_int
lib.ZKFPM_OpenDevice.restype = c_void_p
lib.ZKFPM_OpenDevice.argtypes = [c_int]
lib.ZKFPM_CloseDevice.restype = c_int
lib.ZKFPM_CloseDevice.argtypes = [c_void_p]
lib.ZKFPM_GetParameters.restype = c_int
lib.ZKFPM_GetParameters.argtypes = [c_void_p, c_int, POINTER(c_ubyte), POINTER(c_uint)]
lib.ZKFPM_AcquireFingerprint.restype = c_int
lib.ZKFPM_AcquireFingerprint.argtypes = [
    c_void_p,
    POINTER(c_ubyte),
    POINTER(c_ubyte),
    POINTER(c_uint),
]
lib.ZKFPM_AcquireFingerprintImage.restype = c_int
lib.ZKFPM_AcquireFingerprintImage.argtypes = [c_void_p, POINTER(c_ubyte)]
lib.ZKFPM_DBInit.restype = c_void_p
lib.ZKFPM_DBFree.restype = c_int
lib.ZKFPM_DBFree.argtypes = [c_void_p]
lib.ZKFPM_GetCaptureParams.restype = c_int


def get_param(h, code):
    buf = (c_ubyte * 4)()
    size = c_uint(4)
    rc = lib.ZKFPM_GetParameters(h, code, buf, byref(size))
    if rc != 0:
        return None
    return int.from_bytes(bytes(buf[: size.value]), "little")


print("Init", lib.ZKFPM_Init())
print("Count", lib.ZKFPM_GetDeviceCount())
h = lib.ZKFPM_OpenDevice(0)
print("Handle", h)
assert h
w = get_param(h, 1) or 300
ht = get_param(h, 2) or 375
print("Size", w, ht)
db = lib.ZKFPM_DBInit()
print("DB", db)

img = (c_ubyte * (w * ht))()
tmpl = (c_ubyte * 2048)()
codes = Counter()
print("Posez FERMEMENT le doigt au CENTRE du capteur (25s)...")
t0 = time.time()
ok = False
while time.time() - t0 < 25:
    # try image-only first
    rc_img = lib.ZKFPM_AcquireFingerprintImage(h, cast(img, POINTER(c_ubyte)))
    tsz = c_uint(2048)
    rc = lib.ZKFPM_AcquireFingerprint(
        h, cast(img, POINTER(c_ubyte)), cast(tmpl, POINTER(c_ubyte)), byref(tsz)
    )
    codes[(rc_img, rc)] += 1
    if rc == 0 and tsz.value > 0:
        print("SUCCESS template", tsz.value)
        data = bytes(img)
        OUT.write_bytes(
            f"P5\n{w} {ht}\n255\n".encode() + data
        )
        print("Wrote", OUT)
        ok = True
        break
    if rc_img == 0:
        # got image but no template — still save
        nz = sum(1 for b in bytes(img) if b > 20)
        print("IMAGE only nz=", nz, "tmpl rc=", rc)
        OUT.write_bytes(f"P5\n{w} {ht}\n255\n".encode() + bytes(img))
        print("Wrote image", OUT)
        ok = True
        break
    time.sleep(0.2)

print("code pairs (img_rc, fp_rc):", dict(codes))
if not ok:
    print("FAIL — sensor never returned an image. LED allume-t-il ?")

if db:
    lib.ZKFPM_DBFree(db)
lib.ZKFPM_CloseDevice(c_void_p(h))
lib.ZKFPM_Terminate()
