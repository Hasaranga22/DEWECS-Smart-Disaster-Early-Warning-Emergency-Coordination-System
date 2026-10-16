import { describe, it, expect } from "vitest";
import { Shelter } from "../domain/entities/Shelter";
import { OverCapacityError, InvalidQuantityError } from "../domain/errors";

describe("Shelter (Domain Entity)", () => {
  const districtId = "00000000-0000-4000-8000-000000000010";
  const orgId = "00000000-0000-4000-8000-000000000100";

  it("should initialize with OPEN status when occupancy is less than capacity", () => {
    const shelter = new Shelter({
      id: "shelter-ent-1",
      districtId,
      organizationId: orgId,
      name: "St. Anthony Hall",
      address: "Kochchikade, Colombo",
      capacity: 100,
      occupancy: 40,
    });

    expect(shelter.status).toBe("OPEN");
    expect(shelter.availableCapacity).toBe(60);
  });

  it("should initialize with FULL status when occupancy equals capacity", () => {
    const shelter = new Shelter({
      id: "shelter-ent-2",
      districtId,
      organizationId: orgId,
      name: "St. Anthony Hall",
      address: "Kochchikade, Colombo",
      capacity: 100,
      occupancy: 100,
    });

    expect(shelter.status).toBe("FULL");
    expect(shelter.availableCapacity).toBe(0);
  });

  it("should update occupancy and transition between OPEN and FULL immutably", () => {
    const shelter = new Shelter({
      id: "shelter-ent-3",
      districtId,
      organizationId: orgId,
      name: "Community Hall",
      address: "Colombo",
      capacity: 50,
      occupancy: 10,
    });

    // Fill to 50
    const full = shelter.withOccupancy(50);
    expect(full.status).toBe("FULL");
    expect(full.occupancy).toBe(50);
    expect(shelter.occupancy).toBe(10); // original is unchanged

    // Reduce back to 30
    const reopened = full.withOccupancy(30);
    expect(reopened.status).toBe("OPEN");
    expect(reopened.occupancy).toBe(30);
  });

  it("should throw OverCapacityError when new occupancy exceeds capacity", () => {
    const shelter = new Shelter({
      id: "shelter-ent-4",
      districtId,
      organizationId: orgId,
      name: "Small Shelter",
      address: "Colombo",
      capacity: 20,
      occupancy: 5,
    });

    expect(() =>
      shelter.withOccupancy(25, [
        { id: "alt-1", name: "Nearby Big Hall", availableCapacity: 50 },
      ])
    ).toThrow(OverCapacityError);
  });

  it("should throw InvalidQuantityError when occupancy is negative", () => {
    const shelter = new Shelter({
      id: "shelter-ent-5",
      districtId,
      organizationId: orgId,
      name: "Normal Shelter",
      address: "Colombo",
      capacity: 50,
      occupancy: 0,
    });

    expect(() => shelter.withOccupancy(-5)).toThrow(InvalidQuantityError);
  });

  it("should serialize properly via toJSON()", () => {
    const shelter = new Shelter({
      id: "shelter-json",
      districtId,
      organizationId: orgId,
      name: "JSON Center",
      address: "Main St",
      capacity: 40,
      occupancy: 10,
    });

    const json = shelter.toJSON();
    expect(json.id).toBe("shelter-json");
    expect(json.name).toBe("JSON Center");
    expect(json.status).toBe("OPEN");
  });
});
