import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { storage } from '../storage';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// Store dry-run results temporarily (in production, use Redis or similar)
const dryRunCache = new Map<string, any>();

// Component categories from existing system (8 main categories)
const COMPONENT_CATEGORIES = [
  "Ship General",
  "Hull",
  "Equipment for Cargo",
  "Ship's Equipment",
  "Equipment for Crew & Passengers",
  "Machinery Main Components",
  "Systems for Machinery Main Components",
  "Ship Common Systems"
];

// UOM list
const UOM_LIST = ['pcs', 'set', 'ltr', 'kg', 'm', 'box', 'roll', 'pack', 'kit', 'other'];

// Stores categories
const STORES_CATEGORIES = [
  'General Stores',
  'Electrical',
  'Mechanical',
  'Safety',
  'Consumables'
];

// Generate template based on type
router.get('/template', (req, res) => {
  const { type } = req.query;
  
  if (!['components', 'spares', 'stores'].includes(type as string)) {
    return res.status(400).json({ error: 'Invalid template type' });
  }

  const workbook = XLSX.utils.book_new();
  let headers: string[] = [];
  let validValues: string[] = [];
  let example: any[] = [];

  switch (type) {
    case 'components':
      headers = [
        // Section A
        'Component Code', 'Component Name', 'Component Category',
        'Maker', 'Model', 'Serial No', 'Drawing No', 'Location',
        'Critical (Yes/No)', 'Condition Based (Yes/No)',
        'Installation Date', 'Commissioned Date', 'Rating', 'No of Units',
        'Eqpt / System Department', 'Parent Component Code',
        'Dimensions/Size', 'Notes',
        // Section B
        'Running Hours', 'Date Updated',
        // Metrics (up to 5)
        ...Array.from({ length: 5 }, (_, i) => [
          `Metric${i + 1} Name`,
          `Metric${i + 1} Value`,
          `Metric${i + 1} Unit`
        ]).flat(),
        // Work Orders (up to 10)
        ...Array.from({ length: 10 }, (_, i) => [
          `WO${i + 1} Title`,
          `WO${i + 1} Frequency Type (Calendar/Running Hours)`,
          `WO${i + 1} Frequency Value`,
          `WO${i + 1} Initial Next Due (Date)`,
          `WO${i + 1} Assigned To (Rank)`
        ]).flat(),
        // Spares (up to 10)
        ...Array.from({ length: 10 }, (_, i) => [
          `SP${i + 1} Part Code`,
          `SP${i + 1} Part Name`,
          `SP${i + 1} Min`,
          `SP${i + 1} Critical (Yes/No)`,
          `SP${i + 1} Location`
        ]).flat()
      ];

      validValues = [
        'Required, Unique', 'Text', COMPONENT_CATEGORIES.join('|'),
        'Text', 'Text', 'Text', 'Text', 'Text',
        'Yes/No', 'Yes/No',
        'DD-MM-YYYY', 'DD-MM-YYYY', 'Text', 'Number >= 0',
        'Text', 'Existing Code or blank',
        'Text', 'Text',
        'Number >= 0', 'DD-MM-YYYY',
        ...Array.from({ length: 5 }, () => ['Text', 'Number', 'Text']).flat(),
        ...Array.from({ length: 10 }, () => [
          'Text', 'Calendar/Running Hours', 'Number > 0', 'DD-MM-YYYY', 'Text'
        ]).flat(),
        ...Array.from({ length: 10 }, () => [
          'Text', 'Text', 'Number >= 0', 'Yes/No', 'Text'
        ]).flat()
      ];

      example = [
        '1.1.1', 'Main Engine', 'Machinery Main Components',
        'MAN B&W', 'S60MC-C', '12345', 'DRW-001', 'Engine Room',
        'Yes', 'Yes',
        '01-01-2020', '15-03-2020', '15000 kW', '1',
        'Engineering', '',
        '10m x 5m x 8m', 'Main propulsion engine',
        '25000', '15-01-2024',
        ...Array.from({ length: 5 }, () => ['', '', '']).flat(),
        'Cylinder Head Overhaul', 'Running Hours', '8000', '01-06-2024', 'Chief Engineer',
        ...Array.from({ length: 9 }, () => ['', '', '', '', '']).flat(),
        'SP-001', 'Cylinder Head Gasket', '2', 'Yes', 'Store Room A',
        ...Array.from({ length: 9 }, () => ['', '', '', '', '']).flat()
      ];
      break;

    case 'spares':
      headers = [
        'Part Code', 'Part Name', 'Component Code',
        'UOM', 'Min', 'Critical (Yes/No)', 'ROB', 'Location',
        'Maker', 'Model', 'Remarks'
      ];

      validValues = [
        'Required, Unique', 'Required', 'Required, Must exist',
        UOM_LIST.join('|'), 'Number >= 0', 'Yes/No', 'Number >= 0', 'Text',
        'Text', 'Text', 'Text'
      ];

      example = [
        'SP-001', 'Cylinder Head Gasket', '1.1.1',
        'pcs', '2', 'Yes', '5', 'Store Room A',
        'MAN B&W', 'GS-12345', 'For main engine only'
      ];
      break;

    case 'stores':
      headers = [
        'Item Code', 'Item Name', 'Type',
        'Stores Category', 'UOM', 'ROB', 'Min', 'Location',
        'Application Area', 'Remarks'
      ];

      validValues = [
        'Required, Unique', 'Required', 'Stores|Lubes|Chemicals|Others',
        STORES_CATEGORIES.join('|'), UOM_LIST.join('|'), 
        'Number >= 0', 'Number >= 0', 'Text',
        'Text', 'Text'
      ];

      example = [
        'ST-001', 'Welding Electrodes', 'Stores',
        'General Stores', 'kg', '50', '20', 'Workshop Store',
        'Deck & Engine', 'AWS E6013 specification'
      ];
      break;
  }

  // Create main sheet
  const mainSheet = XLSX.utils.aoa_to_sheet([headers, validValues, example]);
  XLSX.utils.book_append_sheet(workbook, mainSheet, 'Data');

  // Create meta sheet
  const metaData = [
    ['Template Type', type],
    ['Template Version', '1.0'],
    ['Generated At', new Date().toISOString()],
    [''],
    ['Component Categories', ...COMPONENT_CATEGORIES],
    ['UOM List', ...UOM_LIST],
    ['Stores Categories', ...STORES_CATEGORIES]
  ];
  const metaSheet = XLSX.utils.aoa_to_sheet(metaData);
  XLSX.utils.book_append_sheet(workbook, metaSheet, 'Meta');

  // Send file
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${type}_template.xlsx"`);
  res.send(buffer);
});

// Dry-run validation
router.post('/dry-run', upload.single('file'), async (req, res) => {
  try {
    const { type, mode, archiveMissing, vesselId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!['components', 'spares', 'stores'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    if (!['add', 'update', 'upsert'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode' });
    }

    // Parse file based on extension
    let data: any[] = [];
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === '.csv') {
      const csvText = file.buffer.toString('utf-8');
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      data = parsed.data;
    } else if (['.xlsx', '.xls'].includes(ext)) {
      const workbook = XLSX.read(file.buffer);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      data = XLSX.utils.sheet_to_json(firstSheet);
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    // Validate data
    const results = await validateData(type, data, mode, vesselId);
    
    // Generate file token
    const fileToken = uuidv4();
    
    // Cache the results and file for import
    dryRunCache.set(fileToken, {
      type,
      mode,
      archiveMissing: archiveMissing === 'true',
      vesselId,
      data,
      results,
      file: file.buffer,
      originalName: file.originalname,
      timestamp: Date.now()
    });

    // Clean up old cache entries (older than 1 hour)
    const oneHourAgo = Date.now() - 3600000;
    Array.from(dryRunCache.entries()).forEach(([key, value]) => {
      if (value.timestamp < oneHourAgo) {
        dryRunCache.delete(key);
      }
    });

    res.json({
      fileToken,
      columns: results.columns,
      summary: results.summary,
      rows: results.rows.slice(0, 100), // Limit preview to 100 rows
      errorReportUrl: results.summary.errors > 0 ? `/api/bulk/history/tmp/${fileToken}/errors.csv` : undefined
    });
  } catch (error) {
    console.error('Dry-run error:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// Actual import
router.post('/import', async (req, res) => {
  try {
    const { fileToken, type, mode, archiveMissing, vesselId } = req.body;

    const cachedData = dryRunCache.get(fileToken);
    if (!cachedData) {
      return res.status(400).json({ error: 'Invalid or expired file token' });
    }

    // Check if there are errors
    if (cachedData.results.summary.errors > 0) {
      return res.status(400).json({ error: 'Cannot import file with errors' });
    }

    // Perform the actual import
    const importResult = await performImport(
      type,
      cachedData.data,
      mode,
      archiveMissing,
      vesselId,
      (req as any).user?.id || 'system'
    );

    // Store in history
    const historyId = uuidv4();
    await storeImportHistory({
      id: historyId,
      type,
      mode,
      archiveMissing,
      userId: (req as any).user?.id || 'system',
      vesselId,
      ...importResult,
      startedAt: new Date(),
      finishedAt: new Date(),
      status: 'success',
      originalFile: cachedData.file,
      originalName: cachedData.originalName
    });

    // Clean up cache
    dryRunCache.delete(fileToken);

    res.json({
      ...importResult,
      historyId
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

// Get import history
router.get('/history', async (req, res) => {
  try {
    const { type, limit = 20, offset = 0 } = req.query;
    
    const history = await getImportHistory(
      type as string,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json(history);
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Download history files
router.get('/history/:id/:fileType', async (req, res) => {
  try {
    const { id, fileType } = req.params;
    
    const file = await getHistoryFile(id, fileType);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.send(file.data);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Validation function
async function validateData(type: string, data: any[], mode: string, vesselId?: string) {
  const results = {
    columns: [] as string[],
    summary: { ok: 0, warnings: 0, errors: 0 },
    rows: [] as any[]
  };

  if (data.length === 0) {
    results.summary.errors = 1;
    return results;
  }

  // Get columns from first row
  results.columns = Object.keys(data[0]);

  // Validate each row based on type
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2; // Excel rows start at 1, plus header
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalized: any = {};

    if (type === 'components') {
      // Validate component
      if (!row['Component Code']) {
        errors.push(`Row ${rowNum}: Component Code is required`);
      } else {
        normalized['Component Code'] = String(row['Component Code']).trim();
      }

      if (!row['Component Category']) {
        errors.push(`Row ${rowNum}: Component Category is required`);
      } else if (!COMPONENT_CATEGORIES.includes(row['Component Category'])) {
        errors.push(`Row ${rowNum}: Invalid Component Category. Allowed: ${COMPONENT_CATEGORIES.join(', ')}`);
      } else {
        normalized['Component Category'] = row['Component Category'];
      }

      // Validate Yes/No fields
      ['Critical (Yes/No)', 'Condition Based (Yes/No)'].forEach(field => {
        if (row[field]) {
          const value = row[field].toString().toLowerCase();
          if (!['yes', 'no'].includes(value)) {
            errors.push(`Row ${rowNum}: ${field} must be Yes or No`);
          } else {
            normalized[field] = value === 'yes' ? 'Yes' : 'No';
          }
        }
      });

      // Validate numbers
      ['No of Units', 'Running Hours'].forEach(field => {
        if (row[field]) {
          const num = parseFloat(row[field]);
          if (isNaN(num) || num < 0) {
            errors.push(`Row ${rowNum}: ${field} must be a non-negative number`);
          } else {
            normalized[field] = num;
          }
        }
      });

      // Copy other fields
      Object.keys(row).forEach(key => {
        if (!normalized[key]) {
          normalized[key] = row[key];
        }
      });
    } else if (type === 'spares') {
      // Validate spare
      if (!row['Part Code']) {
        errors.push(`Row ${rowNum}: Part Code is required`);
      } else {
        normalized['Part Code'] = String(row['Part Code']).trim();
      }

      if (!row['Part Name']) {
        errors.push(`Row ${rowNum}: Part Name is required`);
      } else {
        normalized['Part Name'] = String(row['Part Name']).trim();
      }

      if (!row['Component Code']) {
        errors.push(`Row ${rowNum}: Component Code is required`);
      } else {
        normalized['Component Code'] = String(row['Component Code']).trim();
        // TODO: Check if component exists
      }

      if (row['UOM'] && !UOM_LIST.includes(row['UOM'].toLowerCase())) {
        errors.push(`Row ${rowNum}: Invalid UOM. Allowed: ${UOM_LIST.join(', ')}`);
      } else if (row['UOM']) {
        normalized['UOM'] = row['UOM'].toLowerCase();
      }

      // Validate numbers
      ['Min', 'ROB'].forEach(field => {
        if (row[field]) {
          const num = parseFloat(row[field]);
          if (isNaN(num) || num < 0) {
            errors.push(`Row ${rowNum}: ${field} must be a non-negative number`);
          } else {
            normalized[field] = num;
          }
        }
      });

      // Validate Critical
      if (row['Critical (Yes/No)']) {
        const value = row['Critical (Yes/No)'].toString().toLowerCase();
        if (!['yes', 'no'].includes(value)) {
          errors.push(`Row ${rowNum}: Critical must be Yes or No`);
        } else {
          normalized['Critical (Yes/No)'] = value === 'yes' ? 'Yes' : 'No';
        }
      }

      // Copy other fields
      Object.keys(row).forEach(key => {
        if (!normalized[key]) {
          normalized[key] = row[key];
        }
      });
    } else if (type === 'stores') {
      // Validate stores
      if (!row['Item Code']) {
        errors.push(`Row ${rowNum}: Item Code is required`);
      } else {
        normalized['Item Code'] = String(row['Item Code']).trim();
      }

      if (!row['Item Name']) {
        errors.push(`Row ${rowNum}: Item Name is required`);
      } else {
        normalized['Item Name'] = String(row['Item Name']).trim();
      }

      if (row['Type'] && !['Stores', 'Lubes', 'Chemicals', 'Others'].includes(row['Type'])) {
        errors.push(`Row ${rowNum}: Invalid Type. Allowed: Stores, Lubes, Chemicals, Others`);
      } else if (row['Type']) {
        normalized['Type'] = row['Type'];
      }

      if (row['UOM'] && !UOM_LIST.includes(row['UOM'].toLowerCase())) {
        errors.push(`Row ${rowNum}: Invalid UOM. Allowed: ${UOM_LIST.join(', ')}`);
      } else if (row['UOM']) {
        normalized['UOM'] = row['UOM'].toLowerCase();
      }

      // Validate numbers
      ['ROB', 'Min'].forEach(field => {
        if (row[field]) {
          const num = parseFloat(row[field]);
          if (isNaN(num) || num < 0) {
            errors.push(`Row ${rowNum}: ${field} must be a non-negative number`);
          } else {
            normalized[field] = num;
          }
        }
      });

      // Copy other fields
      Object.keys(row).forEach(key => {
        if (!normalized[key]) {
          normalized[key] = row[key];
        }
      });
    }

    // Determine status
    let status: 'ok' | 'warning' | 'error' = 'ok';
    if (errors.length > 0) {
      status = 'error';
      results.summary.errors++;
    } else if (warnings.length > 0) {
      status = 'warning';
      results.summary.warnings++;
    } else {
      results.summary.ok++;
    }

    results.rows.push({
      row: rowNum,
      status,
      errors: [...errors, ...warnings],
      normalized
    });
  }

  return results;
}

// Perform actual import
async function performImport(
  type: string,
  data: any[],
  mode: string,
  archiveMissing: boolean,
  vesselId: string | undefined,
  userId: string
) {
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
    archived: 0
  };

  if (type === 'components') {
    for (const row of data) {
      const componentCode = String(row['Component Code']).trim();
      const existing = await storage.getComponent(componentCode);

      if (mode === 'add') {
        if (existing) {
          result.skipped++;
        } else {
          await createComponentFromRow(row, vesselId);
          result.created++;
        }
      } else if (mode === 'update') {
        if (existing) {
          await updateComponentFromRow(componentCode, row);
          result.updated++;
        } else {
          result.skipped++;
        }
      } else if (mode === 'upsert') {
        if (existing) {
          await updateComponentFromRow(componentCode, row);
          result.updated++;
        } else {
          await createComponentFromRow(row, vesselId);
          result.created++;
        }
      }
    }
  } else if (type === 'spares') {
    // TODO: Implement spares import
    for (const row of data) {
      result.created++;
    }
  } else if (type === 'stores') {
    // TODO: Implement stores import
    for (const row of data) {
      result.created++;
    }
  }

  if (archiveMissing) {
    // Archive records not in the file
    // TODO: Implement archiving logic
    result.archived = 0;
  }

  return result;
}

// Helper function to create component from Excel row
async function createComponentFromRow(row: any, vesselId?: string) {
  const componentCode = String(row['Component Code']).trim();
  const componentData = {
    id: componentCode,
    componentCode: componentCode,
    name: row['Component Name'] || '',
    category: row['Component Category'] || '',
    parentId: row['Parent Component Code'] ? String(row['Parent Component Code']).trim() : null,
    vesselId: vesselId || row['Vessel ID'] || 'V001',
    maker: row['Maker'] || null,
    model: row['Model'] || null,
    serialNo: row['Serial No'] || null,
    location: row['Location'] || null,
    deptCategory: row['Eqpt / System Department'] || null,
    componentCategory: row['Component Category'] || null,
    commissionedDate: row['Commissioned Date'] || null,
    critical: row['Critical (Yes/No)'] === 'Yes',
    classItem: row['Condition Based (Yes/No)'] === 'Yes',
    currentCumulativeRH: row['Running Hours'] ? String(row['Running Hours']) : '0'
  };

  return await storage.createComponent(componentData);
}

// Helper function to update component from Excel row
async function updateComponentFromRow(componentCode: string, row: any) {
  const updateData: any = {};
  
  if (row['Component Name']) updateData.name = row['Component Name'];
  if (row['Component Category']) updateData.category = row['Component Category'];
  if (row['Parent Component Code']) updateData.parentId = String(row['Parent Component Code']).trim();
  if (row['Maker']) updateData.maker = row['Maker'];
  if (row['Model']) updateData.model = row['Model'];
  if (row['Serial No']) updateData.serialNo = row['Serial No'];
  if (row['Location']) updateData.location = row['Location'];
  if (row['Eqpt / System Department']) updateData.deptCategory = row['Eqpt / System Department'];
  if (row['Commissioned Date']) updateData.commissionedDate = row['Commissioned Date'];
  if (row['Critical (Yes/No)']) updateData.critical = row['Critical (Yes/No)'] === 'Yes';
  if (row['Condition Based (Yes/No)']) updateData.classItem = row['Condition Based (Yes/No)'] === 'Yes';
  if (row['Running Hours']) updateData.currentCumulativeRH = String(row['Running Hours']);

  return await storage.updateComponent(componentCode, updateData);
}

// Store import history
async function storeImportHistory(data: any) {
  await storage.createImportHistory(data);
}

// Get import history
async function getImportHistory(type: string | undefined, limit: number, offset: number) {
  const result = await storage.getImportHistory(type, limit, offset);
  
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
      originalName: h.originalName
    })),
    total: result.total
  };
}

// Get history file
async function getHistoryFile(id: string, fileType: string) {
  const history = await storage.getImportHistoryById(id);
  
  if (!history) return null;

  if (fileType === 'file') {
    // Note: originalFile buffer is not stored in database schema
    // This would need to be stored in object storage or file system
    // For now, return null as file storage is not implemented
    return null;
  }

  // Generate error report or result map as needed
  return null;
}

export default router;