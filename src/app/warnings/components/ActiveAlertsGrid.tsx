import React from 'react';
import type { AlertItem } from '../lib/types';
import { AlertCard } from './AlertCard';

interface ActiveAlertsGridProps {
  alertsList: AlertItem[];
  loadingAlerts: boolean;
  onRefresh: () => void;
  isDmcOfficial: boolean;
  onEscalate: (alert: AlertItem) => void;
  onCancel: (alert: AlertItem) => void;
}

export function ActiveAlertsGrid({
  alertsList,
  loadingAlerts,
  onRefresh,
  isDmcOfficial,
  onEscalate,
  onCancel,
}: ActiveAlertsGridProps) {
  return (
    <div className="space-y-4 rounded-xl border-2 border-slate-200 bg-white p-6 shadow-sm w-full">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Current Hazard Alerts</h2>
          <p className="text-sm font-medium text-slate-600">
            Active early warnings with escalation history and cancellation records.
          </p>
        </div>
        <button
          onClick={onRefresh}
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
          {alertsList.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              isDmcOfficial={isDmcOfficial}
              onEscalate={onEscalate}
              onCancel={onCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
