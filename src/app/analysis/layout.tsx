"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  Package,
  Home,
  FileBarChart,
  History,
  Shield,
  Wifi,
  WifiOff,
} from "lucide-react";
import { ROLES, Role } from "./_types";

export default function AnalysisLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<Role>("DMC_OFFICIAL");
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.cookie = `actor=${role}; path=/; max-age=86400`;
    }
  }, [role]);

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    if (typeof document !== "undefined") {
      document.cookie = `actor=${newRole}; path=/; max-age=86400`;
    }
  };

  const uc3NavItems = [
    { href: "/resources", label: "Dashboard", icon: LayoutDashboard },
    { href: "/resources/dispatch", label: "Dispatch Teams", icon: Truck },
    { href: "/resources/distribution", label: "Supply Distribution", icon: Package },
    { href: "/resources/shelters", label: "Shelter Occupancy", icon: Home },
  ];

  const uc4NavItems = [
    { href: "/analysis", label: "Generate Report", icon: FileBarChart },
    { href: "/analysis/history", label: "Report History", icon: History },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar Navigation (w-64) */}
      <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col justify-between shrink-0 h-screen sticky top-0 overflow-y-auto">
        <div>
          {/* Top Logo Section */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">DEWECS Emergency</div>
              <div className="text-[10px] text-slate-400 font-medium">Post-Event Analysis Engine</div>
            </div>
          </div>

          {/* Navigation Links Grouped by Module */}
          <nav className="p-4 space-y-6" aria-label="Main Navigation">
            {/* Section 1: UC3 Resources */}
            <div className="space-y-1">
              <div className="px-3 mb-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                UC3 &bull; Resources
              </div>
              {uc3NavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition ${
                      isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Section 2: UC4 Post-Event Analysis */}
            <div className="space-y-1">
              <div className="px-3 mb-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                UC4 &bull; Post-Event Analysis
              </div>
              {uc4NavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/analysis"
                    ? pathname === "/analysis"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition ${
                      isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Sidebar Footer with Status & Actor Card */}
        <div className="px-4 py-4 border-t border-slate-800 space-y-3 mt-auto">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="flex items-center gap-2 text-slate-400 text-[11px]">
              {isOffline ? (
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              )}
              {isOffline ? "Offline Mode" : "System Online"}
            </span>
            <button
              onClick={() => setIsOffline(!isOffline)}
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

          <div className="rounded-lg bg-slate-900 border border-slate-800 p-3 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white border border-slate-700 shrink-0">
                N
              </div>
              <div className="text-[11px] text-slate-400 leading-tight space-y-0.5">
                <div>
                  Scope: <span className="text-white font-semibold">All</span>
                </div>
                <div>
                  Role: <span className="text-white font-semibold">{role === "DMC_OFFICIAL" ? "DMC Official" : role}</span>
                </div>
              </div>
            </div>

            <div className="pt-1 border-t border-slate-800">
              <label htmlFor="actor-role-select" className="sr-only">
                Actor Role Switcher
              </label>
              <select
                id="actor-role-select"
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as Role)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area Shell */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Sticky Top Header Banner */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-md bg-blue-950 text-blue-300 text-[11px] font-semibold border border-blue-800 tracking-wide">
              ANALYSIS REPORT CONSOLE
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[11px] text-slate-500 font-medium">
              SE3070 Group 20  NADEESHAN R M K (IT23608740)
            </span>
          </div>
        </header>

        {/* Main Workspace Content */}
        <main className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
}
