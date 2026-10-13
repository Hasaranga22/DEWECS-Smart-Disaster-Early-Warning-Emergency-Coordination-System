"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, Radio, MapPin, Camera, ChevronRight } from "lucide-react";

// Each slide in the onboarding flow
const SLIDES = [
  {
    icon: <ShieldAlert size={44} className="text-teal-400" />,
    badge: "DEWECS",
    headline: "Sri Lanka's Disaster\nEarly Warning System",
    sub: "Your report can save lives. Help us protect communities across Sri Lanka in real time.",
    bg: "from-slate-950 via-slate-900 to-teal-950",
    accent: "bg-teal-500",
  },
  {
    icon: <Camera size={44} className="text-sky-400" />,
    badge: "Step 1 — Capture",
    headline: "Photograph the\nHazard Clearly",
    sub: "Take up to 3 photos of the disaster. Even a single clear image helps officers verify your report faster.",
    bg: "from-slate-950 via-slate-900 to-sky-950",
    accent: "bg-sky-500",
  },
  {
    icon: <MapPin size={44} className="text-amber-400" />,
    badge: "Step 2 — Locate",
    headline: "Allow Location\nAccess",
    sub: "We use GPS to pin the exact location so emergency teams can reach the scene without delay.",
    bg: "from-slate-950 via-slate-900 to-amber-950",
    accent: "bg-amber-500",
  },
  {
    icon: <Radio size={44} className="text-emerald-400" />,
    badge: "Step 3 — Submit",
    headline: "Works Even\nOffline",
    sub: "No signal? No problem. Your report is saved on your device and automatically sent when you reconnect.",
    bg: "from-slate-950 via-slate-900 to-emerald-950",
    accent: "bg-emerald-500",
  },
];

interface OnboardingScreenProps {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const [slide, setSlide] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [logoVisible, setLogoVisible] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  const current = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  // Initial entrance animation
  useEffect(() => {
    const t1 = setTimeout(() => setLogoVisible(true), 200);
    const t2 = setTimeout(() => setContentVisible(true), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // When slide changes, animate content out then in
  const goNext = () => {
    if (animating) return;
    if (isLast) { onDone(); return; }
    setAnimating(true);
    setContentVisible(false);
    setTimeout(() => {
      setSlide((s) => s + 1);
      setContentVisible(true);
      setAnimating(false);
    }, 350);
  };

  const goToSlide = (idx: number) => {
    if (animating || idx === slide) return;
    setAnimating(true);
    setContentVisible(false);
    setTimeout(() => {
      setSlide(idx);
      setContentVisible(true);
      setAnimating(false);
    }, 350);
  };

  return (
    <div className={`fixed inset-0 z-[9999] bg-gradient-to-br ${current.bg} flex flex-col transition-all duration-700`}>

      {/* Subtle animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-5 animate-pulse"
            style={{
              width: `${120 + i * 60}px`,
              height: `${120 + i * 60}px`,
              background: "white",
              top: `${10 + i * 13}%`,
              left: `${5 + i * 17}%`,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${3 + i * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* Skip button */}
      <div className="relative z-10 flex justify-end px-6 pt-6">
        <button
          onClick={onDone}
          className="text-white/40 text-sm font-medium hover:text-white/70 transition-colors px-3 py-1.5"
        >
          Skip
        </button>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center">

        {/* Logo / Icon ring */}
        <div
          className={`transition-all duration-700 ${logoVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-75"}`}
        >
          <div className="relative mb-8">
            {/* Outer glow ring */}
            <div className={`absolute inset-0 rounded-full ${current.accent} opacity-20 blur-2xl scale-150`} />
            {/* Icon container */}
            <div className="relative h-28 w-28 rounded-[2rem] bg-white/10 border border-white/15 backdrop-blur-sm flex items-center justify-center shadow-2xl">
              {current.icon}
            </div>
          </div>
        </div>

        {/* Badge + Text */}
        <div
          className={`transition-all duration-500 ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          <span className={`inline-block text-[11px] font-bold tracking-widest uppercase ${current.accent} text-white px-3 py-1 rounded-full mb-5`}>
            {current.badge}
          </span>

          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4 whitespace-pre-line">
            {current.headline}
          </h1>

          <p className="text-sm sm:text-base text-white/60 leading-relaxed max-w-xs mx-auto font-medium">
            {current.sub}
          </p>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 px-8 pb-12 flex flex-col items-center gap-6">

        {/* Progress dots */}
        <div className="flex items-center gap-2.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className={`rounded-full transition-all duration-300 ${
                i === slide
                  ? `w-7 h-2.5 ${current.accent}`
                  : "w-2.5 h-2.5 bg-white/20 hover:bg-white/40"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={goNext}
          className={`w-full max-w-sm py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 shadow-xl transition-all duration-200 active:scale-[0.97] ${current.accent} text-white hover:opacity-90`}
        >
          {isLast ? "Start Reporting" : "Continue"}
          <ChevronRight size={20} className={isLast ? "hidden" : ""} />
        </button>

        {/* Legalese */}
        <p className="text-white/25 text-xs text-center max-w-xs leading-relaxed">
          By continuing you agree to share your location and photos with DEWECS emergency response officers.
        </p>
      </div>
    </div>
  );
}
