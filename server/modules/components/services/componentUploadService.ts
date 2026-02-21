import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import * as repo from '../repositories/componentRepository';

// Field mapping from file headers to database fields
// Supports multiple variations of each column name for flexible Excel import
const fieldMapping: { [key: string]: string } = {
  // Core identifiers
  'Component ID': 'id',
  'Component Name': 'name',
  'Component Code': 'componentCode',
  'Parent ID': 'parentId',
  'Parent Component Code': 'parentId',
  'Parent Component': 'parentId',

  // Category and classification
  'Category': 'category',
  'Component Category': 'componentCategory',
  'Department Category': 'deptCategory',
  'Dept Category': 'deptCategory',

  // Vessel identification
  'Vessel ID': 'vesselId',
  'Vessel Code': 'vesselCode',

  // Fleet equipment fields
  'Fleet Equipment Code': 'fleetEquipmentCode',
  'Fleet Eqpt Code': 'fleetEquipmentCode',
  'Fleet Equipment Name': 'fleetEquipmentName',
  'Fleet Eqpt Name': 'fleetEquipmentName',
  'Parent Fleet Equipment Code': 'parentFleetEquipmentCode',
  'Parent Fleet Eqpt Code': 'parentFleetEquipmentCode',

  // Maker and model information
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

  // Location and department
  'Location': 'location',
  'Department': 'department',
  'Dept': 'department',
  'Eqpt System Dept': 'eqptSystemDept',
  'Equip System Dept': 'eqptSystemDept',
  'Equipment System Department': 'eqptSystemDept',

  // Running hours and dates
  'Current Cumulative RH': 'currentCumulativeRH',
  'Running Hours': 'runningHours',
  'RH': 'runningHours',
  'Last Updated': 'lastUpdated',
  'Commissioned Date': 'commissionedDate',
  'Commissioning Date': 'commissionedDate',
  'Installation Date': 'installationDate',

  // Boolean flags
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

  // Additional fields
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

const normalizeKey = (key: string) => key.toLowerCase().trim().replace(/[\s_-]+/g, '');

// Build normalized mapping once
const normalizedMapping: { [key: string]: string } = {};
for (const [fileHeader, dbField] of Object.entries(fieldMapping)) {
  normalizedMapping[normalizeKey(fileHeader)] = dbField;
}

export async function processUpload(file: Express.Multer.File): Promise<{
  success: boolean;
  created: number;
  updated: number;
  failed: number;
  errors: any[];
  preview?: any[];
  columnInfo?: any;
}> {
  const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.'));

  let parsedData: any[] = [];
  let detectedHeaders: string[] = [];

  // Parse based on file type
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

    // Get headers from first row
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
    return {
      success: false,
      created: 0,
      updated: 0,
      failed: 1,
      errors: [{ message: 'Unsupported file format. Please upload CSV, XLS, or XLSX file.' }]
    };
  }

  // Column detection for user feedback
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

    console.log('📊 Excel Import - Column Detection:');
    console.log('  Detected headers:', detectedHeaders.join(', '));
    console.log('  Successfully mapped columns:', mappedColumns.map(c => `${c.original} → ${c.mapped}`).join(', '));
    if (unmappedColumns.length > 0) {
      console.log('  ⚠️  Unmapped columns (will be ignored):', unmappedColumns.join(', '));
    }
  }

  // Process and validate data
  const errors: any[] = [];
  const processedComponents: any[] = [];

  for (let i = 0; i < parsedData.length; i++) {
    const row = parsedData[i];
    const rowNum = i + 2; // Account for header row

    // Map fields with flexible column matching
    const component: any = {};
    for (const [originalHeader, value] of Object.entries(row)) {
      const normalizedHeader = normalizeKey(originalHeader);
      const dbField = normalizedMapping[normalizedHeader];

      if (dbField && value !== undefined && value !== null && value !== '') {
        let processedValue = value;

        // Convert boolean fields
        const booleanFields = ['critical', 'classItem', 'conditionBased', 'isParent', 'isActive'];
        if (booleanFields.includes(dbField)) {
          if (typeof processedValue === 'string') {
            processedValue = processedValue.toLowerCase() === 'true' ||
                             processedValue.toLowerCase() === 'yes' ||
                             processedValue === '1';
          } else if (typeof processedValue === 'boolean') {
            // Already boolean, keep as-is
          } else {
            processedValue = Boolean(processedValue);
          }
        }

        // Convert decimal fields
        if ((dbField === 'currentCumulativeRH' || dbField === 'runningHours') && processedValue !== '') {
          const numValue = typeof processedValue === 'number' ? processedValue : parseFloat(String(processedValue));
          if (!isNaN(numValue)) {
            processedValue = numValue.toString();
          }
        }

        component[dbField] = processedValue;
      }
    }

    // Validate required fields
    if (!component.id) {
      errors.push({ row: rowNum, field: 'Component ID', message: 'Component ID is required', data: row });
      continue;
    }
    if (!component.name) {
      errors.push({ row: rowNum, field: 'Component Name', message: 'Component Name is required', data: row });
      continue;
    }
    if (!component.componentCategory) {
      errors.push({ row: rowNum, field: 'Component Category', message: 'Component Category is required', data: row });
      continue;
    }
    if (!component.vesselCode) {
      errors.push({ row: rowNum, field: 'Vessel Code', message: 'Vessel Code is required - critical for tracking which vessel components belong to', data: row });
      continue;
    }

    // Set defaults for optional fields
    component.currentCumulativeRH = component.currentCumulativeRH || '0';
    component.critical = component.critical ?? false;
    component.classItem = component.classItem ?? false;

    processedComponents.push(component);
  }

  // If there are no valid components, return error
  if (processedComponents.length === 0 && errors.length > 0) {
    return {
      success: false,
      created: 0,
      updated: 0,
      failed: errors.length,
      errors,
      columnInfo
    };
  }

  // Perform bulk upsert
  const result = await repo.bulkUpsert(processedComponents);

  return {
    success: errors.length === 0,
    created: result.created,
    updated: result.updated,
    failed: errors.length,
    errors,
    preview: processedComponents.slice(0, 5),
    columnInfo
  };
}
