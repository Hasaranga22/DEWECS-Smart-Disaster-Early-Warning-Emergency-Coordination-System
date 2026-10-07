"use client";

import React, { useState, useEffect, useRef } from "react";
import { useNetworkStatus } from "@/modules/uc2-report/client/network";
import { getCurrentLocation } from "@/modules/uc2-report/client/geolocation";
import { compressImage } from "@/modules/uc2-report/client/compressImage";
import { IdbOutboxRepository } from "@/modules/uc2-report/client/IdbOutboxRepository";
import { HazardType } from "@/shared/contracts/types";
import {
  Camera, ImagePlus, MapPin, AlertTriangle, Send, X, CheckCircle2,
  ChevronLeft, WifiOff, LocateFixed, Inbox, Check,
} from "lucide-react";
import Link from "next/link";

const MAX_PHOTOS = 3;
const MIN_DESC = 10;

// Full static class strings so Tailwind never purges them.
const HAZARDS: {
  type: HazardType; label: string; icon: string;
  tile: string; ring: string; dot: string;
}[] = [
  { type: "FLOOD", label: "Flood", icon: "🌊", tile: "bg-sky-50 border-sky-500 text-sky-800", ring: "ring-sky-200", dot: "bg-sky-500" },
  { type: "LANDSLIDE", label: "Landslide", icon: "⛰️", tile: "bg-amber-50 border-amber-500 text-amber-800", ring: "ring-amber-200", dot: "bg-amber-500" },
  { type: "CYCLONE", label: "Cyclone", icon: "🌀", tile: "bg-teal-50 border-teal-500 text-teal-800", ring: "ring-teal-200", dot: "bg-teal-500" },
  { type: "DROUGHT", label: "Drought", icon: "☀️", tile: "bg-orange-50 border-orange-500 text-orange-800", ring: "ring-orange-200", dot: "bg-orange-500" },
  { type: "OTHER", label: "Other", icon: "⚠️", tile: "bg-slate-100 border-slate-500 text-slate-800", ring: "ring-slate-200", dot: "bg-slate-500" },
];

export default function NewReportPage() {
  const { isOnline } = useNetworkStatus();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [hazardType, setHazardType] = useState<HazardType | null>(null);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(true);
  const [gpsWarning, setGpsWarning] = useState("");

  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState<null | "sent" | "queued">(null);

  const showStatus = (msg: string, type: "info" | "success" | "error") => {
    setStatusMsg(msg);
    setStatusType(type);
  };

  const fetchLocation = async () => {
    setLocating(true);
    try {
      const geo = await getCurrentLocation();
      setLat(geo.latitude);
      setLng(geo.longitude);
      setAccuracy(geo.accuracy);
      setGpsWarning(geo.requiresManualPin ? "GPS signal is weak. Move to open sky, then tap Refresh." : "");
    } catch {
      setGpsWarning("Turn on location access to send a report.");
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => { fetchLocation(); }, []);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-selecting the same file
    if (files.length === 0) return;

    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) {
      showStatus(`You can add ${room} more photo${room === 1 ? "" : "s"}.`, "error");
      return;
    }
    try {
      showStatus("Preparing photos…", "info");
      const compressed = await Promise.all(files.map((f) => compressImage(f)));
      setPhotos((prev) => [...prev, ...compressed]);
      setStatusMsg("");
    } catch {
      showStatus("Couldn't process that photo. Try another one.", "error");
    }
  };

  const removePhoto = (i: number) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hazardType) return showStatus("Choose what you're reporting.", "error");
    if (!lat || !lng) return showStatus("Waiting for your location…", "error");

    setIsSubmitting(true);
    showStatus("Sending report…", "info");

    const localId = crypto.randomUUID();
    const captureTime = new Date().toISOString();
    const photoPayload = photos.length > 0 ? JSON.stringify(photos) : undefined;

    const payload = {
      localId,
      reporterId: "citizen-123",
      districtId: "colombo",
      hazardType,
      description,
      latitude: lat,
      longitude: lng,
      locationSource: accuracy && accuracy > 100 ? "MANUAL_PIN" : "GPS",
      gpsAccuracyM: accuracy || undefined,
      photo: photoPayload,
      captureTime,
    };

    try {
      if (isOnline) {
        const response = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("The server couldn't accept this report. Try again.");
        setDone("sent");
      } else {
        const outbox = new IdbOutboxRepository();
        await outbox.save({
          ...payload,
          locationSource: payload.locationSource as "GPS" | "MANUAL_PIN",
          confidence: photoPayload ? "FULL" : "REDUCED",
          status: "PENDING_SYNC",
        });
        setDone("queued");
      }
      setStatusMsg("");
      setHazardType(null);
      setDescription("");
      setPhotos([]);
    } catch (err: any) {
      showStatus(err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const poorGps = !!accuracy && accuracy > 100;
  const steps = [!!hazardType, !!(lat && lng), photos.length > 0, description.length >= MIN_DESC];
  const completed = steps.filter(Boolean).length;
  const canSubmit = !isSubmitting && !!lat && !!lng && !!hazardType && description.length >= MIN_DESC;
  const selected = HAZARDS.find((h) => h.type === hazardType);

  /* ---------- Success screen ---------- */
  if (done) {
    const queued = done === "queued";
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 text-center">
        <div className={`h-24 w-24 rounded-full flex items-center justify-center mb-6 ${queued ? "bg-amber-400/15 text-amber-300" : "bg-emerald-400/15 text-emerald-300"}`}>
          {queued ? <Inbox size={44} /> : <CheckCircle2 size={44} />}
        </div>
        <h1 className="text-2xl font-bold text-white">{queued ? "Saved on your phone" : "Report sent"}</h1>
        <p className="text-slate-400 mt-2 max-w-xs">
          {queued
            ? "You're offline. We'll send it automatically once you reconnect."
            : "Thank you. Responders in your district can see it now."}
        </p>
        <div className="w-full max-w-xs mt-8 space-y-3">
          <button onClick={() => setDone(null)} className="w-full py-4 rounded-2xl bg-white text-slate-900 font-semibold active:scale-[0.98] transition-transform">
            Report another
          </button>
          <Link href="/report/outbox" className="block w-full py-4 rounded-2xl bg-white/10 text-white font-semibold active:bg-white/20">
            View outbox
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-48">
      {/* Hero header with progress */}
      <header className="bg-slate-950 text-white px-5 pt-4 pb-20 rounded-b-[2rem]">
        <div className="flex items-center justify-between">
          <Link href="/report/outbox" aria-label="Back to outbox" className="h-10 w-10 -ml-2 flex items-center justify-center rounded-full active:bg-white/10">
            <ChevronLeft size={24} />
          </Link>
          {!isOnline ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-400/15 px-3 py-1.5 rounded-full">
              <WifiOff size={14} /> Offline
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-400/15 px-3 py-1.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Online
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold mt-3">Report a hazard</h1>
        <p className="text-sm text-slate-400 mt-1">Takes about a minute. Your location is added for you.</p>

        <div className="flex gap-1.5 mt-5" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={completed}>
          {steps.map((ok, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${ok ? "bg-teal-400" : "bg-white/15"}`} />
          ))}
        </div>
      </header>

      <main className="px-4 -mt-9 max-w-md mx-auto space-y-4 relative z-10">
        {/* Hazard type */}
        <section className="bg-white rounded-3xl p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 text-base">What's happening?</h2>
          <div className="grid grid-cols-3 gap-2.5 mt-4">
            {HAZARDS.map((h) => {
              const on = hazardType === h.type;
              return (
                <button
                  key={h.type}
                  type="button"
                  onClick={() => setHazardType(h.type)}
                  aria-pressed={on}
                  className={`relative flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl border-2 transition-all active:scale-95 ${
                    on ? `${h.tile} ring-4 ${h.ring}` : "bg-slate-50 border-transparent text-slate-600"
                  }`}
                >
                  {on && (
                    <span className={`absolute top-1.5 right-1.5 h-4 w-4 rounded-full ${h.dot} text-white flex items-center justify-center`}>
                      <Check size={10} strokeWidth={4} />
                    </span>
                  )}
                  <span className="text-3xl leading-none">{h.icon}</span>
                  <span className="text-xs font-semibold">{h.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Location */}
        <section className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-base">Where is it?</h2>
            <button
              type="button"
              onClick={fetchLocation}
              disabled={locating}
              className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-full active:bg-teal-100 disabled:opacity-50"
            >
              <LocateFixed size={14} className={locating ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
              !lat ? "bg-slate-100 text-slate-400" : poorGps ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
            }`}>
              <MapPin size={24} />
            </div>
            <div className="min-w-0 flex-1">
              {lat && lng ? (
                <>
                  <p className="font-semibold text-slate-900 tabular-nums">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
                  <p className={`text-xs font-medium mt-0.5 ${poorGps ? "text-red-600" : "text-emerald-600"}`}>
                    {poorGps ? "Weak signal" : "Good signal"} · within {accuracy ? Math.round(accuracy) : "?"} m
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-slate-900">{locating ? "Finding you…" : "Location unavailable"}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{locating ? "Keep this screen open" : "Allow location access, then tap Refresh"}</p>
                </>
              )}
            </div>
          </div>

          {gpsWarning && (
            <div role="alert" className="mt-4 px-3.5 py-2.5 flex items-start gap-2 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" /> {gpsWarning}
            </div>
          )}

          {lat && lng && (
            <div className="mt-4 h-64 rounded-2xl overflow-hidden bg-slate-100 pointer-events-none">
              <iframe
                width="100%" height="100%" frameBorder="0" scrolling="no"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.005},${lng + 0.005},${lat + 0.005}&layer=mapnik&marker=${lat},${lng}`}
                title="Your location on the map"
              />
            </div>
          )}
        </section>

        {/* Photos */}
        <section className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Add photos</h2>
              <p className="text-xs text-slate-500 mt-0.5">Photos help responders judge severity.</p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
              {photos.length}/{MAX_PHOTOS}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mt-4">
            {photos.map((photo, idx) => (
              <div key={idx} className="relative aspect-square">
                <img src={photo} alt={`Evidence ${idx + 1}`} className="h-full w-full object-cover rounded-2xl" />
                {idx === 0 && (
                  <span className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold bg-black/60 text-white px-2 py-0.5 rounded-full">Cover</span>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  aria-label={`Remove photo ${idx + 1}`}
                  className="absolute -top-1.5 -right-1.5 h-7 w-7 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-md border-2 border-white active:scale-90"
                >
                  <X size={14} strokeWidth={3} />
                </button>
              </div>
            ))}

            {/* empty slots */}
            {Array.from({ length: MAX_PHOTOS - photos.length }).map((_, i) => (
              <div
                key={`slot-${i}`}
                className={`aspect-square rounded-2xl border-2 border-dashed flex items-center justify-center ${
                  i === 0 ? "border-teal-300 bg-teal-50 text-teal-600" : "border-slate-200 text-slate-300"
                }`}
              >
                <ImagePlus size={22} />
              </div>
            ))}
          </div>

          {photos.length < MAX_PHOTOS && (
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <button type="button" onClick={() => cameraRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 text-white text-sm font-semibold active:bg-teal-700">
                <Camera size={18} /> Take photo
              </button>
              <button type="button" onClick={() => galleryRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 text-slate-800 text-sm font-semibold active:bg-slate-200">
                <ImagePlus size={18} /> From gallery
              </button>
            </div>
          )}

          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
          <input ref={galleryRef} type="file" accept="image/*" multiple onChange={handlePhotoChange} className="hidden" />
        </section>

        {/* Details */}
        <section className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-base">Tell us more</h2>
            <span className={`text-xs font-semibold ${description.length >= MIN_DESC ? "text-emerald-600" : "text-slate-400"}`}>
              {description.length >= MIN_DESC ? "Looks good" : `${description.length}/${MIN_DESC} min`}
            </span>
          </div>
          <textarea
            className="mt-3 w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
            rows={4}
            placeholder="How severe is it? Is anyone in danger? What help is needed?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </section>
      </main>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto">
          {statusMsg && (
            <div role="status" className={`mb-3 px-3.5 py-2.5 flex items-start gap-2 rounded-xl text-sm font-medium ${
              statusType === "error" ? "bg-red-50 text-red-700" : statusType === "success" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"
            }`}>
              {statusType === "error" && <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
              {statusType === "success" && <CheckCircle2 size={18} className="shrink-0 mt-0.5" />}
              {statusMsg}
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 ${
              isOnline ? "bg-teal-600" : "bg-amber-600"
            }`}
          >
            {isSubmitting ? (
              <span className="animate-pulse">Sending…</span>
            ) : (
              <>
                <Send size={19} />
                {isOnline ? "Send report" : "Save to outbox"}
                {selected && <span className="opacity-80 font-medium">· {selected.label}</span>}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}