import { cookies } from 'next/headers';
import { actorFromRoleValue, ROLE_COOKIE } from '@/shared/access';
import { RoleSwitcher } from './RoleSwitcher';

export async function RoleSwitcherLoader() {
  const value = (await cookies()).get(ROLE_COOKIE)?.value;
  return <RoleSwitcher current={actorFromRoleValue(value).role} />;
}