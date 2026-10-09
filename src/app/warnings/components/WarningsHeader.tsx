import React from 'react';

interface WarningsHeaderProps {
  activeTab: 'composer' | 'active';
  onTabChange: (tab: 'composer' | 'active') => void;
  isDmcOfficial: boolean;
  activeAndEscalatedCount: number;
}

export function WarningsHeader({
  activeTab,
  onTabChange,
  isDmcOfficial,
  activeAndEscalatedCount,
}: WarningsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Hazard Warnings &amp; Bulletins</h1>
        <p className="text-sm font-medium text-slate-600">
          Emergency multi-channel public dissemination authority for Sri Lanka (DMC).
        </p>
      </div>
      <div className="flex gap-2">
        {isDmcOfficial && (
          <button
            onClick={() => onTabChange('composer')}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition shadow-xs cursor-pointer ${
              activeTab === 'composer'
                ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
            }`}
          >
            + Issue Warning
          </button>
        )}
        <button
          onClick={() => onTabChange('active')}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition shadow-xs cursor-pointer ${
            activeTab === 'active'
              ? 'bg-blue-600 text-white ring-2 ring-blue-300'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
          }`}
        >
          Active Warnings ({activeAndEscalatedCount})
        </button>
      </div>
    </div>
  );
}
