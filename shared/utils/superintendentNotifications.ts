export type SuperintendentNotificationCategory =
  | "pending"
  | "acknowledged"
  | "information";

export interface SuperintendentNotificationClassificationInput {
  isAcknowledged?: boolean | null;
  acknowledgedAt?: string | Date | null;
  createdAt?: string | Date | null;
}

export interface SuperintendentNotificationReasonInput {
  daysLate?: number | string | null;
  missedCycles?: number | string | null;
  backdatingDays?: number | string | null;
}

function toPositiveNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Builds a concise explanation for information-only notification rows.
 * Legacy records can predate one or more reason fields, so an explicit
 * fallback is returned rather than leaving the table cell blank.
 */
export function formatSuperintendentNotificationReason(
  notification: SuperintendentNotificationReasonInput,
): string {
  const reasons: string[] = [];
  const daysLate = toPositiveNumber(notification.daysLate);
  const missedCycles = toPositiveNumber(notification.missedCycles);
  const backdatingDays = toPositiveNumber(notification.backdatingDays);

  if (daysLate > 0) {
    reasons.push(`${daysLate} ${daysLate === 1 ? "day" : "days"} late`);
  }
  if (missedCycles > 0) {
    reasons.push(`${missedCycles} missed ${missedCycles === 1 ? "cycle" : "cycles"}`);
  }
  if (backdatingDays > 0) {
    reasons.push(`${backdatingDays} ${backdatingDays === 1 ? "day" : "days"} backdated`);
  }

  return reasons.length > 0
    ? reasons.join("; ")
    : "Reason unavailable for this notification";
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