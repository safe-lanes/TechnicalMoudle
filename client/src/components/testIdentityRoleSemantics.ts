export interface ResolverRoleSource {
  role?: unknown;
}

/** Preserve the database value exactly; production resolver equality is exact. */
export function exactUserRole(user: ResolverRoleSource): string {
  return typeof user.role === "string" ? user.role : "";
}

export function userMatchesResolverRole(
  user: ResolverRoleSource,
  assignedRole: string,
): boolean {
  return exactUserRole(user) === assignedRole;
}

export function compareExactRoleStrings(left: string, right: string): number {
  const presentationOrder = left.localeCompare(right, undefined, {
    sensitivity: "base",
  });
  if (presentationOrder !== 0 || left === right) return presentationOrder;
  return left < right ? -1 : 1;
}