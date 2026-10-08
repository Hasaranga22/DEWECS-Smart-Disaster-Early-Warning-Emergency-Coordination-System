import { Suspense } from 'react';
import { AlertDetailClient } from './AlertDetailClient';

export default async function AlertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md py-16 text-center text-sm text-gray-500">
          Loading citizen alert receipt...
        </div>
      }
    >
      <AlertDetailClient alertId={id} />
    </Suspense>
  );
}
