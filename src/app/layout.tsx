import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NetworkProvider } from "@/modules/uc2-report/client/network";
import "./globals.css";
import Link from 'next/link';
import { Suspense } from 'react';
import { RoleSwitcherLoader } from '@/components/RoleSwitcherLoader';

const NAV = [
  { href: '/warnings', label: 'Warnings' },
  { href: '/report', label: 'Report' },
  { href: '/officer/reports', label: 'Review' },
  { href: '/resources', label: 'Resources' },
  { href: '/analysis', label: 'Analysis' },
];

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DEWECS - Disaster Early Warning System",
  description: "Smart Disaster Early Warning and Emergency Coordination System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-100 text-slate-900">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 lg:px-8 py-3.5 shadow-sm w-full">
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="text-lg font-black tracking-tight text-blue-700">
              DEWECS
            </Link>
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
          <Suspense fallback={<div className="h-8 w-32 animate-pulse bg-slate-200 rounded" />}>
            <RoleSwitcherLoader />
          </Suspense>
        </header>
        <main className="flex-1 w-full px-6 lg:px-8 py-6">
          <NetworkProvider>
            {children}
          </NetworkProvider>
        </main>
      </body>
    </html>
  );
}
