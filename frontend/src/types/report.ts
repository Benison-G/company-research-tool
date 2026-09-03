export interface KeyPerson {
  name: string;
  title: string;
}

export interface NewsItem {
  text: string;
  source_url: string | null;
}

export interface RiskItem {
  text: string;
  source_url: string | null;
}

export interface Financials {
  revenue: string | null;
  employee_count: string | null;
  market_cap: string | null;
  yoy_growth: string | null;
}

export const SECTION_ORDER = [
  "overview",
  "key_people",
  "news",
  "financials",
  "risks",
] as const;

export type SectionName = (typeof SECTION_ORDER)[number];

export const SECTION_LABELS: Record<SectionName, string> = {
  overview: "Company Overview",
  key_people: "Key People",
  news: "Recent News",
  financials: "Financial Highlights",
  risks: "Risk Factors",
};

/** Section data as it arrives, keyed by section name. Undefined = not yet started. */
export type SectionDataMap = {
  overview?: string;
  key_people?: KeyPerson[];
  news?: NewsItem[];
  financials?: Financials;
  risks?: RiskItem[];
};

export type SectionStatus = "pending" | "streaming" | "done";

export interface ReportSummary {
  id: number;
  company_name: string;
  created_at: string;
}

export interface ReportDetail {
  id: number;
  company_name: string;
  created_at: string;
  overview: string;
  key_people: KeyPerson[];
  news: NewsItem[];
  financials: Financials;
  risks: RiskItem[];
}

export function reportDetailToSectionData(report: ReportDetail): SectionDataMap {
  return {
    overview: report.overview,
    key_people: report.key_people,
    news: report.news,
    financials: report.financials,
    risks: report.risks,
  };
}
