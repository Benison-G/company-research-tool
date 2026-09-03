import type { ReportDetail, ReportSummary } from "../types/report";

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function handleJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body && typeof body.detail === "string") {
        message = body.detail;
      }
    } catch {
      // Response wasn't JSON (e.g. HTML error page from a proxy) -- keep the generic message.
    }
    throw new ApiError(message, response.status);
  }
  // DELETE returns 204 No Content.
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function fetchReports(signal?: AbortSignal): Promise<ReportSummary[]> {
  const response = await fetch(`${API_BASE}/api/reports`, { signal });
  return handleJsonResponse<ReportSummary[]>(response);
}

export async function fetchReport(id: number, signal?: AbortSignal): Promise<ReportDetail> {
  const response = await fetch(`${API_BASE}/api/reports/${id}`, { signal });
  return handleJsonResponse<ReportDetail>(response);
}

export async function deleteReport(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/api/reports/${id}`, { method: "DELETE" });
  await handleJsonResponse<void>(response);
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}
