import type { PrismaClient } from '@/generated/prisma/client';
import {
  AlertSeverity,
  AlertStatus,
  AttemptStatus,
  ChannelType,
  HazardType,
  NotificationKind,
} from '@/generated/prisma/enums';
import type { HazardAlert, NotificationAttempt } from '../../domain';
import type { AlertRepository } from '../AlertRepository';
import {
  type PrismaHazardAlertWithRelations,
  type PrismaNotificationAttemptRow,
  toDomainAlert,
  toDomainAttempt,
} from './mappers';

export class PrismaAlertRepository implements AlertRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async save(alert: HazardAlert): Promise<void> {
    const existing = await this.prisma.hazardAlert.findUnique({
      where: { id: alert.id },
    });

    if (!existing) {
      await this.prisma.hazardAlert.create({
        data: {
          id: alert.id,
          title: alert.title ?? null,
          hazardType: alert.hazardType as unknown as HazardType,
          severity: alert.severity as unknown as AlertSeverity,
          status: alert.status as unknown as AlertStatus,
          message: alert.message,
          issuedById: alert.issuedBy,
          occurredAt: alert.occurredAt,
          createdAt: alert.createdAt,
          expiresAt: alert.expiresAt,
          cancelledAt: alert.cancelledAt,
          cancellationReason: alert.cancellationReason,
          targetDistricts: alert.target.districtIds
            ? {
                create: alert.target.districtIds.map((districtId) => ({
                  districtId,
                })),
              }
            : undefined,
          targetBasins: alert.target.basinId
            ? {
                create: [{ basinId: alert.target.basinId }],
              }
            : undefined,
        },
      });
    } else {
      await this.prisma.hazardAlert.update({
        where: { id: alert.id },
        data: {
          title: alert.title ?? null,
          severity: alert.severity as unknown as AlertSeverity,
          status: alert.status as unknown as AlertStatus,
          cancelledAt: alert.cancelledAt,
          cancellationReason: alert.cancellationReason,
          expiresAt: alert.expiresAt,
        },
      });

      // Synchronize escalations
      for (const esc of alert.escalations) {
        await this.prisma.alertEscalation.upsert({
          where: { id: esc.id },
          create: {
            id: esc.id,
            alertId: alert.id,
            fromSeverity: esc.fromSeverity as unknown as AlertSeverity,
            toSeverity: esc.toSeverity as unknown as AlertSeverity,
            occurredAt: esc.occurredAt,
            byOfficerId: esc.byOfficerId,
            reason: esc.reason,
          },
          update: {},
        });
      }

      // If districts expanded
      if (alert.target.districtIds) {
        for (const distId of alert.target.districtIds) {
          await this.prisma.alertTargetDistrict.upsert({
            where: {
              alertId_districtId: {
                alertId: alert.id,
                districtId: distId,
              },
            },
            create: {
              alertId: alert.id,
              districtId: distId,
            },
            update: {},
          });
        }
      }
    }
  }

  public async findById(id: string): Promise<HazardAlert | null> {
    const raw = await this.prisma.hazardAlert.findUnique({
      where: { id },
      include: {
        targetDistricts: true,
        targetBasins: true,
        escalations: true,
      },
    });

    if (!raw) return null;
    return toDomainAlert(raw as unknown as PrismaHazardAlertWithRelations);
  }

  public async listAll(): Promise<HazardAlert[]> {
    const rows = await this.prisma.hazardAlert.findMany({
      include: {
        targetDistricts: true,
        targetBasins: true,
        escalations: true,
      },
      orderBy: { occurredAt: 'desc' },
    });

    return rows.map((r) => toDomainAlert(r as unknown as PrismaHazardAlertWithRelations));
  }

  public async saveAttempt(attempt: NotificationAttempt): Promise<void> {
    await this.prisma.notificationAttempt.upsert({
      where: { id: attempt.id },
      create: {
        id: attempt.id,
        alertId: attempt.alertId,
        citizenId: attempt.citizenId,
        districtId: attempt.districtId,
        hazardType: attempt.hazardType as unknown as HazardType,
        channel: attempt.channel as unknown as ChannelType,
        status: attempt.status as unknown as AttemptStatus,
        kind: attempt.kind as unknown as NotificationKind,
        occurredAt: attempt.occurredAt,
        sentAt: attempt.sentAt,
        deliveredAt: attempt.deliveredAt,
        failureReason: attempt.failureReason,
      },
      update: {
        status: attempt.status as unknown as AttemptStatus,
        sentAt: attempt.sentAt,
        deliveredAt: attempt.deliveredAt,
        failureReason: attempt.failureReason,
      },
    });
  }

  public async saveAttempts(attempts: NotificationAttempt[]): Promise<void> {
    for (const a of attempts) {
      await this.saveAttempt(a);
    }
  }

  public async findAttemptsByAlertId(alertId: string): Promise<NotificationAttempt[]> {
    const rows = await this.prisma.notificationAttempt.findMany({
      where: { alertId },
      orderBy: { occurredAt: 'asc' },
    });
    return rows.map((r) => toDomainAttempt(r as unknown as PrismaNotificationAttemptRow));
  }

  public async findAttemptById(id: string): Promise<NotificationAttempt | null> {
    const raw = await this.prisma.notificationAttempt.findUnique({
      where: { id },
    });
    if (!raw) return null;
    return toDomainAttempt(raw as unknown as PrismaNotificationAttemptRow);
  }

  public async listAllAttempts(): Promise<NotificationAttempt[]> {
    const rows = await this.prisma.notificationAttempt.findMany({
      orderBy: { occurredAt: 'desc' },
    });
    return rows.map((r) => toDomainAttempt(r as unknown as PrismaNotificationAttemptRow));
  }
}
