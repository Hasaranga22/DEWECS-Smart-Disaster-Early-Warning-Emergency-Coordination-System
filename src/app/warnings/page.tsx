import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { actorFromRoleValue, ROLE_COOKIE } from '@/shared/access';
import { WarningsClient } from './WarningsClient';

async function WarningsLoader() {
  const cookieStore = await cookies();
  const roleVal = cookieStore.get(ROLE_COOKIE)?.value;
  const actor = actorFromRoleValue(roleVal);

  const allowedRoles = ['DMC_OFFICIAL', 'DUTY_OFFICER', 'DISTRICT_OFFICER'];
  if (!allowedRoles.includes(actor.role)) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-6 text-center text-amber-950 shadow-sm mt-8">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
          ⚠️
        </div>
        <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
        <p className="mt-2 text-sm text-slate-800">
          The Hazard Warnings Console is restricted to disaster management personnel (<strong>DMC Official</strong>,{' '}
          <strong>Duty Officer</strong>, or <strong>District Officer</strong>).
        </p>
        <p className="mt-2 text-xs text-slate-700">
          Currently acting as: <span className="font-semibold text-slate-900">{actor.role}</span>.
        </p>
        <div className="mt-4 rounded bg-white p-3 text-xs text-slate-700 border border-slate-200">
          <p className="font-bold text-slate-900">Role Switcher</p>
          <p className="mt-1 text-slate-700">
            Please use the <strong>Role Switcher</strong> dropdown at the top right of the navigation
            bar to select <strong>DMC Official</strong> to compose and issue hazard warnings.
          </p>
        </div>
      </div>
    );
  }

  return <WarningsClient actorRole={actor.role} actorUserId={actor.userId} actorDistrictId={actor.districtId} />;
}

export default function WarningsPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full py-12 text-center text-sm font-medium text-slate-700 animate-pulse">
          Loading Hazard Warning Console...
        </div>
      }
    >
      <WarningsLoader />
    </Suspense>
  );
}
