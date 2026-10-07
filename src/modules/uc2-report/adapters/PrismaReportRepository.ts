import { ReportRepository } from "./ReportRepository";
import { GroundReport } from "../domain/GroundReport";
import { DuplicateLocalIdError, VersionConflictError } from "../domain/errors";
import { prisma } from "@/shared/infra/prisma";

export class PrismaReportRepository implements ReportRepository {
  
  async save(report: GroundReport): Promise<void> {
    const snap = report.toSnapshot();
    
    try {
      await prisma.groundReport.create({
        data: {
          id: snap.id,
          localId: snap.localId,
          reporterId: snap.reporterId,
          districtId: snap.districtId,
          hazardType: snap.hazardType,
          description: snap.description,
          latitude: snap.latitude,
          longitude: snap.longitude,
          locationSource: snap.locationSource,
          gpsAccuracyM: snap.gpsAccuracyM,
          photo: snap.photo,
          confidence: snap.confidence,
          reviewStatus: snap.reviewStatus,
          severityIndication: snap.severityIndication,
          linkedToReportId: snap.linkedToReportId,
          captureTime: snap.captureTime,
          version: snap.version,
        }
      });
    } catch (error: any) {
      // Prisma P2002 error code means "Unique constraint failed"
      if (error.code === 'P2002' && error.meta?.target?.includes('local_id')) {
        throw new DuplicateLocalIdError(snap.localId);
      }
      throw error;
    }
  }

  async update(report: GroundReport, expectedVersion: number): Promise<void> {
    const snap = report.toSnapshot();

    // Use Prisma's native "updateMany" to perform atomic optimistic locking.
    // It updates the row ONLY IF the version matches exactly.
    const result = await prisma.groundReport.updateMany({
      where: {
        id: snap.id,
        version: expectedVersion, // Optimistic Lock Check!
      },
      data: {
        reviewStatus: snap.reviewStatus,
        severityIndication: snap.severityIndication,
        version: snap.version, // Increment to new version
        linkedToReportId: snap.linkedToReportId,
      }
    });

    if (result.count === 0) {
      throw new VersionConflictError(snap.id, expectedVersion, -1);
    }
  }

  async findById(id: string): Promise<GroundReport | null> {
    const record = await prisma.groundReport.findUnique({ where: { id } });
    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findAll(): Promise<GroundReport[]> {
    const records = await prisma.groundReport.findMany();
    return records.map(this.mapToDomain.bind(this));
  }

  async findByDistrict(districtId: string): Promise<GroundReport[]> {
    const records = await prisma.groundReport.findMany({ where: { districtId } });
    return records.map(this.mapToDomain.bind(this));
  }

  async findByReporter(reporterId: string): Promise<GroundReport[]> {
    const records = await prisma.groundReport.findMany({ where: { reporterId } });
    return records.map(this.mapToDomain.bind(this));
  }

  async findNearby(params: { hazardType: string; latitude: number; longitude: number; radiusMeters: number; captureTime: Date; windowMs: number; }): Promise<GroundReport[]> {
    const since = new Date(params.captureTime.getTime() - params.windowMs);
    const recent = await prisma.groundReport.findMany({
      where: { 
        captureTime: { gte: since },
        hazardType: params.hazardType as any
      }
    });
    
    return recent
      .map(this.mapToDomain.bind(this))
      .filter(report => this.getDistance(params.latitude, params.longitude, report.latitude, report.longitude) <= params.radiusMeters);
  }

  // Helper mapping function since Prisma Decimals need to become JS numbers for the Domain
  private mapToDomain(record: any): GroundReport {
    return GroundReport.create({
      ...record,
      latitude: Number(record.latitude),
      longitude: Number(record.longitude),
      gpsAccuracyM: record.gpsAccuracyM ? Number(record.gpsAccuracyM) : undefined,
    });
  }

  // Haversine formula (same as InMemory adapter)
  private getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}
