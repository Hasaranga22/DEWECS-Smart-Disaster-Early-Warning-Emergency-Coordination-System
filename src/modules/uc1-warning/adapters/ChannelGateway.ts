import type { NotificationChannel } from '../domain';

export interface GatewaySendParams {
  attemptId: string;
  alertId: string;
  citizenId: string;
  destination: string; // phone number or push token
  message: string;
}

export interface GatewaySendResult {
  success: boolean;
  deliveredAt?: Date;
  errorReason?: string;
}

export interface ChannelGateway {
  readonly channel: NotificationChannel;
  send(params: GatewaySendParams): Promise<GatewaySendResult>;
}
