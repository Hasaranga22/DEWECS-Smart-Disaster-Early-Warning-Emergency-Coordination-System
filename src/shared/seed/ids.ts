// Deterministic UUID-shaped ids: stable across runs, valid for Prisma UUID columns.
export function seedId(group: number, n: number): string {
  const g = group.toString(16).padStart(4, '0');
  const num = n.toString(16).padStart(12, '0');
  return `00000000-${g}-4000-8000-${num}`;
}