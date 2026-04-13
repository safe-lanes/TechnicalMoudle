import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

export const TEMPLATE_VERSION = '2.0.0';
export const TEMPLATE_VERSION_DATE = '2025-11-28';
export const TEMPLATE_VERSION_CELL = '_TEMPLATE_VERSION_';

export function checkTemplateVersion(worksheet: XLSX.WorkSheet): { valid: boolean; version?: string; message?: string } {
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

export function addVersionInfoToSheet(sheet: ExcelJS.Worksheet, columnOffset?: number): void {
  // If columnOffset is provided, use it to determine the version column position
  // Otherwise default to column AA (27) for backward compatibility
  const versionColumnIndex = columnOffset || 27;
  const versionColumnLetter = getColumnLetter(versionColumnIndex);
  sheet.getCell(`${versionColumnLetter}1`).value = `${TEMPLATE_VERSION_CELL}${TEMPLATE_VERSION}`;
}

// Helper function to convert column number to Excel column letter (1=A, 26=Z, 27=AA, etc.)
export function getColumnLetter(columnNumber: number): string {
  let result = '';
  let num = columnNumber;
  while (num > 0) {
    num--; // Adjust for 0-based calculation
    result = String.fromCharCode((num % 26) + 65) + result;
    num = Math.floor(num / 26);
  }
  return result;
}

/**
 * Extract data from Excel worksheet while preserving raw numeric values for dates
 * This prevents Excel serial numbers from being auto-formatted into strings like "01-Jan-45610"
 */
export function extractRawExcelData(worksheet: XLSX.WorkSheet): any[] {
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
    'jobtitle': 'WO Title',
    'job_title': 'WO Title',
    'job title': 'WO Title',
    'wotitle': 'WO Title',
    'wo_title': 'WO Title',
    'wo title': 'WO Title',
    // Multi-sheet template column mappings
    'scheduletype': 'Maintenance Basis',
    'schedule_type': 'Maintenance Basis',
    'schedule type': 'Maintenance Basis',
    'calendarinterval': 'Interval Value',
    'calendar_interval': 'Interval Value',
    'calendar interval': 'Interval Value',
    'intervalvalue': 'Interval Value',
    'interval_value': 'Interval Value',
    'interval value': 'Interval Value',
    'intervalunit': 'Unit',
    'interval_unit': 'Unit',
    'interval unit': 'Unit',
    'rhinterval': 'Interval Running Hours',
    'rh_interval': 'Interval Running Hours',
    'rh interval': 'Interval Running Hours',
    'responsiblerank': 'Assigned To',
    'responsible_rank': 'Assigned To',
    'responsible rank': 'Assigned To',
    'assignedto': 'Assigned To',
    'assigned_to': 'Assigned To',
    'assigned to': 'Assigned To',
    'tasktype': 'Task Type',
    'task_type': 'Task Type',
    'task type': 'Task Type',
    'maintenancebasis': 'Maintenance Basis',
    'maintenance_basis': 'Maintenance Basis',
    'maintenance basis': 'Maintenance Basis',
    'lastdonedate': 'Last Done Date',
    'last_done_date': 'Last Done Date',
    'last done date': 'Last Done Date',
    'lastdonerh': 'Last Done RH',
    'last_done_rh': 'Last Done RH',
    'last done rh': 'Last Done RH',
    'jobdescription': 'Brief Work Description',
    'job_description': 'Brief Work Description',
    'job description': 'Brief Work Description',
    'briefworkdescription': 'Brief Work Description',
    'brief_work_description': 'Brief Work Description',
    'brief work description': 'Brief Work Description',
    'jobpriority': 'Job Priority',
    'job_priority': 'Job Priority',
    'job priority': 'Job Priority',
    'classrelated': 'Class Related',
    'class_related': 'Class Related',
    'class related': 'Class Related',
    'critical yes/no': 'Criticality',
    'criticality': 'Criticality',
    'isactive': 'Is Active',
    'is_active': 'Is Active',
    'is active': 'Is Active',
    'vesselcode': 'Vessel Code',
    'vessel_code': 'Vessel Code',
    'vessel code': 'Vessel Code',
    'fleetequipmentcode': 'Fleet Equipment Code',
    'fleet_equipment_code': 'Fleet Equipment Code',
    'fleet equipment code': 'Fleet Equipment Code',
    'fleetequipmentname': 'Fleet Equipment Name',
    'fleet_equipment_name': 'Fleet Equipment Name',
    'fleet equipment name': 'Fleet Equipment Name'
  },
  'fleet-jobs': {
    'jobcode': 'Job Code',
    'job_code': 'Job Code',
    'job code': 'Job Code',
    'fleetequipmentcode': 'Fleet Equipment Code',
    'fleet_equipment_code': 'Fleet Equipment Code',
    'fleet equipment code': 'Fleet Equipment Code',
    'fleetequipmentname': 'Fleet Equipment Name',
    'fleet_equipment_name': 'Fleet Equipment Name',
    'fleet equipment name': 'Fleet Equipment Name',
    'wotitle': 'WO Title',
    'wo_title': 'WO Title',
    'wo title': 'WO Title',
    'jobtitle': 'WO Title',
    'job_title': 'WO Title',
    'job title': 'WO Title',
    'maintenancebasis': 'Maintenance Basis',
    'maintenance_basis': 'Maintenance Basis',
    'maintenance basis': 'Maintenance Basis',
    'scheduletype': 'Maintenance Basis',
    'schedule_type': 'Maintenance Basis',
    'schedule type': 'Maintenance Basis',
    'intervalvalue': 'Interval Value',
    'interval_value': 'Interval Value',
    'interval value': 'Interval Value',
    'calendarinterval': 'Interval Value',
    'calendar_interval': 'Interval Value',
    'calendar interval': 'Interval Value',
    'unit': 'Unit',
    'intervalunit': 'Unit',
    'interval_unit': 'Unit',
    'interval unit': 'Unit',
    'tasktype': 'Task Type',
    'task_type': 'Task Type',
    'task type': 'Task Type',
    'assignedto': 'Assigned To',
    'assigned_to': 'Assigned To',
    'assigned to': 'Assigned To',
    'responsiblerank': 'Assigned To',
    'responsible_rank': 'Assigned To',
    'responsible rank': 'Assigned To',
    'approver': 'Approver',
    'jobpriority': 'Job Priority',
    'job_priority': 'Job Priority',
    'job priority': 'Job Priority',
    'classrelated': 'Class Related',
    'class_related': 'Class Related',
    'class related': 'Class Related',
    'briefworkdescription': 'Brief Work Description',
    'brief_work_description': 'Brief Work Description',
    'brief work description': 'Brief Work Description',
    'jobdescription': 'Brief Work Description',
    'job_description': 'Brief Work Description',
    'job description': 'Brief Work Description',
    'department': 'Department',
    'criticality': 'Criticality',
    'critical yes/no': 'Criticality',
    'isactive': 'Is Active',
    'is_active': 'Is Active',
    'is active': 'Is Active',
    'requiredspareParts': 'Required Spare Parts',
    'required_spare_parts': 'Required Spare Parts',
    'required spare parts': 'Required Spare Parts',
    'sparepartsrequired': 'Required Spare Parts',
    'spare_parts_required': 'Required Spare Parts',
    'spare parts required': 'Required Spare Parts',
    'requiredtools': 'Required Tools',
    'required_tools': 'Required Tools',
    'required tools': 'Required Tools',
    'toolsrequired': 'Required Tools',
    'tools_required': 'Required Tools',
    'tools required': 'Required Tools',
    'pperequirements': 'PPE Requirements',
    'ppe_requirements': 'PPE Requirements',
    'ppe requirements': 'PPE Requirements',
    'permitrequirements': 'Permit Requirements',
    'permit_requirements': 'Permit Requirements',
    'permit requirements': 'Permit Requirements',
    'othersafetyrequirements': 'Other Safety Requirements',
    'other_safety_requirements': 'Other Safety Requirements',
    'other safety requirements': 'Other Safety Requirements',
    'safetyprocedure': 'Other Safety Requirements',
    'safety_procedure': 'Other Safety Requirements',
    'safety procedure': 'Other Safety Requirements'
  },
  'fleet-spares': {
    'partcode': 'Part Code',
    'part_code': 'Part Code',
    'part code': 'Part Code',
    'fleetequipmentcode': 'Fleet Equipment Code',
    'fleet_equipment_code': 'Fleet Equipment Code',
    'fleet equipment code': 'Fleet Equipment Code',
    'fleetequipmentname': 'Fleet Equipment Name',
    'fleet_equipment_name': 'Fleet Equipment Name',
    'fleet equipment name': 'Fleet Equipment Name',
    'partname': 'Part Name',
    'part_name': 'Part Name',
    'part name': 'Part Name',
    'partnumber': 'Part Number',
    'part_number': 'Part Number',
    'part number': 'Part Number',
    'unitofmeasurement': 'Unit Of Measurement',
    'unit_of_measurement': 'Unit Of Measurement',
    'unit of measurement': 'Unit Of Measurement',
    'uom': 'Unit Of Measurement',
    'drawingnumber': 'Drawing Number',
    'drawing_number': 'Drawing Number',
    'drawing number': 'Drawing Number',
    'drawingno': 'Drawing Number',
    'drawing_no': 'Drawing Number',
    'drawing no': 'Drawing Number',
    'positionnumber': 'Position Number',
    'position_number': 'Position Number',
    'position number': 'Position Number',
    'note': 'Note',
    'notes': 'Note',
    'specification': 'Specification',
    'spec': 'Specification',
    'maker': 'Maker',
    'makername': 'Maker',
    'maker_name': 'Maker',
    'maker name': 'Maker',
    'makercode': 'Maker Code',
    'maker_code': 'Maker Code',
    'maker code': 'Maker Code',
    'manualname': 'Manual Name',
    'manual_name': 'Manual Name',
    'manual name': 'Manual Name',
    'pagenumber': 'Page Number',
    'page_number': 'Page Number',
    'page number': 'Page Number',
    'criticality': 'Criticality',
    'critical': 'Criticality',
    'isactive': 'Is Active',
    'is_active': 'Is Active',
    'is active': 'Is Active',
    'ihm': 'IHM (Inventory of Hazardous Materials)',
    'ihm (inventory of hazardous materials)': 'IHM (Inventory of Hazardous Materials)',
    'inventory of hazardous materials': 'IHM (Inventory of Hazardous Materials)',
    'evidencetype': 'Evidence Type',
    'evidence_type': 'Evidence Type',
    'evidence type': 'Evidence Type'
  }
};

// Helper to check if row has explicit parent from any header variant
// Returns the explicit parent code if provided by user, null if auto-derived should be used
// NOTE: This must be defined before normalizeColumnNames as it's called from there

export function getExplicitParentFromRowEarly(row: any): string | null {
  // Check all known header variants for Parent Component Code
  const parentVariants = [
    'Parent Component Code',
    'Parent ID',
    'Parent Component',
    'parent component code',
    'ParentComponentCode',
    'parentId',
    'Parent Code',
    'parentCode',
    'PARENT COMPONENT CODE',
    'Parent_Component_Code',
    'parentcomponentcode',
    'parent_component_code'
  ];
  
  for (const variant of parentVariants) {
    const value = row[variant];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return null;
}

/**
 * Normalize column names in data array to expected format
 */

export function normalizeColumnNames(data: any[], type: string): any[] {
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
    
    // For components, detect explicit parent from the raw row BEFORE normalization
    // and set __meta flag that survives through all subsequent transformations
    if (type === 'components') {
      const explicitParent = getExplicitParentFromRowEarly(row);
      normalizedRow['__meta'] = {
        explicitParentProvided: !!explicitParent,
        originalExplicitParent: explicitParent
      };
    }
    
    return normalizedRow;
  });
}

// Component categories fallback (used when master list is not yet loaded)
export const COMPONENT_CATEGORIES = [
  "1 Ship General",
  "2 Hull",
  "3 Equipment for Cargo",
  "4 Ship Equipment",
  "5 Equipment for Crew and Passengers",
  "6 Machinery Main Components",
  "7 Systems for Machinery Main Components",
  "8 Ship Common Systems"
];

const FALLBACK_CATEGORY_MAP: Record<number, string> = {
  1: "1 Ship General",
  2: "2 Hull",
  3: "3 Equipment for Cargo",
  4: "4 Ship Equipment",
  5: "5 Equipment for Crew and Passengers",
  6: "6 Machinery Main Components",
  7: "7 Systems for Machinery Main Components",
  8: "8 Ship Common Systems",
};

let _dynamicCategoryMap: Record<number, string> | null = null;
let _dynamicCategoryValues: string[] | null = null;

export function setDynamicComponentCategories(categories: { listKey: string; listValue: string }[]) {
  _dynamicCategoryMap = {};
  _dynamicCategoryValues = [];
  for (const c of categories) {
    const key = parseInt(c.listKey);
    if (!isNaN(key)) {
      const fullEntry = `${c.listKey} ${c.listValue}`;
      _dynamicCategoryMap[key] = fullEntry;
      _dynamicCategoryValues.push(fullEntry);
    }
  }
  _dynamicCategoryValues.sort((a, b) => parseInt(a) - parseInt(b));
}

export function resetDynamicComponentCategories() {
  _dynamicCategoryMap = null;
  _dynamicCategoryValues = null;
}

export function getEffectiveComponentCategories(): string[] {
  return _dynamicCategoryValues || COMPONENT_CATEGORIES;
}

export function getComponentCategory(mainGroupCode: number): string | null {
  const map = _dynamicCategoryMap || FALLBACK_CATEGORY_MAP;
  return map[mainGroupCode] || null;
}

// Helper function to extract Sub Group Code (first 2 digits) from SFI code
// Examples: 711.001 → 71, 612.005 → 61, 7 → null, 71 → 71
export function getSubGroupCode(sfiCode: string): string | null {
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
export function getSubGroupName(subGroupCode: string): string {
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
export function stripSFISuffix(sfiCode: string): string {
  // Remove anything in parentheses at the end: "226.065(1)" → "226.065"
  return sfiCode.replace(/\([^)]*\)$/, '').trim();
}

export function getParentSFICode(sfiCode: string): string | null {
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
export function validateSFICode(sfiCode: string): boolean {
  // SFI codes can be: 6, 61, 612, 612.005, 612.005.001
  // Also accept codes with suffixes like 226.065(1), 230(2), etc.
  // Strip the suffix before validation
  const cleanCode = stripSFISuffix(sfiCode);
  const pattern = /^\d{1,3}(\.\d{1,3})*$/;
  return pattern.test(cleanCode);
}

// Helper to check if row has explicit parent from any header variant
// Returns the explicit parent code if provided by user, null if auto-derived should be used
export function getExplicitParentFromRow(row: any): string | null {
  // Check all known header variants for Parent Component Code
  const parentVariants = [
    'Parent Component Code',
    'Parent ID',
    'Parent Component',
    'parent component code',
    'ParentComponentCode',
    'parentId',
    'Parent Code',
    'parentCode',
    'PARENT COMPONENT CODE',
    'Parent_Component_Code',
    'parentcomponentcode',
    'parent_component_code'
  ];
  
  for (const variant of parentVariants) {
    const value = row[variant];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return null;
}

// UOM list
export const UOM_LIST = ['pcs', 'set', 'ltr', 'kg', 'm', 'box', 'roll', 'pack', 'kit', 'other'];

// Stores categories
export const STORES_CATEGORIES = [
  'General Stores',
  'Electrical',
  'Mechanical',
  'Safety',
  'Consumables'
];

// Departments list for jobs/work orders
export const DEPARTMENTS = ['Engine', 'Deck', 'Electrical', 'Galley', 'LSA', 'FFA'];

// Responsible ranks for work orders
export const RESPONSIBLE_RANKS = [
  'Master', 'Chief Officer', '2nd Officer', '3rd Officer',
  'Chief Engineer', '2nd Engineer', '3rd Engineer', '4th Engineer',
  'Electrician', 'Bosun', 'Fitter'
];

// Schedule types
export const SCHEDULE_TYPES = ['Running Hours', 'Calendar', 'Both'];

// Interval units for calendar-based schedules
export const INTERVAL_UNITS = ['Days', 'Weeks', 'Months', 'Years'];



// Map sheet names to data types - allows uploading any sheet from any page
export function getTypeFromSheetName(sheetName: string): string | null {
  const normalizedName = sheetName.toLowerCase().trim();
  
  // Direct matches - Fleet_ prefixed must come BEFORE generic checks
  if (normalizedName === 'fleet_component' || normalizedName === 'fleet component' || (normalizedName.includes('fleet') && normalizedName.includes('component'))) return 'fleet-components';
  if (normalizedName === 'fleet_job' || normalizedName === 'fleet job' || (normalizedName.includes('fleet') && normalizedName.includes('job'))) return 'fleet-jobs';
  if (normalizedName === 'fleet_spare' || normalizedName === 'fleet spare' || normalizedName === 'fleet_spares' || normalizedName === 'fleet spares' || (normalizedName.includes('fleet') && normalizedName.includes('spare'))) return 'fleet-spares';
  if (normalizedName === 'spares' || normalizedName.includes('spare')) return 'spares';
  if (normalizedName === 'components' || normalizedName.includes('component') || normalizedName.includes('machinery')) return 'components';
  if (normalizedName === 'vessel_job' || normalizedName === 'vessel job') return 'jobs';
  if (normalizedName === 'jobs' || normalizedName.includes('job')) return 'jobs';
  if (normalizedName === 'stores' || normalizedName.includes('store')) return 'stores';
  if (normalizedName === 'work-orders' || normalizedName.includes('work order') || normalizedName.includes('workorder')) return 'work-orders';
  if (normalizedName === 'makers' || normalizedName.includes('maker') || normalizedName === 'maker list') return 'makers';
  
  return null; // No mapping found, use passed type
}

