// The readable server message of a failed API call (QA round 2, CR-01).
//
// apiRequest/throwIfResNotOk throw Error("400: {\"error\":\"…\"}"). Screens that showed a fixed
// "Failed to …" text hid the server's real reason, e.g. "No approval workflow is set up for …".
// This returns the server's `error` / `message` text when it is plain language, otherwise the
// fallback. It never shows raw JSON, HTML, stack traces or internal codes.

type Payload = Record<string, unknown>;

const asRecord = (value: unknown): Payload | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Payload) : undefined;

function plain(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/^\s*[45]\d{2}\s*:\s*/, "").trim();
  if (!text || /[{}[\]<>]|(?:^|\n)\s*at\s|\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|(?:Error|Exception):/.test(text)) return undefined;
  return text;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const raw = typeof error === "string" ? error : asRecord(error)?.message;
  if (typeof raw !== "string") return fallback;
  const body = raw.replace(/^\s*[45]\d{2}\s*:\s*/, "").trim();
  let payload: Payload | undefined;
  try {
    payload = asRecord(JSON.parse(body));
  } catch {
    return plain(body) ?? fallback;
  }
  const candidates = [payload?.error, payload?.message, asRecord(payload?.error)?.message];
  return candidates.map(plain).find(Boolean) ?? fallback;
}
