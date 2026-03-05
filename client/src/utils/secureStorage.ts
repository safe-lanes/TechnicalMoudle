import CryptoJS from "crypto-js";

export const LOCAL_STORAGE_KEYS = [
  "userProfile",
  "userRole",
  "userType",
  "credentials",
  "Role_Access_Data",
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

export function secureSetItem(key: string, value: unknown): void {
  validateKey(key);
  const encrypted = encryptValue(value);
  localStorage.setItem(key, encrypted);
}

export function secureGetItem<T>(key: string): T | null {
  validateKey(key);
  const raw = localStorage.getItem(key);
  if (raw === null) {
    return null;
  }
  try {
    return decryptValue<T>(raw);
  } catch {
    console.warn(`Failed to decrypt "${key}" from localStorage. Removing corrupted value.`);
    localStorage.removeItem(key);
    return null;
  }
}

export function secureRemoveItem(key: string): void {
  validateKey(key);
  localStorage.removeItem(key);
}

export function clearAllSecureItems(): void {
  for (const key of LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}
