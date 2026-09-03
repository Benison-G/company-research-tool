"""
CRUD helpers for saved reports.

Thin wrappers around SQLAlchemy so `app/api/reports.py` and the research
agent don't need to know about JSON (de)serialization details.
"""

import json

from sqlalchemy.orm import Session

from app.models.report import Report
from app.schemas.schemas import ReportSections


def create_report(db: Session, company_name: str, sections: ReportSections) -> Report:
    report = Report(
        company_name=company_name,
        overview=sections.overview,
        key_people=json.dumps([p.model_dump() for p in sections.key_people]),
        news=json.dumps([n.model_dump() for n in sections.news]),
        financials=json.dumps(sections.financials.model_dump()),
        risks=json.dumps([r.model_dump() for r in sections.risks]),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def list_reports(db: Session) -> list[Report]:
    return db.query(Report).order_by(Report.created_at.desc()).all()


def get_report(db: Session, report_id: int) -> Report | None:
    return db.query(Report).filter(Report.id == report_id).first()


def delete_report(db: Session, report_id: int) -> bool:
    report = get_report(db, report_id)
    if report is None:
        return False
    db.delete(report)
    db.commit()
    return True


def report_to_detail_dict(report: Report) -> dict:
    """Deserialize a Report ORM row into the shape ReportDetail expects."""
    return {
        "id": report.id,
        "company_name": report.company_name,
        "created_at": report.created_at,
        "overview": report.overview,
        "key_people": json.loads(report.key_people),
        "news": json.loads(report.news),
        "financials": json.loads(report.financials),
        "risks": json.loads(report.risks),
    }
