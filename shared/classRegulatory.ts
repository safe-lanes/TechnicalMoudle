import { z } from "zod";
import type { ComponentClassRegulatory } from "./schema";

export type ClassRegulatoryEntry = ComponentClassRegulatory;

/** Strict calendar day parsing without Date's rollover or timezone conversion. */
export function classSurveyDay(value: string | null | undefined): string | null {
  if (!value) return null;
  let year: number, month: number, day: number;
  let match = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (match) {
    [, year, month, day] = match.map(Number);
    if (value.includes("T") && !Number.isFinite(Date.parse(value))) return null;
  } else {
    match = /^(\d{2})-(\d{2}|\w{3})-(\d{4})$/.exec(value);
    if (!match) return null;
    year = Number(match[3]);
    day = Number(match[1]);
    month = /^\d{2}$/.test(match[2]) ? Number(match[2]) :
      ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(match[2].toLowerCase()) + 1;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 100 || month < 1 || month > 12 || date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function validateClassRegulatoryDates(
  data: { lastClassSurvey?: string | null; nextSurveyDue?: string | null },
  original?: { lastClassSurvey?: string | null; nextSurveyDue?: string | null },
): Record<string, string> {
  const errors: Record<string, string> = {};
  const last = classSurveyDay(data.lastClassSurvey);
  const next = classSurveyDay(data.nextSurveyDue);
  for (const [key, label] of [["lastClassSurvey", "Last Class Survey"], ["nextSurveyDue", "Next Class Survey"]] as const) {
    const value = data[key];
    if (value && !classSurveyDay(value) && (!original || value !== original[key])) errors[key] = `Enter a valid ${label} date`;
  }
  if (last && next && last > next) errors.nextSurveyDue = "Next Class Survey cannot be before Last Class Survey";
  return errors;
}

const optionalText = (max: number, label: string) => z.string().trim().max(max, `${label} cannot exceed ${max} characters`).nullable().optional();
export const classRegulatoryInput = z.object({
  classificationSocietyKey: z.string().trim().min(1, "Select a classification society").optional(),
  surveyTypeKey: z.string().trim().min(1, "Select a survey type").optional(),
  certificateNumber: optionalText(100, "Certificate No."),
  classRequirements: optionalText(2000, "Class Requirements"),
  information: optionalText(2000, "Information"),
  // Dates intentionally not trimmed/normalized: untouched legacy values stay byte-identical.
  lastClassSurvey: z.string().max(100).nullable().optional(),
  nextSurveyDue: z.string().max(100).nullable().optional(),
}).strict();
