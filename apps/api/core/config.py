"""Application settings — secrets from environment only; production fail-fast."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_WEAK_SECRETS = frozenset(
    {
        "change-me",
        "change-me-generate-a-strong-random-secret",
        "secret",
        "password",
        "changeme",
    }
)


class Settings(BaseSettings):
    """Central configuration for the API service."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = Field(default="Systeme National d Identite", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    app_debug: bool = Field(default=False, alias="APP_DEBUG")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")

    # Master secret (required). Prefer dedicated keys below for each purpose.
    secret_key: str = Field(default="change-me", alias="SECRET_KEY")
    jwt_secret_key: str | None = Field(default=None, alias="JWT_SECRET_KEY")
    mfa_encryption_key: str | None = Field(default=None, alias="MFA_ENCRYPTION_KEY")
    qr_hmac_key: str | None = Field(default=None, alias="QR_HMAC_KEY")
    qr_key_id: str = Field(default="qr-v1", alias="QR_KEY_ID")

    access_token_expire_minutes: int = Field(default=15, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=7, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")

    mfa_issuer: str = Field(default="NumeroNational", alias="MFA_ISSUER")
    mfa_digits: int = Field(default=6, alias="MFA_DIGITS")
    mfa_interval: int = Field(default=30, alias="MFA_INTERVAL")
    mfa_valid_window: int = Field(default=1, alias="MFA_VALID_WINDOW")

    # Auth hardening
    allow_dev_auth_headers: bool = Field(default=False, alias="ALLOW_DEV_AUTH_HEADERS")
    allow_open_registration: bool = Field(default=False, alias="ALLOW_OPEN_REGISTRATION")
    password_min_length: int = Field(default=12, alias="PASSWORD_MIN_LENGTH")
    bcrypt_rounds: int = Field(default=12, alias="BCRYPT_ROUNDS")

    # HTTP / edge
    cors_origins: str = Field(default="http://localhost:5173,http://localhost:3000", alias="CORS_ORIGINS")
    allowed_hosts: str = Field(default="localhost,127.0.0.1", alias="ALLOWED_HOSTS")
    rate_limit_per_minute: int = Field(default=120, alias="RATE_LIMIT_PER_MINUTE")
    auth_rate_limit_per_minute: int = Field(default=20, alias="AUTH_RATE_LIMIT_PER_MINUTE")

    postgres_host: str = Field(default="localhost", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    postgres_user: str = Field(default="nic_admin", alias="POSTGRES_USER")
    postgres_password: str = Field(default="change-me", alias="POSTGRES_PASSWORD")
    postgres_db: str = Field(default="nic_core", alias="POSTGRES_DB")
    database_url: str | None = Field(default=None, alias="DATABASE_URL")

    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    @field_validator("secret_key")
    @classmethod
    def secret_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("SECRET_KEY must not be empty")
        return v

    @model_validator(mode="after")
    def refuse_weak_secrets_in_production(self) -> Settings:
        if not self.is_production:
            return self
        weak = []
        if self.secret_key.lower().strip() in _WEAK_SECRETS or len(self.secret_key) < 32:
            weak.append("SECRET_KEY")
        if self.postgres_password.lower().strip() in _WEAK_SECRETS or len(self.postgres_password) < 16:
            weak.append("POSTGRES_PASSWORD")
        if self.allow_dev_auth_headers:
            weak.append("ALLOW_DEV_AUTH_HEADERS must be false")
        if weak:
            raise ValueError(
                "Production security check failed: " + ", ".join(weak)
            )
        return self

    @computed_field  # type: ignore[prop-decorator]
    @property
    def jwt_secret(self) -> str:
        return self.jwt_secret_key or self.secret_key

    @computed_field  # type: ignore[prop-decorator]
    @property
    def mfa_secret_material(self) -> str:
        return self.mfa_encryption_key or self.secret_key

    @computed_field  # type: ignore[prop-decorator]
    @property
    def qr_signing_key(self) -> str:
        return self.qr_hmac_key or self.secret_key

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_hosts_list(self) -> list[str]:
        hosts = [h.strip() for h in self.allowed_hosts.split(",") if h.strip()]
        return hosts or ["localhost", "127.0.0.1"]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def async_database_url(self) -> str:
        if self.database_url:
            url = self.database_url
            if url.startswith("postgresql://"):
                return url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def sync_database_url(self) -> str:
        if self.database_url:
            url = self.database_url
            if url.startswith("postgresql+asyncpg://"):
                return url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
            if url.startswith("postgresql://"):
                return url.replace("postgresql://", "postgresql+psycopg://", 1)
            return url
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}

    @property
    def dev_header_auth_enabled(self) -> bool:
        """Header auth only when explicitly allowed and never in production."""
        return (not self.is_production) and self.allow_dev_auth_headers


@lru_cache
def get_settings() -> Settings:
    return Settings()
