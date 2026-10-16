'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ROLES, type Role } from '@/shared/domain';
import { ROLE_LABELS } from '@/shared/access';
import { setRole } from './roleActions';

export function RoleSwitcher({ current }: { current: Role }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
      <span>Role:</span>
      <select
        value={current}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await setRole(e.target.value);
            router.refresh();
          })
        }
        className="rounded-md border-2 border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer disabled:opacity-60"
      >
        {ROLES.map((r) => (
          <option key={r} value={r} className="bg-white text-slate-900">
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
    </label>
  );
}