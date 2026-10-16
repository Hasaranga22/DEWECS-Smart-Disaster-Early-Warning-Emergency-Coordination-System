import React from 'react';

export function HotlinesBar() {
  return (
    <div className="rounded-lg bg-slate-900 p-3 text-center text-white text-xs">
      <p className="font-bold uppercase tracking-wider text-slate-200">
        NATIONAL EMERGENCY HOTLINES
      </p>
      <div className="mt-1 flex justify-center gap-4 text-sm font-extrabold text-amber-400">
        <span>DMC: 117</span>
        <span>POLICE: 119</span>
        <span>AMBULANCE: 1990</span>
      </div>
    </div>
  );
}
