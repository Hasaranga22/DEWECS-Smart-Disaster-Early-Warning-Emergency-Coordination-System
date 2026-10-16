import { IdGenerator } from "../contracts/IdGenerator";

/** UUID generator implementation for production runtime using crypto.randomUUID(). */
export class UuidGenerator implements IdGenerator {
  public next(): string {
    return crypto.randomUUID();
  }
}
