/**
 * Canonical approval-level comparison — the SINGLE source of truth for matching an
 * approver's configured level against an approval step's level.
 *
 * WHY THIS EXISTS (AE-21): `moc_approvers.approver_level` is imported from SAILERP master
 * data and drifts in format ("Level 1" / "Level1" / "level 1"); CR steps store 'Level 1' /
 * 'Level 2' while WO-postponement steps have historically stored 'Level1' / 'Level2'. The
 * client approve-button gate and the server approver checks compared these with an EXACT
 * string match, so a genuine Level-1 approver was silently hidden/denied on any whitespace
 * or case difference. Every surface now compares on the normalized form instead — no
 * duplicated string logic anywhere.
 */

/** Canonicalize a level label: trim, lowercase, strip internal whitespace. "Level 1" → "level1". */
export function normalizeLevel(level: string | null | undefined): string {
  return String(level ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

/** True iff both sides are non-empty and normalize to the same value. */
export function levelsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeLevel(a);
  return na !== "" && na === normalizeLevel(b);
}

/** True iff `target` matches any entry of `levels` after normalization. */
export function anyLevelMatches(levels: Array<string | null | undefined>, target: string | null | undefined): boolean {
  const nt = normalizeLevel(target);
  return nt !== "" && levels.some((l) => normalizeLevel(l) === nt);
}
