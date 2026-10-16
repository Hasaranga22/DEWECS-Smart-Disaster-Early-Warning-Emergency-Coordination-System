import { HazardType, LocationSource, ReportConfidence } from "@/shared/contracts/types";

export type OutboxStatus = "PENDING_SYNC" | "SYNCING" | "FAILED";

export interface LocalOutboxEntry {
  localId: string; // Unique ID generated on the client
  hazardType: HazardType;
  description: string;
  latitude: number;
  longitude: number;
  locationSource: LocationSource;
  gpsAccuracyM?: number;
  photoDataUrl?: string; // Compressed image as Base64 data URL
  confidence: ReportConfidence;
  status: OutboxStatus;
  captureTime: string; // ISO string
  failureReason?: string; // If FAILED
}
