import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

const HISTORY_DIR = path.join(process.cwd(), 'uploads', 'bulk-imports', 'history');

interface ImportHistoryRecord {
  id: string;
  type: string;
  mode: string;
  vesselId: string;
  userId: string;
  startedAt: string;
  completedAt: string;
  status: string;
  created: number;
  updated: number;
  skipped: number;
  archived: number;
  originalName: string;
  storedFilePath: string | null;
  errorReport: string | null;
}

async function ensureHistoryDir(): Promise<void> {
  try {
    await fsPromises.mkdir(HISTORY_DIR, { recursive: true });
  } catch (err) {
    // Directory may already exist
  }
}

export async function saveImportHistory(data: ImportHistoryRecord): Promise<ImportHistoryRecord> {
  await ensureHistoryDir();
  
  const record: ImportHistoryRecord = {
    id: data.id,
    type: data.type,
    mode: data.mode,
    vesselId: data.vesselId,
    userId: data.userId,
    startedAt: data.startedAt || new Date().toISOString(),
    completedAt: data.completedAt || new Date().toISOString(),
    status: data.status,
    created: data.created || 0,
    updated: data.updated || 0,
    skipped: data.skipped || 0,
    archived: data.archived || 0,
    originalName: data.originalName,
    storedFilePath: data.storedFilePath,
    errorReport: data.errorReport || null
  };
  
  const filePath = path.join(HISTORY_DIR, `${record.id}.json`);
  await fsPromises.writeFile(filePath, JSON.stringify(record, null, 2), 'utf8');
  
  console.log(`📝 Saved import history to ${filePath}`);
  return record;
}

export async function getImportHistoryList(
  type?: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ items: ImportHistoryRecord[]; total: number }> {
  await ensureHistoryDir();
  
  try {
    const files = await fsPromises.readdir(HISTORY_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    const records: ImportHistoryRecord[] = [];
    
    for (const file of jsonFiles) {
      try {
        const content = await fsPromises.readFile(path.join(HISTORY_DIR, file), 'utf8');
        const record = JSON.parse(content) as ImportHistoryRecord;
        
        if (!type || record.type === type) {
          records.push(record);
        }
      } catch (err) {
        console.error(`Failed to read history file ${file}:`, err);
      }
    }
    
    records.sort((a, b) => {
      const dateA = new Date(a.startedAt || a.completedAt).getTime();
      const dateB = new Date(b.startedAt || b.completedAt).getTime();
      return dateB - dateA;
    });
    
    const total = records.length;
    const paginatedItems = records.slice(offset, offset + limit);
    
    return { items: paginatedItems, total };
  } catch (err) {
    console.error('Failed to read import history directory:', err);
    return { items: [], total: 0 };
  }
}

export async function getImportHistoryById(id: string): Promise<ImportHistoryRecord | null> {
  await ensureHistoryDir();
  
  const filePath = path.join(HISTORY_DIR, `${id}.json`);
  
  try {
    const content = await fsPromises.readFile(filePath, 'utf8');
    return JSON.parse(content) as ImportHistoryRecord;
  } catch (err) {
    return null;
  }
}

export async function updateImportHistory(id: string, updates: Partial<ImportHistoryRecord>): Promise<ImportHistoryRecord | null> {
  const existing = await getImportHistoryById(id);
  
  if (!existing) {
    return null;
  }
  
  const updated = { ...existing, ...updates };
  const filePath = path.join(HISTORY_DIR, `${id}.json`);
  
  await fsPromises.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf8');
  
  return updated;
}

export async function deleteImportHistory(id: string): Promise<boolean> {
  const filePath = path.join(HISTORY_DIR, `${id}.json`);
  
  try {
    await fsPromises.unlink(filePath);
    return true;
  } catch (err) {
    return false;
  }
}
