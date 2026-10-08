import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUc1Module } from '@/modules/uc1-warning';
import { getActor, requireRole } from '@/shared/access';
import { handleApiError } from '../errorHandler';

const previewSchema = z.object({
  target: z.object({
    districtIds: z.array(z.string()).optional(),
    basinId: z.string().optional(),
  }),
});

export async function POST(request: Request) {
  try {
    const actor = getActor(request);
    requireRole(actor, ['DMC_OFFICIAL']);

    const body = await request.json();
    const parsed = previewSchema.parse(body);

    const uc1 = getUc1Module();
    const result = await uc1.warningService.preview(parsed.target);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
