import { API_BASE } from "./api";

export type ResearchSSEEvent =
  | { event: "section_start"; data: { section: string } }
  | { event: "section_complete"; data: { section: string; data: unknown } }
  | { event: "complete"; data: { report_id: number } }
  | { event: "error"; data: { message: string } };

/**
 * Parse one SSE frame (the text between two blank lines) into an event
 * name + JSON payload. Returns null if the frame has no event/data (e.g.
 * a stray keep-alive comment).
 */
function parseFrame(frame: string): { event: string; data: unknown } | null {
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  if (dataLines.length === 0) return null;

  const raw = dataLines.join("\n");
  try {
    return { event: eventName, data: JSON.parse(raw) };
  } catch {
    // Malformed SSE payload from the server -- surface it as a generic error
    // event rather than crashing the stream reader.
    return { event: "error", data: { message: "Received an invalid response from the server." } };
  }
}

/**
 * POST to /api/research and stream back SSE events.
 *
 * fetch's streaming body reader is used instead of EventSource because
 * EventSource only supports GET requests, and this endpoint needs a POST
 * body (the company name).
 *
 * Pass an AbortSignal (from an AbortController) to cancel/cleanup the
 * connection -- e.g. on component unmount, or when a newer search replaces
 * this one.
 */
export async function streamResearch(
  companyName: string,
  onEvent: (event: ResearchSSEEvent) => void,
  signal: AbortSignal
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_name: companyName }),
      signal,
    });
  } catch (err) {
    if (signal.aborted) return; // Intentional cancellation, not an error to surface.
    onEvent({
      event: "error",
      data: { message: "Could not reach the server. Please check your connection and try again." },
    });
    return;
  }

  if (!response.ok || !response.body) {
    onEvent({
      event: "error",
      data: { message: "Unable to research this company right now. Please try again." },
    });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line.
      let separatorIndex: number;
      while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        const parsed = parseFrame(frame);
        if (parsed) {
          onEvent(parsed as ResearchSSEEvent);
        }
      }
    }
  } catch (err) {
    if (signal.aborted) return; // Cancelled deliberately -- not an error.
    onEvent({
      event: "error",
      data: { message: "Connection to the server was lost. Please try again." },
    });
  } finally {
    reader.releaseLock();
  }
}
