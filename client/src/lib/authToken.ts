import CryptoJS from "crypto-js";
import { isReplit } from "./env";

const TOKEN_STORAGE_KEY = "credentials";

let redirectedToLogin = false;

/**
 * Handle a token-resolution failure. Outside Replit (production / local) a
 * missing or invalid session means the user is not logged in, so we send the
 * browser to the parent app's existing `/login` page (a hard navigation — it is
 * NOT an in-app route). On Replit we keep the dev mock-auth convenience and
 * simply return `null` so the PMS renders normally. Always returns `null` so
 * callers omit the `Authorization` header.
 */
function onTokenFailure(): null {
  if (
    !isReplit() &&
    typeof window !== "undefined" &&
    !redirectedToLogin &&
    window.location.pathname !== "/login"
  ) {
    redirectedToLogin = true;
    window.location.assign("/login");
  }
  return null;
}

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
 * Decrypt and normalize the `credentials` blob from a single Web Storage area.
 * Returns the JWT (decoded string directly or a known token field of the
 * decoded object) or `null` when the key is absent, empty, or fails to
 * decrypt/decode. Never triggers the login-redirect side effect — that is the
 * caller's responsibility once ALL stores have been exhausted.
 */
function readTokenFromStore(store: Storage): string | null {
  try {
    const raw = store.getItem(TOKEN_STORAGE_KEY);
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
    // Decryption/parse error or storage access threw (e.g. privacy mode) —
    // treat as "no token here" so the caller can try the next store.
    return null;
  }
}

/**
 * Read the access token used for the `Authorization: Bearer` header.
 *
 * The token is an AES-encrypted (CryptoJS) blob stored under the `credentials`
 * key, keyed by `VITE_STORAGE_SECRET`. `sessionStorage` is the primary source
 * and is checked first; if no usable token is found there we fall back to
 * `localStorage` (the store the app's own `secureStorage` utility reads/writes),
 * so a credential present only in `localStorage` still authenticates instead of
 * causing a spurious logout. Each store is decrypted and decoded with the same
 * pipeline. Only when BOTH stores yield nothing usable do we return `null` and
 * (outside Replit) redirect to `/login` — so callers simply omit the header
 * (keeps dev/Replit mock auth working).
 */
export function getAccessToken(): string | null {
  if (typeof sessionStorage !== "undefined") {
    const fromSession = readTokenFromStore(sessionStorage);
    if (fromSession) {
      return fromSession;
    }
  }

  if (typeof localStorage !== "undefined") {
    const fromLocal = readTokenFromStore(localStorage);
    if (fromLocal) {
      return fromLocal;
    }
  }

  return onTokenFailure();
}
