/**
 * The SINGLE source of truth for "can this user act on this request".
 * 25-Sep-2026 — the old Level 1 / Level 2 ticks are retired: for an action the ENGINE governs
 * (every Technical CR target except Work Order, both WO postponement scopes) only the engine's
 * canDecide counts — no chain means NO approve/reject button (the server refuses a direct
 * decision). `engineGoverned=false` (Work-Order-target CRs, no engine action by decision) keeps
 * the caller's legacy gate. EVERY screen that renders a CR or postponement approve/reject
 * button must gate on this — never re-derive the rule inline (AE-10 dashboard leak).
 */
export function resolveCanAct(
  engine: { hasChain: boolean; canDecide: boolean },
  legacyCanAct: boolean,
  engineGoverned = true,
): boolean {
  if (!engineGoverned) return legacyCanAct;
  return engine.hasChain && engine.canDecide;
}
