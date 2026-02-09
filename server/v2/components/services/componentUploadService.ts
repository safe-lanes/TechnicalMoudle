import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ComponentRepository } from "../repositories/componentRepository";
import { ValidationError } from "./errors";

const fieldMapping: { [key: string]: string } = {
  'Component ID': 'id',
  'Component Name': 'name',
  'Component Code': 'componentCode',
  'Parent ID': 'parentId',
  'Parent Component Code': 'parentId',
  'Parent Component': 'parentId',
  'Category': 'category',
  'Component Category': 'componentCategory',
  'Department Category': 'deptCategory',
  'Dept Category': 'deptCategory',
  'Vessel ID': 'vesselId',
  'Vessel Code': 'vesselCode',
  'Fleet Equipment Code': 'fleetEquipmentCode',
  'Fleet Eqpt Code': 'fleetEquipmentCode',
  'Fleet Equipment Name': 'fleetEquipmentName',
  'Fleet Eqpt Name': 'fleetEquipmentName',
  'Parent Fleet Equipment Code': 'parentFleetEquipmentCode',
  'Parent Fleet Eqpt Code': 'parentFleetEquipmentCode',
  'Maker': 'maker',
  'Maker Code': 'makerCode',
  'MakerCode': 'makerCode',
  'Maker No': 'makerCode',
  'Model': 'model',
  'Model Code': 'modelCode',
  'ModelCode': 'modelCode',
  'Model Number': 'modelNumber',
  'Model No': 'modelNumber',
  'Serial No': 'serialNo',
  'SerialNo': 'serialNo',
  'Serial Number': 'serialNo',
  'Drawing No': 'drawingNo',
  'DrawingNo': 'drawingNo',
  'Drawing Number': 'drawingNo',
  'Location': 'location',
  'Department': 'department',
  'Dept': 'department',
  'Eqpt System Dept': 'eqptSystemDept',
  'Equip System Dept': 'eqptSystemDept',
  'Equipment System Department': 'eqptSystemDept',
  'Current Cumulative RH': 'currentCumulativeRH',
  'Running Hours': 'runningHours',
  'RH': 'runningHours',
  'Last Updated': 'lastUpdated',
  'Commissioned Date': 'commissionedDate',
  'Commissioning Date': 'commissionedDate',
  'Installation Date': 'installationDate',
  'Critical': 'critical',
  'Critical (Yes/No)': 'critical',
  'Is Critical': 'critical',
  'Class Item': 'classItem',
  'ClassItem': 'classItem',
  'Is Class Item': 'classItem',
  'Condition Based': 'conditionBased',
  'Condition Based (Yes/No)': 'conditionBased',
  'ConditionBased': 'conditionBased',
  'Is Condition Based': 'conditionBased',
  'Is Parent': 'isParent',
  'IsParent': 'isParent',
  'Is Active': 'isActive',
  'IsActive': 'isActive',
  'Active': 'isActive',
  'Rating': 'rating',
  'Notes': 'notes',
  'Remarks': 'notes',
  'No of Units': 'noOfUnits',
  'Number of Units': 'noOfUnits',
  'Dimensions Size': 'dimensionsSize',
  'Dimensions': 'dimensionsSize',
  'Size': 'dimensionsSize',
  'Scope Notes': 'scopeNotes'
};

function normalizeKey(key: string): string {
  return key.toLowerCase().trim().replace(/[\s_-]+/g, '');
}

function buildNormalizedMapping(): { [key: string]: string } {
  const normalized: { [key: string]: string } = {};
  for (const [fileHeader, dbField] of Object.entries(fieldMapping)) {
    normalized[normalizeKey(fileHeader)] = dbField;
  }
  return normalized;
}

export class ComponentUploadService {
  constructor(private repository: ComponentRepository) {}

  async processUpload(file: { buffer: Buffer; originalname: string }): Promise<any> {
    const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.'));

    let parsedData: any[] = [];
    let detectedHeaders: string[] = [];

    if (fileExtension === '.csv') {
      const csvContent = file.buffer.toString('utf-8');
      const parseResult = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
      });
      parsedData = parseResult.data;
      detectedHeaders = parseResult.meta.fields || [];
    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
        const cell = worksheet[cellAddress];
        if (cell && cell.v) {
          detectedHeaders.push(String(cell.v));
        }
      }

      parsedData = XLSX.utils.sheet_to_json(worksheet);
    } else {
      throw new ValidationError("Unsupported file format. Please upload CSV, XLS, or XLSX file.");
    }

    const normalizedMapping = buildNormalizedMapping();

    let columnInfo: any = null;
    if (detectedHeaders.length > 0) {
      const mappedColumns = detectedHeaders
        .map(col => ({ original: col, mapped: normalizedMapping[normalizeKey(col)] }))
        .filter(c => c.mapped);

      const unmappedColumns = detectedHeaders.filter(col => !normalizedMapping[normalizeKey(col)]);

      columnInfo = {
        detected: detectedHeaders,
        mapped: mappedColumns,
        unmapped: unmappedColumns
      };

      console.log('V2 Upload - Column Detection:');
      console.log('  Detected headers:', detectedHeaders.join(', '));
      console.log('  Successfully mapped columns:', mappedColumns.map(c => `${c.original} → ${c.mapped}`).join(', '));
      if (unmappedColumns.length > 0) {
        console.log('  Unmapped columns (will be ignored):', unmappedColumns.join(', '));
      }
    }

    const errors: any[] = [];
    const processedComponents: any[] = [];

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];
      const rowNum = i + 2;

      const component: any = {};
      for (const [originalHeader, value] of Object.entries(row)) {
        const normalizedHeader = normalizeKey(originalHeader);
        const dbField = normalizedMapping[normalizedHeader];

        if (dbField && value !== undefined && value !== null && value !== '') {
          let processedValue = value;

          const booleanFields = ['critical', 'classItem', 'conditionBased', 'isParent', 'isActive'];
          if (booleanFields.includes(dbField)) {
            if (typeof processedValue === 'string') {
              processedValue = processedValue.toLowerCase() === 'true' ||
                               processedValue.toLowerCase() === 'yes' ||
                               processedValue === '1';
            } else if (typeof processedValue === 'boolean') {
              // keep as-is
            } else {
              processedValue = Boolean(processedValue);
            }
          }

          if ((dbField === 'currentCumulativeRH' || dbField === 'runningHours') && processedValue !== '') {
            const numValue = typeof processedValue === 'number' ? processedValue : parseFloat(String(processedValue));
            if (!isNaN(numValue)) {
              processedValue = numValue.toString();
            }
          }

          component[dbField] = processedValue;
        }
      }

      if (!component.id) {
        errors.push({
          row: rowNum,
          field: 'Component ID',
          message: 'Component ID is required',
          data: row
        });
        continue;
      }
      if (!component.name) {
        errors.push({
          row: rowNum,
          field: 'Component Name',
          message: 'Component Name is required',
          data: row
        });
        continue;
      }
      if (!component.componentCategory) {
        errors.push({
          row: rowNum,
          field: 'Component Category',
          message: 'Component Category is required',
          data: row
        });
        continue;
      }
      if (!component.vesselCode) {
        errors.push({
          row: rowNum,
          field: 'Vessel Code',
          message: 'Vessel Code is required - critical for tracking which vessel components belong to',
          data: row
        });
        continue;
      }

      component.currentCumulativeRH = component.currentCumulativeRH || '0';
      component.critical = component.critical ?? false;
      component.classItem = component.classItem ?? false;

      processedComponents.push(component);
    }

    if (processedComponents.length === 0 && errors.length > 0) {
      return {
        success: false,
        created: 0,
        updated: 0,
        failed: errors.length,
        errors: errors,
        columnInfo: columnInfo
      };
    }

    const result = await this.repository.bulkUpsert(processedComponents);

    return {
      success: errors.length === 0,
      created: result.created,
      updated: result.updated,
      failed: errors.length,
      errors: errors,
      preview: processedComponents.slice(0, 5),
      columnInfo: columnInfo
    };
  }
}
