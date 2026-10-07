import { GroundReport, GroundReportProps } from "../domain/GroundReport";
import { DuplicateLocalIdError, VersionConflictError } from "../domain/errors";
import { ReportRepository } from "./ReportRepository";

/**
 * In-memory implementation of ReportRepository.
 *
 * Used in:
 *   - All unit tests (DATA_STORE=memory)
 *   - The dev server when DATABASE_URL is not configured
 *
 * Stored on globalThis to survive HMR reloads in Next.js dev mode.
 * Data resets on cold restart — this is intentional for the memory store.
 */

const g = globalThis as unknown as { __uc2Reports?: Map<string, GroundReportProps> };

function getStore(): Map<string, GroundReportProps> {
  if (!g.__uc2Reports) {
    g.__uc2Reports = new Map();
  }
  return g.__uc2Reports;
}

export class InMemoryReportRepository implements ReportRepository {
  private get store(): Map<string, GroundReportProps> {
    return getStore();
  }

  async save(report: GroundReport): Promise<void> {
    const snapshot = report.toSnapshot();

    // Enforce unique localId constraint (mirrors the DB @unique rule)
    const existing = [...this.store.values()].find(
      (r) => r.localId === snapshot.localId
    );
    if (existing) {
      throw new DuplicateLocalIdError(snapshot.localId);
    }

    this.store.set(snapshot.id, { ...snapshot });
  }

  async findById(id: string): Promise<GroundReport | null> {
    const props = this.store.get(id);
    return props ? GroundReport.create({ ...props }) : null;
  }

  async update(report: GroundReport, expectedVersion: number): Promise<void> {
    const snapshot = report.toSnapshot();
    const stored = this.store.get(snapshot.id);

    if (!stored) {
      throw new Error(`Report "${snapshot.id}" not found.`);
    }

    // Optimistic locking check
    if (stored.version !== expectedVersion) {
      throw new VersionConflictError(snapshot.id, expectedVersion, stored.version);
    }

    this.store.set(snapshot.id, { ...snapshot });
  }

  async findAll(): Promise<GroundReport[]> {
    return [...this.store.values()].map((p) => GroundReport.create({ ...p }));
  }

  async findByReporter(reporterId: string): Promise<GroundReport[]> {
    return [...this.store.values()]
      .filter((p) => p.reporterId === reporterId)
      .map((p) => GroundReport.create({ ...p }));
  }

  async findByDistrict(districtId: string): Promise<GroundReport[]> {
    return [...this.store.values()]
      .filter((p) => p.districtId === districtId)
      .map((p) => GroundReport.create({ ...p }));
  }

  async findNearby(params: {
    hazardType: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    captureTime: Date;
    windowMs: number;
  }): Promise<GroundReport[]> {
    const { hazardType, latitude, longitude, radiusMeters, captureTime, windowMs } = params;

    return [...this.store.values()]
      .filter((p) => {
        if (p.hazardType !== hazardType) return false;

        const timeDiff = Math.abs(
          p.captureTime.getTime() - captureTime.getTime()
        );
        if (timeDiff > windowMs) return false;

        const distanceM = haversineDistanceMeters(
          latitude,
          longitude,
          p.latitude,
          p.longitude
        );
        return distanceM <= radiusMeters;
      })
      .map((p) => GroundReport.create({ ...p }));
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Haversine formula – great-circle distance in metres. */
function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
