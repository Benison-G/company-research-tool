import type {
  Financials,
  KeyPerson,
  NewsItem,
  RiskItem,
  SectionDataMap,
  SectionName,
  SectionStatus,
} from "../types/report";
import { SECTION_LABELS, SECTION_ORDER } from "../types/report";

export type ViewState = "idle" | "streaming" | "complete" | "error";

interface Props {
  companyName: string | null;
  viewState: ViewState;
  sectionStatus: Record<SectionName, SectionStatus>;
  sectionData: SectionDataMap;
  errorMessage: string | null;
  createdAt: string | null;
  onRetry: () => void;
  onDismissError: () => void;
}

function statusIcon(status: SectionStatus): string {
  if (status === "done") return "✓";
  if (status === "streaming") return "⏳";
  return "○";
}

function Overview({ text }: { text?: string }) {
  if (!text) {
    return <p className="section-placeholder">No overview available.</p>;
  }
  return <p>{text}</p>;
}

function KeyPeople({ people }: { people?: KeyPerson[] }) {
  if (!people || people.length === 0) {
    return <p className="section-placeholder">No reliable information found.</p>;
  }
  return (
    <div className="people-grid">
      {people.map((p, i) => (
        <div className="person-card" key={i}>
          <div className="name">{p.name}</div>
          <div className="title">{p.title}</div>
        </div>
      ))}
    </div>
  );
}

function News({ items }: { items?: NewsItem[] }) {
  if (!items || items.length === 0) {
    return <p className="section-placeholder">No significant recent news found.</p>;
  }
  return (
    <ul>
      {items.map((item, i) => (
        <li key={i}>
          {item.text}
          {item.source_url && (
            <a className="source-link" href={item.source_url} target="_blank" rel="noreferrer">
              source
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

const FINANCIAL_LABELS: Record<keyof Financials, string> = {
  revenue: "Revenue",
  employee_count: "Employees",
  market_cap: "Market Cap",
  yoy_growth: "YoY Growth",
};

function FinancialHighlights({ financials }: { financials?: Financials }) {
  const f = financials ?? { revenue: null, employee_count: null, market_cap: null, yoy_growth: null };
  return (
    <div className="financials-grid">
      {(Object.keys(FINANCIAL_LABELS) as (keyof Financials)[]).map((key) => (
        <div className="financial-stat" key={key}>
          <div className="label">{FINANCIAL_LABELS[key]}</div>
          <div className="value">{f[key] ?? "Not publicly available"}</div>
        </div>
      ))}
    </div>
  );
}

function Risks({ items }: { items?: RiskItem[] }) {
  if (!items || items.length === 0) {
    return <p className="section-placeholder">No significant risk factors found.</p>;
  }
  return (
    <ul>
      {items.map((item, i) => (
        <li key={i}>
          {item.text}
          {item.source_url && (
            <a className="source-link" href={item.source_url} target="_blank" rel="noreferrer">
              source
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function SectionBody({ section, status, data }: { section: SectionName; status: SectionStatus; data: SectionDataMap }) {
  if (status === "pending") {
    return <p className="section-placeholder">Waiting…</p>;
  }
  if (status === "streaming") {
    return <p className="section-placeholder">Researching…</p>;
  }
  switch (section) {
    case "overview":
      return <Overview text={data.overview} />;
    case "key_people":
      return <KeyPeople people={data.key_people} />;
    case "news":
      return <News items={data.news} />;
    case "financials":
      return <FinancialHighlights financials={data.financials} />;
    case "risks":
      return <Risks items={data.risks} />;
  }
}

export default function ReportView({
  companyName,
  viewState,
  sectionStatus,
  sectionData,
  errorMessage,
  createdAt,
  onRetry,
  onDismissError,
}: Props) {
  if (viewState === "idle") {
    return (
      <div className="panel report-panel">
        <p className="empty-hint">
          Enter a company name above to generate your first research briefing.
        </p>
      </div>
    );
  }

  return (
    <div className="panel report-panel">
      {viewState === "error" && errorMessage && (
        <div className="error-banner" role="alert">
          <span>{errorMessage}</span>
          <button onClick={onRetry}>Retry</button>
        </div>
      )}

      {companyName && (
        <div className="report-header">
          <h2>{companyName}</h2>
          {viewState === "streaming" && (
            <span className="report-status streaming">Researching {companyName}…</span>
          )}
          {viewState === "complete" && createdAt && (
            <span className="report-status">Generated {new Date(createdAt).toLocaleString()}</span>
          )}
        </div>
      )}

      {viewState === "streaming" && (
        <div className="section-progress">
          {SECTION_ORDER.map((section) => (
            <div key={section} className={`section-progress-item ${sectionStatus[section]}`}>
              <span className="section-progress-icon">{statusIcon(sectionStatus[section])}</span>
              <span>{SECTION_LABELS[section]}</span>
            </div>
          ))}
        </div>
      )}

      {(viewState === "streaming" || viewState === "complete") &&
        SECTION_ORDER.map((section) => {
          // Don't render a section box at all until it has at least started,
          // so we never show a blank report while waiting.
          if (viewState === "streaming" && sectionStatus[section] === "pending") {
            return null;
          }
          return (
            <div className="section" key={section}>
              <h3>{SECTION_LABELS[section]}</h3>
              <SectionBody section={section} status={sectionStatus[section]} data={sectionData} />
            </div>
          );
        })}
    </div>
  );
}
