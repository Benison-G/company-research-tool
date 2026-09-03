"""
The research agent pipeline described in section 4 of the spec:

  1. Validate the company input.
  2. Search the web for authoritative/current information.
  3. Gather relevant search results.
  4. Pass research context to the LLM.
  5. Ask the LLM to produce structured data for the five sections.
  6. Stream section results to the frontend.
  7. Once all sections are complete, save the report to SQLite.

Design note on streaming: the LLM is asked to produce the full structured
report in a single call (more reliable and far cheaper than five separate
calls, and matches "ask the LLM to produce structured data for the five
sections" in the spec). Once that result comes back, the agent emits SSE
`section_start` / `section_complete` events one section at a time, in the
five sections' order, with a small pacing delay -- so the frontend still
gets genuine progressive rendering instead of one big blob at the end. This
trade-off is called out in the README.

This module yields plain (event_name, data_dict) tuples. The API layer
(app/api/research.py) is responsible for SSE-formatting them -- keeping
that concern out of the agent makes the agent trivially unit-testable.
"""

import asyncio
import logging
import os
from collections.abc import AsyncGenerator

from app.db.database import SessionLocal
from app.schemas.schemas import ReportSections
from app.services.llm_service import LLMService, get_llm_service
from app.services.report_service import create_report
from app.services.search_service import SearchService, get_search_service
from app.services.validation import InvalidCompanyNameError, validate_company_name

logger = logging.getLogger(__name__)

SECTION_ORDER = ["overview", "key_people", "news", "financials", "risks"]

SEARCH_TOPICS = {
    "company overview": "{company} company overview what they do industry products",
    "key people": "{company} executives leadership team CEO CTO CFO",
    "recent news": "{company} recent news",
    "financials": "{company} revenue employees market cap annual report",
    "risk factors": "{company} risks lawsuit controversy regulatory investigation",
}

# In-memory guard against launching two concurrent research jobs for the
# same company. A module-level set is sufficient for a single-process dev
# app; a multi-worker deployment would need a shared store (e.g. Redis)
# instead, but that's out of scope here.
_active_research: set[str] = set()

# Small delay between emitted sections purely for UX pacing (see the
# streaming design note above) -- not a network/API wait. Overridable via
# env var so the test suite can run near-instantly.
_SECTION_PACING_SECONDS = float(os.getenv("SSE_SECTION_PACING_SECONDS", "0.35"))


def is_research_active(company_name: str) -> bool:
    return company_name.strip().lower() in _active_research


async def run_research(
    company_name_raw: str,
    search_service: SearchService | None = None,
    llm_service: LLMService | None = None,
) -> AsyncGenerator[tuple[str, dict], None]:
    """
    Run the full research pipeline for one company, yielding SSE events.

    Events yielded:
      ("section_start",    {"section": <name>})
      ("section_complete", {"section": <name>, "data": <...>})
      ("complete",         {"report_id": <int>})
      ("error",            {"message": <human readable>})
    """
    search_service = search_service or get_search_service()
    llm_service = llm_service or get_llm_service()

    # --- 1. Validate input -------------------------------------------------
    try:
        company_name = validate_company_name(company_name_raw)
    except InvalidCompanyNameError as exc:
        yield ("error", {"message": str(exc)})
        return

    key = company_name.lower()
    if key in _active_research:
        yield (
            "error",
            {"message": f"Research for '{company_name}' is already in progress."},
        )
        return

    _active_research.add(key)
    try:
        # --- 2 & 3. Search the web and gather results -----------------------
        results_by_topic = {}
        try:
            for topic, query_template in SEARCH_TOPICS.items():
                query = query_template.format(company=company_name)
                results_by_topic[topic] = await search_service.search(query)
        except Exception:
            logger.exception("Search step failed for %s", company_name)
            yield (
                "error",
                {"message": "Unable to research this company right now. Please try again."},
            )
            return

        # --- 4 & 5. Pass context to the LLM, get structured sections --------
        try:
            sections: ReportSections = await llm_service.generate_report(
                company_name, results_by_topic
            )
        except Exception:
            logger.exception("LLM step failed for %s", company_name)
            yield (
                "error",
                {"message": "Unable to research this company right now. Please try again."},
            )
            return

        # --- 6. Stream section results ---------------------------------------
        section_payloads = {
            "overview": sections.overview or "No overview available.",
            "key_people": [p.model_dump() for p in sections.key_people],
            "news": [n.model_dump() for n in sections.news],
            "financials": sections.financials.model_dump(),
            "risks": [r.model_dump() for r in sections.risks],
        }

        for section in SECTION_ORDER:
            yield ("section_start", {"section": section})
            await asyncio.sleep(_SECTION_PACING_SECONDS)
            yield ("section_complete", {"section": section, "data": section_payloads[section]})

        # --- 7. Save to SQLite -------------------------------------------------
        db = SessionLocal()
        try:
            report = create_report(db, company_name, sections)
        except Exception:
            logger.exception("Failed to save report for %s", company_name)
            yield ("error", {"message": "Report generated but could not be saved. Please retry."})
            return
        finally:
            db.close()

        yield ("complete", {"report_id": report.id})

    finally:
        _active_research.discard(key)
