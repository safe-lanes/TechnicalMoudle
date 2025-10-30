import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { storage } from '../storage';
import { getSFIName } from '../utils/sfiLookup';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// Store dry-run results temporarily (in production, use Redis or similar)
const dryRunCache = new Map<string, any>();

// Component categories from existing system (8 main categories)
const COMPONENT_CATEGORIES = [
  "1 Ship General",
  "2 Hull",
  "3 Equipment for Cargo",
  "4 Ship Equipment",
  "5 Equipment for Crew and Passengers",
  "6 Machinery Main Components",
  "7 Systems for Machinery Main Components",
  "8 Ship Common Systems"
];

// Helper function to map Main Group Code (1-8) to full category name
function getComponentCategory(mainGroupCode: number): string | null {
  if (mainGroupCode >= 1 && mainGroupCode <= 8) {
    return COMPONENT_CATEGORIES[mainGroupCode - 1];
  }
  return null;
}

// Helper function to extract Sub Group Code (first 2 digits) from SFI code
// Examples: 711.001 → 71, 612.005 → 61, 7 → null, 71 → 71
function getSubGroupCode(sfiCode: string): string | null {
  // Strip any suffix before processing
  const cleanCode = stripSFISuffix(sfiCode);
  const baseCode = cleanCode.split('.')[0]; // Get part before decimal
  if (baseCode.length >= 2) {
    return baseCode.substring(0, 2);
  }
  return null; // Single digit codes don't have a sub-group
}

// Helper function to map Sub Group Code to Sub Group Name
// This is a simplified mapping - in production, this would come from a complete SFI reference database
function getSubGroupName(subGroupCode: string): string {
  const subGroupNames: { [key: string]: string } = {
    // Group 7 - Systems for Machinery Main Components
    '71': 'LUBE OIL SYSTEMS',
    '72': 'COOLING SYSTEMS',
    '73': 'FUEL OIL SYSTEMS',
    '74': 'COMPRESSED AIR SYSTEMS',
    '75': 'HYDRAULIC SYSTEMS',
    // Group 6 - Machinery Main Components
    '61': 'DIESEL ENGINES',
    '62': 'STEAM TURBINES',
    '63': 'GAS TURBINES',
    // Group 2 - Hull
    '21': 'SHELL PLATING',
    '22': 'HULL',
    '23': 'SHELL DOORS',
    // Add more mappings as needed
  };
  return subGroupNames[subGroupCode] || 'UNKNOWN SUB GROUP';
}

// Helper function to extract parent SFI code
// Strip suffixes like (1), (2), etc. from SFI codes
function stripSFISuffix(sfiCode: string): string {
  // Remove anything in parentheses at the end: "226.065(1)" → "226.065"
  return sfiCode.replace(/\([^)]*\)$/, '').trim();
}

function getParentSFICode(sfiCode: string): string | null {
  // Strip any suffix like (1), (2) before calculating parent
  const cleanCode = stripSFISuffix(sfiCode);
  
  const parts = cleanCode.split('.');
  if (parts.length > 1) {
    // Has decimal parts (e.g., 711.001 → parent is 711)
    parts.pop(); // Remove last part
    return parts.join('.');
  }
  // No decimal, check if it's a multi-digit code
  const baseCode = cleanCode;
  if (baseCode.length > 2) {
    // 3+ digit code (e.g., 711 → parent is 71)
    return baseCode.substring(0, 2);
  } else if (baseCode.length === 2) {
    // 2-digit code (e.g., 71 → parent is 7)
    return baseCode.charAt(0);
  }
  return null; // Single-digit codes have no parent
}

// Validate SFI code format
function validateSFICode(sfiCode: string): boolean {
  // SFI codes can be: 6, 61, 612, 612.005, 612.005.001
  // Also accept codes with suffixes like 226.065(1), 230(2), etc.
  // Strip the suffix before validation
  const cleanCode = stripSFISuffix(sfiCode);
  const pattern = /^\d{1,3}(\.\d{1,3})*$/;
  return pattern.test(cleanCode);
}

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
  
  if (!['components', 'spares', 'stores', 'work-orders'].includes(type as string)) {
    return res.status(400).json({ error: 'Invalid template type' });
  }

  const workbook = XLSX.utils.book_new();
  let headers: string[] = [];
  let validValues: string[] = [];
  let example: any[] = [];

  switch (type) {
    case 'components':
      headers = [
        // Initial 8 columns (as per user's Excel)
        'Main Group Code', 'Sub Group Code', 'Original SFI Code', 'Generated Code',
        'Component Name', 'Parent Code', 'Main Group Name', 'Sub Group Name',
        // Section A - Component Information
        'Maker', 'Model', 'Serial No', 'Drawing No', 'Location',
        'Critical (Yes/No)', 'Condition Based (Yes/No)',
        'Installation Date', 'Commissioned Date', 'Rating', 'No of Units',
        'Eqpt / System Department', 'Dimensions/Size', 'Notes',
        // Section B - Running Hours
        'Running Hours', 'Date Updated'
      ];

      validValues = [
        '1-8', 'Auto-calculated', 'Required, SFI Format', 'Auto-calculated',
        'Required', 'Auto-calculated', 'Auto-calculated', 'Auto-calculated',
        'Text', 'Text', 'Text', 'Text', 'Text',
        'Yes/No', 'Yes/No',
        'DD-MM-YYYY', 'DD-MM-YYYY', 'Text', 'Number >= 0',
        'Text', 'Text', 'Text',
        'Number >= 0', 'DD-MM-YYYY'
      ];

      example = [
        '7', '71', '711.001', '711.001',
        'LO transfer systems', '71', 'SYSTEMS FOR MACHINERY MAIN COMPONENTS', 'LUBE OIL SYSTEMS',
        'ABC Marine', 'LO-2000', 'SN-12345', 'DRW-711-001', 'Engine Room',
        'Yes', 'No',
        '01-01-2020', '15-03-2020', '50 bar', '2',
        'Engineering', '2m x 1m x 1.5m', 'Lube oil transfer and circulation system',
        '5000', '15-01-2024'
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

    case 'work-orders':
      headers = [
        'Component Code', 'WO Title', 'Maintenance Basis', 'Frequency Value', 'Frequency Unit',
        'Task Type', 'Assigned To', 'Approver', 'Class Related', 'Job Priority',
        'Brief Work Description'
      ];

      validValues = [
        'Required, Must exist', 'Required', 'Calendar|Running Hours|Condition Based',
        'Number (e.g., 500 for hours, 6 for months)', 'Days|Weeks|Months|Years (for Calendar only)',
        'Inspection|Overhaul|Repair|Replacement|Service|Testing', 'Required',
        'Required', 'Yes|No', 'Low|Medium|High|Critical', 'Text'
      ];

      example = [
        '6.1', 'Main Engine Bearing Inspection', 'Calendar', '6', 'Months',
        'Inspection', 'Chief Engineer', 'Fleet Superintendent',
        'Yes', 'High', 'Inspect main engine bearings for wear and damage'
      ];
      break;
  }

  // Create main sheet - Just headers and example, NO description row
  const mainSheet = XLSX.utils.aoa_to_sheet([headers, example]);

  // Add data validation for components
  if (type === 'components') {
    if (!mainSheet['!dataValidation']) {
      mainSheet['!dataValidation'] = [];
    }

    // Main Group Code dropdown (Column A, starting from row 2) - Only 1-8
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'A2:A1000',
      formulas: ['"1,2,3,4,5,6,7,8"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Main Group Code',
      error: 'Please select a number from 1-8'
    });

    // Critical (Yes/No) dropdown (Column N, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'N2:N1000',
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Value',
      error: 'Please select Yes or No'
    });

    // Condition Based (Yes/No) dropdown (Column O, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'O2:O1000',
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Value',
      error: 'Please select Yes or No'
    });
  }

  // Add data validation for spares
  if (type === 'spares') {
    if (!mainSheet['!dataValidation']) {
      mainSheet['!dataValidation'] = [];
    }

    // UOM dropdown (Column D, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'D2:D1000',
      formulas: [`"${UOM_LIST.join(',')}"`],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid UOM',
      error: `Please select from: ${UOM_LIST.join(', ')}`
    });

    // Critical (Yes/No) dropdown (Column F, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'F2:F1000',
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Value',
      error: 'Please select Yes or No'
    });
  }

  // Add data validation for stores
  if (type === 'stores') {
    if (!mainSheet['!dataValidation']) {
      mainSheet['!dataValidation'] = [];
    }

    // Type dropdown (Column C, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'C2:C1000',
      formulas: ['"Stores,Lubes,Chemicals,Others"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Type',
      error: 'Please select from: Stores, Lubes, Chemicals, Others'
    });

    // Stores Category dropdown (Column D, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'D2:D1000',
      formulas: [`"${STORES_CATEGORIES.join(',')}"`],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Category',
      error: `Please select from: ${STORES_CATEGORIES.join(', ')}`
    });

    // UOM dropdown (Column E, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'E2:E1000',
      formulas: [`"${UOM_LIST.join(',')}"`],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid UOM',
      error: `Please select from: ${UOM_LIST.join(', ')}`
    });
  }

  // Add data validation for work orders
  if (type === 'work-orders') {
    if (!mainSheet['!dataValidation']) {
      mainSheet['!dataValidation'] = [];
    }

    // Maintenance Basis dropdown (Column C, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'C2:C1000',
      formulas: ['"Calendar,Running Hours,Condition Based"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Maintenance Basis',
      error: 'Please select from: Calendar, Running Hours, Condition Based'
    });

    // Frequency Unit dropdown (Column E, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'E2:E1000',
      formulas: ['"Days,Weeks,Months,Years"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Frequency Unit',
      error: 'Please select from: Days, Weeks, Months, Years (for Calendar basis)'
    });

    // Task Type dropdown (Column F, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'F2:F1000',
      formulas: ['"Inspection,Overhaul,Repair,Replacement,Service,Testing"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Task Type',
      error: 'Please select from: Inspection, Overhaul, Repair, Replacement, Service, Testing'
    });

    // Class Related dropdown (Column I, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'I2:I1000',
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Value',
      error: 'Please select Yes or No'
    });

    // Job Priority dropdown (Column J, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'J2:J1000',
      formulas: ['"Low,Medium,High,Critical"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Priority',
      error: 'Please select from: Low, Medium, High, Critical'
    });
  }

  XLSX.utils.book_append_sheet(workbook, mainSheet, 'Data');

  // Create meta sheet with instructions
  const metaData = [
    ['Template Type', type],
    ['Template Version', '3.0'],
    ['Generated At', new Date().toISOString()],
    [''],
    ['INSTRUCTIONS:'],
    ['1. Row 1 contains the column headers'],
    ['2. Row 2 contains example data (you can delete or replace it)'],
    ['3. Add your data starting from Row 2 or Row 3 onwards'],
    ['4. Use the dropdown menus in cells for category and Yes/No fields'],
    ['5. Save and upload this file when complete'],
    [''],
    ['FIELD REQUIREMENTS:'],
    ...validValues.map((val, idx) => [headers[idx], val]),
    [''],
    ['VALID VALUES:'],
    ['Component Categories', ...COMPONENT_CATEGORIES],
    ['UOM Options', ...UOM_LIST],
    ['Stores Categories', ...STORES_CATEGORIES],
    ['Type Options', 'Stores, Lubes, Chemicals, Others']
  ];
  const metaSheet = XLSX.utils.aoa_to_sheet(metaData);
  XLSX.utils.book_append_sheet(workbook, metaSheet, 'Meta');

  // Send file
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${type}_template.xlsx"`);
  res.send(buffer);
});

// Get sheet names from Excel file
router.post('/sheets', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === '.csv') {
      // CSV files don't have sheets
      return res.json({ sheets: ['Sheet1'] });
    } else if (['.xlsx', '.xls'].includes(ext)) {
      const workbook = XLSX.read(file.buffer);
      return res.json({ sheets: workbook.SheetNames });
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }
  } catch (error) {
    console.error('Error reading sheets:', error);
    res.status(500).json({ error: 'Failed to read file sheets' });
  }
});

// Dry-run validation
router.post('/dry-run', upload.single('file'), async (req, res) => {
  try {
    const { type, mode, archiveMissing, vesselId, sheetName } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!['components', 'spares', 'stores', 'work-orders'].includes(type)) {
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
      
      // Use specified sheet name or default to first sheet
      const targetSheetName = sheetName || workbook.SheetNames[0];
      const targetSheet = workbook.Sheets[targetSheetName];
      
      if (!targetSheet) {
        return res.status(400).json({ 
          error: `Sheet "${targetSheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}` 
        });
      }
      
      data = XLSX.utils.sheet_to_json(targetSheet);
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
      data, // raw data
      normalizedData: results.rows.filter(r => r.status !== 'error').map(r => r.normalized), // normalized data without errors
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

    // Perform the actual import using normalized data
    const importResult = await performImport(
      type,
      cachedData.normalizedData || cachedData.data, // Use normalized data if available
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

  // Track duplicate Generated Codes for components (actual duplicates to warn about)
  const generatedCodeOccurrences = new Map<string, number[]>();
  if (type === 'components') {
    data.forEach((row, index) => {
      // Use Generated Code if available, otherwise fall back to Original SFI Code
      const generatedCode = row['Generated Code'] || row['Original SFI Code'];
      if (generatedCode) {
        const code = String(generatedCode).trim();
        if (!generatedCodeOccurrences.has(code)) {
          generatedCodeOccurrences.set(code, []);
        }
        generatedCodeOccurrences.get(code)!.push(index + 2); // Row number (Excel is 1-indexed + header)
      }
    });
  }
  
  // Validate each row based on type
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2; // Excel rows start at 1, plus header
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalized: any = {};

    if (type === 'components') {
      // Validate Original SFI Code
      const sfiCode = row['Original SFI Code'];
      if (!sfiCode) {
        errors.push(`Row ${rowNum}: Original SFI Code is required`);
      } else {
        const sfiCodeStr = String(sfiCode).trim();
        if (!validateSFICode(sfiCodeStr)) {
          errors.push(`Row ${rowNum}: Invalid SFI code format. Expected format: 6, 61, 612, 612.005, etc.`);
        } else {
          // Strip any suffix from Original SFI Code - suffixes belong in Generated Code
          const cleanSFICode = stripSFISuffix(sfiCodeStr);
          normalized['Original SFI Code'] = cleanSFICode;
          
          // Use Generated Code if provided (for unique IDs with suffixes like 230(1), 230(2)),
          // otherwise fall back to Original SFI Code
          const generatedCode = row['Generated Code'] ? String(row['Generated Code']).trim() : sfiCodeStr;
          normalized['Generated Code'] = generatedCode;
          normalized['Component Code'] = generatedCode; // Use Generated Code for component ID
          
          // Check for duplicate Generated Codes (actual duplicates that need warnings)
          const occurrences = generatedCodeOccurrences.get(generatedCode);
          if (occurrences && occurrences.length > 1) {
            const otherRows = occurrences.filter(r => r !== rowNum);
            warnings.push(`Row ${rowNum}: Duplicate Generated Code '${generatedCode}' found in rows ${otherRows.join(', ')}. Only the last occurrence will be kept.`);
          }
          
          // Auto-calculate Sub Group Code (first 2 digits)
          const subGroupCode = getSubGroupCode(sfiCodeStr);
          if (subGroupCode && !row['Sub Group Code']) {
            normalized['Sub Group Code'] = subGroupCode;
          }
          
          // Auto-populate Sub Group Name if not provided (regardless of whether code was auto-generated)
          const finalSubGroupCode = row['Sub Group Code'] || normalized['Sub Group Code'];
          if (finalSubGroupCode && !row['Sub Group Name']) {
            normalized['Sub Group Name'] = getSubGroupName(finalSubGroupCode);
          }
          
          // Auto-calculate Parent Code from Original SFI Code
          // ALWAYS recalculate - don't trust Excel values as they may be incorrect
          const parentCode = getParentSFICode(sfiCodeStr);
          if (parentCode) {
            normalized['Parent Code'] = parentCode;
          }
        }
      }

      // Validate Main Group Code and map to category
      const mainGroupCode = row['Main Group Code'];
      if (!mainGroupCode) {
        errors.push(`Row ${rowNum}: Main Group Code is required`);
      } else {
        const mainGroupNum = parseInt(mainGroupCode);
        if (isNaN(mainGroupNum) || mainGroupNum < 1 || mainGroupNum > 8) {
          errors.push(`Row ${rowNum}: Main Group Code must be a number from 1-8`);
        } else {
          normalized['Main Group Code'] = mainGroupNum;
          
          // Auto-map to Component Category and Main Group Name
          const category = getComponentCategory(mainGroupNum);
          if (category) {
            normalized['Component Category'] = category;
            if (!row['Main Group Name']) {
              normalized['Main Group Name'] = category;
            }
          }
          
          // Validate that Main Group Code matches first digit of SFI code
          const sfiCodeStr = normalized['Component Code'];
          if (sfiCodeStr) {
            const firstDigit = parseInt(sfiCodeStr.charAt(0));
            if (!isNaN(firstDigit) && firstDigit !== mainGroupNum) {
              errors.push(`Row ${rowNum}: Main Group Code (${mainGroupNum}) must match first digit of SFI code (${firstDigit})`);
            }
          }
        }
      }
      
      // Component Name is required
      if (!row['Component Name']) {
        errors.push(`Row ${rowNum}: Component Name is required`);
      } else {
        normalized['Component Name'] = String(row['Component Name']).trim();
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
    } else if (type === 'work-orders') {
      // Validate work orders
      if (!row['Component Code']) {
        errors.push(`Row ${rowNum}: Component Code is required`);
      } else {
        normalized['Component Code'] = String(row['Component Code']).trim();
        // TODO: Check if component exists
      }

      if (!row['WO Title']) {
        errors.push(`Row ${rowNum}: WO Title is required`);
      } else {
        normalized['WO Title'] = String(row['WO Title']).trim();
      }

      // Validate Maintenance Basis
      const validMaintenanceBasis = ['Calendar', 'Running Hours', 'Condition Based'];
      if (row['Maintenance Basis'] && !validMaintenanceBasis.includes(row['Maintenance Basis'])) {
        errors.push(`Row ${rowNum}: Invalid Maintenance Basis. Allowed: ${validMaintenanceBasis.join(', ')}`);
      } else if (row['Maintenance Basis']) {
        normalized['Maintenance Basis'] = row['Maintenance Basis'];
      }

      // Validate Frequency Value and Unit based on Maintenance Basis
      const maintenanceBasis = row['Maintenance Basis'];
      if (maintenanceBasis === 'Calendar' || maintenanceBasis === 'Running Hours') {
        // Frequency Value is required for Calendar and Running Hours
        if (!row['Frequency Value']) {
          errors.push(`Row ${rowNum}: Frequency Value is required for ${maintenanceBasis} maintenance`);
        } else {
          const freqVal = parseFloat(row['Frequency Value']);
          if (isNaN(freqVal) || freqVal <= 0) {
            errors.push(`Row ${rowNum}: Frequency Value must be a positive number`);
          } else {
            normalized['Frequency Value'] = String(freqVal);
          }
        }

        // Frequency Unit is required only for Calendar basis
        if (maintenanceBasis === 'Calendar') {
          const validFreqUnits = ['Days', 'Weeks', 'Months', 'Years'];
          if (!row['Frequency Unit']) {
            errors.push(`Row ${rowNum}: Frequency Unit is required for Calendar maintenance`);
          } else if (!validFreqUnits.includes(row['Frequency Unit'])) {
            errors.push(`Row ${rowNum}: Invalid Frequency Unit. Allowed: ${validFreqUnits.join(', ')}`);
          } else {
            normalized['Frequency Unit'] = row['Frequency Unit'];
          }
        } else {
          // Running Hours - Frequency Unit should not be provided
          if (row['Frequency Unit']) {
            warnings.push(`Row ${rowNum}: Frequency Unit is not used for Running Hours maintenance (will be ignored)`);
          }
        }
      } else if (maintenanceBasis === 'Condition Based') {
        // For Condition Based, frequency fields are optional/not required
        if (row['Frequency Value']) {
          warnings.push(`Row ${rowNum}: Frequency Value is not used for Condition Based maintenance (will be ignored)`);
        }
        if (row['Frequency Unit']) {
          warnings.push(`Row ${rowNum}: Frequency Unit is not used for Condition Based maintenance (will be ignored)`);
        }
      }

      // Validate Task Type
      const validTaskTypes = ['Inspection', 'Overhaul', 'Repair', 'Replacement', 'Service', 'Testing'];
      if (row['Task Type'] && !validTaskTypes.includes(row['Task Type'])) {
        errors.push(`Row ${rowNum}: Invalid Task Type. Allowed: ${validTaskTypes.join(', ')}`);
      } else if (row['Task Type']) {
        normalized['Task Type'] = row['Task Type'];
      }

      // Validate Class Related
      if (row['Class Related']) {
        const value = row['Class Related'].toString();
        if (!['Yes', 'No'].includes(value)) {
          errors.push(`Row ${rowNum}: Class Related must be Yes or No`);
        } else {
          normalized['Class Related'] = value;
        }
      }

      // Validate Job Priority
      const validPriorities = ['Low', 'Medium', 'High', 'Critical'];
      if (row['Job Priority'] && !validPriorities.includes(row['Job Priority'])) {
        errors.push(`Row ${rowNum}: Invalid Job Priority. Allowed: ${validPriorities.join(', ')}`);
      } else if (row['Job Priority']) {
        normalized['Job Priority'] = row['Job Priority'];
      }

      // Validate required fields
      if (!row['Assigned To']) {
        errors.push(`Row ${rowNum}: Assigned To is required`);
      } else {
        normalized['Assigned To'] = String(row['Assigned To']).trim();
      }

      if (!row['Approver']) {
        errors.push(`Row ${rowNum}: Approver is required`);
      } else {
        normalized['Approver'] = String(row['Approver']).trim();
      }

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
    console.log(`🚀 Starting component import: ${data.length} rows, mode: ${mode}`);
    
    // First, ensure all intermediate parent nodes exist
    // For each component, create parent hierarchy if missing
    const parentsToCreate = new Set<string>();
    
    for (const row of data) {
      const componentCode = String(row['Component Code'] || row['Generated Code'] || row['Original SFI Code']).trim();
      
      // For hierarchy building, use the Original SFI Code (without suffixes like (1), (2), etc.)
      // Generated Code may have suffixes for uniqueness, but hierarchy is based on the base SFI code
      const originalSFICode = String(row['Original SFI Code'] || row['Component Code'] || row['Generated Code']).trim();
      
      // Walk up the hierarchy by iteratively trimming the SFI code itself
      // This ensures ALL intermediate nodes are considered, not just those in Parent Code chain
      // Example: 711.001 → 711 → 71 → 7
      let currentCode = getParentSFICode(originalSFICode);
      
      while (currentCode && currentCode.length > 0) {
        const parentExists = await storage.getComponent(currentCode);
        if (!parentExists) {
          parentsToCreate.add(currentCode);
        }
        // Move up one level by trimming the current code
        currentCode = getParentSFICode(currentCode);
      }
    }
    
    // Create missing parent nodes (sorted by depth, shallowest first)
    const sortedParents = Array.from(parentsToCreate).sort((a, b) => {
      const aDepth = (a.match(/\./g) || []).length;
      const bDepth = (b.match(/\./g) || []).length;
      return aDepth - bDepth;
    });
    
    console.log(`📁 Creating ${sortedParents.length} intermediate parent nodes...`);
    for (const parentCode of sortedParents) {
      const parentMainGroup = parseInt(parentCode.charAt(0));
      const parentSubGroup = getSubGroupCode(parentCode);
      
      // Use SFI lookup to get proper name from component tree CSV
      // Falls back to existing logic if not found in lookup
      let parentName: string = getSFIName(parentCode);
      
      // If getSFIName returned the fallback (generic "SFI {code}"), try existing logic
      if (parentName === `SFI ${parentCode}`) {
        if (parentCode.length === 1) {
          // Single digit: use main group name without number prefix
          const category = getComponentCategory(parentMainGroup);
          parentName = category ? category.replace(/^\d+\s+/, '') : `SFI ${parentCode}`;
        } else if (parentCode.length === 2) {
          // Two digits: use sub group name
          parentName = getSubGroupName(parentCode);
        }
        // else: keep the getSFIName fallback for three or more digits
      }
      
      await storage.createComponent({
        id: parentCode,
        componentCode: parentCode,
        name: parentName,
        category: getComponentCategory(parentMainGroup) || '',
        parentId: getParentSFICode(parentCode),
        vesselId: vesselId || 'V001',
        currentCumulativeRH: '0',
        critical: false,
        classItem: false
      });
      console.log(`📁 Created parent node: ${parentCode} (${parentName})`);
      result.created++;
    }
    
    // Sort components by SFI hierarchy depth (parents before children)
    // e.g., "6" before "61" before "612.005"
    const sortedData = [...data].sort((a, b) => {
      const aCode = String(a['Component Code'] || a['Generated Code'] || a['Original SFI Code'] || '').trim();
      const bCode = String(b['Component Code'] || b['Generated Code'] || b['Original SFI Code'] || '').trim();
      const aDepth = (aCode.match(/\./g) || []).length;
      const bDepth = (bCode.match(/\./g) || []).length;
      return aDepth - bDepth; // Lower depth (parents) first
    });

    for (const row of sortedData) {
      const componentCode = String(row['Component Code'] || row['Generated Code'] || row['Original SFI Code']).trim();
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
          console.log(`🔄 Updating existing component: ${componentCode}`);
          await updateComponentFromRow(componentCode, row);
          result.updated++;
        } else {
          await createComponentFromRow(row, vesselId);
          result.created++;
        }
      }
    }
    
    console.log(`✅ Component import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
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
  } else if (type === 'work-orders') {
    // Generate WO code sequence counter for each component-year combination
    // Format: WO-{ComponentCode}-{Year}-{Sequence}
    const currentYear = new Date().getFullYear().toString();
    const woSequenceMap = new Map<string, number>();
    
    for (const row of data) {
      const componentCode = String(row['Component Code']).trim();
      const componentYearKey = `${componentCode}-${currentYear}`;
      
      // Get or initialize sequence number for this component-year combination
      if (!woSequenceMap.has(componentYearKey)) {
        // Check existing WOs for this component in current year to determine next sequence
        const existingWOs = await storage.getWorkOrders(vesselId);
        const componentYearWOs = existingWOs.filter(wo => 
          wo.templateCode?.startsWith(`WO-${componentCode}-${currentYear}-`)
        );
        const maxSeq = componentYearWOs.length > 0 
          ? Math.max(...componentYearWOs.map(wo => {
              // Extract sequence from format: WO-{code}-{year}-{seq}
              const match = wo.templateCode?.match(/-(\d+)$/);
              return match ? parseInt(match[1]) : 0;
            }))
          : 0;
        woSequenceMap.set(componentYearKey, maxSeq + 1);
      }

      const sequence = woSequenceMap.get(componentYearKey)!;
      const templateCode = `WO-${componentCode}-${currentYear}-${String(sequence).padStart(2, '0')}`;
      
      const existing = Array.from((await storage.getWorkOrders(vesselId))).find(
        wo => wo.templateCode === templateCode
      );

      if (mode === 'add') {
        if (existing) {
          result.skipped++;
        } else {
          await createWorkOrderFromRow(row, templateCode, vesselId);
          result.created++;
          woSequenceMap.set(componentYearKey, sequence + 1);
        }
      } else if (mode === 'update') {
        if (existing) {
          await updateWorkOrderFromRow(existing.id, row);
          result.updated++;
        } else {
          result.skipped++;
        }
      } else if (mode === 'upsert') {
        if (existing) {
          await updateWorkOrderFromRow(existing.id, row);
          result.updated++;
        } else {
          await createWorkOrderFromRow(row, templateCode, vesselId);
          result.created++;
          woSequenceMap.set(componentYearKey, sequence + 1);
        }
      }
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
  const componentCode = String(row['Component Code'] || row['Generated Code'] || row['Original SFI Code']).trim();
  const componentData = {
    id: componentCode,
    componentCode: componentCode,
    name: row['Component Name'] || '',
    category: row['Component Category'] || row['Main Group Name'] || '',
    // Use Parent Code (auto-calculated from SFI)
    parentId: row['Parent Code'] ? String(row['Parent Code']).trim() : null,
    vesselId: vesselId || row['Vessel ID'] || 'V001',
    // Section A - Component Information
    maker: row['Maker'] || null,
    model: row['Model'] || null,
    serialNo: row['Serial No'] || null,
    department: row['Eqpt / System Department'] || null,
    deptCategory: row['Eqpt / System Department'] || null,
    componentCategory: row['Component Category'] || row['Main Group Name'] || null,
    location: row['Location'] || null,
    commissionedDate: row['Commissioned Date'] || null,
    installationDate: row['Installation Date'] || null,
    critical: row['Critical (Yes/No)'] === 'Yes',
    classItem: false, // Not in template, defaulting to false
    rating: row['Rating'] || null,
    conditionBased: row['Condition Based (Yes/No)'] || null,
    noOfUnits: row['No of Units'] || null,
    eqptSystemDept: row['Eqpt / System Department'] || null,
    parentComponent: row['Parent Code'] ? String(row['Parent Code']).trim() : null,
    dimensionsSize: row['Dimensions/Size'] || null,
    notes: row['Notes'] || null,
    // Section B - Running Hours
    currentCumulativeRH: row['Running Hours'] ? String(row['Running Hours']) : '0'
  };

  console.log(`📦 Creating component: ${componentCode} - ${componentData.name}`);
  const result = await storage.createComponent(componentData);
  console.log(`✅ Component created: ${componentCode}`);
  return result;
}

// Helper function to update component from Excel row
async function updateComponentFromRow(componentCode: string, row: any) {
  const updateData: any = {};
  
  if (row['Component Name']) updateData.name = row['Component Name'];
  if (row['Component Category'] || row['Main Group Name']) {
    updateData.category = row['Component Category'] || row['Main Group Name'];
  }
  // Use Parent Code (auto-calculated from SFI)
  if (row['Parent Code']) {
    updateData.parentId = String(row['Parent Code']).trim();
  }
  // Section A - Component Information
  if (row['Maker']) updateData.maker = row['Maker'];
  if (row['Model']) updateData.model = row['Model'];
  if (row['Serial No']) updateData.serialNo = row['Serial No'];
  if (row['Eqpt / System Department']) {
    updateData.department = row['Eqpt / System Department'];
    updateData.deptCategory = row['Eqpt / System Department'];
    updateData.eqptSystemDept = row['Eqpt / System Department'];
  }
  if (row['Component Category'] || row['Main Group Name']) {
    updateData.componentCategory = row['Component Category'] || row['Main Group Name'];
  }
  if (row['Location']) updateData.location = row['Location'];
  if (row['Commissioned Date']) updateData.commissionedDate = row['Commissioned Date'];
  if (row['Installation Date']) updateData.installationDate = row['Installation Date'];
  if (row['Critical (Yes/No)']) updateData.critical = row['Critical (Yes/No)'] === 'Yes';
  if (row['Rating']) updateData.rating = row['Rating'];
  if (row['Condition Based (Yes/No)']) updateData.conditionBased = row['Condition Based (Yes/No)'];
  if (row['No of Units']) updateData.noOfUnits = row['No of Units'];
  if (row['Parent Code']) updateData.parentComponent = String(row['Parent Code']).trim();
  if (row['Dimensions/Size']) updateData.dimensionsSize = row['Dimensions/Size'];
  if (row['Notes']) updateData.notes = row['Notes'];
  // Section B - Running Hours
  if (row['Running Hours']) updateData.currentCumulativeRH = String(row['Running Hours']);

  return await storage.updateComponent(componentCode, updateData);
}

// Helper function to create work order from Excel row
async function createWorkOrderFromRow(row: any, templateCode: string, vesselId?: string) {
  const componentCode = String(row['Component Code']).trim();
  const component = await storage.getComponent(componentCode);
  
  const workOrderData = {
    vesselId: vesselId || 'V001',
    component: component?.name || row['Component Code'],
    componentCode: componentCode,
    workOrderNo: `WO-${Date.now()}`, // Temporary WO number
    templateCode: templateCode,
    jobTitle: row['WO Title'] || '',
    assignedTo: row['Assigned To'] || '',
    approver: row['Approver'] || null,
    dueDate: new Date().toISOString(),
    status: 'Due' as const,
    taskType: row['Task Type'] || null,
    maintenanceBasis: row['Maintenance Basis'] || null,
    frequencyValue: row['Frequency Value'] ? String(row['Frequency Value']) : null,
    frequencyUnit: row['Frequency Unit'] || null,
    classRelated: row['Class Related'] || null,
    jobPriority: row['Job Priority'] || null,
    briefWorkDescription: row['Brief Work Description'] || null
  };

  return await storage.createWorkOrder(workOrderData);
}

// Helper function to update work order from Excel row
async function updateWorkOrderFromRow(workOrderId: string, row: any) {
  const updateData: any = {};
  
  if (row['WO Title']) updateData.jobTitle = row['WO Title'];
  if (row['Maintenance Basis']) updateData.maintenanceBasis = row['Maintenance Basis'];
  if (row['Frequency Value']) updateData.frequencyValue = String(row['Frequency Value']);
  if (row['Frequency Unit']) updateData.frequencyUnit = row['Frequency Unit'];
  if (row['Task Type']) updateData.taskType = row['Task Type'];
  if (row['Assigned To']) updateData.assignedTo = row['Assigned To'];
  if (row['Approver']) updateData.approver = row['Approver'];
  if (row['Class Related']) updateData.classRelated = row['Class Related'];
  if (row['Job Priority']) updateData.jobPriority = row['Job Priority'];
  if (row['Brief Work Description']) updateData.briefWorkDescription = row['Brief Work Description'];

  return await storage.updateWorkOrder(workOrderId, updateData);
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
async function getHistoryFile(id: string, fileType: string): Promise<{ mimeType: string; name: string; data: Buffer } | null> {
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