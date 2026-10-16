import { describe, it, expect, beforeEach } from "vitest";
import { ReportValidator, ReportDraft } from "../services/ReportValidator";
import { InMemoryReportRepository } from "../adapters/InMemoryReportRepository";
import { ValidationError } from "../domain/errors";
import { SequentialIdGenerator, StaticClock } from "./TestMocks";

describe("ReportValidator (G01 & G04)", () => {
  let reports: InMemoryReportRepository;
  let clock: StaticClock;
  let ids: SequentialIdGenerator;
  let validator: ReportValidator;

  beforeEach(() => {
    reports = new InMemoryReportRepository();
    reports.clear();
    clock = new StaticClock();
    ids = new SequentialIdGenerator();
    validator = new ReportValidator(reports, clock, ids);
  });

  const validDraft: ReportDraft = {
    reporterId: "cit-1",
    districtId: "colombo",
    hazardType: "FLOOD",
    description: "Water on road",
    latitude: 6.9271,
    longitude: 79.8612,
    locationSource: "GPS",
    localId: "local-1",
    captureTime: new Date("2026-01-01T10:00:00Z"),
  };

  it("G01: returns invalidFields when hazardType is missing without saving or discarding draft", () => {
    const draftWithoutHazard = { ...validDraft, hazardType: "" as any };
    const result = validator.validate(draftWithoutHazard);

    expect(result.isValid).toBe(false);
    expect(result.invalidFields).toContain("hazardType");
  });

  it("G01: returns invalidFields when latitude or longitude is missing", () => {
    const draftWithoutLoc = { ...validDraft, latitude: NaN };
    const result = validator.validate(draftWithoutLoc);

    expect(result.isValid).toBe(false);
    expect(result.invalidFields).toContain("location");
  });

  it("G01: throws ValidationError and does not save report if validateAndSave called with incomplete draft", async () => {
    const draftIncomplete = { ...validDraft, hazardType: "" as any };

    await expect(validator.validateAndSave(draftIncomplete)).rejects.toThrow(ValidationError);
    const all = await reports.findAll();
    expect(all).toHaveLength(0);
  });

  it("G04: resolves confidence as REDUCED when no photo is provided", async () => {
    const draftNoPhoto = { ...validDraft, photo: undefined };
    const report = await validator.validateAndSave(draftNoPhoto);

    expect(report.confidence).toBe("REDUCED");
  });

  it("G04: resolves confidence as FULL when photo is present", async () => {
    const draftWithPhoto = { ...validDraft, photo: "data:image/jpeg;base64,mock" };
    const report = await validator.validateAndSave(draftWithPhoto);

    expect(report.confidence).toBe("FULL");
  });

  it("provides fallback description when description is empty or whitespace", async () => {
    const draftEmptyDesc = { ...validDraft, description: "   " };
    const report = await validator.validateAndSave(draftEmptyDesc);

    expect(report.description).toBe("Incident reported without description.");
  });

  it("successfully persists valid draft as PENDING_REVIEW with version 0", async () => {
    const report = await validator.validateAndSave(validDraft);

    expect(report.reviewStatus).toBe("PENDING_REVIEW");
    expect(report.version).toBe(0);

    const saved = await reports.findById(report.id);
    expect(saved).not.toBeNull();
    expect(saved?.id).toBe(report.id);
  });
});
