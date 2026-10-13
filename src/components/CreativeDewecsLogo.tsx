"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

interface CreativeLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "light";
  showTagline?: boolean;
  linkHref?: string;
  className?: string;
}

export function CreativeDewecsLogo({
  size = "md",
  variant = "dark",
  showTagline = true,
  linkHref = "/report/new",
  className = "",
}: CreativeLogoProps) {
  const isDark = variant === "dark";

  const iconSizes = {
    sm: { box: "h-9 w-9", icon: 18, text: "text-base", sub: "text-[9px]" },
    md: { box: "h-11 w-11", icon: 22, text: "text-lg", sub: "text-[10px]" },
    lg: { box: "h-14 w-14", icon: 28, text: "text-2xl", sub: "text-xs" },
  };

  const currentSize = iconSizes[size];

  const content = (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Creative Emblem / Badge */}
      <div className="relative flex items-center justify-center shrink-0">
        {/* Ambient glow */}
        <div
          className={`absolute -inset-1 rounded-2xl blur-md opacity-40 transition-opacity ${
            isDark ? "bg-gradient-to-tr from-teal-500 to-emerald-400" : "bg-blue-600/30"
          }`}
        />

        {/* Outer Icon Box */}
        <div
          className={`relative ${currentSize.box} rounded-2xl flex items-center justify-center border shadow-lg backdrop-blur-md transition-transform hover:scale-105 active:scale-95 ${
            isDark
              ? "bg-slate-900/90 border-teal-500/30 text-teal-300 shadow-teal-950/40"
              : "bg-white border-blue-200 text-blue-600 shadow-slate-200"
          }`}
        >
          <ShieldAlert
            size={currentSize.icon}
            className={isDark ? "text-teal-400" : "text-blue-600"}
            strokeWidth={2.3}
          />
          {/* Animated radar ping indicator */}
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-slate-950" />
          </span>
        </div>
      </div>

      {/* Typography */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span
            className={`font-black tracking-tight ${currentSize.text} ${
              isDark
                ? "bg-gradient-to-r from-white via-slate-100 to-teal-200 bg-clip-text text-transparent"
                : "text-slate-900"
            }`}
          >
            DEWECS
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest uppercase ${
              isDark
                ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                : "bg-blue-100 text-blue-700 border border-blue-200"
            }`}
          >
            SL
          </span>
        </div>
        {showTagline && (
          <span
            className={`font-semibold tracking-wider uppercase mt-1 ${currentSize.sub} ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Disaster Early Warning
          </span>
        )}
      </div>
    </div>
  );

  if (linkHref) {
    return (
      <Link href={linkHref} className="hover:opacity-95 transition-opacity inline-flex">
        {content}
      </Link>
    );
  }

  return content;
}
