import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import {
  TEMPLATE_VERSION,
  TEMPLATE_VERSION_DATE,
  TEMPLATE_VERSION_CELL,
  addVersionInfoToSheet,
  getColumnLetter,
  COMPONENT_CATEGORIES,
  UOM_LIST,
  DEPARTMENTS,
  RESPONSIBLE_RANKS,
  SCHEDULE_TYPES,
  INTERVAL_UNITS,
  stripSFISuffix
} from './helpers';
import { getSparesExcelColumns } from '@shared/sparesTemplateFields';
import { storage } from '../../../storage';

// =====================================================
// COMPREHENSIVE FLEET MASTER DATA TEMPLATE GENERATOR
// =====================================================

export async function generateFleetMasterTemplate(): Promise<Buffer> {
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
    { header: 'Address', key: 'address', width: 50 },
    { header: 'Address ID', key: 'addressId', width: 15 },
    { header: 'Contact Person', key: 'contactPerson', width: 25 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Phone', key: 'phone', width: 20 },
    { header: 'IS Active', key: 'isActive', width: 12 }
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
  // A: Parent Fleet Equipment Code, B: Fleet Equipment Code, C: Fleet Equipment Name,
  // D: Component Category, E: Maker Name, F: Maker Code, G: Model, H: Model Code,
  // I: Location, J: Rating, K: Eqpt / System Department, L: Notes, M: IS Active
  // =====================================================
  const fleetComponentSheet = workbook.addWorksheet('Fleet_Component');
  fleetComponentSheet.columns = [
    { header: 'Parent Fleet Equipment Code', key: 'parentFleetEquipmentCode', width: 25 },
    { header: 'Fleet Equipment Code', key: 'fleetEquipmentCode', width: 22 },
    { header: 'Fleet Equipment Name', key: 'fleetEquipmentName', width: 35 },
    { header: 'Component Category', key: 'componentCategory', width: 25 },
    { header: 'Maker Name', key: 'makerName', width: 25 },
    { header: 'Maker Code', key: 'makerCode', width: 15 },
    { header: 'Model', key: 'model', width: 20 },
    { header: 'Model Code', key: 'modelCode', width: 15 },
    { header: 'Location', key: 'location', width: 20 },
    { header: 'Rating', key: 'rating', width: 20 },
    { header: 'Eqpt / System Department', key: 'eqptSystemDept', width: 25 },
    { header: 'Notes', key: 'notes', width: 40 },
    { header: 'IS Active', key: 'isActive', width: 12 }
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
  
  // Fleet_Component validations - 13 columns: A-M
  // Column M (13): IS Active - Yes/No dropdown
  for (let row = 2; row <= 1000; row++) {
    // IS Active Yes/No (col 13)
    fleetComponentSheet.getCell(row, 13).dataValidation = {
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
export async function generateWorkOrdersTemplate(vesselId: string): Promise<Buffer> {
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
export async function generateJobsTemplate(vesselId: string): Promise<Buffer> {
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
  
  // Add headers matching the 26-column specification (21 original + 5 Part A fields)
  // NOTE: "Interval Running Hours" column restored for Dual Frequency support
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
    { header: 'Interval Running Hours', key: 'intervalRunningHours', width: 22 },
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
    // Part A fields - Work Order Form fields
    // Required Spare Parts format: "PartCode1:Qty1, PartCode2:Qty2" or "PartCode1:Qty1; PartCode2:Qty2" (e.g., "PC-001:2, PC-002:1, PC-003:4")
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
      intervalRunningHours: '',
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
  
  // Add dropdown values (Calendar, Running Hours, and Dual Frequency)
  const listValues = [
    { maintenanceBasis: 'Calendar', intervalUnit: 'Days', taskType: 'Inspection', jobPriority: 'Low', department: 'Engine', yesNo: 'Yes' },
    { maintenanceBasis: 'Running Hours', intervalUnit: 'Weeks', taskType: 'Overhaul', jobPriority: 'Medium', department: 'Deck', yesNo: 'No' },
    { maintenanceBasis: 'Dual Frequency', intervalUnit: 'Months', taskType: 'Service', jobPriority: 'High', department: 'Electrical', yesNo: '' },
    { maintenanceBasis: '', intervalUnit: 'Years', taskType: 'Testing', jobPriority: 'Critical', department: 'C/E', yesNo: '' },
    { maintenanceBasis: '', intervalUnit: 'Hours', taskType: 'Repair', jobPriority: '', department: '2/E', yesNo: '' },
    { maintenanceBasis: '', intervalUnit: '', taskType: 'Replacement', jobPriority: '', department: '3/E', yesNo: '' },
    { maintenanceBasis: '', intervalUnit: '', taskType: 'Cleaning', jobPriority: '', department: '4/E', yesNo: '' },
    { maintenanceBasis: '', intervalUnit: '', taskType: 'Calibration', jobPriority: '', department: 'ETO', yesNo: '' }
  ];
  
  listValues.forEach(row => listsSheet.addRow(row));
  
  // Add data validations to jobs sheet (26-column layout, with Interval Running Hours restored)
  // Column G (Maintenance Basis) - row 2 onwards (Calendar, Running Hours, Dual Frequency)
  jobsSheet.getColumn(7).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$A$2:$A$4']  // Calendar, Running Hours, Dual Frequency
      };
    }
  });
  
  // Column I (Unit)
  jobsSheet.getColumn(9).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$B$2:$B$6']
      };
    }
  });

  // Column J (Interval Running Hours) - no validation, free-form number

  // Column K (Task Type) - shifted +1 from col 10
  jobsSheet.getColumn(11).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$C$2:$C$9']
      };
    }
  });

  // Column N (Job Priority) - shifted +1 from col 13
  jobsSheet.getColumn(14).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$D$2:$D$5']
      };
    }
  });

  // Column O (Class Related) - shifted +1 from col 14 - Yes/No
  jobsSheet.getColumn(15).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$F$2:$F$3']
      };
    }
  });

  // Column R (Department) - shifted +1 from col 17
  jobsSheet.getColumn(18).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$E$2:$E$9']
      };
    }
  });

  // Column S (Criticality) - shifted +1 from col 18 - Yes/No
  jobsSheet.getColumn(19).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$F$2:$F$3']
      };
    }
  });

  // Column T (Is Active) - shifted +1 from col 19 - Yes/No
  jobsSheet.getColumn(20).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
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
export async function generateSparesTemplate(vesselId: string): Promise<Buffer> {
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
  // Note: Includes 'reserved' column to match exact 27-column template specification (no Vessel Code)
  validComponents.forEach((component, index) => {
    sparesSheet.addRow({
      partCode: '',  // User fills this
      reserved: '',  // Reserved empty column B
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
      evidenceType: ''
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
  // Column indices adjusted for 28-column format (with reserved Column B)
  for (let row = 2; row <= 1000; row++) {
    // Column I (UOM) - Column 9
    sparesSheet.getCell(row, 9).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['=Lists!$A$2:$A$11']
    };
    
    // Column R (Criticality) - Column 18
    sparesSheet.getCell(row, 18).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['=Lists!$B$2:$B$3']
    };
    
    // Column Y (Is Active) - Column 25
    sparesSheet.getCell(row, 25).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['=Lists!$B$2:$B$3']
    };
    
    // Column Z (IHM) - Column 26
    sparesSheet.getCell(row, 26).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['=Lists!$B$2:$B$3']
    };
  }
  
  // Spares template has 27 data columns (A through AA), version goes in column 28 (AB)
  addVersionInfoToSheet(sparesSheet, 28);
  
  // Write to buffer and return
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
