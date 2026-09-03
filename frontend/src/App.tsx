import { useCallback, useEffect, useRef, useState } from "react";
import "./index.css";

import HistoryList from "./components/HistoryList";
import ReportView, { ViewState } from "./components/ReportView";
import SearchBar from "./components/SearchBar";
import { ApiError, deleteReport, fetchReport, fetchReports } from "./services/api";
import { streamResearch } from "./services/researchStream";
import type {
  ReportSummary,
  SectionDataMap,
  SectionName,
  SectionStatus,
} from "./types/report";
import { SECTION_ORDER, reportDetailToSectionData } from "./types/report";

function initialSectionStatus(): Record<SectionName, SectionStatus> {
  const status = {} as Record<SectionName, SectionStatus>;
  for (const section of SECTION_ORDER) status[section] = "pending";
  return status;
}

export default function App() {
  const [history, setHistory] = useState<ReportSummary[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const [viewState, setViewState] = useState<ViewState>("idle");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [sectionStatus, setSectionStatus] = useState<Record<SectionName, SectionStatus>>(
    initialSectionStatus()
  );
  const [sectionData, setSectionData] = useState<SectionDataMap>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  // The company name currently being actively streamed, used to disable
  // duplicate submissions of the same company. Cleared on complete/error.
  const [activeCompany, setActiveCompany] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  // Every research run gets a fresh id; late-arriving events from an
  // aborted/replaced run are ignored if they don't match the current id,
  // which prevents stale results from overwriting a newer search.
  const requestIdRef = useRef(0);

  const loadHistory = useCallback(async () => {
    try {
      const reports = await fetchReports();
      setHistory(reports);
    } catch {
      // History failing to load isn't fatal -- the rest of the app still works.
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Abort any in-flight SSE connection if the app unmounts.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const startResearch = useCallback(
    (name: string) => {
      // Guard against duplicate concurrent research for the same company.
      if (activeCompany && activeCompany.toLowerCase() === name.toLowerCase()) {
        return;
      }

      // Replace any previous in-flight request.
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      setCompanyName(name);
      setActiveCompany(name);
      setSelectedReportId(null);
      setSectionStatus(initialSectionStatus());
      setSectionData({});
      setErrorMessage(null);
      setCreatedAt(null);
      setViewState("streaming");

      streamResearch(
        name,
        (evt) => {
          if (requestId !== requestIdRef.current) return; // stale/replaced request

          if (evt.event === "section_start") {
            const section = evt.data.section as SectionName;
            setSectionStatus((prev) => ({ ...prev, [section]: "streaming" }));
          } else if (evt.event === "section_complete") {
            const section = evt.data.section as SectionName;
            setSectionStatus((prev) => ({ ...prev, [section]: "done" }));
            setSectionData((prev) => ({ ...prev, [section]: evt.data.data }));
          } else if (evt.event === "complete") {
            setViewState("complete");
            setActiveCompany(null);
            setCreatedAt(new Date().toISOString());
            setSelectedReportId(evt.data.report_id);
            loadHistory();
          } else if (evt.event === "error") {
            setViewState("error");
            setActiveCompany(null);
            setErrorMessage(evt.data.message);
          }
        },
        controller.signal
      );
    },
    [activeCompany, loadHistory]
  );

  const handleSelectHistory = useCallback(async (id: number) => {
    abortControllerRef.current?.abort();
    requestIdRef.current += 1; // invalidate any in-flight stream

    setSelectedReportId(id);
    setErrorMessage(null);

    try {
      const detail = await fetchReport(id);
      setCompanyName(detail.company_name);
      setCreatedAt(detail.created_at);
      setSectionData(reportDetailToSectionData(detail));
      const doneStatus = {} as Record<SectionName, SectionStatus>;
      for (const section of SECTION_ORDER) doneStatus[section] = "done";
      setSectionStatus(doneStatus);
      setViewState("complete");
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 404
          ? "That report no longer exists."
          : "Could not load that report. Please try again.";
      setViewState("error");
      setErrorMessage(message);
    }
  }, []);

  const handleDeleteHistory = useCallback(
    async (id: number) => {
      try {
        await deleteReport(id);
      } catch {
        // Even if the delete call fails we still refresh history below so
        // the UI reflects the server's real state.
      }
      setHistory((prev) => prev.filter((r) => r.id !== id));
      if (selectedReportId === id) {
        setSelectedReportId(null);
        setCompanyName(null);
        setViewState("idle");
        setErrorMessage(null);
      }
    },
    [selectedReportId]
  );

  const handleRetry = useCallback(() => {
    if (companyName) {
      startResearch(companyName);
    }
  }, [companyName, startResearch]);

  const handleDismissError = useCallback(() => {
    setViewState("idle");
    setErrorMessage(null);
  }, []);

  return (
    <div className="app">
      <div className="app-header">
        <h1>Company Research Tool</h1>
        <p>Search a company to generate a streaming, structured sales research briefing.</p>
      </div>

      <SearchBar onSearch={startResearch} activeCompany={activeCompany} />
      <div className="search-hint">Tip: press ⌘K / Ctrl+K to jump to search.</div>

      <div className="layout">
        <HistoryList
          reports={historyLoaded ? history : []}
          selectedId={selectedReportId}
          onSelect={handleSelectHistory}
          onDelete={handleDeleteHistory}
        />
        <ReportView
          companyName={companyName}
          viewState={viewState}
          sectionStatus={sectionStatus}
          sectionData={sectionData}
          errorMessage={errorMessage}
          createdAt={createdAt}
          onRetry={handleRetry}
          onDismissError={handleDismissError}
        />
      </div>
    </div>
  );
}
