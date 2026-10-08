export interface DistrictAdjacency {
  areAdjacent(districtAId: string, districtBId: string): Promise<boolean>;
  getAdjacentDistrictIds(districtId: string): Promise<string[]>;
}

/**
 * Static district adjacency adapter mapping standard Sri Lankan disaster river basins (e.g. Kelani basin).
 * Colombo, Gampaha, Kegalle are defined as adjacent districts.
 */
export class StaticDistrictAdjacency implements DistrictAdjacency {
  private readonly adjacencyMap: Map<string, Set<string>> = new Map();

  constructor(customPairs?: Array<[string, string]>) {
    const pairs = customPairs ?? [
      ["Colombo", "Gampaha"],
      ["Colombo", "Kegalle"],
      ["Gampaha", "Kegalle"],
    ];

    for (const [a, b] of pairs) {
      this.addPair(a, b);
    }
  }

  private addPair(a: string, b: string): void {
    if (!this.adjacencyMap.has(a)) this.adjacencyMap.set(a, new Set());
    if (!this.adjacencyMap.has(b)) this.adjacencyMap.set(b, new Set());
    this.adjacencyMap.get(a)!.add(b);
    this.adjacencyMap.get(b)!.add(a);
  }

  public async areAdjacent(districtAId: string, districtBId: string): Promise<boolean> {
    if (districtAId === districtBId) return true;
    const adjacent = this.adjacencyMap.get(districtAId);
    return adjacent ? adjacent.has(districtBId) : false;
  }

  public async getAdjacentDistrictIds(districtId: string): Promise<string[]> {
    const adjacent = this.adjacencyMap.get(districtId);
    return adjacent ? Array.from(adjacent) : [];
  }
}
