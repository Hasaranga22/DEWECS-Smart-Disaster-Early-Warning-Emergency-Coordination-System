'use client';

import { useEffect, useState } from 'react';
import type { AlertItem, DispatchResultData, EvidenceItem, HazardType, PreviewData, Severity, WarningsClientProps } from './lib/types';
import { toggleBasinInState, toggleDistrictInList } from './lib/helpers';
import { WarningsHeader } from './components/WarningsHeader';
import { KpiStrip } from './components/KpiStrip';
import { Stepper } from './components/Stepper';
import { ComposerStep } from './components/ComposerStep';
import { EvidencePanel } from './components/EvidencePanel';
import { PreviewStep } from './components/PreviewStep';
import { ResultStep } from './components/ResultStep';
import { ActiveAlertsGrid } from './components/ActiveAlertsGrid';
import { EscalateModal } from './components/EscalateModal';
import { CancelModal } from './components/CancelModal';
import { computeEffectiveTarget } from './components/TargetPicker';

export function WarningsClient({ actorRole, actorDistrictId }: WarningsClientProps) {
  const isDmcOfficial = actorRole === 'DMC_OFFICIAL';

  const [activeTab, setActiveTab] = useState<'composer' | 'active'>(isDmcOfficial ? 'composer' : 'active');
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

  // Workflow state
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [dispatchResult, setDispatchResult] = useState<DispatchResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Evidence & alerts
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [alertsList, setAlertsList] = useState<AlertItem[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // Modal state
  const [actionAlert, setActionAlert] = useState<AlertItem | null>(null);
  const [actionType, setActionType] = useState<'ESCALATE' | 'CANCEL' | null>(null);

  useEffect(() => {
    fetchAlerts();
    if (isDmcOfficial) fetchEvidence();
  }, [isDmcOfficial]);

  async function fetchEvidence() {
    setLoadingEvidence(true);
    try {
      const res = await fetch('/api/warnings/evidence');
      if (res.ok) setEvidenceList(await res.json());
    } finally { setLoadingEvidence(false); }
  }

  async function fetchAlerts() {
    setLoadingAlerts(true);
    try {
      const res = await fetch('/api/warnings');
      if (res.ok) setAlertsList(await res.json());
    } finally { setLoadingAlerts(false); }
  }

  function toggleBasin(basinId: string) {
    const res = toggleBasinInState(selectedBasinIds, selectedDistricts, basinId);
    setSelectedBasinIds(res.nextBasinIds);
    setSelectedDistricts(res.nextDistricts);
  }

  async function handlePreview() {
    setErrorMsg(null);
    const targetPayload = computeEffectiveTarget(selectedBasinIds, selectedDistricts);
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
      if (!res.ok) { setErrorMsg(data.error || 'Failed to preview recipients.'); return; }
      setPreviewData(data);
      setStep(2);
    } catch {
      setErrorMsg('Network error while previewing recipients.');
    } finally { setLoading(false); }
  }

  async function handleIssue() {
    setErrorMsg(null);
    setLoading(true);
    try {
      const expiresAt = expiresInHours !== 'none'
        ? new Date(Date.now() + parseInt(expiresInHours, 10) * 3600000).toISOString()
        : null;
      const targetPayload = computeEffectiveTarget(selectedBasinIds, selectedDistricts);
      const res = await fetch('/api/warnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: customTitle.trim() || undefined,
          hazardType, severity, message, target: targetPayload,
          confirmZeroRecipients: confirmZero, expiresAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error || 'Failed to issue hazard alert.'); return; }
      setDispatchResult(data);
      setStep(3);
      fetchAlerts();
    } catch {
      setErrorMsg('Network error while issuing hazard alert.');
    } finally { setLoading(false); }
  }

  async function handleRetry(alertId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/warnings/${alertId}/retry`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setDispatchResult((prev) =>
          prev ? { ...prev, channelSummary: data.channelSummary, distinctCitizensReached: data.distinctCitizensReached } : null,
        );
        fetchAlerts();
      } else { setErrorMsg(data.error || 'Failed to retry.'); }
    } catch {
      setErrorMsg('Failed to retry dispatch.');
    } finally { setLoading(false); }
  }

  function handleResetWorkflow() {
    setStep(1);
    setDispatchResult(null);
    setPreviewData(null);
    setMessage('');
    setCustomTitle('');
    setSelectedBasinIds([]);
    setSelectedDistricts([]);
    setDistrictSearch('');
    setActiveTab('active');
  }

  const activeCount = alertsList.filter((a) => a.status === 'ACTIVE').length;
  const escalatedCount = alertsList.filter((a) => a.status === 'ESCALATED').length;
  const closedCount = alertsList.filter((a) => a.status === 'CANCELLED' || a.status === 'EXPIRED').length;

  return (
    <div className="w-full space-y-6">
      <WarningsHeader
        activeTab={activeTab}
        onTabChange={(t) => { setActiveTab(t); if (t === 'composer') setStep(1); }}
        isDmcOfficial={isDmcOfficial}
        activeAndEscalatedCount={activeCount + escalatedCount}
      />

      <KpiStrip
        activeCount={activeCount}
        escalatedCount={escalatedCount}
        closedCount={closedCount}
        citizensReachedInLast={dispatchResult ? dispatchResult.distinctCitizensReached : 0}
        dispatchResult={dispatchResult}
        hasAlerts={alertsList.length > 0}
      />

      {errorMsg && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 text-sm text-red-900 shadow-sm">
          <p className="font-bold">Error Notice</p>
          <p className="mt-1 font-medium">{errorMsg}</p>
        </div>
      )}

      {activeTab === 'composer' && isDmcOfficial && (
        <div className="space-y-6 w-full">
          <Stepper step={step} />

          {step === 1 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 w-full">
              <ComposerStep
                customTitle={customTitle} onCustomTitleChange={setCustomTitle}
                hazardType={hazardType} onHazardTypeChange={setHazardType}
                severity={severity} onSeverityChange={setSeverity}
                selectedDistricts={selectedDistricts} selectedBasinIds={selectedBasinIds}
                districtSearch={districtSearch} onDistrictSearchChange={setDistrictSearch}
                onDistrictToggle={(id) => setSelectedDistricts(toggleDistrictInList(selectedDistricts, id))}
                onBasinToggle={toggleBasin}
                onRemoveDistrict={(dId) => setSelectedDistricts(selectedDistricts.filter((x) => x !== dId))}
                onClearAllDistricts={() => { setSelectedDistricts([]); setSelectedBasinIds([]); }}
                message={message} onMessageChange={setMessage}
                expiresInHours={expiresInHours} onExpiresInHoursChange={setExpiresInHours}
                onSubmitPreview={handlePreview} loading={loading}
              />
              <EvidencePanel evidenceList={evidenceList} loadingEvidence={loadingEvidence} />
            </div>
          )}

          {step === 2 && previewData && (
            <PreviewStep
              previewData={previewData} customTitle={customTitle}
              hazardType={hazardType} severity={severity}
              message={message} expiresInHours={expiresInHours}
              confirmZero={confirmZero} onConfirmZeroChange={setConfirmZero}
              onIssue={handleIssue} onBackToEdit={() => setStep(1)} loading={loading}
            />
          )}

          {step === 3 && dispatchResult && (
            <ResultStep
              dispatchResult={dispatchResult}
              actorRole={actorRole}
              actorDistrictId={actorDistrictId}
              onRetry={handleRetry}
              onResetToActiveList={handleResetWorkflow}
              loading={loading}
            />
          )}

        </div>
      )}

      {activeTab === 'active' && (
        <ActiveAlertsGrid
          alertsList={alertsList}
          loadingAlerts={loadingAlerts}
          onRefresh={fetchAlerts}
          isDmcOfficial={isDmcOfficial}
          onEscalate={(alert) => { setActionAlert(alert); setActionType('ESCALATE'); }}
          onCancel={(alert) => { setActionAlert(alert); setActionType('CANCEL'); }}
        />
      )}

      {actionAlert && actionType === 'ESCALATE' && (
        <EscalateModal
          alert={actionAlert}
          onSuccess={() => { setActionAlert(null); setActionType(null); fetchAlerts(); }}
          onClose={() => { setActionAlert(null); setActionType(null); }}
        />
      )}

      {actionAlert && actionType === 'CANCEL' && (
        <CancelModal
          alert={actionAlert}
          onSuccess={() => { setActionAlert(null); setActionType(null); fetchAlerts(); }}
          onClose={() => { setActionAlert(null); setActionType(null); }}
        />
      )}
    </div>
  );
}
