import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getUc1Module } from '@/modules/uc1-warning/container';
import { AlertDetailClient } from './AlertDetailClient';

interface AlertPageProps {
  params: Promise<{ id: string }>;
}

async function AlertLoader({ params }: AlertPageProps) {
  const { id } = await params;
  const uc1 = getUc1Module();
  const alert = await uc1.alertRepo.findById(id);

  if (!alert) {
    notFound();
  }

  const attempts = await uc1.alertRepo.findAttemptsByAlertId(id);

  const smsAttempts = attempts.filter((a) => a.channel === 'SMS');
  const pushAttempts = attempts.filter((a) => a.channel === 'PUSH');

  const alertData = {
    id: alert.id,
    title: alert.title ?? null,
    hazardType: alert.hazardType,
    severity: alert.severity,
    status: alert.status,
    message: alert.message,
    target: alert.target,
    issuedBy: alert.issuedBy,
    occurredAt: alert.occurredAt.toISOString(),
    expiresAt: alert.expiresAt?.toISOString() ?? null,
    cancelledAt: alert.cancelledAt?.toISOString() ?? null,
    cancellationReason: alert.cancellationReason,
    escalations: alert.escalations.map((e) => ({
      id: e.id,
      fromSeverity: e.fromSeverity,
      toSeverity: e.toSeverity,
      occurredAt: e.occurredAt.toISOString(),
      reason: e.reason,
    })),
  };

  const channelSummary = {
    sms: {
      sent: smsAttempts.length,
      delivered: smsAttempts.filter((a) => a.status === 'DELIVERED').length,
      failed: smsAttempts.filter((a) => a.status === 'FAILED').length,
    },
    push: {
      sent: pushAttempts.length,
      delivered: pushAttempts.filter((a) => a.status === 'DELIVERED').length,
      failed: pushAttempts.filter((a) => a.status === 'FAILED').length,
    },
  };

  return <AlertDetailClient alert={alertData} channelSummary={channelSummary} />;
}

export default function AlertDetailPage({ params }: AlertPageProps) {
  return (
    <div className="min-h-screen bg-slate-100 w-full">
      <Suspense
        fallback={
          <div className="mx-auto max-w-md py-12 text-center text-sm font-medium text-slate-700 animate-pulse">
            Loading Citizen Alert Bulletin...
          </div>
        }
      >
        <AlertLoader params={params} />
      </Suspense>
    </div>
  );
}
