"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreativeDewecsLogo } from "@/components/CreativeDewecsLogo";

const NAV = [
  { href: "/warnings", label: "Warnings" },
  { href: "/report/new", label: "Report" },
  { href: "/officer/reports", label: "Review" },
  { href: "/resources", label: "Resources" },
  { href: "/analysis", label: "Analysis" },
];

interface AppLayoutShellProps {
  children: React.ReactNode;
  roleSwitcher?: React.ReactNode;
}

export function AppLayoutShell({ children, roleSwitcher }: AppLayoutShellProps) {
  const pathname = usePathname();

  // Strictly hide the global navigation header ONLY for these exact citizen emergency pages & root onboarding
  const normalizedPath = pathname?.replace(/\/$/, "") || "/";
  const HIDE_HEADER_ROUTES = [
    "",
    "/",
    "/report/new",
    "/report/alerts",
    "/report/outbox",
    "/report/history",
  ];
  const isStandalonePage = HIDE_HEADER_ROUTES.includes(normalizedPath);

  if (isStandalonePage) {
    return <main className="flex-1 w-full">{children}</main>;
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 lg:px-8 py-3.5 shadow-sm w-full">
        <nav className="flex items-center gap-6 text-sm font-medium">
          <CreativeDewecsLogo variant="light" showTagline={false} size="sm" linkHref="/" />
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-slate-700 font-semibold transition hover:text-blue-700"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        {roleSwitcher}
      </header>
      <main className="flex-1 w-full px-6 lg:px-8 py-6">{children}</main>
    </>
  );
}
