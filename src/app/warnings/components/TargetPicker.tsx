import React from 'react';
import { DISTRICTS, RIVER_BASINS } from '@/shared/seed';
import { getDistrictName } from '../lib/helpers';

export function computeEffectiveTarget(
  selectedBasinIds: string[],
  selectedDistricts: string[],
): { districtIds?: string[]; basinId?: string } {
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

interface TargetPickerProps {
  selectedDistricts: string[];
  selectedBasinIds: string[];
  districtSearch: string;
  onDistrictToggle: (districtId: string) => void;
  onBasinToggle: (basinId: string) => void;
  onRemoveDistrict: (districtId: string) => void;
  onClearAll: () => void;
  onSearchChange: (search: string) => void;
}

export function TargetPicker({
  selectedDistricts,
  selectedBasinIds,
  districtSearch,
  onDistrictToggle,
  onBasinToggle,
  onRemoveDistrict,
  onClearAll,
  onSearchChange,
}: TargetPickerProps) {
  const filteredDistricts = DISTRICTS.filter((d) =>
    d.name.toLowerCase().includes(districtSearch.trim().toLowerCase()),
  );

  return (
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
                onClick={() => onBasinToggle(b.id)}
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
              onClick={onClearAll}
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
                  onClick={() => onRemoveDistrict(dId)}
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
              Found {filteredDistricts.length} matches
            </span>
          )}
        </div>
        <div className="relative">
          <input
            id="district-search-input"
            type="text"
            value={districtSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search district by name (e.g., Colombo, Galle, Kandy)..."
            className="w-full rounded-lg border-2 border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 placeholder-slate-400 shadow-xs focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          {districtSearch && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Districts Checkboxes */}
        {filteredDistricts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white py-6 text-center text-xs font-medium text-slate-600">
            No districts match &ldquo;{districtSearch}&rdquo;.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-1">
            {filteredDistricts.map((d) => {
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
                    onChange={() => onDistrictToggle(d.id)}
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
  );
}
