import { z } from "zod";

export const sparePageQuery = z.object({
  kind: z.enum(["inventory", "location", "history", "bulk"]).default("inventory"),
  page: z.coerce.number().int().min(1).max(10_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(10),
  search: z.string().max(200).default(""),
  criticality: z.enum(["", "All", "Critical", "Non-critical"]).default(""),
  rotation: z.enum(["", "All", "Rotation Items", "Non-Rotation Items"]).default(""),
  stockStatus: z.enum(["", "All", "OK", "Low", "At Min"]).default(""),
  activeOnly: z.enum(["true", "false"]).default("false"),
  componentId: z.string().max(200).default(""),
  locationId: z.coerce.number().int().positive().optional(),
  locationSearch: z.string().max(200).default(""),
  eventType: z.string().max(50).default("all"),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeZone: z.string().max(100).default("UTC"),
  scope: z.enum(["all", "my"]).optional(),
  vesselIds: z.string().max(12000).optional(),
  sort: z.string().max(4000).default("[]"),
  filters: z.string().max(16000).default("{}"),
}).superRefine((q, ctx) => {
  for (const key of ["dateFrom", "dateTo"] as const) if (q[key] &&
    (Number.isNaN(Date.parse(q[key]!)) || new Date(q[key]!).toISOString().slice(0, 10) !== q[key]))
    ctx.addIssue({ code: "custom", path: [key], message: "Invalid date" });
  if (q.dateFrom && q.dateTo && q.dateFrom > q.dateTo)
    ctx.addIssue({ code: "custom", path: ["dateTo"], message: "Reversed date range" });
  try { new Intl.DateTimeFormat("en", { timeZone: q.timeZone }); }
  catch { ctx.addIssue({ code: "custom", path: ["timeZone"], message: "Invalid timezone" }); }
});
export type SparePageQuery = z.infer<typeof sparePageQuery>;
export interface SparePage<T = any> {
  items: T[]; total: number; page: number; pageSize: number; totalPages: number;
}
