import type { Clock } from '../ports/Clock';
import type { ChannelGateway, GatewaySendParams, GatewaySendResult } from './ChannelGateway';

export interface MockSmsGatewayOptions {
  failureRate?: number;
  randomSource?: () => number;
  clock: Clock;
}

export class MockSmsGateway implements ChannelGateway {
  public readonly channel = 'SMS' as const;
  public readonly sentMessages: GatewaySendParams[] = [];
  private failureRate: number;
  private randomSource: () => number;
  private clock: Clock;

  constructor(options: MockSmsGatewayOptions) {
    this.failureRate = options.failureRate ?? 0;
    this.randomSource = options.randomSource ?? (() => Math.random());
    this.clock = options.clock;
  }

  public setFailureRate(rate: number): void {
    this.failureRate = rate;
  }

  public setRandomSource(source: () => number): void {
    this.randomSource = source;
  }

  public async send(params: GatewaySendParams): Promise<GatewaySendResult> {
    this.sentMessages.push({ ...params });

    const rand = this.randomSource();
    if (rand < this.failureRate) {
      return {
        success: false,
        errorReason: 'SMS gateway network error: delivery failed',
      };
    }

    return {
      success: true,
      deliveredAt: this.clock.now(),
    };
  }
}
