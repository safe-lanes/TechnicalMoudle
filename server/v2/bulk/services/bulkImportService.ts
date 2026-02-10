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
import { calculateNextDueDate } from '../../../../shared/dateUtils';
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
      let result: ImportResult;

      if (effectiveType === 'jobs') {
        result = await this.importJobs(
          dataToImport,
          params.mode,
          params.vesselId,
          params.userId,
          importHistoryId
        );
      } else if (effectiveType === 'spares') {
        result = await this.importSpares(
          dataToImport,
          params.mode,
          params.vesselId,
          params.userId,
          importHistoryId
        );
      } else {
        result = await this.importComponents(
          dataToImport,
          params.mode,
          params.archiveMissing || false,
          params.vesselId,
          params.userId,
          importHistoryId
        );
      }

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

  private async importJobs(
    data: any[],
    mode: string,
    vesselId: string,
    userId: string,
    importHistoryId: string
  ): Promise<ImportResult> {
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, archived: 0, spareComponentLinksCreated: 0, jobComponentLinksCreated: 0 };
    console.log(`[V2] Starting jobs import: ${data.length} rows, mode: ${mode}, vesselId: ${vesselId}`);

    const allExistingJobs = await this.repository.getJobs(vesselId);
    const getJobUniqueKey = (vid: string, ccode: string, jno: string) => `${vid}::${ccode}::${jno}`;
    const jobsByCompositeKey = new Map<string, any>();
    for (const job of allExistingJobs) {
      if (job.jobNo && job.componentCode) {
        const key = getJobUniqueKey(job.vesselId || vesselId, job.componentCode, job.jobNo);
        jobsByCompositeKey.set(key, job);
      }
    }

    const allComponentCodes = data.map(row => String(row['Component Code'] || '').trim()).filter(c => c);
    const componentsByCode = await this.repository.getComponentsByCodes(allComponentCodes, vesselId);

    const allSpares = await this.repository.getSpares(vesselId);
    const sparesByPartCode = new Map(allSpares.map((s: any) => [s.partCode, s]));

    const TASK_TYPE_CODES: Record<string, string> = {
      'Inspection': 'IN', 'Service': 'SE', 'Overhaul': 'OV', 'Calibration': 'CA',
      'Test': 'TE', 'Testing': 'TE', 'Replacement': 'RE', 'Cleaning': 'CL',
      'Lubrication': 'LU', 'General': 'GN', 'Repair': 'RP',
    };

    let maxJobSequence = 0;
    const allJobs = await this.repository.getAllJobs();
    for (const job of allJobs) {
      if (job.jobNo) {
        const match = job.jobNo.match(/^MKR-[A-Z]{2}-(\d{5})$/);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (seq > maxJobSequence) maxJobSequence = seq;
        }
      }
    }

    for (const row of data) {
      try {
        const componentCode = String(row['Component Code'] || '').trim();
        const component = componentsByCode.get(componentCode);

        if (!component) {
          console.warn(`[V2] Component not found: ${componentCode}, skipping job`);
          result.skipped++;
          continue;
        }

        const woTitle = String(row['WO Title'] || '').trim();
        if (!woTitle) {
          result.skipped++;
          continue;
        }

        const taskType = row['Task Type'] || null;

        let jobNo = String(row['Job Code'] || '').trim();
        if (!jobNo) {
          maxJobSequence++;
          const typeCode = (taskType && TASK_TYPE_CODES[taskType]) ? TASK_TYPE_CODES[taskType] : 'IN';
          jobNo = `MKR-${typeCode}-${String(maxJobSequence).padStart(5, '0')}`;
        }

        const maintenanceBasis = row['Maintenance Basis'] || null;
        const frequencyValue = row['Interval Value'] ? String(row['Interval Value']).trim() : null;
        const frequencyUnit = row['Unit'] ? String(row['Unit']).trim() : null;

        const rawLastDone = row['Last Done Date'];
        let lastDoneDate = rawLastDone ? normalizeDateToDDMMMYYYY(rawLastDone) : null;
        if (!lastDoneDate && component.installationDate) {
          try {
            lastDoneDate = normalizeDateToDDMMMYYYY(component.installationDate);
          } catch (_e) {
            lastDoneDate = null;
          }
        }

        let nextDueDate: string | null = null;
        if (maintenanceBasis === 'Calendar' && lastDoneDate && frequencyValue && frequencyUnit) {
          nextDueDate = calculateNextDueDate(lastDoneDate, frequencyValue, frequencyUnit);
        }

        let intervalRH: number | null = null;
        const rawIntervalRH = row['Interval Running Hours'];
        const hasExplicitIntervalRH = rawIntervalRH !== undefined && rawIntervalRH !== null && String(rawIntervalRH).trim() !== '';
        if (hasExplicitIntervalRH) {
          intervalRH = Number(String(rawIntervalRH).trim());
        } else if (maintenanceBasis === 'Running Hours' && frequencyValue) {
          intervalRH = Number(frequencyValue);
        }

        let nextDueRH: string | null = null;
        let lastDoneRH: string | null = null;

        if (maintenanceBasis === 'Running Hours') {
          if (intervalRH === null || isNaN(intervalRH) || intervalRH <= 0) {
            result.skipped++;
            console.warn(`[V2] Skipping RH job for ${componentCode}: Invalid Interval Running Hours`);
            continue;
          }

          const rawLastDoneRH = row['Last Done RH'];
          if (rawLastDoneRH !== undefined && rawLastDoneRH !== null && rawLastDoneRH !== '') {
            lastDoneRH = String(rawLastDoneRH).trim();
          } else if (component.runningHours !== undefined && component.runningHours !== null) {
            lastDoneRH = String(component.runningHours);
          } else {
            lastDoneRH = '0';
          }

          const lastRH = Number(lastDoneRH);
          if (isNaN(lastRH)) {
            result.skipped++;
            console.warn(`[V2] Skipping RH job for ${componentCode}: lastDoneRH is not a valid number`);
            continue;
          }
          nextDueRH = String(lastRH + intervalRH);
        }

        const parseStringList = (value: any): string[] => {
          if (!value) return [];
          const str = String(value).trim();
          if (!str) return [];
          const separator = str.includes(';') ? ';' : ',';
          return str.split(separator).map(s => s.trim()).filter(s => s.length > 0);
        };

        const parseSpareParts = (value: any): Array<{ partCode: string; partNo: string; description: string; quantityRequired: string; remarks: string }> => {
          const items = parseStringList(value);
          const parts: Array<{ partCode: string; partNo: string; description: string; quantityRequired: string; remarks: string }> = [];
          for (const item of items) {
            if (item.includes(':')) {
              const [partCode, quantityStr] = item.split(':').map(s => s.trim());
              const quantity = parseInt(quantityStr) || 1;
              const spare = sparesByPartCode.get(partCode);
              if (spare) {
                parts.push({
                  partCode,
                  partNo: spare.partNumber || '',
                  description: spare.partName || '',
                  quantityRequired: String(quantity),
                  remarks: '',
                });
              } else {
                parts.push({
                  partCode,
                  partNo: '',
                  description: `[NOT FOUND: ${partCode}]`,
                  quantityRequired: String(quantity),
                  remarks: 'PartCode not found in spares database',
                });
              }
            } else {
              parts.push({
                partCode: '',
                partNo: '',
                description: item,
                quantityRequired: '1',
                remarks: '',
              });
            }
          }
          return parts;
        };

        const parseTools = (value: any): Array<{ toolName: string; quantity: string; remarks: string }> => {
          const items = parseStringList(value);
          return items.map(item => ({
            toolName: item,
            quantity: '',
            remarks: '',
          }));
        };

        const requiredSpareParts = parseSpareParts(row['Required Spare Parts']);
        const requiredTools = parseTools(row['Required Tools']);
        const safetyRequirements = {
          ppeRequirements: parseStringList(row['PPE Requirements']),
          permitRequirements: parseStringList(row['Permit Requirements']),
          otherRequirements: parseStringList(row['Other Safety Requirements']),
        };

        const normalizeYesNo = (value: any): string | null => {
          if (!value) return null;
          const str = String(value).toLowerCase().trim();
          if (['yes', 'y', 'true'].includes(str) || value === true) return 'Yes';
          if (['no', 'n', 'false'].includes(str) || value === false) return 'No';
          return null;
        };

        const compositeKey = getJobUniqueKey(vesselId, componentCode, jobNo);
        const existingJob = jobsByCompositeKey.get(compositeKey);

        const jobData: any = {
          vesselId,
          componentId: component.id,
          componentCode,
          componentName: row['Component Name'] || component.name || null,
          jobNo,
          jobTitle: woTitle,
          maintenanceType: taskType,
          maintenanceBasis,
          frequencyValue: frequencyValue ? parseFloat(frequencyValue) : null,
          frequencyUnit,
          intervalRunningHour: intervalRH,
          lastDoneDate,
          nextDueDate,
          lastDoneRH,
          nextDueRH,
          jobPriority: row['Job Priority'] || null,
          classRelated: normalizeYesNo(row['Class Related']),
          briefWorkDescription: row['Brief Work Description'] || null,
          jobDescription: row['Brief Work Description'] || null,
          department: row['Department'] || null,
          assignedTo: row['Assigned To'] || null,
          approver: row['Approver'] || null,
          estimatedManHours: row['Estimated Man Hours'] || null,
          criticality: normalizeYesNo(row['Critical Yes/No'] ?? row['Criticality']),
          isActive: row['Is Active'] ? (String(row['Is Active']).toLowerCase() === 'yes') : true,
          requiredSpareParts,
          requiredTools,
          safetyRequirements,
          fleetEquipmentCode: row['Fleet Equipment Code'] || null,
          sfiCode: componentCode,
          dataScope: 'vessel',
          createdBy: userId,
        };

        const createJobAndLink = async (jobId: string): Promise<any> => {
          const created = await this.repository.createJob({ id: jobId, ...jobData });
          if (created) {
            try {
              await this.repository.createJobComponentLink({
                vesselId,
                jobId: created.id,
                componentId: component.id,
                componentCode,
                linkedBy: 'system-bulk-import',
              });
              result.jobComponentLinksCreated = (result.jobComponentLinksCreated || 0) + 1;
            } catch (linkError: any) {
              console.warn(`[V2] Job created but failed to create job-component link: ${linkError.message}`);
            }
          }
          return created;
        };

        const ensureJobComponentLink = async (jobId: string): Promise<void> => {
          try {
            const existingLinks = await this.repository.getJobComponentLinksByJob(jobId);
            const linkAlreadyExists = existingLinks.some((link: any) => link.componentId === component.id);
            if (!linkAlreadyExists) {
              await this.repository.createJobComponentLink({
                vesselId,
                jobId,
                componentId: component.id,
                componentCode,
                linkedBy: 'system-bulk-import',
              });
              result.jobComponentLinksCreated = (result.jobComponentLinksCreated || 0) + 1;
            }
          } catch (linkError: any) {
            console.warn(`[V2] Failed to create job-component link: ${linkError.message}`);
          }
        };

        if (mode === 'add') {
          if (existingJob) {
            result.skipped++;
            continue;
          }
          const id = uuidv4();
          const created = await createJobAndLink(id);
          if (created) {
            jobsByCompositeKey.set(compositeKey, created);
            result.created++;
            const { checksum } = createRecordSnapshot(created);
            await this.repository.createImportChangeLog({
              id: uuidv4(),
              importHistoryId,
              entityType: 'job',
              entityId: id,
              operation: 'created',
              previousData: null,
              newData: { jobNo, jobTitle: woTitle, componentCode },
              checksum,
            });
          }
        } else if (mode === 'update') {
          if (!existingJob) {
            result.skipped++;
            continue;
          }
          await ensureJobComponentLink(existingJob.id);
          const updated = await this.repository.updateJob(existingJob.id, jobData);
          if (updated) {
            jobsByCompositeKey.set(compositeKey, updated);
            result.updated++;
            const { checksum: afterChecksum } = createRecordSnapshot(updated);
            await this.repository.createImportChangeLog({
              id: uuidv4(),
              importHistoryId,
              entityType: 'job',
              entityId: existingJob.id,
              operation: 'updated',
              previousData: existingJob,
              newData: { jobNo, jobTitle: woTitle, componentCode },
              checksum: afterChecksum,
            });
          }
        } else if (mode === 'upsert') {
          if (existingJob) {
            await ensureJobComponentLink(existingJob.id);
            const updated = await this.repository.updateJob(existingJob.id, jobData);
            if (updated) {
              jobsByCompositeKey.set(compositeKey, updated);
              result.updated++;
              const { checksum: afterChecksum } = createRecordSnapshot(updated);
              await this.repository.createImportChangeLog({
                id: uuidv4(),
                importHistoryId,
                entityType: 'job',
                entityId: existingJob.id,
                operation: 'updated',
                previousData: existingJob,
                newData: { jobNo, jobTitle: woTitle, componentCode },
                checksum: afterChecksum,
              });
            }
          } else {
            const id = uuidv4();
            const created = await createJobAndLink(id);
            if (created) {
              jobsByCompositeKey.set(compositeKey, created);
              result.created++;
              const { checksum } = createRecordSnapshot(created);
              await this.repository.createImportChangeLog({
                id: uuidv4(),
                importHistoryId,
                entityType: 'job',
                entityId: id,
                operation: 'created',
                previousData: null,
                newData: { jobNo, jobTitle: woTitle, componentCode },
                checksum,
              });
            }
          }
        }
      } catch (error: any) {
        console.error(`[V2] Error importing job row:`, error.message);
        result.skipped++;
      }
    }

    console.log(`[V2] Jobs import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.jobComponentLinksCreated || 0} links created`);
    return result;
  }

  private async importSpares(
    data: any[],
    mode: string,
    vesselId: string,
    userId: string,
    importHistoryId: string
  ): Promise<ImportResult> {
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, archived: 0, spareComponentLinksCreated: 0 };
    console.log(`[V2] Starting spares import: ${data.length} rows, mode: ${mode}, vesselId: ${vesselId}`);

    const allComponents = await this.repository.getComponents(vesselId);
    const componentsByCode = new Map(allComponents.map((c: any) => [c.componentCode, c]));

    const existingSpares = await this.repository.getSpares(vesselId);
    const sparesByPartCode = new Map(existingSpares.map((s: any) => [s.partCode, s]));

    let maxPartCodeNum = 0;
    existingSpares.forEach((spare: any) => {
      if (spare.partCode && spare.partCode.startsWith('PT-')) {
        const match = spare.partCode.match(/PT-(\d+)/);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxPartCodeNum) maxPartCodeNum = num;
        }
      }
    });
    let nextPartCodeNum = maxPartCodeNum + 1;

    for (const row of data) {
      try {
        const componentCode = String(row['Component Code'] || '').trim();
        const component = componentsByCode.get(componentCode);

        if (!component) {
          console.warn(`[V2] Component ${componentCode} not found, skipping spare`);
          result.skipped++;
          continue;
        }

        let partCode = row['Part Code'] ? String(row['Part Code']).trim() : '';
        if (!partCode) {
          partCode = `PT-${String(nextPartCodeNum).padStart(6, '0')}`;
          nextPartCodeNum++;
        }

        const existingSpare = sparesByPartCode.get(partCode);

        const criticalVal = row['Criticality'] || 'No';
        const isActiveVal = row['Is Active'];
        const ihmVal = row['IHM (Inventory of Hazardous Materials)'];

        let totalRob = 0;
        if (row['Total ROB'] !== undefined && row['Total ROB'] !== null && row['Total ROB'] !== '') {
          totalRob = parseInt(String(row['Total ROB'])) || 0;
        } else {
          const locARob = parseInt(String(row['Location A - ROB'] || '0')) || 0;
          const locBRob = parseInt(String(row['Location B - ROB'] || '0')) || 0;
          totalRob = locARob + locBRob;
        }

        const robLocationAVal = parseInt(String(row['Location A - ROB'] || '0')) || 0;
        const robLocationBVal = parseInt(String(row['Location B - ROB'] || '0')) || 0;

        const spareData: any = {
          partCode,
          partName: String(row['Part Name'] || '').trim(),
          componentId: component.id,
          componentCode,
          componentName: component.name || '',
          componentSpareCode: `SP-${componentCode}-${String(result.created + 1).padStart(3, '0')}`,
          critical: criticalVal === 'Yes' || criticalVal === true ? 'Yes' : 'No',
          rob: totalRob,
          robLocationA: robLocationAVal,
          robLocationB: robLocationBVal,
          min: row['Minimum Stock'] ? parseInt(String(row['Minimum Stock'])) : 0,
          location: row['Location A'] ? String(row['Location A']).trim() : null,
          location2: row['Location B'] ? String(row['Location B']).trim() : null,
          vesselId,
          partNumber: row['Part Number'] ? String(row['Part Number']).trim() : null,
          uom: row['UOM'] ? String(row['UOM']).trim().toUpperCase() : null,
          maker: row['Maker'] ? String(row['Maker']).trim() : null,
          makerCode: row['Maker Code'] ? String(row['Maker Code']).trim() : null,
          specification: row['Specification'] ? String(row['Specification']).trim() : null,
          drawingNumber: row['Drawing Number'] ? String(row['Drawing Number']).trim() : null,
          positionNumber: row['Position Number'] ? String(row['Position Number']).trim() : null,
          note: row['Note'] ? String(row['Note']).trim() : null,
          manualName: row['Manual Name'] ? String(row['Manual Name']).trim() : null,
          pageNumber: row['Page Number'] ? String(row['Page Number']).trim() : null,
          isActive: isActiveVal === 'Yes' || isActiveVal === true ? true : (isActiveVal === 'No' || isActiveVal === false ? false : true),
          ihm: ihmVal === 'Yes' || ihmVal === true ? 'Yes' : 'No',
          remarks: row['Evidence Type'] ? String(row['Evidence Type']).trim() : (row['Remarks'] ? String(row['Remarks']).trim() : null),
          fleetEquipmentCode: row['Fleet Equipment Code'] ? String(row['Fleet Equipment Code']).trim() : null,
          dataScope: 'vessel',
        };

        if (mode === 'add') {
          if (existingSpare) {
            try {
              const existingLinks = await this.repository.getSpareComponentLinksBySpare(existingSpare.id);
              const linkAlreadyExists = existingLinks.some((link: any) => link.componentId === component.id);
              if (!linkAlreadyExists) {
                await this.repository.createSpareComponentLink({
                  vesselId,
                  spareId: existingSpare.id,
                  componentId: component.id,
                  linkedBy: 'system-bulk-import',
                });
                result.spareComponentLinksCreated = (result.spareComponentLinksCreated || 0) + 1;
                result.updated++;
              } else {
                result.skipped++;
              }
            } catch (_e) {
              result.skipped++;
            }
            continue;
          }

          const newSpare = await this.repository.createSpare(spareData);
          sparesByPartCode.set(partCode, newSpare);
          result.created++;

          if (importHistoryId) {
            const { checksum } = createRecordSnapshot(newSpare);
            await this.repository.createImportChangeLog({
              id: uuidv4(),
              importHistoryId,
              entityType: 'spare',
              entityId: String(newSpare.id),
              operation: 'created',
              previousData: null,
              newData: { partCode, partName: newSpare.partName },
              checksum,
            });
          }

          await this.processSpareInventory({
            spareId: newSpare.id,
            vesselId,
            componentId: component.id,
            locationAName: row['Location A'] ? String(row['Location A']).trim() : null,
            locationBName: row['Location B'] ? String(row['Location B']).trim() : null,
            robLocationA: robLocationAVal,
            robLocationB: robLocationBVal,
            isNewSpare: true,
            userId,
          });
          result.spareComponentLinksCreated = (result.spareComponentLinksCreated || 0) + 1;

        } else if (mode === 'update') {
          if (!existingSpare) {
            result.skipped++;
            continue;
          }

          const { checksum: beforeChecksum } = createRecordSnapshot(existingSpare);
          const updateData = { ...spareData };
          delete updateData.componentSpareCode;

          if (!updateData.partName) updateData.partName = existingSpare.partName;

          const updatedSpare = await this.repository.updateSpare(existingSpare.id, updateData);
          sparesByPartCode.set(partCode, updatedSpare);
          result.updated++;

          if (importHistoryId) {
            const { checksum: afterChecksum } = createRecordSnapshot(updatedSpare);
            await this.repository.createImportChangeLog({
              id: uuidv4(),
              importHistoryId,
              entityType: 'spare',
              entityId: String(existingSpare.id),
              operation: 'updated',
              previousData: existingSpare,
              newData: { partCode },
              checksum: afterChecksum,
            });
          }

          await this.processSpareInventory({
            spareId: existingSpare.id,
            vesselId,
            componentId: component.id,
            locationAName: row['Location A'] ? String(row['Location A']).trim() : existingSpare.location,
            locationBName: row['Location B'] ? String(row['Location B']).trim() : existingSpare.location2,
            robLocationA: robLocationAVal,
            robLocationB: robLocationBVal,
            isNewSpare: false,
            userId,
          });

        } else if (mode === 'upsert') {
          if (existingSpare) {
            try {
              const existingLinks = await this.repository.getSpareComponentLinksBySpare(existingSpare.id);
              const linkAlreadyExists = existingLinks.some((link: any) => link.componentId === component.id);
              if (!linkAlreadyExists) {
                await this.repository.createSpareComponentLink({
                  vesselId,
                  spareId: existingSpare.id,
                  componentId: component.id,
                  linkedBy: 'system-bulk-import',
                });
                result.spareComponentLinksCreated = (result.spareComponentLinksCreated || 0) + 1;
              }
            } catch (_e) {}

            const updateData = { ...spareData };
            delete updateData.componentSpareCode;
            const updatedSpare = await this.repository.updateSpare(existingSpare.id, updateData);
            sparesByPartCode.set(partCode, updatedSpare);
            result.updated++;

            if (importHistoryId) {
              const { checksum: afterChecksum } = createRecordSnapshot(updatedSpare);
              await this.repository.createImportChangeLog({
                id: uuidv4(),
                importHistoryId,
                entityType: 'spare',
                entityId: String(existingSpare.id),
                operation: 'updated',
                previousData: existingSpare,
                newData: { partCode },
                checksum: afterChecksum,
              });
            }

            await this.processSpareInventory({
              spareId: existingSpare.id,
              vesselId,
              componentId: component.id,
              locationAName: row['Location A'] ? String(row['Location A']).trim() : existingSpare.location,
              locationBName: row['Location B'] ? String(row['Location B']).trim() : existingSpare.location2,
              robLocationA: robLocationAVal,
              robLocationB: robLocationBVal,
              isNewSpare: false,
              userId,
            });
          } else {
            const newSpare = await this.repository.createSpare(spareData);
            sparesByPartCode.set(partCode, newSpare);
            result.created++;

            if (importHistoryId) {
              const { checksum } = createRecordSnapshot(newSpare);
              await this.repository.createImportChangeLog({
                id: uuidv4(),
                importHistoryId,
                entityType: 'spare',
                entityId: String(newSpare.id),
                operation: 'created',
                previousData: null,
                newData: { partCode, partName: newSpare.partName },
                checksum,
              });
            }

            await this.processSpareInventory({
              spareId: newSpare.id,
              vesselId,
              componentId: component.id,
              locationAName: row['Location A'] ? String(row['Location A']).trim() : null,
              locationBName: row['Location B'] ? String(row['Location B']).trim() : null,
              robLocationA: robLocationAVal,
              robLocationB: robLocationBVal,
              isNewSpare: true,
              userId,
            });
            result.spareComponentLinksCreated = (result.spareComponentLinksCreated || 0) + 1;
          }
        }
      } catch (error: any) {
        console.error(`[V2] Error importing spare row:`, error.message);
        result.skipped++;
      }
    }

    console.log(`[V2] Spares import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
    return result;
  }

  private async processSpareInventory(params: {
    spareId: number;
    vesselId: string;
    componentId: string;
    locationAName: string | null;
    locationBName: string | null;
    robLocationA: number;
    robLocationB: number;
    isNewSpare: boolean;
    userId: string;
  }): Promise<void> {
    try {
      await this.repository.createSpareComponentLink({
        vesselId: params.vesselId,
        spareId: params.spareId,
        componentId: params.componentId,
        linkedBy: 'system-bulk-import',
      }).catch(() => {});

      if (params.locationAName) {
        const locationA = await this.repository.findOrCreateLocation(
          params.vesselId, params.locationAName, params.userId
        );
        const existingStock = await this.repository.getSpareLocationStock(params.spareId, locationA.id);
        if (existingStock) {
          await this.repository.updateSpareLocationStock(existingStock.id, params.robLocationA);
        } else {
          await this.repository.createSpareLocationStock({
            vesselId: params.vesselId,
            spareId: params.spareId,
            locationId: locationA.id,
            qty: params.robLocationA,
          });
        }

        if (params.isNewSpare && params.robLocationA > 0) {
          await this.repository.createInventoryTransaction({
            vesselId: params.vesselId,
            spareId: params.spareId,
            locationId: locationA.id,
            eventType: 'ADJUST',
            qtyChange: params.robLocationA,
            robTotalBefore: 0,
            robTotalAfter: params.robLocationA + params.robLocationB,
            robLocationBefore: 0,
            robLocationAfter: params.robLocationA,
            referenceType: 'BULK_IMPORT',
            referenceNote: 'Opening balance from bulk import',
            userId: params.userId,
          });
        }
      }

      if (params.locationBName) {
        const locationB = await this.repository.findOrCreateLocation(
          params.vesselId, params.locationBName, params.userId
        );
        const existingStock = await this.repository.getSpareLocationStock(params.spareId, locationB.id);
        if (existingStock) {
          await this.repository.updateSpareLocationStock(existingStock.id, params.robLocationB);
        } else {
          await this.repository.createSpareLocationStock({
            vesselId: params.vesselId,
            spareId: params.spareId,
            locationId: locationB.id,
            qty: params.robLocationB,
          });
        }

        if (params.isNewSpare && params.robLocationB > 0) {
          await this.repository.createInventoryTransaction({
            vesselId: params.vesselId,
            spareId: params.spareId,
            locationId: locationB.id,
            eventType: 'ADJUST',
            qtyChange: params.robLocationB,
            robTotalBefore: params.robLocationA,
            robTotalAfter: params.robLocationA + params.robLocationB,
            robLocationBefore: 0,
            robLocationAfter: params.robLocationB,
            referenceType: 'BULK_IMPORT',
            referenceNote: 'Opening balance from bulk import',
            userId: params.userId,
          });
        }
      }
    } catch (error: any) {
      console.warn(`[V2] Error processing spare inventory for spareId ${params.spareId}:`, error.message);
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

      const id = uuidv4();
      try {
        const created = await this.repository.createComponent({
          id,
          componentCode: parentCode,
          name,
          componentCategory: category,
          parentId: parentOfParent || null,
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
      parentId: parentCode,
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
