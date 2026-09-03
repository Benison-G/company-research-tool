import asyncio

import pytest

from app.agent import research_agent
from app.schemas.schemas import Financials, KeyPerson, NewsItem, ReportSections, RiskItem
from app.services.search_service import SearchResult
from app.services.llm_service import MockLLMService


class FakeSearchService:
    is_mock = True

    async def search(self, query, num_results=5):
        return [SearchResult(title=f"Result for {query}", snippet="snippet", url="https://example.com")]


class FakeLLMService:
    is_mock = True

    async def generate_report(self, company_name, results_by_topic):
        return ReportSections(
            overview=f"{company_name} is a fake company for testing.",
            key_people=[KeyPerson(name="Jane Doe", title="CEO")],
            news=[NewsItem(text="Something happened.", source_url="https://example.com")],
            financials=Financials(revenue="$1B", employee_count=None, market_cap=None, yoy_growth=None),
            risks=[RiskItem(text="Some risk.", source_url=None)],
        )


class FailingLLMService:
    is_mock = True

    async def generate_report(self, company_name, results_by_topic):
        raise ValueError("malformed LLM output")


async def _collect_events(company_name, search_service=None, llm_service=None):
    events = []
    async for event, data in research_agent.run_research(
        company_name, search_service=search_service, llm_service=llm_service
    ):
        events.append((event, data))
    return events


async def test_happy_path_emits_all_sections_then_complete():
    events = await _collect_events("Acme Corp", FakeSearchService(), FakeLLMService())

    event_names = [e for e, _ in events]
    assert event_names.count("section_start") == 5
    assert event_names.count("section_complete") == 5
    assert event_names[-1] == "complete"
    assert "error" not in event_names

    complete_data = events[-1][1]
    assert "report_id" in complete_data

    overview_event = next(d for e, d in events if e == "section_complete" and d["section"] == "overview")
    assert "Acme Corp" in overview_event["data"]


async def test_invalid_input_yields_error_and_nothing_else():
    events = await _collect_events("   ", FakeSearchService(), FakeLLMService())
    assert len(events) == 1
    assert events[0][0] == "error"
    assert "valid company name" in events[0][1]["message"]


async def test_malformed_llm_output_does_not_crash_and_yields_error():
    events = await _collect_events("Acme Corp", FakeSearchService(), FailingLLMService())
    event_names = [e for e, _ in events]
    assert "error" in event_names
    assert "complete" not in event_names


async def test_duplicate_concurrent_research_is_rejected():
    async def slow_search_run():
        return await _collect_events("Acme Corp", FakeSearchService(), FakeLLMService())

    first_task = asyncio.create_task(slow_search_run())
    # Give the first job a moment to register itself as active before we
    # fire the second, duplicate request.
    await asyncio.sleep(0.01)

    second_events = await _collect_events("Acme Corp", FakeSearchService(), FakeLLMService())

    first_events = await first_task

    assert any(e == "error" for e, _ in second_events)
    assert any(e == "complete" for e, _ in first_events)


async def test_missing_section_data_still_produces_valid_payloads():
    class EmptyLLMService:
        is_mock = True

        async def generate_report(self, company_name, results_by_topic):
            return ReportSections()  # everything empty/null

    events = await _collect_events("Acme Corp", FakeSearchService(), EmptyLLMService())
    financials_event = next(
        d for e, d in events if e == "section_complete" and d["section"] == "financials"
    )
    assert financials_event["data"] == {
        "revenue": None,
        "employee_count": None,
        "market_cap": None,
        "yoy_growth": None,
    }
    people_event = next(
        d for e, d in events if e == "section_complete" and d["section"] == "key_people"
    )
    assert people_event["data"] == []


async def test_mock_llm_returns_complete_sample_sections():
    report = await MockLLMService().generate_report("Microsoft", {})

    assert "" in report.overview
    assert len(report.key_people) == 2
    assert len(report.news) == 2
    assert report.financials.model_dump() == {
        "revenue": "$10.0B (sample)",
        "employee_count": "25,000 (sample)",
        "market_cap": "$100B (sample)",
        "yoy_growth": "8% (sample)",
    }
    assert len(report.risks) == 2
