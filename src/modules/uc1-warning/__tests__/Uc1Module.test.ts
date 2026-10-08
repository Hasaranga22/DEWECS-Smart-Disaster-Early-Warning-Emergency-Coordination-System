import { describe, expect, it } from 'vitest';
import { D } from '@/shared/seed';
import { createUc1Module } from '../index';

describe('createUc1Module factory', () => {
  it('instantiates the UC1 module with all required services and adapters', async () => {
    const uc1 = createUc1Module();
    expect(uc1.warningService).toBeDefined();
    expect(uc1.queryService).toBeDefined();
    expect(uc1.targetResolver).toBeDefined();
    expect(uc1.alertRepo).toBeDefined();
    expect(uc1.notificationStore).toBeDefined();
    expect(uc1.smsGateway).toBeDefined();
    expect(uc1.pushGateway).toBeDefined();
    expect(uc1.clock).toBeDefined();
    expect(uc1.idGen).toBeDefined();

    // Verify preview works through factory using seeded Colombo district ID
    const preview = await uc1.warningService.preview({
      districtIds: [D.COLOMBO],
    });
    expect(preview.estimatedRecipients).toBeGreaterThan(0);
  });
});
