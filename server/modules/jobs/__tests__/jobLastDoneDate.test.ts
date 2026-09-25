import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  findById: vi.fn(),
  findComponent: vi.fn(),
  findComponentByCode: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../repositories/jobRepository", () => repo);

describe("Job form Last Completed Date persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findComponent.mockResolvedValue({
      cuuid: "component-1",
      parentId: "parent-1",
      componentCode: "278.010.01",
      name: "Main engine",
    });
    repo.create.mockImplementation(async data => data);
    repo.update.mockImplementation(async (_id, data) => data);
  });

  it("normalizes and persists the form lastDoneDate in the Job record", async () => {
    const { createJob } = await import("../services/jobService");

    const job = await createJob({
      jobNo: "TEST-001",
      jobTitle: "Weekly inspection",
      vesselId: "vessel-1",
      componentId: "component-1",
      maintenanceBasis: "Calendar",
      frequencyValue: "1",
      frequencyUnit: "Weeks",
      lastDoneDate: "2026-09-15",
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ lastDoneDate: "15-Sep-2026" }),
    );
    expect(job.lastDoneDate).toBe("15-Sep-2026");
  });

  it("accepts Last Completed Date as an API alias for jobs.last_done_date", async () => {
    const { createJob } = await import("../services/jobService");

    await createJob({
      jobNo: "TEST-002",
      jobTitle: "Monthly inspection",
      vesselId: "vessel-1",
      componentId: "component-1",
      maintenanceBasis: "Calendar",
      frequencyValue: "1",
      frequencyUnit: "Months",
      lastCompletedDate: "2026-08-20",
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ lastDoneDate: "20-Aug-2026" }),
    );
    expect(repo.create.mock.calls[0][0]).not.toHaveProperty("lastCompletedDate");
  });

  it("accepts the live form lastCompletedOn field as an API alias", async () => {
    const { createJob } = await import("../services/jobService");

    const job = await createJob({
      jobNo: "TEST-003",
      jobTitle: "Live form inspection",
      vesselId: "vessel-1",
      componentId: "component-1",
      maintenanceBasis: "Calendar",
      frequencyValue: "1",
      frequencyUnit: "Months",
      lastCompletedOn: "2026-09-01",
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ lastDoneDate: "01-Sep-2026" }),
    );
    expect(repo.create.mock.calls[0][0]).not.toHaveProperty("lastCompletedOn");
    expect(job.lastDoneDate).toBe("01-Sep-2026");
  });

  it("maps Last Completed Date on update to the persisted lastDoneDate field", async () => {
    repo.findById.mockResolvedValue({
      id: "job-1",
      juuid: "job-1",
      vesselId: "vessel-1",
      componentId: null,
      maintenanceBasis: "Calendar",
      frequencyValue: null,
      frequencyUnit: null,
      lastDoneDate: null,
    });
    const { updateJob } = await import("../services/jobService");

    await updateJob("job-1", { lastCompletedDate: "2026-07-10" });

    expect(repo.update).toHaveBeenCalledWith("job-1", {
      lastDoneDate: "10-Jul-2026",
    });
  });

  it("maps the legacy live form field on update without persisting the alias", async () => {
    repo.findById.mockResolvedValue({
      id: "job-1",
      juuid: "job-1",
      vesselId: "vessel-1",
      componentId: null,
      maintenanceBasis: "Calendar",
      frequencyValue: null,
      frequencyUnit: null,
      lastDoneDate: null,
    });
    const { updateJob } = await import("../services/jobService");

    await updateJob("job-1", { lastCompletedOn: "2026-08-10" });

    expect(repo.update).toHaveBeenCalledWith("job-1", {
      lastDoneDate: "10-Aug-2026",
    });
  });
});