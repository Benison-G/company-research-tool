"""
SQLAlchemy model for a saved research report.

The five report sections are stored as serialized JSON text columns. SQLite
has no native JSON type, and for a project this size a plain TEXT column
with json.dumps/json.loads at the service boundary is simpler than pulling
in JSON column extensions.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    overview: Mapped[str] = mapped_column(Text, nullable=False, default="")
    key_people: Mapped[str] = mapped_column(Text, nullable=False, default="[]")  # JSON list
    news: Mapped[str] = mapped_column(Text, nullable=False, default="[]")  # JSON list
    financials: Mapped[str] = mapped_column(Text, nullable=False, default="{}")  # JSON object
    risks: Mapped[str] = mapped_column(Text, nullable=False, default="[]")  # JSON list
