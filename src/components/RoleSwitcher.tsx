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
    <label className="flex items-center gap-2 text-sm">
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
        className="rounded border px-2 py-1"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
    </label>
  );
}