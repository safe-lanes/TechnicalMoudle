interface SavedComponentIdentity {
  id?: string | null;
  componentId?: string | null;
  cuuid?: string | null;
  vesselId?: string | null;
  classItem?: unknown;
}

/** Resolve saved data for the editor selection, never a code or editable draft. */
export function resolveSectionHComponent<T extends SavedComponentIdentity>(
  register: T[] | undefined,
  selection: SavedComponentIdentity | undefined | null,
  vesselId: string | undefined | null,
): T | SavedComponentIdentity | undefined {
  if (!selection || !vesselId) return;
  // Tree nodes replace id with the displayed code but retain componentId/cuuid.
  const identity = selection.cuuid || selection.componentId || selection.id;
  if (!identity) return;
  const saved = register
    ? register.find(row => row.cuuid === identity || row.id === identity)
    : selection;
  if (!saved || saved.vesselId !== vesselId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saved.cuuid || "")) return;
  return saved;
}
