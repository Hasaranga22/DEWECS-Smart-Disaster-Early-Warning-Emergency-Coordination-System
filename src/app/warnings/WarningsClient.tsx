'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { HazardType, Role } from '@/shared/domain';
import { DISTRICTS, KELANI_BASIN_ID, RIVER_BASINS } from '@/shared/seed';

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
      <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Hazard Warnings & Bulletins
          </h1>
          <p className="text-sm text-slate-600">
            DMC Location-Specific Multi-Channel Early Warning System (UC1)
          </p>
        </div>

        <div className="flex rounded-lg border bg-white p-1 text-sm shadow-sm">
          {isDmcOfficial && (
            <button
              onClick={() => setActiveTab('composer')}
              className={`rounded px-4 py-1.5 font-medium transition ${
                activeTab === 'composer'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Issue Warning
            </button>
          )}
          <button
            onClick={() => setActiveTab('active')}
            className={`rounded px-4 py-1.5 font-medium transition ${
              activeTab === 'active'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active Warnings ({alertsList.length})
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Error</p>
          <p>{errorMsg}</p>
        </div>
      )}

      {/* COMPOSER / PREVIEW / RESULT WORKFLOW */}
      {activeTab === 'composer' && isDmcOfficial && (
        <div className="space-y-6">
          {/* Progress Steps Header */}
          <div className="flex items-center justify-between border-b bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  step === 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                1
              </span>
              <span className={step === 1 ? 'font-bold text-slate-900' : 'text-slate-500'}>
                Composer & Evidence
              </span>
            </div>
            <div className="h-0.5 w-12 bg-slate-200" />
            <div className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                2
              </span>
              <span className={step === 2 ? 'font-bold text-slate-900' : 'text-slate-500'}>
                Preview & Estimates
              </span>
            </div>
            <div className="h-0.5 w-12 bg-slate-200" />
            <div className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  step === 3 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                3
              </span>
              <span className={step === 3 ? 'font-bold text-slate-900' : 'text-slate-500'}>
                Delivery Outcome
              </span>
            </div>
          </div>

          {/* STEP 1: COMPOSER */}
          {step === 1 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Main Composer Form */}
              <div className="space-y-6 rounded-lg border bg-white p-6 shadow-sm lg:col-span-2">
                <h2 className="text-lg font-bold text-slate-900">1. Draft Hazard Warning</h2>

                {/* Hazard Type */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Hazard Type</label>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {HAZARD_TYPES.map((hz) => (
                      <button
                        key={hz}
                        type="button"
                        onClick={() => setHazardType(hz)}
                        className={`rounded-lg border p-3 text-center text-sm font-medium transition ${
                          hazardType === hz
                            ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-600'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {hz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Severity Level */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Severity Level</label>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {SEVERITIES.map((s) => {
                      const colors: Record<Severity, string> = {
                        ADVISORY: 'border-yellow-300 text-yellow-800 bg-yellow-50',
                        WATCH: 'border-orange-300 text-orange-800 bg-orange-50',
                        WARNING: 'border-red-400 text-red-800 bg-red-50',
                        EMERGENCY: 'border-purple-500 text-purple-900 bg-purple-50',
                      };
                      const isSelected = severity === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSeverity(s)}
                          className={`rounded-lg border p-3 text-center text-sm font-bold transition ${
                            isSelected ? `${colors[s]} ring-2 ring-current` : 'border-slate-200 text-slate-700'
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
                    <label className="block text-sm font-semibold text-slate-700">
                      Target Area (Districts or River Basin)
                    </label>
                    <button
                      type="button"
                      onClick={handleKelaniToggle}
                      className={`text-xs font-semibold px-2 py-1 rounded border transition ${
                        useKelaniBasin
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {useKelaniBasin ? '✓ Kelani Basin Selected' : '+ Select Kelani Basin (Col, Gam, Keg)'}
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {DISTRICTS.map((d) => {
                      const checked = selectedDistricts.includes(d.id);
                      return (
                        <label
                          key={d.id}
                          className={`flex items-center gap-2 rounded border p-2.5 text-sm transition cursor-pointer ${
                            checked ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleDistrictToggle(d.id)}
                            className="rounded text-blue-600 focus:ring-blue-500"
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
                    <label className="block text-sm font-semibold text-slate-700">
                      Public Warning Message
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setMessage(
                            `URGENT: Heavy flooding expected along the Kelani river bank. Evacuate low-lying areas immediately and head to designated shelters.`,
                          )
                        }
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Insert Flood Template
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter urgent instructions, affected GN divisions, evacuation routes..."
                    className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Expiry Hours */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Auto-Expiry Duration
                  </label>
                  <select
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(e.target.value)}
                    className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                    className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Analyzing Target Geography...' : 'Preview Recipients & Channels →'}
                  </button>
                </div>
              </div>

              {/* Verified Ground Evidence Panel (Step 9) */}
              <div className="space-y-4 rounded-lg border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-base font-bold text-slate-900">Verified Evidence</h3>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    UC2 Feed
                  </span>
                </div>

                <div className="rounded bg-slate-50 p-2.5 text-xs text-slate-600">
                  <p className="font-semibold text-slate-800">Operational Guideline</p>
                  <p className="mt-0.5">
                    Verified ground reports provide corroborating evidence. Official warnings must be
                    explicitly issued by DMC Officials and are <strong>never auto-issued</strong>.
                  </p>
                </div>

                {loadingEvidence ? (
                  <div className="py-8 text-center text-xs text-slate-500">Loading ground evidence...</div>
                ) : evidenceList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No verified ground reports available for current scope.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {evidenceList.map((ev) => (
                      <div
                        key={ev.reportId}
                        className="rounded-lg border border-slate-200 p-3 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{ev.hazardType}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 font-bold ${
                              ev.severityIndication === 'HIGH'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ev.severityIndication ?? 'VERIFIED'}
                          </span>
                        </div>
                        <p className="text-slate-600">
                          District ID: <span className="font-mono text-slate-900">{ev.districtId}</span>
                        </p>
                        <p className="text-slate-600">
                          Coordinates: {ev.lat.toFixed(4)}, {ev.lng.toFixed(4)}
                        </p>
                        <div className="flex items-center justify-between pt-1 text-slate-500">
                          <span>Corroboration: {ev.corroborationCount} reports</span>
                          <span>Confidence: {ev.confidence}</span>
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
            <div className="space-y-6 rounded-lg border bg-white p-6 shadow-sm">
              <div className="border-b pb-4">
                <h2 className="text-xl font-bold text-slate-900">2. Review Estimated Recipients</h2>
                <p className="text-sm text-slate-600">
                  Pre-dispatch analysis confirming distinct population reach across SMS and Push gateways.
                </p>
              </div>

              {/* Warning Summary Banner */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <span className="text-xs uppercase text-blue-700 font-semibold">Hazard</span>
                    <p className="font-bold">{hazardType}</p>
                  </div>
                  <div>
                    <span className="text-xs uppercase text-blue-700 font-semibold">Severity</span>
                    <p className="font-bold">{severity}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs uppercase text-blue-700 font-semibold">Target Districts</span>
                    <p className="font-bold">{previewData.targetDistrictIds.join(', ')}</p>
                  </div>
                </div>
                <div className="mt-3 border-t border-blue-200 pt-2">
                  <span className="text-xs uppercase text-blue-700 font-semibold">Message Preview</span>
                  <p className="italic mt-1">&ldquo;{message}&rdquo;</p>
                </div>
              </div>

              {/* Key Estimates Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                  <span className="text-xs font-semibold uppercase text-slate-600">
                    Estimated Recipients
                  </span>
                  <p className="mt-1 text-3xl font-extrabold text-blue-700">
                    {previewData.estimatedRecipients}
                  </p>
                  <span className="text-xs text-slate-500">Unique registered citizens</span>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                  <span className="text-xs font-semibold uppercase text-slate-600">
                    SMS Gateway Potential
                  </span>
                  <p className="mt-1 text-3xl font-extrabold text-slate-800">
                    {previewData.byChannel.sms}
                  </p>
                  <span className="text-xs text-slate-500">Citizens with registered phone</span>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                  <span className="text-xs font-semibold uppercase text-slate-600">
                    Mobile Push Potential
                  </span>
                  <p className="mt-1 text-3xl font-extrabold text-slate-800">
                    {previewData.byChannel.push}
                  </p>
                  <span className="text-xs text-slate-500">Citizens with active app tokens</span>
                </div>
              </div>

              {/* Zero Recipients Exception Warning (W06) */}
              {previewData.estimatedRecipients === 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-bold">Zero Recipients Warning</p>
                  <p className="mt-1">
                    No citizens were found residing in the selected target area. To dispatch this warning
                    anyway, explicit confirmation is required.
                  </p>
                  <label className="mt-3 flex items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      checked={confirmZero}
                      onChange={(e) => setConfirmZero(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <span>Confirm issuing warning with zero registered citizens</span>
                  </label>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ← Back to Edit
                </button>

                <button
                  type="button"
                  onClick={handleIssue}
                  disabled={loading || (previewData.estimatedRecipients === 0 && !confirmZero)}
                  className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Dispatching Warning...' : 'CONFIRM & ISSUE HAZARD ALERT 🚨'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: RESULT */}
          {step === 3 && dispatchResult && (
            <div className="space-y-6 rounded-lg border bg-white p-6 shadow-sm">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <h2 className="text-xl font-bold">Alert Dispatched Successfully</h2>
                <p className="mt-1 text-sm">
                  Active alert registered (ID:{' '}
                  <span className="font-mono font-semibold">{dispatchResult.alert.id}</span>).
                  Saved to database first before dispatch.
                </p>
              </div>

              {/* Outcomes Breakdown */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border bg-slate-50 p-4 text-center">
                  <span className="text-xs font-semibold uppercase text-slate-600">
                    Distinct Citizens Reached
                  </span>
                  <p className="mt-1 text-3xl font-extrabold text-emerald-600">
                    {dispatchResult.distinctCitizensReached}
                  </p>
                  <span className="text-xs text-slate-500">Confirmed delivered to ≥1 channel</span>
                </div>

                <div className="rounded-lg border bg-slate-50 p-4 text-center">
                  <span className="text-xs font-semibold uppercase text-slate-600">
                    SMS Deliveries
                  </span>
                  <p className="mt-1 text-2xl font-bold text-slate-800">
                    {dispatchResult.channelSummary.sms.delivered} /{' '}
                    {dispatchResult.channelSummary.sms.sent}
                  </p>
                  {dispatchResult.channelSummary.sms.failed > 0 && (
                    <span className="text-xs font-semibold text-red-600">
                      {dispatchResult.channelSummary.sms.failed} failed
                    </span>
                  )}
                </div>

                <div className="rounded-lg border bg-slate-50 p-4 text-center">
                  <span className="text-xs font-semibold uppercase text-slate-600">
                    Push Deliveries
                  </span>
                  <p className="mt-1 text-2xl font-bold text-slate-800">
                    {dispatchResult.channelSummary.push.delivered} /{' '}
                    {dispatchResult.channelSummary.push.sent}
                  </p>
                  {dispatchResult.channelSummary.push.failed > 0 && (
                    <span className="text-xs font-semibold text-red-600">
                      {dispatchResult.channelSummary.push.failed} failed
                    </span>
                  )}
                </div>
              </div>

              {/* Attempts Table */}
              {dispatchResult.attempts && dispatchResult.attempts.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-2">Notification Attempts Log</h3>
                  <div className="overflow-x-auto rounded border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="p-2">Citizen ID</th>
                          <th className="p-2">Channel</th>
                          <th className="p-2">Kind</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Note / Failure</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {dispatchResult.attempts.map((att) => (
                          <tr key={att.id} className="hover:bg-slate-50">
                            <td className="p-2 font-mono">{att.citizenId}</td>
                            <td className="p-2">{att.channel}</td>
                            <td className="p-2">{att.kind}</td>
                            <td className="p-2">
                              <span
                                className={`rounded px-1.5 py-0.5 font-bold ${
                                  att.status === 'DELIVERED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : att.status === 'FAILED'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                {att.status}
                              </span>
                            </td>
                            <td className="p-2 text-slate-500">{att.failureReason ?? '–'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t">
                <div className="flex gap-2">
                  {(dispatchResult.channelSummary.sms.failed > 0 ||
                    dispatchResult.channelSummary.push.failed > 0) && (
                    <button
                      type="button"
                      onClick={() => handleRetry(dispatchResult.alert.id)}
                      disabled={loading}
                      className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {loading ? 'Retrying...' : 'Retry Failed Attempts'}
                    </button>
                  )}
                  <Link
                    href={`/alerts/${dispatchResult.alert.id}`}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
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
        <div className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Current Hazard Alerts</h2>
              <p className="text-sm text-slate-600">
                Active early warnings with escalation history and cancellation records.
              </p>
            </div>
            <button
              onClick={fetchAlerts}
              disabled={loadingAlerts}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              {loadingAlerts ? 'Refreshing...' : '↻ Refresh List'}
            </button>
          </div>

          {alertsList.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
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
                    className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{alert.hazardType}</span>
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-bold ${
                            alert.severity === 'EMERGENCY'
                              ? 'bg-purple-100 text-purple-900'
                              : alert.severity === 'WARNING'
                              ? 'bg-red-100 text-red-800'
                              : alert.severity === 'WATCH'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {alert.severity}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${
                            alert.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : alert.status === 'ESCALATED'
                              ? 'bg-blue-100 text-blue-800'
                              : alert.status === 'CANCELLED'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-zinc-200 text-zinc-600'
                          }`}
                        >
                          {alert.status}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        Occurred: {new Date(alert.occurredAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-sm text-slate-800 font-medium">{alert.message}</p>

                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 border-t pt-2">
                      <div>
                        Target Area:{' '}
                        <span className="font-semibold text-slate-700">
                          {alert.target.districtIds?.join(', ') || alert.target.basinId || 'Sri Lanka'}
                        </span>
                      </div>
                      {alert.expiresAt && (
                        <div>
                          Expires: {new Date(alert.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>

                    {alert.cancellationReason && (
                      <div className="rounded bg-slate-100 p-2 text-xs text-slate-700">
                        <span className="font-semibold">Cancelled Reason:</span> {alert.cancellationReason}
                      </div>
                    )}

                    {alert.escalations && alert.escalations.length > 0 && (
                      <div className="rounded bg-blue-50 p-2 text-xs text-blue-900 space-y-1">
                        <span className="font-bold">Escalation History:</span>
                        {alert.escalations.map((esc) => (
                          <div key={esc.id} className="pl-2 border-l border-blue-300">
                            {esc.fromSeverity} → {esc.toSeverity} (
                            {new Date(esc.occurredAt).toLocaleTimeString()})
                            {esc.reason ? ` – ${esc.reason}` : ''}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Operational Action Buttons (DMC Official) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                      <Link
                        href={`/alerts/${alert.id}`}
                        className="text-xs font-semibold text-blue-600 hover:underline"
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
                              // set default next severity
                              if (alert.severity === 'ADVISORY') setNewSeverity('WATCH');
                              else if (alert.severity === 'WATCH') setNewSeverity('WARNING');
                              else setNewSeverity('EMERGENCY');
                            }}
                            className="rounded border border-purple-300 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-800 transition hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed"
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
                            className="rounded border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {actionType === 'ESCALATE' ? 'Escalate Alert Severity' : 'Cancel Hazard Alert'}
            </h3>
            <p className="text-xs text-slate-600">
              Alert: <span className="font-semibold">{selectedAlertForAction.hazardType}</span> (Current:{' '}
              <span className="font-bold">{selectedAlertForAction.severity}</span>)
            </p>

            {actionError && (
              <div className="rounded bg-red-50 p-2 text-xs text-red-800">{actionError}</div>
            )}

            {actionType === 'ESCALATE' && (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Target Severity Level
                  </label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as Severity)}
                    className="mt-1 w-full rounded border p-2 text-sm"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Escalation Reason
                  </label>
                  <input
                    type="text"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="e.g. River level reached critical threshold"
                    className="mt-1 w-full rounded border p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Widen Target Districts (Optional)
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-1 text-xs">
                    {DISTRICTS.map((d) => (
                      <label key={d.id} className="flex items-center gap-1">
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
                  <label className="block text-xs font-semibold text-slate-700">
                    Cancellation Reason (Required)
                  </label>
                  <textarea
                    rows={3}
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="e.g. Danger has passed, flood levels receded safely"
                    className="mt-1 w-full rounded border p-2 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => {
                  setSelectedAlertForAction(null);
                  setActionType(null);
                }}
                className="rounded border px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeAlertAction}
                disabled={loading}
                className={`rounded px-4 py-1.5 text-xs font-bold text-white ${
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
