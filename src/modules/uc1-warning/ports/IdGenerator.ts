// TODO: Move to src/shared/contracts/IdGenerator.ts once shared contracts package is created
export interface IdGenerator {
  next(): string;
}
