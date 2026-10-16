import React from 'react';

export function ActionChecklist() {
  return (
    <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-950">
      <p className="font-bold uppercase tracking-wider text-blue-900">
        IMMEDIATE CITIZEN ACTIONS:
      </p>
      <ul className="list-disc space-y-1 pl-4 text-blue-950">
        <li>Move to higher ground if situated near river banks or steep slopes.</li>
        <li>Keep battery-operated radio tuned to disaster updates.</li>
        <li>Disconnect non-essential electrical appliances.</li>
        <li>Assist children, senior citizens, and persons with disabilities.</li>
      </ul>
    </div>
  );
}
