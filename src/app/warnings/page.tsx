import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { actorFromRoleValue, ROLE_COOKIE } from '@/shared/access';
import { WarningsClient } from './WarningsClient';

async function WarningsLoader() {
  const cookieStore = await cookies();
  const roleCookie = cookieStore.get(ROLE_COOKIE)?.value;
  const actor = actorFromRoleValue(roleCookie);

  return <WarningsClient currentRole={actor.role} />;
}

export default function WarningsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl py-12 text-center text-sm text-gray-500">
          Loading Warnings module...
        </div>
      }
    >
      <WarningsLoader />
    </Suspense>
  );
}
