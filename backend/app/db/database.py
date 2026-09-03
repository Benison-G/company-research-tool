"""
Database setup for the Company Research Tool.

Uses SQLite via SQLAlchemy. Kept intentionally simple: one engine, one
sessionmaker, one declarative base, and a FastAPI dependency (`get_db`)
that yields a session per-request and always closes it.
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./research.db")

# `check_same_thread=False` is required for SQLite when it's accessed from
# multiple threads, which FastAPI's threadpool-backed sync endpoints do.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    """Create all tables if they don't already exist."""
    # Import models here so they're registered on Base.metadata before create_all.
    from app.models import report  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency that yields a DB session and closes it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
