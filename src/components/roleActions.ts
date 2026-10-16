'use server';

import { cookies } from 'next/headers';
import { isRole, ROLE_COOKIE } from '@/shared/access';

export async function setRole(role: string): Promise<void> {
  if (!isRole(role)) return;
  (await cookies()).set(ROLE_COOKIE, role, { path: '/', sameSite: 'lax' });
}