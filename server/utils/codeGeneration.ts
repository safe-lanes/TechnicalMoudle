/**
 * Code Generation Utilities for Fleet Admin Module
 * 
 * Generates auto-incremented codes for:
 * - Fleet Equipment Codes (XXX.XXX.XX format based on SFI hierarchy)
 * - Fleet Job Codes (WO-XXXXXXX format)
 * - Fleet Part Codes (PT-XXXXXXX format)
 */

interface CodeCounters {
  fleetEquipmentCounter: number;
  fleetJobCounter: number;
  fleetPartCounter: number;
}

// In-memory counters (will be replaced with persistent storage)
let counters: CodeCounters = {
  fleetEquipmentCounter: 0,
  fleetJobCounter: 0,
  fleetPartCounter: 0,
};

/**
 * Initialize counters from existing data
 */
export function initializeCounters(maxEquipmentCode: string | null, maxJobCode: string | null, maxPartCode: string | null) {
  // Parse max equipment code (XXX.XXX.XX format)
  if (maxEquipmentCode) {
    const parts = maxEquipmentCode.split('.');
    if (parts.length === 3) {
      const lastSegment = parseInt(parts[2], 10);
      if (!isNaN(lastSegment)) {
        counters.fleetEquipmentCounter = Math.max(counters.fleetEquipmentCounter, lastSegment);
      }
    }
  }

  // Parse max job code (WO-XXXXXXX format)
  if (maxJobCode) {
    const match = maxJobCode.match(/^WO-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) {
        counters.fleetJobCounter = Math.max(counters.fleetJobCounter, num);
      }
    }
  }

  // Parse max part code (PT-XXXXXXX format)
  if (maxPartCode) {
    const match = maxPartCode.match(/^PT-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) {
        counters.fleetPartCounter = Math.max(counters.fleetPartCounter, num);
      }
    }
  }
}

/**
 * Generate next Fleet Equipment Code based on parent code
 * Format: XXX.XXX.XX
 * 
 * @param parentFleetEquipmentCode - Parent equipment code (e.g., "601.001")
 * @returns Next equipment code (e.g., "601.001.01")
 */
export function generateFleetEquipmentCode(parentFleetEquipmentCode: string | null): string {
  if (!parentFleetEquipmentCode) {
    // Root level component - use SFI main group (1-8)
    // This should be provided by the caller, but we'll default to incrementing
    counters.fleetEquipmentCounter++;
    const mainGroup = Math.floor(counters.fleetEquipmentCounter / 1000) + 1;
    const subGroup = counters.fleetEquipmentCounter % 1000;
    return `${mainGroup}.${String(subGroup).padStart(3, '0')}`;
  }

  // Child component - append 2-digit segment to parent
  const parts = parentFleetEquipmentCode.split('.');
  
  if (parts.length === 2) {
    // Parent is second level (e.g., "601.001"), add third level
    counters.fleetEquipmentCounter++;
    const childNum = counters.fleetEquipmentCounter % 100;
    return `${parentFleetEquipmentCode}.${String(childNum).padStart(2, '0')}`;
  } else if (parts.length === 3) {
    // Parent is third level, increment last segment
    const lastSegment = parseInt(parts[2], 10) || 0;
    const nextSegment = lastSegment + 1;
    return `${parts[0]}.${parts[1]}.${String(nextSegment).padStart(2, '0')}`;
  }

  // Default fallback
  counters.fleetEquipmentCounter++;
  return `${parentFleetEquipmentCode}.${String(counters.fleetEquipmentCounter % 100).padStart(2, '0')}`;
}

/**
 * Generate next Fleet Job Code
 * Format: WO-XXXXXXX (7 digits, zero-padded)
 * 
 * @returns Next job code (e.g., "WO-0000001")
 */
export function generateFleetJobCode(): string {
  counters.fleetJobCounter++;
  return `WO-${String(counters.fleetJobCounter).padStart(7, '0')}`;
}

/**
 * Generate next Fleet Part Code
 * Format: PT-XXXXXXX (7 digits, zero-padded)
 * 
 * @returns Next part code (e.g., "PT-0000001")
 */
export function generateFleetPartCode(): string {
  counters.fleetPartCounter++;
  return `PT-${String(counters.fleetPartCounter).padStart(7, '0')}`;
}

/**
 * Get current counter values (for debugging/testing)
 */
export function getCounters(): CodeCounters {
  return { ...counters };
}

/**
 * Reset counters (for testing only)
 */
export function resetCounters() {
  counters = {
    fleetEquipmentCounter: 0,
    fleetJobCounter: 0,
    fleetPartCounter: 0,
  };
}
