"""Interchangeable biometric matching providers (Local / future SDK / ABIS)."""

from __future__ import annotations

import base64
import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass

from cryptography.fernet import Fernet

from apps.api.core.config import get_settings


@dataclass(frozen=True, slots=True)
class MatchHit:
    template_id: str
    citizen_id: str
    score: float
    finger_position: str | None = None


class BiometricProvider(ABC):
    @abstractmethod
    def extract_features(self, raw_template: bytes) -> bytes:
        ...

    @abstractmethod
    def generate_template(self, features: bytes) -> bytes:
        ...

    @abstractmethod
    def template_hash(self, template: bytes) -> str:
        ...

    @abstractmethod
    def encrypt_template(self, template: bytes) -> bytes:
        ...

    @abstractmethod
    def decrypt_template(self, encrypted: bytes) -> bytes:
        ...

    @abstractmethod
    def compare(self, probe_hash: str, gallery_hash: str) -> float:
        ...

    def validate_quality(self, quality_score: float | None, min_quality: float) -> bool:
        if quality_score is None:
            return True
        return quality_score >= min_quality


class LocalHashProvider(BiometricProvider):
    """Demo provider — deterministic hash comparison. NOT a certified matcher."""

    ALGORITHM = "mvp-hash-v1"

    def __init__(self) -> None:
        settings = get_settings()
        key = base64.urlsafe_b64encode(
            hashlib.sha256(settings.secret_key.encode("utf-8")).digest()
        )
        self._fernet = Fernet(key)

    def extract_features(self, raw_template: bytes) -> bytes:
        return raw_template

    def generate_template(self, features: bytes) -> bytes:
        return features

    def template_hash(self, template: bytes) -> str:
        return hashlib.sha256(template).hexdigest()

    def encrypt_template(self, template: bytes) -> bytes:
        return self._fernet.encrypt(template)

    def decrypt_template(self, encrypted: bytes) -> bytes:
        try:
            return self._fernet.decrypt(encrypted)
        except Exception:
            # Legacy rows stored as plaintext bytes before encryption.
            return encrypted

    def compare(self, probe_hash: str, gallery_hash: str) -> float:
        if probe_hash == gallery_hash:
            return 1.0
        common = 0
        for x, y in zip(probe_hash, gallery_hash):
            if x == y:
                common += 1
            else:
                break
        return round(common / max(len(probe_hash), 1), 4)


_provider: BiometricProvider | None = None


def get_biometric_provider() -> BiometricProvider:
    global _provider
    if _provider is None:
        _provider = LocalHashProvider()
    return _provider
