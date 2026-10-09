'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { HazardType, Role } from '@/shared/domain';
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
    title?: string | null;
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
  const [customTitle, setCustomTitle] = useState('');
  const [hazardType, setHazardType] = useState<HazardType>('FLOOD');
  const [severity, setSeverity] = useState<Severity>('WARNING');
  const [message, setMessage] = useState('');
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [selectedBasinIds, setSelectedBasinIds] = useState<string[]>([]);
  const [districtSearch, setDistrictSearch] = useState('');
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

  function toggleBasin(basinId: string) {
    const isSelected = selectedBasinIds.includes(basinId);
    const basin = RIVER_BASINS.find((b) => b.id === basinId);
    if (!basin) return;

    if (!isSelected) {
      const nextBasins = [...selectedBasinIds, basinId];
      setSelectedBasinIds(nextBasins);
      const nextDistricts = Array.from(new Set([...selectedDistricts, ...basin.districtIds]));
      setSelectedDistricts(nextDistricts);
    } else {
      const nextBasins = selectedBasinIds.filter((id) => id !== basinId);
      setSelectedBasinIds(nextBasins);
      const remainingBasinsDistricts = new Set(
        RIVER_BASINS.filter((b) => nextBasins.includes(b.id)).flatMap((b) => b.districtIds),
      );
      const nextDistricts = selectedDistricts.filter((dId) => {
        if (basin.districtIds.includes(dId) && !remainingBasinsDistricts.has(dId)) {
          return false;
        }
        return true;
      });
      setSelectedDistricts(nextDistricts);
    }
  }

  function handleRemoveDistrict(districtId: string) {
    setSelectedDistricts(selectedDistricts.filter((d) => d !== districtId));
  }

  function handleClearAllDistricts() {
    setSelectedDistricts([]);
    setSelectedBasinIds([]);
  }

  function getEffectiveTarget(): { districtIds?: string[]; basinId?: string } {
    if (selectedBasinIds.length === 1) {
      const singleBasin = RIVER_BASINS.find((b) => b.id === selectedBasinIds[0]);
      if (singleBasin) {
        const basinDistrictsSorted = [...singleBasin.districtIds].sort();
        const selectedDistrictsSorted = [...selectedDistricts].sort();
        const isExactMatch =
          basinDistrictsSorted.length === selectedDistrictsSorted.length &&
          basinDistrictsSorted.every((dId, idx) => dId === selectedDistrictsSorted[idx]);
        if (isExactMatch) {
          return { basinId: singleBasin.id };
        }
      }
    }
    return {
      districtIds: selectedDistricts.length > 0 ? selectedDistricts : undefined,
    };
  }

  async function handlePreview() {
    setErrorMsg(null);
    const targetPayload = getEffectiveTarget();
    if (!targetPayload.basinId && (!targetPayload.districtIds || targetPayload.districtIds.length === 0)) {
      setErrorMsg('Please select at least one target district or River Basin.');
      return;
    }
    if (!message.trim()) {
      setErrorMsg('Please enter a warning message.');
      return;
    }

    setLoading(true);
    try {
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

      const targetPayload = getEffectiveTarget();
      const payload = {
        title: customTitle.trim() ? customTitle.trim() : undefined,
        hazardType,
        severity,
        message,
        target: targetPayload,
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

  const activeCount = alertsList.filter((a) => a.status === 'ACTIVE').length;
  const escalatedCount = alertsList.filter((a) => a.status === 'ESCALATED').length;
  const closedCount = alertsList.filter((a) => a.status === 'CANCELLED' || a.status === 'EXPIRED').length;
  const citizensReachedInLast = dispatchResult
    ? dispatchResult.distinctCitizensReached
    : alertsList.length > 0
    ? '–'
    : 0;

  return (
    <div className="w-full space-y-6">
      {/* Top Bar Row */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between w-full">
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

      {/* KPI Strip Under Top Bar (4 stat cards full width) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 w-full">
        <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
            <span>Active Warnings</span>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
          </div>
          <p className="mt-2 text-3xl font-black text-slate-900">{activeCount}</p>
          <span className="text-xs text-slate-600 font-medium">Currently active bulletins</span>
        </div>

        <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
            <span>Escalated Warnings</span>
            <span className="h-2.5 w-2.5 rounded-full bg-purple-500 ring-2 ring-purple-200" />
          </div>
          <p className="mt-2 text-3xl font-black text-purple-700">{escalatedCount}</p>
          <span className="text-xs text-slate-600 font-medium">Higher severity level</span>
        </div>

        <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
            <span>Cancelled / Expired</span>
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400 ring-2 ring-slate-200" />
          </div>
          <p className="mt-2 text-3xl font-black text-slate-700">{closedCount}</p>
          <span className="text-xs text-slate-600 font-medium">Resolved warning events</span>
        </div>

        <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
            <span>Citizens Reached (Last)</span>
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-blue-200" />
          </div>
          <p className="mt-2 text-3xl font-black text-blue-700">{citizensReachedInLast}</p>
          <span className="text-xs text-slate-600 font-medium">
            {dispatchResult ? 'Confirmed delivered' : alertsList.length > 0 ? 'Prior alert' : 'No alerts dispatched'}
          </span>
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
        <div className="space-y-6 w-full">
          {/* Progress Steps Header Full Width */}
          <div className="flex items-center justify-between border-2 border-slate-200 bg-white p-4 rounded-xl shadow-sm w-full">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${
                  step === 1 ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-slate-200 text-slate-700'
                }`}
              >
                1
              </span>
              <span className={`text-sm ${step === 1 ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-600'}`}>
                Composer & Evidence
              </span>
            </div>
            <div className="h-0.5 flex-1 mx-4 bg-slate-300 hidden sm:block" />
            <div className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${
                  step === 2 ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-slate-200 text-slate-700'
                }`}
              >
                2
              </span>
              <span className={`text-sm ${step === 2 ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-600'}`}>
                Preview & Estimates
              </span>
            </div>
            <div className="h-0.5 flex-1 mx-4 bg-slate-300 hidden sm:block" />
            <div className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${
                  step === 3 ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-slate-200 text-slate-700'
                }`}
              >
                3
              </span>
              <span className={`text-sm ${step === 3 ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-600'}`}>
                Delivery Outcome
              </span>
            </div>
          </div>

          {/* STEP 1: COMPOSER (12-column grid: 8 cols composer, 4 cols sticky evidence) */}
          {step === 1 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 w-full">
              {/* Main Composer Form (8 cols) */}
              <div className="space-y-6 rounded-xl border-2 border-slate-200 bg-white p-6 shadow-sm lg:col-span-8">
                <h2 className="text-xl font-extrabold text-slate-900">1. Draft Hazard Warning</h2>

                {/* Custom Title (Optional, max 80 chars) */}
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="custom-title-input" className="block text-sm font-bold text-slate-900">
                      Custom Alert Title <span className="text-xs font-normal text-slate-600">(Optional)</span>
                    </label>
                    <span className="text-xs font-mono font-semibold text-slate-500">
                      {customTitle.length}/80
                    </span>
                  </div>
                  <input
                    id="custom-title-input"
                    type="text"
                    maxLength={80}
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. Kelani Ganga Basin Flood Warning & Evacuation Order"
                    className="mt-1.5 w-full rounded-lg border-2 border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 placeholder-slate-400 shadow-xs focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* Hazard Type & Severity side by side in 2 columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Hazard Type */}
                  <div>
                    <label className="block text-sm font-bold text-slate-900">Hazard Type</label>
                    <div className="mt-2 grid grid-cols-2 gap-2.5">
                      {HAZARD_TYPES.map((hz) => (
                        <button
                          key={hz}
                          type="button"
                          onClick={() => setHazardType(hz)}
                          className={`rounded-lg p-3 text-center text-sm font-bold transition shadow-xs cursor-pointer ${
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
                    <div className="mt-2 grid grid-cols-2 gap-2.5">
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
                            className={`rounded-lg p-3 text-center text-sm font-bold transition shadow-xs cursor-pointer ${
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
                </div>

                {/* Target Geography: River Basins multi-select, selected chips, search filter, and district checkboxes */}
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div>
                      <label className="block text-sm font-bold text-slate-900">
                        Target Geography (River Basins &amp; Districts)
                      </label>
                      <p className="text-xs text-slate-600 font-medium">
                        Select one or more river basins to automatically check their covered districts, or pick individual districts.
                      </p>
                    </div>
                    {selectedBasinIds.length > 0 && (
                      <span className="rounded-full bg-blue-100 border border-blue-300 px-2.5 py-0.5 text-xs font-bold text-blue-900">
                        {selectedBasinIds.length} Basin{selectedBasinIds.length > 1 ? 's' : ''} Active
                      </span>
                    )}
                  </div>

                  {/* River Basins multi-select row */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      River Basins ({RIVER_BASINS.length} Total)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {RIVER_BASINS.map((b) => {
                        const isSelected = selectedBasinIds.includes(b.id);
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => toggleBasin(b.id)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer border-2 ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600 text-white ring-2 ring-blue-300'
                                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:border-slate-400'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '}
                            {b.name}
                            <span className={`ml-1 text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                              ({b.districtIds.length})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected districts chips with Clear all button */}
                  {selectedDistricts.length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Selected Districts ({selectedDistricts.length})
                        </span>
                        <button
                          type="button"
                          onClick={handleClearAllDistricts}
                          className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline cursor-pointer"
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {selectedDistricts.map((dId) => (
                          <span
                            key={dId}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-bold text-blue-950"
                          >
                            <span>{getDistrictName(dId)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveDistrict(dId)}
                              className="text-blue-600 hover:text-red-700 font-black ml-1 cursor-pointer"
                              title={`Remove ${getDistrictName(dId)}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search box above district checkboxes */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="district-search-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Filter Districts ({DISTRICTS.length} Total)
                      </label>
                      {districtSearch && (
                        <span className="text-xs text-slate-500 font-medium">
                          Found {DISTRICTS.filter((d) => d.name.toLowerCase().includes(districtSearch.trim().toLowerCase())).length} matches
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="district-search-input"
                        type="text"
                        value={districtSearch}
                        onChange={(e) => setDistrictSearch(e.target.value)}
                        placeholder="Search district by name (e.g., Colombo, Galle, Kandy)..."
                        className="w-full rounded-lg border-2 border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 placeholder-slate-400 shadow-xs focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      {districtSearch && (
                        <button
                          type="button"
                          onClick={() => setDistrictSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Districts Checkboxes */}
                    {DISTRICTS.filter((d) =>
                      d.name.toLowerCase().includes(districtSearch.trim().toLowerCase()),
                    ).length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-white py-6 text-center text-xs font-medium text-slate-600">
                        No districts match &ldquo;{districtSearch}&rdquo;.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-1">
                        {DISTRICTS.filter((d) =>
                          d.name.toLowerCase().includes(districtSearch.trim().toLowerCase()),
                        ).map((d) => {
                          const checked = selectedDistricts.includes(d.id);
                          return (
                            <label
                              key={d.id}
                              className={`flex items-center gap-2 rounded-lg border-2 p-2 text-xs transition cursor-pointer font-semibold ${
                                checked
                                  ? 'border-blue-600 bg-blue-100 text-blue-950 shadow-xs'
                                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-400'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleDistrictToggle(d.id)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <span>{d.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Message and Expiry side by side */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Warning Message (2 columns) */}
                  <div className="md:col-span-2">
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
                        className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
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

                  {/* Expiry Hours (1 column) */}
                  <div className="md:col-span-1 flex flex-col justify-between">
                    <div>
                      <label className="block text-sm font-bold text-slate-900">
                        Auto-Expiry Duration
                      </label>
                      <p className="mt-1 text-xs text-slate-600 font-medium">
                        Active window before auto-transitioning to EXPIRED.
                      </p>
                      <select
                        value={expiresInHours}
                        onChange={(e) => setExpiresInHours(e.target.value)}
                        className="mt-2 w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-xs focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                      >
                        <option value="6">6 Hours</option>
                        <option value="12">12 Hours</option>
                        <option value="24">24 Hours (Standard)</option>
                        <option value="48">48 Hours</option>
                        <option value="none">No auto-expiry</option>
                      </select>
                    </div>
                    <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-700">
                      Standard DMC policy sets active duration to 24h.
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-2 border-t border-slate-200">
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

              {/* Verified Ground Evidence Panel (4 cols, sticky with scroll) */}
              <div className="lg:col-span-4 rounded-xl border-2 border-slate-200 bg-white p-5 shadow-sm space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
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

          {/* STEP 2: PREVIEW (8 cols estimates & breakdown, 4 cols summary & actions) */}
          {step === 2 && previewData && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 w-full">
              {/* Left: 8 cols for recipient estimates and channel breakdown */}
              <div className="lg:col-span-8 space-y-6">
                <div className="border-b border-slate-200 pb-3">
                  <h2 className="text-xl font-extrabold text-slate-900">2. Review Estimated Recipients</h2>
                  <p className="text-sm font-medium text-slate-600">
                    Pre-dispatch analysis confirming distinct population reach across SMS and Push gateways.
                  </p>
                </div>

                {/* Key Estimates Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border-2 border-slate-200 bg-white p-5 text-center shadow-sm">
                    <span className="text-xs font-bold uppercase text-slate-600 tracking-wider">
                      Estimated Recipients
                    </span>
                    <p className="mt-2 text-4xl font-black text-blue-700">
                      {previewData.estimatedRecipients}
                    </p>
                    <span className="mt-1 block text-xs font-semibold text-slate-600">Unique registered citizens</span>
                  </div>

                  <div className="rounded-xl border-2 border-slate-200 bg-white p-5 text-center shadow-sm">
                    <span className="text-xs font-bold uppercase text-slate-600 tracking-wider">
                      SMS Gateway Potential
                    </span>
                    <p className="mt-2 text-4xl font-black text-slate-900">
                      {previewData.byChannel.sms}
                    </p>
                    <span className="mt-1 block text-xs font-semibold text-slate-600">Citizens with registered phone</span>
                  </div>

                  <div className="rounded-xl border-2 border-slate-200 bg-white p-5 text-center shadow-sm">
                    <span className="text-xs font-bold uppercase text-slate-600 tracking-wider">
                      Mobile Push Potential
                    </span>
                    <p className="mt-2 text-4xl font-black text-slate-900">
                      {previewData.byChannel.push}
                    </p>
                    <span className="mt-1 block text-xs font-semibold text-slate-600">Citizens with active app tokens</span>
                  </div>
                </div>

                {/* Gateway Channel Breakdown */}
                <div className="rounded-xl border-2 border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-2">
                    Gateway Delivery Channels
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3.5">
                      <span className="text-xs text-emerald-900 font-bold">Both (SMS + Push)</span>
                      <p className="mt-1 text-2xl font-black text-emerald-800">{previewData.byChannel.both}</p>
                      <span className="text-[11px] text-emerald-700 font-medium">Dual channel delivery</span>
                    </div>
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3.5">
                      <span className="text-xs text-blue-900 font-bold">SMS Only</span>
                      <p className="mt-1 text-2xl font-black text-blue-800">{previewData.byChannel.sms - previewData.byChannel.both}</p>
                      <span className="text-[11px] text-blue-700 font-medium">Telephony fallback</span>
                    </div>
                    <div className="rounded-lg bg-purple-50 border border-purple-200 p-3.5">
                      <span className="text-xs text-purple-900 font-bold">Push Only</span>
                      <p className="mt-1 text-2xl font-black text-purple-800">{previewData.byChannel.push - previewData.byChannel.both}</p>
                      <span className="text-[11px] text-purple-700 font-medium">Data connection only</span>
                    </div>
                    <div className="rounded-lg bg-slate-100 border border-slate-200 p-3.5">
                      <span className="text-xs text-slate-700 font-bold">No Reach</span>
                      <p className="mt-1 text-2xl font-black text-slate-600">{previewData.byChannel.none}</p>
                      <span className="text-[11px] text-slate-600 font-medium">No valid endpoints</span>
                    </div>
                  </div>
                </div>

                {/* Recipients by District */}
                <div className="rounded-xl border-2 border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-2">
                    Recipients by District
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(previewData.byDistrict).map(([dId, count]) => (
                      <div key={dId} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                        <span className="font-bold text-slate-900">{getDistrictName(dId)}</span>
                        <span className="font-black text-blue-700 text-sm">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Zero Recipients Warning */}
                {previewData.estimatedRecipients === 0 && (
                  <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-950">
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
                        className="h-4 w-4 rounded text-amber-600 cursor-pointer"
                      />
                      <span>Confirm issuing warning with zero registered citizens</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Right: 4 cols for summary of warning & confirm/issue actions (sticky) */}
              <div className="lg:col-span-4 rounded-xl border-2 border-blue-300 bg-blue-50/70 p-6 shadow-sm space-y-5 lg:sticky lg:top-4">
                <div className="border-b border-blue-200 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                    Dispatch Summary
                  </span>
                  {customTitle && (
                    <h4 className="mt-1 text-sm font-black text-blue-950">
                      {customTitle}
                    </h4>
                  )}
                  <h3 className="mt-1 text-xl font-black text-slate-900">
                    {hazardType} {severity}
                  </h3>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">Target Districts</span>
                    <p className="font-extrabold text-sm text-slate-900 mt-1">
                      {previewData.targetDistrictIds.map(getDistrictName).join(', ')}
                    </p>
                  </div>

                  <div>
                    <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">Warning Message</span>
                    <p className="mt-1 italic text-slate-900 bg-white p-3.5 rounded-lg border border-blue-200 font-medium leading-relaxed shadow-xs">
                      &ldquo;{message}&rdquo;
                    </p>
                  </div>

                  <div>
                    <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">Auto-Expiry</span>
                    <p className="font-bold text-slate-900 mt-1">
                      {expiresInHours === 'none' ? 'No auto-expiry' : `${expiresInHours} Hours`}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-blue-200 space-y-3">
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
                    className="w-full rounded-lg bg-red-600 py-3.5 text-base font-black text-white shadow-md transition hover:bg-red-700 focus:ring-4 focus:ring-red-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? 'Dispatching Warning...' : 'CONFIRM & ISSUE WARNING 🚨'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full rounded-lg border-2 border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                  >
                    ← Back to Edit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: RESULT (full width delivery outcome) */}
          {step === 3 && dispatchResult && (
            <div className="space-y-6 rounded-xl border-2 border-slate-200 bg-white p-6 shadow-sm w-full">
              <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5 text-emerald-950 shadow-sm w-full">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-black">Alert Dispatched Successfully</h2>
                    {dispatchResult.alert.title && (
                      <p className="mt-1 text-sm font-extrabold text-emerald-950">
                        {dispatchResult.alert.title}
                      </p>
                    )}
                    <p className="mt-1 text-sm font-medium">
                      Active alert registered (ID:{' '}
                      <span className="font-mono font-bold">{dispatchResult.alert.id}</span>).
                      Saved to database before gateway dispatch.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-200 px-3 py-1 text-xs font-black text-emerald-900 border border-emerald-400 self-start sm:self-center">
                    COMMITTED & DISPATCHED
                  </span>
                </div>
              </div>

              {/* Stat cards in a row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                <div className="rounded-xl border-2 border-slate-200 bg-white p-5 text-center shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Distinct Citizens Reached
                  </span>
                  <p className="mt-2 text-4xl font-black text-emerald-700">
                    {dispatchResult.distinctCitizensReached}
                  </p>
                  <span className="mt-1 block text-xs font-semibold text-slate-600">
                    Confirmed delivered to ≥1 channel
                  </span>
                </div>

                <div className="rounded-xl border-2 border-slate-200 bg-white p-5 text-center shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Delivered Attempts
                  </span>
                  <p className="mt-2 text-4xl font-black text-slate-900">
                    {dispatchResult.channelSummary.sms.delivered + dispatchResult.channelSummary.push.delivered}
                  </p>
                  <span className="mt-1 block text-xs font-semibold text-slate-600">
                    SMS: {dispatchResult.channelSummary.sms.delivered} | Push: {dispatchResult.channelSummary.push.delivered}
                  </span>
                </div>

                <div className="rounded-xl border-2 border-slate-200 bg-white p-5 text-center shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Failed Attempts
                  </span>
                  <p
                    className={`mt-2 text-4xl font-black ${
                      dispatchResult.channelSummary.sms.failed + dispatchResult.channelSummary.push.failed > 0
                        ? 'text-red-700'
                        : 'text-slate-900'
                    }`}
                  >
                    {dispatchResult.channelSummary.sms.failed + dispatchResult.channelSummary.push.failed}
                  </p>
                  <span className="mt-1 block text-xs font-semibold text-slate-600">
                    SMS: {dispatchResult.channelSummary.sms.failed} | Push: {dispatchResult.channelSummary.push.failed}
                  </span>
                </div>
              </div>

              {/* Attempts Table Full Width with Horizontal Scroll */}
              {dispatchResult.attempts && dispatchResult.attempts.length > 0 && (
                <div className="rounded-xl border-2 border-slate-200 bg-white p-5 shadow-sm space-y-3 w-full">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-extrabold text-slate-900">Notification Attempts Log</h3>
                    <span className="text-xs text-slate-600 font-medium">
                      Total attempts: {dispatchResult.attempts.length}
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border-2 border-slate-200 w-full">
                    <table className="w-full text-left text-xs min-w-[650px]">
                      <thead className="bg-slate-200 text-slate-900 font-extrabold">
                        <tr>
                          <th className="p-3">Citizen ID</th>
                          <th className="p-3">District</th>
                          <th className="p-3">Channel</th>
                          <th className="p-3">Kind</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Note / Failure</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {dispatchResult.attempts.map((att) => (
                          <tr key={att.id} className="hover:bg-slate-50 font-medium">
                            <td className="p-3 font-mono text-slate-900">{att.citizenId}</td>
                            <td className="p-3 font-semibold text-slate-900">{getDistrictName(att.districtId)}</td>
                            <td className="p-3 font-bold text-slate-900">{att.channel}</td>
                            <td className="p-3 text-slate-800">{att.kind}</td>
                            <td className="p-3">
                              <span
                                className={`rounded px-2.5 py-0.5 font-bold ${
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
                            <td className="p-3 text-slate-700">{att.failureReason ?? '–'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 w-full">
                <div className="flex gap-2.5">
                  {(dispatchResult.channelSummary.sms.failed > 0 ||
                    dispatchResult.channelSummary.push.failed > 0) && (
                    <button
                      type="button"
                      onClick={() => handleRetry(dispatchResult.alert.id)}
                      disabled={loading}
                      className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      {loading ? 'Retrying...' : 'Retry Failed Attempts'}
                    </button>
                  )}
                  <Link
                    href={`/alerts/${dispatchResult.alert.id}`}
                    className="rounded-lg border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-100 shadow-sm"
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
                    setCustomTitle('');
                    setSelectedBasinIds([]);
                    setSelectedDistricts([]);
                    setDistrictSearch('');
                    setActiveTab('active');
                  }}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 shadow-sm cursor-pointer"
                >
                  View in Active Alerts List
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ACTIVE ALERTS LIST (Responsive card grid: 1 col mobile, 2 cols md, 3 cols xl) */}
      {activeTab === 'active' && (
        <div className="space-y-4 rounded-xl border-2 border-slate-200 bg-white p-6 shadow-sm w-full">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Current Hazard Alerts</h2>
              <p className="text-sm font-medium text-slate-600">
                Active early warnings with escalation history and cancellation records.
              </p>
            </div>
            <button
              onClick={fetchAlerts}
              disabled={loadingAlerts}
              className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
            >
              {loadingAlerts ? 'Refreshing...' : '↻ Refresh List'}
            </button>
          </div>

          {alertsList.length === 0 ? (
            <div className="py-12 text-center text-sm font-semibold text-slate-600">
              No hazard alerts currently issued.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 w-full">
              {alertsList.map((alert) => {
                const isEmergency = alert.severity === 'EMERGENCY';
                const isClosed = alert.status === 'CANCELLED' || alert.status === 'EXPIRED';

                return (
                  <div
                    key={alert.id}
                    className="rounded-xl border-2 border-slate-200 p-5 transition hover:border-slate-300 bg-white shadow-sm flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-950 text-base">{alert.hazardType}</span>
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
                      </div>

                      {alert.title && (
                        <h3 className="text-base font-extrabold text-slate-950 -mt-1">
                          {alert.title}
                        </h3>
                      )}

                      <p className="text-sm font-medium text-slate-900 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                        {alert.message}
                      </p>

                      <div className="space-y-1.5 text-xs text-slate-700">
                        <div>
                          <span className="font-semibold text-slate-600">Target Area: </span>
                          <span className="font-bold text-slate-950">
                            {getTargetDisplayName(alert.target)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600 font-medium pt-1 border-t border-slate-100">
                          <span>Occurred: {new Date(alert.occurredAt).toLocaleString()}</span>
                          {alert.expiresAt && (
                            <span>Expires: {new Date(alert.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </div>
                      </div>

                      {alert.cancellationReason && (
                        <div className="rounded-md border border-slate-200 bg-slate-100 p-2.5 text-xs text-slate-800">
                          <span className="font-bold text-slate-950">Cancelled:</span> {alert.cancellationReason}
                        </div>
                      )}

                      {alert.escalations && alert.escalations.length > 0 && (
                        <div className="rounded-md border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-950 space-y-1">
                          <span className="font-extrabold text-blue-950">Escalation History:</span>
                          {alert.escalations.map((esc) => (
                            <div key={esc.id} className="pl-2 border-l-2 border-blue-400 font-medium">
                              <strong>{esc.fromSeverity} → {esc.toSeverity}</strong> ({new Date(esc.occurredAt).toLocaleTimeString()})
                              {esc.reason ? ` – ${esc.reason}` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Operational Action Buttons (DMC Official) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
                      <Link
                        href={`/alerts/${alert.id}`}
                        className="text-xs font-bold text-blue-700 hover:underline"
                      >
                        Citizen Receipt View →
                      </Link>

                      {isDmcOfficial && (
                        <div className="flex items-center gap-2">
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
                            className="rounded-md border-2 border-purple-400 bg-purple-50 px-2.5 py-1 text-xs font-extrabold text-purple-950 transition hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Escalate
                          </button>

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
                            className="rounded-md border-2 border-red-400 bg-red-50 px-2.5 py-1 text-xs font-extrabold text-red-950 transition hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Cancel
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

      {/* ACTION MODAL (Escalate or Cancel - kept centered) */}
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
                      <label key={d.id} className="flex items-center gap-1.5 font-medium text-slate-800 cursor-pointer">
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
                className="rounded-md border-2 border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeAlertAction}
                disabled={loading}
                className={`rounded-md px-4 py-1.5 text-xs font-extrabold text-white shadow-sm cursor-pointer ${
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
