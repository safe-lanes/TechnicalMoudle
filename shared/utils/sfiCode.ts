// Shared SFI (Ship Functional Index) component-code helpers.
//
// Single source of truth for SFI code format validation and structural parsing so that
// the bulk-import dry-run (server/modules/bulk-upload) and the interactive Add/Edit
// Component forms (server/modules/components) enforce IDENTICAL parent-code rules. Do not
// fork this logic — both entry paths must agree on what a valid Parent Component Code is.

/** Remove a trailing parenthetical suffix: "226.065(1)" -> "226.065". */
export function stripSFISuffix(sfiCode: string): string {
  return sfiCode.replace(/\([^)]*\)$/, '').trim();
}

/** Validate SFI code format. Accepts dotted (6, 61, 612, 612.005) and undotted (601001) forms,
 *  tolerating a trailing parenthetical suffix like 226.065(1). */
export function validateSFICode(sfiCode: string): boolean {
  const cleanCode = stripSFISuffix(sfiCode);
  // Dotted format: each segment is 1–3 digits separated by dots
  const dottedPattern = /^[0-9]{1,3}(\.[0-9]{1,3})*$/;
  // Undotted format: 1–9 consecutive digits with no dots
  const undottedPattern = /^[0-9]{1,9}$/;
  return dottedPattern.test(cleanCode) || undottedPattern.test(cleanCode);
}

/** Derive the structural parent SFI code, or null for a single-digit top-level code. */
export function getParentSFICode(sfiCode: string): string | null {
  const cleanCode = stripSFISuffix(sfiCode);

  const parts = cleanCode.split('.');
  if (parts.length > 1) {
    parts.pop();
    return parts.join('.');
  }
  const baseCode = cleanCode;
  if (baseCode.length >= 7) {
    return baseCode.substring(0, baseCode.length - 3);
  } else if (baseCode.length >= 4) {
    return baseCode.substring(0, 3);
  } else if (baseCode.length === 3) {
    return baseCode.substring(0, 2);
  } else if (baseCode.length === 2) {
    return baseCode.charAt(0);
  }
  return null;
}
