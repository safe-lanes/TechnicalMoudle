import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import crypto from 'crypto';
import { storage, calculateRecordChecksum, sortObjectKeys } from '../storage';
import { getSFIName } from '../utils/sfiLookup';
import { calculateNextDueDate, normalizeDateToDDMMMYYYY } from '../../shared/dateUtils';
import { ObjectStorageService, ObjectNotFoundError } from '../objectStorage';
import { generatePlannedWorkOrderNumber, generateUnplannedWorkOrderNumber } from '../utils/workOrderNumbering';
import { getSparesExcelColumns } from '../../shared/sparesTemplateFields';

const router = Router();

const TEMPLATE_VERSION = '2.0.0';
const TEMPLATE_VERSION_DATE = '2025-11-28';
const TEMPLATE_VERSION_CELL = '_TEMPLATE_VERSION_';

function checkTemplateVersion(worksheet: XLSX.WorkSheet): { valid: boolean; version?: string; message?: string } {
  let versionValue: string | null = null;
  
  const cellsToCheck = ['AA1', 'C1', 'Z1'];
  for (const cellAddr of cellsToCheck) {
    const cell = worksheet[cellAddr];
    if (cell && cell.v && String(cell.v).startsWith(TEMPLATE_VERSION_CELL)) {
      versionValue = String(cell.v);
      break;
    }
  }
  
  if (!versionValue) {
    return { valid: true, message: 'No version info found - legacy template accepted' };
  }
  
  const version = versionValue.replace(TEMPLATE_VERSION_CELL, '');
  if (version === TEMPLATE_VERSION) {
    return { valid: true, version };
  }
  
  const versionParts = version.split('.').map(p => parseInt(p, 10));
  const currentParts = TEMPLATE_VERSION.split('.').map(p => parseInt(p, 10));
  
  if (versionParts.some(isNaN) || currentParts.some(isNaN)) {
    return { valid: true, version, message: 'Version format could not be parsed - accepting upload' };
  }
  
  const uploadMajor = versionParts[0] || 0;
  const currentMajor = currentParts[0] || 0;
  
  if (uploadMajor < currentMajor) {
    return { 
      valid: false, 
      version, 
      message: `Template version ${version} is outdated. Please download the latest template (v${TEMPLATE_VERSION}).` 
    };
  }
  
  return { valid: true, version };
}

function addVersionInfoToSheet(sheet: ExcelJS.Worksheet): void {
  sheet.getCell('AA1').value = `${TEMPLATE_VERSION_CELL}${TEMPLATE_VERSION}`;
  sheet.getColumn('AA').hidden = true;
}

/**
 * Process spare inventory after spare creation/update:
 * 1. Get or create location entities from location text names using findOrCreateLocation
 * 2. Create spare_component_link for spare-to-component relationship
 * 3. Create spare_location_stock records with qty
 * 4. For NEW spares only: Create opening balance transactions using ADJUST event
 *    (ADJUST is used for opening balances since RECEIVE is for normal stock receipts)
 * 
 * NOTE: This function properly reads current stock to compute accurate before/after values.
 * For existing spares (updates), it only updates stock levels without creating transactions
 * since the Excel import is a "sync" operation, not a receipt event.
 */
async function processSpareInventory(params: {
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
  const { spareId, vesselId, componentId, locationAName, locationBName, robLocationA, robLocationB, isNewSpare, userId } = params;
  
  try {
    // 1. Create spare-component link (if not exists)
    const existingLinks = await storage.getSpareComponentLinksBySpare(spareId);
    const alreadyLinked = existingLinks.some((link: any) => link.componentId === componentId);
    if (!alreadyLinked) {
      await storage.createSpareComponentLink({
        spareId,
        componentId,
        vesselId,
        linkedBy: userId,
      });
      console.log(`🔗 Linked spare ${spareId} to component ${componentId}`);
    }
    
    // 2. Process Location A if provided (always sync if location name is given)
    if (locationAName && locationAName.trim()) {
      // Use findOrCreateLocation for proper normalization
      const locationA = await storage.findOrCreateLocation(vesselId, locationAName.trim(), userId);
      
      // Get current stock to compute proper before/after values
      const currentTotalRobA = await storage.getSpareRobTotal(spareId);
      const currentLocStockA = await storage.getSpareLocationStockItem(spareId, locationA.id);
      const currentLocQtyA = currentLocStockA?.qty ?? 0;
      
      // Always sync stock to spreadsheet value (allows setting to 0)
      if (robLocationA >= 0) {
        await storage.upsertSpareLocationStock({
          vesselId,
          spareId,
          locationId: locationA.id,
          qty: robLocationA,
        });
        
        // Create opening balance transaction for NEW spares with non-zero qty
        // Use ADJUST event since this is an import operation, not a normal receive
        if (isNewSpare && robLocationA > 0) {
          const newTotalRobA = currentTotalRobA + robLocationA;
          await storage.createInventoryTransaction({
            vesselId,
            spareId,
            locationId: locationA.id,
            eventType: 'ADJUST',
            qtyChange: robLocationA,
            robTotalBefore: currentTotalRobA,
            robTotalAfter: newTotalRobA,
            robLocationBefore: currentLocQtyA,
            robLocationAfter: robLocationA,
            referenceType: 'OTHER',
            referenceNote: 'Opening balance from Excel import',
            userId,
          });
          console.log(`📊 Created opening balance for spare ${spareId} at ${locationAName}: ${robLocationA}`);
        }
      }
    }
    
    // 3. Process Location B if provided (always sync if location name is given)
    if (locationBName && locationBName.trim()) {
      // Use findOrCreateLocation for proper normalization
      const locationB = await storage.findOrCreateLocation(vesselId, locationBName.trim(), userId);
      
      // Get current stock AFTER location A processing to compute proper before/after
      const currentTotalRobB = await storage.getSpareRobTotal(spareId);
      const currentLocStockB = await storage.getSpareLocationStockItem(spareId, locationB.id);
      const currentLocQtyB = currentLocStockB?.qty ?? 0;
      
      // Always sync stock to spreadsheet value (allows setting to 0)
      if (robLocationB >= 0) {
        await storage.upsertSpareLocationStock({
          vesselId,
          spareId,
          locationId: locationB.id,
          qty: robLocationB,
        });
        
        // Create opening balance transaction for NEW spares with non-zero qty
        if (isNewSpare && robLocationB > 0) {
          const newTotalRobB = currentTotalRobB + robLocationB;
          await storage.createInventoryTransaction({
            vesselId,
            spareId,
            locationId: locationB.id,
            eventType: 'ADJUST',
            qtyChange: robLocationB,
            robTotalBefore: currentTotalRobB,
            robTotalAfter: newTotalRobB,
            robLocationBefore: currentLocQtyB,
            robLocationAfter: robLocationB,
            referenceType: 'OTHER',
            referenceNote: 'Opening balance from Excel import',
            userId,
          });
          console.log(`📊 Created opening balance for spare ${spareId} at ${locationBName}: ${robLocationB}`);
        }
      }
    }
  } catch (error: any) {
    console.error(`⚠️ Error processing inventory for spare ${spareId}:`, error.message);
    // Don't throw - inventory processing is supplementary, spare was already created
  }
}

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// Store dry-run results temporarily (in production, use Redis or similar)
const dryRunCache = new Map<string, any>();

/**
 * Extract data from Excel worksheet while preserving raw numeric values for dates
 * This prevents Excel serial numbers from being auto-formatted into strings like "01-Jan-45610"
 */
function extractRawExcelData(worksheet: XLSX.WorkSheet): any[] {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const data: any[] = [];
  
  // Extract headers from first row
  const headers: string[] = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
    const cell = worksheet[cellAddress];
    headers[col] = cell ? String(cell.v) : '';
  }
  
  // Extract data rows
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    const rowData: any = {};
    let hasData = false;
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      const header = headers[col];
      
      if (!header) continue;
      
      if (cell) {
        // Preserve raw numeric values (including Excel date serials)
        // instead of letting XLSX auto-format them
        rowData[header] = cell.v;
        hasData = true;
      } else {
        rowData[header] = undefined;
      }
    }
    
    if (hasData) {
      data.push(rowData);
    }
  }
  
  return data;
}

/**
 * Column name mapping for normalization
 * Maps various column name variations to the expected format
 */
const COLUMN_MAPPINGS: { [key: string]: { [variant: string]: string } } = {
  stores: {
    // Item Code variations
    'itemcode': 'Item Code',
    'item_code': 'Item Code',
    'item code': 'Item Code',
    'code': 'Item Code',
    // IMPA Code variations
    'impacode': 'IMPA Code',
    'impa_code': 'IMPA Code',
    'impa code': 'IMPA Code',
    'impa': 'IMPA Code',
    // Item Name variations
    'itemname': 'Item Name',
    'item_name': 'Item Name',
    'item name': 'Item Name',
    'name': 'Item Name',
    'description': 'Item Name',
    'item_description': 'Item Name',
    // UOM variations
    'uom': 'UOM',
    'unit': 'UOM',
    'unit_of_measure': 'UOM',
    'unit of measure': 'UOM',
    // Category variations
    'category': 'Category',
    'stores_category': 'Category',
    'stores category': 'Category',
    'storescategory': 'Category',
    // Total ROB variations
    'totalrob': 'Total ROB',
    'total_rob': 'Total ROB',
    'total rob': 'Total ROB',
    'rob': 'Total ROB',
    'stock': 'Total ROB',
    'quantity': 'Total ROB',
    // Location A variations
    'locationa': 'Location A',
    'location_a': 'Location A',
    'location a': 'Location A',
    'loc_a': 'Location A',
    'loc a': 'Location A',
    // Location A - ROB variations
    'locationa-rob': 'Location A - ROB',
    'location_a_rob': 'Location A - ROB',
    'location a - rob': 'Location A - ROB',
    'loc_a_rob': 'Location A - ROB',
    'loc a rob': 'Location A - ROB',
    'location a rob': 'Location A - ROB',
    // Location B variations
    'locationb': 'Location B',
    'location_b': 'Location B',
    'location b': 'Location B',
    'loc_b': 'Location B',
    'loc b': 'Location B',
    // Location B - ROB variations
    'locationb-rob': 'Location B - ROB',
    'location_b_rob': 'Location B - ROB',
    'location b - rob': 'Location B - ROB',
    'loc_b_rob': 'Location B - ROB',
    'loc b rob': 'Location B - ROB',
    'location b rob': 'Location B - ROB',
    // Min variations
    'min': 'Min',
    'minimum': 'Min',
    'min_stock': 'Min',
    'minimum_stock': 'Min',
    'min stock': 'Min',
    'minimum stock': 'Min',
    'minstock': 'Min',
    'minimumstock': 'Min'
  },
  spares: {
    'partcode': 'Part Code',
    'part_code': 'Part Code',
    'part code': 'Part Code',
    'componentcode': 'Component Code',
    'component_code': 'Component Code',
    'component code': 'Component Code',
    'componentname': 'Component Name',
    'component_name': 'Component Name',
    'component name': 'Component Name',
    'partname': 'Part Name',
    'part_name': 'Part Name',
    'part name': 'Part Name',
    'partnumber': 'Part Number',
    'part_number': 'Part Number',
    'part number': 'Part Number',
    'uom': 'UOM',
    'totalrob': 'Total ROB',
    'total_rob': 'Total ROB',
    'total rob': 'Total ROB'
  },
  components: {
    'componentcode': 'Component Code',
    'component_code': 'Component Code',
    'component code': 'Component Code',
    'componentname': 'Component Name',
    'component_name': 'Component Name',
    'component name': 'Component Name',
    'category': 'Category',
    'maingroupcode': 'Main Group Code',
    'main_group_code': 'Main Group Code',
    'main group code': 'Main Group Code'
  },
  jobs: {
    'componentcode': 'Component Code',
    'component_code': 'Component Code',
    'component code': 'Component Code',
    'jobcode': 'Job Code',
    'job_code': 'Job Code',
    'job code': 'Job Code',
    'jobtitle': 'Job Title',
    'job_title': 'Job Title',
    'job title': 'Job Title'
  }
};

/**
 * Normalize column names in data array to expected format
 */
function normalizeColumnNames(data: any[], type: string): any[] {
  const mappings = COLUMN_MAPPINGS[type];
  if (!mappings || data.length === 0) {
    return data;
  }

  // Get original column names from first row
  const originalColumns = Object.keys(data[0] || {});
  
  // Build a mapping from original column name to normalized name
  const columnMap: { [original: string]: string } = {};
  
  for (const col of originalColumns) {
    // Normalize the column name for lookup (lowercase, trim)
    const normalizedLookup = col.toLowerCase().trim();
    
    // Check if we have a mapping for this column
    if (mappings[normalizedLookup]) {
      columnMap[col] = mappings[normalizedLookup];
    } else {
      // Keep original if no mapping found
      columnMap[col] = col;
    }
  }

  // Transform all rows using the column mapping
  return data.map(row => {
    const normalizedRow: any = {};
    for (const [originalCol, value] of Object.entries(row)) {
      const normalizedCol = columnMap[originalCol] || originalCol;
      normalizedRow[normalizedCol] = value;
    }
    return normalizedRow;
  });
}

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

// Departments list for jobs/work orders
const DEPARTMENTS = ['Engine', 'Deck', 'Electrical'];

// Responsible ranks for work orders
const RESPONSIBLE_RANKS = [
  'Master', 'Chief Officer', '2nd Officer', '3rd Officer',
  'Chief Engineer', '2nd Engineer', '3rd Engineer', '4th Engineer',
  'Electrician', 'Bosun', 'Fitter'
];

// Schedule types
const SCHEDULE_TYPES = ['Running Hours', 'Calendar', 'Both'];

// Interval units for calendar-based schedules
const INTERVAL_UNITS = ['Days', 'Weeks', 'Months', 'Years'];

// =====================================================
// COMPREHENSIVE FLEET MASTER DATA TEMPLATE GENERATOR
// =====================================================

async function generateFleetMasterTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // =====================================================
  // SHEET 1: Master_Sheet (Instructions)
  // =====================================================
  const masterSheet = workbook.addWorksheet('Master_Sheet');
  masterSheet.columns = [
    { header: 'Section', key: 'section', width: 25 },
    { header: 'Instructions', key: 'instructions', width: 80 }
  ];
  
  const instructions = [
    ['Template Version', `Version ${TEMPLATE_VERSION} (${TEMPLATE_VERSION_DATE}) - Do not modify version info`],
    ['Overview', 'This workbook contains template sheets for importing Fleet Master Data and Vessel-specific data.'],
    ['Fleet vs Vessel', 'FLEET sheets define master templates applied at fleet level. VESSEL sheets contain vessel-specific instance data.'],
    ['Fleet Equipment Code', 'Links fleet and vessel data. Fleet_Component creates master equipment. Vessel_Component references via Fleet Equipment Code.'],
    ['Data Entry Order', '1. Maker List (optional) → 2. SFI Details (optional) → 3. Fleet_Component → 4. Fleet_Job → 5. Fleet_Spare'],
    ['Vessel Data Order', '1. Vessel_Component → 2. Vessel_Job → 3. Vessel_Spare → 4. Vessel_Stores'],
    ['Date Format', 'Use DD-MMM-YYYY format (e.g., 15-NOV-2024). System will convert automatically.'],
    ['Yes/No Fields', 'Use "Yes" or "No" (case-insensitive). Do not use TRUE/FALSE or 1/0.'],
    ['Required Fields', 'Fields marked as Required must have values. Empty required fields will cause validation errors.'],
    ['Parent Codes', 'Parent Fleet Equipment Code in Fleet_Component establishes hierarchy. Parent Component Code in Vessel_Component is separate.'],
    ['IS Parent Flag', 'Only Fleet_Component has IS Parent field. Vessel_Component does NOT have IS Parent field.'],
    ['Running Hours', 'Running Hours (RH) are only entered at vessel level. Fleet templates define job intervals only.'],
    ['Dual Frequency Jobs', 'Jobs can have BOTH Calendar AND Running Hours intervals. Fill Calendar Interval OR RH Interval OR BOTH.'],
    ['Spare Parts', 'Fleet_Spare defines master parts. Vessel_Spare has ROB by Location (Deck/Engine/Store1/Store2).'],
    ['Stores vs Spares', 'Vessel_Stores is for consumables (paint, chemicals). Spares are linked to equipment/components.'],
    ['IMPA Code', 'Vessel_Stores includes IMPA Code field for international maritime parts standardization.']
  ];
  
  masterSheet.getCell('C1').value = `${TEMPLATE_VERSION_CELL}${TEMPLATE_VERSION}`;
  masterSheet.getColumn('C').hidden = true;
  
  instructions.forEach(([section, text]) => {
    masterSheet.addRow({ section, instructions: text });
  });
  
  // Style the master sheet
  masterSheet.getRow(1).font = { bold: true };
  masterSheet.getColumn(1).font = { bold: true };
  
  // =====================================================
  // SHEET 2: Maker List
  // =====================================================
  const makerSheet = workbook.addWorksheet('Maker List');
  makerSheet.columns = [
    { header: 'Maker Code', key: 'makerCode', width: 15 },
    { header: 'Maker Name', key: 'makerName', width: 35 },
    { header: 'Address', key: 'address', width: 50 }
  ];
  
  // Headers only - no sample data
  makerSheet.getRow(1).font = { bold: true };
  
  // =====================================================
  // SHEET 3: SFI Details (2 columns)
  // =====================================================
  const sfiSheet = workbook.addWorksheet('SFI Details');
  sfiSheet.columns = [
    { header: 'Component Code', key: 'componentCode', width: 20 },
    { header: 'Component Name', key: 'componentName', width: 50 }
  ];
  
  // Headers only - no sample data
  sfiSheet.getRow(1).font = { bold: true };
  
  // =====================================================
  // SHEET 4: Fleet_Component (13 columns - EXACT HEADERS)
  // =====================================================
  const fleetComponentSheet = workbook.addWorksheet('Fleet_Component');
  fleetComponentSheet.columns = [
    { header: 'Fleet Equipment Code', key: 'fleetEquipmentCode', width: 20 },
    { header: 'Fleet Equipment Name', key: 'fleetEquipmentName', width: 35 },
    { header: 'Parent Fleet Equipment Code', key: 'parentFleetEquipmentCode', width: 25 },
    { header: 'SFI System', key: 'sfiSystem', width: 15 },
    { header: 'Criticality', key: 'criticality', width: 15 },
    { header: 'Condition Based', key: 'conditionBased', width: 20 },
    { header: 'Location', key: 'location', width: 20 },
    { header: 'Rating', key: 'rating', width: 20 },
    { header: 'Equipment / System Department', key: 'equipmentDepartment', width: 28 },
    { header: 'Notes', key: 'notes', width: 40 },
    { header: 'IS Parent', key: 'isParent', width: 15 },
    { header: 'IS Active', key: 'isActive', width: 12 },
    { header: 'Maker Code', key: 'makerCode', width: 15 }
  ];
  
  // Headers only - no sample data
  fleetComponentSheet.getRow(1).font = { bold: true };
  
  // =====================================================
  // SHEET 5: Vessel_Component (28 columns - EXACT HEADERS in specified order)
  // =====================================================
  const vesselComponentSheet = workbook.addWorksheet('Vessel_Component');
  vesselComponentSheet.columns = [
    { header: 'Fleet Equipment Code', key: 'fleetEquipmentCode', width: 20 },
    { header: 'Fleet Equipment Name', key: 'fleetEquipmentName', width: 30 },
    { header: 'Parent Component Code', key: 'parentComponentCode', width: 22 },
    { header: 'Component Code', key: 'componentCode', width: 18 },
    { header: 'Component Name', key: 'componentName', width: 35 },
    { header: 'Component Category', key: 'componentCategory', width: 35 },
    { header: 'Maker', key: 'maker', width: 25 },
    { header: 'Maker Code', key: 'makerCode', width: 15 },
    { header: 'Model', key: 'model', width: 20 },
    { header: 'Model Code', key: 'modelCode', width: 20 },
    { header: 'Serial No', key: 'serialNo', width: 20 },
    { header: 'Drawing No', key: 'drawingNo', width: 18 },
    { header: 'Location', key: 'location', width: 20 },
    { header: 'Criticality', key: 'criticality', width: 15 },
    { header: 'Condition Based', key: 'conditionBased', width: 20 },
    { header: 'Installation Date', key: 'installationDate', width: 18 },
    { header: 'Commissioned Date', key: 'commissionedDate', width: 18 },
    { header: 'Rating', key: 'rating', width: 20 },
    { header: 'Equipment / System Department', key: 'equipmentDepartment', width: 28 },
    { header: 'Class item', key: 'classItem', width: 12 },
    { header: 'IS Active', key: 'isActive', width: 12 },
    { header: 'Vessel Code', key: 'vesselCode', width: 12 },
    { header: 'IS Parent', key: 'isParent', width: 12 },
    { header: 'Notes', key: 'notes', width: 40 },
    { header: 'RH Counter Type', key: 'rhCounterType', width: 18 },
    { header: 'RH Counter Source', key: 'rhCounterSource', width: 18 },
    { header: 'Running Hours', key: 'runningHours', width: 15 },
    { header: 'Last Updated', key: 'lastUpdated', width: 18 }
  ];
  
  // Headers only - no sample data
  vesselComponentSheet.getRow(1).font = { bold: true };
  
  // =====================================================
  // SHEET 6: Fleet_Job (21 columns - EXACT HEADERS with dual frequency)
  // =====================================================
  const fleetJobSheet = workbook.addWorksheet('Fleet_Job');
  fleetJobSheet.columns = [
    { header: 'Fleet Equipment Code', key: 'fleetEquipmentCode', width: 20 },
    { header: 'Fleet Equipment Name', key: 'fleetEquipmentName', width: 30 },
    { header: 'Job Code', key: 'jobCode', width: 15 },
    { header: 'Job Title', key: 'jobTitle', width: 40 },
    { header: 'Job Description', key: 'jobDescription', width: 50 },
    { header: 'Department', key: 'department', width: 15 },
    { header: 'Responsible Rank', key: 'responsibleRank', width: 20 },
    { header: 'Schedule Type', key: 'scheduleType', width: 15 },
    { header: 'Calendar Interval', key: 'calendarInterval', width: 18 },
    { header: 'Interval Unit', key: 'intervalUnit', width: 15 },
    { header: 'RH Interval', key: 'rhInterval', width: 15 },
    { header: 'Critical Yes/No', key: 'critical', width: 15 },
    { header: 'Estimated Hours', key: 'estimatedHours', width: 15 },
    { header: 'Spare Parts Required', key: 'sparePartsRequired', width: 30 },
    { header: 'Safety Procedure', key: 'safetyProcedure', width: 25 },
    { header: 'Checklist', key: 'checklist', width: 40 },
    { header: 'Reference Documents', key: 'referenceDocuments', width: 30 },
    { header: 'Tools Required', key: 'toolsRequired', width: 30 },
    { header: 'IS Active', key: 'isActive', width: 12 },
    { header: 'Maker Code', key: 'makerCode', width: 15 },
    { header: 'Class Survey Code', key: 'classSurveyCode', width: 18 }
  ];
  
  // Headers only - no sample data
  fleetJobSheet.getRow(1).font = { bold: true };
  
  // =====================================================
  // SHEET 7: Vessel_Job (21 columns - EXACT HEADERS)
  // =====================================================
  const vesselJobSheet = workbook.addWorksheet('Vessel_Job');
  vesselJobSheet.columns = [
    { header: 'Fleet Equipment Code', key: 'fleetEquipmentCode', width: 20 },
    { header: 'Component Code', key: 'componentCode', width: 18 },
    { header: 'Component Name', key: 'componentName', width: 30 },
    { header: 'Job Code', key: 'jobCode', width: 15 },
    { header: 'Job Title', key: 'jobTitle', width: 40 },
    { header: 'Job Description', key: 'jobDescription', width: 50 },
    { header: 'Department', key: 'department', width: 15 },
    { header: 'Responsible Rank', key: 'responsibleRank', width: 20 },
    { header: 'Schedule Type', key: 'scheduleType', width: 15 },
    { header: 'Calendar Interval', key: 'calendarInterval', width: 18 },
    { header: 'Interval Unit', key: 'intervalUnit', width: 15 },
    { header: 'RH Interval', key: 'rhInterval', width: 15 },
    { header: 'Last Done Date', key: 'lastDoneDate', width: 15 },
    { header: 'Last Done RH', key: 'lastDoneRH', width: 15 },
    { header: 'Critical Yes/No', key: 'critical', width: 15 },
    { header: 'Estimated Hours', key: 'estimatedHours', width: 15 },
    { header: 'Spare Parts Required', key: 'sparePartsRequired', width: 30 },
    { header: 'IS Active', key: 'isActive', width: 12 },
    { header: 'Vessel Code', key: 'vesselCode', width: 12 },
    { header: 'Maker Code', key: 'makerCode', width: 15 },
    { header: 'Class Survey Code', key: 'classSurveyCode', width: 18 }
  ];
  
  // Headers only - no sample data
  vesselJobSheet.getRow(1).font = { bold: true };
  
  // =====================================================
  // SHEET 8: Fleet_Spare (19 columns - EXACT HEADERS)
  // =====================================================
  const fleetSpareSheet = workbook.addWorksheet('Fleet_Spare');
  fleetSpareSheet.columns = [
    { header: 'Fleet Equipment Code', key: 'fleetEquipmentCode', width: 20 },
    { header: 'Fleet Equipment Name', key: 'fleetEquipmentName', width: 30 },
    { header: 'Part Code', key: 'partCode', width: 18 },
    { header: 'Part Name', key: 'partName', width: 35 },
    { header: 'Part Number', key: 'partNumber', width: 20 },
    { header: 'Maker', key: 'maker', width: 25 },
    { header: 'Maker Code', key: 'makerCode', width: 15 },
    { header: 'Unit Of Measurement', key: 'uom', width: 20 },
    { header: 'Stocking Number', key: 'stockingNumber', width: 18 },
    { header: 'Specification', key: 'specification', width: 40 },
    { header: 'Drawing No', key: 'drawingNo', width: 18 },
    { header: 'Min Stock', key: 'minStock', width: 12 },
    { header: 'Max Stock', key: 'maxStock', width: 12 },
    { header: 'Unit Cost', key: 'unitCost', width: 12 },
    { header: 'Lead Time Days', key: 'leadTimeDays', width: 15 },
    { header: 'Supplier', key: 'supplier', width: 30 },
    { header: 'Critical Yes/No', key: 'critical', width: 15 },
    { header: 'IS Active', key: 'isActive', width: 12 },
    { header: 'Remarks', key: 'remarks', width: 40 }
  ];
  
  // Headers only - no sample data
  fleetSpareSheet.getRow(1).font = { bold: true };
  
  // =====================================================
  // SHEET 9: Vessel_Spare (27 columns - EXACT HEADERS per specification)
  // Uses shared definition from sparesTemplateFields.ts to ensure consistency
  // =====================================================
  const vesselSpareSheet = workbook.addWorksheet('Vessel_Spare');
  vesselSpareSheet.columns = getSparesExcelColumns();
  
  // Headers only - no sample data
  vesselSpareSheet.getRow(1).font = { bold: true };
  
  // =====================================================
  // SHEET 10: Vessel_Store (11 columns - per user specification)
  // =====================================================
  const vesselStoresSheet = workbook.addWorksheet('Vessel_Store');
  vesselStoresSheet.columns = [
    { header: 'Item Code', key: 'itemCode', width: 15 },
    { header: 'IMPA Code', key: 'impaCode', width: 15 },
    { header: 'Item Name', key: 'itemName', width: 35 },
    { header: 'UOM', key: 'uom', width: 12 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Total ROB', key: 'totalRob', width: 12 },
    { header: 'Location A', key: 'locationA', width: 15 },
    { header: 'Location A - ROB', key: 'locationARob', width: 16 },
    { header: 'Location B', key: 'locationB', width: 15 },
    { header: 'Location B - ROB', key: 'locationBRob', width: 16 },
    { header: 'Min', key: 'min', width: 10 }
  ];
  
  // Headers only - no sample data
  vesselStoresSheet.getRow(1).font = { bold: true };
  
  // =====================================================
  // SHEET 11: Master Data (dropdown reference values)
  // =====================================================
  const masterDataSheet = workbook.addWorksheet('Master Data');
  masterDataSheet.columns = [
    { header: 'Departments', key: 'departments', width: 18 },
    { header: 'Responsible Ranks', key: 'ranks', width: 20 },
    { header: 'Schedule Types', key: 'scheduleTypes', width: 18 },
    { header: 'Interval Units', key: 'intervalUnits', width: 15 },
    { header: 'UOM', key: 'uom', width: 12 },
    { header: 'Store Types', key: 'storeTypes', width: 15 },
    { header: 'Yes/No', key: 'yesNo', width: 10 },
    { header: 'Categories', key: 'categories', width: 40 }
  ];
  
  // Add dropdown values - max rows needed
  const maxRows = Math.max(
    DEPARTMENTS.length,
    RESPONSIBLE_RANKS.length,
    SCHEDULE_TYPES.length,
    INTERVAL_UNITS.length,
    UOM_LIST.length,
    4, // Store types
    2, // Yes/No
    COMPONENT_CATEGORIES.length
  );
  
  for (let i = 0; i < maxRows; i++) {
    masterDataSheet.addRow({
      departments: DEPARTMENTS[i] || '',
      ranks: RESPONSIBLE_RANKS[i] || '',
      scheduleTypes: SCHEDULE_TYPES[i] || '',
      intervalUnits: INTERVAL_UNITS[i] || '',
      uom: UOM_LIST[i]?.toUpperCase() || '',
      storeTypes: ['Stores', 'Lubes', 'Chemicals', 'Others'][i] || '',
      yesNo: ['Yes', 'No'][i] || '',
      categories: COMPONENT_CATEGORIES[i] || ''
    });
  }
  
  masterDataSheet.getRow(1).font = { bold: true };
  
  // =====================================================
  // Add Data Validations to sheets
  // =====================================================
  
  // Fleet_Component validations
  for (let row = 2; row <= 1000; row++) {
    // Critical Yes/No (col 5)
    fleetComponentSheet.getCell(row, 5).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    // Condition Based Yes/No (col 6)
    fleetComponentSheet.getCell(row, 6).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    // Department (col 9)
    fleetComponentSheet.getCell(row, 9).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$A$2:$A$4"]
    };
    // IS Parent Yes/No (col 11)
    fleetComponentSheet.getCell(row, 11).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    // IS Active (col 12)
    fleetComponentSheet.getCell(row, 12).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
  }
  
  // Vessel_Component validations
  for (let row = 2; row <= 1000; row++) {
    // Critical Yes/No (col 14)
    vesselComponentSheet.getCell(row, 14).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    // Condition Based Yes/No (col 15)
    vesselComponentSheet.getCell(row, 15).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    // Department (col 19)
    vesselComponentSheet.getCell(row, 19).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$A$2:$A$4"]
    };
    // IS Active (col 22)
    vesselComponentSheet.getCell(row, 22).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
  }
  
  // Fleet_Job validations
  for (let row = 2; row <= 1000; row++) {
    // Department (col 6)
    fleetJobSheet.getCell(row, 6).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$A$2:$A$4"]
    };
    // Responsible Rank (col 7)
    fleetJobSheet.getCell(row, 7).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$B$2:$B$12"]
    };
    // Schedule Type (col 8)
    fleetJobSheet.getCell(row, 8).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$C$2:$C$4"]
    };
    // Interval Unit (col 10)
    fleetJobSheet.getCell(row, 10).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$D$2:$D$5"]
    };
    // Critical Yes/No (col 12)
    fleetJobSheet.getCell(row, 12).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    // IS Active (col 19)
    fleetJobSheet.getCell(row, 19).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
  }
  
  // Vessel_Job validations
  for (let row = 2; row <= 1000; row++) {
    // Department (col 7)
    vesselJobSheet.getCell(row, 7).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$A$2:$A$4"]
    };
    // Responsible Rank (col 8)
    vesselJobSheet.getCell(row, 8).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$B$2:$B$12"]
    };
    // Schedule Type (col 9)
    vesselJobSheet.getCell(row, 9).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$C$2:$C$4"]
    };
    // Interval Unit (col 11)
    vesselJobSheet.getCell(row, 11).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$D$2:$D$5"]
    };
    // Critical Yes/No (col 15)
    vesselJobSheet.getCell(row, 15).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    // IS Active (col 18)
    vesselJobSheet.getCell(row, 18).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
  }
  
  // Fleet_Spare validations
  for (let row = 2; row <= 1000; row++) {
    // UOM (col 8)
    fleetSpareSheet.getCell(row, 8).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$E$2:$E$11"]
    };
    // Critical Yes/No (col 17)
    fleetSpareSheet.getCell(row, 17).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    // IS Active (col 18)
    fleetSpareSheet.getCell(row, 18).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
  }
  
  // Vessel_Spare validations
  for (let row = 2; row <= 1000; row++) {
    // UOM (col 10)
    vesselSpareSheet.getCell(row, 10).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$E$2:$E$11"]
    };
    // Critical Yes/No (col 24)
    vesselSpareSheet.getCell(row, 24).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
    // IS Active (col 25)
    vesselSpareSheet.getCell(row, 25).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$G$2:$G$3"]
    };
  }
  
  // Vessel_Stores validations
  for (let row = 2; row <= 1000; row++) {
    // Type (col 4)
    vesselStoresSheet.getCell(row, 4).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$F$2:$F$5"]
    };
    // Stores Category (col 5)
    vesselStoresSheet.getCell(row, 5).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$H$2:$H$6"]
    };
    // UOM (col 6)
    vesselStoresSheet.getCell(row, 6).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Master Data'!$E$2:$E$11"]
    };
  }
  
  // Write to buffer and return
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Helper function to generate work-orders template using ExcelJS (supports data validations)
async function generateWorkOrdersTemplate(vesselId: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // Fetch all components from the system for this vessel
  const allComponents = await storage.getComponents(vesselId);
  console.log(`📋 Fetched ${allComponents.length} components for vessel ${vesselId}`);
  
  // Filter out components without valid codes
  const validComponents = allComponents.filter(c => c.componentCode && c.componentCode.trim() !== '');
  console.log(`✅ ${validComponents.length} components have valid codes`);
  
  // Filter to include only leaf nodes (actual equipment, not parent categories)
  // Strategy: Build a Set of all codes that appear as prefixes of other codes
  // A component is a parent if its code (without suffix) is a prefix of another component's code
  const allCodes = validComponents.map(c => c.componentCode as string);
  const parentCodes = new Set<string>();
  
  allCodes.forEach(code1 => {
    const cleanCode1 = stripSFISuffix(code1);
    
    allCodes.forEach(code2 => {
      if (code1 === code2) return; // Skip self
      
      const cleanCode2 = stripSFISuffix(code2);
      
      // Check if code1 is a parent of code2
      // Examples:
      // - "220" is parent of "220.001" 
      // - "71" is parent of "711"
      // - "711" is parent of "711.003"
      
      // Method 1: code2 starts with code1 followed by a dot
      if (cleanCode2.startsWith(cleanCode1 + '.')) {
        parentCodes.add(code1);
        return;
      }
      
      // Method 2: code2 starts with code1 and has more digits (no dot needed)
      // E.g., "71" is parent of "711", "220" is parent of "2201"
      if (cleanCode2.startsWith(cleanCode1) && cleanCode2.length > cleanCode1.length && !cleanCode1.includes('.')) {
        parentCodes.add(code1);
        return;
      }
    });
  });
  
  // Only include components that are NOT in the parent set (i.e., leaf nodes)
  const leafComponents = validComponents.filter(c => !parentCodes.has(c.componentCode as string));
  console.log(`🌿 Filtered to ${leafComponents.length} leaf node components (actual equipment)`);
  console.log(`🚫 Excluded ${validComponents.length - leafComponents.length} parent components from template`);
  
  if (parentCodes.size > 0) {
    console.log(`   Parent codes excluded: ${Array.from(parentCodes).sort().join(', ')}`);
  }
  
  // Create main "wo" sheet
  const woSheet = workbook.addWorksheet('wo');
  
  // Add headers
  woSheet.columns = [
    { header: 'Generated_Component_Code', key: 'componentCode', width: 25 },
    { header: 'Component_Name', key: 'componentName', width: 30 },
    { header: 'Job_Code', key: 'jobCode', width: 15 },
    { header: 'Job_Title', key: 'jobTitle', width: 35 },
    { header: 'Job_Description', key: 'jobDescription', width: 50 },
    { header: 'Department', key: 'department', width: 15 },
    { header: 'Responsible_Rank', key: 'responsibleRank', width: 20 },
    { header: 'Schedule_Type', key: 'scheduleType', width: 18 },
    { header: 'Interval', key: 'interval', width: 12 },
    { header: 'Interval_Unit', key: 'intervalUnit', width: 15 },
    { header: 'Criticality', key: 'criticality', width: 12 },
    { header: 'Estimated_Hours', key: 'estimatedHours', width: 18 },
    { header: 'Spares_Required', key: 'sparesRequired', width: 35 },
    { header: 'Safety_Permit_Required', key: 'safetyPermit', width: 30 }
  ];
  
  // Pre-populate only leaf node components in the template
  leafComponents.forEach(component => {
    woSheet.addRow({
      componentCode: component.componentCode,
      componentName: component.name,
      jobCode: '',
      jobTitle: '',
      jobDescription: '',
      department: '',
      responsibleRank: '',
      scheduleType: '',
      interval: '',
      intervalUnit: '',
      criticality: '',
      estimatedHours: '',
      sparesRequired: '',
      safetyPermit: ''
    });
  });
  
  console.log(`📝 Pre-populated ${leafComponents.length} leaf node components in template`);
  
  // Create "Lists" sheet
  const listsSheet = workbook.addWorksheet('Lists');
  listsSheet.columns = [
    { header: 'Schedule_Type', key: 'scheduleType', width: 18 },
    { header: 'Interval_Unit', key: 'intervalUnit', width: 15 },
    { header: 'Department', key: 'department', width: 15 },
    { header: 'Responsible_Rank', key: 'responsibleRank', width: 20 },
    { header: 'Safety_Permit', key: 'safetyPermit', width: 25 },
    { header: 'Criticality', key: 'criticality', width: 12 }
  ];
  
  // Add dropdown values
  const listValues = [
    { scheduleType: 'Running Hours', intervalUnit: 'Hours', department: 'Engine', responsibleRank: 'Chief Engineer', safetyPermit: 'Hot Work', criticality: 'yes' },
    { scheduleType: 'Calendar', intervalUnit: 'Days', department: 'Deck', responsibleRank: '2nd Engineer', safetyPermit: 'Enclosed Space Entry', criticality: 'no' },
    { scheduleType: '', intervalUnit: 'Weeks', department: 'Electrical', responsibleRank: '3rd Engineer', safetyPermit: 'Lockout-Tagout', criticality: '' },
    { scheduleType: '', intervalUnit: 'Months', department: '', responsibleRank: '4th Engineer', safetyPermit: 'Working Aloft', criticality: '' },
    { scheduleType: '', intervalUnit: 'Years', department: '', responsibleRank: 'Chief Officer', safetyPermit: '', criticality: '' },
    { scheduleType: '', intervalUnit: '', department: '', responsibleRank: 'Electrician', safetyPermit: '', criticality: '' }
  ];
  
  listValues.forEach(row => listsSheet.addRow(row));
  
  // Add data validations to wo sheet
  // Column F (Department) - row 2 onwards
  woSheet.getColumn(6).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$C$2:$C$4']
      };
    }
  });
  
  // Column G (Responsible_Rank)
  woSheet.getColumn(7).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$D$2:$D$7']
      };
    }
  });
  
  // Column H (Schedule_Type)
  woSheet.getColumn(8).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$A$2:$A$3']
      };
    }
  });
  
  // Column J (Interval_Unit)
  woSheet.getColumn(10).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$B$2:$B$6']
      };
    }
  });
  
  // Column K (Criticality)
  woSheet.getColumn(11).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$F$2:$F$3']
      };
    }
  });
  
  // Column N (Safety_Permit_Required)
  woSheet.getColumn(14).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$E$2:$E$5']
      };
    }
  });
  
  addVersionInfoToSheet(woSheet);
  
  // Write to buffer and return
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Helper function to generate jobs template using ExcelJS (supports data validations)
async function generateJobsTemplate(vesselId: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // Fetch all components from the system for this vessel
  const allComponents = await storage.getComponents(vesselId);
  console.log(`📋 Fetched ${allComponents.length} components for vessel ${vesselId}`);
  
  // Filter out components without valid codes
  const validComponents = allComponents.filter(c => c.componentCode && c.componentCode.trim() !== '');
  console.log(`✅ ${validComponents.length} components have valid codes`);
  
  // Sort components by component code for hierarchical display
  const sortedComponents = [...validComponents].sort((a, b) => {
    const codeA = a.componentCode || '';
    const codeB = b.componentCode || '';
    return codeA.localeCompare(codeB, undefined, { numeric: true });
  });
  console.log(`📊 Including all ${sortedComponents.length} components (all levels) in jobs template`);
  
  // Create main "jobs" sheet with 26-column structure (includes Part A fields)
  const jobsSheet = workbook.addWorksheet('Vessel_Job');
  
  // Add headers matching the 25-column specification (20 original + 5 Part A fields)
  // NOTE: "Interval Running Hours" column removed - when Unit = "Hours", Interval Value is used as the running hours interval
  jobsSheet.columns = [
    { header: 'Job Code', key: 'jobCode', width: 18 },
    { header: 'Fleet Equipment Code', key: 'fleetEquipmentCode', width: 22 },
    { header: 'Fleet Equipment Name', key: 'fleetEquipmentName', width: 30 },
    { header: 'WO Title', key: 'woTitle', width: 35 },
    { header: 'Component Code', key: 'componentCode', width: 20 },
    { header: 'Component Name', key: 'componentName', width: 30 },
    { header: 'Maintenance Basis', key: 'maintenanceBasis', width: 18 },
    { header: 'Interval Value', key: 'intervalValue', width: 15 },
    { header: 'Unit', key: 'unit', width: 12 },
    { header: 'Task Type', key: 'taskType', width: 20 },
    { header: 'Assigned To', key: 'assignedTo', width: 20 },
    { header: 'Approver', key: 'approver', width: 20 },
    { header: 'Job Priority', key: 'jobPriority', width: 15 },
    { header: 'Class Related', key: 'classRelated', width: 15 },
    { header: 'Last Done Date', key: 'lastDoneDate', width: 15 },
    { header: 'Brief Work Description', key: 'briefWorkDescription', width: 50 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Criticality', key: 'criticality', width: 15 },
    { header: 'Is Active', key: 'isActive', width: 12 },
    { header: 'Vessel Code', key: 'vesselCode', width: 15 },
    // Part A fields - Work Order Form fields (semicolon-separated lists)
    { header: 'Required Spare Parts', key: 'requiredSpareParts', width: 40 },
    { header: 'Required Tools', key: 'requiredTools', width: 40 },
    { header: 'PPE Requirements', key: 'ppeRequirements', width: 35 },
    { header: 'Permit Requirements', key: 'permitRequirements', width: 35 },
    { header: 'Other Safety Requirements', key: 'otherSafetyRequirements', width: 35 }
  ];
  
  // Pre-populate ALL components (all levels) in the template - sorted by code for hierarchical display
  sortedComponents.forEach(component => {
    jobsSheet.addRow({
      jobCode: '',
      fleetEquipmentCode: component.fleetEquipmentCode || '',
      fleetEquipmentName: '',
      woTitle: '',
      componentCode: component.componentCode,
      componentName: component.name,
      maintenanceBasis: '',
      intervalValue: '',
      unit: '',
      taskType: '',
      assignedTo: '',
      approver: '',
      jobPriority: '',
      classRelated: '',
      lastDoneDate: '',
      briefWorkDescription: '',
      department: '',
      criticality: '',
      isActive: 'Yes',
      vesselCode: vesselId,
      // Part A fields - empty by default, users fill with semicolon-separated lists
      requiredSpareParts: '',
      requiredTools: '',
      ppeRequirements: '',
      permitRequirements: '',
      otherSafetyRequirements: ''
    });
  });
  
  console.log(`📝 Pre-populated ${sortedComponents.length} components (all levels) in jobs template`);
  
  // Create "Lists" sheet for dropdown values
  const listsSheet = workbook.addWorksheet('Lists');
  listsSheet.columns = [
    { header: 'Maintenance_Basis', key: 'maintenanceBasis', width: 18 },
    { header: 'Interval_Unit', key: 'intervalUnit', width: 15 },
    { header: 'Task_Type', key: 'taskType', width: 20 },
    { header: 'Job_Priority', key: 'jobPriority', width: 12 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Yes_No', key: 'yesNo', width: 10 }
  ];
  
  // Add dropdown values (Only Calendar and Running Hours - interval is REQUIRED for PMS)
  const listValues = [
    { maintenanceBasis: 'Calendar', intervalUnit: 'Days', taskType: 'Inspection', jobPriority: 'Low', department: 'Engine', yesNo: 'Yes' },
    { maintenanceBasis: 'Running Hours', intervalUnit: 'Weeks', taskType: 'Overhaul', jobPriority: 'Medium', department: 'Deck', yesNo: 'No' },
    { maintenanceBasis: '', intervalUnit: 'Months', taskType: 'Service', jobPriority: 'High', department: 'Electrical', yesNo: '' },
    { maintenanceBasis: '', intervalUnit: 'Years', taskType: 'Testing', jobPriority: 'Critical', department: 'C/E', yesNo: '' },
    { maintenanceBasis: '', intervalUnit: 'Hours', taskType: 'Repair', jobPriority: '', department: '2/E', yesNo: '' },
    { maintenanceBasis: '', intervalUnit: '', taskType: 'Replacement', jobPriority: '', department: '3/E', yesNo: '' },
    { maintenanceBasis: '', intervalUnit: '', taskType: 'Cleaning', jobPriority: '', department: '4/E', yesNo: '' },
    { maintenanceBasis: '', intervalUnit: '', taskType: 'Calibration', jobPriority: '', department: 'ETO', yesNo: '' }
  ];
  
  listValues.forEach(row => listsSheet.addRow(row));
  
  // Add data validations to jobs sheet (20-column layout, removed Interval Running Hours)
  // Column G (Maintenance Basis) - row 2 onwards (Only Calendar and Running Hours allowed)
  jobsSheet.getColumn(7).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$A$2:$A$3']  // Only Calendar and Running Hours
      };
    }
  });
  
  // Column I (Unit - was J before removing Interval Running Hours column)
  jobsSheet.getColumn(9).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$B$2:$B$6']
      };
    }
  });
  
  // Column J (Task Type - was K before)
  jobsSheet.getColumn(10).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$C$2:$C$9']
      };
    }
  });
  
  // Column M (Job Priority - was N before)
  jobsSheet.getColumn(13).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$D$2:$D$5']
      };
    }
  });
  
  // Column N (Class Related - was O before) - Yes/No
  jobsSheet.getColumn(14).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$F$2:$F$3']
      };
    }
  });
  
  // Column Q (Department - was R before)
  jobsSheet.getColumn(17).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$E$2:$E$9']
      };
    }
  });
  
  // Column R (Criticality - was S before) - Yes/No
  jobsSheet.getColumn(18).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$F$2:$F$3']
      };
    }
  });
  
  // Column S (Is Active - was T before) - Yes/No
  jobsSheet.getColumn(19).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$F$2:$F$3']
      };
    }
  });
  
  addVersionInfoToSheet(jobsSheet);
  
  // Write to buffer and return
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Helper function to generate spares template using ExcelJS with prepopulated components
// Uses the exact 27-column Vessel_Spare specification
async function generateSparesTemplate(vesselId: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // Fetch all components from the system for this vessel
  const allComponents = await storage.getComponents(vesselId);
  console.log(`📋 Fetched ${allComponents.length} components for vessel ${vesselId}`);
  
  // Filter out components without valid codes
  const validComponents = allComponents.filter(c => c.componentCode && c.componentCode.trim() !== '' && c.name && c.name.trim() !== '');
  console.log(`✅ ${validComponents.length} components have valid codes and names`);
  
  // Create main "Spares" sheet with exact 27-column Vessel_Spare specification
  const sparesSheet = workbook.addWorksheet('Spares');
  
  // Add headers - 27 columns matching Vessel_Spare specification exactly
  // Uses shared definition from sparesTemplateFields.ts to ensure consistency
  sparesSheet.columns = getSparesExcelColumns();
  
  // Style header row
  sparesSheet.getRow(1).font = { bold: true };
  
  // Pre-fill the Spares sheet with component data - one row per component
  // User just needs to fill in Part Code, Part Name, and other part-specific details
  validComponents.forEach((component, index) => {
    sparesSheet.addRow({
      partCode: '',  // User fills this
      fleetEquipmentCode: component.fleetEquipmentCode || '',
      fleetEquipmentName: component.fleetEquipmentName || '',
      componentCode: component.componentCode,
      componentName: component.name,
      partName: '',  // User fills this
      partNumber: '',  // User fills this
      uom: '',  // User selects from dropdown
      drawingNumber: '',
      positionNumber: '',
      note: '',
      specification: '',
      maker: component.maker || '',
      makerCode: component.makerCode || '',
      manualName: '',
      pageNumber: '',
      criticality: '',  // User selects from dropdown
      totalRob: '',
      locationA: '',
      locationARob: '',
      locationB: '',
      locationBRob: '',
      minimumStock: '',
      isActive: 'Yes',  // Default to Yes
      ihm: 'No',  // Default to No
      evidenceType: '',
      vesselCode: vesselId
    });
  });
  
  console.log(`📝 Pre-filled ${validComponents.length} component rows in spares template`);
  
  // Create "Components" reference sheet with pre-filled component data
  const componentsSheet = workbook.addWorksheet('Components');
  componentsSheet.columns = [
    { header: 'Component Code', key: 'componentCode', width: 20 },
    { header: 'Component Name', key: 'componentName', width: 40 },
    { header: 'Category', key: 'category', width: 35 },
    { header: 'Fleet Equipment Code', key: 'fleetEquipmentCode', width: 20 },
    { header: 'Fleet Equipment Name', key: 'fleetEquipmentName', width: 30 }
  ];
  
  // Style header row
  componentsSheet.getRow(1).font = { bold: true };
  
  // Add all valid components to reference sheet - USER CAN COPY FROM HERE
  validComponents.forEach(component => {
    componentsSheet.addRow({
      componentCode: component.componentCode,
      componentName: component.name,
      category: component.category || '',
      fleetEquipmentCode: component.fleetEquipmentCode || '',
      fleetEquipmentName: component.fleetEquipmentName || ''
    });
  });
  
  console.log(`📋 Added ${validComponents.length} components to reference sheet`);
  
  // Create "Lists" sheet for dropdown values
  const listsSheet = workbook.addWorksheet('Lists');
  listsSheet.columns = [
    { header: 'UOM', key: 'uom', width: 15 },
    { header: 'Yes/No', key: 'yesNo', width: 15 }
  ];
  
  // Add UOM values
  UOM_LIST.forEach((uom, index) => {
    listsSheet.getCell(index + 2, 1).value = uom.toUpperCase();
  });
  
  // Add Yes/No values
  listsSheet.getCell('B2').value = 'Yes';
  listsSheet.getCell('B3').value = 'No';
  
  // Style header row
  listsSheet.getRow(1).font = { bold: true };
  
  // Add data validations to Spares sheet for 1000 rows
  for (let row = 2; row <= 1000; row++) {
    // Column H (UOM) - Column 8
    sparesSheet.getCell(row, 8).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['=Lists!$A$2:$A$11']
    };
    
    // Column Q (Criticality) - Column 17
    sparesSheet.getCell(row, 17).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['=Lists!$B$2:$B$3']
    };
    
    // Column X (Is Active) - Column 24
    sparesSheet.getCell(row, 24).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['=Lists!$B$2:$B$3']
    };
    
    // Column Y (IHM) - Column 25
    sparesSheet.getCell(row, 25).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['=Lists!$B$2:$B$3']
    };
  }
  
  addVersionInfoToSheet(sparesSheet);
  
  // Write to buffer and return
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Generate template based on type
router.get('/template', async (req, res) => {
  const { type, vesselId } = req.query;
  
  // Handle fleet-master-data as special case with multi-sheet Excel template
  if (type === 'fleet-master-data') {
    try {
      console.log('📋 Generating Fleet Master Data template (multi-sheet)...');
      const buffer = await generateFleetMasterTemplate();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=Fleet_Master_Data_Template.xlsx');
      console.log('✅ Fleet Master Data template generated successfully');
      return res.send(buffer);
    } catch (error) {
      console.error('❌ Error generating fleet master data template:', error);
      return res.status(500).json({ error: 'Failed to generate template' });
    }
  }
  
  if (!['components', 'spares', 'stores', 'work-orders', 'jobs'].includes(type as string)) {
    return res.status(400).json({ error: 'Invalid template type. Valid types: components, spares, stores, work-orders, jobs, fleet-master-data' });
  }
  
  // Default to V001 if no vesselId provided
  const defaultVesselId = (vesselId as string) || 'V001';

  const workbook = XLSX.utils.book_new();
  let headers: string[] = [];
  let validValues: string[] = [];
  let example: any[] = [];

  switch (type) {
    case 'components':
      headers = [
        // Vessel Component Sheet - 28 columns (exact order per user specification)
        'Fleet Equipment Code', 'Fleet Equipment Name', 'Parent Component Code',
        'Component Code', 'Component Name', 'Component Category',
        'Maker', 'Maker Code', 'Model', 'Model Code', 'Serial No', 'Drawing No',
        'Location', 'Criticality', 'Condition Based',
        'Installation Date', 'Commissioned Date', 'Rating',
        'Equipment / System Department', 'Class item', 'IS Active',
        'Vessel Code', 'IS Parent', 'Notes',
        'RH Counter Type', 'RH Counter Source', 'Running Hours', 'Last Updated'
      ];

      validValues = [
        'Text (XXX.XXX.XX format)', 'Text (Equipment description)', 'Text (Parent SFI code)',
        'Required (SFI Format XXX.XXX)', 'Required (Equipment name)', 'Text (SFI category name)',
        'Text (Manufacturer name)', 'Text (Maker ID from Maker List)', 'Text (Model name)', 'Text (Model code)', 'Text (Serial number)', 'Text (Drawing reference)',
        'Text (Physical location)', 'Yes/No', 'Yes/No',
        'DD-MMM-YYYY', 'DD-MMM-YYYY', 'Text (Capacity/specification)',
        'Engine/Deck/Electrical', 'Yes/No', 'Yes/No',
        'Text (e.g., V001)', 'Yes/No', 'Text (Additional notes)',
        'MASTER/INHERITED/NOT_RH_DRIVEN', 'Text (RH source)', 'Number >= 0', 'Text (Timestamp)'
      ];

      example = [];
      break;

    case 'spares':
      headers = [
        // Vessel_Spare - 27 columns (per specification)
        'Part Code', 'Fleet Equipment Code', 'Fleet Equipment Name', 'Component Code', 'Component Name',
        'Part Name', 'Part Number', 'UOM', 'Drawing Number', 'Position Number',
        'Note', 'Specification', 'Maker', 'Maker Code', 'Manual Name', 'Page Number',
        'Criticality', 'Total ROB', 'Location A', 'Location A - ROB',
        'Location B', 'Location B - ROB', 'Minimum Stock', 'Is Active',
        'IHM (Inventory of Hazardous Materials)', 'Evidence Type', 'Vessel Code'
      ];

      validValues = [
        'Text (Part ID)', 'Text (Fleet ID)', 'Text (Fleet description)', 'Required (Must exist)', 'Text (Component name)',
        'Required (Part name)', 'Text (P/N)', UOM_LIST.join('/').toUpperCase(), 'Text (Drawing ref)', 'Text (Position)',
        'Text (Notes)', 'Text (Specs)', 'Text (Manufacturer)', 'Text (Maker ID)', 'Text (Manual name)', 'Text (Page #)',
        'Yes/No', 'Number >= 0', 'Text (Location A)', 'Number >= 0',
        'Text (Location B)', 'Number >= 0', 'Number >= 0', 'Yes/No',
        'Yes/No', 'Text (Evidence type)', 'Text (e.g., V001)'
      ];

      example = [];
      break;

    case 'stores':
      headers = [
        // Vessel_Store - 11 columns (per user specification)
        'Item Code', 'IMPA Code', 'Item Name', 'UOM', 'Category',
        'Total ROB', 'Location A', 'Location A - ROB',
        'Location B', 'Location B - ROB', 'Min'
      ];

      validValues = [
        'Required (Unique per vessel)', 'Text (IMPA standard code)', 'Required (Item description)', 
        UOM_LIST.join('/').toUpperCase(), STORES_CATEGORIES.join('/'),
        'Number >= 0', 'Text (Location A)', 'Number >= 0',
        'Text (Location B)', 'Number >= 0', 'Number >= 0'
      ];

      example = [];
      break;

    case 'work-orders':
      headers = [
        // Work Orders / Jobs template
        'Component Code', 'Component Name', 'Job Code', 'Job Title', 
        'Job Description', 'Department', 'Responsible Rank', 'Schedule Type',
        'Calendar Interval', 'Interval Unit', 'RH Interval', 'Critical Yes/No',
        'Estimated Hours', 'Spare Parts Required', 'Safety Procedure'
      ];

      validValues = [
        'Required (SFI Format)', 'Text (Component name)', 'Required (Job ID)', 'Required (Job title)',
        'Text (Task description)', 'Engine/Deck/Electrical', RESPONSIBLE_RANKS.join('/'),
        'Running Hours/Calendar/Both', 'Number (for Calendar)', 'Days/Weeks/Months/Years', 'Number (for RH)',
        'Yes/No', 'Number (hours)', 'Text (Parts list)', 'Hot Work/Enclosed Space Entry/Lockout-Tagout/Working Aloft'
      ];

      example = [];
      break;
  }

  // Create main sheet - Headers only, NO sample data row
  const mainSheet = XLSX.utils.aoa_to_sheet([headers]);

  // Add data validation for components (28-column format)
  // Columns: N=Criticality, O=Condition Based, T=Class item, U=IS Active, W=IS Parent, Y=RH Counter Type
  if (type === 'components') {
    if (!mainSheet['!dataValidation']) {
      mainSheet['!dataValidation'] = [];
    }

    // Column N: Criticality (Yes/No) - row 2 onwards
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

    // Column O: Condition Based (Yes/No) - row 2 onwards
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

    // Column T: Class item (Yes/No) - row 2 onwards
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'T2:T1000',
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Value',
      error: 'Please select Yes or No'
    });

    // Column U: IS Active (Yes/No) - row 2 onwards
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'U2:U1000',
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Value',
      error: 'Please select Yes or No'
    });

    // Column W: IS Parent (Yes/No) - row 2 onwards
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'W2:W1000',
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Value',
      error: 'Please select Yes or No'
    });

    // Column Y: RH Counter Type - row 2 onwards
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'Y2:Y1000',
      formulas: ['"MASTER,INHERITED,NOT_RH_DRIVEN"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Value',
      error: 'Please select MASTER, INHERITED, or NOT_RH_DRIVEN'
    });
  }

  // Add data validation for spares (27-column format per specification)
  // Columns: H=UOM, Q=Criticality, X=Is Active, Y=IHM
  if (type === 'spares') {
    if (!mainSheet['!dataValidation']) {
      mainSheet['!dataValidation'] = [];
    }

    // UOM dropdown (Column H, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'H2:H1000',
      formulas: [`"${UOM_LIST.join(',')}"`],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid UOM',
      error: `Please select from: ${UOM_LIST.join(', ')}`
    });

    // Criticality dropdown (Column Q, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'Q2:Q1000',
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Value',
      error: 'Please select Yes or No'
    });

    // Is Active dropdown (Column X, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'X2:X1000',
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Value',
      error: 'Please select Yes or No'
    });

    // IHM dropdown (Column Y, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'Y2:Y1000',
      formulas: ['"Yes,No"'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Value',
      error: 'Please select Yes or No'
    });
  }

  // Add data validation for stores (11-column format per user specification)
  // Columns: A=Item Code, B=IMPA Code, C=Item Name, D=UOM, E=Category, F=Total ROB, G=Location A, H=Location A - ROB, I=Location B, J=Location B - ROB, K=Min
  if (type === 'stores') {
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

    // Category dropdown (Column E, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'E2:E1000',
      formulas: [`"${STORES_CATEGORIES.join(',')}"`],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Category',
      error: `Please select from: ${STORES_CATEGORIES.join(', ')}`
    });
  }

  // Add data validation for work orders
  if (type === 'work-orders') {
    if (!mainSheet['!dataValidation']) {
      mainSheet['!dataValidation'] = [];
    }

    // Fetch all components from the system for this vessel
    const allComponents = await storage.getComponents(defaultVesselId);
    console.log(`📋 Fetched ${allComponents.length} components for vessel ${defaultVesselId}`);
    
    // Filter out components without valid codes
    const validComponents = allComponents.filter(c => c.componentCode && c.componentCode.trim() !== '');
    console.log(`✅ ${validComponents.length} components have valid codes`);
    
    // Create Lists sheet with dropdown values
    const listsData = [
      ['Schedule_Type', 'Interval_Unit', 'Department', 'Responsible_Rank', 'Safety_Permit', 'Criticality'],
      ['Running Hours', 'Hours', 'Engine', 'Chief Engineer', 'Hot Work', 'yes'],
      ['Calendar', 'Days', 'Deck', '2nd Engineer', 'Enclosed Space Entry', 'no'],
      ['', 'Weeks', 'Electrical', '3rd Engineer', 'Lockout-Tagout', ''],
      ['', 'Months', '', '4th Engineer', 'Working Aloft', ''],
      ['', 'Years', '', 'Chief Officer', '', ''],
      ['', '', '', 'Electrician', '', '']
    ];
    
    const listsSheet = XLSX.utils.aoa_to_sheet(listsData);
    
    // Add dropdowns referencing Lists sheet
    // Column F (Department) - References Lists!$C$2:$C$4
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'F2:F1000',
      formulas: ['=Lists!$C$2:$C$4'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Department',
      error: 'Please select from the dropdown'
    });
    
    // Column G (Responsible_Rank) - References Lists!$D$2:$D$7
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'G2:G1000',
      formulas: ['=Lists!$D$2:$D$7'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Rank',
      error: 'Please select from the dropdown'
    });
    
    // Column H (Schedule_Type) - References Lists!$A$2:$A$3
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'H2:H1000',
      formulas: ['=Lists!$A$2:$A$3'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Schedule Type',
      error: 'Please select from the dropdown'
    });
    
    // Column J (Interval_Unit) - References Lists!$B$2:$B$6
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'J2:J1000',
      formulas: ['=Lists!$B$2:$B$6'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Interval Unit',
      error: 'Please select from the dropdown'
    });
    
    // Column K (Criticality) - References Lists!$F$2:$F$3
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'K2:K1000',
      formulas: ['=Lists!$F$2:$F$3'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Criticality',
      error: 'Please select from the dropdown'
    });
    
    // Column N (Safety_Permit_Required) - References Lists!$E$2:$E$5
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'N2:N1000',
      formulas: ['=Lists!$E$2:$E$5'],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: 'Invalid Safety Permit',
      error: 'Please select from the dropdown'
    });
    
    // Append main sheet with new name "wo"
    XLSX.utils.book_append_sheet(workbook, mainSheet, 'wo');
    
    // Append Lists sheet
    XLSX.utils.book_append_sheet(workbook, listsSheet, 'Lists');
  } else if (type === 'stores') {
    // For stores, use "Vessel_Store" sheet name per user specification
    XLSX.utils.book_append_sheet(workbook, mainSheet, 'Vessel_Store');
  } else {
    // For non-work-orders and non-stores, use standard "Data" sheet name
    XLSX.utils.book_append_sheet(workbook, mainSheet, 'Data');
  }

  // For work-orders, use exceljs to generate template with proper data validations
  if (type === 'work-orders') {
    try {
      const buffer = await generateWorkOrdersTemplate(defaultVesselId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_template.xlsx"`);
      res.send(buffer);
      return;
    } catch (error) {
      console.error('Error generating work-orders template:', error);
      return res.status(500).json({ error: 'Failed to generate template' });
    }
  }

  // For jobs, use exceljs to generate template with proper data validations (23 fields matching Vessel_Job Sheet)
  if (type === 'jobs') {
    try {
      const buffer = await generateJobsTemplate(defaultVesselId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_template.xlsx"`);
      res.send(buffer);
      return;
    } catch (error) {
      console.error('Error generating jobs template:', error);
      return res.status(500).json({ error: 'Failed to generate template' });
    }
  }

  // For spares, use exceljs to generate template with prepopulated components
  if (type === 'spares') {
    try {
      const buffer = await generateSparesTemplate(defaultVesselId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_template.xlsx"`);
      res.send(buffer);
      return;
    } catch (error) {
      console.error('Error generating spares template:', error);
      return res.status(500).json({ error: 'Failed to generate template' });
    }
  }

  // Create meta sheet with instructions (for non-work-orders, non-jobs, and non-spares templates)
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

    if (!['components', 'spares', 'stores', 'work-orders', 'jobs'].includes(type)) {
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
      
      const versionCheck = checkTemplateVersion(targetSheet);
      if (!versionCheck.valid) {
        return res.status(400).json({ 
          error: versionCheck.message || 'Template version is outdated. Please download the latest template.',
          outdatedTemplate: true,
          uploadedVersion: versionCheck.version,
          currentVersion: TEMPLATE_VERSION
        });
      }
      
      // Use custom extractor to preserve raw numeric date values
      data = extractRawExcelData(targetSheet);
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    // Log raw data for debugging
    console.log(`📊 [${type}] Raw data parsed: ${data.length} rows`);
    if (data.length > 0) {
      console.log(`📋 Original columns: ${Object.keys(data[0]).join(', ')}`);
      console.log(`📋 First row sample: ${JSON.stringify(data[0])}`);
    } else {
      console.log(`⚠️ NO DATA ROWS FOUND in file!`);
      console.log(`📋 Sheet may be empty or header row might be missing data rows`);
    }

    // Normalize column names to expected format
    data = normalizeColumnNames(data, type);
    
    if (data.length > 0) {
      console.log(`📋 Normalized columns: ${Object.keys(data[0]).join(', ')}`);
    }

    // Validate data
    const results = await validateData(type, data, mode, vesselId);
    console.log(`✅ Validation complete: ${results.summary.ok} valid, ${results.summary.errors} errors, ${results.rows.length} total rows`);
    
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
      rows: results.rows, // Return all rows for proper pagination and filtering
      totalRows: results.rows.length,
      errorReportUrl: results.summary.errors > 0 ? `/api/bulk/history/tmp/${fileToken}/errors.csv` : undefined
    });
  } catch (error) {
    console.error('Dry-run error:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// Actual import
router.post('/import', async (req, res) => {
  const historyId = uuidv4();
  const startedAt = new Date();
  
  try {
    const { fileToken, type, mode, archiveMissing, vesselId, rowIndices, storeType } = req.body;

    const cachedData = dryRunCache.get(fileToken);
    if (!cachedData) {
      return res.status(400).json({ error: 'Invalid or expired file token' });
    }

    // Prepare data for import
    let dataToImport = cachedData.normalizedData || cachedData.data;

    // If rowIndices is provided, filter to only include those rows (partial import)
    if (rowIndices && Array.isArray(rowIndices)) {
      console.log(`📋 Partial import: filtering ${rowIndices.length} rows out of ${dataToImport.length} total`);
      
      // Filter normalized data to only include specified row indices
      dataToImport = dataToImport.filter((_: any, index: number) => {
        // Row indices are 1-based in validation results, but 0-based in array
        return rowIndices.includes(index + 1);
      });

      console.log(`✅ Filtered data: ${dataToImport.length} rows ready for import`);
    } else {
      // Check if there are errors (only for full import)
      if (cachedData.results.summary.errors > 0) {
        return res.status(400).json({ error: 'Cannot import file with errors. Use rowIndices parameter to import only valid rows.' });
      }
    }

    // Log import details for debugging Issue #11
    console.log(`📦 [BULK_IMPORT] Starting import:`);
    console.log(`   Type: ${type}`);
    console.log(`   Mode: ${mode}`);
    console.log(`   VesselId: ${vesselId}`);
    console.log(`   Rows: ${dataToImport.length}`);
    console.log(`   CachedType: ${cachedData.type}`);
    
    // Create initial ImportHistory with status='in_progress'
    await storeImportHistory({
      id: historyId,
      type,
      mode,
      archiveMissing: archiveMissing || false,
      userId: (req as any).user?.id || 'system',
      vesselId,
      originalName: cachedData.originalName,
      fileSize: cachedData.file.length,
      created: 0,
      updated: 0,
      skipped: 0,
      archived: 0,
      startedAt: startedAt,
      finishedAt: null,
      status: 'in_progress'
    });

    // Perform the actual import using filtered/normalized data
    const importResult = await performImport(
      type,
      dataToImport,
      mode,
      archiveMissing,
      vesselId,
      (req as any).user?.id || 'system',
      historyId, // Pass history ID for change tracking
      storeType  // Pass store type for stores import (determines which tab: Stores, Lubes, Chemicals, Others)
    );

    // Save the uploaded file for later retrieval using Replit Object Storage SDK
    let storedFilePath: string | null = null;
    try {
      const { Client } = await import('@replit/object-storage');
      const client = new Client();
      
      const timestamp = Date.now();
      const safeFileName = cachedData.originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const objectPath = `bulk-imports/${type}/${timestamp}_${safeFileName}`;
      
      // Upload file using the Replit Object Storage SDK
      await client.uploadFromBytes(objectPath, cachedData.file);
      storedFilePath = `replit:${objectPath}`;
      console.log(`📁 File uploaded to Replit Object Storage: ${objectPath}`);
    } catch (uploadError) {
      console.warn('⚠️ Replit Object Storage failed, falling back to local storage:', (uploadError as Error).message);
      
      // Fallback: Save file locally
      try {
        const uploadsDir = path.join(process.cwd(), 'uploads', 'bulk-imports', type);
        await fsPromises.mkdir(uploadsDir, { recursive: true });
        
        const timestamp = Date.now();
        const safeFileName = cachedData.originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const localFilePath = path.join(uploadsDir, `${timestamp}_${safeFileName}`);
        
        await fsPromises.writeFile(localFilePath, cachedData.file);
        storedFilePath = `local:${localFilePath}`;
        console.log(`📁 File saved locally at: ${localFilePath}`);
      } catch (localError) {
        console.error('⚠️ Failed to store file locally:', localError);
        // Continue - file storage is optional, import succeeded
      }
    }

    // Update ImportHistory with status='complete' and include file path
    await storage.updateImportHistory(historyId, {
      ...importResult,
      finishedAt: new Date(),
      status: 'complete',
      originalName: cachedData.originalName,
      storedFilePath: storedFilePath // Store the object storage path
    });

    // Clean up cache
    dryRunCache.delete(fileToken);

    res.json({
      ...importResult,
      historyId
    });
  } catch (error: any) {
    console.error('Import error:', error);
    
    // Update ImportHistory with status='failed' and error message
    try {
      await storage.updateImportHistory(historyId, {
        finishedAt: new Date(),
        status: 'failed',
        errorMessage: error?.message || 'Unknown error during import'
      });
    } catch (updateError) {
      console.error('Failed to update import history:', updateError);
    }
    
    res.status(500).json({ 
      error: 'Failed to import data',
      message: error?.message || 'Unknown error'
    });
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

// Download original uploaded file from Object Storage or local storage
// NOTE: This route must be defined BEFORE the parameterized :fileType route
router.get('/history/:id/download-original', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get history record to find stored file path
    const history = await storage.getImportHistoryById(id);
    if (!history) {
      return res.status(404).json({ error: 'Import history not found' });
    }
    
    if (!history.storedFilePath) {
      return res.status(404).json({ error: 'Original file not available for this import' });
    }
    
    // Set download headers with original filename
    const originalName = history.originalName || 'import_file';
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    
    // Check storage type based on prefix
    if (history.storedFilePath.startsWith('replit:')) {
      // Download from Replit Object Storage using SDK
      const objectPath = history.storedFilePath.slice(7); // Remove 'replit:' prefix
      const { Client } = await import('@replit/object-storage');
      const client = new Client();
      
      try {
        const result = await client.downloadAsBytes(objectPath);
        if (!result.ok) {
          return res.status(404).json({ error: 'File not found in storage' });
        }
        res.send(Buffer.from(result.value as unknown as ArrayBuffer));
      } catch {
        return res.status(404).json({ error: 'File not found in storage' });
      }
    } else if (history.storedFilePath.startsWith('local:')) {
      // Download from local file storage
      const localPath = history.storedFilePath.slice(6); // Remove 'local:' prefix
      
      try {
        await fsPromises.access(localPath);
        const fileBuffer = await fsPromises.readFile(localPath);
        res.send(fileBuffer);
      } catch {
        return res.status(404).json({ error: 'File not found on server' });
      }
    } else {
      // Legacy: Download from old object storage path
      const objectStorage = new ObjectStorageService();
      await objectStorage.downloadByPath(history.storedFilePath, res);
    }
  } catch (error) {
    console.error('Original file download error:', error);
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: 'File not found in storage' });
    }
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Download history files (legacy endpoint)
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

  // Filter out instruction/description rows based on the type
  // Each type has a different primary key field to check
  const filteredData = data.filter((row, index) => {
    // Determine the primary identifier field based on type
    let primaryField: string;
    switch (type) {
      case 'components':
        primaryField = 'Component Code';
        break;
      case 'jobs':
        primaryField = 'Job Code';
        break;
      case 'spares':
        primaryField = 'Part Code';
        break;
      case 'stores':
        primaryField = 'Item Code';
        break;
      case 'work-orders':
        primaryField = 'Work Order Number';
        break;
      default:
        primaryField = 'Component Code';
    }
    
    const fieldValue = row[primaryField];
    if (!fieldValue) {
      console.log(`[${type}] Row ${index + 2}: Skipping - no ${primaryField} value`);
      return false; // Skip empty rows
    }
    
    const valueStr = String(fieldValue).trim();
    if (!valueStr) {
      console.log(`[${type}] Row ${index + 2}: Skipping - empty ${primaryField} value`);
      return false;
    }
    
    // Skip instruction rows - they typically contain words like "Required", "Text", "Unique", etc.
    // Only apply this filter for components type where instruction rows are common in templates
    if (type === 'components') {
      const instructionKeywords = ['required', 'unique', 'text', 'number', 'yes/no', 'dd-mm-yyyy', 'maximum', 'allowable'];
      const lowerCode = valueStr.toLowerCase();
      if (instructionKeywords.some(keyword => lowerCode.includes(keyword))) {
        console.log(`Skipping instruction row ${index + 2}: ${valueStr}`);
        return false;
      }
    }
    
    return true;
  });

  console.log(`📋 Total rows in file: ${data.length}, Valid data rows after filtering: ${filteredData.length}`);

  // Track duplicate Component Codes (actual duplicates to warn about)
  const componentCodeOccurrences = new Map<string, number[]>();
  if (type === 'components') {
    filteredData.forEach((row, index) => {
      // Use Component Code from the new template format
      const componentCode = row['Component Code'];
      if (componentCode) {
        const code = String(componentCode).trim();
        if (!componentCodeOccurrences.has(code)) {
          componentCodeOccurrences.set(code, []);
        }
        componentCodeOccurrences.get(code)!.push(index + 2); // Row number (Excel is 1-indexed + header)
      }
    });
  }
  
  // Validate each row based on type (use filtered data)
  for (let i = 0; i < filteredData.length; i++) {
    const row = filteredData[i];
    const rowNum = i + 2; // Excel rows start at 1, plus header
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalized: any = {};

    // Validate Vessel Code matches selected vesselId (only for types that have Vessel Code)
    // Note: work-orders template does NOT have Vessel Code column, so exclude it from validation
    const typesWithVesselCode = ['components', 'jobs'];
    if (typesWithVesselCode.includes(type)) {
      if (vesselId && row['Vessel Code']) {
        const rowVesselCode = String(row['Vessel Code']).trim().toUpperCase();
        const selectedVessel = vesselId.trim().toUpperCase();
        if (rowVesselCode !== selectedVessel) {
          errors.push(`Row ${rowNum}: Vessel Code '${rowVesselCode}' does not match selected vessel '${vesselId}'. All rows must belong to the same vessel.`);
        }
      } else if (vesselId && !row['Vessel Code']) {
        // Vessel Code is missing but vesselId is provided
        errors.push(`Row ${rowNum}: Vessel Code is required and must match selected vessel '${vesselId}'.`);
      }
    }

    if (type === 'components') {
      // Validate Component Code (required, SFI format)
      const componentCode = row['Component Code'];
      if (!componentCode) {
        errors.push(`Row ${rowNum}: Component Code is required`);
      } else {
        const codeStr = String(componentCode).trim();
        if (!validateSFICode(codeStr)) {
          errors.push(`Row ${rowNum}: Invalid Component Code format. Expected SFI format: 6, 61, 612, 612.005, etc.`);
        } else {
          normalized['Component Code'] = codeStr;
          
          // Check for duplicates
          const occurrences = componentCodeOccurrences.get(codeStr);
          if (occurrences && occurrences.length > 1) {
            const otherRows = occurrences.filter(r => r !== rowNum);
            warnings.push(`Row ${rowNum}: Duplicate Component Code '${codeStr}' found in rows ${otherRows.join(', ')}. Only the last occurrence will be kept.`);
          }
          
          // Auto-calculate Parent Component Code from Component Code
          const parentCode = getParentSFICode(codeStr);
          if (parentCode && !row['Parent Component Code']) {
            normalized['Parent Component Code'] = parentCode;
          }
          
          // Auto-calculate Component Category from first digit
          const firstDigit = parseInt(codeStr.charAt(0));
          if (!isNaN(firstDigit) && firstDigit >= 1 && firstDigit <= 8) {
            const category = getComponentCategory(firstDigit);
            if (category && !row['Component Category']) {
              normalized['Component Category'] = `${firstDigit} ${category}`;
            }
          }
        }
      }
      
      // Component Name - required, but auto-generate for parent nodes if missing
      if (!row['Component Name'] || String(row['Component Name']).trim() === '') {
        // Auto-generate name for parent nodes (codes without detailed hierarchy)
        const sfiCode = normalized['Component Code'];
        if (sfiCode) {
          const firstDigit = parseInt(sfiCode.charAt(0));
          
          // Try to generate a sensible name based on the code structure
          if (sfiCode.length === 1) {
            // Single digit: use main group category
            const category = getComponentCategory(firstDigit);
            normalized['Component Name'] = category ? category.replace(/^\d+\s+/, '') : `SFI ${sfiCode}`;
            warnings.push(`Row ${rowNum}: Component Name auto-generated from SFI code: "${normalized['Component Name']}"`);
          } else if (sfiCode.length === 2) {
            // Two digits: use sub group name
            normalized['Component Name'] = getSubGroupName(sfiCode);
            warnings.push(`Row ${rowNum}: Component Name auto-generated from SFI code: "${normalized['Component Name']}"`);
          } else {
            // More complex codes should have names - this is likely an error
            errors.push(`Row ${rowNum}: Component Name is required for detailed component codes`);
          }
        } else {
          errors.push(`Row ${rowNum}: Component Name is required`);
        }
      } else {
        normalized['Component Name'] = String(row['Component Name']).trim();
      }

      // Validate Yes/No fields - Support both template format and legacy format
      // Template uses: Critical Yes/No, Condition Based Yes/No
      // Legacy uses: Critical (Yes/No), Condition Based (Yes/No)
      const yesNoFieldMappings = [
        { template: 'Critical Yes/No', legacy: 'Critical (Yes/No)' },
        { template: 'Condition Based Yes/No', legacy: 'Condition Based (Yes/No)' },
        { template: 'IS Active', legacy: 'IS Active' }
      ];
      
      yesNoFieldMappings.forEach(({ template, legacy }) => {
        const fieldValue = row[template] ?? row[legacy];
        if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
          const value = String(fieldValue).toLowerCase().trim();
          if (!['yes', 'no', 'y', 'n', 'true', 'false', '1', '0'].includes(value)) {
            errors.push(`Row ${rowNum}: ${template} must be Yes or No`);
          } else {
            // Normalize to boolean-friendly format - store in both formats
            const normalizedValue = ['yes', 'y', 'true', '1'].includes(value);
            normalized[template] = normalizedValue;
            normalized[legacy] = normalizedValue;
          }
        }
      });

      // Validate Running Hours
      if (row['Running Hours'] !== undefined && row['Running Hours'] !== null && row['Running Hours'] !== '') {
        const num = parseFloat(row['Running Hours']);
        if (isNaN(num) || num < 0) {
          errors.push(`Row ${rowNum}: Running Hours must be a non-negative number`);
        } else {
          normalized['Running Hours'] = num;
        }
      }

      // Validate date fields (DD-MM-YYYY format)
      ['Installation Date', 'Commissioned Date'].forEach(field => {
        if (row[field]) {
          const dateStr = String(row[field]).trim();
          // Accept DD-MM-YYYY or Excel serial date format
          // Basic validation - just ensure it's not empty
          normalized[field] = dateStr;
        }
      });

      // Copy text fields directly - support both new and legacy header formats
      // IMPORTANT: Include RH Counter Type, RH Counter Source, and Last Updated for Running Hours tracking
      const textFields = [
        'Fleet Equipment Code', 'Fleet Equipment Name', 'Maker', 'Maker Code',
        'Model', 'Model Code', 'Model Number', 'Serial No', 'Drawing No', 'Location',
        'Rating', 'Equipment / System Department', 'Eqpt / System Department', 'Notes', 'Vessel Code',
        'IS Parent', 'Class item', 'Class Item', 'Criticality',
        'RH Counter Type', 'RH Counter Source', 'Last Updated'
      ];
      
      textFields.forEach(field => {
        if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
          normalized[field] = String(row[field]).trim();
        }
      });

      // Copy Parent Component Code if provided
      if (row['Parent Component Code'] && !normalized['Parent Component Code']) {
        normalized['Parent Component Code'] = String(row['Parent Component Code']).trim();
      }

      // Copy Component Category if provided
      if (row['Component Category'] && !normalized['Component Category']) {
        normalized['Component Category'] = String(row['Component Category']).trim();
      }
    } else if (type === 'spares') {
      // Validate Vessel Code matches selected vesselId
      if (vesselId && row['Vessel Code']) {
        const rowVesselCode = String(row['Vessel Code']).trim().toUpperCase();
        const selectedVessel = vesselId.trim().toUpperCase();
        if (rowVesselCode !== selectedVessel) {
          errors.push(`Row ${rowNum}: Vessel Code '${rowVesselCode}' does not match selected vessel '${vesselId}'. All rows must belong to the same vessel.`);
        } else {
          normalized['Vessel Code'] = rowVesselCode;
        }
      } else if (vesselId && !row['Vessel Code']) {
        // Auto-populate Vessel Code if missing
        normalized['Vessel Code'] = vesselId;
      }

      // Validate Component Code (required, must exist in system)
      if (!row['Component Code']) {
        errors.push(`Row ${rowNum}: Component Code is required`);
      } else {
        const componentCode = String(row['Component Code']).trim();
        normalized['Component Code'] = componentCode;
        
        // Validate that Component Code exists in the system
        // Note: This check will be performed during import, not during dry-run
        // to avoid loading all components into memory for validation
      }

      // Component Name - auto-filled or provided
      if (row['Component Name']) {
        normalized['Component Name'] = String(row['Component Name']).trim();
      }

      // Part Code - can be auto-generated or manually entered
      if (row['Part Code'] && String(row['Part Code']).trim()) {
        normalized['Part Code'] = String(row['Part Code']).trim();
      }
      // Note: Part Code will be auto-generated during import if not provided

      // Part Name - required
      if (!row['Part Name']) {
        errors.push(`Row ${rowNum}: Part Name is required`);
      } else {
        normalized['Part Name'] = String(row['Part Name']).trim();
      }

      // Part Number - optional
      if (row['Part Number']) {
        normalized['Part Number'] = String(row['Part Number']).trim();
      }

      // UOM - validate against UOM_LIST (support both UOM and Unit Of Measurement)
      const uomField = row['UOM'] || row['Unit Of Measurement'];
      if (uomField) {
        const uomValue = String(uomField).toLowerCase().trim();
        if (!UOM_LIST.includes(uomValue)) {
          errors.push(`Row ${rowNum}: Invalid UOM. Allowed: ${UOM_LIST.join(', ')}`);
        } else {
          normalized['UOM'] = uomValue.toUpperCase();
        }
      }

      // Validate numeric fields - support new field names
      // Total ROB, Location A - ROB, Location B - ROB, Minimum Stock
      const numericFieldMappings = [
        { source: 'Total ROB', target: 'Total ROB' },
        { source: 'Location A - ROB', target: 'Location A - ROB' },
        { source: 'Location B - ROB', target: 'Location B - ROB' },
        { source: 'Minimum Stock', target: 'Minimum Stock' }
      ];
      
      numericFieldMappings.forEach(({ source, target }) => {
        if (row[source] !== undefined && row[source] !== null && row[source] !== '') {
          const num = parseInt(row[source]);
          if (isNaN(num) || num < 0) {
            errors.push(`Row ${rowNum}: ${source} must be a non-negative integer`);
          } else {
            normalized[target] = num;
          }
        }
      });

      // Validate Criticality - Support new format and legacy formats
      const criticalField = row['Criticality'] || row['Critical Yes/No'] || row['Criticality (Yes/No)'];
      if (criticalField) {
        const value = String(criticalField).toLowerCase().trim();
        if (!['yes', 'no', 'y', 'n'].includes(value)) {
          errors.push(`Row ${rowNum}: Criticality must be Yes or No`);
        } else {
          const normalizedValue = ['yes', 'y'].includes(value) ? 'Yes' : 'No';
          normalized['Criticality'] = normalizedValue;
        }
      }

      // Validate Is Active
      const isActiveField = row['Is Active'] || row['IS Active'];
      if (isActiveField) {
        const value = String(isActiveField).toLowerCase().trim();
        if (!['yes', 'no', 'y', 'n'].includes(value)) {
          errors.push(`Row ${rowNum}: Is Active must be Yes or No`);
        } else {
          normalized['Is Active'] = ['yes', 'y'].includes(value) ? 'Yes' : 'No';
        }
      }

      // Validate IHM (Inventory of Hazardous Materials)
      const ihmField = row['IHM (Inventory of Hazardous Materials)'];
      if (ihmField) {
        const value = String(ihmField).toLowerCase().trim();
        if (!['yes', 'no', 'y', 'n'].includes(value)) {
          errors.push(`Row ${rowNum}: IHM must be Yes or No`);
        } else {
          normalized['IHM (Inventory of Hazardous Materials)'] = ['yes', 'y'].includes(value) ? 'Yes' : 'No';
        }
      }

      // Validate Fleet Equipment Code if provided
      if (row['Fleet Equipment Code']) {
        const fleetCode = String(row['Fleet Equipment Code']).trim();
        normalized['Fleet Equipment Code'] = fleetCode;
        
        // Validate that Fleet Equipment Code exists in master data
        const masterEntry = await storage.getMasterDataByFleetCode(fleetCode);
        if (!masterEntry) {
          warnings.push(`Row ${rowNum}: Fleet Equipment Code '${fleetCode}' not found in master data. Code will be accepted but not linked.`);
        }
      }
      
      // Copy text fields directly - new template fields
      const textFields = [
        'Fleet Equipment Name', 'Drawing Number', 'Position Number', 'Note',
        'Specification', 'Maker', 'Maker Code', 'Manual Name', 'Page Number',
        'Location A', 'Location B', 'Evidence Type'
      ];
      
      textFields.forEach(field => {
        if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
          normalized[field] = String(row[field]).trim();
        }
      });
    } else if (type === 'stores') {
      // Validate stores (11-column format per user specification)
      // Columns: Item Code, IMPA Code, Item Name, UOM, Category, Total ROB, Location A, Location A - ROB, Location B, Location B - ROB, Min
      
      if (!row['Item Code']) {
        errors.push(`Row ${rowNum}: Item Code is required`);
      } else {
        normalized['Item Code'] = String(row['Item Code']).trim();
      }

      // IMPA Code - optional
      if (row['IMPA Code']) {
        normalized['IMPA Code'] = String(row['IMPA Code']).trim();
      }

      if (!row['Item Name']) {
        errors.push(`Row ${rowNum}: Item Name is required`);
      } else {
        normalized['Item Name'] = String(row['Item Name']).trim();
      }

      // UOM validation
      if (row['UOM'] && !UOM_LIST.includes(row['UOM'].toLowerCase())) {
        errors.push(`Row ${rowNum}: Invalid UOM. Allowed: ${UOM_LIST.join(', ')}`);
      } else if (row['UOM']) {
        normalized['UOM'] = row['UOM'].toLowerCase();
      }

      // Category validation
      if (row['Category'] && !STORES_CATEGORIES.includes(row['Category'])) {
        warnings.push(`Row ${rowNum}: Category '${row['Category']}' not in standard list`);
        normalized['Category'] = row['Category'];
      } else if (row['Category']) {
        normalized['Category'] = row['Category'];
      }

      // Validate numeric fields
      const numericFields = ['Total ROB', 'Location A - ROB', 'Location B - ROB', 'Min'];
      numericFields.forEach(field => {
        if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
          const num = parseFloat(row[field]);
          if (isNaN(num) || num < 0) {
            errors.push(`Row ${rowNum}: ${field} must be a non-negative number`);
          } else {
            normalized[field] = num;
          }
        }
      });

      // Copy text fields
      const textFields = ['Location A', 'Location B'];
      textFields.forEach(field => {
        if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
          normalized[field] = String(row[field]).trim();
        }
      });

      // Copy other fields
      Object.keys(row).forEach(key => {
        if (!normalized[key]) {
          normalized[key] = row[key];
        }
      });
    } else if (type === 'work-orders') {
      // Validate work orders (new column names)
      // Skip rows that don't have Job_Title - user only fills in components they want work orders for
      if (!row['Job_Title'] || String(row['Job_Title']).trim() === '') {
        // Skip empty rows (component without work order) - don't add to results
        continue;
      }
      
      // If Job_Title is provided, then this is a real work order - validate it
      normalized['Job_Title'] = String(row['Job_Title']).trim();
      
      if (!row['Generated_Component_Code']) {
        errors.push(`Row ${rowNum}: Generated_Component_Code is required`);
      } else {
        normalized['Generated_Component_Code'] = String(row['Generated_Component_Code']).trim();
        // TODO: Check if component exists
      }

      // Component_Name is often auto-filled, but validate if provided
      if (row['Component_Name']) {
        normalized['Component_Name'] = String(row['Component_Name']).trim();
      }

      // Job_Code is optional
      if (row['Job_Code']) {
        normalized['Job_Code'] = String(row['Job_Code']).trim();
      }

      // Job_Description is optional
      if (row['Job_Description']) {
        normalized['Job_Description'] = String(row['Job_Description']).trim();
      }

      // Department is optional
      const validDepartments = ['Engine', 'Deck', 'Electrical'];
      if (row['Department'] && !validDepartments.includes(row['Department'])) {
        errors.push(`Row ${rowNum}: Invalid Department. Allowed: ${validDepartments.join(', ')}`);
      } else if (row['Department']) {
        normalized['Department'] = row['Department'];
      }

      // Responsible_Rank is optional
      const validRanks = ['Chief Engineer', '2nd Engineer', '3rd Engineer', '4th Engineer', 'Chief Officer', 'Electrician'];
      if (row['Responsible_Rank'] && !validRanks.includes(row['Responsible_Rank'])) {
        errors.push(`Row ${rowNum}: Invalid Responsible_Rank. Allowed: ${validRanks.join(', ')}`);
      } else if (row['Responsible_Rank']) {
        normalized['Responsible_Rank'] = row['Responsible_Rank'];
      }

      // Validate Schedule_Type (formerly Maintenance Basis)
      const validScheduleTypes = ['Calendar', 'Running Hours'];
      if (row['Schedule_Type'] && !validScheduleTypes.includes(row['Schedule_Type'])) {
        errors.push(`Row ${rowNum}: Invalid Schedule_Type. Allowed: ${validScheduleTypes.join(', ')}`);
      } else if (row['Schedule_Type']) {
        normalized['Schedule_Type'] = row['Schedule_Type'];
      }

      // Validate Interval and Interval_Unit based on Schedule_Type
      const scheduleType = row['Schedule_Type'];
      if (scheduleType === 'Calendar' || scheduleType === 'Running Hours') {
        // Interval is required for Calendar and Running Hours
        if (!row['Interval']) {
          errors.push(`Row ${rowNum}: Interval is required for ${scheduleType} schedule`);
        } else {
          const interval = parseFloat(row['Interval']);
          if (isNaN(interval) || interval <= 0) {
            errors.push(`Row ${rowNum}: Interval must be a positive number`);
          } else {
            normalized['Interval'] = String(interval);
          }
        }

        // Interval_Unit is required only for Calendar basis
        if (scheduleType === 'Calendar') {
          const validIntervalUnits = ['Hours', 'Days', 'Weeks', 'Months', 'Years'];
          if (!row['Interval_Unit']) {
            errors.push(`Row ${rowNum}: Interval_Unit is required for Calendar schedule`);
          } else if (!validIntervalUnits.includes(row['Interval_Unit'])) {
            errors.push(`Row ${rowNum}: Invalid Interval_Unit. Allowed: ${validIntervalUnits.join(', ')}`);
          } else {
            normalized['Interval_Unit'] = row['Interval_Unit'];
          }
        } else {
          // Running Hours - Interval_Unit defaults to Hours
          if (row['Interval_Unit']) {
            if (row['Interval_Unit'] !== 'Hours') {
              warnings.push(`Row ${rowNum}: Interval_Unit for Running Hours should be 'Hours' (will be set to Hours)`);
            }
          }
          normalized['Interval_Unit'] = 'Hours';
        }
      }

      // Criticality is optional (yes/no)
      if (row['Criticality']) {
        const value = row['Criticality'].toString().toLowerCase();
        if (!['yes', 'no'].includes(value)) {
          errors.push(`Row ${rowNum}: Criticality must be yes or no`);
        } else {
          normalized['Criticality'] = value;
        }
      }

      // Estimated_Hours is optional
      if (row['Estimated_Hours']) {
        const hours = parseFloat(row['Estimated_Hours']);
        if (isNaN(hours) || hours < 0) {
          errors.push(`Row ${rowNum}: Estimated_Hours must be a non-negative number`);
        } else {
          normalized['Estimated_Hours'] = String(hours);
        }
      }

      // Spares_Required is optional
      if (row['Spares_Required']) {
        normalized['Spares_Required'] = String(row['Spares_Required']).trim();
      }

      // Safety_Permit_Required is optional
      const validSafetyPermits = ['Hot Work', 'Enclosed Space Entry', 'Lockout-Tagout', 'Working Aloft'];
      if (row['Safety_Permit_Required'] && !validSafetyPermits.includes(row['Safety_Permit_Required'])) {
        errors.push(`Row ${rowNum}: Invalid Safety_Permit_Required. Allowed: ${validSafetyPermits.join(', ')}`);
      } else if (row['Safety_Permit_Required']) {
        normalized['Safety_Permit_Required'] = row['Safety_Permit_Required'];
      }

      // Copy other fields
      Object.keys(row).forEach(key => {
        if (!normalized[key]) {
          normalized[key] = row[key];
        }
      });
    } else if (type === 'jobs') {
      // Validate jobs (21-column specification format)
      // Skip rows that don't have WO Title - user only fills in components they want jobs for
      if (!row['WO Title'] || String(row['WO Title']).trim() === '') {
        // Skip empty rows (component without job) - don't add to results
        continue;
      }
      
      // If WO Title is provided, then this is a real job - validate it
      normalized['WO Title'] = String(row['WO Title']).trim();
      
      // Vessel Code - required
      if (!row['Vessel Code']) {
        errors.push(`Row ${rowNum}: Vessel Code is required`);
      } else {
        normalized['Vessel Code'] = String(row['Vessel Code']).trim();
      }
      
      // Component Code - required and must exist in vessel
      if (!row['Component Code']) {
        errors.push(`Row ${rowNum}: Component Code is required`);
      } else {
        const componentCode = String(row['Component Code']).trim();
        normalized['Component Code'] = componentCode;
        
        // Validate that Component Code exists in the vessel
        const vesselCode = row['Vessel Code'] ? String(row['Vessel Code']).trim() : null;
        if (vesselCode) {
          const component = await storage.getComponentByCode(componentCode, vesselCode);
          if (!component) {
            errors.push(`Row ${rowNum}: Component Code '${componentCode}' not found in vessel '${vesselCode}'. Job cannot be linked.`);
          }
        }
      }

      // Component Name is often auto-filled, but validate if provided
      if (row['Component Name']) {
        normalized['Component Name'] = String(row['Component Name']).trim();
      }

      // Job Code is optional (will be auto-generated)
      if (row['Job Code']) {
        normalized['Job Code'] = String(row['Job Code']).trim();
      }
      
      // Fleet Equipment Code is optional (fleet linkage will be done later)
      if (row['Fleet Equipment Code']) {
        normalized['Fleet Equipment Code'] = String(row['Fleet Equipment Code']).trim();
      }
      
      // Fleet Equipment Name is optional
      if (row['Fleet Equipment Name']) {
        normalized['Fleet Equipment Name'] = String(row['Fleet Equipment Name']).trim();
      }

      // Maintenance Basis - required (Calendar or Running Hours only)
      // CRITICAL: Frequency is the foundation of PMS scheduling - cannot be empty
      const validMaintenanceBasis = ['Calendar', 'Running Hours'];
      if (!row['Maintenance Basis']) {
        errors.push(`Row ${rowNum}: Maintenance Basis is required (must be 'Calendar' or 'Running Hours')`);
      } else if (!validMaintenanceBasis.includes(row['Maintenance Basis'])) {
        errors.push(`Row ${rowNum}: Invalid Maintenance Basis '${row['Maintenance Basis']}'. Must be 'Calendar' or 'Running Hours'`);
      } else {
        normalized['Maintenance Basis'] = row['Maintenance Basis'];
      }

      // Validate Interval Value and Unit - ALWAYS REQUIRED
      // The entire planned maintenance system depends on interval data
      const maintenanceBasis = row['Maintenance Basis'];
      
      // Interval Value is always required
      if (!row['Interval Value']) {
        errors.push(`Row ${rowNum}: Interval Value is REQUIRED - this drives the entire PMS scheduling system`);
      } else {
        const interval = parseFloat(row['Interval Value']);
        if (isNaN(interval) || interval <= 0) {
          errors.push(`Row ${rowNum}: Interval Value must be a positive number (got: '${row['Interval Value']}')`);
        } else {
          normalized['Interval Value'] = String(interval);
        }
      }
      
      // Interval Running Hours - optional (legacy column)
      // For new templates: when Maintenance Basis = "Running Hours" AND Unit = "Hours", 
      // the Interval Value is automatically used as the running hours interval
      if (row['Interval Running Hours']) {
        normalized['Interval Running Hours'] = String(row['Interval Running Hours']).trim();
      }

      // Unit validation depends on Maintenance Basis
      if (maintenanceBasis === 'Calendar') {
        const validUnits = ['Hours', 'Days', 'Weeks', 'Months', 'Years'];
        if (!row['Unit']) {
          errors.push(`Row ${rowNum}: Unit is REQUIRED for Calendar maintenance (allowed: ${validUnits.join(', ')})`);
        } else if (!validUnits.includes(row['Unit'])) {
          errors.push(`Row ${rowNum}: Invalid Unit '${row['Unit']}'. Allowed: ${validUnits.join(', ')}`);
        } else {
          normalized['Unit'] = row['Unit'];
        }
      } else if (maintenanceBasis === 'Running Hours') {
        // Running Hours - Unit defaults to Hours
        if (row['Unit']) {
          if (row['Unit'] !== 'Hours') {
            warnings.push(`Row ${rowNum}: Unit for Running Hours should be 'Hours' (will be set to Hours)`);
          }
        }
        normalized['Unit'] = 'Hours';
        
        // Auto-derive Interval Running Hours from Interval Value when Unit = Hours and no explicit value provided
        if (!row['Interval Running Hours'] && row['Interval Value']) {
          normalized['Interval Running Hours'] = String(row['Interval Value']).trim();
        }
      }

      // Task Type - required
      const validTaskTypes = ['Inspection', 'Overhaul', 'Service', 'Testing', 'Repair', 'Replacement', 'Cleaning', 'Calibration'];
      if (!row['Task Type']) {
        errors.push(`Row ${rowNum}: Task Type is required`);
      } else if (!validTaskTypes.includes(row['Task Type'])) {
        errors.push(`Row ${rowNum}: Invalid Task Type. Allowed: ${validTaskTypes.join(', ')}`);
      } else {
        normalized['Task Type'] = row['Task Type'];
      }

      // Assigned To is optional
      if (row['Assigned To']) {
        normalized['Assigned To'] = String(row['Assigned To']).trim();
      }
      
      // Approver is optional
      if (row['Approver']) {
        normalized['Approver'] = String(row['Approver']).trim();
      }

      // Job Priority is optional
      const validJobPriorities = ['Low', 'Medium', 'High', 'Critical'];
      if (row['Job Priority'] && !validJobPriorities.includes(row['Job Priority'])) {
        errors.push(`Row ${rowNum}: Invalid Job Priority. Allowed: ${validJobPriorities.join(', ')}`);
      } else if (row['Job Priority']) {
        normalized['Job Priority'] = row['Job Priority'];
      }

      // Class Related - optional yes/no
      if (row['Class Related']) {
        const value = row['Class Related'].toString().toLowerCase();
        if (!['yes', 'no'].includes(value)) {
          errors.push(`Row ${rowNum}: Class Related must be Yes or No`);
        } else {
          normalized['Class Related'] = value;
        }
      }
      
      // Last Done Date is optional
      if (row['Last Done Date']) {
        normalized['Last Done Date'] = String(row['Last Done Date']).trim();
      }
      
      // Brief Work Description is optional
      if (row['Brief Work Description']) {
        normalized['Brief Work Description'] = String(row['Brief Work Description']).trim();
      }

      // Department is optional
      const validDepartmentsJobs = ['Engine', 'Deck', 'Electrical', 'C/E', '2/E', '3/E', '4/E', 'ETO'];
      if (row['Department'] && !validDepartmentsJobs.includes(row['Department'])) {
        errors.push(`Row ${rowNum}: Invalid Department. Allowed: ${validDepartmentsJobs.join(', ')}`);
      } else if (row['Department']) {
        normalized['Department'] = row['Department'];
      }
      
      // Critical Yes/No - Support both template format and legacy format
      const criticalJobField = row['Critical Yes/No'] ?? row['Criticality'];
      if (criticalJobField) {
        const value = criticalJobField.toString().toLowerCase();
        if (!['yes', 'no', 'y', 'n'].includes(value)) {
          errors.push(`Row ${rowNum}: Critical must be Yes or No`);
        } else {
          const normalizedCritical = ['yes', 'y'].includes(value) ? 'yes' : 'no';
          normalized['Critical Yes/No'] = normalizedCritical;
          normalized['Criticality'] = normalizedCritical;
        }
      }
      
      // Is Active - optional yes/no (defaults to Yes if not provided)
      if (row['Is Active']) {
        const value = row['Is Active'].toString().toLowerCase();
        if (!['yes', 'no'].includes(value)) {
          errors.push(`Row ${rowNum}: Is Active must be Yes or No`);
        } else {
          normalized['Is Active'] = value;
        }
      } else {
        normalized['Is Active'] = 'yes';  // Default to active
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
      console.log(`❌ Row ${rowNum} has ERRORS: ${JSON.stringify(errors)}`);
    } else if (warnings.length > 0) {
      status = 'warning';
      results.summary.warnings++;
      results.summary.ok++;  // Rows with only warnings are still valid/importable
      console.log(`⚠️ Row ${rowNum} has warnings (importable): ${JSON.stringify(warnings)}`);
    } else {
      results.summary.ok++;
      console.log(`✅ Row ${rowNum} is OK`);
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

function createRecordSnapshot(record: any): { checksum: string; snapshot: string | null } {
  if (!record) {
    return { checksum: '', snapshot: null };
  }
  
  const sorted = sortObjectKeys(record);
  const snapshot = JSON.stringify(sorted, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'function' || typeof value === 'symbol') {
      return undefined;
    }
    return value;
  });
  const checksum = calculateRecordChecksum(sorted);
  
  return { checksum, snapshot };
}

async function trackChange(
  importHistoryId: string,
  operation: 'created' | 'updated' | 'archived',
  entityType: 'component' | 'job' | 'spare' | 'workOrder' | 'storesItem',
  entityId: string,
  previousData: any | null,
  newData: any | null
) {
  const previousSnapshot = createRecordSnapshot(previousData);
  const newSnapshot = createRecordSnapshot(newData);
  
  const checksum = newSnapshot.checksum || previousSnapshot.checksum;
  
  await storage.createImportChangeLog({
    id: uuidv4(),
    importHistoryId,
    operation,
    entityType,
    entityId,
    previousData: previousSnapshot.snapshot,
    newData: newSnapshot.snapshot,
    checksum
  });
}

// Perform actual import
async function performImport(
  type: string,
  data: any[],
  mode: string,
  archiveMissing: boolean,
  vesselId: string | undefined,
  userId: string,
  importHistoryId?: string,
  storeType?: string
) {
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
    archived: 0
  };

  if (type === 'components') {
    console.log(`🚀 Starting component import: ${data.length} rows, mode: ${mode}`);
    
    // Step 0: Auto-populate Maker List from component data
    // Fetch all existing makers ONCE at the start (performance optimization)
    const existingMakers = await storage.getMakerList();
    const existingMakersByName = new Map(existingMakers.map(m => [m.makerName.toLowerCase(), m]));
    const existingMakersByCode = new Map(existingMakers.map(m => [m.makerCode, m]));
    
    // Find max MKR number once for sequential generation
    let maxMakerNum = 0;
    for (const m of existingMakers) {
      const match = m.makerCode.match(/MKR-(\d+)/);
      if (match) {
        maxMakerNum = Math.max(maxMakerNum, parseInt(match[1], 10));
      }
    }
    
    // Track makers to create (only for rows without valid Maker Code)
    // Support both 'Maker' and 'Maker Name' column headers
    const makersToCreate = new Map<string, { makerName: string; address?: string }>();
    for (const row of data) {
      const makerName = row['Maker'] || row['Maker Name'];
      const makerCode = row['Maker Code'];
      
      if (makerName && makerName.toString().trim()) {
        const trimmedName = makerName.toString().trim();
        const trimmedCode = makerCode?.toString().trim();
        
        // If valid Maker Code is provided, verify it exists or keep as-is
        if (trimmedCode && existingMakersByCode.has(trimmedCode)) {
          continue; // Valid existing maker code - no action needed
        }
        
        // If Maker Code provided but not found, and maker name exists, use existing code
        if (existingMakersByName.has(trimmedName.toLowerCase())) {
          const existingMaker = existingMakersByName.get(trimmedName.toLowerCase())!;
          row['Maker Code'] = existingMaker.makerCode;
          continue;
        }
        
        // No valid code and no existing maker - need to create
        if (!makersToCreate.has(trimmedName.toLowerCase())) {
          makersToCreate.set(trimmedName.toLowerCase(), {
            makerName: trimmedName,
            address: row['Address']?.toString().trim() || undefined
          });
        }
      }
    }
    
    // Create missing makers with sequential codes
    const newMakerCodes = new Map<string, string>();
    for (const [key, makerInfo] of Array.from(makersToCreate)) {
      maxMakerNum++;
      const newMakerCode = `MKR-${String(maxMakerNum).padStart(6, '0')}`;
      
      try {
        const newMaker = await storage.createMakerListItem({
          makerCode: newMakerCode,
          makerName: makerInfo.makerName,
          address: makerInfo.address || null
        });
        newMakerCodes.set(key, newMakerCode);
        existingMakersByName.set(key, newMaker);
        existingMakersByCode.set(newMakerCode, newMaker);
        console.log(`✅ Created new maker: ${makerInfo.makerName} -> ${newMakerCode}`);
      } catch (err) {
        console.error(`Failed to create maker ${makerInfo.makerName}:`, err);
      }
    }
    
    // Update data rows with resolved Maker Codes (only for rows that need it)
    for (const row of data) {
      const makerName = row['Maker'] || row['Maker Name'];
      if (makerName && !row['Maker Code']) {
        const resolvedCode = newMakerCodes.get(makerName.toString().trim().toLowerCase());
        if (resolvedCode) {
          row['Maker Code'] = resolvedCode;
        }
      }
    }
    
    console.log(`📋 Maker sync complete: ${newMakerCodes.size} new makers created`);
    
    // Step 1: Prefetch all existing components by codes for performance
    const allCodes = data.map(row => String(row['Component Code'] || row['Generated Code'] || row['Original SFI Code']).trim());
    const existingComponentsMap = await storage.getComponentsByCodes(allCodes, vesselId);
    
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
        const parentExists = existingComponentsMap.get(currentCode);
        if (!parentExists) {
          parentsToCreate.add(currentCode);
        }
        // Move up one level by trimming the current code
        currentCode = getParentSFICode(currentCode);
      }
    }
    
    // Step 2: Create missing parent nodes (sorted by depth, shallowest first) with tracking
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
      
      const parentComponent = await storage.createComponent({
        componentCode: parentCode,
        name: parentName,
        category: getComponentCategory(parentMainGroup) || '',
        parentId: getParentSFICode(parentCode),
        vesselId: vesselId || 'V001',
        currentCumulativeRH: '0',
        critical: false,
        classItem: false
      });
      
      // Add to map for subsequent lookups
      existingComponentsMap.set(parentCode, parentComponent);
      
      console.log(`📁 Created parent node: ${parentCode} (${parentName})`);
      result.created++;
      
      // Track parent component creation with authoritative state
      if (importHistoryId) {
        await trackChange(importHistoryId, 'created', 'component', parentComponent.id, null, parentComponent);
      }
    }
    
    // Step 3: Sort components by SFI hierarchy depth (parents before children)
    // e.g., "6" before "61" before "612.005"
    const sortedData = [...data].sort((a, b) => {
      const aCode = String(a['Component Code'] || a['Generated Code'] || a['Original SFI Code'] || '').trim();
      const bCode = String(b['Component Code'] || b['Generated Code'] || b['Original SFI Code'] || '').trim();
      const aDepth = (aCode.match(/\./g) || []).length;
      const bDepth = (bCode.match(/\./g) || []).length;
      return aDepth - bDepth; // Lower depth (parents) first
    });

    // Step 4: Process each data row individually with authoritative state capture
    for (const row of sortedData) {
      const componentCode = String(row['Component Code'] || row['Generated Code'] || row['Original SFI Code']).trim();
      const existingComponent = existingComponentsMap.get(componentCode);

      if (mode === 'add') {
        if (!existingComponent) {
          const newComponent = await createComponentFromRow(row, vesselId);
          existingComponentsMap.set(componentCode, newComponent);
          result.created++;
          
          // Track component creation with authoritative state
          if (importHistoryId) {
            await trackChange(importHistoryId, 'created', 'component', newComponent.id, null, newComponent);
          }
        } else {
          result.skipped++;
        }
      } else if (mode === 'update') {
        if (existingComponent) {
          const previousSnapshot = createRecordSnapshot(existingComponent);
          const updatedComponent = await updateComponentFromRow(componentCode, row, vesselId, existingComponent);
          existingComponentsMap.set(componentCode, updatedComponent);
          result.updated++;
          
          // Track component update with authoritative before/after snapshots
          if (importHistoryId) {
            await trackChange(importHistoryId, 'updated', 'component', updatedComponent.id, existingComponent, updatedComponent);
          }
        } else {
          result.skipped++;
        }
      } else if (mode === 'upsert') {
        // For upsert, verify component has a valid ID (exists in database)
        // existingComponent from map may be from spreadsheet parsing without ID
        if (existingComponent && existingComponent.id) {
          console.log(`🔄 Updating existing component: ${componentCode}`);
          const previousSnapshot = createRecordSnapshot(existingComponent);
          const updatedComponent = await updateComponentFromRow(componentCode, row, vesselId, existingComponent);
          existingComponentsMap.set(componentCode, updatedComponent);
          result.updated++;
          
          // Track component update with authoritative before/after snapshots
          if (importHistoryId) {
            await trackChange(importHistoryId, 'updated', 'component', updatedComponent.id, existingComponent, updatedComponent);
          }
        } else {
          const newComponent = await createComponentFromRow(row, vesselId);
          existingComponentsMap.set(componentCode, newComponent);
          result.created++;
          
          // Track component creation with authoritative state
          if (importHistoryId) {
            await trackChange(importHistoryId, 'created', 'component', newComponent.id, null, newComponent);
          }
        }
      }
    }
    
    // Step 5: Archive missing components if requested
    if (archiveMissing) {
      const importedCodes = new Set(data.map(row => String(row['Component Code'] || row['Generated Code'] || row['Original SFI Code']).trim()));
      const allVesselComponents = await storage.getComponents(vesselId || 'V001');
      
      for (const component of allVesselComponents) {
        if (component.componentCode && !importedCodes.has(component.componentCode) && component.isActive !== false) {
          const previousSnapshot = createRecordSnapshot(component);
          const archivedComponent = await storage.archiveComponent(component.id);
          result.archived++;
          
          // Track component archive with authoritative before/after snapshots
          if (importHistoryId) {
            await trackChange(importHistoryId, 'archived', 'component', component.id, component, archivedComponent);
          }
          
          console.log(`📦 Archived component: ${component.componentCode}`);
        }
      }
    }
    
    console.log(`✅ Component import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.archived} archived`);
  } else if (type === 'spares') {
    const sparesVesselId = vesselId || 'V001';
    console.log(`🚀 Starting spares import: ${data.length} rows, mode: ${mode}, vesselId: ${sparesVesselId}`);
    
    // Step 1: Fetch all components for validation
    const allComponents = await storage.getComponents(sparesVesselId);
    const componentsByCode = new Map(allComponents.map(c => [c.componentCode, c]));
    console.log(`📋 Loaded ${allComponents.length} components for validation`);
    
    // Step 2: Fetch existing spares to check for duplicates and generate Part Codes
    const existingSpares = await storage.getSpares(sparesVesselId);
    const sparesByPartCode = new Map(existingSpares.map(s => [s.partCode, s]));
    
    // Step 3: Generate next Part Code sequence
    let maxPartCodeNum = 0;
    existingSpares.forEach(spare => {
      if (spare.partCode && spare.partCode.startsWith('PT-')) {
        const match = spare.partCode.match(/PT-(\d+)/);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxPartCodeNum) maxPartCodeNum = num;
        }
      }
    });
    let nextPartCodeNum = maxPartCodeNum + 1;
    console.log(`🔢 Next auto-generated Part Code will be: PT-${String(nextPartCodeNum).padStart(6, '0')}`);
    
    // Step 4: Process each row with validation
    for (const row of data) {
      try {
        // Validate Component Code exists
        const componentCode = String(row['Component Code']).trim();
        const component = componentsByCode.get(componentCode);
        
        if (!component) {
          console.warn(`⚠️ Component ${componentCode} not found in system, skipping spare`);
          result.skipped++;
          continue;
        }
        
        // Auto-generate Part Code if not provided
        let partCode = row['Part Code'] ? String(row['Part Code']).trim() : '';
        if (!partCode || partCode === '') {
          partCode = `PT-${String(nextPartCodeNum).padStart(6, '0')}`;
          nextPartCodeNum++;
          console.log(`✨ Auto-generated Part Code: ${partCode}`);
        }
        
        // Check for duplicates
        const existingSpare = sparesByPartCode.get(partCode);
        
        if (mode === 'add') {
          if (existingSpare) {
            console.log(`⏭️ Part Code ${partCode} already exists, skipping`);
            result.skipped++;
            continue;
          }
          
          // Create new spare - Support new template format (Criticality) and legacy formats
          const criticalVal = row['Criticality'] || row['Critical Yes/No'] || row['Criticality (Yes/No)'];
          const isActiveVal = row['Is Active'] || row['IS Active'];
          const ihmVal = row['IHM (Inventory of Hazardous Materials)'];
          
          // Calculate Total ROB from Location A - ROB and Location B - ROB if not provided
          let totalRob = 0;
          if (row['Total ROB'] !== undefined && row['Total ROB'] !== null && row['Total ROB'] !== '') {
            totalRob = parseInt(row['Total ROB']) || 0;
          } else {
            const locARob = parseInt(row['Location A - ROB']) || 0;
            const locBRob = parseInt(row['Location B - ROB']) || 0;
            totalRob = locARob + locBRob;
          }
          
          // Parse individual ROB values for each location
          const robLocationAVal = parseInt(row['Location A - ROB']) || 0;
          const robLocationBVal = parseInt(row['Location B - ROB']) || 0;
          
          const newSpare = await storage.createSpare({
            partCode: partCode,
            partName: String(row['Part Name']).trim(),
            componentId: component.id,
            componentCode: componentCode,
            componentName: component.name || '',
            componentSpareCode: `SP-${componentCode}-${String(result.created + 1).padStart(3, '0')}`,
            critical: criticalVal === 'Yes' || criticalVal === true ? 'Yes' : 'No',
            rob: totalRob,
            robLocationA: robLocationAVal,
            robLocationB: robLocationBVal,
            min: row['Minimum Stock'] ? parseInt(row['Minimum Stock']) : 0,
            location: row['Location A'] ? String(row['Location A']).trim() : null,
            location2: row['Location B'] ? String(row['Location B']).trim() : null,
            vesselId: sparesVesselId,
            partNumber: row['Part Number'] ? String(row['Part Number']).trim() : null,
            uom: (row['UOM'] || row['Unit Of Measurement']) ? String(row['UOM'] || row['Unit Of Measurement']).toUpperCase() : null,
            maker: (row['Maker'] || row['Maker Name']) ? String(row['Maker'] || row['Maker Name']).trim() : null,
            makerCode: row['Maker Code'] ? String(row['Maker Code']).trim() : null,
            specification: row['Specification'] ? String(row['Specification']).trim() : null,
            drawingNumber: (row['Drawing Number'] || row['Drawing No']) ? String(row['Drawing Number'] || row['Drawing No']).trim() : null,
            positionNumber: row['Position Number'] ? String(row['Position Number']).trim() : null,
            note: row['Note'] ? String(row['Note']).trim() : null,
            manualName: row['Manual Name'] ? String(row['Manual Name']).trim() : null,
            pageNumber: row['Page Number'] ? String(row['Page Number']).trim() : null,
            isActive: isActiveVal === 'Yes' || isActiveVal === true ? true : (isActiveVal === 'No' ? false : true),
            ihm: ihmVal === 'Yes' || ihmVal === true ? 'Yes' : 'No',
            remarks: row['Evidence Type'] ? String(row['Evidence Type']).trim() : null,
            dataScope: 'vessel'
          });
          
          sparesByPartCode.set(partCode, newSpare);
          result.created++;
          
          // Track change if history tracking is enabled
          if (importHistoryId) {
            await trackChange(importHistoryId, 'created', 'spare', String(newSpare.id), null, newSpare);
          }
          
          // Process inventory: create location entities, links, and stock records
          await processSpareInventory({
            spareId: newSpare.id,
            vesselId: sparesVesselId,
            componentId: component.id,
            locationAName: row['Location A'] ? String(row['Location A']).trim() : null,
            locationBName: row['Location B'] ? String(row['Location B']).trim() : null,
            robLocationA: robLocationAVal,
            robLocationB: robLocationBVal,
            isNewSpare: true,
            userId: 'system-import',
          });
          
          console.log(`✅ Created spare: ${partCode} - ${newSpare.partName}`);
          
        } else if (mode === 'update') {
          if (!existingSpare) {
            console.log(`⏭️ Part Code ${partCode} not found for update, skipping`);
            result.skipped++;
            continue;
          }
          
          // Update existing spare - Support new template format and legacy formats
          const criticalValUpdate = row['Criticality'] || row['Critical Yes/No'] || row['Criticality (Yes/No)'];
          const isActiveValUpdate = row['Is Active'] || row['IS Active'];
          const ihmValUpdate = row['IHM (Inventory of Hazardous Materials)'];
          
          // Calculate Total ROB from Location A - ROB and Location B - ROB if not provided
          let totalRobUpdate = existingSpare.rob;
          if (row['Total ROB'] !== undefined && row['Total ROB'] !== null && row['Total ROB'] !== '') {
            totalRobUpdate = parseInt(row['Total ROB']) || 0;
          } else if (row['Location A - ROB'] !== undefined || row['Location B - ROB'] !== undefined) {
            const locARob = parseInt(row['Location A - ROB']) || 0;
            const locBRob = parseInt(row['Location B - ROB']) || 0;
            totalRobUpdate = locARob + locBRob;
          }
          
          // Parse individual ROB values for each location
          const robLocationAUpdate = row['Location A - ROB'] !== undefined ? (parseInt(row['Location A - ROB']) || 0) : existingSpare.robLocationA;
          const robLocationBUpdate = row['Location B - ROB'] !== undefined ? (parseInt(row['Location B - ROB']) || 0) : existingSpare.robLocationB;
          
          const updatedSpare = await storage.updateSpare(existingSpare.id, {
            partName: String(row['Part Name']).trim(),
            componentId: component.id,
            componentCode: componentCode,
            componentName: component.name || '',
            critical: criticalValUpdate === 'Yes' || criticalValUpdate === true ? 'Yes' : 'No',
            rob: totalRobUpdate,
            robLocationA: robLocationAUpdate,
            robLocationB: robLocationBUpdate,
            min: row['Minimum Stock'] ? parseInt(row['Minimum Stock']) : existingSpare.min,
            location: row['Location A'] ? String(row['Location A']).trim() : existingSpare.location,
            location2: row['Location B'] ? String(row['Location B']).trim() : existingSpare.location2,
            partNumber: row['Part Number'] ? String(row['Part Number']).trim() : existingSpare.partNumber,
            uom: (row['UOM'] || row['Unit Of Measurement']) ? String(row['UOM'] || row['Unit Of Measurement']).toUpperCase() : existingSpare.uom,
            maker: (row['Maker'] || row['Maker Name']) ? String(row['Maker'] || row['Maker Name']).trim() : existingSpare.maker,
            makerCode: row['Maker Code'] ? String(row['Maker Code']).trim() : existingSpare.makerCode,
            specification: row['Specification'] ? String(row['Specification']).trim() : existingSpare.specification,
            drawingNumber: (row['Drawing Number'] || row['Drawing No']) ? String(row['Drawing Number'] || row['Drawing No']).trim() : existingSpare.drawingNumber,
            positionNumber: row['Position Number'] ? String(row['Position Number']).trim() : existingSpare.positionNumber,
            note: row['Note'] ? String(row['Note']).trim() : existingSpare.note,
            manualName: row['Manual Name'] ? String(row['Manual Name']).trim() : existingSpare.manualName,
            pageNumber: row['Page Number'] ? String(row['Page Number']).trim() : existingSpare.pageNumber,
            isActive: isActiveValUpdate === 'Yes' || isActiveValUpdate === true ? true : (isActiveValUpdate === 'No' ? false : existingSpare.isActive),
            ihm: ihmValUpdate === 'Yes' || ihmValUpdate === true ? 'Yes' : (ihmValUpdate === 'No' ? 'No' : existingSpare.ihm),
            remarks: row['Evidence Type'] ? String(row['Evidence Type']).trim() : existingSpare.remarks
          });
          
          sparesByPartCode.set(partCode, updatedSpare);
          result.updated++;
          
          if (importHistoryId) {
            await trackChange(importHistoryId, 'updated', 'spare', String(updatedSpare.id), existingSpare, updatedSpare);
          }
          
          // Process inventory for updated spare (updates links and stock, no opening balance)
          await processSpareInventory({
            spareId: updatedSpare.id,
            vesselId: sparesVesselId,
            componentId: component.id,
            locationAName: row['Location A'] ? String(row['Location A']).trim() : existingSpare.location,
            locationBName: row['Location B'] ? String(row['Location B']).trim() : existingSpare.location2,
            robLocationA: robLocationAUpdate,
            robLocationB: robLocationBUpdate,
            isNewSpare: false,
            userId: 'system-import',
          });
          
          console.log(`🔄 Updated spare: ${partCode} - ${updatedSpare.partName}`);
          
        } else if (mode === 'upsert') {
          // Support new template format and legacy formats for criticality
          const criticalValUpsert = row['Criticality'] || row['Critical Yes/No'] || row['Criticality (Yes/No)'];
          const isActiveValUpsert = row['Is Active'] || row['IS Active'];
          const ihmValUpsert = row['IHM (Inventory of Hazardous Materials)'];
          
          // Calculate Total ROB from Location A - ROB and Location B - ROB if not provided
          let totalRobUpsert = 0;
          if (row['Total ROB'] !== undefined && row['Total ROB'] !== null && row['Total ROB'] !== '') {
            totalRobUpsert = parseInt(row['Total ROB']) || 0;
          } else {
            const locARob = parseInt(row['Location A - ROB']) || 0;
            const locBRob = parseInt(row['Location B - ROB']) || 0;
            totalRobUpsert = locARob + locBRob;
          }
          
          // Parse individual ROB values for each location
          const robLocationAUpsert = parseInt(row['Location A - ROB']) || 0;
          const robLocationBUpsert = parseInt(row['Location B - ROB']) || 0;
          
          if (existingSpare) {
            // Update existing
            const updatedSpare = await storage.updateSpare(existingSpare.id, {
              partName: String(row['Part Name']).trim(),
              componentId: component.id,
              componentCode: componentCode,
              componentName: component.name || '',
              critical: criticalValUpsert === 'Yes' || criticalValUpsert === true ? 'Yes' : 'No',
              rob: totalRobUpsert || existingSpare.rob,
              robLocationA: row['Location A - ROB'] !== undefined ? robLocationAUpsert : existingSpare.robLocationA,
              robLocationB: row['Location B - ROB'] !== undefined ? robLocationBUpsert : existingSpare.robLocationB,
              min: row['Minimum Stock'] ? parseInt(row['Minimum Stock']) : existingSpare.min,
              location: row['Location A'] ? String(row['Location A']).trim() : existingSpare.location,
              location2: row['Location B'] ? String(row['Location B']).trim() : existingSpare.location2,
              partNumber: row['Part Number'] ? String(row['Part Number']).trim() : existingSpare.partNumber,
              uom: (row['UOM'] || row['Unit Of Measurement']) ? String(row['UOM'] || row['Unit Of Measurement']).toUpperCase() : existingSpare.uom,
              maker: (row['Maker'] || row['Maker Name']) ? String(row['Maker'] || row['Maker Name']).trim() : existingSpare.maker,
              makerCode: row['Maker Code'] ? String(row['Maker Code']).trim() : existingSpare.makerCode,
              specification: row['Specification'] ? String(row['Specification']).trim() : existingSpare.specification,
              drawingNumber: (row['Drawing Number'] || row['Drawing No']) ? String(row['Drawing Number'] || row['Drawing No']).trim() : existingSpare.drawingNumber,
              positionNumber: row['Position Number'] ? String(row['Position Number']).trim() : existingSpare.positionNumber,
              note: row['Note'] ? String(row['Note']).trim() : existingSpare.note,
              manualName: row['Manual Name'] ? String(row['Manual Name']).trim() : existingSpare.manualName,
              pageNumber: row['Page Number'] ? String(row['Page Number']).trim() : existingSpare.pageNumber,
              isActive: isActiveValUpsert === 'Yes' || isActiveValUpsert === true ? true : (isActiveValUpsert === 'No' ? false : existingSpare.isActive),
              ihm: ihmValUpsert === 'Yes' || ihmValUpsert === true ? 'Yes' : (ihmValUpsert === 'No' ? 'No' : existingSpare.ihm),
              remarks: row['Evidence Type'] ? String(row['Evidence Type']).trim() : existingSpare.remarks
            });
            
            sparesByPartCode.set(partCode, updatedSpare);
            result.updated++;
            
            if (importHistoryId) {
              await trackChange(importHistoryId, 'updated', 'spare', String(updatedSpare.id), existingSpare, updatedSpare);
            }
            
            // Process inventory for upsert-updated spare
            await processSpareInventory({
              spareId: updatedSpare.id,
              vesselId: sparesVesselId,
              componentId: component.id,
              locationAName: row['Location A'] ? String(row['Location A']).trim() : existingSpare.location,
              locationBName: row['Location B'] ? String(row['Location B']).trim() : existingSpare.location2,
              robLocationA: row['Location A - ROB'] !== undefined ? robLocationAUpsert : existingSpare.robLocationA,
              robLocationB: row['Location B - ROB'] !== undefined ? robLocationBUpsert : existingSpare.robLocationB,
              isNewSpare: false,
              userId: 'system-import',
            });
            
            console.log(`🔄 Updated spare (upsert): ${partCode} - ${updatedSpare.partName}`);
          } else {
            // Create new - use criticalValUpsert from parent scope
            const newSpare = await storage.createSpare({
              partCode: partCode,
              partName: String(row['Part Name']).trim(),
              componentId: component.id,
              componentCode: componentCode,
              componentName: component.name || '',
              componentSpareCode: `SP-${componentCode}-${String(result.created + 1).padStart(3, '0')}`,
              critical: criticalValUpsert === 'Yes' || criticalValUpsert === true ? 'Yes' : 'No',
              rob: totalRobUpsert,
              robLocationA: robLocationAUpsert,
              robLocationB: robLocationBUpsert,
              min: row['Minimum Stock'] ? parseInt(row['Minimum Stock']) : 0,
              location: row['Location A'] ? String(row['Location A']).trim() : null,
              location2: row['Location B'] ? String(row['Location B']).trim() : null,
              vesselId: sparesVesselId,
              partNumber: row['Part Number'] ? String(row['Part Number']).trim() : null,
              uom: (row['UOM'] || row['Unit Of Measurement']) ? String(row['UOM'] || row['Unit Of Measurement']).toUpperCase() : null,
              maker: (row['Maker'] || row['Maker Name']) ? String(row['Maker'] || row['Maker Name']).trim() : null,
              makerCode: row['Maker Code'] ? String(row['Maker Code']).trim() : null,
              specification: row['Specification'] ? String(row['Specification']).trim() : null,
              drawingNumber: (row['Drawing Number'] || row['Drawing No']) ? String(row['Drawing Number'] || row['Drawing No']).trim() : null,
              positionNumber: row['Position Number'] ? String(row['Position Number']).trim() : null,
              note: row['Note'] ? String(row['Note']).trim() : null,
              manualName: row['Manual Name'] ? String(row['Manual Name']).trim() : null,
              pageNumber: row['Page Number'] ? String(row['Page Number']).trim() : null,
              isActive: isActiveValUpsert === 'Yes' || isActiveValUpsert === true ? true : (isActiveValUpsert === 'No' ? false : true),
              ihm: ihmValUpsert === 'Yes' || ihmValUpsert === true ? 'Yes' : 'No',
              remarks: row['Evidence Type'] ? String(row['Evidence Type']).trim() : null,
              dataScope: 'vessel'
            });
            
            sparesByPartCode.set(partCode, newSpare);
            result.created++;
            
            if (importHistoryId) {
              await trackChange(importHistoryId, 'created', 'spare', String(newSpare.id), null, newSpare);
            }
            
            // Process inventory for upsert-created spare
            await processSpareInventory({
              spareId: newSpare.id,
              vesselId: sparesVesselId,
              componentId: component.id,
              locationAName: row['Location A'] ? String(row['Location A']).trim() : null,
              locationBName: row['Location B'] ? String(row['Location B']).trim() : null,
              robLocationA: robLocationAUpsert,
              robLocationB: robLocationBUpsert,
              isNewSpare: true,
              userId: 'system-import',
            });
            
            console.log(`✅ Created spare (upsert): ${partCode} - ${newSpare.partName}`);
          }
        }
      } catch (error: any) {
        console.error(`❌ Error processing spare row:`, error);
        result.skipped++;
      }
    }
    
    console.log(`✅ Spares import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
  } else if (type === 'stores') {
    console.log(`🚀 Starting stores import: ${data.length} rows, mode: ${mode}, vesselId: ${vesselId}, storeType: ${storeType}`);
    
    // Fetch existing stores items for this vessel
    const existingStoresItems = await storage.getStoresItems(vesselId || '');
    const storesByItemCode = new Map(existingStoresItems.map(s => [s.itemCode, s]));
    
    // Use the storeType passed from frontend - this determines which tab the data goes to
    // Valid values: 'stores', 'lubricants', 'chemicals', 'others'
    const itemType = storeType || 'stores';
    console.log(`📌 All imported items will be assigned to itemType: ${itemType}`);
    
    for (const row of data) {
      try {
        const itemCode = String(row['Item Code'] || '').trim();
        if (!itemCode) {
          console.log('⏭️ Skipping row with empty Item Code');
          result.skipped++;
          continue;
        }
        
        const itemName = String(row['Item Name'] || '').trim();
        if (!itemName) {
          console.log(`⏭️ Skipping row ${itemCode} with empty Item Name`);
          result.skipped++;
          continue;
        }
        
        // Get category from the Category column (purely descriptive, not for routing)
        const categoryRaw = String(row['Category'] || '').trim();
        
        // Helper to get ROB values - support both new and old field names
        const getTotalRob = () => row['Total ROB'] ?? row['ROB'] ?? 0;
        const getLocationARob = () => row['Location A - ROB'] ?? row['ROB Location A'] ?? 0;
        const getLocationBRob = () => row['Location B - ROB'] ?? row['ROB Location B'] ?? 0;
        
        const existingItem = storesByItemCode.get(itemCode);
        
        if (mode === 'add') {
          if (existingItem) {
            result.skipped++;
            continue;
          }
          
          const newStoresItem = await storage.createStoresItem({
            vesselId: vesselId || '',
            itemCode,
            impaCode: row['IMPA Code'] ? String(row['IMPA Code']).trim() : null,
            itemName,
            itemType,
            category: categoryRaw || null,
            specification: null,
            uom: row['UOM'] ? String(row['UOM']).trim() : null,
            rob: String(getTotalRob()),
            robLocationA: String(getLocationARob()),
            robLocationB: String(getLocationBRob()),
            locationA: row['Location A'] ? String(row['Location A']).trim() : null,
            locationB: row['Location B'] ? String(row['Location B']).trim() : null,
            min: String(row['Min'] ?? 0),
            max: null,
            unitCost: null,
            supplier: null,
            lastOrderDate: null,
            leadTime: null,
            ihm: false,
            ihmDetails: null,
            remarks: null,
            isActive: true
          });
          
          storesByItemCode.set(itemCode, newStoresItem);
          result.created++;
          
          if (importHistoryId) {
            await trackChange(importHistoryId, 'created', 'storesItem', String(newStoresItem.id), null, newStoresItem);
          }
          
          console.log(`✅ Created stores item: ${itemCode} - ${itemName}`);
        } else if (mode === 'update') {
          if (!existingItem) {
            result.skipped++;
            continue;
          }
          
          const previousSnapshot = createRecordSnapshot(existingItem);
          
          const updated = await storage.updateStoresItem(existingItem.id, {
            impaCode: row['IMPA Code'] ? String(row['IMPA Code']).trim() : existingItem.impaCode,
            itemName: itemName || existingItem.itemName,
            itemType,
            category: categoryRaw || existingItem.category,
            uom: row['UOM'] ? String(row['UOM']).trim() : existingItem.uom,
            rob: row['Total ROB'] !== undefined ? String(row['Total ROB']) : existingItem.rob,
            robLocationA: row['Location A - ROB'] !== undefined ? String(row['Location A - ROB']) : existingItem.robLocationA,
            robLocationB: row['Location B - ROB'] !== undefined ? String(row['Location B - ROB']) : existingItem.robLocationB,
            locationA: row['Location A'] ? String(row['Location A']).trim() : existingItem.locationA,
            locationB: row['Location B'] ? String(row['Location B']).trim() : existingItem.locationB,
            min: row['Min'] !== undefined ? String(row['Min']) : existingItem.min
          });
          
          storesByItemCode.set(itemCode, updated);
          result.updated++;
          
          if (importHistoryId) {
            await trackChange(importHistoryId, 'updated', 'storesItem', String(existingItem.id), previousSnapshot, updated);
          }
          
          console.log(`✅ Updated stores item: ${itemCode}`);
        } else {
          // Upsert mode
          if (existingItem) {
            const previousSnapshot = createRecordSnapshot(existingItem);
            
            const updated = await storage.updateStoresItem(existingItem.id, {
              impaCode: row['IMPA Code'] ? String(row['IMPA Code']).trim() : existingItem.impaCode,
              itemName: itemName || existingItem.itemName,
              itemType,
              category: categoryRaw || existingItem.category,
              uom: row['UOM'] ? String(row['UOM']).trim() : existingItem.uom,
              rob: row['Total ROB'] !== undefined ? String(row['Total ROB']) : existingItem.rob,
              robLocationA: row['Location A - ROB'] !== undefined ? String(row['Location A - ROB']) : existingItem.robLocationA,
              robLocationB: row['Location B - ROB'] !== undefined ? String(row['Location B - ROB']) : existingItem.robLocationB,
              locationA: row['Location A'] ? String(row['Location A']).trim() : existingItem.locationA,
              locationB: row['Location B'] ? String(row['Location B']).trim() : existingItem.locationB,
              min: row['Min'] !== undefined ? String(row['Min']) : existingItem.min
            });
            
            storesByItemCode.set(itemCode, updated);
            result.updated++;
            
            if (importHistoryId) {
              await trackChange(importHistoryId, 'updated', 'storesItem', String(existingItem.id), previousSnapshot, updated);
            }
            
            console.log(`✅ Updated stores item (upsert): ${itemCode}`);
          } else {
            const newStoresItem = await storage.createStoresItem({
              vesselId: vesselId || '',
              itemCode,
              impaCode: row['IMPA Code'] ? String(row['IMPA Code']).trim() : null,
              itemName,
              itemType,
              category: categoryRaw || null,
              specification: null,
              uom: row['UOM'] ? String(row['UOM']).trim() : null,
              rob: String(getTotalRob()),
              robLocationA: String(getLocationARob()),
              robLocationB: String(getLocationBRob()),
              locationA: row['Location A'] ? String(row['Location A']).trim() : null,
              locationB: row['Location B'] ? String(row['Location B']).trim() : null,
              min: String(row['Min'] ?? 0),
              max: null,
              unitCost: null,
              supplier: null,
              lastOrderDate: null,
              leadTime: null,
              ihm: false,
              ihmDetails: null,
              remarks: null,
              isActive: true
            });
            
            storesByItemCode.set(itemCode, newStoresItem);
            result.created++;
            
            if (importHistoryId) {
              await trackChange(importHistoryId, 'created', 'storesItem', String(newStoresItem.id), null, newStoresItem);
            }
            
            console.log(`✅ Created stores item (upsert): ${itemCode} - ${itemName}`);
          }
        }
      } catch (error: any) {
        console.error(`❌ Error processing stores item row:`, error);
        result.skipped++;
      }
    }
    
    console.log(`✅ Stores import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
  } else if (type === 'work-orders') {
    console.log(`🚀 Starting work-orders import: ${data.length} rows, mode: ${mode}, vesselId: ${vesselId}`);
    
    // Generate WO code sequence counter for each component-year combination
    // Format: WO-{ComponentCode}-{Year}-{Sequence}
    const currentYear = new Date().getFullYear().toString();
    const woSequenceMap = new Map<string, number>();
    
    // Step 1: Prefetch all work orders and generate template codes for bulk lookup
    const allWorkOrders = await storage.getWorkOrders(vesselId);
    const allTemplateCodes = data.map(row => {
      const componentCode = String(row['Generated_Component_Code']).trim();
      const componentYearKey = `${componentCode}-${currentYear}`;
      
      // Calculate sequence for this component-year
      if (!woSequenceMap.has(componentYearKey)) {
        const componentYearWOs = allWorkOrders.filter(wo => 
          wo.templateCode?.startsWith(`WO-${componentCode}-${currentYear}-`)
        );
        const maxSeq = componentYearWOs.length > 0 
          ? Math.max(...componentYearWOs.map(wo => {
              const match = wo.templateCode?.match(/-(\d+)$/);
              return match ? parseInt(match[1]) : 0;
            }))
          : 0;
        woSequenceMap.set(componentYearKey, maxSeq + 1);
      }
      
      const sequence = woSequenceMap.get(componentYearKey)!;
      return `WO-${componentCode}-${currentYear}-${String(sequence).padStart(2, '0')}`;
    });
    
    const workOrdersByTemplateCode = await storage.getWorkOrdersByTemplateIds(allTemplateCodes, vesselId);
    
    // Step 2: Process each row individually with authoritative state capture
    for (const row of data) {
      const componentCode = String(row['Generated_Component_Code']).trim();
      const componentYearKey = `${componentCode}-${currentYear}`;
      
      const sequence = woSequenceMap.get(componentYearKey)!;
      const templateCode = `WO-${componentCode}-${currentYear}-${String(sequence).padStart(2, '0')}`;
      
      const existingWorkOrder = workOrdersByTemplateCode.get(templateCode);

      if (mode === 'add') {
        if (!existingWorkOrder) {
          const newWorkOrder = await createWorkOrderFromRow(row, templateCode, vesselId);
          workOrdersByTemplateCode.set(templateCode, newWorkOrder);
          result.created++;
          woSequenceMap.set(componentYearKey, sequence + 1);
          
          // Track work order creation with authoritative state
          if (importHistoryId) {
            await trackChange(importHistoryId, 'created', 'workOrder', newWorkOrder.id, null, newWorkOrder);
          }
        } else {
          result.skipped++;
        }
      } else if (mode === 'update') {
        if (existingWorkOrder) {
          const previousSnapshot = createRecordSnapshot(existingWorkOrder);
          const updatedWorkOrder = await updateWorkOrderFromRow(existingWorkOrder.id, row);
          workOrdersByTemplateCode.set(templateCode, updatedWorkOrder);
          result.updated++;
          
          // Track work order update with authoritative before/after snapshots
          if (importHistoryId) {
            await trackChange(importHistoryId, 'updated', 'workOrder', updatedWorkOrder.id, existingWorkOrder, updatedWorkOrder);
          }
        } else {
          result.skipped++;
        }
      } else if (mode === 'upsert') {
        if (existingWorkOrder) {
          const previousSnapshot = createRecordSnapshot(existingWorkOrder);
          const updatedWorkOrder = await updateWorkOrderFromRow(existingWorkOrder.id, row);
          workOrdersByTemplateCode.set(templateCode, updatedWorkOrder);
          result.updated++;
          
          // Track work order update with authoritative before/after snapshots
          if (importHistoryId) {
            await trackChange(importHistoryId, 'updated', 'workOrder', updatedWorkOrder.id, existingWorkOrder, updatedWorkOrder);
          }
        } else {
          const newWorkOrder = await createWorkOrderFromRow(row, templateCode, vesselId);
          workOrdersByTemplateCode.set(templateCode, newWorkOrder);
          result.created++;
          woSequenceMap.set(componentYearKey, sequence + 1);
          
          // Track work order creation with authoritative state
          if (importHistoryId) {
            await trackChange(importHistoryId, 'created', 'workOrder', newWorkOrder.id, null, newWorkOrder);
          }
        }
      }
    }
    
    // Step 3: Archive missing work orders if requested
    if (archiveMissing) {
      const importedTemplateCodes = new Set(allTemplateCodes);
      
      for (const workOrder of allWorkOrders) {
        if (workOrder.templateCode && !importedTemplateCodes.has(workOrder.templateCode)) {
          const previousSnapshot = createRecordSnapshot(workOrder);
          const archivedWorkOrder = await storage.archiveWorkOrder(workOrder.id);
          result.archived++;
          
          // Track work order archive with authoritative before/after snapshots
          if (importHistoryId) {
            await trackChange(importHistoryId, 'archived', 'workOrder', workOrder.id, workOrder, archivedWorkOrder);
          }
          
          console.log(`📦 Archived work order: ${workOrder.templateCode}`);
        }
      }
    }
    
    console.log(`✅ Work-orders import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.archived} archived`);
  } else if (type === 'jobs') {
    // Import jobs using storage layer
    console.log(`🚀 Starting jobs import: ${data.length} rows, mode: ${mode}, vesselId: ${vesselId}`);
    
    // Step 1: Prefetch all existing jobs by job numbers for performance
    const allJobNos = data.map(row => row['Job Code'] ? String(row['Job Code']).trim() : null).filter(Boolean) as string[];
    const jobsByJobNo = await storage.getJobsByJobNos(allJobNos, vesselId);
    
    // Step 1.5: Prefetch all existing components by codes for performance
    const allComponentCodes = data.map(row => String(row['Component Code']).trim());
    const componentsByCode = await storage.getComponentsByCodes(allComponentCodes, vesselId);
    
    // Step 2: Process each row individually with authoritative state capture
    for (const row of data) {
      const componentCode = String(row['Component Code']).trim();
      const vesselCodeFromExcel = String(row['Vessel Code']).trim();
      
      // Resolve actual component from prefetched map
      const component = componentsByCode.get(componentCode);
      if (!component) {
        console.error(`⚠️ Component not found: ${componentCode}, skipping job`);
        result.skipped++;
        continue;
      }
      
      // Use canonical vesselId from request parameter (FK reference)
      // vesselCode is for display/tracking only
      const canonicalVesselId = vesselId || vesselCodeFromExcel;
      
      // Map Excel columns to job schema fields (21-column specification)
      // Normalize Last Done date from Excel (handles various formats including Excel serials)
      const rawLastDone = row['Last Done Date'];
      let lastDoneDate = rawLastDone ? normalizeDateToDDMMMYYYY(rawLastDone) : null;
      
      // If Last Done Date is not provided, use component's installation date as fallback
      if (!lastDoneDate && component.installationDate) {
        try {
          lastDoneDate = normalizeDateToDDMMMYYYY(component.installationDate);
        } catch (error) {
          console.warn(`⚠️ Could not normalize installation date for component ${componentCode}: ${component.installationDate}`);
          lastDoneDate = null;
        }
      }
      
      const frequencyValue = row['Interval Value'] ? String(row['Interval Value']).trim() : null;
      const frequencyUnit = row['Unit'] ? String(row['Unit']).trim() : null;
      const maintenanceBasis = row['Maintenance Basis'];
      
      // Calculate Next Due Date for Calendar-based jobs
      let nextDueDate = null;
      if (maintenanceBasis === 'Calendar' && lastDoneDate && frequencyValue && frequencyUnit) {
        nextDueDate = calculateNextDueDate(lastDoneDate, frequencyValue, frequencyUnit);
      }
      
      // Calculate Next Due RH for Running Hours-based jobs
      // Per documentation: nextDueRH = lastDoneRH + intervalRunningHour
      // SIMPLIFIED: When Unit = "Hours", use Interval Value as the running hours interval
      // (Interval Running Hours column removed from template - now auto-derived)
      // VALIDATION: interval must be a valid number > 0
      let nextDueRH: string | null = null;
      let lastDoneRH: string | null = null;
      
      // Auto-derive intervalRH from Interval Value when Unit = "Hours"
      // Also support legacy templates that still have "Interval Running Hours" column
      let intervalRH: number | null = null;
      const rawIntervalRH = row['Interval Running Hours'];
      const hasExplicitIntervalRH = rawIntervalRH !== undefined && rawIntervalRH !== null && String(rawIntervalRH).trim() !== '';
      
      if (hasExplicitIntervalRH) {
        // Legacy template with explicit Interval Running Hours column
        intervalRH = Number(String(rawIntervalRH).trim());
      } else if (maintenanceBasis === 'Running Hours' && frequencyValue) {
        // New simplified template: For Running Hours jobs, use Interval Value as the running hours interval
        intervalRH = Number(frequencyValue);
      }
      
      if (maintenanceBasis === 'Running Hours') {
        // Validate intervalRunningHour is present and valid for RH jobs
        if (intervalRH === null || isNaN(intervalRH) || intervalRH <= 0) {
          result.skipped++;
          console.warn(`⚠️ Skipping RH job for component ${componentCode}: Invalid or missing Interval Running Hours (must be > 0)`);
          continue;
        }
        
        // Get lastDoneRH from Excel or use component's current RH as starting point
        // If neither is available, default to 0 (component starts fresh)
        const rawLastDoneRH = row['Last Done RH'];
        if (rawLastDoneRH !== undefined && rawLastDoneRH !== null && rawLastDoneRH !== '') {
          lastDoneRH = String(rawLastDoneRH).trim();
        } else if (component.runningHours !== undefined && component.runningHours !== null) {
          // Use component's current running hours as last done RH for new jobs
          lastDoneRH = String(component.runningHours);
        } else {
          // Default to 0 when no running hours in system - treat as new component starting from zero
          lastDoneRH = '0';
          console.log(`ℹ️ Component ${componentCode} has no running hours - defaulting Last Done RH to 0`);
        }
        
        const lastRH = Number(lastDoneRH);
        if (isNaN(lastRH)) {
          result.skipped++;
          console.warn(`⚠️ Skipping RH job for component ${componentCode}: lastDoneRH is not a valid number`);
          continue;
        }
        
        // Calculate nextDueRH = lastDoneRH + interval (guaranteed to succeed)
        nextDueRH = String(lastRH + intervalRH);
      }
      
      // Parse spare parts, tools, and safety requirements from Excel (semicolon-separated)
      // Returns string array for safety requirements
      const parseStringList = (value: any): string[] => {
        if (!value) return [];
        const str = String(value).trim();
        if (!str) return [];
        return str.split(';').map(s => s.trim()).filter(s => s.length > 0);
      };
      
      // Parse spare parts from semicolon-separated string into structured objects
      // Format: "Part Name 1; Part Name 2" => [{partNo: '', description: 'Part Name 1', quantityRequired: '', remarks: ''}, ...]
      const parseSpareParts = (value: any): Array<{partNo: string, description: string, quantityRequired: string, remarks: string}> => {
        const items = parseStringList(value);
        return items.map(item => ({
          partNo: '',
          description: item,
          quantityRequired: '',
          remarks: ''
        }));
      };
      
      // Parse tools from semicolon-separated string into structured objects
      // Format: "Tool 1; Tool 2" => [{toolName: 'Tool 1', quantity: '', remarks: ''}, ...]
      const parseTools = (value: any): Array<{toolName: string, quantity: string, remarks: string}> => {
        const items = parseStringList(value);
        return items.map(item => ({
          toolName: item,
          quantity: '',
          remarks: ''
        }));
      };
      
      const jobData: any = {
        vesselId: canonicalVesselId,        // FK reference to vessel
        vesselCode: vesselCodeFromExcel,    // Display/tracking field from Excel
        componentId: component.id,          // FK reference to component (UUID)
        componentCode: componentCode,       // Display/tracking field (SFI code)
        componentName: row['Component Name'] || component.name || null,
        fleetEquipmentCode: row['Fleet Equipment Code'] || null,
        fleetEquipmentName: row['Fleet Equipment Name'] || null,
        jobTitle: row['WO Title'],          // Job title from WO Title column
        maintenanceType: row['Task Type'],  // maintenanceType from Task Type column
        maintenanceBasis: maintenanceBasis,
        frequencyValue: frequencyValue ? parseFloat(frequencyValue) : null,
        frequencyUnit: frequencyUnit,
        // For Running Hours jobs: store interval in both fields for compatibility
        intervalRunningHour: intervalRH,
        internalRunningHourNumber: row['Interval Running Hours'] || null,
        jobDescription: row['Brief Work Description'] || null,
        briefWorkDescription: row['Brief Work Description'] || null,  // Store in both fields for compatibility
        assignedTo: row['Assigned To'] || null,
        approver: row['Approver'] || null,
        jobPriority: row['Job Priority'] || null,
        // Schema expects text 'Yes'/'No', not boolean
        classRelated: row['Class Related'] ? (row['Class Related'].toString().toLowerCase() === 'yes' ? 'Yes' : 'No') : null,
        lastDoneDate: lastDoneDate,         // Store Last Done date (for Calendar jobs)
        nextDueDate: nextDueDate,           // Calculated: lastDoneDate + frequencyValue + frequencyUnit (for Calendar jobs)
        lastDoneRH: lastDoneRH,             // Store Last Done RH (for RH jobs)
        nextDueRH: nextDueRH,               // Calculated: lastDoneRH + intervalRunningHour (for RH jobs)
        department: row['Department'] || null,
        // Support both template format (Critical Yes/No) and legacy format (Criticality)
        // Schema expects text 'Yes'/'No', not boolean
        criticality: (() => {
          const critVal = row['Critical Yes/No'] ?? row['Criticality'];
          if (!critVal) return null;
          const isYes = critVal === true || critVal.toString().toLowerCase() === 'yes' || critVal.toString().toLowerCase() === 'y';
          return isYes ? 'Yes' : 'No';
        })(),
        isActive: row['Is Active'] ? (row['Is Active'].toString().toLowerCase() === 'yes') : true,
        // Part A fields - Required Spare Parts, Tools, and Safety Requirements
        // Spare parts and tools are parsed into structured objects matching schema
        requiredSpareParts: parseSpareParts(row['Required Spare Parts']),
        requiredTools: parseTools(row['Required Tools']),
        safetyRequirements: {
          ppeRequirements: parseStringList(row['PPE Requirements']),
          permitRequirements: parseStringList(row['Permit Requirements']),
          otherRequirements: parseStringList(row['Other Safety Requirements'])
        }
      };
      
      // Auto-generate job number if not provided (format: JOB-XXXXXXX)
      if (!row['Job Code']) {
        const { nanoid } = await import('nanoid');
        jobData.jobNo = `JOB-${nanoid(7).toUpperCase()}`;
      } else {
        jobData.jobNo = String(row['Job Code']).trim();
      }
      
      // Check if job already exists by job number (using prefetched map)
      const existingJob = jobsByJobNo.get(jobData.jobNo);
      
      if (mode === 'add') {
        if (!existingJob) {
          const createdJob = await storage.createJob(jobData);
          jobsByJobNo.set(createdJob.jobNo, createdJob);
          result.created++;
          
          // Track job creation with canonical state (refetch for accuracy)
          if (importHistoryId) {
            const canonicalJob = await storage.getJob(createdJob.id);
            await trackChange(importHistoryId, 'created', 'job', createdJob.id, null, canonicalJob);
          }
        } else {
          result.skipped++;
        }
      } else if (mode === 'update') {
        if (existingJob) {
          const previousSnapshot = createRecordSnapshot(existingJob);
          const updatedJob = await storage.updateJob(existingJob.id, jobData);
          jobsByJobNo.set(updatedJob.jobNo, updatedJob);
          result.updated++;
          
          // Track job update with canonical state (refetch for accuracy)
          if (importHistoryId) {
            const canonicalJob = await storage.getJob(updatedJob.id);
            await trackChange(importHistoryId, 'updated', 'job', updatedJob.id, existingJob, canonicalJob);
          }
        } else {
          result.skipped++;
        }
      } else if (mode === 'upsert') {
        if (existingJob) {
          const previousSnapshot = createRecordSnapshot(existingJob);
          const updatedJob = await storage.updateJob(existingJob.id, jobData);
          jobsByJobNo.set(updatedJob.jobNo, updatedJob);
          result.updated++;
          
          // Track job update with canonical state (refetch for accuracy)
          if (importHistoryId) {
            const canonicalJob = await storage.getJob(updatedJob.id);
            await trackChange(importHistoryId, 'updated', 'job', updatedJob.id, existingJob, canonicalJob);
          }
        } else {
          const createdJob = await storage.createJob(jobData);
          jobsByJobNo.set(createdJob.jobNo, createdJob);
          result.created++;
          
          // Track job creation with canonical state (refetch for accuracy)
          if (importHistoryId) {
            const canonicalJob = await storage.getJob(createdJob.id);
            await trackChange(importHistoryId, 'created', 'job', createdJob.id, null, canonicalJob);
          }
        }
      }
    }
    
    // Step 3: Archive missing jobs if requested
    if (archiveMissing) {
      const importedJobNos = new Set(
        data
          .map(row => row['Job Code'] ? String(row['Job Code']).trim() : null)
          .filter(Boolean) as string[]
      );
      const allVesselJobs = await storage.getJobs(vesselId);
      
      for (const job of allVesselJobs) {
        if (job.jobNo && !importedJobNos.has(job.jobNo)) {
          const previousSnapshot = createRecordSnapshot(job);
          const archivedJob = await storage.archiveJob(job.id);
          result.archived++;
          
          // Track job archive with authoritative before/after snapshots
          if (importHistoryId) {
            await trackChange(importHistoryId, 'archived', 'job', job.id, job, archivedJob);
          }
          
          console.log(`📦 Archived job: ${job.jobNo}`);
        }
      }
    }
    
    console.log(`✅ Jobs import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.archived} archived`);
  }

  return result;
}

// Helper function to create component from Excel row
async function createComponentFromRow(row: any, vesselId?: string) {
  const componentCode = String(row['Component Code'] || row['Generated Code'] || row['Original SFI Code']).trim();
  
  // Resolve maker name from maker code if not provided directly
  // Support both 'Maker' and 'Maker Name' column headers
  let makerName = row['Maker'] || row['Maker Name'] || null;
  const makerCode = row['Maker Code'] || null;
  if (!makerName && makerCode) {
    const maker = await storage.getMakerListByCode(String(makerCode).trim());
    if (maker) {
      makerName = maker.makerName;
    }
  }
  
  // Support both new and legacy header formats for department
  const departmentValue = row['Equipment / System Department'] || row['Eqpt / System Department'] || null;
  
  // Support both new and legacy header formats for criticality
  const criticalValue = row['Criticality'] ?? row['Critical Yes/No'] ?? row['Critical (Yes/No)'];
  const isCritical = criticalValue === true || criticalValue === 'Yes';
  
  // Support both new and legacy header formats for condition based
  const conditionBasedValue = row['Condition Based'] ?? row['Condition Based Yes/No'] ?? row['Condition Based (Yes/No)'];
  const isConditionBased = conditionBasedValue === true || conditionBasedValue === 'Yes';
  
  // Support both new and legacy header formats for IS Parent
  const isParentValue = row['IS Parent'] ?? row['IS Parent Yes/No'];
  const isParent = isParentValue === true || isParentValue === 'Yes';
  
  // Support Class Item field (both "Class Item" and "Class item" headers)
  const classItemValue = row['Class Item'] ?? row['Class item'];
  const isClassItem = classItemValue === true || classItemValue === 'Yes';
  
  // Parse RH Counter Type and determine appropriate field mappings
  const rhCounterType = (row['RH Counter Type'] || 'NOT_RH_DRIVEN').toString().toUpperCase().trim();
  const rhCounterSource = row['RH Counter Source'] || null;
  const runningHoursValue = row['Running Hours'] ? String(row['Running Hours']) : null;
  const lastUpdatedValue = row['Last Updated'] ? normalizeDateToDDMMMYYYY(row['Last Updated']) : null;
  
  // Map RH fields based on Counter Type per workflow logic:
  // MASTER: rh_current_master stores actual RH value, rh_counter_source = 'SELF'
  // INHERITED: rh_current_inherited_cached stores cached RH, rh_master_component_id references source component
  // NOT_RH_DRIVEN: All RH fields remain null
  let rhCurrentMaster = null;
  let rhCurrentInheritedCached = null;
  let rhMasterComponentId = null;
  let rhMasterUpdatedAt = null;
  let rhInheritedUpdatedAt = null;
  let rhMasterUpdateSource = null;
  
  if (rhCounterType === 'MASTER') {
    // MASTER components maintain their own RH value
    rhCurrentMaster = runningHoursValue;
    rhMasterUpdatedAt = new Date();
    rhMasterUpdateSource = 'IMPORT';
  } else if (rhCounterType === 'INHERITED') {
    // INHERITED components cache the RH value and reference a MASTER component
    rhCurrentInheritedCached = runningHoursValue;
    rhInheritedUpdatedAt = new Date();
    // RH Counter Source for INHERITED should be the MASTER component's code (not 'SELF')
    rhMasterComponentId = rhCounterSource && rhCounterSource !== 'SELF' ? rhCounterSource : null;
  }
  // NOT_RH_DRIVEN: All RH fields stay null (default)
  
  const componentData = {
    componentCode: componentCode,
    name: row['Component Name'] || '',
    category: row['Component Category'] || row['Main Group Name'] || '',
    // Use Parent Component Code (auto-calculated from SFI)
    parentId: row['Parent Component Code'] ? String(row['Parent Component Code']).trim() : null,
    vesselId: vesselId || row['Vessel Code'] || 'V001',  // Vessel FK/reference (fallback to Vessel Code from Excel)
    vesselCode: row['Vessel Code'] || null,  // CRITICAL: Vessel identification code for tracking/display
    // Fleet Equipment fields
    fleetEquipmentCode: row['Fleet Equipment Code'] || null,
    fleetEquipmentName: row['Fleet Equipment Name'] || null,
    parentFleetEquipmentCode: null, // Not in Excel template, can be added later
    // Maker and Model fields - resolve name from code if needed
    maker: makerName,
    makerCode: makerCode,
    model: row['Model'] || null,
    modelCode: row['Model Code'] || row['Model Number'] || null, // Support both new and legacy headers
    // Component specific fields
    serialNo: row['Serial No'] || null,
    drawingNo: row['Drawing No'] || null,
    // Department and categorization - support both new and legacy headers
    department: departmentValue,
    deptCategory: departmentValue,
    componentCategory: row['Component Category'] || row['Main Group Name'] || null,
    location: row['Location'] || null,
    equipmentDepartment: departmentValue,
    // Dates - Convert Excel serial numbers to DD-MMM-YYYY format
    commissionedDate: row['Commissioned Date'] ? normalizeDateToDDMMMYYYY(row['Commissioned Date']) : null,
    installationDate: row['Installation Date'] ? normalizeDateToDDMMMYYYY(row['Installation Date']) : null,
    // Status and classification - Support both template format and legacy format
    critical: isCritical,
    criticality: isCritical ? 'Yes' : 'No',
    classItem: isClassItem,
    conditionBased: isConditionBased,
    isActive: row['IS Active'] !== false && row['IS Active'] !== 'No', // Default to true
    isParent: isParent,
    // Technical specifications
    rating: row['Rating'] || null,
    parentComponent: row['Parent Component Code'] ? String(row['Parent Component Code']).trim() : null,
    notes: row['Notes'] || null,
    // Running Hours (legacy field - kept for backward compatibility)
    runningHours: runningHoursValue,
    currentCumulativeRH: runningHoursValue || '0',
    // RH Counter fields - mapped based on Counter Type
    rhCounterType: rhCounterType,
    rhCounterSource: rhCounterSource,
    // MASTER-specific fields
    rhCurrentMaster: rhCurrentMaster,
    rhMasterUpdatedAt: rhMasterUpdatedAt,
    rhMasterUpdateSource: rhMasterUpdateSource,
    // INHERITED-specific fields
    rhMasterComponentId: rhMasterComponentId,
    rhCurrentInheritedCached: rhCurrentInheritedCached,
    rhInheritedUpdatedAt: rhInheritedUpdatedAt,
    // Last Updated
    lastUpdated: lastUpdatedValue
  };

  console.log(`📦 Creating component: ${componentCode} - ${componentData.name}`);
  const result = await storage.createComponent(componentData);
  console.log(`✅ Component created: ${componentCode}`);
  return result;
}

// Helper function to update component from Excel row
// existingComponent: Pass the component from the map if available to avoid lookup issues
async function updateComponentFromRow(componentCode: string, row: any, vesselId?: string, existingComponent?: any) {
  const updateData: any = {};
  
  if (row['Component Name']) updateData.name = row['Component Name'];
  if (row['Component Category'] || row['Main Group Name']) {
    updateData.category = row['Component Category'] || row['Main Group Name'];
  }
  // Use Parent Component Code (auto-calculated from SFI)
  if (row['Parent Component Code']) {
    updateData.parentId = String(row['Parent Component Code']).trim();
  }
  // Fleet Equipment fields
  if (row['Fleet Equipment Code']) updateData.fleetEquipmentCode = row['Fleet Equipment Code'];
  if (row['Fleet Equipment Name']) updateData.fleetEquipmentName = row['Fleet Equipment Name'];
  // Maker and Model fields - resolve name from code if needed
  // Support both 'Maker' and 'Maker Name' column headers
  const makerFromExcel = row['Maker'] || row['Maker Name'];
  if (makerFromExcel) {
    updateData.maker = makerFromExcel;
  } else if (row['Maker Code']) {
    // Try to resolve maker name from maker code
    const maker = await storage.getMakerListByCode(String(row['Maker Code']).trim());
    if (maker) {
      updateData.maker = maker.makerName;
    }
  }
  if (row['Maker Code']) updateData.makerCode = row['Maker Code'];
  if (row['Model']) updateData.model = row['Model'];
  // Support both new (Model Code) and legacy (Model Number) headers
  const modelCodeValue = row['Model Code'] || row['Model Number'];
  if (modelCodeValue) updateData.modelCode = modelCodeValue;
  // Component specific fields
  if (row['Serial No']) updateData.serialNo = row['Serial No'];
  if (row['Drawing No']) updateData.drawingNo = row['Drawing No'];
  // Department and categorization - support both new and legacy headers
  const deptValue = row['Equipment / System Department'] || row['Eqpt / System Department'];
  if (deptValue) {
    updateData.department = deptValue;
    updateData.deptCategory = deptValue;
    updateData.equipmentDepartment = deptValue;
  }
  if (row['Component Category'] || row['Main Group Name']) {
    updateData.componentCategory = row['Component Category'] || row['Main Group Name'];
  }
  if (row['Location']) updateData.location = row['Location'];
  // Dates - Convert Excel serial numbers to DD-MMM-YYYY format
  if (row['Commissioned Date']) updateData.commissionedDate = normalizeDateToDDMMMYYYY(row['Commissioned Date']);
  if (row['Installation Date']) updateData.installationDate = normalizeDateToDDMMMYYYY(row['Installation Date']);
  // Status and classification - Support both new and legacy header formats
  const criticalValue = row['Criticality'] ?? row['Critical Yes/No'] ?? row['Critical (Yes/No)'];
  if (criticalValue !== undefined) {
    const isCritical = criticalValue === true || criticalValue === 'Yes';
    updateData.critical = isCritical;
    updateData.criticality = isCritical ? 'Yes' : 'No';
  }
  const conditionBasedValue = row['Condition Based'] ?? row['Condition Based Yes/No'] ?? row['Condition Based (Yes/No)'];
  if (conditionBasedValue !== undefined) {
    updateData.conditionBased = conditionBasedValue === true || conditionBasedValue === 'Yes';
  }
  if (row['IS Active'] !== undefined) {
    updateData.isActive = row['IS Active'] !== false && row['IS Active'] !== 'No';
  }
  // Support IS Parent field
  const isParentValue = row['IS Parent'] ?? row['IS Parent Yes/No'];
  if (isParentValue !== undefined) {
    updateData.isParent = isParentValue === true || isParentValue === 'Yes';
  }
  // Support Class Item field (both "Class Item" and "Class item" headers)
  const classItemValue = row['Class Item'] ?? row['Class item'];
  if (classItemValue !== undefined) {
    updateData.classItem = classItemValue === true || classItemValue === 'Yes';
  }
  // Technical specifications
  if (row['Rating']) updateData.rating = row['Rating'];
  if (row['Parent Component Code']) updateData.parentComponent = String(row['Parent Component Code']).trim();
  if (row['Notes']) updateData.notes = row['Notes'];
  // Running Hours and RH Counter fields - Map based on Counter Type
  const rhCounterType = row['RH Counter Type'] ? row['RH Counter Type'].toString().toUpperCase().trim() : null;
  const rhCounterSource = row['RH Counter Source'] || null;
  const runningHoursValue = row['Running Hours'] ? String(row['Running Hours']) : null;
  
  if (runningHoursValue !== null) {
    updateData.runningHours = runningHoursValue;
    updateData.currentCumulativeRH = runningHoursValue;
  }
  
  if (rhCounterType) {
    updateData.rhCounterType = rhCounterType;
    
    if (rhCounterType === 'MASTER') {
      // MASTER components maintain their own RH value
      if (runningHoursValue !== null) {
        updateData.rhCurrentMaster = runningHoursValue;
        updateData.rhMasterUpdatedAt = new Date();
        updateData.rhMasterUpdateSource = 'IMPORT';
      }
      // Clear INHERITED fields
      updateData.rhMasterComponentId = null;
      updateData.rhCurrentInheritedCached = null;
      updateData.rhInheritedUpdatedAt = null;
    } else if (rhCounterType === 'INHERITED') {
      // INHERITED components cache the RH value and reference a MASTER component
      if (runningHoursValue !== null) {
        updateData.rhCurrentInheritedCached = runningHoursValue;
        updateData.rhInheritedUpdatedAt = new Date();
      }
      // RH Counter Source for INHERITED should be the MASTER component's code
      if (rhCounterSource && rhCounterSource !== 'SELF') {
        updateData.rhMasterComponentId = rhCounterSource;
      }
      // Clear MASTER fields
      updateData.rhCurrentMaster = null;
      updateData.rhMasterUpdatedAt = null;
      updateData.rhMasterUpdateSource = null;
    } else if (rhCounterType === 'NOT_RH_DRIVEN') {
      // Clear all RH-specific fields
      updateData.rhCurrentMaster = null;
      updateData.rhMasterUpdatedAt = null;
      updateData.rhMasterUpdateSource = null;
      updateData.rhMasterComponentId = null;
      updateData.rhCurrentInheritedCached = null;
      updateData.rhInheritedUpdatedAt = null;
    }
  }
  
  if (rhCounterSource) updateData.rhCounterSource = rhCounterSource;
  // Last Updated
  if (row['Last Updated']) updateData.lastUpdated = normalizeDateToDDMMMYYYY(row['Last Updated']);
  // Vessel Code - CRITICAL: Update BOTH vesselId and vesselCode for consistency
  if (row['Vessel Code']) {
    updateData.vesselId = row['Vessel Code'];  // FK/reference
    updateData.vesselCode = row['Vessel Code'];  // Display value
  }

  // Use existing component if provided (from map), otherwise look up
  let component = existingComponent;
  if (!component) {
    // Use vesselId from row, or passed vesselId parameter
    const lookupVesselId = row['Vessel Code'] || vesselId;
    
    // Require vesselId for component lookup - vessel scoping is critical for data integrity
    if (!lookupVesselId) {
      throw new Error(`Cannot update component '${componentCode}': Vessel Code is required. Please ensure the 'Vessel Code' column is populated in your data.`);
    }
    
    // Primary lookup: by componentCode + vesselId (correct uniqueness constraint)
    // This ensures we always update the correct vessel-specific component
    component = await storage.getComponentByCode(componentCode, lookupVesselId);
    
    // Fallback: If the componentCode looks like a database ID (typically a long alphanumeric string),
    // try to look it up directly. This handles cases where IDs are used instead of codes.
    if (!component && componentCode.includes('-') && componentCode.length > 15) {
      try {
        const compById = await storage.getComponent(componentCode);
        // Only use this component if it belongs to the correct vessel
        if (compById && compById.vesselId === lookupVesselId) {
          component = compById;
          console.log(`✅ Component found by ID fallback: ${componentCode} (vessel: ${lookupVesselId})`);
        } else if (compById) {
          console.warn(`⚠️ Component ID ${componentCode} found but belongs to vessel ${compById.vesselId}, not ${lookupVesselId}`);
        }
      } catch (e) {
        // ID lookup failed - this is fine, continue with error reporting
      }
    }
  }
  
  if (!component) {
    const lookupVesselId = row['Vessel Code'] || vesselId || 'UNKNOWN';
    throw new Error(`Component code '${componentCode}' not found for vessel '${lookupVesselId}'. Verify that the component exists in this vessel and that the component_code matches exactly.`);
  }
  
  return await storage.updateComponent(component.id, updateData);
}

// Helper function to create work order from Excel row
async function createWorkOrderFromRow(row: any, templateCode: string, vesselId?: string) {
  const componentCode = String(row['Generated_Component_Code']).trim();
  const component = await storage.getComponent(componentCode);
  
  // Auto-resolve jobId by matching component and jobTitle
  let jobId = null;
  let matchingJob = null;
  const jobTitle = row['Job_Title'] || '';
  const effectiveVesselId = vesselId || 'V001';
  
  if (component && jobTitle) {
    try {
      const jobs = await storage.getJobs(effectiveVesselId);
      matchingJob = jobs.find(j => 
        j.componentId === component.id && 
        j.jobTitle === jobTitle
      );
      if (matchingJob) {
        jobId = matchingJob.id;
        console.log(`Auto-resolved jobId: ${matchingJob.id} for imported work order with component ${componentCode} and job "${jobTitle}"`);
      }
    } catch (error) {
      console.error('Failed to auto-resolve jobId during bulk import:', error);
    }
  }
  
  // Generate spec-compliant work order number: <JOB CODE>.WO-<YEAR>-<RUNNING NUMBER>
  // Use job code from matched job, or from Excel row, or generate unplanned format
  let workOrderNo: string;
  const jobCode = matchingJob?.jobNo || row['Job_Code'];
  
  if (jobCode) {
    // Planned work order: use job code to generate proper format
    workOrderNo = await generatePlannedWorkOrderNumber(storage, jobCode, effectiveVesselId);
  } else {
    // Unplanned work order: use UWO format
    workOrderNo = await generateUnplannedWorkOrderNumber(storage, effectiveVesselId);
  }
  
  const workOrderData = {
    vesselId: effectiveVesselId,
    component: component?.name || row['Component_Name'] || componentCode,
    componentCode: componentCode,
    jobId: jobId,
    workOrderNo: workOrderNo,
    templateCode: templateCode,
    jobTitle: jobTitle,
    assignedTo: row['Responsible_Rank'] || '',
    approver: null,
    dueDate: new Date().toISOString(),
    status: 'Due' as const,
    taskType: null,
    maintenanceBasis: row['Schedule_Type'] || null,
    frequencyValue: row['Interval'] ? String(row['Interval']) : null,
    frequencyUnit: row['Interval_Unit'] || null,
    classRelated: row['Criticality'] || null,
    jobPriority: null,
    briefWorkDescription: row['Job_Description'] || null
  };

  return await storage.createWorkOrder(workOrderData);
}

// Helper function to update work order from Excel row
// NOTE: workOrderNo is NOT updated from Excel - it follows the spec format and is generated at creation time
async function updateWorkOrderFromRow(workOrderId: string, row: any) {
  const updateData: any = {};
  
  if (row['Job_Title']) updateData.jobTitle = row['Job_Title'];
  if (row['Schedule_Type']) updateData.maintenanceBasis = row['Schedule_Type'];
  if (row['Interval']) updateData.frequencyValue = String(row['Interval']);
  if (row['Interval_Unit']) updateData.frequencyUnit = row['Interval_Unit'];
  if (row['Responsible_Rank']) updateData.assignedTo = row['Responsible_Rank'];
  if (row['Criticality']) updateData.classRelated = row['Criticality'];
  if (row['Job_Description']) updateData.briefWorkDescription = row['Job_Description'];
  // NOTE: Do NOT update workOrderNo from Job_Code - WO numbers follow spec format and cannot be overwritten

  return await storage.updateWorkOrder(workOrderId, updateData);
}

// Store import history
async function storeImportHistory(data: any) {
  const result = await storage.createImportHistory(data);
  return result;
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
      originalName: h.originalName,
      storedFilePath: h.storedFilePath // Include file path for download
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

// POST /api/bulk/undo/:historyId - Undo an import with conflict detection
router.post('/undo/:historyId', async (req, res) => {
  const { historyId } = req.params;
  
  try {
    // 1. Fetch and Validate Import History
    const history = await storage.getImportHistoryById(historyId);
    if (!history) {
      return res.status(404).json({ error: 'Import history not found' });
    }
    
    // Validate status - only 'complete' imports can be undone
    if (history.status === 'undone') {
      return res.status(400).json({ error: 'Import has already been undone' });
    }
    
    if (history.status !== 'complete') {
      return res.status(400).json({ 
        error: `Cannot undo import with status '${history.status}'. Only completed imports can be undone.` 
      });
    }
    
    // Fetch all change logs for this import
    const changeLogs = await storage.getImportChangeLogs(historyId);
    if (changeLogs.length === 0) {
      return res.status(400).json({ error: 'No change logs found for this import' });
    }
    
    console.log(`🔄 Starting undo for import ${historyId} with ${changeLogs.length} change logs`);
    
    // 2. Conflict Detection - Validate checksums to detect conflicts
    const conflicts: Array<{entityType: string; entityId: string; reason: string}> = [];
    
    for (const log of changeLogs) {
      // Skip created entities that don't have newData (shouldn't happen, but safety check)
      if (log.operation === 'created' && !log.newData) continue;
      
      // Fetch current state from database
      let currentEntity;
      if (log.entityType === 'component') {
        currentEntity = await storage.getComponent(log.entityId);
      } else if (log.entityType === 'job') {
        currentEntity = await storage.getJob(log.entityId);
      } else if (log.entityType === 'workOrder') {
        currentEntity = await storage.getWorkOrder(log.entityId);
      } else if (log.entityType === 'storesItem') {
        currentEntity = await storage.getStoresItem(parseInt(log.entityId));
      } else if (log.entityType === 'spare') {
        currentEntity = await storage.getSpare(parseInt(log.entityId));
      }
      
      // If entity was deleted or doesn't exist (and it wasn't a created operation)
      if (!currentEntity && log.operation !== 'created') {
        conflicts.push({
          entityType: log.entityType,
          entityId: log.entityId,
          reason: 'Entity no longer exists'
        });
        continue;
      }
      
      // For created entities, we need to check if they still exist and match
      if (currentEntity) {
        // Calculate current checksum
        const currentChecksum = calculateRecordChecksum(currentEntity);
        
        // Get expected data from log (parse if it's a JSON string)
        const expectedData = log.newData;
        const parsedExpectedData = typeof expectedData === 'string' 
          ? JSON.parse(expectedData) 
          : expectedData;
        const expectedChecksum = parsedExpectedData ? calculateRecordChecksum(parsedExpectedData) : '';
        
        if (currentChecksum !== expectedChecksum) {
          conflicts.push({
            entityType: log.entityType,
            entityId: log.entityId,
            reason: 'Entity has been modified since import'
          });
        }
      }
    }
    
    // If conflicts exist, return error with details
    if (conflicts.length > 0) {
      console.log(`❌ Undo aborted due to ${conflicts.length} conflicts`);
      return res.status(409).json({ 
        error: 'Cannot undo import due to conflicts',
        conflicts,
        message: `${conflicts.length} entities have been modified since import. Undo operation aborted.`
      });
    }
    
    console.log(`✅ No conflicts detected, proceeding with undo`);
    
    // 3. Apply Reverse Operations with Transactional Rollback Support
    const result = {
      deleted: 0,
      restored: 0,
      unarchived: 0
    };
    
    // Track applied changes for rollback
    const appliedChanges: Array<{
      log: any;
      previousState: any;
    }> = [];
    
    try {
      // Process in reverse order (undo last changes first)
      const reversedLogs = [...changeLogs].reverse();
      
      for (const log of reversedLogs) {
        // Capture current state BEFORE applying undo operation
        let currentState;
        if (log.entityType === 'component') {
          currentState = await storage.getComponent(log.entityId);
        } else if (log.entityType === 'job') {
          currentState = await storage.getJob(log.entityId);
        } else if (log.entityType === 'workOrder') {
          currentState = await storage.getWorkOrder(log.entityId);
        } else if (log.entityType === 'storesItem') {
          currentState = await storage.getStoresItem(parseInt(log.entityId));
        } else if (log.entityType === 'spare') {
          currentState = await storage.getSpare(parseInt(log.entityId));
        }
        
        // Apply undo operation
        if (log.entityType === 'component') {
          if (log.operation === 'created') {
            // Delete created component (archive it)
            await storage.archiveComponent(log.entityId);
            result.deleted++;
            console.log(`  ✓ Archived component ${log.entityId}`);
          } else if (log.operation === 'updated') {
            // Restore previous state
            const previousData = log.previousData as any;
            await storage.updateComponent(log.entityId, previousData);
            result.restored++;
            console.log(`  ✓ Restored component ${log.entityId}`);
          } else if (log.operation === 'archived') {
            // Restore isActive:true
            await storage.updateComponent(log.entityId, { isActive: true });
            result.unarchived++;
            console.log(`  ✓ Unarchived component ${log.entityId}`);
          }
        } else if (log.entityType === 'job') {
          if (log.operation === 'created') {
            await storage.archiveJob(log.entityId);
            result.deleted++;
            console.log(`  ✓ Archived job ${log.entityId}`);
          } else if (log.operation === 'updated') {
            const previousData = log.previousData as any;
            await storage.updateJob(log.entityId, previousData);
            result.restored++;
            console.log(`  ✓ Restored job ${log.entityId}`);
          } else if (log.operation === 'archived') {
            await storage.updateJob(log.entityId, { isActive: true });
            result.unarchived++;
            console.log(`  ✓ Unarchived job ${log.entityId}`);
          }
        } else if (log.entityType === 'workOrder') {
          if (log.operation === 'created') {
            await storage.archiveWorkOrder(log.entityId);
            result.deleted++;
            console.log(`  ✓ Archived work order ${log.entityId}`);
          } else if (log.operation === 'updated') {
            const previousData = log.previousData as any;
            await storage.updateWorkOrder(log.entityId, previousData);
            result.restored++;
            console.log(`  ✓ Restored work order ${log.entityId}`);
          } else if (log.operation === 'archived') {
            await storage.updateWorkOrder(log.entityId, { isActive: true });
            result.unarchived++;
            console.log(`  ✓ Unarchived work order ${log.entityId}`);
          }
        } else if (log.entityType === 'storesItem') {
          const storesItemId = parseInt(log.entityId);
          if (log.operation === 'created') {
            await storage.deleteStoresItem(storesItemId);
            result.deleted++;
            console.log(`  ✓ Deleted stores item ${log.entityId}`);
          } else if (log.operation === 'updated') {
            const previousData = log.previousData as any;
            await storage.updateStoresItem(storesItemId, previousData);
            result.restored++;
            console.log(`  ✓ Restored stores item ${log.entityId}`);
          } else if (log.operation === 'archived') {
            await storage.updateStoresItem(storesItemId, { isActive: true, deleted: false });
            result.unarchived++;
            console.log(`  ✓ Unarchived stores item ${log.entityId}`);
          }
        } else if (log.entityType === 'spare') {
          const spareId = parseInt(log.entityId);
          if (log.operation === 'created') {
            await storage.deleteSpare(spareId);
            result.deleted++;
            console.log(`  ✓ Deleted spare ${log.entityId}`);
          } else if (log.operation === 'updated') {
            const previousData = log.previousData as any;
            await storage.updateSpare(spareId, previousData);
            result.restored++;
            console.log(`  ✓ Restored spare ${log.entityId}`);
          } else if (log.operation === 'archived') {
            await storage.updateSpare(spareId, { isActive: true });
            result.unarchived++;
            console.log(`  ✓ Unarchived spare ${log.entityId}`);
          }
        }
        
        // Track this change for potential rollback
        appliedChanges.push({ log, previousState: currentState });
      }
      
      // All changes successful - mark as undone
      await storage.updateImportHistory(historyId, {
        status: 'undone',
        undoneAt: new Date()
      });
      
      console.log(`✅ Import ${historyId} successfully undone`);
      console.log(`   - Deleted: ${result.deleted}`);
      console.log(`   - Restored: ${result.restored}`);
      console.log(`   - Unarchived: ${result.unarchived}`);
      
      res.json({
        message: 'Import successfully undone',
        ...result,
        historyId
      });
      
    } catch (undoError: any) {
      // ROLLBACK: Restore all changes in reverse order
      console.error('Undo operation failed, rolling back changes:', undoError);
      
      const rollbackErrors: string[] = [];
      
      // Reverse the applied changes (restore to state before undo)
      for (const change of appliedChanges.reverse()) {
        try {
          if (change.previousState) {
            // Restore the state that existed before we started undo
            if (change.log.entityType === 'component') {
              await storage.updateComponent(change.log.entityId, change.previousState);
              console.log(`  ↩️ Rolled back component ${change.log.entityId}`);
            } else if (change.log.entityType === 'job') {
              await storage.updateJob(change.log.entityId, change.previousState);
              console.log(`  ↩️ Rolled back job ${change.log.entityId}`);
            } else if (change.log.entityType === 'workOrder') {
              await storage.updateWorkOrder(change.log.entityId, change.previousState);
              console.log(`  ↩️ Rolled back work order ${change.log.entityId}`);
            } else if (change.log.entityType === 'storesItem') {
              await storage.updateStoresItem(parseInt(change.log.entityId), change.previousState);
              console.log(`  ↩️ Rolled back stores item ${change.log.entityId}`);
            } else if (change.log.entityType === 'spare') {
              await storage.updateSpare(parseInt(change.log.entityId), change.previousState);
              console.log(`  ↩️ Rolled back spare ${change.log.entityId}`);
            }
          }
        } catch (rollbackError: any) {
          rollbackErrors.push(`Failed to rollback ${change.log.entityType} ${change.log.entityId}: ${rollbackError.message}`);
          console.error(`  ❌ Rollback failed for ${change.log.entityType} ${change.log.entityId}:`, rollbackError);
        }
      }
      
      // Mark import as undo_failed
      try {
        await storage.updateImportHistory(historyId, {
          status: 'undo_failed',
          errorMessage: rollbackErrors.length > 0 
            ? `Undo failed: ${undoError.message}. Rollback errors: ${rollbackErrors.join('; ')}`
            : `Undo failed: ${undoError.message}. All changes rolled back successfully.`
        });
      } catch (updateError) {
        console.error('Failed to update history status:', updateError);
      }
      
      console.log(`❌ Import ${historyId} undo failed and rolled back`);
      console.log(`   - Applied changes before failure: ${appliedChanges.length}`);
      console.log(`   - Rollback status: ${rollbackErrors.length === 0 ? 'success' : 'partial'}`);
      
      // Return error to client
      return res.status(500).json({
        error: 'Failed to undo import',
        details: undoError.message,
        rollbackStatus: rollbackErrors.length === 0 ? 'success' : 'partial',
        rollbackErrors: rollbackErrors.length > 0 ? rollbackErrors : undefined
      });
    }
    
  } catch (error: any) {
    console.error('Undo error:', error);
    
    // Try to mark history as failed
    try {
      await storage.updateImportHistory(historyId, {
        status: 'undo_failed',
        errorMessage: error.message
      });
    } catch (updateError) {
      console.error('Failed to update history status:', updateError);
    }
    
    res.status(500).json({ 
      error: 'Failed to undo import',
      details: error.message
    });
  }
});

// =====================================================
// MAKER LIST CRUD API ENDPOINTS
// =====================================================

// Get all makers
router.get('/makers', async (req, res) => {
  try {
    const makers = await storage.getMakerList();
    res.json(makers);
  } catch (error: any) {
    console.error('Error fetching makers:', error);
    res.status(500).json({ error: 'Failed to fetch makers' });
  }
});

// Get maker by ID
router.get('/makers/:id', async (req, res) => {
  try {
    const maker = await storage.getMakerListItem(parseInt(req.params.id));
    if (!maker) {
      return res.status(404).json({ error: 'Maker not found' });
    }
    res.json(maker);
  } catch (error: any) {
    console.error('Error fetching maker:', error);
    res.status(500).json({ error: 'Failed to fetch maker' });
  }
});

// Create maker
router.post('/makers', async (req, res) => {
  try {
    let { makerCode, makerName, address, addressId } = req.body;
    
    if (!makerName) {
      return res.status(400).json({ error: 'Maker Name is required' });
    }
    
    // Auto-generate makerCode if not provided or empty
    if (!makerCode || makerCode.trim() === '') {
      // Get all existing makers to determine the next code
      const existingMakers = await storage.getMakerList();
      let maxNum = 0;
      for (const m of existingMakers) {
        const match = m.makerCode?.match(/MKR-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      makerCode = `MKR-${String(maxNum + 1).padStart(6, '0')}`;
    }
    
    // Check if maker code already exists
    const existing = await storage.getMakerListByCode(makerCode);
    if (existing) {
      return res.status(409).json({ error: `Maker Code '${makerCode}' already exists` });
    }
    
    const maker = await storage.createMakerListItem({
      makerCode,
      makerName,
      address: address || null,
      addressId: addressId || null
    });
    
    res.status(201).json(maker);
  } catch (error: any) {
    console.error('Error creating maker:', error);
    res.status(500).json({ error: 'Failed to create maker' });
  }
});

// Update maker
router.patch('/makers/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { makerCode, makerName, address, addressId } = req.body;
    
    const existing = await storage.getMakerListItem(id);
    if (!existing) {
      return res.status(404).json({ error: 'Maker not found' });
    }
    
    // If changing maker code, check for duplicates
    if (makerCode && makerCode !== existing.makerCode) {
      const duplicate = await storage.getMakerListByCode(makerCode);
      if (duplicate && duplicate.id !== id) {
        return res.status(409).json({ error: `Maker Code '${makerCode}' already exists` });
      }
    }
    
    const updated = await storage.updateMakerListItem(id, {
      makerCode: makerCode || existing.makerCode,
      makerName: makerName || existing.makerName,
      address: address !== undefined ? address : existing.address,
      addressId: addressId !== undefined ? addressId : existing.addressId
    });
    
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating maker:', error);
    res.status(500).json({ error: 'Failed to update maker' });
  }
});

// Delete maker (soft delete - sets isActive to false)
router.delete('/makers/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const existing = await storage.getMakerListItem(id);
    if (!existing) {
      return res.status(404).json({ error: 'Maker not found' });
    }
    
    await storage.deleteMakerListItem(id);
    res.json({ message: 'Maker deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting maker:', error);
    res.status(500).json({ error: 'Failed to delete maker' });
  }
});

// Bulk import makers from Excel
router.post('/makers/import', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().includes('maker') || name.toLowerCase() === 'maker list'
    ) || workbook.SheetNames[0];
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    };
    
    for (let i = 0; i < data.length; i++) {
      const row: any = data[i];
      const rowNum = i + 2; // Excel row number (1-indexed + header)
      
      const makerCode = row['Maker Code'];
      const makerName = row['Maker Name'];
      const address = row['Address'] || null;
      
      if (!makerCode || !makerName) {
        results.errors.push(`Row ${rowNum}: Missing Maker Code or Maker Name`);
        results.skipped++;
        continue;
      }
      
      try {
        const existing = await storage.getMakerListByCode(String(makerCode).trim());
        if (existing) {
          await storage.updateMakerListItem(existing.id, {
            makerName: String(makerName).trim(),
            address: address ? String(address).trim() : null
          });
          results.updated++;
        } else {
          await storage.createMakerListItem({
            makerCode: String(makerCode).trim(),
            makerName: String(makerName).trim(),
            address: address ? String(address).trim() : null
          });
          results.created++;
        }
      } catch (error: any) {
        results.errors.push(`Row ${rowNum}: ${error.message}`);
        results.skipped++;
      }
    }
    
    console.log(`✅ Makers import complete: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`);
    res.json(results);
  } catch (error: any) {
    console.error('Error importing makers:', error);
    res.status(500).json({ error: 'Failed to import makers' });
  }
});

// =====================================================
// SFI DETAILS CRUD API ENDPOINTS
// =====================================================

// Get all SFI details
router.get('/sfi-details', async (req, res) => {
  try {
    const sfiDetails = await storage.getSfiDetails();
    res.json(sfiDetails);
  } catch (error: any) {
    console.error('Error fetching SFI details:', error);
    res.status(500).json({ error: 'Failed to fetch SFI details' });
  }
});

// Get SFI detail by ID
router.get('/sfi-details/:id', async (req, res) => {
  try {
    const sfi = await storage.getSfiDetail(parseInt(req.params.id));
    if (!sfi) {
      return res.status(404).json({ error: 'SFI detail not found' });
    }
    res.json(sfi);
  } catch (error: any) {
    console.error('Error fetching SFI detail:', error);
    res.status(500).json({ error: 'Failed to fetch SFI detail' });
  }
});

// Create SFI detail
router.post('/sfi-details', async (req, res) => {
  try {
    const { componentCode, componentName, description } = req.body;
    
    if (!componentCode || !componentName) {
      return res.status(400).json({ error: 'Component Code and Component Name are required' });
    }
    
    // Check if component code already exists
    const existing = await storage.getSfiByCode(componentCode);
    if (existing) {
      return res.status(409).json({ error: `Component Code '${componentCode}' already exists` });
    }
    
    const sfi = await storage.createSfiDetail({
      componentCode,
      componentName,
      description: description || null
    });
    
    res.status(201).json(sfi);
  } catch (error: any) {
    console.error('Error creating SFI detail:', error);
    res.status(500).json({ error: 'Failed to create SFI detail' });
  }
});

// Update SFI detail
router.patch('/sfi-details/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { componentCode, componentName, description } = req.body;
    
    const existing = await storage.getSfiDetail(id);
    if (!existing) {
      return res.status(404).json({ error: 'SFI detail not found' });
    }
    
    // If changing component code, check for duplicates
    if (componentCode && componentCode !== existing.componentCode) {
      const duplicate = await storage.getSfiByCode(componentCode);
      if (duplicate && duplicate.id !== id) {
        return res.status(409).json({ error: `Component Code '${componentCode}' already exists` });
      }
    }
    
    const updated = await storage.updateSfiDetail(id, {
      componentCode: componentCode || existing.componentCode,
      componentName: componentName || existing.componentName,
      description: description !== undefined ? description : existing.description
    });
    
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating SFI detail:', error);
    res.status(500).json({ error: 'Failed to update SFI detail' });
  }
});

// Delete SFI detail (soft delete - sets isActive to false)
router.delete('/sfi-details/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const existing = await storage.getSfiDetail(id);
    if (!existing) {
      return res.status(404).json({ error: 'SFI detail not found' });
    }
    
    await storage.deleteSfiDetail(id);
    res.json({ message: 'SFI detail deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting SFI detail:', error);
    res.status(500).json({ error: 'Failed to delete SFI detail' });
  }
});

// Bulk import SFI details from Excel
router.post('/sfi-details/import', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().includes('sfi') || name.toLowerCase() === 'sfi details'
    ) || workbook.SheetNames[0];
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    };
    
    for (let i = 0; i < data.length; i++) {
      const row: any = data[i];
      const rowNum = i + 2; // Excel row number (1-indexed + header)
      
      const componentCode = row['Component Code'];
      const componentName = row['Component Name'];
      const description = row['Description'] || null;
      
      if (!componentCode || !componentName) {
        results.errors.push(`Row ${rowNum}: Missing Component Code or Component Name`);
        results.skipped++;
        continue;
      }
      
      try {
        const existing = await storage.getSfiByCode(String(componentCode).trim());
        if (existing) {
          await storage.updateSfiDetail(existing.id, {
            componentName: String(componentName).trim(),
            description: description ? String(description).trim() : null
          });
          results.updated++;
        } else {
          await storage.createSfiDetail({
            componentCode: String(componentCode).trim(),
            componentName: String(componentName).trim(),
            description: description ? String(description).trim() : null
          });
          results.created++;
        }
      } catch (error: any) {
        results.errors.push(`Row ${rowNum}: ${error.message}`);
        results.skipped++;
      }
    }
    
    console.log(`✅ SFI details import complete: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`);
    res.json(results);
  } catch (error: any) {
    console.error('Error importing SFI details:', error);
    res.status(500).json({ error: 'Failed to import SFI details' });
  }
});

export default router;