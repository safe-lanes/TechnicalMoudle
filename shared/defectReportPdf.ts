import { z } from "zod";

// Transport validation only: these are display values, not database fields.
const text = z.string().max(200_000).default("");
const action = z.object({
  actionType: text,
  description: text,
  proposedBy: text,
  responsibility: text,
  dueDate: text,
  status: text,
});

export const defectReportPdfSchema = z.object({
  reportId: z.string().min(1).max(200),
  vessel: text,
  category: text,
  dateObserved: text,
  source: text,
  component: text,
  dateReportedToOffice: text,
  defectCategory: text,
  make: text,
  dateRegisteredInSystem: text,
  defectType: text,
  model: text,
  targetDate: text,
  raisedBy: text,
  isCoc: z.boolean().default(false),
  isCritical: z.boolean().default(false),
  dateClosed: text,
  description: text,
  immediateCause: text,
  immediateCauseExplanation: text,
  rootCause: text,
  rootCauseExplanation: text,
  sireVersion: text,
  sireReference: text,
  sireHardwareClass: text,
  riskLevel: text,
  priority: text,
  actions: z.array(action).max(1000).default([]),
  targetDateExtension: z.object({
    existingTargetDate: text,
    newTargetDate: text,
    reasonForExtension: text,
    approved: text,
    approvalDate: text,
    approverComments: text,
  }).optional(),
  confirmCompleted: z.boolean().default(false),
  dateCompleted: text,
  closedByName: text,
  closedByRank: text,
  verified: z.boolean().default(false),
  dateVerified: text,
  verifiedByName: text,
  verifiedByOfficePosition: text,
});

export type DefectReportPdfData = z.infer<typeof defectReportPdfSchema>;
