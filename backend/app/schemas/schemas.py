"""
Pydantic models used for:
  1. Validating the structured JSON the LLM returns (the "LLM output contract").
  2. Validating/serializing API request and response payloads.

Keeping these in one file is a deliberate simplification for a project
this size -- splitting into request/response/domain modules would be
over-engineering here.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# LLM output contract (section 5 of the spec)
# ---------------------------------------------------------------------------

class KeyPerson(BaseModel):
    name: str
    title: str


class NewsItem(BaseModel):
    text: str
    source_url: Optional[str] = None


class RiskItem(BaseModel):
    text: str
    source_url: Optional[str] = None


class Financials(BaseModel):
    revenue: Optional[str] = None
    employee_count: Optional[str] = None
    market_cap: Optional[str] = None
    yoy_growth: Optional[str] = None


class ReportSections(BaseModel):
    """The exact shape we ask the LLM to produce."""

    overview: str = ""
    key_people: list[KeyPerson] = Field(default_factory=list)
    news: list[NewsItem] = Field(default_factory=list)
    financials: Financials = Field(default_factory=Financials)
    risks: list[RiskItem] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# API request payloads
# ---------------------------------------------------------------------------

class ResearchRequest(BaseModel):
    company_name: str

    @field_validator("company_name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if v is None:
            raise ValueError("company_name is required")
        return v


# ---------------------------------------------------------------------------
# API response payloads
# ---------------------------------------------------------------------------

class ReportSummary(BaseModel):
    id: int
    company_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportDetail(BaseModel):
    id: int
    company_name: str
    created_at: datetime
    overview: str
    key_people: list[KeyPerson]
    news: list[NewsItem]
    financials: Financials
    risks: list[RiskItem]

    model_config = {"from_attributes": True}


class HealthResponse(BaseModel):
    status: str = "healthy"
