// Shared types + presentation constants for the officer dashboard and map.
// Suggested location: src/modules/uc2-report/client/reportUi.ts

export interface OfficerReport {
  id: string;
  version: number;
  hazardType: string;
  reviewStatus: "PENDING_REVIEW" | "VERIFIED" | "REJECTED";
  severityIndication?: "LOW" | "MEDIUM" | "HIGH" | null;
  confidence: "FULL" | "REDUCED";
  description: string;
  latitude: number;
  longitude: number;
  photo?: string | null;
  captureTime: string;
}

// Static class strings so Tailwind never purges them.
export const HAZARD_META: Record<string, { label: string; icon: string; color: string; tint: string }> = {
  FLOOD: { label: "Flood", icon: "🌊", color: "#0ea5e9", tint: "bg-sky-50" },
  LANDSLIDE: { label: "Landslide", icon: "⛰️", color: "#f59e0b", tint: "bg-amber-50" },
  CYCLONE: { label: "Cyclone", icon: "🌀", color: "#14b8a6", tint: "bg-teal-50" },
  DROUGHT: { label: "Drought", icon: "☀️", color: "#f97316", tint: "bg-orange-50" },
  OTHER: { label: "Other", icon: "⚠️", color: "#64748b", tint: "bg-slate-100" },
};
export const HAZARD_KEYS = Object.keys(HAZARD_META);
export const hazardMeta = (t: string) => HAZARD_META[t] ?? HAZARD_META.OTHER;

export const STATUS_META = {
  PENDING_REVIEW: { label: "Pending", chip: "bg-amber-50 text-amber-700", color: "#f59e0b" },
  VERIFIED: { label: "Verified", chip: "bg-emerald-50 text-emerald-700", color: "#10b981" },
  REJECTED: { label: "Rejected", chip: "bg-red-50 text-red-700", color: "#ef4444" },
} as const;

export const SEVERITY_META = {
  LOW: { label: "Low", chip: "bg-sky-50 text-sky-700", pick: "border-sky-500 bg-sky-50 text-sky-800", color: "#0ea5e9" },
  MEDIUM: { label: "Medium", chip: "bg-amber-50 text-amber-700", pick: "border-amber-500 bg-amber-50 text-amber-800", color: "#f59e0b" },
  HIGH: { label: "High", chip: "bg-red-50 text-red-700", pick: "border-red-500 bg-red-50 text-red-800", color: "#ef4444" },
} as const;

export const parsePhotos = (photo?: string | null): string[] => {
  if (!photo) return [];
  try {
    const p = JSON.parse(photo);
    return Array.isArray(p) ? p : [photo];
  } catch {
    return [photo];
  }
};

export const timeAgo = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString();
};
