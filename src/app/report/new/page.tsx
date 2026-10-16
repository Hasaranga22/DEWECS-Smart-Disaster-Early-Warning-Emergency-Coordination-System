"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ClipboardList,
  ImagePlus,
  Inbox,
  LocateFixed,
  MapPin,
  Mountain,
  Send,
  Sun,
  Waves,
  WifiOff,
  Wind,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { CreativeDewecsLogo } from "@/components/CreativeDewecsLogo";
import { useNetworkStatus } from "@/modules/uc2-report/client/network";
import { getCurrentLocation } from "@/modules/uc2-report/client/geolocation";
import { compressImage } from "@/modules/uc2-report/client/compressImage";
import { IdbOutboxRepository } from "@/modules/uc2-report/client/IdbOutboxRepository";
import { DEMO_CITIZEN_ID } from "@/modules/uc2-report/client/citizen";
import type { HazardType } from "@/shared/contracts/types";

const MAX_PHOTOS = 3;
const REQUEST_TIMEOUT_MS = 30_000;

type StatusType = "info" | "success" | "error";

type HazardOption = {
  type: HazardType;
  label: string;
  Icon: LucideIcon;
};

const HAZARDS: HazardOption[] = [
  { type: "FLOOD", label: "Flood", Icon: Waves },
  { type: "LANDSLIDE", label: "Landslide", Icon: Mountain },
  { type: "CYCLONE", label: "Cyclone", Icon: Wind },
  { type: "DROUGHT", label: "Drought", Icon: Sun },
  { type: "OTHER", label: "Other", Icon: AlertTriangle },
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
  const [statusType, setStatusType] = useState<StatusType>("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState<"sent" | "queued" | null>(null);

  const hasLocation = lat !== null && lng !== null;
  const poorGps = accuracy !== null && accuracy > 100;
  // Description is optional for emergency reports; only hazard type and location are required.
  const canSubmit = !isSubmitting && !!hazardType && hasLocation;

  const showStatus = (message: string, type: StatusType) => {
    setStatusMsg(message);
    setStatusType(type);
  };

  const fetchLocation = useCallback(async () => {
    setLocating(true);
    setGpsWarning("");

    try {
      const location = await getCurrentLocation();
      setLat(location.latitude);
      setLng(location.longitude);
      setAccuracy(location.accuracy);

      if (location.requiresManualPin || location.accuracy > 100) {
        setGpsWarning(
          "GPS accuracy is low. Refresh your location if it is safe to do so."
        );
      }
    } catch {
      setLat(null);
      setLng(null);
      setAccuracy(null);
      setGpsWarning("Allow location access, then try again.");
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    void fetchLocation();
  }, [fetchLocation]);

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // Allow choosing the same image again.
    if (files.length === 0) return;

    const remaining = MAX_PHOTOS - photos.length;
    if (files.length > remaining) {
      showStatus(
        `You can add ${remaining} more photo${remaining === 1 ? "" : "s"}.`,
        "error"
      );
      return;
    }

    try {
      showStatus("Preparing photos…", "info");
      const compressed = await Promise.all(
        files.map(async (file) => {
          try {
            return await compressImage(file);
          } catch {
            // Direct data URL fallback if canvas compression fails on unsupported image formats
            return await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          }
        })
      );
      setPhotos((current) => [...current, ...compressed].slice(0, MAX_PHOTOS));
      setStatusMsg("");
    } catch (err) {
      console.error("Photo upload error:", err);
      showStatus("Could not prepare that photo. Try another image.", "error");
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hazardType) {
      showStatus("Select the type of hazard.", "error");
      return;
    }
    if (!hasLocation || lat === null || lng === null) {
      showStatus("Your location is required. Please refresh it.", "error");
      return;
    }

    setIsSubmitting(true);
    showStatus(isOnline ? "Sending report…" : "Saving report…", "info");

    const photoPayload = photos.length ? JSON.stringify(photos) : undefined;
    const payload = {
      localId: crypto.randomUUID(),
      reporterId: DEMO_CITIZEN_ID,
      districtId: "550e8400-e29b-41d4-a716-446655440000",
      hazardType,
      description: description.trim() || "Incident reported without description.",
      latitude: lat,
      longitude: lng,
      locationSource: "GPS" as const,
      gpsAccuracyM: accuracy ?? undefined,
      photo: photoPayload,
      captureTime: new Date().toISOString(),
    };

    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      if (isOnline) {
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => null);
          throw new Error(
            error?.error ??
              error?.message ??
              "The server could not accept this report. Try again."
          );
        }
        setDone("sent");
      } else {
        const outbox = new IdbOutboxRepository();
        await outbox.save({
          ...payload,
          confidence: photoPayload ? "FULL" : "REDUCED",
          status: "PENDING_SYNC",
        });
        setDone("queued");
      }

      setStatusMsg("");
      setHazardType(null);
      setDescription("");
      setPhotos([]);
    } catch (error: unknown) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "Sending timed out. Your report was not confirmed. Please try again."
          : error instanceof Error
            ? error.message
            : "Could not send the report. Please try again.";
      showStatus(message, "error");
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      setIsSubmitting(false);
    }
  };

  if (done) {
    const queued = done === "queued";

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 text-center">
        <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white px-6 py-10 shadow-sm">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${
              queued ? "bg-amber-50 text-amber-700" : "bg-teal-50 text-teal-700"
            }`}
          >
            {queued ? <Inbox size={30} /> : <CheckCircle2 size={30} />}
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-950">
            {queued ? "Report saved" : "Report sent"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {queued
              ? "Your report is stored on this device and will sync when you reconnect."
              : "Your report has been received. Thank you for helping keep others informed."}
          </p>
          <button
            type="button"
            onClick={() => setDone(null)}
            className="mt-7 w-full rounded-xl bg-teal-700 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            Report another hazard
          </button>
          <Link
            href={queued ? "/report/outbox" : "/report/history"}
            className="mt-3 block rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            {queued ? "View outbox" : "View sent reports"}
          </Link>
        </div>
      </div>
    );
  }

  const footerHint = !hazardType
    ? "Choose a hazard type to continue"
    : !hasLocation
      ? "Waiting for your GPS location"
      : isOnline
        ? "Ready to submit report"
        : "Offline: your report will be saved on this device";

  return (
    <div className="min-h-screen bg-slate-50 pb-36 text-slate-900">
      {/* Compact brand header. The reporting task, not the branding, is the focus. */}
      <header className="bg-slate-950 text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <CreativeDewecsLogo variant="dark" size="sm" showTagline={false} />
          <span
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-medium ${
              isOnline
                ? "bg-teal-400/10 text-teal-200"
                : "bg-amber-400/10 text-amber-200"
            }`}
          >
            {isOnline ? (
              <span className="h-2 w-2 rounded-full bg-teal-400" aria-hidden="true" />
            ) : (
              <WifiOff size={13} aria-hidden="true" />
            )}
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pt-5 sm:px-6">
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-600" aria-label="Reporting navigation">
          <Link href="/report/alerts" className="inline-flex items-center gap-1.5 py-1 hover:text-teal-800 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">
            <AlertTriangle size={14} /> Alerts
          </Link>
          <Link href="/report/outbox" className="inline-flex items-center gap-1.5 py-1 hover:text-teal-800 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">
            <Inbox size={14} /> Outbox
          </Link>
          <Link href="/report/history" className="inline-flex items-center gap-1.5 py-1 hover:text-teal-800 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700">
            <ClipboardList size={14} /> Sent reports
          </Link>
        </nav>

        <div className="mb-5 mt-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Report a hazard
          </h1>
          <p className="mt-1.5 text-sm leading-5 text-slate-600">
            Share what is happening. Your GPS location is added automatically.
          </p>
        </div>

        {/* Animated safety alert box with smooth traveling red border line */}
        <div className="relative mb-5 rounded-2xl p-[2px] overflow-hidden group shadow-sm">
          {/* Smooth moving red border beam line */}
          <div
            className="absolute -inset-[150%] animate-spin"
            style={{
              animationDuration: "3.5s",
              background:
                "conic-gradient(from 0deg, transparent 0deg 280deg, #f87171 310deg, #ef4444 340deg, #b91c1c 360deg)",
            }}
            aria-hidden="true"
          />

          {/* Inner Card Content */}
          <Link
            href="/report/alerts"
            className="relative flex items-center justify-between gap-3 rounded-[14px] bg-gradient-to-r from-amber-50 via-white to-amber-50/80 px-4 py-3.5 text-sm transition-all hover:bg-amber-100/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          >
            <div className="flex min-w-0 items-center gap-3 text-amber-950">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 border border-red-200/80 shadow-sm">
                <AlertTriangle size={18} className="animate-pulse text-red-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">Check current safety alerts</span>
                  <span className="flex h-2 w-2 relative shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  View active danger warnings & district evacuation orders
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 font-bold text-xs text-red-700 bg-red-50 group-hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-colors">
              <span>View</span>
              <ArrowRight size={14} />
            </div>
          </Link>
        </div>

        <form id="hazard-report-form" onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* 1. Hazard selection: two balanced rows rather than an awkward 3 + 2 grid. */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="hazard-heading">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 id="hazard-heading" className="text-base font-bold text-slate-950">
                  What is happening?
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">Choose one hazard type</p>
              </div>
              <span className="text-xs font-medium text-slate-400">Required</span>
            </div>
            <div className="grid grid-cols-6 gap-2" role="group" aria-label="Hazard type">
              {HAZARDS.map(({ type, label, Icon }, index) => {
                const selected = hazardType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setHazardType(type)}
                    className={`relative flex min-h-[83px] flex-col items-center justify-center gap-1.5 rounded-xl border px-1.5 py-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                      index > 2 ? "col-span-3" : "col-span-2"
                    } ${
                      selected
                        ? "border-teal-700 bg-teal-50 text-teal-800"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {selected && (
                      <Check size={14} strokeWidth={3} className="absolute right-2 top-2" aria-hidden="true" />
                    )}
                    <Icon size={23} strokeWidth={1.9} aria-hidden="true" />
                    <span className="text-xs font-semibold">{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. Optional description */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="description-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="description-heading" className="text-base font-bold text-slate-950">
                Describe the situation
              </h2>
              <span className="text-xs font-medium text-slate-400">Optional</span>
            </div>
            <label htmlFor="hazard-description" className="sr-only">Describe the hazard</label>
            <textarea
              id="hazard-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="What can you see? (Optional - you can submit without a description)"
              aria-describedby="description-help"
              className="block w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-base leading-6 text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/15"
            />
            <div id="description-help" className="mt-2 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500">Optional details</span>
              <span className="text-slate-500">
                {description.trim().length}/1000
              </span>
            </div>
          </section>

          {/* 3. Auto-detected GPS location with direct map preview */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="location-heading">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="location-heading" className="text-base font-bold text-slate-950">
                  Your location
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">Detected automatically by GPS</p>
              </div>
              <button
                type="button"
                onClick={() => void fetchLocation()}
                disabled={locating}
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60"
              >
                <LocateFixed size={15} aria-hidden="true" />
                {locating ? "Locating…" : "Refresh"}
              </button>
            </div>

            <div className="mt-3 flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                hasLocation && !poorGps ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"
              }`}>
                <MapPin size={21} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {locating && !hasLocation
                    ? "Finding your location…"
                    : hasLocation
                      ? poorGps
                        ? "Location detected · low accuracy"
                        : "Location detected"
                      : "Location unavailable"}
                </p>
                {hasLocation ? (
                  <p className="mt-0.5 break-words text-xs leading-5 text-slate-600">
                    {lat?.toFixed(5)}, {lng?.toFixed(5)}
                    {accuracy !== null && ` · Accuracy ±${Math.round(accuracy)} m`}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">
                    {locating ? "Please wait a moment" : "Location access is required to submit"}
                  </p>
                )}
              </div>
            </div>

            {gpsWarning && (
              <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                {gpsWarning}
              </p>
            )}

            {/* Direct Location Map Display (No hide button) */}
            {hasLocation && lat !== null && lng !== null && (
              <div className="mt-3">
                <div id="gps-preview" className="h-48 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-56 shadow-inner">
                  <iframe
                    title="GPS location map preview"
                    width="100%"
                    height="100%"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.005},${lng + 0.005},${lat + 0.005}&layer=mapnik&marker=${lat},${lng}`}
                  />
                </div>
              </div>
            )}
          </section>

          {/* 4. Photos Section with Guaranteed Previews */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="photos-heading">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="photos-heading" className="text-base font-bold text-slate-950">
                  Add photos
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">Helpful for responders, but optional</p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-slate-600">{photos.length}/{MAX_PHOTOS}</span>
            </div>

            {/* Uploaded Photos Preview Grid */}
            {photos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {photos.map((photo, index) => (
                  <div key={index} className="relative aspect-square w-full min-h-[96px] sm:min-h-[110px] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo}
                      alt={`Hazard evidence ${index + 1}`}
                      className="h-full w-full object-cover block"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      aria-label={`Remove photo ${index + 1}`}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 hover:bg-slate-900 text-white shadow-md transition-colors"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.length < MAX_PHOTOS && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-2 py-3 text-xs font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:text-sm"
                >
                  <Camera size={17} aria-hidden="true" /> Take photo
                </button>
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:text-sm"
                >
                  <ImagePlus size={17} aria-hidden="true" /> Choose photo
                </button>
              </div>
            )}

            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="sr-only" tabIndex={-1} aria-label="Take photo" />
            <input ref={galleryRef} type="file" accept="image/*" multiple onChange={handlePhotoChange} className="sr-only" tabIndex={-1} aria-label="Choose photos" />
          </section>

        </form>
      </div>

      {/* One clear primary action. The footer is compact and respects safe areas. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_24px_rgba(15,23,42,0.04)] backdrop-blur-sm sm:px-6">
        <div className="mx-auto max-w-2xl">
          <p
            role={statusMsg && statusType === "error" ? "alert" : "status"}
            className={`mb-2 text-center text-xs leading-4 ${
              statusMsg && statusType === "error"
                ? "font-medium text-red-700"
                : "text-slate-600"
            }`}
          >
            {statusMsg || footerHint}
          </p>
          <button
            type="submit"
            form="hazard-report-form"
            disabled={!canSubmit}
            className={`flex min-h-[49px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
              canSubmit
                ? "bg-teal-700 text-white hover:bg-teal-800"
                : "cursor-not-allowed bg-slate-200 text-slate-500"
            }`}
          >
            {isSubmitting ? (
              "Processing…"
            ) : (
              <>
                <Send size={17} aria-hidden="true" />
                {isOnline ? "Send hazard report" : "Save report for later"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
