import { createUc1Module, type Uc1Module } from './index';

const g = globalThis as unknown as { uc1Module?: Uc1Module };

export function getUc1Module(): Uc1Module {
  if (!g.uc1Module) {
    g.uc1Module = createUc1Module();
  }
  return g.uc1Module;
}

export function resetUc1ModuleForTesting(): void {
  delete g.uc1Module;
}
