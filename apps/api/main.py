"""FastAPI application entrypoint — hardened MVP Phases 1–9."""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI

from apps.api import __version__
from apps.api.api.routes import health
from apps.api.api.v1_router import build_v1_router
from apps.api.core.config import get_settings
from apps.api.core.logging import setup_logging
from apps.api.core.middleware import apply_security_middleware
from apps.api.db.session import engine


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    setup_logging(settings)
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        description=(
            "Systeme National Integre d'Identite et de Gestion de la Population. "
            "MVP Phases 1–9 — sécurité renforcée (JWT, audit, NIC, tokens hashés)."
        ),
        version=__version__,
        lifespan=lifespan,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
    )
    apply_security_middleware(application, settings)
    application.include_router(health.router)
    application.include_router(build_v1_router())
    return application


app = create_app()
