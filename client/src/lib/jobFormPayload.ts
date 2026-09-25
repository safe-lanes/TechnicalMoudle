import type { DraftJob } from "@/components/pms/AddDraftJobModal";

interface ComponentIdentity {
  cuuid: string;
  componentCode?: string | null;
  name?: string | null;
}

export function mapLastCompletedOnToLastDoneDate(
  lastCompletedOn: string | null | undefined,
): string | null {
  const value = lastCompletedOn?.trim();
  return value || null;
}

export function buildDraftJobPayload(
  draft: DraftJob,
  component: ComponentIdentity,
  vesselId: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    jobTitle: draft.jobTitle,
    maintenanceType: draft.maintenanceType || null,
    maintenanceBasis: draft.maintenanceBasis,
    jobPriority: draft.jobPriority || null,
    assignedTo: draft.assignedTo || null,
    briefWorkDescription: draft.briefWorkDescription || null,
    componentId: component.cuuid,
    componentCode: component.componentCode,
    componentName: component.name,
    vesselId,
  };

  if (draft.maintenanceBasis === "Running Hours") {
    payload.intervalRunningHour = parseInt(draft.frequencyValue) || 0;
    payload.frequencyUnit = "Hours";
    if (draft.lastDoneRH) payload.lastDoneRH = draft.lastDoneRH;
  } else {
    payload.frequencyValue = draft.frequencyValue || null;
    payload.frequencyUnit = draft.frequencyUnit || null;
    if (draft.lastDoneDate) payload.lastDoneDate = draft.lastDoneDate;
  }

  return payload;
}