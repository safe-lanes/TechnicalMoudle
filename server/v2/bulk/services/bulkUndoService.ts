import crypto from 'crypto';
import type { BulkRepository } from '../repositories/bulkRepository';
import type { BulkHistoryService } from './bulkHistoryService';
import { BulkNotFoundError, BulkConflictError, BulkImportError } from './errors';

function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  return Object.keys(obj).sort().reduce((result: any, key) => {
    result[key] = sortObjectKeys(obj[key]);
    return result;
  }, {});
}

function createRecordSnapshot(record: any): { checksum: string; snapshot: string } {
  const sorted = sortObjectKeys(record);
  const snapshot = JSON.stringify(sorted, (_key, value) => {
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'function' || typeof value === 'symbol') return undefined;
    return value;
  });
  const checksum = crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex');
  return { checksum, snapshot };
}

export { sortObjectKeys, createRecordSnapshot };

export class BulkUndoService {
  constructor(
    private repository: BulkRepository,
    private historyService: BulkHistoryService
  ) {}

  async undoImport(historyId: string): Promise<{ success: boolean; message: string; details?: any }> {
    const history = await this.historyService.getHistoryById(historyId);
    if (!history) {
      throw new BulkNotFoundError(`Import history not found: ${historyId}`);
    }

    if (history.status !== 'complete') {
      throw new BulkImportError(`Cannot undo import with status "${history.status}". Only completed imports can be undone.`);
    }

    const changeLogs = await this.repository.getImportChangeLogs(historyId);
    if (changeLogs.length === 0) {
      throw new BulkImportError('No change logs found for this import. Nothing to undo.');
    }

    const conflicts: any[] = [];

    for (const log of changeLogs) {
      if (log.entityType === 'component') {
        const current = await this.repository.getComponent(log.entityId);
        if (current) {
          const { checksum: currentChecksum } = createRecordSnapshot(current);
          if (currentChecksum !== log.checksum) {
            conflicts.push({
              entityType: log.entityType,
              entityId: log.entityId,
              operation: log.operation,
              expectedChecksum: log.checksum,
              currentChecksum,
              message: `Component ${log.entityId} has been modified since import`,
            });
          }
        } else if (log.operation !== 'created') {
          conflicts.push({
            entityType: log.entityType,
            entityId: log.entityId,
            operation: log.operation,
            message: `Component ${log.entityId} no longer exists`,
          });
        }
      }
    }

    if (conflicts.length > 0) {
      await this.historyService.updateHistory(historyId, { status: 'undo_failed' as any });
      throw new BulkConflictError(
        `Cannot undo: ${conflicts.length} conflict(s) detected. Records have been modified since import.`,
        conflicts
      );
    }

    const appliedRollbacks: Array<{ log: any; rollbackData: any }> = [];

    try {
      const reversedLogs = [...changeLogs].reverse();

      for (const log of reversedLogs) {
        if (log.entityType === 'component') {
          switch (log.operation) {
            case 'created': {
              const before = await this.repository.getComponent(log.entityId);
              await this.repository.archiveComponent(log.entityId);
              appliedRollbacks.push({ log, rollbackData: before });
              break;
            }
            case 'updated': {
              if (log.previousData) {
                const before = await this.repository.getComponent(log.entityId);
                await this.repository.updateComponent(log.entityId, log.previousData as any);
                appliedRollbacks.push({ log, rollbackData: before });
              }
              break;
            }
            case 'archived': {
              const before = await this.repository.getComponent(log.entityId);
              await this.repository.updateComponent(log.entityId, { isActive: true });
              appliedRollbacks.push({ log, rollbackData: before });
              break;
            }
          }
        }
      }

      await this.historyService.updateHistory(historyId, { status: 'undone' as any });

      return {
        success: true,
        message: `Successfully undone ${appliedRollbacks.length} change(s)`,
        details: {
          totalChanges: changeLogs.length,
          undoneChanges: appliedRollbacks.length,
        },
      };
    } catch (error: any) {
      try {
        for (const { log, rollbackData } of appliedRollbacks.reverse()) {
          if (rollbackData && log.entityType === 'component') {
            await this.repository.updateComponent(log.entityId, rollbackData);
          }
        }
      } catch (rollbackError: any) {
        console.error('Failed to rollback undo changes:', rollbackError);
      }

      await this.historyService.updateHistory(historyId, { status: 'undo_failed' as any });

      throw new BulkImportError(`Undo failed: ${error.message}`);
    }
  }
}
