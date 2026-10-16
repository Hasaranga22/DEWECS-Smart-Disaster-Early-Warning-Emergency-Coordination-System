import { get, update } from 'idb-keyval';
import { LocalOutboxEntry } from '../domain/LocalOutboxEntry';

const OUTBOX_KEY = 'dewecs_uc2_outbox';

export class IdbOutboxRepository {
  async save(entry: LocalOutboxEntry): Promise<void> {
    await update(OUTBOX_KEY, (val: LocalOutboxEntry[] = []) => {
      const existingIdx = val.findIndex(e => e.localId === entry.localId);
      if (existingIdx >= 0) {
        val[existingIdx] = entry;
        return val;
      }
      return [...val, entry];
    });
  }

  async getAll(): Promise<LocalOutboxEntry[]> {
    return (await get<LocalOutboxEntry[]>(OUTBOX_KEY)) || [];
  }

  async getPending(): Promise<LocalOutboxEntry[]> {
    const all = await this.getAll();
    return all.filter(e => e.status === 'PENDING_SYNC' || e.status === 'FAILED');
  }

  async remove(localId: string): Promise<void> {
    await update(OUTBOX_KEY, (val: LocalOutboxEntry[] = []) => {
      return val.filter(e => e.localId !== localId);
    });
  }
}
