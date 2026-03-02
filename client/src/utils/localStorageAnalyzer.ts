const LOCAL_STORAGE_KEYS = [
  "userProfile",
  "userRole",
  "userType",
  "credentials",
  "Role_Access_Data",
] as const;

type LocalStorageKey = (typeof LOCAL_STORAGE_KEYS)[number];

const SENSITIVE_KEYS: LocalStorageKey[] = ["credentials"];

const SENSITIVE_FIELDS = ["token", "refreshToken", "password", "secret", "apiKey"];

interface AnalysisResult {
  key: LocalStorageKey;
  exists: boolean;
  isEncrypted: boolean;
  encryptionType: string;
  rawValue: string | null;
  parsedValue: unknown;
  error?: string;
}

function detectEncryption(value: string): { encrypted: boolean; type: string } {
  if (!value || value.trim().length === 0) return { encrypted: false, type: "none" };

  const trimmed = value.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith('"')) {
    return { encrypted: false, type: "none" };
  }

  const aesPattern = /^U2FsdGVkX1/;
  if (aesPattern.test(trimmed)) return { encrypted: true, type: "AES (OpenSSL salted)" };

  const jwtPattern = /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  if (jwtPattern.test(trimmed)) return { encrypted: false, type: "JWT (not encrypted, signed token)" };

  const hexPattern = /^[0-9a-fA-F]{32,}$/;
  if (hexPattern.test(trimmed)) return { encrypted: true, type: "hex-encoded (possibly AES/custom)" };

  const base64Pattern = /^[A-Za-z0-9+/=]{16,}$/;
  if (base64Pattern.test(trimmed)) return { encrypted: true, type: "base64 (possibly encrypted)" };

  return { encrypted: false, type: "none" };
}

function tryParse(value: string): { parsed: unknown; success: boolean } {
  try {
    const parsed = JSON.parse(value);
    return { parsed, success: true };
  } catch {
    return { parsed: value, success: false };
  }
}

function tryDecrypt(value: string, encryptionType: string): { decrypted: unknown; method: string } {
  if (encryptionType === "AES (OpenSSL salted)") {
    return {
      decrypted: `[AES encrypted - requires decryption key/library. Raw length: ${value.length} chars]`,
      method: "AES detected but no CryptoJS/decryption library available",
    };
  }

  if (encryptionType === "hex-encoded (possibly AES/custom)") {
    return {
      decrypted: `[Hex-encoded value - requires decryption logic. Raw length: ${value.length} chars]`,
      method: "hex detected but decryption mechanism unknown",
    };
  }

  try {
    const decoded = atob(value);
    const parseResult = tryParse(decoded);
    if (parseResult.success) {
      return { decrypted: parseResult.parsed, method: "base64 -> JSON" };
    }
    return { decrypted: decoded, method: "base64 -> string" };
  } catch {
    return { decrypted: `[Could not decode. Raw length: ${value.length} chars]`, method: "base64 decode failed" };
  }
}

function maskSensitiveValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length <= 8) return "****";
    return value.substring(0, 4) + "****" + value.substring(value.length - 4);
  }

  if (typeof value === "object" && value !== null) {
    const masked: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_FIELDS.some((sf) => k.toLowerCase().includes(sf.toLowerCase()))) {
        masked[k] = typeof v === "string" ? v.substring(0, 4) + "****" : "****";
      } else {
        masked[k] = v;
      }
    }
    return masked;
  }

  return value;
}

function analyzeKey(key: LocalStorageKey): AnalysisResult {
  const result: AnalysisResult = {
    key,
    exists: false,
    isEncrypted: false,
    encryptionType: "none",
    rawValue: null,
    parsedValue: null,
  };

  try {
    const rawValue = localStorage.getItem(key);

    if (rawValue === null) {
      result.exists = false;
      result.parsedValue = null;
      return result;
    }

    result.exists = true;
    result.rawValue = rawValue;

    const detection = detectEncryption(rawValue);
    result.isEncrypted = detection.encrypted;
    result.encryptionType = detection.type;

    if (result.isEncrypted) {
      const { decrypted, method } = tryDecrypt(rawValue, detection.type);
      result.parsedValue = decrypted;
      console.log(`  Encryption type: ${detection.type}`);
      console.log(`  Decryption method: ${method}`);
    } else {
      const { parsed } = tryParse(rawValue);
      result.parsedValue = parsed;
      if (detection.type !== "none") {
        console.log(`  Format detected: ${detection.type}`);
      }
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

export function analyzeLocalStorage(): void {
  if (import.meta.env.PROD) {
    return;
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  LocalStorage Role-Based Access Data Analysis");
  console.log("═══════════════════════════════════════════════════════════");

  const results: AnalysisResult[] = [];

  for (const key of LOCAL_STORAGE_KEYS) {
    const result = analyzeKey(key);
    results.push(result);

    console.log("");
    console.log(`── ${key} ──────────────────────────────────`);

    if (!result.exists) {
      console.log(`  Key "${key}" not found in localStorage`);
      continue;
    }

    if (result.error) {
      console.log(`  Error reading "${key}": ${result.error}`);
      continue;
    }

    const isSensitive = SENSITIVE_KEYS.includes(key);
    const displayValue = isSensitive ? maskSensitiveValue(result.parsedValue) : result.parsedValue;

    if (result.isEncrypted) {
      console.log(`  Value is encrypted (${result.encryptionType})`);
      console.log(`  Decrypted ${key}:`, displayValue);
    } else {
      console.log(`  Decrypted ${key}:`, displayValue);
    }
  }

  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Summary");
  console.log("═══════════════════════════════════════════════════════════");

  const found = results.filter((r) => r.exists);
  const missing = results.filter((r) => !r.exists);
  const encrypted = results.filter((r) => r.isEncrypted);
  const errors = results.filter((r) => r.error);

  console.log(`  Total keys checked: ${results.length}`);
  console.log(`  Found: ${found.length}`);
  console.log(`  Missing: ${missing.length}${missing.length > 0 ? ` (${missing.map((r) => r.key).join(", ")})` : ""}`);
  console.log(`  Encrypted: ${encrypted.length}`);
  console.log(`  Errors: ${errors.length}`);
  console.log("═══════════════════════════════════════════════════════════");
}

export function getLocalStorageRoleData(): Record<LocalStorageKey, unknown> {
  const data: Record<string, unknown> = {};

  for (const key of LOCAL_STORAGE_KEYS) {
    try {
      const rawValue = localStorage.getItem(key);
      if (rawValue === null) {
        data[key] = null;
        continue;
      }

      const detection = detectEncryption(rawValue);
      if (detection.encrypted) {
        const { decrypted } = tryDecrypt(rawValue, detection.type);
        data[key] = decrypted;
      } else {
        const { parsed } = tryParse(rawValue);
        data[key] = parsed;
      }
    } catch {
      data[key] = null;
    }
  }

  return data as Record<LocalStorageKey, unknown>;
}
