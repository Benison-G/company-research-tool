from app.schemas.schemas import Financials, KeyPerson, NewsItem, ReportSections, RiskItem
from app.services import report_service


def _make_sample_sections() -> ReportSections:
    return ReportSections(
        overview="Acme Corp makes gadgets for enterprises.",
        key_people=[KeyPerson(name="Jane Doe", title="CEO")],
        news=[NewsItem(text="Acme launched a new product.", source_url="https://example.com/news")],
        financials=Financials(revenue="$1B", employee_count="5000", market_cap=None, yoy_growth="12%"),
        risks=[RiskItem(text="Facing new competition.", source_url=None)],
    )


def test_list_reports_empty(client):
    response = client.get("/api/reports")
    assert response.status_code == 200
    assert response.json() == []


def test_create_list_get_delete_report(client, db_session):
    report = report_service.create_report(db_session, "Acme Corp", _make_sample_sections())

    # List should include it, newest first.
    list_response = client.get("/api/reports")
    assert list_response.status_code == 200
    body = list_response.json()
    assert any(item["id"] == report.id and item["company_name"] == "Acme Corp" for item in body)

    # Get should return the full report.
    detail_response = client.get(f"/api/reports/{report.id}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["overview"] == "Acme Corp makes gadgets for enterprises."
    assert detail["key_people"] == [{"name": "Jane Doe", "title": "CEO"}]
    assert detail["financials"]["market_cap"] is None

    # Delete should remove it.
    delete_response = client.delete(f"/api/reports/{report.id}")
    assert delete_response.status_code == 204

    missing_response = client.get(f"/api/reports/{report.id}")
    assert missing_response.status_code == 404


def test_get_nonexistent_report_returns_404(client):
    response = client.get("/api/reports/999999")
    assert response.status_code == 404


def test_delete_nonexistent_report_returns_404(client):
    response = client.delete("/api/reports/999999")
    assert response.status_code == 404
