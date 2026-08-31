import { describe, expect, it } from "vitest";
import {
  classifySuperintendentNotification,
  isInCurrentCalendarMonth,
} from "@shared/utils/superintendentNotifications";
import {
  classifySuperintendentNotifications,
  notificationMatchesVesselScope,
} from "../services/superintendentNotificationService";

const now = new Date(2026, 7, 31, 12, 0, 0);

describe("Superintendent notification classification", () => {
  it("keeps only effective locked, unacknowledged rows pending", () => {
    expect(classifySuperintendentNotification(
      { isAcknowledged: false, createdAt: new Date(2025, 0, 1) },
      "superintendent_locked",
      now,
    )).toBe("pending");
    expect(classifySuperintendentNotification(
      { isAcknowledged: false, createdAt: new Date(2026, 7, 1) },
      "superintendent_notification",
      now,
    )).toBe("information");
  });

  it("uses acknowledgment month and notification month for history tabs", () => {
    expect(classifySuperintendentNotification(
      { isAcknowledged: true, acknowledgedAt: new Date(2026, 7, 1) },
      "superintendent_locked",
      now,
    )).toBe("acknowledged");
    expect(classifySuperintendentNotification(
      { isAcknowledged: true, acknowledgedAt: new Date(2026, 6, 31) },
      "superintendent_locked",
      now,
    )).toBeNull();
    expect(isInCurrentCalendarMonth(new Date(2026, 7, 31), now)).toBe(true);
  });

  it("matches canonical identities first and preserves a legacy name fallback", () => {
    const vessel = {
      id: "VESSEL-A",
      vuuid: "vessel-a-uuid",
      name: "Vessel A",
    } as any;
    expect(notificationMatchesVesselScope(
      { vesselId: "vessel-a-uuid", vesselName: "Stale Name" },
      [vessel],
    )).toBe(true);
    expect(notificationMatchesVesselScope(
      { vesselId: null, vesselName: "Vessel A" },
      [vessel],
    )).toBe(true);
    expect(notificationMatchesVesselScope(
      { vesselId: "vessel-b-uuid", vesselName: "Vessel B" },
      [vessel],
    )).toBe(false);
    expect(notificationMatchesVesselScope(
      { vesselId: "vessel-b-uuid", vesselName: "Vessel A" },
      [vessel],
    )).toBe(false);
    expect(notificationMatchesVesselScope(
      { vesselId: null, vesselName: "Vessel A" },
      [],
    )).toBe(false);
  });

  it("classifies mixed scopes, vessel policies, deleted rows, and month boundaries together", () => {
    const vesselA = { id: "A", vuuid: "a-uuid", name: "Vessel A" } as any;
    const vesselB = { id: "B", vuuid: "b-uuid", name: "Vessel B" } as any;
    const base = {
      workOrderId: "wo",
      createdAt: new Date(2026, 7, 2),
      isAcknowledged: false,
      isDeleted: false,
      approvalTier: "superintendent_locked",
    };
    const groups = classifySuperintendentNotifications(
      [
        { ...base, id: 1, vesselId: "a-uuid", vesselName: "Vessel A" },
        { ...base, id: 2, vesselId: "b-uuid", vesselName: "Vessel B" },
        { ...base, id: 3, vesselId: null, vesselName: "Vessel A", isDeleted: true },
        {
          ...base,
          id: 4,
          vesselId: "a-uuid",
          vesselName: "Vessel A",
          isAcknowledged: true,
          acknowledgedAt: new Date(2026, 6, 31),
        },
      ] as any,
      [vesselA, vesselB],
      [{ vesselId: "a-uuid", superintendentLockEnabled: true }] as any,
      { vesselId: "all", vesselIds: ["a-uuid", "b-uuid"] },
      now,
    );

    expect(groups.pending.map((row) => row.id)).toEqual([1]);
    expect(groups.information.map((row) => row.id)).toEqual([2]);
    expect(groups.acknowledged).toEqual([]);
  });
});