import React from 'react';

interface StepperProps {
  step: 1 | 2 | 3;
}

export function Stepper({ step }: StepperProps) {
  return (
    <div className="flex items-center justify-between border-2 border-slate-200 bg-white p-4 rounded-xl shadow-sm w-full">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${
            step === 1 ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-slate-200 text-slate-700'
          }`}
        >
          1
        </span>
        <span className={`text-sm ${step === 1 ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-600'}`}>
          Composer & Evidence
        </span>
      </div>
      <div className="h-0.5 flex-1 mx-4 bg-slate-300 hidden sm:block" />
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${
            step === 2 ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-slate-200 text-slate-700'
          }`}
        >
          2
        </span>
        <span className={`text-sm ${step === 2 ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-600'}`}>
          Preview & Estimates
        </span>
      </div>
      <div className="h-0.5 flex-1 mx-4 bg-slate-300 hidden sm:block" />
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${
            step === 3 ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-slate-200 text-slate-700'
          }`}
        >
          3
        </span>
        <span className={`text-sm ${step === 3 ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-600'}`}>
          Delivery Outcome
        </span>
      </div>
    </div>
  );
}
