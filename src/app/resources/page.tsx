"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Home,
  Truck,
  Package,
  AlertTriangle,
  RefreshCw,
  Plus,
  Building,
  CheckCircle2,
  Clock,
  MapPin,
  X,
} from "lucide-react";

export interface ShelterData {
  id: string;
  name: string;
  address: string;
  capacity: number;
  occupancy: number;
  status: "OPEN" | "FULL";
  version: number;
  organizationId: string;
}

export interface TeamData {
  id: string;
  name: string;
  capability: string;
  status: "AVAILABLE" | "EN_ROUTE" | "ON_SITE" | "RETURNING";
  districtId: string;
  organizationId: string;
}

export interface StockItem {
  id: string;
  supplyType: string;
  onHand: number;
  organizationId: string;
}

export interface StockGroup {
  organizationId: string;
  items: StockItem[];
}

export interface ConflictItem {
  id: string;
  actionType: string;
  expectedVersion: number;
  actualVersion: number;
  createdAt: string;
}

export interface DispatchReq {
  id: string;
  location: string;
  status: string;
  occurredAt: string;
}

const DEFAULT_COLOMBO_DISTRICT_ID = "00000000-0000-4000-8000-000000000010";
const DEFAULT_GOV_ORG_ID = "00000000-0000-4000-8000-000000000100";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"shelters" | "teams" | "stock" | "conflicts">("shelters");

  const [shelters, setShelters] = useState<ShelterData[]>([]);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [stockGroups, setStockGroups] = useState<StockGroup[]>([]);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [unassignedRequests, setUnassignedRequests] = useState<DispatchReq[]>([]);
  const [preselectedAlert, setPreselectedAlert] = useState<any>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>("");

  // Activate shelter modal state (Alternate A6)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newCapacity, setNewCapacity] = useState(300);
  const [submitting, setSubmitting] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/resources/dashboard?districtId=${DEFAULT_COLOMBO_DISTRICT_ID}`);
      if (res.ok) {
        const data = await res.json();
        setShelters(data.shelters || []);
        setTeams(data.teams || []);
        setStockGroups(data.stockByOrganization || []);
        setConflicts(data.openConflicts || []);
        setUnassignedRequests(data.unassignedDispatchRequests || []);
        setPreselectedAlert(data.preselectedFromAlert || null);
        setLastRefreshedAt(new Date(data.lastRefreshedAt || Date.now()).toLocaleTimeString());
      }
    } catch (err) {
      setBannerMessage("Failed to load live dashboard data. Operating on cached state.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleActivateShelter = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/resources/shelters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          districtId: DEFAULT_COLOMBO_DISTRICT_ID,
          organizationId: DEFAULT_GOV_ORG_ID,
          name: newName,
          address: newAddress,
          capacity: Number(newCapacity),
        }),
      });

      if (res.ok) {
        setBannerMessage(`New shelter '${newName}' activated successfully!`);
        setIsModalOpen(false);
        setNewName("");
        setNewAddress("");
        fetchDashboardData();
      } else {
        const errJson = await res.json();
        setBannerMessage(`Failed to activate shelter: ${errJson.error?.message || "Unknown error"}`);
      }
    } catch (err: any) {
      setBannerMessage(`Error activating shelter: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const totalCapacity = shelters.reduce((sum, s) => sum + s.capacity, 0);
  const totalOccupancy = shelters.reduce((sum, s) => sum + s.occupancy, 0);
  const totalOccupancyPct = totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0;
  const availableTeamsCount = teams.filter((t) => t.status === "AVAILABLE").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with scope badges and action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-blue-400" /> Resource Coordination Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-300 text-xs font-semibold border border-blue-800">
              District: Colombo
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" /> Last refreshed at: {lastRefreshedAt || "Just now"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Data
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-900/40 transition"
          >
            <Plus className="w-4 h-4" /> Activate Shelter (A6)
          </button>
        </div>
      </div>

      {/* Notice Banners */}
      {preselectedAlert && (
        <div className="bg-blue-950/80 border border-blue-800 p-4 rounded-xl flex items-center justify-between text-xs text-blue-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <span className="font-bold">A1 Notice:</span> Hazard alert preselected Colombo district for emergency resource mobilization.
            </div>
          </div>
        </div>
      )}

      {unassignedRequests.length > 0 && (
        <div className="bg-amber-950/80 border border-amber-800 p-4 rounded-xl flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">E2 Warning:</span> {unassignedRequests.length} UNASSIGNED dispatch requests require rescue team allocation.
            </div>
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="bg-red-950/80 border border-red-800 p-4 rounded-xl flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <span className="font-bold">E4 Conflict Queue:</span> {conflicts.length} version conflict items awaiting officer review on Shelters tab.
            </div>
          </div>
        </div>
      )}

      {bannerMessage && (
        <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex items-center justify-between text-xs text-slate-200">
          <span>{bannerMessage}</span>
          <button onClick={() => setBannerMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Shelters Active</span>
            <Home className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">{shelters.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {shelters.filter((s) => s.status === "FULL").length} Full &bull; {shelters.filter((s) => s.status === "OPEN").length} Open
          </div>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>District Occupancy Rate</span>
            <Building className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {totalOccupancy} / {totalCapacity} ({totalOccupancyPct}%)
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full transition-all ${totalOccupancyPct >= 90 ? "bg-red-500" : "bg-blue-500"}`}
              style={{ width: `${Math.min(100, totalOccupancyPct)}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Available Rescue Teams</span>
            <Truck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">{availableTeamsCount} / {teams.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">{teams.length - availableTeamsCount} Deployed / En-Route</div>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Open Conflicts</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-white">{conflicts.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Requires manual resolution</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="flex border-b border-slate-800 bg-slate-950/50 p-1">
          <button
            onClick={() => setActiveTab("shelters")}
            className={`flex-1 py-2.5 px-4 text-xs font-semibold rounded-lg transition ${
              activeTab === "shelters" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Shelters ({shelters.length})
          </button>
          <button
            onClick={() => setActiveTab("teams")}
            className={`flex-1 py-2.5 px-4 text-xs font-semibold rounded-lg transition ${
              activeTab === "teams" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Rescue Teams ({teams.length})
          </button>
          <button
            onClick={() => setActiveTab("stock")}
            className={`flex-1 py-2.5 px-4 text-xs font-semibold rounded-lg transition ${
              activeTab === "stock" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Stock By Organization ({stockGroups.length} Orgs)
          </button>
          <button
            onClick={() => setActiveTab("conflicts")}
            className={`flex-1 py-2.5 px-4 text-xs font-semibold rounded-lg transition ${
              activeTab === "conflicts" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Conflict Items ({conflicts.length})
          </button>
        </div>

        <div className="p-4">
          {activeTab === "shelters" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Shelter Name</th>
                    <th className="py-3 px-4">Address</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Occupancy Progress</th>
                    <th className="py-3 px-4 text-right">Version</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {shelters.map((s) => {
                    const pct = Math.round((s.occupancy / s.capacity) * 100);
                    return (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-white">{s.name}</td>
                        <td className="py-3 px-4 text-slate-400">{s.address}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.status === "FULL" ? "bg-red-950 text-red-400 border border-red-800" : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            }`}
                          >
                            STATUS: {s.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="font-semibold text-white">
                                {s.occupancy} / {s.capacity} ({pct}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-blue-500"}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-400">v{s.version}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "teams" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Team Name</th>
                    <th className="py-3 px-4">Capability</th>
                    <th className="py-3 px-4">Current System Status</th>
                    <th className="py-3 px-4">Home District</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {teams.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-semibold text-white">{t.name}</td>
                      <td className="py-3 px-4 text-slate-400">{t.capability}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.status === "AVAILABLE"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-blue-950 text-blue-400 border border-blue-800"
                          }`}
                        >
                          STATUS: {t.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">Colombo</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "stock" && (
            <div className="space-y-6">
              {stockGroups.map((group) => (
                <div key={group.organizationId} className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <h3 className="text-xs font-bold text-blue-400 mb-3 uppercase tracking-wider">
                    Owning Organization: {group.organizationId}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {group.items.map((item) => (
                      <div key={item.id} className="bg-slate-900 p-3 rounded border border-slate-800 flex justify-between items-center">
                        <div>
                          <div className="text-xs font-semibold text-white">{item.supplyType}</div>
                          <div className="text-[10px] text-slate-400">On Hand Inventory</div>
                        </div>
                        <div className="text-lg font-bold text-blue-400 font-mono">{item.onHand}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "conflicts" && (
            <div className="space-y-3">
              {conflicts.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">No version conflict items in queue.</div>
              ) : (
                conflicts.map((c) => (
                  <div key={c.id} className="bg-slate-950 p-4 rounded-lg border border-red-900/60 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-red-400">{c.actionType}</div>
                      <div className="text-[11px] text-slate-400">
                        Expected Version v{c.expectedVersion} &bull; Actual Version v{c.actualVersion}
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded bg-red-950 text-red-300 text-[10px] font-bold border border-red-800">
                      STATUS: OPEN CONFLICT
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Activate Shelter Modal (Alternate A6) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Home className="w-4 h-4 text-blue-400" /> Activate New Emergency Shelter (A6)
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleActivateShelter} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Shelter Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Kelani Relief Center Hall"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Location Address</label>
                <input
                  type="text"
                  required
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="e.g. 100 River Road, Colombo"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Maximum Capacity</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/40"
                >
                  {submitting ? "Activating..." : "Activate Shelter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
