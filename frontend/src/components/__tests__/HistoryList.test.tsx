import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HistoryList from "../HistoryList";
import type { ReportSummary } from "../../types/report";

const sampleReports: ReportSummary[] = [
  { id: 1, company_name: "Microsoft", created_at: new Date().toISOString() },
  { id: 2, company_name: "Apple", created_at: new Date().toISOString() },
];

describe("HistoryList", () => {
  it("shows a helpful empty state when there are no reports", () => {
    render(<HistoryList reports={[]} selectedId={null} onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/no past reports yet/i)).toBeInTheDocument();
  });

  it("renders each report's name", () => {
    render(
      <HistoryList reports={sampleReports} selectedId={null} onSelect={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText("Microsoft")).toBeInTheDocument();
    expect(screen.getByText("Apple")).toBeInTheDocument();
  });

  it("calls onSelect when a history item is clicked", () => {
    const onSelect = vi.fn();
    render(
      <HistoryList reports={sampleReports} selectedId={null} onSelect={onSelect} onDelete={vi.fn()} />
    );
    fireEvent.click(screen.getByText("Microsoft"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("calls onDelete without triggering onSelect when the delete button is clicked", () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    render(
      <HistoryList reports={sampleReports} selectedId={null} onSelect={onSelect} onDelete={onDelete} />
    );
    fireEvent.click(screen.getByLabelText(/delete report for microsoft/i));
    expect(onDelete).toHaveBeenCalledWith(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
