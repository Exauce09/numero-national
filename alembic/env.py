"""Alembic migration environment — reads DB URL from application settings."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from apps.api.core.config import get_settings
from apps.api.db.base import Base

# Register domain models so metadata is complete for autogenerate.
import apps.api.domains.recensement.models  # noqa: F401
import apps.api.domains.biometric.models  # noqa: F401
import apps.api.domains.health.models  # noqa: F401
import apps.api.domains.analytics.models  # noqa: F401
import apps.api.domains.notifications.models  # noqa: F401
import apps.api.domains.identity.models  # noqa: F401

# Optional sibling-phase models (ignore if not yet present).
for _mod in (
    "apps.api.domains.identity.models",
    "apps.api.domains.audit.models",
    "apps.api.domains.interop.models",
    "apps.api.domains.core_registry.models",
    "apps.api.domains.token_service.models",
    "apps.api.domains.etat_civil.models",
    "apps.api.domains.cards.models",
    "apps.api.domains.documents.models",
):
    try:
        __import__(_mod)
    except Exception:
        pass

config = context.config
settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.sync_database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (SQL script generation)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        include_schemas=True,
        version_table_schema="identity",
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            include_schemas=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
