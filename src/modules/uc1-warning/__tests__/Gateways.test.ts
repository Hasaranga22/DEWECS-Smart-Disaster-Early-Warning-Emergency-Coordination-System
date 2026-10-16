import { describe, expect, it } from 'vitest';
import { FakeClock } from '../adapters/fakes/FakeClock';
import { MockPushGateway } from '../adapters/MockPushGateway';
import { MockSmsGateway } from '../adapters/MockSmsGateway';

describe('Channel Gateways (MockSmsGateway and MockPushGateway)', () => {
  const clock = new FakeClock('2026-10-08T10:00:00.000Z');

  it('MockSmsGateway succeeds deterministically when failure rate is 0', async () => {
    const gateway = new MockSmsGateway({ failureRate: 0, clock });
    const result = await gateway.send({
      attemptId: 'att-1',
      alertId: 'alert-1',
      citizenId: 'cit-1',
      destination: '+94771234567',
      message: 'Test alert message',
    });

    expect(result.success).toBe(true);
    expect(result.deliveredAt).toEqual(clock.now());
    expect(gateway.sentMessages).toHaveLength(1);
  });

  it('MockSmsGateway fails deterministically when randomSource is below failure rate', async () => {
    // failureRate = 0.5, randomSource returns 0.3 (< 0.5) -> fails
    const gateway = new MockSmsGateway({
      failureRate: 0.5,
      randomSource: () => 0.3,
      clock,
    });

    const result = await gateway.send({
      attemptId: 'att-1',
      alertId: 'alert-1',
      citizenId: 'cit-1',
      destination: '+94771234567',
      message: 'Test message',
    });

    expect(result.success).toBe(false);
    expect(result.errorReason).toBeDefined();
  });

  it('MockPushGateway respects injectable failure rate and random source', async () => {
    const gateway = new MockPushGateway({
      failureRate: 0.2,
      randomSource: () => 0.5, // 0.5 > 0.2 -> success
      clock,
    });

    const successResult = await gateway.send({
      attemptId: 'att-1',
      alertId: 'alert-1',
      citizenId: 'cit-1',
      destination: 'push-token-123',
      message: 'Alert message',
    });
    expect(successResult.success).toBe(true);

    gateway.setRandomSource(() => 0.1); // 0.1 < 0.2 -> fails
    const failResult = await gateway.send({
      attemptId: 'att-2',
      alertId: 'alert-1',
      citizenId: 'cit-2',
      destination: 'push-token-456',
      message: 'Alert message',
    });
    expect(failResult.success).toBe(false);
  });
});
