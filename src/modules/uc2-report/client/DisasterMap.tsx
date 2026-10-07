"use client";

import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { OfficerReport, hazardMeta, STATUS_META, SEVERITY_META } from "./reportUi";

interface DisasterMapProps {
  reports: OfficerReport[];
  focusedId?: string | null;
  onSelect?: (id: string) => void;
}

const SRI_LANKA_CENTER: [number, number] = [7.8731, 80.7718];

/** Fits the map to the data once, and flies to a report when it is focused. */
function MapController({ reports, focusedId }: Pick<DisasterMapProps, "reports" | "focusedId">) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || reports.length === 0) return;
    fitted.current = true;
    const bounds = L.latLngBounds(reports.map((r) => [r.latitude, r.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [70, 70], maxZoom: 11 });
  }, [reports, map]);

  useEffect(() => {
    if (!focusedId) return;
    const r = reports.find((x) => x.id === focusedId);
    if (r) map.flyTo([r.latitude, r.longitude], Math.max(map.getZoom(), 12), { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedId]);

  return null;
}

export default function DisasterMap({ reports, focusedId, onSelect }: DisasterMapProps) {
  return (
    <MapContainer center={SRI_LANKA_CENTER} zoom={7} zoomControl={false} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />
      <MapController reports={reports} focusedId={focusedId} />

      {reports.map((r) => {
        const color = hazardMeta(r.hazardType).color;
        const isHigh = r.severityIndication === "HIGH";
        const isFocused = r.id === focusedId;
        return (
          <React.Fragment key={r.id}>
            {/* Soft halo for high-severity or focused reports */}
            {(isHigh || isFocused) && (
              <CircleMarker
                center={[r.latitude, r.longitude]}
                radius={isFocused ? 22 : 20}
                interactive={false}
                pathOptions={{ color, weight: 1, fillColor: color, fillOpacity: 0.18 }}
              />
            )}
            <CircleMarker
              center={[r.latitude, r.longitude]}
              radius={isHigh ? 11 : 8}
              eventHandlers={{ click: () => onSelect?.(r.id) }}
              pathOptions={{ color: "#ffffff", weight: 2.5, fillColor: color, fillOpacity: 1 }}
            >
              <Popup>
                <div className="font-sans min-w-[170px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{hazardMeta(r.hazardType).icon}</span>
                    <strong className="text-sm text-slate-900">{hazardMeta(r.hazardType).label}</strong>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_META[r.reviewStatus].chip}`}>
                      {STATUS_META[r.reviewStatus].label}
                    </span>
                    {r.severityIndication && (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${SEVERITY_META[r.severityIndication].chip}`}>
                        {SEVERITY_META[r.severityIndication].label} severity
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-3">{r.description}</p>
                </div>
              </Popup>
            </CircleMarker>
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
}