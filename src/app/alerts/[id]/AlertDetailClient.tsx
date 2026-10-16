'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { DISTRICTS, RIVER_BASINS } from '@/shared/seed';
import { EmergencyHeader } from './components/EmergencyHeader';
import { ActionChecklist } from './components/ActionChecklist';
import { HotlinesBar } from './components/HotlinesBar';

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
    title?: string | null;
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
  channelSummary?: {
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
      osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.3);
      osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.6);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      oscRef.current = osc;
      setIsPlayingAlarm(true);

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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center py-6 px-4 w-full">
      <div className="w-full max-w-md mx-auto pb-12">
        {/* Navigation & Simulation Controls */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link
            href="/warnings"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-blue-700 bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-xs hover:border-slate-400 transition"
          >
            ← Back to Warnings Dashboard
          </Link>
          <button
            onClick={() => setIsOfflineSimulated(!isOfflineSimulated)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition font-bold shadow-xs cursor-pointer ${
              isOfflineSimulated
                ? 'bg-amber-100 text-amber-950 border-amber-300'
                : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {isOfflineSimulated ? 'Simulating Offline Mode' : 'Simulate Offline'}
          </button>
        </div>

        {/* Phone Screen Container - subtle phone-like card */}
        <div className="overflow-hidden rounded-3xl border-4 border-slate-800 bg-white shadow-2xl ring-1 ring-slate-900/10">
          {/* Device Top Status Bar */}
          <div className="flex items-center justify-between bg-slate-950 px-4 py-1.5 text-[10px] font-mono text-slate-200">
            <span>DEWECS SRI LANKA</span>
            <span>4G LTE • 100%</span>
          </div>

          {/* Hazard Emergency Header */}
          <EmergencyHeader
            hazardType={alert.hazardType}
            severity={alert.severity}
            title={alert.title}
            occurredAt={alert.occurredAt}
            isCancelled={isCancelled}
            cancellationReason={alert.cancellationReason}
          />

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
            <ActionChecklist />

            {/* Alarm Siren Trigger (Device Behavior Requirement) */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-700 mb-2 font-medium">
                Audible siren triggers on device receipt:
              </p>
              <button
                type="button"
                onClick={isPlayingAlarm ? stopAlarm : startAlarm}
                className={`w-full rounded-lg py-2.5 text-xs font-bold transition shadow-sm cursor-pointer ${
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
            <HotlinesBar />
          </div>

          {/* Phone Bottom Bezel */}
          <div className="bg-slate-950 py-2.5 text-center text-[11px] font-medium text-slate-300">
            DEWECS National Disaster Early Warning Authority
          </div>
        </div>
      </div>
    </div>
  );
}
