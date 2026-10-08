'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DISTRICTS, RIVER_BASINS } from '@/shared/seed';
import type { Role } from '@/shared/domain';

interface VerifiedEvidence {
  reportId: string;
  hazardType: string;
  districtId: string;
  lat: number;
  lng: number;
  severityIndication?: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: 'FULL' | 'REDUCED';
  corroborationCount: number;
  decidedAt: string;
  occurredAt: string;
}

interface AlertItem {
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
    byOfficerId: string;
    reason?: string;
  }>;
  attemptsCount?: number;
  deliveredCount?: number;
  failedCount?: number;
  distinctCitizensReached?: number;
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

interface IssueResultData {
  alert: {
    id: string;
    hazardType: string;
    severity: string;
    status: string;
    message: string;
    target: { districtIds?: string[]; basinId?: string };
    occurredAt: string;
    expiresAt: string | null;
  };
  distinctCitizensReached: number;
  totalAttempts: number;
  channelSummary: {
    sms: { sent: number; delivered: number; failed: number };
    push: { sent: number; delivered: number; failed: number };
  };
}

export function WarningsClient({ currentRole }: { currentRole: Role }) {
  const isDmcOfficial = currentRole === 'DMC_OFFICIAL';
  const canViewAlerts = ['DMC_OFFICIAL', 'DUTY_OFFICER', 'DISTRICT_OFFICER'].includes(currentRole);

  const [activeTab, setActiveTab] = useState<'compose' | 'list'>('compose');

  // Form state
  const [hazardType, setHazardType] = useState<'FLOOD' | 'LANDSLIDE' | 'CYCLONE' | 'DROUGHT'>('FLOOD');
  const [severity, setSeverity] = useState<'ADVISORY' | 'WATCH' | 'WARNING' | 'EMERGENCY'>('WARNING');
  const [message, setMessage] = useState('');
  const [targetMode, setTargetMode] = useState<'districts' | 'basin'>('districts');
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([DISTRICTS[0].id]);
  const [selectedBasin, setSelectedBasin] = useState<string>(RIVER_BASINS[0]?.id ?? '');
  const [expiresInHours, setExpiresInHours] = useState<number>(6);

  // Evidence panel state
  const [evidenceList, setEvidenceList] = useState<VerifiedEvidence[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  // Preview / Issue flow state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [confirmZero, setConfirmZero] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueResult, setIssueResult] = useState<IssueResultData | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);

  // Active alerts list state
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [listFilterHazard, setListFilterHazard] = useState<string>('ALL');

  // Escalation / Cancellation modal state
  const [selectedAlertForAction, setSelectedAlertForAction] = useState<AlertItem | null>(null);
  const [actionType, setActionType] = useState<'escalate' | 'cancel' | null>(null);
  const [escalateSeverity, setEscalateSeverity] = useState<'WATCH' | 'WARNING' | 'EMERGENCY'>('EMERGENCY');
  const [actionReason, setActionReason] = useState('');
  const [widenDistrictIds, setWidenDistrictIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retryAlertId, setRetryAlertId] = useState<string | null>(null);
  const [retryLoading, setRetryLoading] = useState(false);

  // Fetch verified reports for evidence panel
  useEffect(() => {
    if (!canViewAlerts) return;
    let active = true;
    fetch('/api/warnings/evidence')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (active) {
          setEvidenceList(data);
          setEvidenceLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setEvidenceList([]);
          setEvidenceLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [canViewAlerts]);

  // Fetch alerts list
  const loadAlerts = () => {
    if (!canViewAlerts) return;
    setAlertsLoading(true);
    fetch('/api/warnings')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAlerts(data))
      .catch(() => setAlerts([]))
      .finally(() => setAlertsLoading(false));
  };

  useEffect(() => {
    if (!canViewAlerts) return;
    let active = true;
    fetch('/api/warnings')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (active) {
          setAlerts(data);
          setAlertsLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setAlerts([]);
          setAlertsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [canViewAlerts]);

  const toggleDistrict = (id: string) => {
    setSelectedDistricts((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  const getTargetPayload = () => {
    if (targetMode === 'basin') {
      return { basinId: selectedBasin };
    }
    return { districtIds: selectedDistricts };
  };

  // Preview warning
  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssueError(null);
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/warnings/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: getTargetPayload() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate preview');
      }
      setPreviewData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate preview';
      setIssueError(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Confirm and issue warning
  const handleIssue = async () => {
    setIssueError(null);
    setIssueLoading(true);
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);

      const res = await fetch('/api/warnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hazardType,
          severity,
          message,
          target: getTargetPayload(),
          confirmZeroRecipients: confirmZero,
          expiresAt: expiresAt.toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to issue warning');
      }
      setIssueResult(data);
      setPreviewData(null);
      loadAlerts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to issue warning';
      setIssueError(msg);
    } finally {
      setIssueLoading(false);
    }
  };

  // Escalate alert
  const handleEscalateSubmit = async () => {
    if (!selectedAlertForAction) return;
    setActionError(null);
    setActionLoading(true);
    try {
      const res = await fetch(`/api/warnings/${selectedAlertForAction.id}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newSeverity: escalateSeverity,
          reason: actionReason,
          expandDistrictIds: widenDistrictIds.length > 0 ? widenDistrictIds : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to escalate alert');
      }
      setActionType(null);
      setSelectedAlertForAction(null);
      loadAlerts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to escalate alert';
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel alert
  const handleCancelSubmit = async () => {
    if (!selectedAlertForAction) return;
    setActionError(null);
    setActionLoading(true);
    try {
      const res = await fetch(`/api/warnings/${selectedAlertForAction.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: actionReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel alert');
      }
      setActionType(null);
      setSelectedAlertForAction(null);
      loadAlerts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel alert';
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Retry failed attempts
  const handleRetryFailed = async (alertId: string) => {
    setRetryAlertId(alertId);
    setRetryLoading(true);
    try {
      const res = await fetch(`/api/warnings/${alertId}/retry`, {
        method: 'POST',
      });
      if (res.ok) {
        loadAlerts();
      }
    } finally {
      setRetryLoading(false);
      setRetryAlertId(null);
    }
  };

  const getDistrictName = (id: string) =>
    DISTRICTS.find((d) => d.id === id)?.name || id;

  const getSeverityBadgeClass = (s: string) => {
    switch (s) {
      case 'EMERGENCY':
        return 'bg-red-600 text-white font-bold';
      case 'WARNING':
        return 'bg-amber-500 text-white font-semibold';
      case 'WATCH':
        return 'bg-yellow-400 text-gray-900 font-medium';
      case 'ADVISORY':
      default:
        return 'bg-blue-100 text-blue-800 border border-blue-300';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
      case 'ESCALATED':
        return 'bg-purple-100 text-purple-800 border border-purple-300';
      case 'CANCELLED':
        return 'bg-gray-200 text-gray-700';
      case 'EXPIRED':
        return 'bg-slate-200 text-slate-600 line-through';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredAlerts = alerts.filter(
    (a) => listFilterHazard === 'ALL' || a.hazardType === listFilterHazard,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            UC1: Hazard Warning Management
          </h1>
          <p className="text-sm text-gray-600">
            Issue, preview, escalate, cancel and track location-specific hazard early warnings for Sri Lanka.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2">
          {isDmcOfficial && (
            <button
              onClick={() => setActiveTab('compose')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                activeTab === 'compose'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Compose Warning
            </button>
          )}
          <button
            onClick={() => setActiveTab('list')}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === 'list'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Active Warnings ({alerts.length})
          </button>
        </div>
      </div>

      {/* Role Notice if not DMC Official */}
      {!isDmcOfficial && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Notice for Role: {currentRole}</div>
          <p className="mt-1">
            Only <strong>DMC Official</strong> is authorized to compose, issue, escalate, cancel, or retry warnings.
            {canViewAlerts ? (
              <span> You have read-only access to view active warnings below.</span>
            ) : (
              <span> Please switch to DMC Official in the top bar to test warning management.</span>
            )}
          </p>
        </div>
      )}

      {/* TAB 1: COMPOSER & PREVIEW (DMC Official) */}
      {isDmcOfficial && activeTab === 'compose' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Composer Form (2 cols) */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                1. Issue Location-Specific Hazard Warning
              </h2>
              <p className="text-sm text-gray-500">
                Specify hazard characteristics, target area, and advisory instructions.
              </p>

              {issueError && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {issueError}
                </div>
              )}

              <form onSubmit={handlePreview} className="mt-6 space-y-5">
                {/* Hazard Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Hazard Type</label>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {(['FLOOD', 'LANDSLIDE', 'CYCLONE', 'DROUGHT'] as const).map((type) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => setHazardType(type)}
                        className={`rounded-lg border p-3 text-center text-sm font-semibold transition ${
                          hazardType === type
                            ? 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-500'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Geography */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Target Geography</label>
                  <div className="mt-2 flex gap-4 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={targetMode === 'districts'}
                        onChange={() => setTargetMode('districts')}
                      />
                      <span>Specific Districts</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={targetMode === 'basin'}
                        onChange={() => setTargetMode('basin')}
                      />
                      <span>River Basin (Kelani)</span>
                    </label>
                  </div>

                  {targetMode === 'districts' ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {DISTRICTS.map((d) => (
                        <label
                          key={d.id}
                          className={`flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer transition ${
                            selectedDistricts.includes(d.id)
                              ? 'border-blue-500 bg-blue-50 font-medium text-blue-900'
                              : 'border-gray-200 bg-white text-gray-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedDistricts.includes(d.id)}
                            onChange={() => toggleDistrict(d.id)}
                          />
                          <span>{d.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3">
                      <select
                        value={selectedBasin}
                        onChange={(e) => setSelectedBasin(e.target.value)}
                        className="w-full rounded-md border border-gray-300 p-2 text-sm"
                      >
                        {RIVER_BASINS.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.description})
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Kelani River Basin automatically resolves citizens in Colombo, Gampaha, and Kegalle.
                      </p>
                    </div>
                  )}
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Severity Level</label>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {(['ADVISORY', 'WATCH', 'WARNING', 'EMERGENCY'] as const).map((sev) => (
                      <button
                        type="button"
                        key={sev}
                        onClick={() => setSeverity(sev)}
                        className={`rounded-lg border p-3 text-center text-sm font-semibold transition ${
                          severity === sev
                            ? 'border-red-600 bg-red-50 text-red-900 ring-2 ring-red-500'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Warning Message</label>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="E.g., Rising water levels in Kelani River basin. Residents in low-lying areas are advised to evacuate immediately to designated safe shelters."
                    className="mt-1 w-full rounded-md border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>

                {/* Expiry Hours */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Auto-Expiry Duration (Hours)
                  </label>
                  <select
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(Number(e.target.value))}
                    className="mt-1 w-48 rounded-md border border-gray-300 p-2 text-sm"
                  >
                    <option value={2}>2 Hours</option>
                    <option value={6}>6 Hours</option>
                    <option value={12}>12 Hours</option>
                    <option value={24}>24 Hours</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={previewLoading || message.trim().length === 0}
                    className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
                  >
                    {previewLoading ? 'Resolving Recipients...' : 'Preview Estimated Recipients →'}
                  </button>
                </div>
              </form>
            </div>

            {/* PREVIEW MODAL / SECTION */}
            {previewData && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-blue-200 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      2. Warning Preview & Dispatch Summary
                    </h3>
                    <p className="text-sm text-gray-600">
                      Calculated reach before dispatch (Rule: Distinct unique citizens).
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-200 px-3 py-1 text-xs font-semibold text-blue-900">
                    Estimated Recipients: {previewData.estimatedRecipients}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 text-center">
                  <div className="rounded-lg bg-white p-3 shadow-sm border border-gray-100">
                    <div className="text-2xl font-bold text-blue-600">
                      {previewData.estimatedRecipients}
                    </div>
                    <div className="text-xs font-medium text-gray-500">Unique Citizens</div>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm border border-gray-100">
                    <div className="text-2xl font-bold text-emerald-600">
                      {previewData.byChannel.push}
                    </div>
                    <div className="text-xs font-medium text-gray-500">Push App Reach</div>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm border border-gray-100">
                    <div className="text-2xl font-bold text-amber-600">
                      {previewData.byChannel.sms}
                    </div>
                    <div className="text-xs font-medium text-gray-500">SMS Reach</div>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm border border-gray-100">
                    <div className="text-2xl font-bold text-purple-600">
                      {previewData.byChannel.both}
                    </div>
                    <div className="text-xs font-medium text-gray-500">Dual Channel</div>
                  </div>
                </div>

                {/* District Breakdown */}
                <div className="mt-4 rounded-lg bg-white p-3 border border-gray-200">
                  <h4 className="text-xs font-semibold uppercase text-gray-500">
                    Distribution Across Target Districts
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(previewData.byDistrict).map(([dId, count]) => (
                      <span
                        key={dId}
                        className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
                      >
                        {getDistrictName(dId)}: <strong>{count} citizens</strong>
                      </span>
                    ))}
                    {Object.keys(previewData.byDistrict).length === 0 && (
                      <span className="text-xs text-gray-500">No citizens in target area.</span>
                    )}
                  </div>
                </div>

                {/* Zero Recipients Confirmation (Rule W06) */}
                {previewData.estimatedRecipients === 0 && (
                  <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <label className="flex items-center gap-2 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmZero}
                        onChange={(e) => setConfirmZero(e.target.checked)}
                      />
                      <span>
                        Target area contains 0 citizens. Check this box to confirm issuing with zero recipients (W06).
                      </span>
                    </label>
                  </div>
                )}

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setPreviewData(null)}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Back to Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleIssue}
                    disabled={
                      issueLoading ||
                      (previewData.estimatedRecipients === 0 && !confirmZero)
                    }
                    className="rounded-lg bg-red-600 px-6 py-2 text-sm font-bold text-white shadow hover:bg-red-700 disabled:opacity-50"
                  >
                    {issueLoading ? 'Issuing Warning...' : 'Confirm & Issue Warning Now'}
                  </button>
                </div>
              </div>
            )}

            {/* ISSUE RESULT PANEL */}
            {issueResult && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-emerald-900">
                      3. Warning Issued Successfully!
                    </h3>
                    <p className="text-xs text-emerald-700">
                      Alert ID: <code>{issueResult.alert.id}</code> · Status: <strong>{issueResult.alert.status}</strong>
                    </p>
                  </div>
                  <Link
                    href={`/alerts/${issueResult.alert.id}`}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    View Citizen Receipt View →
                  </Link>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-white p-3 border border-emerald-200">
                    <div className="text-xl font-bold text-emerald-800">
                      {issueResult.distinctCitizensReached}
                    </div>
                    <div className="text-xs text-gray-600">Distinct Citizens Reached</div>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-emerald-200">
                    <div className="text-xl font-bold text-gray-800">
                      {issueResult.channelSummary.push.delivered} / {issueResult.channelSummary.push.sent}
                    </div>
                    <div className="text-xs text-gray-600">Push Delivered / Sent</div>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-emerald-200">
                    <div className="text-xl font-bold text-gray-800">
                      {issueResult.channelSummary.sms.delivered} / {issueResult.channelSummary.sms.sent}
                    </div>
                    <div className="text-xs text-gray-600">SMS Delivered / Sent</div>
                  </div>
                </div>

                {(issueResult.channelSummary.sms.failed > 0 ||
                  issueResult.channelSummary.push.failed > 0) && (
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-white p-3 border border-amber-300">
                    <div className="text-xs text-amber-900">
                      Some channel attempts failed (SMS failures: {issueResult.channelSummary.sms.failed}, Push failures: {issueResult.channelSummary.push.failed}).
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRetryFailed(issueResult.alert.id)}
                      disabled={retryLoading}
                      className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                      {retryLoading ? 'Retrying...' : 'Retry Failed Attempts'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Evidence Panel (Read-only verified reports from UC2) */}
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-semibold text-gray-900">Verified Evidence Panel</h3>
                <span className="text-xs font-medium text-gray-500">Read-Only</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Ground reports verified by Duty Officers. Displays corroboration and severity indication.
                <em> Note: System will NEVER auto-issue warnings from reports.</em>
              </p>

              {evidenceLoading && (
                <div className="py-8 text-center text-xs text-gray-400">Loading verified evidence...</div>
              )}

              {!evidenceLoading && evidenceList.length === 0 && (
                <div className="py-8 text-center text-xs text-gray-400">No verified ground reports available.</div>
              )}

              <div className="mt-4 space-y-3">
                {evidenceList.map((ev) => (
                  <div
                    key={ev.reportId}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-800">{ev.hazardType}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          ev.severityIndication === 'HIGH'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {ev.severityIndication ?? 'MEDIUM'} SEVERITY
                      </span>
                    </div>
                    <div className="text-gray-600">
                      District: <strong>{getDistrictName(ev.districtId)}</strong>
                    </div>
                    <div className="text-gray-500">
                      Corroborations: <strong>{ev.corroborationCount}</strong> · Confidence: <strong>{ev.confidence}</strong>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      Decided: {new Date(ev.decidedAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE WARNINGS LIST & ESCALATE/CANCEL ACTIONS */}
      {canViewAlerts && activeTab === 'list' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Filter Hazard:</span>
              {(['ALL', 'FLOOD', 'LANDSLIDE', 'CYCLONE', 'DROUGHT'] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => setListFilterHazard(h)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    listFilterHazard === h
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
            <button
              onClick={loadAlerts}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              ↻ Refresh Alerts
            </button>
          </div>

          {alertsLoading && (
            <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
              Loading active alerts...
            </div>
          )}

          {!alertsLoading && filteredAlerts.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
              No warnings found.
            </div>
          )}

          {/* Alerts Cards */}
          <div className="space-y-4">
            {filteredAlerts.map((alert) => {
              const isClosed = alert.status === 'CANCELLED' || alert.status === 'EXPIRED';
              const isEmergency = alert.severity === 'EMERGENCY';

              return (
                <div
                  key={alert.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md px-2.5 py-1 text-xs ${getSeverityBadgeClass(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <span className="text-sm font-bold text-gray-900">{alert.hazardType}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(alert.status)}`}>
                        {alert.status}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500">
                      Occurred: {new Date(alert.occurredAt).toLocaleString()}
                      {alert.expiresAt && ` · Expires: ${new Date(alert.expiresAt).toLocaleTimeString()}`}
                    </div>
                  </div>

                  <div className="text-sm text-gray-800">{alert.message}</div>

                  {/* Target info */}
                  <div className="text-xs text-gray-600">
                    <strong>Target:</strong>{' '}
                    {alert.target.basinId
                      ? `Kelani Basin (${RIVER_BASINS.find((b) => b.id === alert.target.basinId)?.name})`
                      : alert.target.districtIds?.map(getDistrictName).join(', ') ?? 'N/A'}
                  </div>

                  {/* Escalation history if present */}
                  {alert.escalations && alert.escalations.length > 0 && (
                    <div className="rounded-md bg-purple-50 p-2.5 text-xs text-purple-900">
                      <strong>Escalation History:</strong>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5">
                        {alert.escalations.map((esc) => (
                          <li key={esc.id}>
                            {esc.fromSeverity} → <strong>{esc.toSeverity}</strong> at{' '}
                            {new Date(esc.occurredAt).toLocaleTimeString()}
                            {esc.reason ? ` (${esc.reason})` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Cancellation info if cancelled */}
                  {alert.status === 'CANCELLED' && (
                    <div className="rounded-md bg-gray-100 p-2.5 text-xs text-gray-700">
                      <strong>Cancelled at:</strong>{' '}
                      {alert.cancelledAt ? new Date(alert.cancelledAt).toLocaleString() : ''}
                      <br />
                      <strong>Reason:</strong> {alert.cancellationReason}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>Delivered: <strong>{alert.deliveredCount ?? 0}</strong></span>
                      <span>Failed: <strong>{alert.failedCount ?? 0}</strong></span>
                      <span>Distinct Citizens: <strong>{alert.distinctCitizensReached ?? 0}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/alerts/${alert.id}`}
                        className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Citizen Receipt View
                      </Link>

                      {isDmcOfficial && (
                        <>
                          {/* Retry Failed */}
                          {(alert.failedCount ?? 0) > 0 && !isClosed && (
                            <button
                              type="button"
                              onClick={() => handleRetryFailed(alert.id)}
                              disabled={retryLoading && retryAlertId === alert.id}
                              className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                              {retryLoading && retryAlertId === alert.id ? 'Retrying...' : 'Retry Failed'}
                            </button>
                          )}

                          {/* Escalate button */}
                          <button
                            type="button"
                            disabled={isClosed || isEmergency}
                            title={
                              isClosed
                                ? 'Cannot escalate closed alert'
                                : isEmergency
                                  ? 'Alert is already at maximum severity (EMERGENCY)'
                                  : 'Escalate severity to next level'
                            }
                            onClick={() => {
                              setSelectedAlertForAction(alert);
                              setActionType('escalate');
                              setActionReason('');
                              setWidenDistrictIds([]);
                              setEscalateSeverity(
                                alert.severity === 'ADVISORY'
                                  ? 'WATCH'
                                  : alert.severity === 'WATCH'
                                    ? 'WARNING'
                                    : 'EMERGENCY',
                              );
                            }}
                            className={`rounded px-3 py-1 text-xs font-semibold transition ${
                              isClosed || isEmergency
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-purple-600 text-white hover:bg-purple-700'
                            }`}
                          >
                            {isEmergency ? 'At Max Severity' : isClosed ? 'Closed' : 'Escalate Alert'}
                          </button>

                          {/* Cancel button */}
                          <button
                            type="button"
                            disabled={isClosed}
                            title={isClosed ? 'Alert is already closed' : 'Cancel this active alert'}
                            onClick={() => {
                              setSelectedAlertForAction(alert);
                              setActionType('cancel');
                              setActionReason('');
                            }}
                            className={`rounded px-3 py-1 text-xs font-semibold transition ${
                              isClosed
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-red-100 text-red-800 hover:bg-red-200 border border-red-300'
                            }`}
                          >
                            {isClosed ? 'Closed' : 'Cancel Alert'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ACTION MODAL: ESCALATE OR CANCEL */}
      {selectedAlertForAction && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              {actionType === 'escalate' ? 'Escalate Alert Severity' : 'Cancel Hazard Alert'}
            </h3>

            {actionError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {actionError}
              </div>
            )}

            <div className="text-xs text-gray-600">
              Alert: <strong>{selectedAlertForAction.hazardType}</strong> (Current:{' '}
              <strong>{selectedAlertForAction.severity}</strong>)
            </div>

            {actionType === 'escalate' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    New Severity Level (Must strictly increase)
                  </label>
                  <select
                    value={escalateSeverity}
                    onChange={(e) =>
                      setEscalateSeverity(
                        e.target.value as 'WATCH' | 'WARNING' | 'EMERGENCY',
                      )
                    }
                    className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
                  >
                    {['WATCH', 'WARNING', 'EMERGENCY'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Target Widening (Optional: Select additional districts)
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {DISTRICTS.map((d) => (
                      <label key={d.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={widenDistrictIds.includes(d.id)}
                          onChange={() =>
                            setWidenDistrictIds((prev) =>
                              prev.includes(d.id)
                                ? prev.filter((id) => id !== d.id)
                                : [...prev, d.id],
                            )
                          }
                        />
                        <span>{d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700">
                Reason for {actionType === 'escalate' ? 'Escalation' : 'Cancellation'}
              </label>
              <textarea
                rows={3}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="State the official reason..."
                className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => {
                  setSelectedAlertForAction(null);
                  setActionType(null);
                }}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                disabled={actionLoading || actionReason.trim().length === 0}
                onClick={actionType === 'escalate' ? handleEscalateSubmit : handleCancelSubmit}
                className={`rounded px-4 py-2 text-xs font-bold text-white shadow ${
                  actionType === 'escalate' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50`}
              >
                {actionLoading ? 'Processing...' : `Confirm ${actionType === 'escalate' ? 'Escalation' : 'Cancellation'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
