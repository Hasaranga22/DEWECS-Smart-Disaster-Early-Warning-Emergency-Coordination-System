// TODO: Move to src/shared/contracts/AttemptReader.ts once shared contracts package is created
import type { NotificationAttempt } from '../domain/NotificationAttempt';
import type { Filter } from './types';

export interface AttemptReader {
  listAttempts(f: Filter): NotificationAttempt[] | Promise<NotificationAttempt[]>;
}
