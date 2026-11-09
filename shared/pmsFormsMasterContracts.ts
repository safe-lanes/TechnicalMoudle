import { z } from "zod";

export const formsMasterUuid = z.string().uuid();
// PostgreSQL uses exactly this ASCII whitespace set, not locale-dependent \s.
export function normalizeFormName(value: string): string {
  return value.replace(/[ \t\n\r\f\v]+/g, " ").replace(/^ +| +$/g, "").toLowerCase();
}
const name = z.string().transform(value => value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, ""))
  .pipe(z.string().min(1).max(200));
export const formMasterInput = z.object({
  scope: z.enum(["fleet", "vessel"]),
  vesselId: formsMasterUuid.nullable(),
  groupUuid: formsMasterUuid,
  categoryUuid: formsMasterUuid,
  formName: name,
  companyFormName: name,
  woPreApproval: z.boolean(),
  woPostApproval: z.boolean(),
  approverRoleRuid: formsMasterUuid.nullable(),
}).strict().superRefine((v, ctx) => {
  if ((v.scope === "vessel") !== Boolean(v.vesselId))
    ctx.addIssue({ code: "custom", path: ["vesselId"], message: "Select one vessel for Vessel scope; Fleet scope must have no vessel." });
});
export type FormMasterInput = z.infer<typeof formMasterInput>;
export interface FormMasterGroup {
  fguuid: string; groupCode: string; groupName: string; displayOrder: number; isDeleted: boolean;
}
export interface FormMasterCategory {
  fcuuid: string; groupUuid: string; categoryNo: number; categoryName: string; displayOrder: number; isDeleted: boolean;
}
export interface FormMasterRecord extends FormMasterInput {
  fmuuid: string; formId: string; isDeleted: boolean; isDefault: boolean;
  groupCode: string; groupName: string; categoryNo: number; categoryName: string;
  vesselName: string | null; approverRoleLabel: string | null;
  whenToUse: string | null; responsible: string | null; typicalJobs: string | null; suggestedApprover: string | null;
}
export interface FormsMasterCapabilities { create: boolean; edit: boolean; delete: boolean }
export interface FormsMasterList {
  records: FormMasterRecord[]; total: number; page: number; pageSize: number;
}
export interface FormsMasterOptions {
  groups: FormMasterGroup[]; categories: FormMasterCategory[];
  roles: { ruid: string; assignedRole: string }[];
  vessels: { vuuid: string; name: string }[];
  capabilities: FormsMasterCapabilities;
}
export const formsMasterListInput = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).default(""),
  groupUuid: formsMasterUuid.optional(), categoryUuid: formsMasterUuid.optional(),
  scope: z.enum(["fleet", "vessel"]).optional(), vesselId: formsMasterUuid.optional(),
  pre: z.enum(["true", "false"]).optional(), post: z.enum(["true", "false"]).optional(),
  showDeleted: z.enum(["true", "false"]).default("false"),
  sort: z.enum(["formId", "scope", "group", "category", "formName", "companyFormName", "woPreApproval", "woPostApproval", "approver", "actions"]).default("formId"),
  direction: z.enum(["asc", "desc"]).default("asc"),
}).strict();
export type FormsMasterListInput = z.infer<typeof formsMasterListInput>;
