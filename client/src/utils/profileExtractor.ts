interface ExtractedProfile {
  id: number;
  role: string | null;
  username: string;
  fullName: string;
  email: string | null;
  vesselId: string | null;
  department: string | null;
  crewDesignation: string | null;
}

const MAX_DEPTH = 3;

function findNestedValue(obj: Record<string, any>, field: string, depth = 0): any {
  if (depth > MAX_DEPTH) return undefined;

  if (obj[field] !== undefined && obj[field] !== null) return obj[field];

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const found = findNestedValue(val, field, depth + 1);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}

function findNestedValueWithPath(obj: Record<string, any>, field: string, depth = 0, path = ""): { value: any; path: string } | null {
  if (depth > MAX_DEPTH) return null;

  const currentPath = path ? `${path}.${field}` : field;
  if (obj[field] !== undefined && obj[field] !== null) return { value: obj[field], path: currentPath };

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const nextPath = path ? `${path}.${key}` : key;
      const found = findNestedValueWithPath(val, field, depth + 1, nextPath);
      if (found) return found;
    }
  }

  return null;
}

export function extractRole(profile: Record<string, any> | null): string | null {
  if (!profile) return null;

  const roleFields = ["role", "roleName", "role_name", "assigned_role", "user_role", "profileRole"];

  for (const field of roleFields) {
    const result = findNestedValueWithPath(profile, field);
    if (result && typeof result.value === "string" && result.value.trim()) {
      const role = result.value.trim();
      if (import.meta.env.DEV) {
        console.log(`[ProfileExtractor] Found role at "${result.path}" = "${role}"`);
      }
      return role;
    }
  }

  if (import.meta.env.DEV) {
    console.warn("[ProfileExtractor] No role field found in profile. Top-level keys:", Object.keys(profile).slice(0, 20));
  }

  return null;
}

export function extractProfileFields(profile: Record<string, any> | null): ExtractedProfile {
  if (!profile) {
    return {
      id: 0,
      role: null,
      username: "user",
      fullName: "User",
      email: null,
      vesselId: null,
      department: null,
      crewDesignation: null,
    };
  }

  const find = (fields: string[]) => {
    for (const f of fields) {
      const val = findNestedValue(profile, f);
      if (val !== undefined && val !== null) return val;
    }
    return undefined;
  };

  const rawId = find(["id", "userId", "user_id"]);

  return {
    id: Number(rawId) || 0,
    role: extractRole(profile),
    username: String(find(["username", "userName", "user_name", "login"]) || "user"),
    fullName: String(find(["fullName", "full_name", "fullname", "name", "displayName"]) || "User"),
    email: find(["email", "email_address", "emailAddress"]) || null,
    vesselId: find(["vesselId", "vessel_id", "vesselUuid"]) || null,
    department: find(["department", "department_name", "dept"]) || null,
    crewDesignation: find(["crewDesignation", "crew_designation", "designation", "position", "title"]) || null,
  };
}
