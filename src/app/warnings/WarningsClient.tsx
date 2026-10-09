'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { HazardType, Role } from '@/shared/domain';
import { DISTRICTS, KELANI_BASIN_ID, RIVER_BASINS } from '@/shared/seed';

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

interface WarningsClientProps {
  actorRole: Role;
  actorUserId: string;
}

interface EvidenceItem {
  reportId: string;
  hazardType: string;
  districtId: string;
  lat: number;
  lng: number;
  severityIndication?: string;
  confidence: string;
  corroborationCount: number;
  decidedAt: string;
}

interface PreviewData {
  estimatedRecipients: number;
  distinctCitizens: number;
  byDistrict: Record<string, number>;
  byChannel: {
    sms: number;
    push: number;
    both: number;
    none: number;
  };
  targetDistrictIds: string[];
}

interface AttemptItem {
  id: string;
  citizenId: string;
  districtId: string;
  channel: string;
  status: string;
  kind: string;
  occurredAt: string;
  failureReason?: string | null;
}

interface DispatchResultData {
  alert: {
    id: string;
    hazardType: string;
    severity: string;
    status: string;
    message: string;
    target: { districtIds?: string[]; basinId?: string };
    occurredAt: string;
  };
  distinctCitizensReached: number;
  totalAttempts: number;
  channelSummary: {
    sms: { sent: number; delivered: number; failed: number };
    push: { sent: number; delivered: number; failed: number };
  };
  attempts?: AttemptItem[];
}

interface AlertItem {
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
}

const SEVERITIES = ['ADVISORY', 'WATCH', 'WARNING', 'EMERGENCY'] as const;
type Severity = (typeof SEVERITIES)[number];

const HAZARD_TYPES: HazardType[] = ['FLOOD', 'LANDSLIDE', 'CYCLONE', 'DROUGHT'];

export function WarningsClient({ actorRole }: WarningsClientProps) {
  const isDmcOfficial = actorRole === 'DMC_OFFICIAL';

  // Tabs: 'composer' | 'active'
  const [activeTab, setActiveTab] = useState<'composer' | 'active'>(
    isDmcOfficial ? 'composer' : 'active',
  );

  // Composer workflow steps: 1: form, 2: preview, 3: result
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form inputs
  const [hazardType, setHazardType] = useState<HazardType>('FLOOD');
  const [severity, setSeverity] = useState<Severity>('WARNING');
  const [message, setMessage] = useState('');
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [useKelaniBasin, setUseKelaniBasin] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState('24');
  const [confirmZero, setConfirmZero] = useState(false);

  // State
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [dispatchResult, setDispatchResult] = useState<DispatchResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Evidence panel data
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  // Active alerts list
  const [alertsList, setAlertsList] = useState<AlertItem[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // Escalate & Cancel modal state
  const [selectedAlertForAction, setSelectedAlertForAction] = useState<AlertItem | null>(null);
  const [actionType, setActionType] = useState<'ESCALATE' | 'CANCEL' | null>(null);
  const [newSeverity, setNewSeverity] = useState<Severity>('EMERGENCY');
  const [actionReason, setActionReason] = useState('');
  const [expandDistricts, setExpandDistricts] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts();
    if (isDmcOfficial) {
      fetchEvidence();
    }
  }, [isDmcOfficial]);

  async function fetchEvidence() {
    setLoadingEvidence(true);
    try {
      const res = await fetch('/api/warnings/evidence');
      if (res.ok) {
        const data = await res.json();
        setEvidenceList(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingEvidence(false);
    }
  }

  async function fetchAlerts() {
    setLoadingAlerts(true);
    try {
      const res = await fetch('/api/warnings');
      if (res.ok) {
        const data = await res.json();
        setAlertsList(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAlerts(false);
    }
  }

  function handleDistrictToggle(id: string) {
    if (selectedDistricts.includes(id)) {
      setSelectedDistricts(selectedDistricts.filter((d) => d !== id));
    } else {
      setSelectedDistricts([...selectedDistricts, id]);
    }
  }

  function handleKelaniToggle() {
    const nextVal = !useKelaniBasin;
    setUseKelaniBasin(nextVal);
    if (nextVal) {
      const kelani = RIVER_BASINS.find((b) => b.id === KELANI_BASIN_ID);
      if (kelani) {
        const combined = Array.from(new Set([...selectedDistricts, ...kelani.districtIds]));
        setSelectedDistricts(combined);
      }
    }
  }

  async function handlePreview() {
    setErrorMsg(null);
    if (selectedDistricts.length === 0 && !useKelaniBasin) {
      setErrorMsg('Please select at least one target district or River Basin.');
      return;
    }
    if (!message.trim()) {
      setErrorMsg('Please enter a warning message.');
      return;
    }

    setLoading(true);
    try {
      const targetPayload = {
        districtIds: selectedDistricts.length > 0 ? selectedDistricts : undefined,
        basinId: useKelaniBasin ? KELANI_BASIN_ID : undefined,
      };

      const res = await fetch('/api/warnings/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to preview recipients.');
        return;
      }

      setPreviewData(data);
      setStep(2);
    } catch {
      setErrorMsg('Network error while previewing recipients.');
    } finally {
      setLoading(false);
    }
  }

  async function handleIssue() {
    setErrorMsg(null);
    setLoading(true);

    try {
      const now = new Date();
      const expiresAt =
        expiresInHours !== 'none'
          ? new Date(now.getTime() + parseInt(expiresInHours, 10) * 3600000).toISOString()
          : null;

      const payload = {
        hazardType,
        severity,
        message,
        target: {
          districtIds: selectedDistricts.length > 0 ? selectedDistricts : undefined,
          basinId: useKelaniBasin ? KELANI_BASIN_ID : undefined,
        },
        confirmZeroRecipients: confirmZero,
        expiresAt,
      };

      const res = await fetch('/api/warnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to issue hazard alert.');
        return;
      }

      setDispatchResult(data);
      setStep(3);
      fetchAlerts();
    } catch {
      setErrorMsg('Network error while issuing hazard alert.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(alertId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/warnings/${alertId}/retry`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setDispatchResult((prev) =>
          prev
            ? {
                ...prev,
                channelSummary: data.channelSummary,
                distinctCitizensReached: data.distinctCitizensReached,
              }
            : null,
        );
        fetchAlerts();
      } else {
        setErrorMsg(data.error || 'Failed to retry.');
      }
    } catch {
      setErrorMsg('Failed to retry dispatch.');
    } finally {
      setLoading(false);
    }
  }

  async function executeAlertAction() {
    if (!selectedAlertForAction || !actionType) return;
    setActionError(null);
    setLoading(true);

    try {
      if (actionType === 'ESCALATE') {
        const res = await fetch(`/api/warnings/${selectedAlertForAction.id}/escalate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newSeverity,
            reason: actionReason,
            expandDistrictIds: expandDistricts.length > 0 ? expandDistricts : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setActionError(data.error || 'Failed to escalate alert.');
          return;
        }
      } else if (actionType === 'CANCEL') {
        if (!actionReason.trim()) {
          setActionError('Cancellation reason is required.');
          return;
        }
        const res = await fetch(`/api/warnings/${selectedAlertForAction.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: actionReason }),
        });
        const data = await res.json();
        if (!res.ok) {
          setActionError(data.error || 'Failed to cancel alert.');
          return;
        }
      }

      setSelectedAlertForAction(null);
      setActionType(null);
      setActionReason('');
      fetchAlerts();
    } catch {
      setActionError('Network error executing alert action.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Hazard Warnings & Bulletins
          </h1>
          <p className="text-sm font-medium text-slate-600">
            DMC Location-Specific Multi-Channel Early Warning System (UC1)
          </p>
        </div>

        <div className="flex rounded-lg border-2 border-slate-300 bg-white p-1 text-sm shadow-sm">
          {isDmcOfficial && (
            <button
              onClick={() => setActiveTab('composer')}
              className={`rounded px-4 py-1.5 font-bold transition cursor-pointer ${
                activeTab === 'composer'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Issue Warning
            </button>
          )}
          <button
            onClick={() => setActiveTab('active')}
            className={`rounded px-4 py-1.5 font-bold transition cursor-pointer ${
              activeTab === 'active'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Active Warnings ({alertsList.length})
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 text-sm text-red-900 shadow-sm">
          <p className="font-bold">Error Notice</p>
          <p className="mt-1 font-medium">{errorMsg}</p>
        </div>
      )}

      {/* COMPOSER / PREVIEW / RESULT WORKFLOW */}
      {activeTab === 'composer' && isDmcOfficial && (
        <div className="space-y-6">
          {/* Progress Steps Header */}
          <div className="flex items-center justify-between border-2 border-slate-200 bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${
                  step === 1 ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-slate-200 text-slate-800'
                }`}
              >
                1
              </span>
              <span className={`text-sm ${step === 1 ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-700'}`}>
                Composer & Evidence
              </span>
            </div>
            <div className="h-0.5 w-12 bg-slate-300" />
            <div className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${
                  step === 2 ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-slate-200 text-slate-800'
                }`}
              >
                2
              </span>
              <span className={`text-sm ${step === 2 ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-700'}`}>
                Preview & Estimates
              </span>
            </div>
            <div className="h-0.5 w-12 bg-slate-300" />
            <div className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${
                  step === 3 ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-slate-200 text-slate-800'
                }`}
              >
                3
              </span>
              <span className={`text-sm ${step === 3 ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-700'}`}>
                Delivery Outcome
              </span>
            </div>
          </div>

          {/* STEP 1: COMPOSER */}
          {step === 1 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Main Composer Form */}
              <div className="space-y-6 rounded-lg border-2 border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                <h2 className="text-lg font-extrabold text-slate-900">1. Draft Hazard Warning</h2>

                {/* Hazard Type */}
                <div>
                  <label className="block text-sm font-bold text-slate-900">Hazard Type</label>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {HAZARD_TYPES.map((hz) => (
                      <button
                        key={hz}
                        type="button"
                        onClick={() => setHazardType(hz)}
                        className={`rounded-lg p-3 text-center text-sm font-bold transition shadow-xs ${
                          hazardType === hz
                            ? 'border-2 border-blue-600 bg-blue-100 text-blue-950 ring-2 ring-blue-600'
                            : 'border-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:border-slate-400'
                        }`}
                      >
                        {hz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Severity Level */}
                <div>
                  <label className="block text-sm font-bold text-slate-900">Severity Level</label>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {SEVERITIES.map((s) => {
                      const selectedStyles: Record<Severity, string> = {
                        ADVISORY: 'border-2 border-amber-500 bg-amber-100 text-amber-950 ring-2 ring-amber-500',
                        WATCH: 'border-2 border-orange-500 bg-orange-100 text-orange-950 ring-2 ring-orange-500',
                        WARNING: 'border-2 border-red-500 bg-red-100 text-red-950 ring-2 ring-red-500',
                        EMERGENCY: 'border-2 border-purple-600 bg-purple-100 text-purple-950 ring-2 ring-purple-600',
                      };
                      const isSelected = severity === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSeverity(s)}
                          className={`rounded-lg p-3 text-center text-sm font-bold transition shadow-xs ${
                            isSelected
                              ? selectedStyles[s]
                              : 'border-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:border-slate-400'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Target Geography */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-bold text-slate-900">
                      Target Area (Districts or River Basin)
                    </label>
                    <button
                      type="button"
                      onClick={handleKelaniToggle}
                      className={`text-xs font-bold px-3 py-1.5 rounded-md border-2 transition shadow-xs ${
                        useKelaniBasin
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {useKelaniBasin ? '✓ Kelani Basin Selected' : '+ Select Kelani Basin (Col, Gam, Keg)'}
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {DISTRICTS.map((d) => {
                      const checked = selectedDistricts.includes(d.id);
                      return (
                        <label
                          key={d.id}
                          className={`flex items-center gap-2.5 rounded-lg border-2 p-2.5 text-sm transition cursor-pointer font-semibold ${
                            checked
                              ? 'border-blue-600 bg-blue-100 text-blue-950 shadow-xs'
                              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleDistrictToggle(d.id)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>{d.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Warning Message */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-bold text-slate-900">
                      Public Warning Message
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setMessage(
                          `URGENT: Heavy flooding expected along the Kelani river bank. Evacuate low-lying areas immediately and head to designated shelters.`,
                        )
                      }
                      className="text-xs font-bold text-blue-700 hover:underline"
                    >
                      Insert Flood Template
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter urgent instructions, affected GN divisions, evacuation routes..."
                    className="mt-2 w-full rounded-lg border-2 border-slate-300 bg-white p-3 text-sm font-medium text-slate-900 placeholder-slate-500 shadow-xs focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* Expiry Hours */}
                <div>
                  <label className="block text-sm font-bold text-slate-900">
                    Auto-Expiry Duration
                  </label>
                  <select
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(e.target.value)}
                    className="mt-2 rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-xs focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="6">6 Hours</option>
                    <option value="12">12 Hours</option>
                    <option value="24">24 Hours (Standard)</option>
                    <option value="48">48 Hours</option>
                    <option value="none">No auto-expiry</option>
                  </select>
                </div>

                {/* Action Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={loading}
                    className="w-full rounded-lg bg-blue-600 py-3.5 text-base font-extrabold text-white shadow-md transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? 'Analyzing Target Geography...' : 'Preview Recipients & Channels →'}
                  </button>
                </div>
              </div>

              {/* Verified Ground Evidence Panel (Step 9 & Requirement 4) */}
              <div className="space-y-4 rounded-lg border-2 border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-base font-extrabold text-slate-900">Verified Evidence</h3>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900 border border-emerald-300">
                    UC2 Feed
                  </span>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
                  <p className="font-bold text-slate-900">Operational Guideline</p>
                  <p className="mt-1 leading-relaxed">
                    Verified ground reports provide corroborating evidence. Official warnings must be
                    explicitly issued by DMC Officials and are <strong>never auto-issued</strong>.
                  </p>
                </div>

                {loadingEvidence ? (
                  <div className="py-8 text-center text-xs font-medium text-slate-600">Loading ground evidence...</div>
                ) : evidenceList.length === 0 ? (
                  <div className="py-8 text-center text-xs font-medium text-slate-600">
                    No verified ground reports available for current scope.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {evidenceList.map((ev) => (
                      <div
                        key={ev.reportId}
                        className="rounded-lg border-2 border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-1.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-950 text-sm">{ev.hazardType}</span>
                          <span
                            className={`rounded px-2 py-0.5 font-extrabold ${
                              ev.severityIndication === 'HIGH'
                                ? 'bg-red-100 text-red-950 border border-red-300'
                                : 'bg-amber-100 text-amber-950 border border-amber-300'
                            }`}
                          >
                            {ev.severityIndication ?? 'VERIFIED'}
                          </span>
                        </div>
                        <p className="text-slate-800">
                          District: <span className="font-bold text-slate-950">{getDistrictName(ev.districtId)}</span>
                        </p>
                        <p className="text-slate-700 font-mono">
                          Coordinates: {ev.lat.toFixed(4)}, {ev.lng.toFixed(4)}
                        </p>
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 text-slate-700 font-medium">
                          <span>Corroboration: <strong>{ev.corroborationCount}</strong> reports</span>
                          <span>Confidence: <strong>{ev.confidence}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {step === 2 && previewData && (
            <div className="space-y-6 rounded-lg border-2 border-slate-200 bg-white p-6 shadow-sm">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-xl font-extrabold text-slate-900">2. Review Estimated Recipients</h2>
                <p className="text-sm font-medium text-slate-700">
                  Pre-dispatch analysis confirming distinct population reach across SMS and Push gateways.
                </p>
              </div>

              {/* Warning Summary Banner */}
              <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-4 text-sm text-blue-950">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <span className="text-xs uppercase text-blue-900 font-bold">Hazard</span>
                    <p className="font-extrabold text-base">{hazardType}</p>
                  </div>
                  <div>
                    <span className="text-xs uppercase text-blue-900 font-bold">Severity</span>
                    <p className="font-extrabold text-base">{severity}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs uppercase text-blue-900 font-bold">Target Districts</span>
                    <p className="font-extrabold text-base">
                      {previewData.targetDistrictIds.map(getDistrictName).join(', ')}
                    </p>
                  </div>
                </div>
                <div className="mt-3 border-t border-blue-200 pt-2">
                  <span className="text-xs uppercase text-blue-900 font-bold">Message Preview</span>
                  <p className="italic mt-1 font-medium">&ldquo;{message}&rdquo;</p>
                </div>
              </div>

              {/* Key Estimates Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-4 text-center">
                  <span className="text-xs font-bold uppercase text-slate-700">
                    Estimated Recipients
                  </span>
                  <p className="mt-1 text-3xl font-black text-blue-700">
                    {previewData.estimatedRecipients}
                  </p>
                  <span className="text-xs font-semibold text-slate-600">Unique registered citizens</span>
                </div>

                <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-4 text-center">
                  <span className="text-xs font-bold uppercase text-slate-700">
                    SMS Gateway Potential
                  </span>
                  <p className="mt-1 text-3xl font-black text-slate-900">
                    {previewData.byChannel.sms}
                  </p>
                  <span className="text-xs font-semibold text-slate-600">Citizens with registered phone</span>
                </div>

                <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-4 text-center">
                  <span className="text-xs font-bold uppercase text-slate-700">
                    Mobile Push Potential
                  </span>
                  <p className="mt-1 text-3xl font-black text-slate-900">
                    {previewData.byChannel.push}
                  </p>
                  <span className="text-xs font-semibold text-slate-600">Citizens with active app tokens</span>
                </div>
              </div>

              {/* Zero Recipients Exception Warning (W06) */}
              {previewData.estimatedRecipients === 0 && (
                <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-extrabold text-base">Zero Recipients Warning</p>
                  <p className="mt-1 font-medium">
                    No citizens were found residing in the selected target area. To dispatch this warning
                    anyway, explicit confirmation is required.
                  </p>
                  <label className="mt-3 flex items-center gap-2 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmZero}
                      onChange={(e) => setConfirmZero(e.target.checked)}
                      className="h-4 w-4 rounded text-amber-600"
                    />
                    <span>Confirm issuing warning with zero registered citizens</span>
                  </label>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-lg border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-100 hover:border-slate-400 transition"
                >
                  ← Back to Edit
                </button>

                <button
                  type="button"
                  onClick={handleIssue}
                  disabled={loading || (previewData.estimatedRecipients === 0 && !confirmZero)}
                  title={
                    loading
                      ? 'Dispatching warning to gateways...'
                      : previewData.estimatedRecipients === 0 && !confirmZero
                      ? 'Cannot issue: zero recipients detected. Confirm checkbox above to proceed.'
                      : 'Issue and dispatch hazard warning alert'
                  }
                  className="rounded-lg bg-red-600 px-7 py-3 text-base font-black text-white shadow-md transition hover:bg-red-700 focus:ring-4 focus:ring-red-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? 'Dispatching Warning...' : 'CONFIRM & ISSUE HAZARD ALERT 🚨'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: RESULT */}
          {step === 3 && dispatchResult && (
            <div className="space-y-6 rounded-lg border-2 border-slate-200 bg-white p-6 shadow-sm">
              <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
                <h2 className="text-xl font-extrabold">Alert Dispatched Successfully</h2>
                <p className="mt-1 text-sm font-medium">
                  Active alert registered (ID:{' '}
                  <span className="font-mono font-bold">{dispatchResult.alert.id}</span>).
                  Saved to database first before dispatch.
                </p>
              </div>

              {/* Outcomes Breakdown */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-4 text-center">
                  <span className="text-xs font-bold uppercase text-slate-700">
                    Distinct Citizens Reached
                  </span>
                  <p className="mt-1 text-3xl font-black text-emerald-700">
                    {dispatchResult.distinctCitizensReached}
                  </p>
                  <span className="text-xs font-semibold text-slate-600">Confirmed delivered to ≥1 channel</span>
                </div>

                <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-4 text-center">
                  <span className="text-xs font-bold uppercase text-slate-700">
                    SMS Deliveries
                  </span>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {dispatchResult.channelSummary.sms.delivered} /{' '}
                    {dispatchResult.channelSummary.sms.sent}
                  </p>
                  {dispatchResult.channelSummary.sms.failed > 0 && (
                    <span className="text-xs font-bold text-red-700">
                      {dispatchResult.channelSummary.sms.failed} failed
                    </span>
                  )}
                </div>

                <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-4 text-center">
                  <span className="text-xs font-bold uppercase text-slate-700">
                    Push Deliveries
                  </span>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {dispatchResult.channelSummary.push.delivered} /{' '}
                    {dispatchResult.channelSummary.push.sent}
                  </p>
                  {dispatchResult.channelSummary.push.failed > 0 && (
                    <span className="text-xs font-bold text-red-700">
                      {dispatchResult.channelSummary.push.failed} failed
                    </span>
                  )}
                </div>
              </div>

              {/* Attempts Table */}
              {dispatchResult.attempts && dispatchResult.attempts.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-2">Notification Attempts Log</h3>
                  <div className="overflow-x-auto rounded-lg border-2 border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-200 text-slate-900 font-extrabold">
                        <tr>
                          <th className="p-2.5">Citizen ID</th>
                          <th className="p-2.5">District</th>
                          <th className="p-2.5">Channel</th>
                          <th className="p-2.5">Kind</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Note / Failure</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {dispatchResult.attempts.map((att) => (
                          <tr key={att.id} className="hover:bg-slate-100 font-medium">
                            <td className="p-2.5 font-mono text-slate-900">{att.citizenId}</td>
                            <td className="p-2.5 font-semibold text-slate-900">{getDistrictName(att.districtId)}</td>
                            <td className="p-2.5 font-bold text-slate-900">{att.channel}</td>
                            <td className="p-2.5 text-slate-800">{att.kind}</td>
                            <td className="p-2.5">
                              <span
                                className={`rounded px-2 py-0.5 font-bold ${
                                  att.status === 'DELIVERED'
                                    ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                                    : att.status === 'FAILED'
                                    ? 'bg-red-100 text-red-950 border border-red-300'
                                    : 'bg-slate-200 text-slate-900'
                                }`}
                              >
                                {att.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-700">{att.failureReason ?? '–'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
                <div className="flex gap-2.5">
                  {(dispatchResult.channelSummary.sms.failed > 0 ||
                    dispatchResult.channelSummary.push.failed > 0) && (
                    <button
                      type="button"
                      onClick={() => handleRetry(dispatchResult.alert.id)}
                      disabled={loading}
                      className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {loading ? 'Retrying...' : 'Retry Failed Attempts'}
                    </button>
                  )}
                  <Link
                    href={`/alerts/${dispatchResult.alert.id}`}
                    className="rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-100"
                  >
                    View Citizen Receipt (Mobile View) →
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setDispatchResult(null);
                    setPreviewData(null);
                    setMessage('');
                    setActiveTab('active');
                  }}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 shadow-sm"
                >
                  View in Active Alerts List
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ACTIVE ALERTS LIST */}
      {activeTab === 'active' && (
        <div className="space-y-4 rounded-lg border-2 border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Current Hazard Alerts</h2>
              <p className="text-sm font-medium text-slate-700">
                Active early warnings with escalation history and cancellation records.
              </p>
            </div>
            <button
              onClick={fetchAlerts}
              disabled={loadingAlerts}
              className="text-xs font-bold text-blue-700 hover:underline"
            >
              {loadingAlerts ? 'Refreshing...' : '↻ Refresh List'}
            </button>
          </div>

          {alertsList.length === 0 ? (
            <div className="py-12 text-center text-sm font-semibold text-slate-600">
              No hazard alerts currently issued.
            </div>
          ) : (
            <div className="space-y-4">
              {alertsList.map((alert) => {
                const isEmergency = alert.severity === 'EMERGENCY';
                const isClosed = alert.status === 'CANCELLED' || alert.status === 'EXPIRED';

                return (
                  <div
                    key={alert.id}
                    className="rounded-lg border-2 border-slate-200 p-4 transition hover:border-slate-300 space-y-3 bg-white"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-950 text-base">{alert.hazardType}</span>
                        <span
                          className={`rounded px-2.5 py-0.5 text-xs font-extrabold ${
                            alert.severity === 'EMERGENCY'
                              ? 'bg-purple-100 text-purple-950 border border-purple-300'
                              : alert.severity === 'WARNING'
                              ? 'bg-red-100 text-red-950 border border-red-300'
                              : alert.severity === 'WATCH'
                              ? 'bg-orange-100 text-orange-950 border border-orange-300'
                              : 'bg-yellow-100 text-yellow-950 border border-yellow-300'
                          }`}
                        >
                          {alert.severity}
                        </span>
                        <span
                          className={`rounded px-2.5 py-0.5 text-xs font-extrabold ${
                            alert.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                              : alert.status === 'ESCALATED'
                              ? 'bg-blue-100 text-blue-950 border border-blue-300'
                              : alert.status === 'CANCELLED'
                              ? 'bg-slate-200 text-slate-900 border border-slate-300'
                              : 'bg-zinc-200 text-zinc-900 border border-zinc-300'
                          }`}
                        >
                          {alert.status}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-600">
                        Occurred: {new Date(alert.occurredAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-slate-900 leading-relaxed">{alert.message}</p>

                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-700 border-t border-slate-200 pt-2 font-medium">
                      <div>
                        Target Area:{' '}
                        <span className="font-bold text-slate-950">
                          {getTargetDisplayName(alert.target)}
                        </span>
                      </div>
                      {alert.expiresAt && (
                        <div>
                          Expires: {new Date(alert.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>

                    {alert.cancellationReason && (
                      <div className="rounded-md border border-slate-200 bg-slate-100 p-2.5 text-xs text-slate-800">
                        <span className="font-bold text-slate-950">Cancelled Reason:</span> {alert.cancellationReason}
                      </div>
                    )}

                    {alert.escalations && alert.escalations.length > 0 && (
                      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950 space-y-1.5">
                        <span className="font-extrabold text-blue-950">Escalation History:</span>
                        {alert.escalations.map((esc) => (
                          <div key={esc.id} className="pl-2 border-l-2 border-blue-400 font-medium">
                            <strong>{esc.fromSeverity} → {esc.toSeverity}</strong> (
                            {new Date(esc.occurredAt).toLocaleTimeString()})
                            {esc.reason ? ` – ${esc.reason}` : ''}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Operational Action Buttons (DMC Official) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                      <Link
                        href={`/alerts/${alert.id}`}
                        className="text-xs font-bold text-blue-700 hover:underline"
                      >
                        Citizen Alert Receipt View →
                      </Link>

                      {isDmcOfficial && (
                        <div className="flex items-center gap-2">
                          {/* ESCALATE BUTTON */}
                          <button
                            type="button"
                            disabled={isEmergency || isClosed}
                            title={
                              isClosed
                                ? 'Alert is closed and cannot be escalated'
                                : isEmergency
                                ? 'Alert is already at maximum severity (EMERGENCY)'
                                : 'Escalate severity'
                            }
                            onClick={() => {
                              setSelectedAlertForAction(alert);
                              setActionType('ESCALATE');
                              setActionReason('');
                              setActionError(null);
                              if (alert.severity === 'ADVISORY') setNewSeverity('WATCH');
                              else if (alert.severity === 'WATCH') setNewSeverity('WARNING');
                              else setNewSeverity('EMERGENCY');
                            }}
                            className="rounded-md border-2 border-purple-400 bg-purple-50 px-3 py-1.5 text-xs font-extrabold text-purple-950 transition hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Escalate Severity
                          </button>

                          {/* CANCEL BUTTON */}
                          <button
                            type="button"
                            disabled={isClosed}
                            title={isClosed ? 'Alert is already closed' : 'Cancel alert'}
                            onClick={() => {
                              setSelectedAlertForAction(alert);
                              setActionType('CANCEL');
                              setActionReason('');
                              setActionError(null);
                            }}
                            className="rounded-md border-2 border-red-400 bg-red-50 px-3 py-1.5 text-xs font-extrabold text-red-950 transition hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Cancel Alert
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ACTION MODAL (Escalate or Cancel) */}
      {selectedAlertForAction && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl space-y-4 border-2 border-slate-300">
            <h3 className="text-lg font-extrabold text-slate-900">
              {actionType === 'ESCALATE' ? 'Escalate Alert Severity' : 'Cancel Hazard Alert'}
            </h3>
            <p className="text-xs font-medium text-slate-700">
              Alert: <span className="font-bold text-slate-900">{selectedAlertForAction.hazardType}</span> (Current:{' '}
              <span className="font-extrabold text-slate-900">{selectedAlertForAction.severity}</span>)
            </p>

            {actionError && (
              <div className="rounded-md border border-red-300 bg-red-50 p-2.5 text-xs font-bold text-red-900">
                {actionError}
              </div>
            )}

            {actionType === 'ESCALATE' && (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-bold text-slate-900">
                    Target Severity Level
                  </label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as Severity)}
                    className="mt-1 w-full rounded-md border-2 border-slate-300 bg-white p-2 text-sm font-semibold text-slate-900"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900">
                    Escalation Reason
                  </label>
                  <input
                    type="text"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="e.g. River level reached critical threshold"
                    className="mt-1 w-full rounded-md border-2 border-slate-300 bg-white p-2 text-sm font-medium text-slate-900 placeholder-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900">
                    Widen Target Districts (Optional)
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-1.5 text-xs">
                    {DISTRICTS.map((d) => (
                      <label key={d.id} className="flex items-center gap-1.5 font-medium text-slate-800">
                        <input
                          type="checkbox"
                          checked={expandDistricts.includes(d.id)}
                          onChange={() => {
                            if (expandDistricts.includes(d.id)) {
                              setExpandDistricts(expandDistricts.filter((x) => x !== d.id));
                            } else {
                              setExpandDistricts([...expandDistricts, d.id]);
                            }
                          }}
                          className="rounded text-blue-600"
                        />
                        <span>{d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {actionType === 'CANCEL' && (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-bold text-slate-900">
                    Cancellation Reason (Required)
                  </label>
                  <textarea
                    rows={3}
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="e.g. Danger has passed, flood levels receded safely"
                    className="mt-1 w-full rounded-md border-2 border-slate-300 bg-white p-2 text-sm font-medium text-slate-900 placeholder-slate-500"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setSelectedAlertForAction(null);
                  setActionType(null);
                }}
                className="rounded-md border-2 border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeAlertAction}
                disabled={loading}
                className={`rounded-md px-4 py-1.5 text-xs font-extrabold text-white shadow-sm ${
                  actionType === 'ESCALATE' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50`}
              >
                {loading ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
