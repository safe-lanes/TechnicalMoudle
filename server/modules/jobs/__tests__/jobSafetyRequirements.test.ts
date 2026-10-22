import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildJobSafetyUpdate, getJobSafetyList } from "../../../../client/src/lib/jobSafetyRequirements";

vi.mock("../repositories/jobRepository", () => ({
  findById: vi.fn(),
  findComponent: vi.fn(),
  update: vi.fn(),
}));

import * as repo from "../repositories/jobRepository";
import { updateJob } from "../services/jobService";

const existing = {
  ppeRequirements: ["Helmet", "Safety gloves"],
  permitRequirements: ["Hot Work Permit"],
  otherRequirements: ["Lockout, tagout"],
};

describe("Job Form safety requirement saves", () => {
  it("does not include safety requirements when only other job fields were edited", () => {
    expect(buildJobSafetyUpdate(existing, {})).toBeUndefined();
  });

  it("saves all three fields as lists, trimming only at save time", () => {
    expect(buildJobSafetyUpdate(existing, {
      ppeRequirements: "  Goggles  \n\nSafety boots ",
      permitRequirements: " Confined Space Permit\r\nHot Work Permit ",
      otherRequirements: "Isolate power\nConfirm ventilation",
    })).toEqual({
      ppeRequirements: ["Goggles", "Safety boots"],
      permitRequirements: ["Confined Space Permit", "Hot Work Permit"],
      otherRequirements: ["Isolate power", "Confirm ventilation"],
    });
  });

  it("allows clearing all fields", () => {
    expect(buildJobSafetyUpdate(existing, {
      ppeRequirements: "",
      permitRequirements: "  \n",
      otherRequirements: "",
    })).toEqual({ ppeRequirements: [], permitRequirements: [], otherRequirements: [] });
  });

  it("preserves untouched lists, commas within an item, and additional metadata", () => {
    const source = { ...existing, otherRequirements: [" Retain exact text "], extra: { source: "manual" } };
    expect(buildJobSafetyUpdate(source, { ppeRequirements: "Face shield, goggles" })).toEqual({
      ...source,
      ppeRequirements: ["Face shield, goggles"],
    });
    expect(source.ppeRequirements).toEqual(existing.ppeRequirements);
  });

  it("detects unchanged draft values", () => {
    expect(buildJobSafetyUpdate(existing, { ppeRequirements: "Helmet\nSafety gloves" })).toBeUndefined();
  });

  it("supports adding requirements to an empty job", () => {
    expect(getJobSafetyList(undefined, "ppeRequirements")).toEqual([]);
    expect(buildJobSafetyUpdate({
      ppeRequirements: [], permitRequirements: [], otherRequirements: [],
    }, { otherRequirements: "Check isolation" })).toEqual({
      ppeRequirements: [], permitRequirements: [], otherRequirements: ["Check isolation"],
    });
  });
});

describe("Existing job backend safety requirements contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.findById).mockResolvedValue({
      id: "job-safety-test",
      maintenanceBasis: "Calendar",
      frequencyValue: "1",
      frequencyUnit: "Months",
      safetyRequirements: existing,
    } as any);
    vi.mocked(repo.update).mockImplementation(async (_id, data) => ({
      id: "job-safety-test", ...data,
    }) as any);
  });

  it("passes safety-only updates to storage without a schema or endpoint change", async () => {
    const safetyRequirements = buildJobSafetyUpdate(existing, {
      ppeRequirements: "Goggles\nSafety boots",
      permitRequirements: "",
      otherRequirements: "Isolate power",
    });
    const result = await updateJob("job-safety-test", { safetyRequirements });
    expect(repo.update).toHaveBeenCalledWith("job-safety-test", { safetyRequirements });
    expect(result.safetyRequirements).toEqual(safetyRequirements);
  });

  it("does not overwrite safety requirements when an unrelated field is saved", async () => {
    await updateJob("job-safety-test", { jobTitle: "Updated inspection title" });
    expect(repo.update).toHaveBeenCalledWith("job-safety-test", { jobTitle: "Updated inspection title" });
  });
});