"use client";

import Link from "next/link";

interface CreativeLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "light";
  showTagline?: boolean;
  linkHref?: string;
  className?: string;
}

const sizes = {
  sm: { mark: "h-9 w-9", name: "text-base", tagline: "text-[9px]", gap: "gap-2.5" },
  md: { mark: "h-11 w-11", name: "text-lg", tagline: "text-[10px]", gap: "gap-3" },
  lg: { mark: "h-14 w-14", name: "text-2xl", tagline: "text-xs", gap: "gap-3.5" },
};

function DewecsMark({ size, dark }: { size: keyof typeof sizes; dark: boolean }) {
  const iconSize = size === "sm" ? 36 : size === "md" ? 44 : 56;

  return (
    <div className={`relative shrink-0 ${sizes[size].mark}`} aria-hidden="true">
      <div className={`absolute inset-0 rounded-[30%] blur-md ${dark ? "bg-teal-400/25" : "bg-teal-600/20"}`} />
      <svg viewBox="0 0 56 56" width={iconSize} height={iconSize} className="relative block overflow-visible">
        <defs>
          <linearGradient id="dewecs-mark" x1="9" y1="5" x2="47" y2="51" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2DD4BF" />
            <stop offset="1" stopColor="#0F766E" />
          </linearGradient>
          <linearGradient id="dewecs-wave" x1="15" y1="15" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#CCFBF1" />
            <stop offset="1" stopColor="#5EEAD4" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="52" height="52" rx="17" fill={dark ? "#102A36" : "#F0FDFA"} />
        <rect x="2.5" y="2.5" width="51" height="51" rx="16.5" stroke={dark ? "#5EEAD4" : "#0F766E"} strokeOpacity={dark ? "0.35" : "0.2"} />
        <path d="M28 9.5 43 15v10.1c0 10.2-6.3 17.5-15 21.4-8.7-3.9-15-11.2-15-21.4V15l15-5.5Z" fill="url(#dewecs-mark)" />
        <path d="M18 28c2.1-4.9 5.4-7.3 10-7.3 4.6 0 7.9 2.4 10 7.3" fill="none" stroke="url(#dewecs-wave)" strokeWidth="2.25" strokeLinecap="round" />
        <path d="M20.5 33c1.6-3.1 4.1-4.7 7.5-4.7 3.4 0 5.9 1.6 7.5 4.7" fill="none" stroke="url(#dewecs-wave)" strokeWidth="2.25" strokeLinecap="round" />
        <circle cx="28" cy="35.5" r="2.35" fill="#ECFEFF" />
        <circle cx="42.5" cy="13.5" r="4.2" fill="#FBBF24" stroke={dark ? "#102A36" : "#F0FDFA"} strokeWidth="2" />
      </svg>
    </div>
  );
}

export function CreativeDewecsLogo({
  size = "md",
  variant = "dark",
  showTagline = true,
  linkHref = "/report/new",
  className = "",
}: CreativeLogoProps) {
  const dark = variant === "dark";
  const current = sizes[size];

  const content = (
    <div className={`flex items-center ${current.gap} select-none ${className}`}>
      <DewecsMark size={size} dark={dark} />
      <div className="flex min-w-0 flex-col leading-none">
        <div className="flex items-center gap-1.5">
          <span className={`font-black tracking-[-0.055em] ${current.name} ${dark ? "text-white" : "text-slate-950"}`}>DEWECS</span>
          <span className={`rounded-md px-1.5 py-1 text-[8px] font-black leading-none tracking-[0.12em] ${dark ? "bg-teal-400/15 text-teal-200" : "bg-teal-100 text-teal-800"}`}>SL</span>
        </div>
        {showTagline && <span className={`mt-1.5 font-bold uppercase tracking-[0.12em] ${current.tagline} ${dark ? "text-slate-400" : "text-slate-500"}`}>Early warning network</span>}
      </div>
    </div>
  );

  return linkHref ? <Link href={linkHref} className="inline-flex rounded-lg transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400">{content}</Link> : content;
}
