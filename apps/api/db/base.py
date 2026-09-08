"""SQLAlchemy declarative base for all domain models."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base. Domain models will inherit from this in later phases."""
