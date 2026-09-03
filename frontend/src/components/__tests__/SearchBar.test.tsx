import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SearchBar from "../SearchBar";

describe("SearchBar", () => {
  it("does not call onSearch for empty input", () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} activeCompany={null} />);
    fireEvent.click(screen.getByRole("button", { name: /research/i }));
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("does not call onSearch for whitespace-only input", () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} activeCompany={null} />);
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: "   " } });
    fireEvent.submit(screen.getByLabelText(/company name/i));
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("calls onSearch with the trimmed company name on valid submit", () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} activeCompany={null} />);
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: "  Microsoft  " } });
    fireEvent.submit(screen.getByLabelText(/company name/i));
    expect(onSearch).toHaveBeenCalledWith("Microsoft");
  });

  it("disables the button for a duplicate in-progress company", () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} activeCompany="Microsoft" />);
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: "microsoft" } });
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("still allows searching a different company while one is active", () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} activeCompany="Microsoft" />);
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: "Apple" } });
    expect(screen.getByRole("button")).not.toBeDisabled();
  });
});
