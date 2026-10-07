"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, MapPin, Clock, ExternalLink } from "lucide-react";

type ReportDraft = any; // We will use raw JSON for the UI to keep it simple

export default function OfficerDashboard() {
  const [queue, setQueue] = useState<ReportDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportDraft | null>(null);
  
  // Action Modals State
  const [actionType, setActionType] = useState<"verify" | "reject" | null>(null);
  const [severity, setSeverity] = useState<string>("MEDIUM");
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/officer/reports");
      if (res.ok) setQueue(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const parsePhotos = (photoStr?: string) => {
    if (!photoStr) return [];
    try {
      return JSON.parse(photoStr) as string[];
    } catch {
      return [photoStr]; // Fallback for single legacy photos
    }
  };

  const handleActionSubmit = async () => {
    if (!selectedReport) return;
    
    setIsProcessing(true);
    setActionError("");

    try {
      const payload = {
        action: actionType,
        expectedVersion: selectedReport.version,
        officerId: "550e8400-e29b-41d4-a716-446655440002", // Officer UUID
        severityIndication: actionType === "verify" ? severity : undefined,
        reason: actionType === "reject" ? rejectReason : undefined,
      };

      const res = await fetch(`/api/officer/reports/${selectedReport.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "CONCURRENCY_ERROR") {
          throw new Error("🚨 CONFLICT: Another officer reviewed this report while you were looking at it! The queue will now refresh.");
        }
        throw new Error(data.message || "Failed to process review.");
      }

      // Success! Close modal and refresh queue
      setActionType(null);
      setSelectedReport(null);
      await fetchQueue();

    } catch (err: any) {
      setActionError(err.message);
      if (err.message.includes("CONFLICT")) {
        // Auto-refresh the queue on optimistic lock failure
        setTimeout(() => {
          setActionType(null);
          setSelectedReport(null);
          fetchQueue();
        }, 4000);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Duty Officer Console</h1>
          <p className="text-gray-600 mt-1">Ground Report Verification Queue (UC2)</p>
        </div>
        <button onClick={fetchQueue} className="bg-white px-4 py-2 rounded shadow-sm font-bold text-sm border hover:bg-gray-50 flex items-center gap-2">
          <Clock size={16} /> Refresh Queue
        </button>
      </header>

      {loading ? (
        <p className="text-center text-gray-500 py-20 font-bold animate-pulse">Loading queue...</p>
      ) : queue.length === 0 ? (
        <div className="bg-white rounded-xl p-20 text-center shadow-sm border border-gray-200">
          <CheckCircle2 size={48} className="mx-auto text-green-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Queue is empty</h2>
          <p className="text-gray-500">All ground reports have been processed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {queue.map((report) => (
            <div key={report.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              
              {/* Header */}
              <div className="bg-gray-800 p-4 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-yellow-400" />
                  <span className="font-bold tracking-wide">{report.hazardType}</span>
                </div>
                <span className="text-xs bg-gray-700 px-2 py-1 rounded font-mono">v{report.version}</span>
              </div>

              {/* Body */}
              <div className="p-4 flex-1">
                <p className="text-gray-900 font-medium line-clamp-3 mb-4">"{report.description}"</p>
                
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  {parsePhotos(report.photo).map((p, i) => (
                    <img key={i} src={p} alt="evidence" className="h-20 w-20 object-cover rounded shadow-sm border" />
                  ))}
                  {parsePhotos(report.photo).length === 0 && (
                    <div className="h-20 w-20 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 border">No Photo</div>
                  )}
                </div>

                <div className="text-xs text-gray-500 space-y-1 mb-4">
                  <p className="flex items-center gap-1"><MapPin size={12} /> {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}</p>
                  <p className="flex items-center gap-1"><Clock size={12} /> {new Date(report.captureTime).toLocaleString()}</p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-gray-50 border-t flex gap-3">
                <button 
                  onClick={() => { setSelectedReport(report); setActionType("reject"); }}
                  className="flex-1 bg-white border border-red-200 text-red-600 font-bold py-2 rounded hover:bg-red-50 transition-colors"
                >
                  Reject
                </button>
                <button 
                  onClick={() => { setSelectedReport(report); setActionType("verify"); }}
                  className="flex-1 bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700 transition-colors shadow-sm"
                >
                  Verify
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Modal (Overlays the screen when Verify or Reject is clicked) */}
      {actionType && selectedReport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className={`p-4 ${actionType === 'verify' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
              <h2 className="text-xl font-bold">
                {actionType === 'verify' ? 'Verify Report' : 'Reject Report'}
              </h2>
            </div>
            
            <div className="p-6">
              {actionError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded text-sm font-bold flex gap-2">
                  <AlertTriangle size={20} className="shrink-0" />
                  {actionError}
                </div>
              )}

              {actionType === 'verify' ? (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Assign Severity Level</label>
                  <select 
                    value={severity} 
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full border rounded-lg p-3 bg-gray-50 focus:ring-2 focus:ring-green-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-2">This will immediately escalate to the UC1 Dispatch system.</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Reason for Rejection</label>
                  <textarea 
                    value={rejectReason} 
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Duplicate report, invalid photo, out of jurisdiction..."
                    className="w-full border rounded-lg p-3 bg-gray-50 focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button 
                onClick={() => { setActionType(null); setActionError(""); }}
                disabled={isProcessing}
                className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleActionSubmit}
                disabled={isProcessing || (actionType === 'reject' && !rejectReason)}
                className={`px-6 py-2 font-bold text-white rounded shadow-sm disabled:opacity-50 ${
                  actionType === 'verify' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isProcessing ? "Processing..." : `Confirm ${actionType}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
