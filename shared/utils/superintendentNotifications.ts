export type SuperintendentNotificationCategory =
  | "pending"
  | "acknowledged"
  | "information";

export interface SuperintendentNotificationClassificationInput {
  isAcknowledged?: boolean | null;
  acknowledgedAt?: string | Date | null;
  createdAt?: string | Date | null;
}

function toValidDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isInCurrentCalendarMonth(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  const date = toValidDate(value);
  return !!date
    && date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth();
}

/**
 * Returns the single tab a live notification belongs to, or null when the
 * record is outside the current-month history window.
 */
export function classifySuperintendentNotification(
  notification: SuperintendentNotificationClassificationInput,
  effectiveApprovalTier: string,
  now: Date = new Date(),
): SuperintendentNotificationCategory | null {
  if (notification.isAcknowledged) {
    return isInCurrentCalendarMonth(notification.acknowledgedAt, now)
      ? "acknowledged"
      : null;
  }

  if (effectiveApprovalTier === "superintendent_locked") {
    return "pending";
  }

  return isInCurrentCalendarMonth(notification.createdAt, now)
    ? "information"
    : null;
}