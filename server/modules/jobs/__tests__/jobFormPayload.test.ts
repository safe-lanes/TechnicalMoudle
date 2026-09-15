import { describe, expect, it } from "vitest";
import {
  buildDraftJobPayload,
  mapLastCompletedOnToLastDoneDate,
} from "../../../../client/src/lib/jobFormPayload";

describe("buildDraftJobPayload", () => {
  it("maps the live vessel Job form value to the canonical lastDoneDate field", () => {
    expect(mapLastCompletedOnToLastDoneDate("2026-09-15")).toBe("2026-09-15");
    expect(mapLastCompletedOnToLastDoneDate(" 2026-09-15 ")).toBe("2026-09-15");
    expect(mapLastCompletedOnToLastDoneDate("")).toBeNull();
  });

  it("maps the form Last Done Date to the Job lastDoneDate API field", () => {
    const payload = buildDraftJobPayload(
      {
        jobTitle: "Weekly inspection",
        maintenanceType: "Inspection",
        maintenanceBasis: "Calendar",
        frequencyValue: "1",
        frequencyUnit: "Weeks",
        lastDoneDate: "2026-09-15",
        lastDoneRH: "",
        assignedTo: "Chief Engineer",
        jobPriority: "Medium",
        briefWorkDescription: "",
      },
      {
        cuuid: "component-1",
        componentCode: "278.010.01",
        name: "Main engine",
      },
      "vessel-1",
    );

    expect(payload).toMatchObject({
      lastDoneDate: "2026-09-15",
      componentId: "component-1",
      vesselId: "vessel-1",
    });
    expect(payload).not.toHaveProperty("lastCompletedDate");
  });
});