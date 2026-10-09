import React, { useState } from 'react';
import type { AlertItem } from '../lib/types';

interface CancelModalProps {
  alert: AlertItem;
  onSuccess: () => void;
  onClose: () => void;
}

export function CancelModal({ alert, onSuccess, onClose }: CancelModalProps) {
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!actionReason.trim()) {
      setActionError('Cancellation reason is required.');
      return;
    }
    setActionError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/warnings/${alert.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: actionReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to cancel alert.');
        return;
      }
      onSuccess();
    } catch {
      setActionError('Network error executing cancellation.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl space-y-4 border-2 border-slate-300">
        <h3 className="text-lg font-extrabold text-slate-900">
          Cancel Hazard Alert
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
            className="rounded-md px-4 py-1.5 text-xs font-extrabold text-white shadow-sm cursor-pointer bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Confirm Action'}
          </button>
        </div>
      </div>
    </div>
  );
}
