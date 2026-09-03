import { FormEvent, useEffect, useRef, useState } from "react";

interface Props {
  onSearch: (companyName: string) => void;
  /** The company name currently being researched, if any (disables duplicate submission). */
  activeCompany: string | null;
}

export default function SearchBar({ onSearch, activeCompany }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Nice-to-have: Cmd/Ctrl+K focuses the search input.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const trimmed = value.trim();
  const isDuplicate =
    !!activeCompany && trimmed.toLowerCase() === activeCompany.toLowerCase();
  const isBusy = !!activeCompany;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed || isDuplicate) return;
    onSearch(trimmed);
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search company (e.g. Microsoft)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Company name"
      />
      <button type="submit" disabled={!trimmed || isDuplicate}>
        {isBusy && !isDuplicate ? "Research" : isDuplicate ? "Researching…" : "Research"}
      </button>
    </form>
  );
}
