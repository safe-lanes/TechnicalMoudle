import CryptoJS from "crypto-js";

const TOKEN_STORAGE_KEY = "credentials";

const TOKEN_FIELD_CANDIDATES = [
  "token",
  "accessToken",
  "access_token",
  "jwt",
  "idToken",
  "id_token",
] as const;

/**
 * AES key used to decrypt the `credentials` blob. Mirrors the resolution in
 * `client/src/utils/secureStorage.ts` so both read the same secret. When the
 * env var is missing we fall back to a dev key (and warn in prod); decryption
 * then simply yields nothing usable and `getAccessToken()` returns `null`.
 */
const STORAGE_SECRET = (() => {
  const envKey = import.meta.env.VITE_STORAGE_SECRET;
  if (envKey) return envKey;
  if (import.meta.env.PROD) {
    console.error(
      "CRITICAL: VITE_STORAGE_SECRET is not set in production. Cannot decrypt credentials.",
    );
  }
  return "dev-fallback-key-do-not-use-in-prod";
})();

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
 * Decode the decrypted plaintext into a value. The stored credentials are
 * double-encoded (a JSON string wrapping another JSON string), so we parse
 * once and, if the result is still a JSON string, parse again — matching the
 * `JSON.parse(JSON.parse(...))` shape and `secureStorage.secureGetItem`.
 */
function decodeDecrypted(decryptedText: string): unknown {
  const once: unknown = JSON.parse(decryptedText);
  if (typeof once === "string") {
    try {
      return JSON.parse(once);
    } catch {
      // `once` is already the final token string, not further-encoded JSON.
      return once;
    }
  }
  return once;
}

function normalizeToken(value: unknown): string | null {
  if (typeof value === "string") {
    return stripQuotes(value) || null;
  }
  if (value && typeof value === "object") {
    return extractFromObject(value as Record<string, unknown>);
  }
  return null;
}

/**
 * Read the access token used for the `Authorization: Bearer` header.
 *
 * The token lives in `sessionStorage` under the `credentials` key as an
 * AES-encrypted (CryptoJS) blob keyed by `VITE_STORAGE_SECRET`. We decrypt it,
 * decode the (double-encoded) JSON, and return the JWT — either the decoded
 * string directly or a known token field from the decoded object. Returns
 * `null` when nothing usable is present or decryption fails, so callers simply
 * omit the header (keeps dev/Replit mock auth working).
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

    const bytes = CryptoJS.AES.decrypt(raw, STORAGE_SECRET);
    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedText) {
      return null;
    }

    return normalizeToken(decodeDecrypted(decryptedText));
  } catch {
    return null;
  }
}
