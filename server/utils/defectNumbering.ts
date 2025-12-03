import { IStorage } from "../storage";

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate next defect number for a vessel
 * Format: DEF-<VESSEL CODE>-<YEAR>-<RUNNING NUMBER>
 * Example: DEF-V001-2025-001
 */
export async function generateDefectNumber(
  storage: IStorage,
  vesselId: string
): Promise<string> {
  const currentYear = new Date().getFullYear();
  
  const safeVesselId = vesselId && vesselId.trim() ? vesselId.trim() : 'UNKNOWN';
  
  const allDefects = await storage.getDefects({ vesselId: safeVesselId });
  
  const existingDefectsForVessel = allDefects.filter(defect => {
    const defectPattern = new RegExp(`^DEF-${escapeRegex(safeVesselId)}-${currentYear}-(\\d+)$`);
    return defectPattern.test(defect.id);
  });
  
  let maxRunningNumber = 0;
  existingDefectsForVessel.forEach(defect => {
    const match = defect.id.match(/-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxRunningNumber) {
        maxRunningNumber = num;
      }
    }
  });
  
  const nextRunningNumber = maxRunningNumber + 1;
  const paddedNumber = nextRunningNumber.toString().padStart(3, '0');
  
  return `DEF-${safeVesselId}-${currentYear}-${paddedNumber}`;
}

/**
 * Validate if a defect ID follows the naming convention
 * Format: DEF-<VESSEL CODE>-<YEAR>-<RUNNING NUMBER>
 */
export function isValidDefectId(defectId: string): boolean {
  const pattern = /^DEF-[A-Z0-9]+-\d{4}-\d{3,}$/;
  return pattern.test(defectId);
}

/**
 * Parse defect ID components
 */
export function parseDefectId(defectId: string): { vesselId: string; year: number; runningNumber: number } | null {
  const match = defectId.match(/^DEF-([A-Z0-9]+)-(\d{4})-(\d+)$/);
  if (!match) return null;
  
  return {
    vesselId: match[1],
    year: parseInt(match[2], 10),
    runningNumber: parseInt(match[3], 10)
  };
}
