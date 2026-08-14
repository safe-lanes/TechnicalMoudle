import CryptoJS from "crypto-js";

export const LOCAL_STORAGE_KEYS = [
  "userProfile",
  "userRole",
  "userType",
  "credentials",
  "Role_Access_Data",
  "domain",
] as const;

export type LocalStorageKey = (typeof LOCAL_STORAGE_KEYS)[number];

const SECRET_KEY = (() => {
  const envKey = import.meta.env.VITE_STORAGE_SECRET;
  if (envKey) return envKey;
  if (import.meta.env.PROD) {
    console.error("CRITICAL: VITE_STORAGE_SECRET is not set in production. Using fallback key is insecure.");
  }
  return "dev-fallback-key-do-not-use-in-prod";
})();

function validateKey(key: string): asserts key is LocalStorageKey {
  if (!LOCAL_STORAGE_KEYS.includes(key as LocalStorageKey)) {
    throw new Error(
      `Invalid secure storage key: "${key}". Allowed keys: ${LOCAL_STORAGE_KEYS.join(", ")}`
    );
  }
}

export function encryptValue(value: unknown): string {
  const jsonString = JSON.stringify(value);
  return CryptoJS.AES.encrypt(jsonString, SECRET_KEY).toString();
}

export function decryptValue<T>(ciphertext: string): T {
  const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
  const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
  if (!decryptedString) {
    throw new Error("Decryption failed: invalid ciphertext or wrong key");
  }
  return JSON.parse(decryptedString) as T;
}

export function secureGetItem<T>(key: string): T | null {
  validateKey(key);
  const raw = localStorage.getItem(key);
  if (raw === null) {
    return null;
  }
  try {
    const decrypted = decryptValue(raw) as string;
    if (typeof decrypted === "string") {
      try {
        return JSON.parse(decrypted) as T;
      } catch {
        return decrypted as unknown as T;
      }
    }
    return decrypted as T;
  } catch {
    console.warn(`Failed to decrypt "${key}" from localStorage.`);
    return null;
  }
}

// Non-encrypted auth-adjacent keys that must also be wiped on logout. Kept
// explicit (not encrypted, so not part of LOCAL_STORAGE_KEYS) so the full
// logout wipe set stays visible in one place.
export const EXTRA_AUTH_LOCAL_STORAGE_KEYS = [
  "selectedVesselId",
  "selected_module",
] as const;

const FORM_VERSIONS_PREFIX = "form-versions-";

/**
 * Wipe every authentication-related entry from BOTH localStorage and
 * sessionStorage. Clears the encrypted keys (`LOCAL_STORAGE_KEYS`), the extra
 * auth keys, and any `form-versions-*` cache entry. Used by logout so a reload
 * cannot silently re-hydrate the previous user.
 *
 * sessionStorage matters: `authToken.peekAccessToken()` checks sessionStorage
 * FIRST for the `credentials` blob, so a token left there would keep
 * authenticating requests after logout and suppress the missing-token
 * login redirect.
 */
export function secureClear(): void {
  for (const key of LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
  for (const key of EXTRA_AUTH_LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(FORM_VERSIONS_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Explicit "logged out" marker (Replit dev preview only).
//
// In the Replit workspace, AuthContext falls back to a default dev user when
// no stored profile exists — convenient for fresh dev sessions, but it would
// silently re-login a user who just logged out and reloaded. This marker,
// set on logout and cleared on a real login, suppresses that fallback so an
// intentional logout sticks. Outside Replit the fallback never runs at all
// (gated on isReplit()), so the marker is a dev-only concern.
// ---------------------------------------------------------------------------

const LOGGED_OUT_MARKER_KEY = "pms_logged_out";

export function setLoggedOutMarker(): void {
  try {
    localStorage.setItem(LOGGED_OUT_MARKER_KEY, "1");
  } catch {
    // Storage unavailable — nothing to persist; fallback gating degrades to
    // pre-marker behavior.
  }
}

export function clearLoggedOutMarker(): void {
  try {
    localStorage.removeItem(LOGGED_OUT_MARKER_KEY);
  } catch {
    // ignore
  }
}

export function hasLoggedOutMarker(): boolean {
  try {
    return localStorage.getItem(LOGGED_OUT_MARKER_KEY) === "1";
  } catch {
    return false;
  }
}
