import { z } from "zod";

export const storeTab = z.enum(["stores", "lubes", "chemicals", "others"]);
export const storeTarget = z.object({ id: z.number().int().positive().safe(), vesselId: z.string().min(1).max(200) }).strict();
export type StoreTarget = z.infer<typeof storeTarget>;
export const storeSelection = z.object({
  version: z.literal(2),
  targets: z.array(storeTarget),
  total: z.number().int().nonnegative(),
}).superRefine((selection, ctx) => {
  if (selection.total !== selection.targets.length || new Set(selection.targets.map(t => t.id)).size !== selection.total)
    ctx.addIssue({ code: "custom", message: "Invalid selection count or duplicate targets" });
});
export type StoreSelection = z.infer<typeof storeSelection>;
export const storeCaptureBody = z.object({
  version: z.literal(2),
  ids: z.array(z.number().int().positive().safe()).max(100000).optional(),
}).strict();
export const chemicalPatch = z.object({
  expiryDate: z.string().max(100).optional(), batchNumber: z.string().max(500).optional(), sdsReference: z.string().max(2000).optional(),
}).strict();
export type ChemicalPatch = z.infer<typeof chemicalPatch>;
export const storeInactivateBody = z.object({
  version: z.literal(2), targets: z.array(storeTarget),
  exclude: z.array(z.number().int().positive().safe()).default([]),
  additionalIds: z.array(z.number().int().positive().safe()).default([]),
}).strict();
export const storeChemicalBody = z.object({
  version: z.literal(2),
  applied: z.array(z.object({ targets: z.array(storeTarget), values: chemicalPatch }).strict()).max(3),
  // Failure-only drafts can be as large as a captured Apply-to-All set. The
  // existing transport byte ceiling, not a smaller override count, bounds them.
  overrides: z.array(z.object({ id: z.number().int().positive().safe(), data: chemicalPatch }).strict()),
}).strict();
export const storePageQuery = z.object({
  itemType: storeTab,
  page: z.coerce.number().int().min(1).max(10_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  search: z.string().max(200).default(""),
  category: z.string().max(200).default(""),
  stockStatus: z.enum(["", "all", "OK", "Low", "N/A"]).default(""),
  activeOnly: z.enum(["true", "false"]).default("false"),
  bulk: z.enum(["true", "false"]).default("false"),
  vesselIds: z.string().max(12000).optional(),
  scope: z.enum(["all", "my"]).optional(),
  location: z.string().max(500).optional(),
  locationSearch: z.string().max(200).default(""),
  eventType: z.enum(["all", "RECEIVE", "CONSUME", "ARCHIVE", "ADJUST", "TRANSFER_IN", "TRANSFER_OUT"]).default("all"),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeZone: z.string().max(100).default("UTC"),
  sort: z.string().max(4000).default("[]"),
  filters: z.string().max(16000).default("{}"),
}).superRefine((q, ctx) => {
  for (const key of ["dateFrom", "dateTo"] as const) {
    if (q[key] && (Number.isNaN(Date.parse(q[key]!)) || new Date(q[key]!).toISOString().slice(0, 10) !== q[key]))
      ctx.addIssue({ code: "custom", path: [key], message: "Invalid date" });
  }
  if (q.dateFrom && q.dateTo && q.dateFrom > q.dateTo)
    ctx.addIssue({ code: "custom", path: ["dateTo"], message: "Reversed date range" });
  try { new Intl.DateTimeFormat("en", { timeZone: q.timeZone }); }
  catch { ctx.addIssue({ code: "custom", path: ["timeZone"], message: "Invalid timezone" }); }
});
export type StorePageQuery = z.infer<typeof storePageQuery>;
export interface StorePage<T = any> {
  items: T[]; total: number; page: number; pageSize: number; totalPages: number;
}
export function storeStock(rob: number, min: number) {
  return !min ? "N/A" : rob >= min ? "OK" : "Low";
}
