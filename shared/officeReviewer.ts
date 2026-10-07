import { z } from "zod";

/** Job configuration only: this selection does not grant reviewer permissions. */
export const officeReviewerRoleRuidsSchema = z.array(
  z.string().min(1).refine(id => id.trim() === id, "Role IDs must not contain surrounding whitespace"),
).refine(ids => new Set(ids).size === ids.length, "Role IDs must be unique");

/** Normalize persisted null/absent configuration, never a legacy Office value. */
export function normalizeOfficeReviewerRoles(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))).sort()
    : [];
}

/** Strict reader for the new typed column; only SQL NULL/absence means no selection. */
export function normalizeOfficeReviewerRoleRuids(value: unknown): string[] {
  return value == null ? [] : officeReviewerRoleRuidsSchema.parse(value).slice().sort();
}

export function sameOfficeReviewerRoles(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeOfficeReviewerRoleRuids(a)) === JSON.stringify(normalizeOfficeReviewerRoleRuids(b));
}

export function officeReviewerRolesEqual(a: unknown, b: unknown): boolean {
  const left = normalizeOfficeReviewerRoles(a);
  const right = normalizeOfficeReviewerRoles(b);
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function requiresOfficeReview(value: unknown): boolean {
  return normalizeOfficeReviewerRoles(value).length > 0;
}

/** Newly added IDs must be active; unchanged IDs survive catalog lag/deactivation. */
export function validateOfficeReviewerRoles(
  value: unknown,
  existing: unknown,
  activeRoles: Iterable<string | { ruid: string; isActive: boolean | null; isDeleted?: boolean | null }>,
): string[] {
  const ids = officeReviewerRoleRuidsSchema.parse(value);
  const retained = new Set(normalizeOfficeReviewerRoles(existing));
  const active = new Set<string>();
  for (const role of Array.from(activeRoles)) {
    if (typeof role === 'string') active.add(role);
    else if (role.isActive && !role.isDeleted) active.add(role.ruid);
  }
  for (const id of ids) {
    if (!retained.has(id) && !active.has(id)) {
      throw new Error(`Office Reviewer role "${id}" is not active or does not exist`);
    }
  }
  return [...ids].sort();
}

export type ApprovalFieldOverride = {
  field: string;
  approverNewValue: string | string[];
};

export function isOfficeReviewerField(field: string): boolean {
  return field.split(".").pop() === "officeReviewerRoleRuids";
}

/** Preserve the typed array only for this field; other editors retain text semantics. */
export function normalizeApprovalOverride(field: string, value: unknown): string | string[] {
  return isOfficeReviewerField(field)
    ? officeReviewerRoleRuidsSchema.parse(value).slice().sort()
    : String(value ?? "");
}

export function approvalValuesEqual(field: string, a: unknown, b: unknown): boolean {
  return isOfficeReviewerField(field)
    ? officeReviewerRolesEqual(a, b)
    : String(a ?? "") === String(b ?? "");
}
