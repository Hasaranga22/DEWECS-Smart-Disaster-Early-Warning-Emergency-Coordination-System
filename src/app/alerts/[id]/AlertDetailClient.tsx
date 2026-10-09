'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { DISTRICTS, RIVER_BASINS } from '@/shared/seed';

const DISTRICT_NAME_BY_ID = new Map(DISTRICTS.map((d) => [d.id, d.name]));
function getDistrictName(districtId: string): string {
  return DISTRICT_NAME_BY_ID.get(districtId) ?? districtId;
}

function getTargetDisplayName(target: { districtIds?: string[]; basinId?: string }): string {
  if (target.districtIds && target.districtIds.length > 0) {
    return target.districtIds.map(getDistrictName).join(', ');
  }
  if (target.basinId) {
    const basin = RIVER_BASINS.find((b) => b.id === target.basinId);
    return basin ? basin.name : target.basinId;
  }
  return 'Sri Lanka (Island-wide)';
}

interface AlertDetailClientProps {
  alert: {
    id: string;
    hazardType: string;
    severity: string;
    status: string;
    message: string;
    target: { districtIds?: string[]; basinId?: string };
    issuedBy: string;
    occurredAt: string;
    expiresAt?: string | null;
    cancelledAt?: string | null;
    cancellationReason?: string | null;
    escalations?: Array<{
      id: string;
      fromSeverity: string;
      toSeverity: string;
      occurredAt: string;
      reason?: string;
    }>;
  };
  channelSummary: {
    sms: { sent: number; delivered: number; failed: number };
    push: { sent: number; delivered: number; failed: number };
  };
}

export function AlertDetailClient({ alert }: AlertDetailClientProps) {
  const [isPlayingAlarm, setIsPlayingAlarm] = useState(false);
  const [isOfflineSimulated, setIsOfflineSimulated] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);

  useEffect(() => {
    return () => {
      stopAlarm();
    };
  }, []);

  function startAlarm() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      // Siren frequency modulation
      osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.3);
      osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.6);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      oscRef.current = osc;
      setIsPlayingAlarm(true);

      // Auto-stop after 3 seconds
      setTimeout(() => {
        stopAlarm();
      }, 3000);
    } catch {
      // AudioContext may be blocked by autoplay policies
    }
  }

  function stopAlarm() {
    try {
      if (oscRef.current) {
        oscRef.current.stop();
        oscRef.current.disconnect();
        oscRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    } catch {
      // ignore
    }
    setIsPlayingAlarm(false);
  }

  const isCancelled = alert.status === 'CANCELLED';

  const severityHeaderColors: Record<string, string> = {
    EMERGENCY: 'bg-purple-900 text-white border-purple-950',
    WARNING: 'bg-red-700 text-white border-red-800',
    WATCH: 'bg-amber-600 text-white border-amber-700',
    ADVISORY: 'bg-yellow-500 text-slate-900 border-yellow-600',
  };

  return (
    <div className="mx-auto max-w-md pb-12">
      {/* Back button */}
      <div className="mb-3 flex items-center justify-between">
        <Link
          href="/warnings"
          className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline"
        >
          ← Back to Warnings
        </Link>
        <button
          onClick={() => setIsOfflineSimulated(!isOfflineSimulated)}
          className={`text-xs px-2.5 py-1 rounded border transition font-semibold ${
            isOfflineSimulated
              ? 'bg-amber-100 text-amber-950 border-amber-300 font-bold'
              : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
          }`}
        >
          {isOfflineSimulated ? 'Simulating Offline Mode' : 'Simulate Offline'}
        </button>
      </div>

      {/* Phone Screen Container */}
      <div className="overflow-hidden rounded-2xl border-4 border-slate-800 bg-white shadow-2xl">
        {/* Device Top Status Bar */}
        <div className="flex items-center justify-between bg-slate-950 px-4 py-1.5 text-[10px] font-mono text-slate-200">
          <span>DEWECS SRI LANKA</span>
          <span>4G LTE • 100%</span>
        </div>

        {/* Hazard Emergency Header */}
        <div className={`p-5 text-center ${severityHeaderColors[alert.severity] ?? 'bg-slate-700 text-white'}`}>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-3xl animate-pulse">
            🚨
          </div>
          <span className="text-xs font-extrabold tracking-widest uppercase opacity-90">
            EMERGENCY EARLY WARNING BULLETIN
          </span>
          <h1 className="mt-1 text-2xl font-black uppercase tracking-tight">
            {alert.hazardType} {alert.severity}
          </h1>
          <p className="mt-1 text-xs opacity-90">
            Issued: {new Date(alert.occurredAt).toLocaleString()}
          </p>
        </div>

        {/* Cancellation Notice if Cancelled */}
        {isCancelled && (
          <div className="border-b border-red-200 bg-red-100 p-3 text-center text-xs font-bold text-red-900">
            ⚠️ THIS HAZARD WARNING HAS BEEN CANCELLED
            {alert.cancellationReason && (
              <p className="mt-1 text-xs font-medium">Reason: {alert.cancellationReason}</p>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="space-y-4 p-5 text-slate-900">
          {/* Target Area Card */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              AFFECTED LOCATION / RIVER BASIN
            </span>
            <p className="mt-0.5 text-base font-bold text-slate-900">
              {getTargetDisplayName(alert.target)}
            </p>
          </div>

          {/* Warning Message */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              OFFICIAL DMC INSTRUCTION
            </span>
            <p className="mt-2 text-sm leading-relaxed text-slate-900 font-medium">
              {alert.message}
            </p>
          </div>

          {/* Immediate Action Checklist */}
          <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-950">
            <p className="font-bold uppercase tracking-wider text-blue-900">
              IMMEDIATE CITIZEN ACTIONS:
            </p>
            <ul className="list-disc space-y-1 pl-4 text-blue-950">
              <li>Move to higher ground if situated near river banks or steep slopes.</li>
              <li>Keep battery-operated radio tuned to disaster updates.</li>
              <li>Disconnect non-essential electrical appliances.</li>
              <li>Assist children, senior citizens, and persons with disabilities.</li>
            </ul>
          </div>

          {/* Alarm Siren Trigger (Device Behavior Requirement) */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-700 mb-2 font-medium">
              Audible siren triggers on device receipt:
            </p>
            <button
              type="button"
              onClick={isPlayingAlarm ? stopAlarm : startAlarm}
              className={`w-full rounded-lg py-2.5 text-xs font-bold transition shadow-sm ${
                isPlayingAlarm
                  ? 'bg-red-600 text-white animate-bounce'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {isPlayingAlarm ? '🔊 STOP DEVICE ALARM SIREN' : '🔊 SIMULATE DEVICE AUDIBLE ALARM'}
            </button>
          </div>

          {/* Delivery Status Receipt */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-700 font-medium">
            <span>Device Receipt Status:</span>
            <span
              className={`rounded px-2.5 py-0.5 text-xs font-bold ${
                isOfflineSimulated
                  ? 'bg-amber-100 text-amber-950 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-950 border border-emerald-300'
              }`}
            >
              {isOfflineSimulated ? 'QUEUED (OFFLINE)' : 'DELIVERED (CONFIRMED ✓)'}
            </span>
          </div>

          {/* Escalation History Timeline */}
          {alert.escalations && alert.escalations.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
              <span className="font-bold text-slate-800">Escalation Progression:</span>
              {alert.escalations.map((esc) => (
                <div key={esc.id} className="border-l-2 border-purple-600 pl-2 text-xs text-slate-700">
                  <span className="font-bold text-slate-900">
                    {esc.fromSeverity} → {esc.toSeverity}
                  </span>{' '}
                  ({new Date(esc.occurredAt).toLocaleTimeString()})
                  {esc.reason ? <p className="italic text-slate-600">{esc.reason}</p> : null}
                </div>
              ))}
            </div>
          )}

          {/* Emergency Hotlines */}
          <div className="rounded-lg bg-slate-900 p-3 text-center text-white text-xs">
            <p className="font-bold uppercase tracking-wider text-slate-200">
              NATIONAL EMERGENCY HOTLINES
            </p>
            <div className="mt-1 flex justify-center gap-4 text-sm font-extrabold text-amber-400">
              <span>DMC: 117</span>
              <span>POLICE: 119</span>
              <span>AMBULANCE: 1990</span>
            </div>
          </div>
        </div>

        {/* Phone Bottom Bezel */}
        <div className="bg-slate-950 py-2.5 text-center text-[11px] font-medium text-slate-300">
          DEWECS National Disaster Early Warning Authority
        </div>
      </div>
    </div>
  );
}
