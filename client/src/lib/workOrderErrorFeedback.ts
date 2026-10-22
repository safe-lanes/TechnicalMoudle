import { getLowerRunningHoursWarning } from "@/pages/pms/runningHoursErrorFeedback";

type RecordValue = Record<string, unknown>;
const asRecord = (value: unknown): RecordValue | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue : undefined;

/** Keep response details local to Work Orders; do not change apiRequest's contract. */
export class WorkOrderResponseError extends Error {
  constructor(readonly payload: unknown) {
    let message = "Work order request failed";
    try {
      message = typeof payload === "string" ? payload : JSON.stringify(payload) || message;
    } catch {
      // A malformed/circular response must still have safe feedback.
    }
    super(message);
    this.name = "WorkOrderResponseError";
  }
}

export async function workOrderResponseError(response: Response): Promise<Error> {
  return new Error(`${response.status}: ${await response.text()}`);
}

const fieldLabels: Record<string, string> = {
  woTitle: "Job Title", jobTitle: "Job Title", componentId: "Component",
  componentCode: "Component Code", vesselId: "Vessel", assignedTo: "Assigned To",
  approver: "Approver", frequencyValue: "Frequency", frequencyUnit: "Frequency Unit",
  rhFrequencyValue: "Running Hours Interval", currentReading: "Current Reading",
  currentReadingDate: "Current Reading Date", previousReading: "Previous Reading",
  runningHours: "Running Hours", runningHoursDifference: "Running Hours Difference",
  completionDate: "Completion Date", dateCompleted: "Completion Date",
  startDate: "Start Date", startTime: "Start Time", completionTime: "Completion Time",
  noOfPersons: "Number of Persons", numberOfPersons: "Number of Persons",
  totalTime: "Total Time (Hours)", manhours: "Manhours",
  workCarriedOut: "Work Carried Out", workDescription: "Work Description",
  briefWorkDescription: "Brief Work Description", jobDescription: "Job Description",
  riskAssessment: "Risk Assessment", safetyChecklist: "Safety Checklist",
  completionRemarks: "Completion Remarks", rejectionRemarks: "Rejection Remarks",
  superintendentRemarks: "Superintendent Remarks", postponeDate: "Postpone Date",
  postponementRemarks: "Postponement Remarks", reasonForPostponement: "Reason for Postponement",
  spareId: "Spare", sparePartId: "Spare", partCode: "Part Code", partNo: "Part Number",
  qtyConsumed: "Quantity Consumed", quantityConsumed: "Quantity Consumed",
  locationId: "Storage Location", remarks: "Remarks", status: "Status",
};

const genericMessages = /^(?:error|bad request|forbidden|unauthorized|not found|internal server error|work order request failed|invalid (?:work order|execution|request) data|validation (?:error|failed)|null|undefined|\[object Object\])\.?$/i;

function readableText(value: string, readingDate: boolean): string | undefined {
  let text = value.trim().replace(/^(?:Error:\s*)?(?:\d{3}\s*:\s*)+/, "").trim();
  if (!text || genericMessages.test(text)) return;
  // Specific stock messages are useful; deduction/bookkeeping and search internals are not.
  if (/^INSUFFICIENT_STOCK:/.test(text)) {
    text = text.replace(/^INSUFFICIENT_STOCK:\s*/, "Not enough stock. ")
      .replace(/\.?\s*Already deducted[\s\S]*$/i, ".")
      .replace(/\b(?:from|at) location \d+\b/gi, "at the selected location")
      .replace(/Current stock at the selected location:/i, "Available stock:");
  } else if (/^SPARE_NOT_FOUND:/.test(text)) {
    text = text.replace(/^SPARE_NOT_FOUND:\s*/, "")
      .replace(/\.?\s*Searched:[\s\S]*$/i, ". Check that the spare exists in this vessel's inventory.");
  } else if (/^LOCATION_REQUIRED:/.test(text)) {
    text = text.replace(/^LOCATION_REQUIRED:\s*/, "");
  }
  text = text.replace(/\bLevel1\b/g, "Level 1").replace(/\bLevel2\b/g, "Level 2");
  for (const [field, label] of Object.entries(fieldLabels)) {
    if (field === "remarks" || field === "status") continue; // Already readable words in sentences.
    text = text.replace(new RegExp(`\\b${field}\\b`, "g"), label);
  }
  if (/^Cannot modify (?:immutable|server-managed|protected).*fields:/i.test(text)) {
    text = text.replace(/:\s*[\s\S]*$/, ". These details are controlled by the work order workflow.");
  }
  if (/^Unexpected fields in draft save:/i.test(text)) {
    text = "The draft contains details that cannot be changed here. Review the work order details and try again.";
  }
  // This option is used only by RH preflight, which sends Current Reading Date.
  if (readingDate) text = text.replace(/\bCompletion Date\b/g, "Current Reading Date");
  text = text.replace(/Current Reading must be a positive number \(≥ 0\)\.?/g,
    "Current Reading must be a valid number that is zero or greater.")
    .replace(/No\.? of Persons/g, "Number of Persons");
  if (/^(?:Number of Persons|No\.? of Persons) must be .*?(?:1.*50|50)/i.test(text)) {
    text = "Number of Persons must be a whole number from 1 to 50.";
  }
  // Never display transport responses, code/SQL/stack traces or parser diagnostics.
  if (/^[A-Z][A-Z0-9]*_[A-Z0-9_]*(?::|$)/.test(text) ||
    /^[{[]|^["}]|^<!|<\/?[a-z][^>]*>|^HTTP\s*\d|^\w+(?:Error|Exception):|\b(?:SQLSTATE|SELECT .+ FROM|INSERT INTO|UPDATE .+ SET|_deductedQty|priorDeductedTotal|ENOENT|EACCES)\b|\n\s*at\s|\b(?:Unexpected token|Unexpected end of JSON|JSON\.parse|Failed to fetch|NetworkError|Load failed|Cannot read properties|violates .+ constraint|(?:column|relation) .+ does not exist)\b|\/technical\/api\//i.test(text)) return;
  return text;
}

export function workOrderErrorDescription(
  error: unknown,
  fallback: string,
  options: { readingDate?: boolean } = {},
): string {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  function add(message: string) {
    const readable = readableText(message, !!options.readingDate);
    if (readable && !messages.includes(readable)) messages.push(readable);
  }
  function visit(value: unknown, depth = 0, label?: string) {
    if (depth > 6 || value == null || seen.has(value)) return;
    if (typeof value === "string") {
      const text = value.trim().replace(/^(?:Error:\s*)?(?:\d{3}\s*:\s*)+/, "").trim();
      if (/^[{[]/.test(text)) {
        try { visit(JSON.parse(text), depth + 1, label); } catch { /* use operation fallback */ }
      } else {
        const message = label ? `${label}: ${text}` : text;
        add(message);
      }
      return;
    }
    if (typeof value !== "object") return;
    seen.add(value);
    if (value instanceof WorkOrderResponseError) { visit(value.payload, depth + 1); return; }
    if (value instanceof Error) { visit(value.message, depth + 1); return; }
    if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1, label)); return; }
    const object = asRecord(value)!;
    if (object.code === "INVALID_RUNNING_HOURS") {
      const entered = workOrderNumber(object.enteredValue);
      const actual = workOrderNumber(object.componentActualRH);
      const maximum = workOrderNumber(object.maxAllowed);
      add(`Current Reading${entered === undefined ? "" : ` (${entered} hours)`} exceeds the component's actual running hours${actual === undefined ? "" : ` (${actual} hours)`}. Update running hours in the Running Hours module first, or correct Current Reading${maximum === undefined ? "." : ` to ${maximum} hours or less.`}`);
      return;
    }
    const path = Array.isArray(object.path) ? object.path.filter(p => typeof p === "string") : [];
    const issueField = [...path].reverse().find(field => fieldLabels[field as string]);
    const issueLabel = issueField ? fieldLabels[issueField as string] : label;
    // Useful length-limit detail takes precedence over an unhelpful summary.
    const details = asRecord(object.details);
    if (details?.message && typeof object.error === "string" && /exceeds maximum length/i.test(object.error)) {
      visit(details.message, depth + 1, issueLabel);
    } else {
      const before = messages.length;
      visit(object.message, depth + 1, issueLabel);
      if (messages.length === before) visit(object.error, depth + 1, issueLabel);
      visit(object.details, depth + 1);
    }
    visit(object.errors, depth + 1);
    visit(object.issues, depth + 1);
    const fields = asRecord(object.fieldErrors);
    if (fields) {
      for (const [field, errors] of Object.entries(fields)) {
        visit(errors, depth + 1, fieldLabels[field] || "Work order details");
      }
    }
  }
  visit(error);
  return messages.join(" ") || fallback;
}

export function workOrderErrorFeedback(error: unknown, title: string, fallback: string) {
  const lower = getLowerRunningHoursWarning(
    error instanceof WorkOrderResponseError ? error.payload : error,
  );
  return lower ?? { title, description: workOrderErrorDescription(error, fallback) };
}

/** Display only finite values actually supplied; never round a validation boundary. */
export function workOrderNumber(value: unknown): string | undefined {
  if (typeof value !== "number" && typeof value !== "string") return;
  if (typeof value === "string" && !value.trim()) return;
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("en-US", { maximumFractionDigits: 20 }) : undefined;
}

/** Presentation only: successes, warnings and partial outcomes keep their original status. */
export function formatWorkOrderToast<T extends { title?: unknown; description?: unknown; variant?: unknown }>(
  toast: T,
  defaultFailureTitle = "Work Order Save Failed",
): T {
  if (toast.variant !== "destructive" || typeof toast.title !== "string") return toast;
  if (/saved|created|approved|partial|notice|no data|overdue completion|running hours update blocked/i.test(toast.title)) return toast;
  const titles: Record<string, string> = {
    Error: defaultFailureTitle, "Validation Error": "Work Order Validation",
    "Validation error": "Work Order Validation", "Save Failed": "Work Order Save Failed",
    "Save failed": "Work Order Save Failed", "Generation failed": "Work Order Generation Failed",
    "Upload failed": "Document Upload Failed", "Upload Failed": "Document Upload Failed",
    "View failed": "Document Open Failed", "Download failed": "Document Download Failed",
    "Delete failed": "Document Delete Failed", "Export failed": "Export Failed",
    "Approval failed": "Approval Blocked", "Rejection failed": "Work Order Rejection Failed",
    "Reopen failed": "Work Order Reopen Failed", "Failed to save": defaultFailureTitle,
  };
  const title = titles[toast.title] || toast.title;
  const fallbacks: Record<string, string> = {
    "Work Order Save Failed": "The work order could not be saved. Check the details and try again.",
    "Work Order Draft Save Failed": "The draft could not be saved. Check the work order details and try again.",
    "Work Order Creation Failed": "The work order could not be created. Check the details and try again.",
    "Work Order Update Failed": "The work order could not be updated. Check the details and try again.",
    "Work Order Delete Failed": "The work order could not be deleted. Please try again.",
    "Work Order Generation Failed": "Work orders could not be generated. Please try again.",
    "Work Order Rejection Failed": "The work order could not be rejected. Check the rejection remarks and try again.",
    "Work Order Reopen Failed": "The work order could not be reopened. Check the reopen remarks and try again.",
    "Work Order Review Failed": "The review could not be completed. Check the review details and try again.",
    "Job Creation Failed": "The job could not be created. Check the job details and try again.",
    "Planner Save Failed": "The planned date could not be saved. Check the date and try again.",
    "Planner Bulk Save Failed": "The planned dates could not be saved. Check the selected jobs and date, then try again.",
    "Could not start review queue": "The review queue could not be opened. Please try again.",
    "Work Order Validation": "Check the required work order details and try again.",
    "Approval Blocked": "The work order could not be approved. Check the approval requirements and try again.",
    "Document Upload Failed": "The document could not be uploaded. Check the file and try again.",
    "Document Open Failed": "The document could not be opened. Please try again.",
    "Document Download Failed": "The document could not be downloaded. Please try again.",
    "Document Delete Failed": "The document could not be deleted. Please try again.",
    "Export Failed": "The export could not be completed. Please try again.",
    "Postponement Failed": "The work order could not be postponed. Check the postponement details and try again.",
    "Re-postponement Failed": "The work order could not be re-postponed. Check the postponement details and try again.",
  };
  const fallback = fallbacks[title] || `${title.replace(/ Failed$/, "")} could not be completed. Check the details and try again.`;
  return { ...toast, ...workOrderErrorFeedback(toast.description, title, fallback) };
}
