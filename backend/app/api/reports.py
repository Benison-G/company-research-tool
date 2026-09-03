from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.schemas import ReportDetail, ReportSummary
from app.services import report_service

router = APIRouter()


@router.get("/api/reports", response_model=list[ReportSummary])
def list_reports(db: Session = Depends(get_db)) -> list[ReportSummary]:
    reports = report_service.list_reports(db)
    return [ReportSummary.model_validate(r) for r in reports]


@router.get("/api/reports/{report_id}", response_model=ReportDetail)
def get_report(report_id: int, db: Session = Depends(get_db)) -> ReportDetail:
    report = report_service.get_report(db, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found.")
    return ReportDetail.model_validate(report_service.report_to_detail_dict(report))


@router.delete("/api/reports/{report_id}", status_code=204)
def delete_report(report_id: int, db: Session = Depends(get_db)) -> None:
    deleted = report_service.delete_report(db, report_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Report not found.")
