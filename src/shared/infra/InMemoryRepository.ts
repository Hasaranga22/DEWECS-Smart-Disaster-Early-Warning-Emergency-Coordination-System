import { Repository } from "./Repository";

/**
 * Base in-memory repository implementation stored on globalThis.
 * Provides snapshot and restore capabilities for atomic transactions.
 */
export class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  private readonly storageKey: string;

  constructor(storageKey: string) {
    this.storageKey = `dewecs_in_memory_${storageKey}`;
    const g = globalThis as unknown as Record<string, Map<string, T>>;
    if (!g[this.storageKey]) {
      g[this.storageKey] = new Map<string, T>();
    }
  }

  private get items(): Map<string, T> {
    const g = globalThis as unknown as Record<string, Map<string, T>>;
    return g[this.storageKey];
  }

  public async findById(id: string): Promise<T | null> {
    const item = this.items.get(id);
    return item ? { ...item } : null;
  }

  public async findAll(): Promise<T[]> {
    return Array.from(this.items.values()).map((item) => ({ ...item }));
  }

  public async save(entity: T): Promise<void> {
    this.items.set(entity.id, { ...entity });
  }

  public async delete(id: string): Promise<void> {
    this.items.delete(id);
  }

  /** Captures a snapshot of current map state. */
  public snapshot(): Map<string, T> {
    const copy = new Map<string, T>();
    for (const [key, value] of this.items.entries()) {
      copy.set(key, { ...value });
    }
    return copy;
  }

  /** Restores state from a snapshot. */
  public restore(snapshot: Map<string, T>): void {
    this.items.clear();
    for (const [key, value] of snapshot.entries()) {
      this.items.set(key, { ...value });
    }
  }

  /** Clears all items in this repository. */
  public clear(): void {
    this.items.clear();
  }
}
