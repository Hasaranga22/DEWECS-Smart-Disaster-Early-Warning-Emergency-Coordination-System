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
  AlertTriangle,
  Wifi,
  WifiOff,
  ShieldCheck,
  MapPin,
  Users,
} from "lucide-react";

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isOffline, setIsOffline] = useState(false);
  const [role, setRole] = useState<string>("DMC_OFFICIAL");

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.cookie = `actor=${role}; path=/; max-age=86400`;
      document.cookie = `dewecs-role=${role}; path=/; max-age=86400`;
    }
  }, [role]);

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    if (typeof document !== "undefined") {
      document.cookie = `actor=${newRole}; path=/; max-age=86400`;
      document.cookie = `dewecs-role=${newRole}; path=/; max-age=86400`;
    }
  };

  const toggleOffline = () => {
    const next = !isOffline;
    setIsOffline(next);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dewecs-offline-toggle", { detail: { isOffline: next } }));
    }
  };

  const uc3NavItems = [
    { href: "/resources", label: "Dashboard", icon: LayoutDashboard },
    { href: "/resources/dispatch", label: "Dispatch Teams", icon: Truck },
    { href: "/resources/distribution", label: "Supply Distribution", icon: Package },
    { href: "/resources/shelters", label: "Shelter Occupancy", icon: Home },
  ];

  const uc4NavItems = [
    { href: "/resources/analysis", label: "Generate Report", icon: FileBarChart },
    { href: "/resources/analysis/history", label: "Report History", icon: History },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col justify-between p-4 shrink-0 overflow-y-auto">
        <div>
          <div className="flex items-center gap-3 px-2 py-3 mb-6 border-b border-slate-800">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-white">DEWECS Emergency</h1>
              <p className="text-xs text-blue-400 font-medium">Resources &amp; Analysis Engine</p>
            </div>
          </div>

          <nav className="space-y-6">
            {/* UC3 Group */}
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
            </div>

            {/* UC4 Group */}
            <div className="space-y-1">
              <div className="px-3 mb-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                UC4 &bull; Post-Event Analysis
              </div>
              {uc4NavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/resources/analysis"
                    ? pathname === "/resources/analysis"
                    : pathname.startsWith(item.href);
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
            </div>
          </nav>
        </div>

        {/* Offline & System Info Footer */}
        <div className="border-t border-slate-800 pt-4 space-y-3 mt-auto">
          <div className="flex items-center justify-between px-2 text-xs">
            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
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

          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-2">
            <div className="flex items-center justify-between">
              <span>District Scope:</span>
              <span className="text-blue-400 font-semibold flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Colombo
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Actor Role:</span>
              <span className="text-slate-200 font-medium">{role === "DMC_OFFICIAL" ? "DMC Official" : role}</span>
            </div>

            <div className="pt-1 border-t border-slate-800">
              <label htmlFor="actor-role-select" className="block text-[10px] text-slate-500 mb-1 font-medium">
                Switch Role (Dev):
              </label>
              <select
                id="actor-role-select"
                value={role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="DMC_OFFICIAL">DMC_OFFICIAL</option>
                <option value="DUTY_OFFICER">DUTY_OFFICER</option>
                <option value="DISTRICT_OFFICER">DISTRICT_OFFICER</option>
                <option value="CITIZEN">CITIZEN</option>
              </select>
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
              DISASTER MANAGEMENT COORDINATION CONSOLE
            </span>
            {isOffline && (
              <span className="px-2.5 py-1 rounded-md bg-amber-950 border border-amber-800 text-amber-300 text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" /> OFFLINE SIMULATION ACTIVE
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Group Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold text-white">SE3070 Group 20</span>
            </div>

            {/* Teammate 1: Nadeeshan */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <div className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-[10px]">
                NR
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-slate-200 text-[11px] leading-tight">Nadeeshan R M K</span>
                <span className="text-[9px] text-slate-400 font-mono leading-tight">IT23608740</span>
              </div>
            </div>

            {/* Teammate 2: Sandaruwan */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <div className="w-5 h-5 rounded-full bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-[10px]">
                SH
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-slate-200 text-[11px] leading-tight">Sandaruwan H M K</span>
                <span className="text-[9px] text-slate-400 font-mono leading-tight">IT23633322</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Workspace */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">{children}</main>
      </div>
    </div>
  );
}
