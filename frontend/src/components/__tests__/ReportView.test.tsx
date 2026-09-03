import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReportView from "../ReportView";
import { SECTION_ORDER } from "../../types/report";
import type { SectionDataMap, SectionName, SectionStatus } from "../../types/report";

function allStatus(value: SectionStatus): Record<SectionName, SectionStatus> {
  const status = {} as Record<SectionName, SectionStatus>;
  for (const s of SECTION_ORDER) status[s] = value;
  return status;
}

describe("ReportView", () => {
  it("shows the empty hint in idle state", () => {
    render(
      <ReportView
        companyName={null}
        viewState="idle"
        sectionStatus={allStatus("pending")}
        sectionData={{}}
        errorMessage={null}
        createdAt={null}
        onRetry={vi.fn()}
        onDismissError={vi.fn()}
      />
    );
    expect(screen.getByText(/enter a company name above/i)).toBeInTheDocument();
  });

  it("shows progress icons and does not render a blank section while pending", () => {
    const status = allStatus("pending");
    status.overview = "streaming";
    render(
      <ReportView
        companyName="Microsoft"
        viewState="streaming"
        sectionStatus={status}
        sectionData={{}}
        errorMessage={null}
        createdAt={null}
        onRetry={vi.fn()}
        onDismissError={vi.fn()}
      />
    );
    expect(screen.getByText(/researching microsoft/i)).toBeInTheDocument();
    expect(screen.getByText("Company Overview")).toBeInTheDocument();
    // Key People hasn't started yet -> no section heading rendered for it.
    expect(screen.queryByText("Key People")).not.toBeInTheDocument();
  });

  it("renders a completed report with all five sections", () => {
    const data: SectionDataMap = {
      overview: "Acme makes gadgets.",
      key_people: [{ name: "Jane Doe", title: "CEO" }],
      news: [{ text: "Launched a product.", source_url: "https://example.com" }],
      financials: { revenue: "$1B", employee_count: null, market_cap: null, yoy_growth: "12%" },
      risks: [{ text: "Faces competition.", source_url: null }],
    };
    render(
      <ReportView
        companyName="Acme"
        viewState="complete"
        sectionStatus={allStatus("done")}
        sectionData={data}
        errorMessage={null}
        createdAt={new Date().toISOString()}
        onRetry={vi.fn()}
        onDismissError={vi.fn()}
      />
    );
    expect(screen.getByText("Acme makes gadgets.")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(/launched a product/i)).toBeInTheDocument();
    expect(screen.getByText("$1B")).toBeInTheDocument();
    // Missing financial fields should show the friendly placeholder, not blank/null.
    expect(screen.getAllByText("Not publicly available").length).toBeGreaterThan(0);
    expect(screen.getByText(/faces competition/i)).toBeInTheDocument();
  });

  it("shows friendly placeholders for missing key people and news", () => {
    const data: SectionDataMap = {
      overview: "Acme makes gadgets.",
      key_people: [],
      news: [],
      financials: { revenue: null, employee_count: null, market_cap: null, yoy_growth: null },
      risks: [],
    };
    render(
      <ReportView
        companyName="Acme"
        viewState="complete"
        sectionStatus={allStatus("done")}
        sectionData={data}
        errorMessage={null}
        createdAt={new Date().toISOString()}
        onRetry={vi.fn()}
        onDismissError={vi.fn()}
      />
    );
    expect(screen.getByText(/no reliable information found/i)).toBeInTheDocument();
    expect(screen.getByText(/no significant recent news found/i)).toBeInTheDocument();
  });

  it("shows the error banner with a retry button in error state", () => {
    const onRetry = vi.fn();
    render(
      <ReportView
        companyName="Microsoft"
        viewState="error"
        sectionStatus={allStatus("pending")}
        sectionData={{}}
        errorMessage="Unable to research this company right now."
        createdAt={null}
        onRetry={onRetry}
        onDismissError={vi.fn()}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/unable to research/i);
    screen.getByRole("button", { name: /retry/i }).click();
    expect(onRetry).toHaveBeenCalled();
  });
});
