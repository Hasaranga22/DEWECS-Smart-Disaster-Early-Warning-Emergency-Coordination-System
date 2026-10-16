/**
 * Generic repository interface pattern for DEWECS entities.
 */
export interface Repository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}
