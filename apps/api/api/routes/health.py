"""Health check endpoint — verifies API and PostgreSQL availability."""

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from apps.api.db.session import check_database_connection

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    """Health probe payload."""

    status: str = Field(description="Overall status: ok | degraded")
    api: str = Field(description="API process status")
    database: str = Field(description="PostgreSQL connectivity status")


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service health check",
    responses={
        200: {"description": "API and database are healthy"},
        503: {"description": "API up but database unreachable"},
    },
)
async def health_check() -> JSONResponse:
    """
    Return operational status of the API and PostgreSQL.

    Used by Docker HEALTHCHECK, load balancers and local smoke tests.
    """
    db_ok = await check_database_connection()
    payload = HealthResponse(
        status="ok" if db_ok else "degraded",
        api="up",
        database="up" if db_ok else "down",
    )
    http_status = status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(status_code=http_status, content=payload.model_dump())
