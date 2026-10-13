import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { NetworkProvider } from "@/modules/uc2-report/client/network";
import { RoleSwitcherLoader } from "@/components/RoleSwitcherLoader";
import { AppLayoutShell } from "@/components/AppLayoutShell";
import "./globals.css";

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
        <NetworkProvider>
          <AppLayoutShell
            roleSwitcher={
              <Suspense fallback={<div className="h-8 w-32 animate-pulse bg-slate-200 rounded" />}>
                <RoleSwitcherLoader />
              </Suspense>
            }
          >
            {children}
          </AppLayoutShell>
        </NetworkProvider>
      </body>
    </html>
  );
}
