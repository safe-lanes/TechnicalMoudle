const TOKEN_STORAGE_KEY = "credentials";

const TOKEN_FIELD_CANDIDATES = [
  "token",
  "accessToken",
  "access_token",
  "jwt",
  "idToken",
  "id_token",
] as const;

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function extractFromObject(obj: Record<string, unknown>): string | null {
  for (const field of TOKEN_FIELD_CANDIDATES) {
    const candidate = obj[field];
    if (typeof candidate === "string" && candidate.trim()) {
      return stripQuotes(candidate);
    }
  }
  return null;
}

/**
 * Read the access token used for the `Authorization: Bearer` header.
 *
 * The token lives in `sessionStorage` under the `credentials` key. The stored
 * value may be a raw token string OR a JSON-wrapped value (e.g.
 * `{ "token": "..." }`, `{ "accessToken": "..." }`, or a JSON string). We try
 * to parse JSON first and pull a known token field; otherwise we treat the
 * stored value as the raw token. Returns `null` when nothing usable is present
 * so callers simply omit the header (keeps dev/Replit mock auth working).
 */
export function getAccessToken(): string | null {
  try {
    if (typeof sessionStorage === "undefined") {
      return null;
    }
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw || !raw.trim()) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      // The stored value parsed as JSON. Only a string or an object with a
      // recognized token field is usable; anything else (object without a
      // token field, number, boolean, null) yields null — we must NOT fall
      // back to the raw JSON blob as a bogus token.
      if (typeof parsed === "string") {
        return stripQuotes(parsed) || null;
      }
      if (parsed && typeof parsed === "object") {
        return extractFromObject(parsed as Record<string, unknown>);
      }
      return null;
    } catch {
      // Not JSON — treat the raw value as the token itself.
      return stripQuotes(raw) || null;
    }
  } catch {
    return null;
  }
}
