import {
  getImportHistoryList,
  getImportHistoryById as getFileBasedHistoryById
} from '../../../services/fileBasedImportHistory';

export async function getImportHistory(type: string | undefined, limit: number, offset: number) {
  const result = await getImportHistoryList(type, limit, offset);
  
  return {
    items: result.items.map((h: any) => ({
      id: h.id,
      date: h.startedAt,
      user: h.userId,
      mode: h.mode,
      type: h.type,
      created: h.created,
      updated: h.updated,
      skipped: h.skipped,
      archived: h.archived,
      status: h.status,
      originalName: h.originalName,
      storedFilePath: h.storedFilePath
    })),
    total: result.total
  };
}

// Get history file - NOW USES FILE-BASED STORAGE
export async function getHistoryFile(id: string, fileType: string): Promise<{ mimeType: string; name: string; data: Buffer } | null> {
  const history = await getFileBasedHistoryById(id);
  
  if (!history) return null;

  if (fileType === 'file') {
    return null;
  }

  return null;
}
