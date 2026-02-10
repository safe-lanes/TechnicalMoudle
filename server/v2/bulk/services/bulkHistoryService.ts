import type { BulkRepository } from '../repositories/bulkRepository';

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

function dbRowToRecord(row: any): ImportHistoryRecord {
  return {
    id: row.id,
    type: row.type,
    mode: row.mode,
    vesselId: row.vesselId || row.vessel_id || '',
    userId: row.userId || row.user_id || '',
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : '',
    completedAt: row.finishedAt ? new Date(row.finishedAt).toISOString() : '',
    status: row.status,
    created: row.created || 0,
    updated: row.updated || 0,
    skipped: row.skipped || 0,
    archived: row.archived || 0,
    originalName: row.originalName || row.original_name || '',
    storedFilePath: row.storedFilePath || row.stored_file_path || null,
    errorReport: row.errorMessage || row.error_message || null,
  };
}

export class BulkHistoryService {
  private repository: BulkRepository;

  constructor(repository: BulkRepository) {
    this.repository = repository;
  }

  async saveHistory(data: ImportHistoryRecord): Promise<ImportHistoryRecord> {
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

    return record;
  }

  async getHistoryList(
    type?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ items: ImportHistoryRecord[]; total: number }> {
    const result = await this.repository.getImportHistoryList(type, limit, offset);
    return {
      items: result.items.map(dbRowToRecord),
      total: result.total,
    };
  }

  async getHistoryById(id: string): Promise<ImportHistoryRecord | null> {
    const row = await this.repository.getImportHistoryById(id);
    if (!row) return null;
    return dbRowToRecord(row);
  }

  async updateHistory(id: string, updates: Partial<ImportHistoryRecord>): Promise<ImportHistoryRecord | null> {
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
      await this.repository.updateImportHistory(id, dbUpdates);
    }

    return await this.getHistoryById(id);
  }
}
