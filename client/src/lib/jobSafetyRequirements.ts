export const JOB_SAFETY_FIELDS = [
  { field: "ppeRequirements", label: "Personal Protective Equipment (PPE):", testId: "input-ppe-requirements", marker: "JF.A4.3" },
  { field: "permitRequirements", label: "Permits Required:", testId: "input-permit-requirements", marker: "JF.A4.5" },
  { field: "otherRequirements", label: "Other Safety Requirements:", testId: "input-other-safety-requirements", marker: "JF.A4.7" },
] as const;

export type JobSafetyField = typeof JOB_SAFETY_FIELDS[number]["field"];
export type JobSafetyDraft = Partial<Record<JobSafetyField, string>>;

function requirementsObject(requirements: unknown): Record<string, unknown> {
  return requirements !== null && typeof requirements === "object" && !Array.isArray(requirements)
    ? requirements as Record<string, unknown>
    : {};
}

export function getJobSafetyList(requirements: unknown, field: JobSafetyField): string[] {
  const value = requirementsObject(requirements)[field];
  return Array.isArray(value) ? value.map(item => String(item)) : [];
}

/**
 * Only touched fields are normalized, and only at Save time. Untouched lists
 * (and any additional safety metadata) must survive unrelated job edits.
 */
export function buildJobSafetyUpdate(
  requirements: unknown,
  draft: JobSafetyDraft,
): Record<string, unknown> | undefined {
  const next = { ...requirementsObject(requirements) };
  let changed = false;

  for (const { field } of JOB_SAFETY_FIELDS) {
    const text = draft[field];
    if (text === undefined) continue;
    const entries = text.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    if (JSON.stringify(entries) !== JSON.stringify(getJobSafetyList(requirements, field))) {
      next[field] = entries;
      changed = true;
    }
  }

  return changed ? next : undefined;
}