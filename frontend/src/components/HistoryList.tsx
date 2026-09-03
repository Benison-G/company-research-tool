import type { ReportSummary } from "../types/report";

function timeAgo(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface Props {
  reports: ReportSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function HistoryList({ reports, selectedId, onSelect, onDelete }: Props) {
  if (reports.length === 0) {
    return (
      <div className="panel">
        <h2>History</h2>
        <p className="empty-hint">No past reports yet. Your researched companies will show up here.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>History</h2>
      <ul className="history-list">
        {reports.map((report) => (
          <li
            key={report.id}
            className={`history-item${report.id === selectedId ? " active" : ""}`}
            onClick={() => onSelect(report.id)}
          >
            <div className="history-item-main">
              <div className="history-item-name">{report.company_name}</div>
              <div className="history-item-time">{timeAgo(report.created_at)}</div>
            </div>
            <button
              className="history-item-delete"
              aria-label={`Delete report for ${report.company_name}`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(report.id);
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
