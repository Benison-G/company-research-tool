import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import type { ResearchSSEEvent } from "../services/researchStream";

const { fetchReportsMock, fetchReportMock, deleteReportMock, streamResearchMock } = vi.hoisted(() => ({
  fetchReportsMock: vi.fn(),
  fetchReportMock: vi.fn(),
  deleteReportMock: vi.fn(),
  streamResearchMock: vi.fn(),
}));

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return {
    ...actual,
    fetchReports: fetchReportsMock,
    fetchReport: fetchReportMock,
    deleteReport: deleteReportMock,
  };
});

vi.mock("../services/researchStream", () => ({
  streamResearch: streamResearchMock,
}));

async function emit(events: ResearchSSEEvent[]) {
  const [, onEvent] = streamResearchMock.mock.calls[streamResearchMock.mock.calls.length - 1];
  await act(async () => {
    for (const evt of events) {
      onEvent(evt);
    }
  });
}

beforeEach(() => {
  fetchReportsMock.mockReset().mockResolvedValue([]);
  fetchReportMock.mockReset();
  deleteReportMock.mockReset().mockResolvedValue(undefined);
  streamResearchMock.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("App", () => {
  it("shows empty states for both the report panel and history when there is no data", async () => {
    render(<App />);
    expect(screen.getByText(/enter a company name above/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no past reports yet/i)).toBeInTheDocument());
  });

  it("streams sections progressively and renders the completed report", async () => {
    render(<App />);
    await waitFor(() => expect(fetchReportsMock).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: "Acme" } });
    fireEvent.submit(screen.getByLabelText(/company name/i));

    await waitFor(() => expect(streamResearchMock).toHaveBeenCalled());
    expect(screen.getByText(/researching acme/i)).toBeInTheDocument();

    await emit([{ event: "section_start", data: { section: "overview" } }]);
    expect(screen.getByText("Company Overview")).toBeInTheDocument();
    expect(screen.getByText(/researching…/i)).toBeInTheDocument();

    await emit([
      { event: "section_complete", data: { section: "overview", data: "Acme makes gadgets." } },
      { event: "section_start", data: { section: "key_people" } },
      { event: "section_complete", data: { section: "key_people", data: [{ name: "Jane Doe", title: "CEO" }] } },
      { event: "section_start", data: { section: "news" } },
      { event: "section_complete", data: { section: "news", data: [] } },
      { event: "section_start", data: { section: "financials" } },
      {
        event: "section_complete",
        data: {
          section: "financials",
          data: { revenue: null, employee_count: null, market_cap: null, yoy_growth: null },
        },
      },
      { event: "section_start", data: { section: "risks" } },
      { event: "section_complete", data: { section: "risks", data: [] } },
      { event: "complete", data: { report_id: 42 } },
    ]);

    expect(screen.getByText("Acme makes gadgets.")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(/no significant recent news found/i)).toBeInTheDocument();
    expect(screen.getAllByText("Not publicly available").length).toBeGreaterThan(0);
  });

  it("shows a friendly error banner when the backend reports an error", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: "Acme" } });
    fireEvent.submit(screen.getByLabelText(/company name/i));

    await waitFor(() => expect(streamResearchMock).toHaveBeenCalled());
    await emit([{ event: "error", data: { message: "Unable to research this company right now." } }]);

    expect(screen.getByRole("alert")).toHaveTextContent(/unable to research this company/i);
  });

  it("does not start a search for whitespace-only input", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: "   " } });
    fireEvent.submit(screen.getByLabelText(/company name/i));
    expect(streamResearchMock).not.toHaveBeenCalled();
  });

  it("loads and displays a past report when a history item is clicked", async () => {
    fetchReportsMock.mockResolvedValue([
      { id: 7, company_name: "Tesla", created_at: new Date().toISOString() },
    ]);
    fetchReportMock.mockResolvedValue({
      id: 7,
      company_name: "Tesla",
      created_at: new Date().toISOString(),
      overview: "Tesla makes electric vehicles.",
      key_people: [],
      news: [],
      financials: { revenue: null, employee_count: null, market_cap: null, yoy_growth: null },
      risks: [],
    });

    render(<App />);
    await waitFor(() => expect(screen.getByText("Tesla")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Tesla"));

    await waitFor(() => expect(screen.getByText("Tesla makes electric vehicles.")).toBeInTheDocument());
  });

  it("removes a report from history after deleting it", async () => {
    fetchReportsMock.mockResolvedValue([
      { id: 7, company_name: "Tesla", created_at: new Date().toISOString() },
    ]);

    render(<App />);
    await waitFor(() => expect(screen.getByText("Tesla")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/delete report for tesla/i));

    await waitFor(() => expect(screen.queryByText("Tesla")).not.toBeInTheDocument());
    expect(deleteReportMock).toHaveBeenCalledWith(7);
  });
});
