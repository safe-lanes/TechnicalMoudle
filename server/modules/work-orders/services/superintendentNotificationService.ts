import type {
  PmsVesselSettings,
  SuperintendentNotification,
  Vessel,
} from "@shared/schema";
import {
  classifySuperintendentNotification,
  type SuperintendentNotificationCategory,
} from "@shared/utils/superintendentNotifications";
import { storage } from "../../../storage";

export interface SuperintendentNotificationScope {
  vesselId?: string;
  vesselIds?: string[];
}

export type ClassifiedSuperintendentNotification = SuperintendentNotification & {
  effectiveApprovalTier: string;
  notificationCategory: SuperintendentNotificationCategory;
};

type ClassifiedGroups = Record<
  SuperintendentNotificationCategory,
  ClassifiedSuperintendentNotification[]
>;

function resolveAllowedVessels(
  scope: SuperintendentNotificationScope,
  vessels: Vessel[],
): Vessel[] | null {
  const requestedIds = scope.vesselIds?.length
    ? scope.vesselIds
    : scope.vesselId && scope.vesselId !== "all"
      ? [scope.vesselId]
      : null;

  if (!requestedIds) return null;
  const requested = new Set(requestedIds);
  return vessels.filter(
    (vessel) => requested.has(vessel.id) || requested.has(vessel.vuuid),
  );
}

export function notificationMatchesVesselScope(
  notification: Pick<SuperintendentNotification, "vesselId" | "vesselName">,
  allowedVessels: Vessel[] | null,
): boolean {
  if (allowedVessels === null) return true;
  return allowedVessels.some((vessel) => {
    if (notification.vesselId) {
      return notification.vesselId === vessel.vuuid || notification.vesselId === vessel.id;
    }
    return !!notification.vesselName && notification.vesselName === vessel.name;
  });
}

function isLockEnabled(
  notification: Pick<SuperintendentNotification, "vesselId" | "vesselName">,
  vessels: Vessel[],
  settings: PmsVesselSettings[],
): boolean {
  const vessel = vessels.find((candidate) => {
    if (notification.vesselId) {
      return notification.vesselId === candidate.vuuid || notification.vesselId === candidate.id;
    }
    return !!notification.vesselName && notification.vesselName === candidate.name;
  });
  if (!vessel) return false;
  return settings.some(
    (setting) =>
      (setting.vesselId === vessel.vuuid || setting.vesselId === vessel.id)
      && setting.superintendentLockEnabled === true,
  );
}

export function classifySuperintendentNotifications(
  notifications: SuperintendentNotification[],
  vessels: Vessel[],
  settings: PmsVesselSettings[],
  scope: SuperintendentNotificationScope,
  now: Date = new Date(),
): ClassifiedGroups {
  const allowedVessels = resolveAllowedVessels(scope, vessels);
  const groups: ClassifiedGroups = {
    pending: [],
    acknowledged: [],
    information: [],
  };

  for (const notification of notifications) {
    if (notification.isDeleted || !notificationMatchesVesselScope(notification, allowedVessels)) {
      continue;
    }
    const effectiveApprovalTier =
      notification.approvalTier === "superintendent_locked"
      && !isLockEnabled(notification, vessels, settings)
        ? "superintendent_notification"
        : notification.approvalTier || "standard";
    const notificationCategory = classifySuperintendentNotification(
      notification,
      effectiveApprovalTier,
      now,
    );
    if (notificationCategory) {
      groups[notificationCategory].push({
        ...notification,
        effectiveApprovalTier,
        notificationCategory,
      });
    }
  }
  return groups;
}

async function loadClassifiedNotifications(
  scope: SuperintendentNotificationScope,
  now: Date,
): Promise<ClassifiedGroups> {
  const [notifications, vessels, settings] = await Promise.all([
    storage.getAllSuperintendentNotifications(),
    storage.getVessels(),
    storage.getAllPmsVesselSettings(),
  ]);
  return classifySuperintendentNotifications(
    notifications,
    vessels as Vessel[],
    settings,
    scope,
    now,
  );
}

export async function listSuperintendentNotifications(
  category: SuperintendentNotificationCategory,
  scope: SuperintendentNotificationScope,
  now: Date = new Date(),
): Promise<ClassifiedSuperintendentNotification[]> {
  return (await loadClassifiedNotifications(scope, now))[category];
}

export async function listAllActiveSuperintendentNotifications(
  scope: SuperintendentNotificationScope,
): Promise<SuperintendentNotification[]> {
  const [notifications, vessels] = await Promise.all([
    storage.getAllSuperintendentNotifications(),
    storage.getVessels(),
  ]);
  const allowedVessels = resolveAllowedVessels(scope, vessels as Vessel[]);
  return notifications.filter(
    (notification) =>
      !notification.isDeleted
      && notificationMatchesVesselScope(notification, allowedVessels),
  );
}

export async function getSuperintendentNotificationSummary(
  scope: SuperintendentNotificationScope,
  now: Date = new Date(),
) {
  const groups = await loadClassifiedNotifications(scope, now);
  return {
    pendingCount: groups.pending.length,
    acknowledgedThisMonthCount: groups.acknowledged.length,
  };
}