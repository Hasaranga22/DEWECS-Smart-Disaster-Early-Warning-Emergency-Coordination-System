import React from 'react';
import type { HazardType, Severity } from '../lib/types';
import { HAZARD_TYPES, SEVERITIES } from '../lib/constants';
import { TargetPicker } from './TargetPicker';

interface ComposerStepProps {
  customTitle: string;
  onCustomTitleChange: (val: string) => void;
  hazardType: HazardType;
  onHazardTypeChange: (val: HazardType) => void;
  severity: Severity;
  onSeverityChange: (val: Severity) => void;
  selectedDistricts: string[];
  selectedBasinIds: string[];
  districtSearch: string;
  onDistrictToggle: (id: string) => void;
  onBasinToggle: (id: string) => void;
  onRemoveDistrict: (id: string) => void;
  onClearAllDistricts: () => void;
  onDistrictSearchChange: (val: string) => void;
  message: string;
  onMessageChange: (val: string) => void;
  expiresInHours: string;
  onExpiresInHoursChange: (val: string) => void;
  onSubmitPreview: () => void;
  loading: boolean;
}

export function ComposerStep({
  customTitle,
  onCustomTitleChange,
  hazardType,
  onHazardTypeChange,
  severity,
  onSeverityChange,
  selectedDistricts,
  selectedBasinIds,
  districtSearch,
  onDistrictToggle,
  onBasinToggle,
  onRemoveDistrict,
  onClearAllDistricts,
  onDistrictSearchChange,
  message,
  onMessageChange,
  expiresInHours,
  onExpiresInHoursChange,
  onSubmitPreview,
  loading,
}: ComposerStepProps) {
  return (
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
          onChange={(e) => onCustomTitleChange(e.target.value)}
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
                onClick={() => onHazardTypeChange(hz)}
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
                  onClick={() => onSeverityChange(s)}
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

      {/* Target Geography */}
      <TargetPicker
        selectedDistricts={selectedDistricts}
        selectedBasinIds={selectedBasinIds}
        districtSearch={districtSearch}
        onDistrictToggle={onDistrictToggle}
        onBasinToggle={onBasinToggle}
        onRemoveDistrict={onRemoveDistrict}
        onClearAll={onClearAllDistricts}
        onSearchChange={onDistrictSearchChange}
      />

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
                onMessageChange(
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
            onChange={(e) => onMessageChange(e.target.value)}
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
              onChange={(e) => onExpiresInHoursChange(e.target.value)}
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
          onClick={onSubmitPreview}
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-3.5 text-base font-extrabold text-white shadow-md transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? 'Analyzing Target Geography...' : 'Preview Recipients & Channels →'}
        </button>
      </div>
    </div>
  );
}
