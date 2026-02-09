import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import type { BulkRepository } from '../repositories/bulkRepository';
import type { BulkHistoryService, ImportHistoryRecord } from './bulkHistoryService';
import { getCachedDryRun, deleteCachedDryRun } from '../cache/dryRunCache';
import { BulkNotFoundError, BulkImportError } from './errors';
import { getParentSFICode, stripSFISuffix, getComponentCategory, getSubGroupName } from './bulkDryRunService';
import { sortObjectKeys, createRecordSnapshot } from './bulkUndoService';
import { getSFIName } from '../utils/sfiLookup';
import { normalizeDateToDDMMMYYYY } from '../utils/dateUtils';
import { objectStorageClient } from '../../../objectStorage';
import type { ImportResult } from './types/strategyTypes';

export class BulkImportService {
  constructor(
    private repository: BulkRepository,
    private historyService: BulkHistoryService
  ) {}

  async doImport(params: {
    fileToken: string;
    mode: string;
    vesselId: string;
    userId: string;
    archiveMissing?: boolean;
    rowIndices?: number[];
  }): Promise<{ historyId: string; result: ImportResult }> {
    const cached = getCachedDryRun(params.fileToken);
    if (!cached) {
      throw new BulkNotFoundError('Dry-run data not found or expired. Please re-upload and validate the file.');
    }

    const effectiveType = cached.type || 'components';
    const importHistoryId = uuidv4();

    const historyRecord: ImportHistoryRecord = {
      id: importHistoryId,
      type: effectiveType,
      mode: params.mode,
      vesselId: params.vesselId,
      userId: params.userId,
      startedAt: new Date().toISOString(),
      completedAt: '',
      status: 'in_progress',
      created: 0,
      updated: 0,
      skipped: 0,
      archived: 0,
      originalName: cached.originalName,
      storedFilePath: null,
      errorReport: null,
    };

    await this.historyService.saveHistory(historyRecord);

    try {
      await this.storeOriginalFile(cached.file, cached.originalName, importHistoryId);
    } catch (_err) {
    }

    let dataToImport = cached.results.rows
      .filter(r => r.status !== 'error')
      .map((r, idx) => ({ ...r.normalized, __originalIndex: idx, __original: r.original }));

    if (params.rowIndices && params.rowIndices.length > 0) {
      const indexSet = new Set(params.rowIndices);
      dataToImport = dataToImport.filter((_, idx) => indexSet.has(idx));
    }

    try {
      const result = await this.importComponents(
        dataToImport,
        params.mode,
        params.archiveMissing || false,
        params.vesselId,
        params.userId,
        importHistoryId
      );

      await this.historyService.updateHistory(importHistoryId, {
        status: 'complete',
        completedAt: new Date().toISOString(),
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        archived: result.archived,
      });

      deleteCachedDryRun(params.fileToken);

      return { historyId: importHistoryId, result };
    } catch (error: any) {
      await this.historyService.updateHistory(importHistoryId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        errorReport: error.message,
      });
      throw new BulkImportError(`Import failed: ${error.message}`);
    }
  }

  private async storeOriginalFile(buffer: Buffer, originalName: string, historyId: string): Promise<void> {
    try {
      const privateDir = process.env.PRIVATE_OBJECT_DIR;
      if (!privateDir) {
        console.warn('[V2] PRIVATE_OBJECT_DIR not set, skipping file storage');
        return;
      }
      const ext = originalName.substring(originalName.lastIndexOf('.'));
      const storedPath = `${privateDir}/bulk-imports/${historyId}${ext}`;

      const { bucketName, objectName } = parseObjectPath(storedPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      await file.save(buffer);

      await this.historyService.updateHistory(historyId, {
        storedFilePath: storedPath,
      });
    } catch (_err) {
    }
  }

  private async importComponents(
    data: any[],
    mode: string,
    archiveMissing: boolean,
    vesselId: string,
    userId: string,
    importHistoryId: string
  ): Promise<ImportResult> {
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, archived: 0 };

    await this.autoPopulateMakerList(data);

    const codes = data
      .map(r => String(r['Component Code'] || '').trim())
      .filter(c => c);
    const existingMap = await this.repository.getComponentsByCodes(codes, vesselId);

    await this.createMissingParentHierarchy(data, vesselId, userId, importHistoryId, existingMap);

    const sorted = this.sortByDepthAndParentRef(data);

    for (const row of sorted) {
      const code = String(row['Component Code'] || '').trim();
      if (!code) {
        result.skipped++;
        continue;
      }

      const existing = existingMap.get(code);

      if (mode === 'add') {
        if (existing) {
          result.skipped++;
          continue;
        }
        const newComp = await this.createComponentFromRow(row, vesselId, userId);
        if (newComp) {
          existingMap.set(code, newComp);
          result.created++;
          const { checksum } = createRecordSnapshot(newComp);
          await this.repository.createImportChangeLog({
            id: uuidv4(),
            importHistoryId,
            entityType: 'component',
            entityId: newComp.id,
            operation: 'created',
            previousData: null,
            newData: { componentCode: code, name: newComp.name },
            checksum,
          });
        }
      } else if (mode === 'update') {
        if (!existing) {
          result.skipped++;
          continue;
        }
        const { checksum: beforeChecksum } = createRecordSnapshot(existing);
        const updated = await this.updateComponentFromRow(existing.id, row);
        if (updated) {
          existingMap.set(code, updated);
          result.updated++;
          const { checksum: afterChecksum } = createRecordSnapshot(updated);
          await this.repository.createImportChangeLog({
            id: uuidv4(),
            importHistoryId,
            entityType: 'component',
            entityId: existing.id,
            operation: 'updated',
            previousData: existing,
            newData: { componentCode: code },
            checksum: afterChecksum,
          });
        }
      } else if (mode === 'upsert') {
        if (existing) {
          const { checksum: beforeChecksum } = createRecordSnapshot(existing);
          const updated = await this.updateComponentFromRow(existing.id, row);
          if (updated) {
            existingMap.set(code, updated);
            result.updated++;
            const { checksum: afterChecksum } = createRecordSnapshot(updated);
            await this.repository.createImportChangeLog({
              id: uuidv4(),
              importHistoryId,
              entityType: 'component',
              entityId: existing.id,
              operation: 'updated',
              previousData: existing,
              newData: { componentCode: code },
              checksum: afterChecksum,
            });
          }
        } else {
          const newComp = await this.createComponentFromRow(row, vesselId, userId);
          if (newComp) {
            existingMap.set(code, newComp);
            result.created++;
            const { checksum } = createRecordSnapshot(newComp);
            await this.repository.createImportChangeLog({
              id: uuidv4(),
              importHistoryId,
              entityType: 'component',
              entityId: newComp.id,
              operation: 'created',
              previousData: null,
              newData: { componentCode: code, name: newComp.name },
              checksum,
            });
          }
        }
      }
    }

    if (archiveMissing) {
      const allComponents = await this.repository.getComponents(vesselId);
      const importedCodes = new Set(codes.map(c => c.toLowerCase()));
      for (const comp of allComponents) {
        if (comp.isActive && comp.componentCode && !importedCodes.has(comp.componentCode.toLowerCase())) {
          const { checksum: beforeChecksum } = createRecordSnapshot(comp);
          await this.repository.archiveComponent(comp.id);
          result.archived++;
          const archived = await this.repository.getComponent(comp.id);
          const { checksum: afterChecksum } = createRecordSnapshot(archived);
          await this.repository.createImportChangeLog({
            id: uuidv4(),
            importHistoryId,
            entityType: 'component',
            entityId: comp.id,
            operation: 'archived',
            previousData: comp,
            newData: { isActive: false },
            checksum: afterChecksum,
          });
        }
      }
    }

    return result;
  }

  private async autoPopulateMakerList(data: any[]): Promise<void> {
    const existingMakers = await this.repository.getMakerList();
    const existingNames = new Set(existingMakers.map(m => m.makerName?.toLowerCase()));

    let maxMkrNum = 0;
    for (const maker of existingMakers) {
      const match = maker.makerCode?.match(/^MKR-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxMkrNum) maxMkrNum = num;
      }
    }

    const newMakerNames = new Set<string>();
    for (const row of data) {
      const makerName = String(row['Maker'] || '').trim();
      if (makerName && !existingNames.has(makerName.toLowerCase()) && !newMakerNames.has(makerName.toLowerCase())) {
        newMakerNames.add(makerName.toLowerCase());
        maxMkrNum++;
        const makerCode = `MKR-${String(maxMkrNum).padStart(6, '0')}`;
        try {
          await this.repository.createMakerListItem({
            makerCode,
            makerName,
            isActive: true,
          });
        } catch (_err) {
        }
      }
    }
  }

  private async createMissingParentHierarchy(
    data: any[],
    vesselId: string,
    userId: string,
    importHistoryId: string,
    existingMap: Map<string, any>
  ): Promise<void> {
    const neededParents = new Set<string>();

    for (const row of data) {
      const code = String(row['Component Code'] || '').trim();
      if (!code) continue;

      const meta = row['__meta'];
      let parentCode: string | null = null;

      if (meta?.explicitParent) {
        parentCode = meta.parentCode;
      } else {
        parentCode = getParentSFICode(code);
      }

      while (parentCode) {
        if (!existingMap.has(parentCode)) {
          neededParents.add(parentCode);
        }
        parentCode = getParentSFICode(parentCode);
      }
    }

    if (neededParents.size === 0) return;

    const freshExisting = await this.repository.getComponentsByCodes(
      Array.from(neededParents), vesselId
    );
    freshExisting.forEach((comp, code) => {
      existingMap.set(code, comp);
    });

    const missingParents = Array.from(neededParents).filter(p => !existingMap.has(p));
    missingParents.sort((a, b) => {
      const depthA = a.split('.').length + (a.includes('.') ? 0 : a.length);
      const depthB = b.split('.').length + (b.includes('.') ? 0 : b.length);
      return depthA - depthB;
    });

    for (const parentCode of missingParents) {
      const sfiName = getSFIName(parentCode);
      const firstDigit = parentCode.charAt(0);
      const category = getComponentCategory(firstDigit);
      const subName = getSubGroupName(parentCode);
      const name = sfiName || subName || parentCode;

      const parentOfParent = getParentSFICode(parentCode);
      let parentId: string | null = null;
      if (parentOfParent && existingMap.has(parentOfParent)) {
        parentId = existingMap.get(parentOfParent).id;
      }

      const id = uuidv4();
      try {
        const created = await this.repository.createComponent({
          id,
          componentCode: parentCode,
          name,
          componentCategory: category,
          parentId,
          parentComponent: parentOfParent || null,
          vesselId,
          vesselCode: null,
          isActive: true,
          isParent: true,
          dataScope: 'vessel',
          rhCounterType: 'NOT_RH_DRIVEN',
          currentCumulativeRH: '0',
        });
        existingMap.set(parentCode, created);

        const { checksum } = createRecordSnapshot(created);
        await this.repository.createImportChangeLog({
          id: uuidv4(),
          importHistoryId,
          entityType: 'component',
          entityId: id,
          operation: 'created',
          previousData: null,
          newData: { componentCode: parentCode, name, autoCreated: true },
          checksum,
        });
      } catch (_err) {
      }
    }
  }

  private sortByDepthAndParentRef(data: any[]): any[] {
    return [...data].sort((a, b) => {
      const aExplicit = a['__meta']?.explicitParent ? 1 : 0;
      const bExplicit = b['__meta']?.explicitParent ? 1 : 0;
      if (aExplicit !== bExplicit) return bExplicit - aExplicit;

      const codeA = String(a['Component Code'] || '');
      const codeB = String(b['Component Code'] || '');
      const depthA = codeA.split('.').length;
      const depthB = codeB.split('.').length;
      return depthA - depthB;
    });
  }

  private async createComponentFromRow(row: any, vesselId: string, userId: string): Promise<any> {
    const code = String(row['Component Code'] || '').trim();
    const meta = row['__meta'];
    let parentCode = meta?.parentCode || null;

    let parentId: string | null = null;
    if (parentCode) {
      const parent = await this.repository.getComponentByCode(parentCode, vesselId);
      if (parent) parentId = parent.id;
    }

    const rhCounterType = String(row['RH Counter Type'] || 'NOT_RH_DRIVEN').trim().toUpperCase();
    const rhCounterSource = row['RH Counter Source'] ? String(row['RH Counter Source']).trim() : null;
    const runningHours = row['Running Hours'] !== undefined && row['Running Hours'] !== null
      ? String(row['Running Hours']) : null;

    let rhCurrentMaster: string | null = null;
    let rhMasterUpdateSource: string | null = null;
    let rhMasterComponentId: string | null = null;

    if (rhCounterType === 'MASTER' && runningHours !== null) {
      rhCurrentMaster = runningHours;
      rhMasterUpdateSource = 'IMPORT';
    }

    const installationDate = row['Installation Date']
      ? normalizeDateToDDMMMYYYY(row['Installation Date']) : null;
    const commissionedDate = row['Commissioned Date']
      ? normalizeDateToDDMMMYYYY(row['Commissioned Date']) : null;
    const lastUpdated = row['Last Updated']
      ? normalizeDateToDDMMMYYYY(row['Last Updated']) : null;

    const id = uuidv4();
    const data: any = {
      id,
      componentCode: code,
      name: row['Component Name'] || null,
      componentCategory: row['Component Category'] || null,
      category: row['Category'] || null,
      parentId,
      parentComponent: parentCode,
      vesselId,
      vesselCode: row['Vessel Code'] || null,
      fleetEquipmentCode: row['Fleet Equipment Code'] || null,
      fleetEquipmentName: row['Fleet Equipment Name'] || null,
      maker: row['Maker'] || null,
      makerCode: row['Maker Code'] || null,
      model: row['Model'] || null,
      modelCode: row['Model Code'] || null,
      serialNo: row['Serial No'] || null,
      drawingNo: row['Drawing No'] || null,
      location: row['Location'] || null,
      critical: row['Criticality'] === true ? true : row['Criticality'] === false ? false : false,
      conditionBased: row['Condition Based'] === true ? true : false,
      classItem: row['Class item'] === true ? true : false,
      isActive: row['IS Active'] !== undefined ? (row['IS Active'] === false ? false : true) : true,
      isParent: row['IS Parent'] === true ? true : false,
      installationDate,
      commissionedDate,
      rating: row['Rating'] || null,
      eqptSystemDept: row['Equipment / System Department'] || null,
      notes: row['Notes'] || null,
      runningHours: runningHours,
      currentCumulativeRH: runningHours || '0',
      lastUpdated,
      rhCounterType: ['MASTER', 'INHERITED', 'NOT_RH_DRIVEN'].includes(rhCounterType) ? rhCounterType : 'NOT_RH_DRIVEN',
      rhCounterSource,
      rhCurrentMaster,
      rhMasterUpdateSource,
      rhMasterComponentId,
      dataScope: 'vessel',
    };

    return await this.repository.createComponent(data);
  }

  private async updateComponentFromRow(id: string, row: any): Promise<any> {
    const updates: any = {};

    if (row['Component Name'] !== undefined && row['Component Name'] !== '') {
      updates.name = row['Component Name'];
    }
    if (row['Component Category'] !== undefined && row['Component Category'] !== '') {
      updates.componentCategory = row['Component Category'];
    }
    if (row['Fleet Equipment Code'] !== undefined && row['Fleet Equipment Code'] !== '') {
      updates.fleetEquipmentCode = row['Fleet Equipment Code'];
    }
    if (row['Fleet Equipment Name'] !== undefined && row['Fleet Equipment Name'] !== '') {
      updates.fleetEquipmentName = row['Fleet Equipment Name'];
    }
    if (row['Maker'] !== undefined && row['Maker'] !== '') {
      updates.maker = row['Maker'];
    }
    if (row['Maker Code'] !== undefined && row['Maker Code'] !== '') {
      updates.makerCode = row['Maker Code'];
    }
    if (row['Model'] !== undefined && row['Model'] !== '') {
      updates.model = row['Model'];
    }
    if (row['Model Code'] !== undefined && row['Model Code'] !== '') {
      updates.modelCode = row['Model Code'];
    }
    if (row['Serial No'] !== undefined && row['Serial No'] !== '') {
      updates.serialNo = row['Serial No'];
    }
    if (row['Drawing No'] !== undefined && row['Drawing No'] !== '') {
      updates.drawingNo = row['Drawing No'];
    }
    if (row['Location'] !== undefined && row['Location'] !== '') {
      updates.location = row['Location'];
    }
    if (row['Criticality'] !== undefined) {
      updates.critical = row['Criticality'] === true;
    }
    if (row['Condition Based'] !== undefined) {
      updates.conditionBased = row['Condition Based'] === true;
    }
    if (row['Class item'] !== undefined) {
      updates.classItem = row['Class item'] === true;
    }
    if (row['IS Active'] !== undefined) {
      updates.isActive = row['IS Active'] !== false;
    }
    if (row['IS Parent'] !== undefined) {
      updates.isParent = row['IS Parent'] === true;
    }
    if (row['Installation Date']) {
      updates.installationDate = normalizeDateToDDMMMYYYY(row['Installation Date']);
    }
    if (row['Commissioned Date']) {
      updates.commissionedDate = normalizeDateToDDMMMYYYY(row['Commissioned Date']);
    }
    if (row['Rating'] !== undefined && row['Rating'] !== '') {
      updates.rating = row['Rating'];
    }
    if (row['Equipment / System Department'] !== undefined && row['Equipment / System Department'] !== '') {
      updates.eqptSystemDept = row['Equipment / System Department'];
    }
    if (row['Vessel Code'] !== undefined && row['Vessel Code'] !== '') {
      updates.vesselCode = row['Vessel Code'];
    }
    if (row['Notes'] !== undefined && row['Notes'] !== '') {
      updates.notes = row['Notes'];
    }
    if (row['Running Hours'] !== undefined && row['Running Hours'] !== null) {
      updates.runningHours = String(row['Running Hours']);
      updates.currentCumulativeRH = String(row['Running Hours']);
    }
    if (row['Last Updated']) {
      updates.lastUpdated = normalizeDateToDDMMMYYYY(row['Last Updated']);
    }
    if (row['RH Counter Type'] !== undefined && row['RH Counter Type'] !== '') {
      const rht = String(row['RH Counter Type']).trim().toUpperCase();
      if (['MASTER', 'INHERITED', 'NOT_RH_DRIVEN'].includes(rht)) {
        updates.rhCounterType = rht;
        if (rht === 'MASTER' && row['Running Hours'] !== undefined) {
          updates.rhCurrentMaster = String(row['Running Hours']);
          updates.rhMasterUpdateSource = 'IMPORT';
        }
      }
    }
    if (row['RH Counter Source'] !== undefined && row['RH Counter Source'] !== '') {
      updates.rhCounterSource = row['RH Counter Source'];
    }

    if (Object.keys(updates).length === 0) return null;

    return await this.repository.updateComponent(id, updates);
  }
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith('/')) path = `/${path}`;
  const parts = path.split('/');
  const bucketName = parts[1];
  const objectName = parts.slice(2).join('/');
  return { bucketName, objectName };
}
