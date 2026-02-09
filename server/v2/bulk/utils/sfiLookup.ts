import fs from 'fs';
import path from 'path';

interface SFIEntry {
  code: string;
  name: string;
  parentCode: string;
  mainGroup: string;
  subGroup: string;
}

let sfiMap: Map<string, SFIEntry> | null = null;

function loadSFIData(): Map<string, SFIEntry> {
  const csvPath = path.join(process.cwd(), 'attached_assets/component tree_1761646533252.csv');
  
  try {
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n');
    const map = new Map<string, SFIEntry>();
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
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
      fields.push(currentField.trim());
      
      if (fields.length >= 5) {
        const code = fields[0];
        const name = fields[1];
        const parentCode = fields[2];
        const mainGroup = fields[3];
        const subGroup = fields[4];
        
        if (code) {
          map.set(code, { code, name, parentCode, mainGroup, subGroup });
        }
      }
    }
    
    return map;
  } catch (error) {
    console.warn('[V2] Could not load SFI component tree CSV, using fallback naming:', error);
    return new Map();
  }
}

export function getSFIName(code: string): string {
  if (!sfiMap) {
    sfiMap = loadSFIData();
  }
  
  const entry = sfiMap.get(code);
  if (entry) {
    return entry.name || entry.subGroup;
  }
  
  return `SFI ${code}`;
}
