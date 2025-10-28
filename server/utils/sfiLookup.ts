import fs from 'fs';
import path from 'path';

/**
 * SFI (Standard for Information) Code Lookup System
 * 
 * This utility provides a mapping from SFI codes to their standard names.
 * Data is sourced from the official SFI component tree CSV.
 */

interface SFIEntry {
  code: string;
  name: string;
  parentCode: string;
  mainGroup: string;
  subGroup: string;
}

let sfiMap: Map<string, SFIEntry> | null = null;

/**
 * Parse the SFI CSV file and build a code-to-name lookup map
 */
function loadSFIData(): Map<string, SFIEntry> {
  const csvPath = path.join(__dirname, '../../attached_assets/component tree_1761646533252.csv');
  
  try {
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n');
    const map = new Map<string, SFIEntry>();
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parse CSV line - handle quoted fields
      const fields: string[] = [];
      let currentField = '';
      let insideQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          fields.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      fields.push(currentField.trim()); // Add last field
      
      if (fields.length >= 5) {
        const code = fields[0];
        const name = fields[1];
        const parentCode = fields[2];
        const mainGroup = fields[3];
        const subGroup = fields[4];
        
        if (code) {
          map.set(code, {
            code,
            name,
            parentCode,
            mainGroup,
            subGroup
          });
        }
      }
    }
    
    console.log(`✅ Loaded ${map.size} SFI code entries from component tree CSV`);
    return map;
  } catch (error) {
    console.warn('⚠️  Could not load SFI component tree CSV, using fallback naming:', error);
    return new Map();
  }
}

/**
 * Get the official SFI name for a given code
 * @param code - SFI code (e.g., "71", "711", "711.001")
 * @returns The official SFI name, or a generic fallback if not found
 */
export function getSFIName(code: string): string {
  if (!sfiMap) {
    sfiMap = loadSFIData();
  }
  
  const entry = sfiMap.get(code);
  if (entry) {
    // Use SubGroup name if available (most specific), otherwise use name
    return entry.subGroup || entry.name;
  }
  
  // Fallback for codes not in the CSV
  return `SFI ${code}`;
}

/**
 * Get full SFI entry for a given code
 */
export function getSFIEntry(code: string): SFIEntry | null {
  if (!sfiMap) {
    sfiMap = loadSFIData();
  }
  
  return sfiMap.get(code) || null;
}

/**
 * Check if a code exists in the SFI standard
 */
export function isValidSFICode(code: string): boolean {
  if (!sfiMap) {
    sfiMap = loadSFIData();
  }
  
  return sfiMap.has(code);
}
