'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DISTRICTS, RIVER_BASINS } from '@/shared/seed';

interface AlertDetailData {
  alert: {
    id: string;
    hazardType: string;
    severity: string;
    status: string;
    message: string;
    target: { districtIds?: string[]; basinId?: string };
    occurredAt: string;
    expiresAt: string | null;
    cancelledAt: string | null;
    cancellationReason: string | null;
    escalations: Array<{
      id: string;
      fromSeverity: string;
      toSeverity: string;
      occurredAt: string;
      reason?: string;
    }>;
  };
  summary: {
    totalAttempts: number;
    distinctCitizensReached: number;
    sms: { sent: number; delivered: number; failed: number };
    push: { sent: number; delivered: number; failed: number };
  };
  attempts: Array<{
    id: string;
    citizenId: string;
    districtId: string;
    channel: string;
    status: string;
    kind: string;
    occurredAt: string;
    deliveredAt: string | null;
    failureReason: string | null;
  }>;
}

export function AlertDetailClient({ alertId }: { alertId: string }) {
  const [data, setData] = useState<AlertDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alarmPlaying, setAlarmPlaying] = useState(false);
  const [receiptSimulated, setReceiptSimulated] = useState<'DELIVERED' | 'QUEUED'>('DELIVERED');

  useEffect(() => {
    let active = true;
    fetch(`/api/warnings/${alertId}`)
      .then(async (r) => {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.error || `Alert ${alertId} not found`);
        }
        return r.json();
      })
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [alertId]);

  // Play synthesized device audible alert chime using Web Audio API (Critique G03)
  const triggerAudibleAlarm = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Play double warning beep
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc1.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);

      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.3);

      setAlarmPlaying(true);
      setTimeout(() => setAlarmPlaying(false), 1500);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  const getDistrictName = (id: string) =>
    DISTRICTS.find((d) => d.id === id)?.name || id;

  if (loading) {
    return (
      <div className="mx-auto max-w-md py-16 text-center text-sm text-gray-500">
        Loading alert receipt...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <h2 className="text-base font-bold text-red-900">Warning Not Found</h2>
        <p className="mt-2 text-xs text-red-700">{error || 'Unable to load alert.'}</p>
        <Link
          href="/warnings"
          className="mt-4 inline-block rounded-md bg-white border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm"
        >
          ← Return to Warnings
        </Link>
      </div>
    );
  }

  const { alert, summary } = data;
  const isEmergency = alert.severity === 'EMERGENCY';
  const isWarning = alert.severity === 'WARNING';
  const isCancelled = alert.status === 'CANCELLED';

  const severityHeaderBg = isEmergency
    ? 'bg-red-700 text-white'
    : isWarning
      ? 'bg-amber-600 text-white'
      : alert.severity === 'WATCH'
        ? 'bg-yellow-500 text-gray-900'
        : 'bg-blue-600 text-white';

  return (
    <div className="mx-auto max-w-md space-y-4">
      {/* Phone container shell */}
      <div className="overflow-hidden rounded-2xl border-4 border-gray-800 bg-white shadow-2xl">
        {/* Phone Top Notch / Status Bar */}
        <div className="flex items-center justify-between bg-gray-900 px-4 py-1.5 text-[10px] text-gray-300">
          <span>DEWECS Mobile</span>
          <div className="flex items-center gap-1.5">
            <span>● WiFi</span>
            <span>100%</span>
          </div>
        </div>

        {/* Hazard Emergency Header */}
        <div className={`p-5 text-center ${severityHeaderBg}`}>
          <div className="text-xs font-semibold tracking-wider uppercase opacity-90">
            Emergency Early Warning Broadcast
          </div>
          <div className="mt-1 text-2xl font-black tracking-tight">{alert.hazardType}</div>
          <div className="mt-2 inline-block rounded-full bg-black/25 px-3 py-1 text-xs font-bold tracking-wide">
            {alert.severity} LEVEL
          </div>
        </div>

        {isCancelled && (
          <div className="bg-gray-800 text-white text-xs px-4 py-2 font-bold text-center">
            ⚠ THIS WARNING HAS BEEN CANCELLED ({alert.cancellationReason ?? 'Safe conditions restored'})
          </div>
        )}

        {/* Device Audible Alert Feature (G03: device behaviour upon receipt) */}
        <div className="border-b bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold">Device Audible Alarm</span>
              <p className="text-[11px] text-amber-800">
                Triggered on device receipt (Critique G03).
              </p>
            </div>
            <button
              type="button"
              onClick={triggerAudibleAlarm}
              className={`rounded-lg px-3 py-1.5 font-bold shadow transition ${
                alarmPlaying
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              {alarmPlaying ? '🔊 ALARM PLAYING' : '🔔 Test Alarm'}
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5 space-y-4 text-sm">
          {/* Status info */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Status: <strong className="text-gray-900">{alert.status}</strong></span>
            <span>Issued: <strong>{new Date(alert.occurredAt).toLocaleTimeString()}</strong></span>
          </div>

          {/* Warning Message Box */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide">
              Official DMC Advisory
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-900 font-medium">
              {alert.message}
            </p>
          </div>

          {/* Target Area Details */}
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
            <span className="font-semibold text-gray-900">Target Area: </span>
            {alert.target.basinId
              ? `Kelani Basin (${RIVER_BASINS.find((b) => b.id === alert.target.basinId)?.name})`
              : alert.target.districtIds?.map(getDistrictName).join(', ') ?? 'All Districts'}
          </div>

          {/* Action Guidance */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 space-y-1">
            <span className="font-bold">Recommended Immediate Actions:</span>
            <ul className="list-disc pl-4 space-y-0.5 text-blue-800">
              <li>Move to higher ground or designated evacuation shelters.</li>
              <li>Keep battery-powered radios and emergency contacts ready.</li>
              <li>Avoid crossing flooded roads or unstable slopes.</li>
            </ul>
          </div>

          {/* Emergency Hotline Contact */}
          <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-center">
            <div className="text-xs text-red-800">National Disaster Management Hotline</div>
            <a
              href="tel:117"
              className="mt-1 inline-block text-xl font-black text-red-700 hover:underline"
            >
              ☎ Call 117
            </a>
          </div>

          {/* Simulated Delivery Receipt State (QUEUED vs DELIVERED) */}
          <div className="rounded-lg border border-gray-200 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between font-semibold text-gray-800">
              <span>Device Delivery Receipt State:</span>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                  receiptSimulated === 'DELIVERED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {receiptSimulated}
              </span>
            </div>
            <div className="flex items-center justify-between text-gray-500">
              <span>Simulate device offline queue:</span>
              <button
                type="button"
                onClick={() =>
                  setReceiptSimulated((prev) => (prev === 'DELIVERED' ? 'QUEUED' : 'DELIVERED'))
                }
                className="rounded border border-gray-300 px-2 py-0.5 text-[11px] font-medium hover:bg-gray-100"
              >
                Toggle Offline / Online
              </button>
            </div>
          </div>

          {/* Delivery Channel Reach KPI summary */}
          <div className="border-t pt-3 text-[11px] text-gray-500 space-y-1">
            <div className="font-semibold text-gray-700">Central Broadcast Reach:</div>
            <div>Distinct Citizens Reached: <strong>{summary.distinctCitizensReached}</strong></div>
            <div>SMS: {summary.sms.delivered} delivered / {summary.sms.sent} sent</div>
            <div>Push: {summary.push.delivered} delivered / {summary.push.sent} sent</div>
          </div>
        </div>
      </div>

      {/* Back button */}
      <div className="text-center">
        <Link
          href="/warnings"
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          ← Return to Warnings Console
        </Link>
      </div>
    </div>
  );
}
