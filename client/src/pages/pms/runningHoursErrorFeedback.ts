type Payload = Record<string, unknown>;
export interface RunningHoursErrorFeedback {
  title: string;
  description: string;
}

const record = (value: unknown): Payload | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Payload : undefined;

// Preserve the shared request utility's contract. Only RH feedback unwraps its
// "400: { ... }" message; unrelated callers continue to receive the same errors.
export class RunningHoursUpdateError extends Error {
  constructor(readonly payload: unknown) {
    super("Running hours update blocked");
    this.name = "RunningHoursUpdateError";
  }
}

function unwrap(error: unknown): { payload?: Payload; text?: string } {
  if (error instanceof RunningHoursUpdateError) return { payload: record(error.payload) };
  const object = record(error);
  if (object && (object.code || object.reason || object.monotonicity || object.details || object.error)) {
    return { payload: object };
  }
  const raw = typeof error === "string" ? error : object?.message;
  if (typeof raw !== "string") return {};
  const text = raw.replace(/^\s*[45]\d{2}\s*:\s*/, "").trim();
  try {
    return { payload: record(JSON.parse(text)) };
  } catch {
    return { text };
  }
}

function fields(payload?: Payload): Payload[] {
  if (!payload) return [];
  const details = record(payload.details);
  return [payload, details, record(payload.error), record(payload.monotonicity),
    record(details?.monotonicity)].filter((value): value is Payload => !!value);
}

function reading(value: unknown): string | undefined {
  if (typeof value !== "number" &&
      !(typeof value === "string" && /^[+-]?\d+(?:\.\d+)?$/.test(value.trim()))) return;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return;
  return number.toLocaleString("en-US", { maximumFractionDigits: 20 });
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function readingDate(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value.trim());
  const display = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(value.trim());
  if (!iso && !display) return;
  const year = Number(iso ? iso[1] : display![3]);
  const month = iso ? Number(iso[2]) - 1 : months.findIndex(m => m.toLowerCase() === display![2].toLowerCase());
  const day = Number(iso ? iso[3] : display![1]);
  const date = new Date(Date.UTC(year, month, day));
  if (month < 0 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return;
  // Treat the response's reading date as a calendar day, not a local timestamp.
  return `${String(day).padStart(2, "0")}-${months[month]}-${year}`;
}

export function getLowerRunningHoursWarning(error: unknown): RunningHoursErrorFeedback | null {
  const candidates = fields(unwrap(error).payload);
  if (!candidates.some(p => p.code === "LOWER_THAN_CURRENT_RH" || p.reason === "LOWER_THAN_CURRENT_RH")) return null;
  const value = (key: string) => candidates.find(p => p[key] !== undefined)?.[key];
  const entered = reading(value("submittedRH"));
  const current = reading(value("currentRH"));
  const date = readingDate(value("currentRHDate"));
  const enteredText = entered !== undefined ? `Entered reading: ${entered} RH. ` : "";
  const currentText = current !== undefined ? `Latest saved reading: ${current} RH${date ? ` on ${date}` : ""}. ` : "";
  return {
    title: "Running Hours Update Blocked",
    description: `${enteredText}${currentText}The reading cannot be lower than the latest saved value. Check and correct the reading.`,
  };
}

function plainMessage(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const text = value.replace(/^\s*[45]\d{2}\s*:\s*/, "").trim();
  // Do not show malformed JSON, HTML responses, internal codes or stack traces.
  if (!text || /[{}[\]<>]|(?:^|\n)\s*at\s|\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|(?:Error|Exception):/.test(text)) return;
  return text;
}

export function getRunningHoursErrorFeedback(error: unknown, fallback: string): RunningHoursErrorFeedback {
  const warning = getLowerRunningHoursWarning(error);
  if (warning) return warning;
  const { payload, text } = unwrap(error);
  const messages = fields(payload).flatMap(p => [p.error, p.message]);
  const description = messages.map(plainMessage).find(Boolean) || plainMessage(text) || fallback;
  return { title: "Error", description };
}
