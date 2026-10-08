"use client";

import React, { useState, useEffect } from "react";
import { Package, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, Check } from "lucide-react";
import { ShelterData, StockGroup, StockItem } from "../page";

const DEFAULT_COLOMBO_DISTRICT_ID = "00000000-0000-4000-8000-000000000010";

export default function DistributionPage() {
  const [shelters, setShelters] = useState<ShelterData[]>([]);
  const [stockGroups, setStockGroups] = useState<StockGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Form selections
  const [selectedStockId, setSelectedStockId] = useState<string>("");
  const [selectedShelterId, setSelectedShelterId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(50);
  const [actionId, setActionId] = useState<string>("");

  // Receipt Modal State
  const [receipt, setReceipt] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/resources/dashboard?districtId=${DEFAULT_COLOMBO_DISTRICT_ID}`);
      if (res.ok) {
        const data = await res.json();
        setShelters(data.shelters || []);
        setStockGroups(data.stockByOrganization || []);
      }
    } catch {
      setFeedback({ type: "error", message: "Failed to load supply and shelter data" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setActionId(crypto.randomUUID());
  }, []);

  // Find selected stock item across groups
  let selectedStock: StockItem | undefined;
  for (const group of stockGroups) {
    const found = group.items.find((i) => i.id === selectedStockId);
    if (found) {
      selectedStock = found;
      break;
    }
  }

  const selectedShelter = shelters.find((s) => s.id === selectedShelterId);
  const remainingAfter = selectedStock ? selectedStock.onHand - Number(quantity || 0) : 0;
  const isValidQuantity = quantity > 0 && Number.isInteger(Number(quantity));
  const isStockSufficient = selectedStock ? selectedStock.onHand >= quantity : true;

  const handleDistribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStockId || !selectedShelterId || !isValidQuantity) return;

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/resources/distributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId,
          stockId: selectedStockId,
          destinationShelterId: selectedShelterId,
          quantity: Number(quantity),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setReceipt({
          id: data.id,
          supplyType: selectedStock?.supplyType,
          quantity: data.quantity,
          destination: selectedShelter?.name,
          occurredAt: new Date(data.occurredAt).toLocaleString(),
        });
        setActionId(crypto.randomUUID());
        loadData();
      } else {
        setFeedback({
          type: "error",
          message: data.error?.message || "Insufficient stock - nothing was recorded (E3)",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: `Insufficient stock - nothing was recorded. (${err.message})`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-400" /> Supply Distribution
          </h1>
          <p className="text-xs text-slate-400 mt-1">Atomic transaction management. Distribution does NOT alter shelter occupancy.</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Balances
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-3 ${
            feedback.type === "error" ? "bg-red-950/80 border-red-800 text-red-200" : "bg-emerald-950/80 border-emerald-800 text-emerald-200"
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Distribution Form */}
      <form onSubmit={handleDistribute} className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-5">
        <h2 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Record Supply Dispatch</h2>

        <div className="space-y-4 text-xs">
          {/* Stock Select Grouped by Organization */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">Select Source Supply Inventory (Grouped by Organization)</label>
            <select
              value={selectedStockId}
              onChange={(e) => setSelectedStockId(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 font-sans"
            >
              <option value="">-- Choose Supply Inventory --</option>
              {stockGroups.map((group) => (
                <optgroup key={group.organizationId} label={`Org: ${group.organizationId}`}>
                  {group.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.supplyType} &mdash; Available: {item.onHand} units
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Destination Shelter Select */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">Select Destination Shelter</label>
            <select
              value={selectedShelterId}
              onChange={(e) => setSelectedShelterId(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 font-sans"
            >
              <option value="">-- Choose Destination Shelter --</option>
              {shelters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.address}) &mdash; Occupancy: {s.occupancy}/{s.capacity}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity Input with Live Preview */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">Quantity to Distribute</label>
            <input
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
          </div>

          {/* Live Remaining Stock Preview */}
          {selectedStock && (
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
              <div className="space-y-1">
                <div className="text-slate-400">Current On Hand: <span className="text-white font-mono">{selectedStock.onHand}</span></div>
                <div className="text-slate-400">Distributing: <span className="text-blue-400 font-mono">-{quantity || 0}</span></div>
              </div>
              <div className="flex items-center gap-2 text-right">
                <ArrowRight className="w-4 h-4 text-slate-500" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Remaining After</div>
                  <div className={`text-base font-bold font-mono ${remainingAfter < 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {remainingAfter} units
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isStockSufficient && (
            <p className="text-xs text-red-400 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Insufficient stock! Requested quantity exceeds on-hand balance ({selectedStock?.onHand}).
            </p>
          )}
        </div>

        <div className="pt-3 flex justify-end">
          <button
            type="submit"
            disabled={loading || !isStockSufficient || !selectedStockId || !selectedShelterId}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-blue-900/40 transition"
          >
            {loading ? "Recording..." : "Record Distribution Transaction"}
          </button>
        </div>
      </form>

      {/* Success Transaction Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-800 rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-400 border-b border-slate-800 pb-3">
              <CheckCircle2 className="w-6 h-6" />
              <h2 className="text-sm font-bold text-white">Distribution Receipt Confirmed</h2>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Transaction Ref:</span>
                <span className="font-mono text-white text-[11px]">{receipt.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Supply Item:</span>
                <span className="text-white font-semibold">{receipt.supplyType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Quantity Distributed:</span>
                <span className="text-emerald-400 font-bold font-mono">{receipt.quantity} units</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Destination Shelter:</span>
                <span className="text-white font-medium">{receipt.destination}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Timestamp:</span>
                <span className="text-slate-400">{receipt.occurredAt}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setReceipt(null)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
