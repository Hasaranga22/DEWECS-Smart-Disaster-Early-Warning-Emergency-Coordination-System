"use client";

import React, { useState, useEffect } from "react";
import { Truck, AlertTriangle, ShieldCheck, CheckCircle2, RefreshCw, MapPin } from "lucide-react";
import { TeamData } from "../page";

const DEFAULT_COLOMBO_DISTRICT_ID = "00000000-0000-4000-8000-000000000010";

export default function DispatchPage() {
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [backupTeams, setBackupTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);

  // Form inputs
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [location, setLocation] = useState("");
  const [incident, setIncident] = useState("");
  const [actionId, setActionId] = useState<string>("");

  // Confirmation Alert Dialog state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmReasons, setConfirmReasons] = useState<string[]>([]);
  const [pendingDispatch, setPendingDispatch] = useState<any>(null);

  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/resources/dashboard?districtId=${DEFAULT_COLOMBO_DISTRICT_ID}`);
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
      }

      const backupRes = await fetch(`/api/resources/dispatch/backup-teams?districtId=${DEFAULT_COLOMBO_DISTRICT_ID}`);
      if (backupRes.ok) {
        const backups = await backupRes.json();
        setBackupTeams(backups || []);
      }
    } catch {
      setFeedback({ type: "error", message: "Failed to load rescue team data" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setActionId(crypto.randomUUID());
  }, []);

  const availableTeams = teams.filter((t) => t.status === "AVAILABLE");

  const initiateDispatch = (teamId?: string, isConfirmed = false) => {
    const targetTeam = teamId ? teams.find((t) => t.id === teamId) || backupTeams.find((t) => t.id === teamId) : undefined;

    // Evaluate if confirmation rules apply
    const reasons: string[] = [];
    if (targetTeam) {
      const isGov = targetTeam.organizationId.toLowerCase().includes("gov") || targetTeam.organizationId.endsWith("100");
      if (!isGov) {
        reasons.push(`Partner Organization Confirmation Required (${targetTeam.name})`);
      }
      if (targetTeam.districtId !== DEFAULT_COLOMBO_DISTRICT_ID) {
        reasons.push(`Cross-District Dispatch Confirmation Required (Home District: ${targetTeam.districtId})`);
      }
    }

    if (reasons.length > 0 && !isConfirmed) {
      setConfirmReasons(reasons);
      setPendingDispatch({ teamId, location, incident });
      setIsConfirmOpen(true);
      return;
    }

    executeDispatch(teamId, isConfirmed);
  };

  const executeDispatch = async (teamId?: string, isConfirmed = false) => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/resources/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId,
          destinationDistrictId: DEFAULT_COLOMBO_DISTRICT_ID,
          teamId,
          incident: incident || "Emergency Hazard Response",
          location: location || "Colombo Flood Zone",
          isConfirmed,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.team) {
          setFeedback({ type: "success", message: `Rescue Team '${data.team.name}' successfully dispatched! Status: EN_ROUTE.` });
        } else if (data.request) {
          setFeedback({ type: "info", message: `E2 Notice: No team available. Dispatch request saved as UNASSIGNED.` });
        }
        // Generate new actionId for next action
        setActionId(crypto.randomUUID());
        setLocation("");
        setIncident("");
        setIsConfirmOpen(false);
        loadData();
      } else {
        setFeedback({ type: "error", message: data.error?.message || "Dispatch failed" });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: `Network error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-400" /> Dispatch Rescue Teams
          </h1>
          <p className="text-xs text-slate-400 mt-1">System-set state management (AVAILABLE &rarr; EN_ROUTE &rarr; ON_SITE &rarr; RETURNING)</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Pool
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-3 ${
            feedback.type === "success"
              ? "bg-emerald-950/80 border-emerald-800 text-emerald-200"
              : feedback.type === "info"
              ? "bg-amber-950/80 border-amber-800 text-amber-200"
              : "bg-red-950/80 border-red-800 text-red-200"
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Dispatch Form Inputs */}
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
        <h2 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Dispatch Incident Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Incident Description</label>
            <input
              type="text"
              value={incident}
              onChange={(e) => setIncident(e.target.value)}
              placeholder="e.g. Kelani River overflow evacuation"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Destination Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Wellampitiya Evacuation Center"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Available Teams Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            AVAILABLE Home District Teams ({availableTeams.length})
          </h2>
        </div>

        {availableTeams.length === 0 ? (
          <div className="bg-slate-950 p-6 rounded-lg border border-slate-800 text-center space-y-3">
            <p className="text-xs text-amber-400 font-semibold">No AVAILABLE rescue teams in Colombo district pool.</p>
            <button
              onClick={() => initiateDispatch(undefined, true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shadow"
            >
              Save UNASSIGNED Request (E2)
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Team Name</th>
                  <th className="py-3 px-4">Capability</th>
                  <th className="py-3 px-4">Read-Only System Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {availableTeams.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-semibold text-white">{t.name}</td>
                    <td className="py-3 px-4 text-slate-400">{t.capability}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                        STATUS: {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => initiateDispatch(t.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded text-xs shadow"
                      >
                        Dispatch Team
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Backup Adjacent District Teams (Alternate A5) */}
      {backupTeams.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <h2 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
            Alternate A5: Backup Teams in Adjacent Districts ({backupTeams.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Team Name</th>
                  <th className="py-3 px-4">Home District</th>
                  <th className="py-3 px-4">Capability</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {backupTeams.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-semibold text-white">{t.name}</td>
                    <td className="py-3 px-4 text-amber-300 font-mono">Gampaha</td>
                    <td className="py-3 px-4 text-slate-400">{t.capability}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => initiateDispatch(t.id)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded text-xs shadow"
                      >
                        Request Backup Dispatch (A5)
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Combined Confirmation Alert Dialog */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-800/80 rounded-xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-sm font-bold text-white">Combined Dispatch Confirmation</h2>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>The selected team dispatch requires explicit officer authorization for the following criteria:</p>
              <ul className="list-disc pl-5 space-y-1 text-amber-300 font-medium">
                {confirmReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div className="pt-3 flex justify-end gap-3">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => executeDispatch(pendingDispatch?.teamId, true)}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-900/40"
              >
                Confirm &amp; Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
