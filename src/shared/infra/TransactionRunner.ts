import { InMemoryRepository } from "./InMemoryRepository";

/**
 * Unit of Work interface for atomic multi-repository writes.
 */
export interface TransactionRunner {
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
}

/**
 * In-memory implementation of TransactionRunner.
 * Captures snapshots of all registered in-memory repositories before executing work,
 * and restores state if an error is thrown.
 */
export class InMemoryTransactionRunner implements TransactionRunner {
  private readonly repositories: InMemoryRepository<any>[];

  constructor(repositories: InMemoryRepository<any>[] = []) {
    this.repositories = repositories;
  }

  public async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    const snapshots = this.repositories.map((repo) => repo.snapshot());
    try {
      return await work();
    } catch (error) {
      // Rollback all registered repositories to their snapshot state
      this.repositories.forEach((repo, index) => {
        repo.restore(snapshots[index]);
      });
      throw error;
    }
  }
}
