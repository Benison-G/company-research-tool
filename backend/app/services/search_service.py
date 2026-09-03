"""
Web search integration.

`GoogleSearchService` calls the real Google Custom Search JSON API and is
used whenever SEARCH_API_KEY and SEARCH_ENGINE_ID are configured in the
environment.

`MockSearchService` is a clearly-isolated fallback used when those keys are
absent, so the app can still be run and demoed end-to-end without live API
credentials. It never claims to be live data -- every result it returns is
labeled so the LLM (and, if you inspect the raw context, a developer) can
tell mock data from real search results.

Both classes implement the same `search(query) -> list[SearchResult]`
interface, so the rest of the app (the research agent) doesn't need to know
or care which one is in use.
"""

import abc
import logging
import os
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1"


@dataclass
class SearchResult:
    title: str
    snippet: str
    url: str


class SearchService(abc.ABC):
    is_mock: bool = False

    @abc.abstractmethod
    async def search(self, query: str, num_results: int = 5) -> list[SearchResult]:
        ...


class GoogleSearchService(SearchService):
    """Live web search via the Google Custom Search JSON API."""

    is_mock = False

    def __init__(self, api_key: str, engine_id: str):
        self.api_key = api_key
        self.engine_id = engine_id

    async def search(self, query: str, num_results: int = 5) -> list[SearchResult]:
        params = {
            "key": self.api_key,
            "cx": self.engine_id,
            "q": query,
            "num": min(max(num_results, 1), 10),
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(GOOGLE_SEARCH_URL, params=params)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPError as exc:
            logger.warning("Google search failed for query %r: %s", query, exc)
            return []

        items = data.get("items", []) or []
        results = []
        for item in items:
            results.append(
                SearchResult(
                    title=item.get("title", ""),
                    snippet=item.get("snippet", ""),
                    url=item.get("link", ""),
                )
            )
        return results


class MockSearchService(SearchService):
    """
    Deterministic offline fallback used when no search API keys are set.

    Returns plausible-looking, clearly-labeled placeholder results so the
    rest of the pipeline (context building -> LLM -> SSE streaming) can be
    exercised end-to-end without network access or API keys.
    """

    is_mock = True

    async def search(self, query: str, num_results: int = 5) -> list[SearchResult]:
        return [
            SearchResult(
                title=f"[MOCK RESULT] {query}",
                snippet=(
                    "No live SEARCH_API_KEY/SEARCH_ENGINE_ID configured, so this is "
                    "placeholder search data rather than a real result. Configure "
                    "search credentials in .env to enable live Google web search."
                ),
                url="https://example.com/mock-search-result",
            )
        ]


def get_search_service() -> SearchService:
    """Factory: returns the live Google search service if configured, else the mock."""
    api_key = os.getenv("SEARCH_API_KEY")
    engine_id = os.getenv("SEARCH_ENGINE_ID")
    if api_key and engine_id:
        return GoogleSearchService(api_key=api_key, engine_id=engine_id)
    logger.info("SEARCH_API_KEY/SEARCH_ENGINE_ID not set -- using MockSearchService.")
    return MockSearchService()
