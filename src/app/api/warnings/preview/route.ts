import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUc1Module } from '@/modules/uc1-warning/container';
import { getActor, requireRole } from '@/shared/access';
import { handleApiError } from '../errorHandler';

const previewSchema = z
  .object({
    districtIds: z.array(z.string()).optional(),
    basinId: z.string().optional(),
  })
  .refine(
    (data) => (data.districtIds && data.districtIds.length > 0) || Boolean(data.basinId),
    {
      message: 'Must provide at least one target district or a river basin',
      path: ['target'],
    },
  );

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    requireRole(actor, ['DMC_OFFICIAL']);

    const body = await request.json();
    const validated = previewSchema.parse(body);

    const uc1 = getUc1Module();
    const result = await uc1.warningService.preview({
      districtIds: validated.districtIds,
      basinId: validated.basinId,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
