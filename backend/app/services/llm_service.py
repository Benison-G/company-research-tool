"""
LLM integration.

`ClaudeLLMService` calls the real Anthropic Messages API and forces a tool
call (`submit_report`) whose input schema mirrors `ReportSections` exactly,
so the model's response is validated JSON rather than free text we have to
hope parses correctly. This is used whenever LLM_API_KEY is configured.

`MockLLMService` is a clearly-isolated fallback used when no key is
configured. It returns a complete, clearly labeled sample `ReportSections`
object so the full report UI can be demonstrated without API keys.

Both classes implement `generate_report(company_name, context) ->
ReportSections`, so the research agent doesn't need to know which one is
in use.
"""

import abc
import json
import logging
import os

from anthropic import Anthropic

from app.schemas.schemas import Financials, KeyPerson, NewsItem, ReportSections, RiskItem
from app.services.search_service import SearchResult

logger = logging.getLogger(__name__)

MODEL_NAME = "claude-sonnet-4-5"

SYSTEM_PROMPT = (
    "You are a research analyst preparing a concise sales briefing about a company "
    "for a sales representative who is about to reach out to them. You will be given "
    "web search results about the company. Use ONLY the information in those search "
    "results plus general, well-established world knowledge about the company's "
    "identity -- do not invent facts, numbers, executives, or news that are not "
    "supported by the provided search results. "
    "If a piece of information (e.g. market cap, an executive's name, recent news) "
    "is not present in the search results, leave it null (for single fields) or "
    "omit it (for list items) rather than guessing. "
    "Call the submit_report tool exactly once with the structured report."
)

# Mirrors ReportSections exactly -- this is what makes the LLM's response
# structurally trustworthy instead of free-form text we'd have to parse.
REPORT_TOOL = {
    "name": "submit_report",
    "description": "Submit the structured five-section sales research report.",
    "input_schema": {
        "type": "object",
        "properties": {
            "overview": {
                "type": "string",
                "description": (
                    "Concise sales-oriented briefing (not a Wikipedia dump): what the "
                    "company does, its industry, core products/services, target "
                    "customers, and market positioning."
                ),
            },
            "key_people": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "title": {"type": "string"},
                    },
                    "required": ["name", "title"],
                },
            },
            "news": {
                "type": "array",
                "description": "3-4 concise, recent news bullets (acquisitions, earnings, launches, etc).",
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string"},
                        "source_url": {"type": ["string", "null"]},
                    },
                    "required": ["text"],
                },
            },
            "financials": {
                "type": "object",
                "properties": {
                    "revenue": {"type": ["string", "null"]},
                    "employee_count": {"type": ["string", "null"]},
                    "market_cap": {"type": ["string", "null"]},
                    "yoy_growth": {"type": ["string", "null"]},
                },
            },
            "risks": {
                "type": "array",
                "description": "2-3 concise risk-factor bullets, only if supported by the research.",
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string"},
                        "source_url": {"type": ["string", "null"]},
                    },
                    "required": ["text"],
                },
            },
        },
        "required": ["overview", "key_people", "news", "financials", "risks"],
    },
}


def _build_context(company_name: str, results_by_topic: dict[str, list[SearchResult]]) -> str:
    """Flatten search results into a plain-text context block for the LLM prompt."""
    lines = [f"Company being researched: {company_name}", ""]
    for topic, results in results_by_topic.items():
        lines.append(f"--- Search results for: {topic} ---")
        if not results:
            lines.append("(no results found)")
        for r in results:
            lines.append(f"* {r.title}\n  URL: {r.url}\n  Snippet: {r.snippet}")
        lines.append("")
    return "\n".join(lines)


class LLMService(abc.ABC):
    is_mock: bool = False

    @abc.abstractmethod
    async def generate_report(
        self, company_name: str, results_by_topic: dict[str, list[SearchResult]]
    ) -> ReportSections:
        ...


class ClaudeLLMService(LLMService):
    """Live structured-output generation via the Anthropic Messages API."""

    is_mock = False

    def __init__(self, api_key: str):
        self.client = Anthropic(api_key=api_key)

    async def generate_report(
        self, company_name: str, results_by_topic: dict[str, list[SearchResult]]
    ) -> ReportSections:
        context = _build_context(company_name, results_by_topic)

        message = self.client.messages.create(
            model=MODEL_NAME,
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            tools=[REPORT_TOOL],
            tool_choice={"type": "tool", "name": "submit_report"},
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Here are web search results about '{company_name}'. "
                        f"Produce the structured report.\n\n{context}"
                    ),
                }
            ],
        )

        for block in message.content:
            if block.type == "tool_use" and block.name == "submit_report":
                # Pydantic validates/coerces the shape here; malformed output
                # raises, which the caller (research agent) catches gracefully.
                return ReportSections.model_validate(block.input)

        raise ValueError("LLM did not call the submit_report tool.")


class MockLLMService(LLMService):
    """
    Deterministic offline fallback used when no LLM_API_KEY is configured.

    Returns a complete deterministic sample report. Every field is labeled as
    mock data so it cannot be mistaken for live company research.
    """

    is_mock = True

    async def generate_report(
        self, company_name: str, results_by_topic: dict[str, list[SearchResult]]
    ) -> ReportSections:
        overview = (
            f" No LLM_API_KEY configured. This sample briefing for "
            f"'{company_name}' demonstrates the report layout; configure "
            f"LLM_API_KEY in .env to enable live report generation."
        )

        news = [
            NewsItem(
                text=f" {company_name} announced a new product initiative.",
                source_url=None,
            ),
            NewsItem(
                text=f" {company_name} reported continued investment in growth.",
                source_url=None,
            ),
        ]

        risks = [
            RiskItem(
                text=" Competitive pressure may affect future growth.",
                source_url=None,
            ),
            RiskItem(
                text=" Regulatory and market changes may affect operations.",
                source_url=None,
            ),
        ]

        return ReportSections(
            overview=overview,
            key_people=[
                KeyPerson(name="Alex Morgan", title="Chief Executive Officer (sample)"),
                KeyPerson(name="Jordan Lee", title="Chief Technology Officer (sample)"),
            ],
            news=news,
            financials=Financials(
                revenue="$10.0B (sample)",
                employee_count="25,000 (sample)",
                market_cap="$100B (sample)",
                yoy_growth="8% (sample)",
            ),
            risks=risks,
        )


def get_llm_service() -> LLMService:
    """Factory: returns the live Claude service if configured, else the mock."""
    api_key = os.getenv("LLM_API_KEY")
    if api_key:
        return ClaudeLLMService(api_key=api_key)
    logger.info("LLM_API_KEY not set -- using MockLLMService.")
    return MockLLMService()
