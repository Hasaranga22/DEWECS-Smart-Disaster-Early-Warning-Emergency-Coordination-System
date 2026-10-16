import React, { useState } from 'react';
import { DISTRICTS } from '@/shared/seed';
import type { AlertItem, Severity } from '../lib/types';
import { SEVERITIES } from '../lib/constants';

interface EscalateModalProps {
  alert: AlertItem;
  onSuccess: () => void;
  onClose: () => void;
}

export function EscalateModal({ alert, onSuccess, onClose }: EscalateModalProps) {
  const [newSeverity, setNewSeverity] = useState<Severity>(
    alert.severity === 'ADVISORY' ? 'WATCH' : alert.severity === 'WATCH' ? 'WARNING' : 'EMERGENCY',
  );
  const [actionReason, setActionReason] = useState('');
  const [expandDistricts, setExpandDistricts] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleDistrictCheck(id: string) {
    if (expandDistricts.includes(id)) {
      setExpandDistricts(expandDistricts.filter((x) => x !== id));
    } else {
      setExpandDistricts([...expandDistricts, id]);
    }
  }

  async function handleConfirm() {
    setActionError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/warnings/${alert.id}/escalate`, {
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
      onSuccess();
    } catch {
      setActionError('Network error executing escalation.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl space-y-4 border-2 border-slate-300">
        <h3 className="text-lg font-extrabold text-slate-900">
          Escalate Alert Severity
        </h3>
        <p className="text-xs font-medium text-slate-700">
          Alert: <span className="font-bold text-slate-900">{alert.hazardType}</span> (Current:{' '}
          <span className="font-extrabold text-slate-900">{alert.severity}</span>)
        </p>

        {actionError && (
          <div className="rounded-md border border-red-300 bg-red-50 p-2.5 text-xs font-bold text-red-900">
            {actionError}
          </div>
        )}

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
            <div className="mt-1 grid grid-cols-2 gap-1.5 text-xs max-h-40 overflow-y-auto p-1">
              {DISTRICTS.map((d) => (
                <label key={d.id} className="flex items-center gap-1.5 font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={expandDistricts.includes(d.id)}
                    onChange={() => handleDistrictCheck(d.id)}
                    className="rounded text-blue-600 cursor-pointer"
                  />
                  <span>{d.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border-2 border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="rounded-md px-4 py-1.5 text-xs font-extrabold text-white shadow-sm cursor-pointer bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Confirm Action'}
          </button>
        </div>
      </div>
    </div>
  );
}
