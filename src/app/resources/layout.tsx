"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  Package,
  Home,
  AlertTriangle,
  Wifi,
  WifiOff,
  ShieldCheck,
  MapPin,
  RefreshCw,
} from "lucide-react";

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isOffline, setIsOffline] = useState(false);

  const toggleOffline = () => {
    const next = !isOffline;
    setIsOffline(next);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dewecs-offline-toggle", { detail: { isOffline: next } }));
    }
  };

  const navItems = [
    { href: "/resources", label: "Dashboard", icon: LayoutDashboard },
    { href: "/resources/dispatch", label: "Dispatch Teams", icon: Truck },
    { href: "/resources/distribution", label: "Supply Distribution", icon: Package },
    { href: "/resources/shelters", label: "Shelter Occupancy", icon: Home },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col justify-between p-4 shrink-0">
        <div>
          <div className="flex items-center gap-3 px-2 py-3 mb-6 border-b border-slate-800">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-white">DEWECS Emergency</h1>
              <p className="text-xs text-blue-400 font-medium">UC3 Resources Engine</p>
            </div>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Offline & System Info Footer */}
        <div className="border-t border-slate-800 pt-4 space-y-3">
          <div className="flex items-center justify-between px-2 text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              {isOffline ? <WifiOff className="w-3.5 h-3.5 text-amber-400" /> : <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
              {isOffline ? "Offline Mode" : "System Online"}
            </span>
            <button
              onClick={toggleOffline}
              type="button"
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isOffline ? "bg-amber-500" : "bg-slate-700"
              }`}
              aria-label="Toggle offline mode simulation"
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isOffline ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>District Scope:</span>
              <span className="text-blue-400 font-semibold flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Colombo
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Actor Role:</span>
              <span className="text-slate-200 font-medium">District Officer</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-md bg-blue-950 border border-blue-800 text-blue-300 text-xs font-semibold tracking-wide">
              COLOMBO DISTRICT COORDINATION
            </span>
            {isOffline && (
              <span className="px-2.5 py-1 rounded-md bg-amber-950 border border-amber-800 text-amber-300 text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" /> OFFLINE SIMULATION ACTIVE
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">SE3070 Group 20 &bull; SANDARUWAN H M K (IT23633322)</span>
          </div>
        </header>

        {/* Dynamic Page Workspace */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">{children}</main>
      </div>
    </div>
  );
}
