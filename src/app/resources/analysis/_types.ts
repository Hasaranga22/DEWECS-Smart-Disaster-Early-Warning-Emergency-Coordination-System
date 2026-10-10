export interface AnalysisReport {
  id: string;
  filters: {
    from: string;
    to: string;
    districtId?: string;
    hazardType?: "FLOOD" | "LANDSLIDE" | "CYCLONE" | "DROUGHT" | "OTHER";
    includedSections: Array<"ALERTS" | "REACH" | "REPORTS" | "SHELTERS" | "SUPPLIES">;
    language: "EN" | "SI" | "TA";
  };
  sourceCutoff: string;
  generatedAt: string;
  generatedBy: string;
  warningFlag: boolean;
  metrics: {
    alerts: {
      total: number;
      bySeverity: Record<string, number>;
      byHazardType: Record<string, number>;
    };
    reach: {
      distinctCitizens: number;
      perChannel: {
        PUSH: { attempted: number; delivered: number; failed: number };
        SMS: { attempted: number; delivered: number; failed: number };
      };
    };
    reports: { verified: number; rejected: number; pending: number };
    shelters: {
      activated: number;
      peakOccupancy: number;
      events: Array<{
        occurredAt: string;
        shelterId: string;
        previousCount: number;
        newCount: number;
      }>;
    };
    supplies: {
      byType: Record<
        string,
        { distributed: number; total: number; percent: number | null }
      >;
    };
  };
}

export interface GenerateResponse {
  reportId: string;
  generatedAt: string;
  sourceCutoff: string;
  filters: AnalysisReport["filters"];
  metrics: AnalysisReport["metrics"];
}

export interface ShareOutcome {
  id: string;
  reportId: string;
  organizationId: string;
  organizationName: string;
  status: "SENT" | "FAILED";
  attemptedAt: string;
  failureReason?: string;
}

export const PARTNER_ORGS = [
  { id: "75700352-5645-41a3-acc7-c8184f09cf35", name: "Sample Sri Lanka Army", type: "ARMED_FORCES" },
  { id: "9c343cb9-c47a-4a05-bb4d-be2641a933b4", name: "Sample World Vision Lanka", type: "NGO" },
  { id: "656c8a22-e60d-4e32-bfb5-8c5ed132d882", name: "Sample Private Donor", type: "PRIVATE_DONOR" },
] as const;

export const ROLES = ["DMC_OFFICIAL", "DUTY_OFFICER", "DISTRICT_OFFICER", "CITIZEN"] as const;
export type Role = (typeof ROLES)[number];

export const HAZARD_TYPES = ["FLOOD", "LANDSLIDE", "CYCLONE", "DROUGHT", "OTHER"] as const;
export const SECTIONS = ["ALERTS", "REACH", "REPORTS", "SHELTERS", "SUPPLIES"] as const;
export const LANGUAGES = ["EN", "SI", "TA"] as const;

export const DISTRICTS = [
  { id: "", name: "All districts" },
  { id: "00000000-0000-4000-8000-000000000001", name: "Kegalle" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Gampaha" },
  { id: "00000000-0000-4000-8000-000000000010", name: "Colombo" },
] as const;

export const NAV_LINKS = [
  { href: "/resources/analysis", label: "Generate Report", icon: "FileBarChart" },
  { href: "/resources/analysis/history", label: "Report History", icon: "History" },
] as const;

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* non-json */
    }
    const msg = (body as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, msg, body);
  }
  return res.json() as Promise<T>;
}

export const api = {
  generateReport(input: {
    from: string;
    to: string;
    districtId?: string;
    hazardType?: string;
    includedSections: readonly string[];
    language: string;
  }): Promise<GenerateResponse> {
    return apiFetch("/api/analysis", { method: "POST", body: JSON.stringify(input) });
  },
  listReports(): Promise<AnalysisReport[]> {
    return apiFetch("/api/analysis");
  },
  getReport(id: string): Promise<AnalysisReport> {
    return apiFetch(`/api/analysis/${id}`);
  },
  shareReport(id: string, organizationIds: string[]): Promise<{ outcomes: ShareOutcome[] }> {
    return apiFetch(`/api/analysis/${id}/share`, {
      method: "POST",
      body: JSON.stringify({ organizationIds }),
    });
  },
};

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function toIsoRange(fromDate: string, toDate: string): { from: string; to: string } {
  return {
    from: new Date(`${fromDate}T00:00:00Z`).toISOString(),
    to: new Date(`${toDate}T23:59:59Z`).toISOString(),
  };
}

export function daysBetween(fromDate: string, toDate: string): number {
  const ms = new Date(toDate).getTime() - new Date(fromDate).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
