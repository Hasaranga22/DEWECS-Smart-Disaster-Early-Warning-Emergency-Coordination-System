"use client";

import React, { useState, useEffect } from "react";
import { Home, AlertTriangle, RefreshCw, CheckCircle2, X, RotateCcw, Trash2 } from "lucide-react";
import { ShelterData, ConflictItem } from "../page";

const DEFAULT_COLOMBO_DISTRICT_ID = "00000000-0000-4000-8000-000000000010";

export default function SheltersPage() {
  const [shelters, setShelters] = useState<ShelterData[]>([]);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Update modal state
  const [selectedShelter, setSelectedShelter] = useState<ShelterData | null>(null);
  const [newOccupancyCount, setNewOccupancyCount] = useState<number>(0);
  const [actionId, setActionId] = useState<string>("");

  // Error & Alternate E1 state
  const [overCapacityError, setOverCapacityError] = useState<{ message: string; alternatives: any[] } | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Discard alert dialog state
  const [conflictToDiscard, setConflictToDiscard] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/resources/dashboard?districtId=${DEFAULT_COLOMBO_DISTRICT_ID}`);
      if (res.ok) {
        const data = await res.json();
        setShelters(data.shelters || []);
        setConflicts(data.openConflicts || []);
      }
    } catch {
      setFeedback({ type: "error", message: "Failed to load shelter records" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setActionId(crypto.randomUUID());
  }, []);

  const openUpdateModal = (shelter: ShelterData) => {
    setSelectedShelter(shelter);
    setNewOccupancyCount(shelter.occupancy);
    setOverCapacityError(null);
  };

  const handleUpdateOccupancy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShelter) return;

    setLoading(true);
    setFeedback(null);
    setOverCapacityError(null);

    try {
      const res = await fetch(`/api/resources/shelters/${selectedShelter.id}/occupancy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId,
          expectedVersion: selectedShelter.version,
          newCount: Number(newOccupancyCount),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setFeedback({
          type: "success",
          message: `Shelter '${data.name}' occupancy updated to ${data.occupancy}/${data.capacity} (Version v${data.version}).`,
        });
        setSelectedShelter(null);
        setActionId(crypto.randomUUID());
        loadData();
      } else if (res.status === 422 && data.error?.code === "OverCapacityError") {
        setOverCapacityError({
          message: data.error.message,
          alternatives: data.error.details || [],
        });
      } else {
        setFeedback({ type: "error", message: data.error?.message || "Failed to update shelter occupancy" });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: `Network error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleResolveConflict = async (conflictId: string, resolution: "RETRY" | "DISCARD") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/resources/conflicts/${conflictId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });

      if (res.ok) {
        setFeedback({ type: "success", message: `Conflict '${conflictId}' resolved with action ${resolution}.` });
        setConflictToDiscard(null);
        loadData();
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: `Failed to resolve conflict: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Home className="w-5 h-5 text-blue-400" /> Shelter Status &amp; Occupancy Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Absolute occupancy count updates with optimistic locking &amp; alternative shelter suggestions (E1).
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Status
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-3 ${
            feedback.type === "success" ? "bg-emerald-950/80 border-emerald-800 text-emerald-200" : "bg-red-950/80 border-red-800 text-red-200"
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Shelters Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
        <h2 className="text-xs font-bold text-white uppercase tracking-wider">Active Shelters in Colombo District</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Shelter Name</th>
                <th className="py-3 px-4">Capacity</th>
                <th className="py-3 px-4">Current Occupancy</th>
                <th className="py-3 px-4">Derived Status</th>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {shelters.map((s) => {
                const pct = Math.round((s.occupancy / s.capacity) * 100);
                return (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-semibold text-white">
                      <div>{s.name}</div>
                      <div className="text-[10px] text-slate-400">{s.address}</div>
                    </td>
                    <td className="py-3 px-4 font-mono">{s.capacity}</td>
                    <td className="py-3 px-4 font-mono text-blue-400 font-semibold">
                      {s.occupancy} ({pct}%)
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.status === "FULL" ? "bg-red-950 text-red-400 border border-red-800" : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                        }`}
                      >
                        STATUS: {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">v{s.version}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openUpdateModal(s)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded text-xs shadow"
                      >
                        Update Occupancy
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conflict Review List */}
      {conflicts.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-red-900/60 p-5 space-y-4">
          <h2 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Version Conflict Review List (E4)
          </h2>

          <div className="space-y-3 text-xs">
            {conflicts.map((c) => (
              <div key={c.id} className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">{c.actionType}</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Item ID: <span className="font-mono">{c.id}</span> &bull; Expected Version: v{c.expectedVersion} &bull; Actual: v{c.actualVersion}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleResolveConflict(c.id, "RETRY")}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded text-xs flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Retry Action
                  </button>
                  <button
                    onClick={() => setConflictToDiscard(c.id)}
                    className="px-3 py-1.5 bg-red-950 hover:bg-red-900 text-red-300 font-semibold rounded text-xs border border-red-800 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Occupancy Update Modal */}
      {selectedShelter && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white">Update Absolute Occupancy Count</h2>
              <button onClick={() => setSelectedShelter(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateOccupancy} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Target Shelter</label>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-semibold text-white">
                  {selectedShelter.name} (Capacity: {selectedShelter.capacity})
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">New Absolute Occupancy Count</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={newOccupancyCount}
                  onChange={(e) => setNewOccupancyCount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Exception E1: OverCapacityError banner with alternative open shelters */}
              {overCapacityError && (
                <div className="bg-red-950/90 border border-red-800 p-4 rounded-lg space-y-2 text-red-200">
                  <div className="font-bold flex items-center gap-1.5 text-xs text-red-300">
                    <AlertTriangle className="w-4 h-4 text-red-400" /> Over Capacity Error (E1)
                  </div>
                  <p>{overCapacityError.message}</p>
                  {overCapacityError.alternatives.length > 0 && (
                    <div className="pt-2 border-t border-red-900/60">
                      <div className="font-semibold text-slate-300 mb-1">Suggested Alternative Open Shelters:</div>
                      <ul className="list-disc pl-4 space-y-1 text-[11px] text-emerald-300 font-medium">
                        {overCapacityError.alternatives.map((alt: any) => (
                          <li key={alt.id}>
                            {alt.name} &mdash; Available Capacity: {alt.availableCapacity} beds
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedShelter(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/40"
                >
                  {loading ? "Updating..." : "Save Occupancy Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Discard Confirmation Alert Dialog */}
      {conflictToDiscard && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-800 rounded-xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h2 className="text-sm font-bold text-white">Confirm Discard Conflict</h2>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to DISCARD this version conflict item? The queued stale update will be removed without changing entity state.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConflictToDiscard(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolveConflict(conflictToDiscard, "DISCARD")}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg shadow"
              >
                Confirm Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
