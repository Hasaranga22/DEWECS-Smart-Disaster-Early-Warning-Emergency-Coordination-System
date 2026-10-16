"use client";

import { useEffect, useState } from "react";
import { ChevronRight, ShieldCheck } from "lucide-react";

const SLIDES = [
  {
    eyebrow: "DEWECS · Sri Lanka",
    title: "Help reaches people\nfaster together.",
    imagePosition: "0% 0%",
  },
  {
    eyebrow: "Report clearly",
    title: "Show responders\nwhat is happening.",
    imagePosition: "100% 0%",
  },
  {
    eyebrow: "Share your location",
    title: "Help finds the\nright place.",
    imagePosition: "0% 100%",
  },
  {
    eyebrow: "Ready anywhere",
    title: "Your report works\neven offline.",
    imagePosition: "100% 100%",
  },
] as const;

interface OnboardingScreenProps {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const [slide, setSlide] = useState(0);
  const current = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  const goTo = (nextSlide: number) => {
    if (nextSlide >= 0 && nextSlide < SLIDES.length) setSlide(nextSlide);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") goTo(slide + 1);
      if (event.key === "ArrowLeft") goTo(slide - 1);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <main className="fixed inset-0 z-[9999] overflow-hidden bg-slate-950 text-white">
      <div
        className="absolute inset-0 bg-cover bg-no-repeat transition-[background-position] duration-700"
        style={{
          backgroundImage: "url('/images/onboarding-stories.png')",
          backgroundPosition: current.imagePosition,
          backgroundSize: "200% 200%",
        }}
        role="img"
        aria-label="DEWECS community emergency response"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/5 to-slate-950" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-5 py-5 sm:px-8 sm:py-7">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-950/45 text-teal-300 backdrop-blur-sm">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <span className="text-sm font-extrabold tracking-tight">DEWECS</span>
          </div>
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg px-2 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
          >
            Skip
          </button>
        </header>

        <section className="mt-auto max-w-2xl pb-4 sm:pb-7" aria-live="polite">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-teal-300">{current.eyebrow}</p>
          <h1 className="whitespace-pre-line text-4xl font-black leading-[1.02] tracking-[-0.045em] text-white drop-shadow-lg sm:text-6xl">
            {current.title}
          </h1>
        </section>

        <footer className="flex items-center gap-4 border-t border-white/15 pt-4 sm:gap-6 sm:pt-5">
          <div className="flex flex-1 items-center gap-2" role="tablist" aria-label="Onboarding steps">
            {SLIDES.map((item, index) => (
              <button
                key={item.eyebrow}
                type="button"
                onClick={() => goTo(index)}
                role="tab"
                aria-selected={index === slide}
                aria-label={`Go to step ${index + 1}`}
                className={`h-1.5 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 ${index === slide ? "w-8 bg-teal-300" : "w-1.5 bg-white/45 hover:bg-white/70"}`}
              />
            ))}
          </div>
          <span className="text-xs font-semibold tabular-nums text-white/55">{slide + 1} / {SLIDES.length}</span>
          <button
            type="button"
            onClick={() => (isLast ? onDone() : goTo(slide + 1))}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-300 px-5 text-sm font-extrabold text-slate-950 shadow-lg shadow-black/20 transition hover:bg-teal-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 active:scale-[0.98]"
          >
            {isLast ? "Start" : "Continue"}
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </footer>
      </div>
    </main>
  );
}
