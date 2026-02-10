import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import type { BulkRepository } from '../repositories/bulkRepository';

const HISTORY_DIR = path.join(process.cwd(), 'uploads', 'bulk-imports', 'history');

export interface ImportHistoryRecord {
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
  } catch (_err) {
  }
}

export class BulkHistoryService {
  private repository: BulkRepository;

  constructor(repository: BulkRepository) {
    this.repository = repository;
  }

  async saveHistory(data: ImportHistoryRecord): Promise<ImportHistoryRecord> {
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
      errorReport: data.errorReport || null,
    };

    await this.repository.createImportHistory({
      id: record.id,
      type: record.type,
      mode: record.mode,
      userId: record.userId,
      vesselId: record.vesselId,
      startedAt: record.startedAt ? new Date(record.startedAt) : new Date(),
      finishedAt: record.completedAt ? new Date(record.completedAt) : null,
      status: record.status,
      created: record.created,
      updated: record.updated,
      skipped: record.skipped,
      archived: record.archived,
      originalName: record.originalName,
      storedFilePath: record.storedFilePath,
      errorMessage: record.errorReport,
    });

    const filePath = path.join(HISTORY_DIR, `${record.id}.json`);
    await fsPromises.writeFile(filePath, JSON.stringify(record, null, 2), 'utf8');
    return record;
  }

  async getHistoryList(
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
        } catch (_err) {
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
    } catch (_err) {
      return { items: [], total: 0 };
    }
  }

  async getHistoryById(id: string): Promise<ImportHistoryRecord | null> {
    await ensureHistoryDir();
    const filePath = path.join(HISTORY_DIR, `${id}.json`);
    try {
      const content = await fsPromises.readFile(filePath, 'utf8');
      return JSON.parse(content) as ImportHistoryRecord;
    } catch (_err) {
      return null;
    }
  }

  async updateHistory(id: string, updates: Partial<ImportHistoryRecord>): Promise<ImportHistoryRecord | null> {
    const existing = await this.getHistoryById(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates };
    const filePath = path.join(HISTORY_DIR, `${id}.json`);
    await fsPromises.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf8');

    const dbUpdates: any = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.completedAt !== undefined) dbUpdates.finishedAt = new Date(updates.completedAt);
    if (updates.created !== undefined) dbUpdates.created = updates.created;
    if (updates.updated !== undefined) dbUpdates.updated = updates.updated;
    if (updates.skipped !== undefined) dbUpdates.skipped = updates.skipped;
    if (updates.archived !== undefined) dbUpdates.archived = updates.archived;
    if (updates.storedFilePath !== undefined) dbUpdates.storedFilePath = updates.storedFilePath;
    if (updates.errorReport !== undefined) dbUpdates.errorMessage = updates.errorReport;
    if (Object.keys(dbUpdates).length > 0) {
      try {
        await this.repository.updateImportHistory(id, dbUpdates);
      } catch (_err) {
      }
    }

    return updated;
  }
}
