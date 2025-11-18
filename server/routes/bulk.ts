import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { storage, calculateRecordChecksum, sortObjectKeys } from '../storage';
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
  const allCodes = validComponents.map(c => c.componentCode);
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
  const leafComponents = validComponents.filter(c => !parentCodes.has(c.componentCode));
  console.log(`🌿 Filtered to ${leafComponents.length} leaf node components (actual equipment)`);
  console.log(`🚫 Excluded ${validComponents.length - leafComponents.length} parent components from template`);
  
  if (parentCodes.size > 0) {
    console.log(`   Parent codes excluded: ${[...parentCodes].sort().join(', ')}`);
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
  
  // Filter to include only leaf nodes (actual equipment, not parent categories)
  const allCodes = validComponents.map(c => c.componentCode);
  const parentCodes = new Set<string>();
  
  allCodes.forEach(code1 => {
    const cleanCode1 = stripSFISuffix(code1);
    
    allCodes.forEach(code2 => {
      if (code1 === code2) return;
      
      const cleanCode2 = stripSFISuffix(code2);
      
      // Check if code1 is a parent of code2
      if (cleanCode2.startsWith(cleanCode1 + '.')) {
        parentCodes.add(code1);
        return;
      }
      
      if (cleanCode2.startsWith(cleanCode1) && cleanCode2.length > cleanCode1.length && !cleanCode1.includes('.')) {
        parentCodes.add(code1);
        return;
      }
    });
  });
  
  const leafComponents = validComponents.filter(c => !parentCodes.has(c.componentCode));
  console.log(`🌿 Filtered to ${leafComponents.length} leaf node components (actual equipment)`);
  console.log(`🚫 Excluded ${validComponents.length - leafComponents.length} parent components from template`);
  
  // Create main "jobs" sheet with all 23 Vessel_Job Sheet columns
  const jobsSheet = workbook.addWorksheet('Vessel_Job');
  
  // Add headers matching the Vessel_Job Sheet structure (23 columns)
  jobsSheet.columns = [
    { header: 'Vessel Code', key: 'vesselCode', width: 15 },
    { header: 'Component Code', key: 'componentCode', width: 25 },
    { header: 'Component Name', key: 'componentName', width: 30 },
    { header: 'Job Code', key: 'jobCode', width: 15 },
    { header: 'Job Category', key: 'jobCategory', width: 20 },
    { header: 'Maintenance Task', key: 'maintenanceTask', width: 35 },
    { header: 'Maintenance Basis', key: 'maintenanceBasis', width: 18 },
    { header: 'Frequency Value', key: 'frequencyValue', width: 15 },
    { header: 'Frequency Unit', key: 'frequencyUnit', width: 15 },
    { header: 'Task Type', key: 'taskType', width: 20 },
    { header: 'Brief Job Description', key: 'briefJobDescription', width: 50 },
    { header: 'Required Spare Parts', key: 'requiredSpareParts', width: 30 },
    { header: 'Required Tools', key: 'requiredTools', width: 30 },
    { header: 'Required Safety Items', key: 'requiredSafetyItems', width: 30 },
    { header: 'Job Priority', key: 'jobPriority', width: 12 },
    { header: 'Planned Duration', key: 'plannedDuration', width: 15 },
    { header: 'Last Done Date', key: 'lastDoneDate', width: 15 },
    { header: 'Initial Next Due', key: 'initialNextDue', width: 15 },
    { header: 'Person In Charge', key: 'personInCharge', width: 20 },
    { header: 'Responsible Department', key: 'responsibleDepartment', width: 20 },
    { header: 'Dept Code', key: 'deptCode', width: 12 },
    { header: 'Class Related', key: 'classRelated', width: 15 },
    { header: 'Critical', key: 'critical', width: 12 }
  ];
  
  // Pre-populate only leaf node components in the template
  leafComponents.forEach(component => {
    jobsSheet.addRow({
      vesselCode: vesselId,
      componentCode: component.componentCode,
      componentName: component.name,
      jobCode: '',
      jobCategory: '',
      maintenanceTask: '',
      maintenanceBasis: '',
      frequencyValue: '',
      frequencyUnit: '',
      taskType: '',
      briefJobDescription: '',
      requiredSpareParts: '',
      requiredTools: '',
      requiredSafetyItems: '',
      jobPriority: '',
      plannedDuration: '',
      lastDoneDate: '',
      initialNextDue: '',
      personInCharge: '',
      responsibleDepartment: '',
      deptCode: '',
      classRelated: '',
      critical: ''
    });
  });
  
  console.log(`📝 Pre-populated ${leafComponents.length} leaf node components in jobs template`);
  
  // Create "Lists" sheet for dropdown values
  const listsSheet = workbook.addWorksheet('Lists');
  listsSheet.columns = [
    { header: 'Maintenance_Basis', key: 'maintenanceBasis', width: 18 },
    { header: 'Frequency_Unit', key: 'frequencyUnit', width: 15 },
    { header: 'Task_Type', key: 'taskType', width: 20 },
    { header: 'Job_Priority', key: 'jobPriority', width: 12 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Yes_No', key: 'yesNo', width: 10 }
  ];
  
  // Add dropdown values
  const listValues = [
    { maintenanceBasis: 'Calendar', frequencyUnit: 'Days', taskType: 'Inspection', jobPriority: 'Low', department: 'Engine', yesNo: 'Yes' },
    { maintenanceBasis: 'Running Hours', frequencyUnit: 'Weeks', taskType: 'Overhaul', jobPriority: 'Medium', department: 'Deck', yesNo: 'No' },
    { maintenanceBasis: 'Condition Based', frequencyUnit: 'Months', taskType: 'Service', jobPriority: 'High', department: 'Electrical', yesNo: '' },
    { maintenanceBasis: '', frequencyUnit: 'Years', taskType: 'Testing', jobPriority: 'Critical', department: 'C/E', yesNo: '' },
    { maintenanceBasis: '', frequencyUnit: 'Hours', taskType: 'Repair', jobPriority: '', department: '2/E', yesNo: '' },
    { maintenanceBasis: '', frequencyUnit: '', taskType: 'Replacement', jobPriority: '', department: '3/E', yesNo: '' },
    { maintenanceBasis: '', frequencyUnit: '', taskType: 'Cleaning', jobPriority: '', department: '4/E', yesNo: '' },
    { maintenanceBasis: '', frequencyUnit: '', taskType: 'Calibration', jobPriority: '', department: 'ETO', yesNo: '' }
  ];
  
  listValues.forEach(row => listsSheet.addRow(row));
  
  // Add data validations to jobs sheet
  // Column G (Maintenance Basis) - row 2 onwards
  jobsSheet.getColumn(7).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$A$2:$A$4']
      };
    }
  });
  
  // Column I (Frequency Unit)
  jobsSheet.getColumn(9).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$B$2:$B$6']
      };
    }
  });
  
  // Column J (Task Type)
  jobsSheet.getColumn(10).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$C$2:$C$9']
      };
    }
  });
  
  // Column O (Job Priority)
  jobsSheet.getColumn(15).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$D$2:$D$5']
      };
    }
  });
  
  // Column T (Responsible Department)
  jobsSheet.getColumn(20).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$E$2:$E$9']
      };
    }
  });
  
  // Column V (Class Related) - Yes/No
  jobsSheet.getColumn(22).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$F$2:$F$3']
      };
    }
  });
  
  // Column W (Critical) - Yes/No
  jobsSheet.getColumn(23).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$F$2:$F$3']
      };
    }
  });
  
  // Write to buffer and return
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Helper function to generate spares template using ExcelJS with prepopulated components
async function generateSparesTemplate(vesselId: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  // Fetch all components from the system for this vessel
  const allComponents = await storage.getComponents(vesselId);
  console.log(`📋 Fetched ${allComponents.length} components for vessel ${vesselId}`);
  
  // Filter out components without valid codes
  const validComponents = allComponents.filter(c => c.componentCode && c.componentCode.trim() !== '' && c.name && c.name.trim() !== '');
  console.log(`✅ ${validComponents.length} components have valid codes and names`);
  
  // Create main "Spares" sheet
  const sparesSheet = workbook.addWorksheet('Spares');
  
  // Add headers - 23 columns matching user's template
  sparesSheet.columns = [
    { header: 'Fleet Equipment Name', key: 'fleetEquipmentName', width: 25 },
    { header: 'Vessel Code', key: 'vesselCode', width: 12 },
    { header: 'Component Code', key: 'componentCode', width: 20 },
    { header: 'Component Name', key: 'componentName', width: 30 },
    { header: 'Part Code', key: 'partCode', width: 18 },
    { header: 'Part Name', key: 'partName', width: 35 },
    { header: 'Part Number', key: 'partNumber', width: 20 },
    { header: 'Unit Of Measurement', key: 'uom', width: 12 },
    { header: 'Stocking Number', key: 'stockingNumber', width: 20 },
    { header: 'Maker', key: 'maker', width: 20 },
    { header: 'Maker Code', key: 'makerCode', width: 15 },
    { header: 'Specification', key: 'specification', width: 30 },
    { header: 'Drawing No', key: 'drawingNo', width: 18 },
    { header: 'Location', key: 'location', width: 20 },
    { header: 'ROB', key: 'rob', width: 10 },
    { header: 'Min Stock', key: 'minStock', width: 10 },
    { header: 'Max Stock', key: 'maxStock', width: 10 },
    { header: 'Unit Cost', key: 'unitCost', width: 12 },
    { header: 'Criticality (Yes/No)', key: 'criticality', width: 15 },
    { header: 'Lead Time', key: 'leadTime', width: 15 },
    { header: 'Supplier', key: 'supplier', width: 25 },
    { header: 'Last Order Date', key: 'lastOrderDate', width: 18 },
    { header: 'Remarks', key: 'remarks', width: 35 }
  ];
  
  // Add one example row
  sparesSheet.addRow({
    fleetEquipmentName: 'ME cylinder covers',
    vesselCode: vesselId,
    componentCode: '651.552.AA',
    componentName: 'ME cylinder covers,exhaust',
    partCode: 'PT-000001',
    partName: 'Cylinder Head Gasket',
    partNumber: 'GHI-2345',
    uom: 'PCS',
    stockingNumber: 'STK-12345',
    maker: 'Maker ZZZ',
    makerCode: 'MKR-001',
    specification: 'Size: YYY',
    drawingNo: 'DRW-651-552',
    location: 'Engine Room Store',
    rob: '5',
    minStock: '2',
    maxStock: '10',
    unitCost: '1250.00',
    criticality: 'Yes',
    leadTime: '30 days',
    supplier: 'ABC Suppliers Ltd',
    lastOrderDate: '15-NOV-2024',
    remarks: 'Critical spare for main engine'
  });
  
  console.log(`📝 Added example row to spares template`);
  
  // Create "Components" reference sheet
  const componentsSheet = workbook.addWorksheet('Components');
  componentsSheet.columns = [
    { header: 'Component Code', key: 'componentCode', width: 20 },
    { header: 'Component Name', key: 'componentName', width: 40 },
    { header: 'Category', key: 'category', width: 35 }
  ];
  
  // Add all valid components to reference sheet
  validComponents.forEach(component => {
    componentsSheet.addRow({
      componentCode: component.componentCode,
      componentName: component.name,
      category: component.category || ''
    });
  });
  
  console.log(`📋 Added ${validComponents.length} components to reference sheet`);
  
  // Create "Lists" sheet for dropdown values
  const listsSheet = workbook.addWorksheet('Lists');
  listsSheet.columns = [
    { header: 'UOM', key: 'uom', width: 15 },
    { header: 'Criticality', key: 'criticality', width: 15 }
  ];
  
  // Add UOM values
  UOM_LIST.forEach(uom => {
    listsSheet.addRow({ uom: uom.toUpperCase(), criticality: '' });
  });
  
  // Add Yes/No for Criticality in the first two rows
  listsSheet.getCell('B1').value = 'Criticality';
  listsSheet.getCell('B2').value = 'Yes';
  listsSheet.getCell('B3').value = 'No';
  
  // Add data validations to Spares sheet
  // Column H (UOM) - row 2 onwards
  sparesSheet.getColumn(8).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$A$2:$A$11']
      };
    }
  });
  
  // Column S (Criticality) - row 2 onwards
  sparesSheet.getColumn(19).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=Lists!$B$2:$B$3']
      };
    }
  });
  
  // Write to buffer and return
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Generate template based on type
router.get('/template', async (req, res) => {
  const { type, vesselId } = req.query;
  
  if (!['components', 'spares', 'stores', 'work-orders', 'jobs'].includes(type as string)) {
    return res.status(400).json({ error: 'Invalid template type' });
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
        // Vessel Component Sheet - 23 columns
        'Fleet Equipment Code', 'Fleet Equipment Name', 'Parent Component Code',
        'Component Code', 'Component Name', 'Component Category',
        'Maker', 'Maker Code', 'Model', 'Model Number', 'Serial No', 'Drawing No',
        'Location', 'Critical (Yes/No)', 'Condition Based (Yes/No)',
        'Installation Date', 'Commissioned Date', 'Rating',
        'Eqpt / System Department', 'Notes', 'Running Hours',
        'IS Active', 'Vessel Code'
      ];

      validValues = [
        'Text (Fleet ID)', 'Text (General name from SFI)', 'Text (Optional)',
        'Required, SFI Format', 'Required', 'Auto-calculated from code',
        'Text (Manufacturer)', 'Text (Unique maker ID)', 'Text', 'Text', 'Text', 'Text (Drawing #)',
        'Text', 'Yes/No', 'Yes/No',
        'DD-MM-YYYY', 'DD-MM-YYYY', 'Text (Capacity)',
        'Text', 'Text (Specifications)', 'Number >= 0',
        'Yes/No', 'Text (Vessel identifier)'
      ];

      example = [
        'FE-711', 'LO Transfer System', '',
        '711.001', 'LO transfer systems', '7 Systems for Machinery Main Components',
        'ABC Marine', 'ABC-001', 'LO-2000', 'LO-2000-X', 'SN-12345', 'DRW-711-001',
        'Engine Room', 'Yes', 'No',
        '01-01-2020', '15-03-2020', '50 bar',
        'Engineering', 'Lube oil transfer and circulation system', '5000',
        'Yes', 'V001'
      ];
      break;

    case 'spares':
      headers = [
        'Fleet Equipment Name', 'Vessel Code', 'Component Code', 'Component Name',
        'Part Code', 'Part Name', 'Part Number', 'Unit Of Measurement',
        'Stocking Number', 'Maker', 'Maker Code', 'Specification',
        'Drawing No', 'Location', 'ROB', 'Min Stock', 'Max Stock',
        'Unit Cost', 'Criticality (Yes/No)', 'Lead Time', 'Supplier',
        'Last Order Date', 'Remarks'
      ];

      validValues = [
        'Text (Fleet reference)', 'Required (e.g., V001)', 'Required, Must exist in system', 'Auto-filled from component',
        'Auto-generated PT-XXXXXX or manual', 'Required', 'Text (Manufacturer P/N)', UOM_LIST.join('|'),
        'Text (Internal stock ref)', 'Text (Manufacturer)', 'Text (Maker ID)', 'Text (Technical specs)',
        'Text (Drawing reference)', 'Text (Storage location)', 'Number >= 0', 'Number >= 0', 'Number >= 0',
        'Decimal (Cost per unit)', 'Yes/No', 'Text (e.g., 30 days)', 'Text (Supplier name)',
        'DD-MMM-YYYY', 'Text (Additional notes)'
      ];

      example = [
        'ME cylinder covers', 'V001', '651.552.AA', 'ME cylinder covers,exhaust',
        'PT-000001', 'Cylinder Head Gasket', 'GHI-2345', 'PCS',
        'STK-12345', 'Maker ZZZ', 'MKR-001', 'Size: YYY',
        'DRW-651-552', 'Engine Room Store', '5', '2', '10',
        '1250.00', 'Yes', '30 days', 'ABC Suppliers Ltd',
        '15-NOV-2024', 'Critical spare for main engine'
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
        'Generated_Component_Code', 'Component_Name', 'Job_Code', 'Job_Title', 
        'Job_Description', 'Department', 'Responsible_Rank', 'Schedule_Type',
        'Interval', 'Interval_Unit', 'Criticality', 'Estimated_Hours', 
        'Spares_Required', 'Safety_Permit_Required'
      ];

      validValues = [
        'Required (from system)', 'Auto-filled from component', 'Optional (e.g., ME-001)', 'Required',
        'Optional task description', 'Engine|Deck|Electrical', 'Chief Engineer|2nd Engineer|3rd Engineer|4th Engineer|Chief Officer|Electrician',
        'Running Hours|Calendar', 'Number (e.g., 500, 6)', 'Hours|Days|Weeks|Months|Years',
        'yes|no', 'Number of hours', 'Optional spare parts required', 'Hot Work|Enclosed Space Entry|Lockout-Tagout|Working Aloft'
      ];

      example = [
        '601(1)', 'DIESEL ENGINES 1', 'ME-001', 'Check Turbocharger Bearings',
        'Inspect for wear, check lube oil supply, and clean intake side.', 'Engine', '2nd Engineer',
        'Running Hours', '500', 'Hours', 'yes', '4', 'Bearing Set P/N 12345', 'Hot Work'
      ];
      break;
  }

  // Create main sheet - Just headers and example, NO description row
  const mainSheet = XLSX.utils.aoa_to_sheet([headers, example]);

  // Add data validation for components (23-column format)
  if (type === 'components') {
    if (!mainSheet['!dataValidation']) {
      mainSheet['!dataValidation'] = [];
    }

    // Column N: Critical (Yes/No) - row 2 onwards
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

    // Column V: IS Active (Yes/No) - row 2 onwards
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'V2:V1000',
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

    // UOM dropdown (Column H - Unit Of Measurement, starting from row 2)
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

    // Criticality (Yes/No) dropdown (Column S, starting from row 2)
    mainSheet['!dataValidation'].push({
      type: 'list',
      operator: 'equal',
      sqref: 'S2:S1000',
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
  } else {
    // For non-work-orders, use standard "Data" sheet name
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
  const historyId = uuidv4();
  const startedAt = new Date();
  
  try {
    const { fileToken, type, mode, archiveMissing, vesselId, rowIndices } = req.body;

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
      historyId // Pass history ID for change tracking
    );

    // Update ImportHistory with status='complete' and include file metadata
    await storage.updateImportHistory(historyId, {
      ...importResult,
      finishedAt: new Date(),
      status: 'complete',
      originalFile: cachedData.file,
      originalName: cachedData.originalName
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

  // Filter out instruction/description rows (rows where Component Code contains descriptive text like "Required")
  // Keep only rows with valid SFI codes or empty rows
  const filteredData = data.filter((row, index) => {
    const componentCode = row['Component Code'];
    if (!componentCode) return false; // Skip empty rows
    
    const codeStr = String(componentCode).trim();
    
    // Skip instruction rows - they typically contain words like "Required", "Text", "Unique", etc.
    // Valid SFI codes should match the pattern: digits with optional dots
    if (type === 'components') {
      // If it contains common instruction keywords, skip it
      const instructionKeywords = ['required', 'unique', 'text', 'number', 'yes/no', 'dd-mm-yyyy', 'maximum', 'allowable'];
      const lowerCode = codeStr.toLowerCase();
      if (instructionKeywords.some(keyword => lowerCode.includes(keyword))) {
        console.log(`Skipping instruction row ${index + 2}: ${codeStr}`);
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

      // Validate Yes/No fields with support for IS Active
      ['Critical (Yes/No)', 'Condition Based (Yes/No)', 'IS Active'].forEach(field => {
        if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
          const value = String(row[field]).toLowerCase().trim();
          if (!['yes', 'no', 'y', 'n', 'true', 'false', '1', '0'].includes(value)) {
            errors.push(`Row ${rowNum}: ${field} must be Yes or No`);
          } else {
            // Normalize to boolean-friendly format
            normalized[field] = ['yes', 'y', 'true', '1'].includes(value);
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

      // Copy text fields directly
      const textFields = [
        'Fleet Equipment Code', 'Fleet Equipment Name', 'Maker', 'Maker Code',
        'Model', 'Model Number', 'Serial No', 'Drawing No', 'Location',
        'Rating', 'Eqpt / System Department', 'Notes', 'Vessel Code'
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

      // Unit Of Measurement - validate against UOM_LIST
      const uomField = row['Unit Of Measurement'] || row['UOM'];
      if (uomField) {
        const uomValue = String(uomField).toLowerCase().trim();
        if (!UOM_LIST.includes(uomValue)) {
          errors.push(`Row ${rowNum}: Invalid Unit Of Measurement. Allowed: ${UOM_LIST.join(', ')}`);
        } else {
          normalized['Unit Of Measurement'] = uomValue.toUpperCase();
        }
      }

      // Validate numeric fields
      ['ROB', 'Min Stock', 'Max Stock'].forEach(field => {
        if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
          const num = parseInt(row[field]);
          if (isNaN(num) || num < 0) {
            errors.push(`Row ${rowNum}: ${field} must be a non-negative integer`);
          } else {
            normalized[field] = num;
          }
        }
      });

      // Validate Unit Cost (decimal)
      if (row['Unit Cost'] !== undefined && row['Unit Cost'] !== null && row['Unit Cost'] !== '') {
        const cost = parseFloat(row['Unit Cost']);
        if (isNaN(cost) || cost < 0) {
          errors.push(`Row ${rowNum}: Unit Cost must be a non-negative number`);
        } else {
          normalized['Unit Cost'] = cost;
        }
      }

      // Validate Criticality (Yes/No)
      if (row['Criticality (Yes/No)']) {
        const value = String(row['Criticality (Yes/No)']).toLowerCase().trim();
        if (!['yes', 'no', 'y', 'n'].includes(value)) {
          errors.push(`Row ${rowNum}: Criticality must be Yes or No`);
        } else {
          normalized['Criticality (Yes/No)'] = ['yes', 'y'].includes(value) ? 'Yes' : 'No';
        }
      }

      // Copy text fields directly
      const textFields = [
        'Fleet Equipment Name', 'Stocking Number', 'Maker', 'Maker Code',
        'Specification', 'Drawing No', 'Location', 'Lead Time',
        'Supplier', 'Last Order Date', 'Remarks'
      ];
      
      textFields.forEach(field => {
        if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
          normalized[field] = String(row[field]).trim();
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
      // Validate jobs (23-field Vessel_Job Sheet format)
      // Skip rows that don't have Maintenance Task - user only fills in components they want jobs for
      if (!row['Maintenance Task'] || String(row['Maintenance Task']).trim() === '') {
        // Skip empty rows (component without job) - don't add to results
        continue;
      }
      
      // If Maintenance Task is provided, then this is a real job - validate it
      normalized['Maintenance Task'] = String(row['Maintenance Task']).trim();
      
      // Vessel Code - required
      if (!row['Vessel Code']) {
        errors.push(`Row ${rowNum}: Vessel Code is required`);
      } else {
        normalized['Vessel Code'] = String(row['Vessel Code']).trim();
      }
      
      // Component Code - required
      if (!row['Component Code']) {
        errors.push(`Row ${rowNum}: Component Code is required`);
      } else {
        normalized['Component Code'] = String(row['Component Code']).trim();
        // TODO: Check if component exists
      }

      // Component Name is often auto-filled, but validate if provided
      if (row['Component Name']) {
        normalized['Component Name'] = String(row['Component Name']).trim();
      }

      // Job Code is optional (will be auto-generated as JOB-XXXXXXX)
      if (row['Job Code']) {
        normalized['Job Code'] = String(row['Job Code']).trim();
      }
      
      // Job Category is optional
      if (row['Job Category']) {
        normalized['Job Category'] = String(row['Job Category']).trim();
      }

      // Maintenance Basis - required
      const validMaintenanceBasis = ['Calendar', 'Running Hours', 'Condition Based'];
      if (!row['Maintenance Basis']) {
        errors.push(`Row ${rowNum}: Maintenance Basis is required`);
      } else if (!validMaintenanceBasis.includes(row['Maintenance Basis'])) {
        errors.push(`Row ${rowNum}: Invalid Maintenance Basis. Allowed: ${validMaintenanceBasis.join(', ')}`);
      } else {
        normalized['Maintenance Basis'] = row['Maintenance Basis'];
      }

      // Validate Frequency Value and Frequency Unit based on Maintenance Basis
      const maintenanceBasis = row['Maintenance Basis'];
      if (maintenanceBasis === 'Calendar' || maintenanceBasis === 'Running Hours') {
        // Frequency Value is required for Calendar and Running Hours
        if (!row['Frequency Value']) {
          errors.push(`Row ${rowNum}: Frequency Value is required for ${maintenanceBasis} maintenance`);
        } else {
          const frequency = parseFloat(row['Frequency Value']);
          if (isNaN(frequency) || frequency <= 0) {
            errors.push(`Row ${rowNum}: Frequency Value must be a positive number`);
          } else {
            normalized['Frequency Value'] = String(frequency);
          }
        }

        // Frequency Unit is required only for Calendar basis
        if (maintenanceBasis === 'Calendar') {
          const validFrequencyUnits = ['Hours', 'Days', 'Weeks', 'Months', 'Years'];
          if (!row['Frequency Unit']) {
            errors.push(`Row ${rowNum}: Frequency Unit is required for Calendar maintenance`);
          } else if (!validFrequencyUnits.includes(row['Frequency Unit'])) {
            errors.push(`Row ${rowNum}: Invalid Frequency Unit. Allowed: ${validFrequencyUnits.join(', ')}`);
          } else {
            normalized['Frequency Unit'] = row['Frequency Unit'];
          }
        } else {
          // Running Hours - Frequency Unit defaults to Hours
          if (row['Frequency Unit']) {
            if (row['Frequency Unit'] !== 'Hours') {
              warnings.push(`Row ${rowNum}: Frequency Unit for Running Hours should be 'Hours' (will be set to Hours)`);
            }
          }
          normalized['Frequency Unit'] = 'Hours';
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

      // Brief Job Description is optional
      if (row['Brief Job Description']) {
        normalized['Brief Job Description'] = String(row['Brief Job Description']).trim();
      }

      // Required Spare Parts is optional
      if (row['Required Spare Parts']) {
        normalized['Required Spare Parts'] = String(row['Required Spare Parts']).trim();
      }

      // Required Tools is optional
      if (row['Required Tools']) {
        normalized['Required Tools'] = String(row['Required Tools']).trim();
      }

      // Required Safety Items is optional
      if (row['Required Safety Items']) {
        normalized['Required Safety Items'] = String(row['Required Safety Items']).trim();
      }

      // Job Priority is optional
      const validJobPriorities = ['Low', 'Medium', 'High', 'Critical'];
      if (row['Job Priority'] && !validJobPriorities.includes(row['Job Priority'])) {
        errors.push(`Row ${rowNum}: Invalid Job Priority. Allowed: ${validJobPriorities.join(', ')}`);
      } else if (row['Job Priority']) {
        normalized['Job Priority'] = row['Job Priority'];
      }

      // Planned Duration is optional
      if (row['Planned Duration']) {
        const duration = parseFloat(row['Planned Duration']);
        if (isNaN(duration) || duration < 0) {
          errors.push(`Row ${rowNum}: Planned Duration must be a non-negative number`);
        } else {
          normalized['Planned Duration'] = String(duration);
        }
      }

      // Date fields are optional
      if (row['Last Done Date']) {
        normalized['Last Done Date'] = String(row['Last Done Date']).trim();
      }

      if (row['Initial Next Due']) {
        normalized['Initial Next Due'] = String(row['Initial Next Due']).trim();
      }

      // Person In Charge is optional
      if (row['Person In Charge']) {
        normalized['Person In Charge'] = String(row['Person In Charge']).trim();
      }

      // Responsible Department is optional
      const validDepartmentsJobs = ['Engine', 'Deck', 'Electrical', 'C/E', '2/E', '3/E', '4/E', 'ETO'];
      if (row['Responsible Department'] && !validDepartmentsJobs.includes(row['Responsible Department'])) {
        errors.push(`Row ${rowNum}: Invalid Responsible Department. Allowed: ${validDepartmentsJobs.join(', ')}`);
      } else if (row['Responsible Department']) {
        normalized['Responsible Department'] = row['Responsible Department'];
      }

      // Dept Code is optional
      if (row['Dept Code']) {
        normalized['Dept Code'] = String(row['Dept Code']).trim();
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

      // Critical - optional yes/no
      if (row['Critical']) {
        const value = row['Critical'].toString().toLowerCase();
        if (!['yes', 'no'].includes(value)) {
          errors.push(`Row ${rowNum}: Critical must be Yes or No`);
        } else {
          normalized['Critical'] = value;
        }
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
  entityType: 'component' | 'job' | 'spare' | 'workOrder',
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
  importHistoryId?: string
) {
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
    archived: 0
  };

  if (type === 'components') {
    console.log(`🚀 Starting component import: ${data.length} rows, mode: ${mode}`);
    
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
          const updatedComponent = await updateComponentFromRow(componentCode, row);
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
          const updatedComponent = await updateComponentFromRow(componentCode, row);
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
          
          // Create new spare
          const newSpare = await storage.createSpare({
            partCode: partCode,
            partName: String(row['Part Name']).trim(),
            componentId: component.id,
            componentCode: componentCode,
            componentName: component.name || '',
            componentSpareCode: `SP-${componentCode}-${String(result.created + 1).padStart(3, '0')}`,
            critical: row['Criticality (Yes/No)'] === 'Yes' ? 'Yes' : 'No',
            rob: row['ROB'] ? parseInt(row['ROB']) : 0,
            min: row['Min Stock'] ? parseInt(row['Min Stock']) : 0,
            location: row['Location'] ? String(row['Location']).trim() : null,
            vesselId: vesselId,
            partNumber: row['Part Number'] ? String(row['Part Number']).trim() : null,
            uom: row['Unit Of Measurement'] ? String(row['Unit Of Measurement']).toUpperCase() : null,
            stockingNumber: row['Stocking Number'] ? String(row['Stocking Number']).trim() : null,
            maker: row['Maker'] ? String(row['Maker']).trim() : null,
            makerCode: row['Maker Code'] ? String(row['Maker Code']).trim() : null,
            specification: row['Specification'] ? String(row['Specification']).trim() : null,
            drawingNumber: row['Drawing No'] ? String(row['Drawing No']).trim() : null,
            max: row['Max Stock'] ? parseInt(row['Max Stock']) : null,
            unitCost: row['Unit Cost'] ? String(row['Unit Cost']) : null,
            leadTime: row['Lead Time'] ? String(row['Lead Time']).trim() : null,
            supplier: row['Supplier'] ? String(row['Supplier']).trim() : null,
            lastOrderDate: row['Last Order Date'] ? String(row['Last Order Date']).trim() : null,
            note: row['Remarks'] ? String(row['Remarks']).trim() : null,
            dataScope: 'vessel'
          });
          
          sparesByPartCode.set(partCode, newSpare);
          result.created++;
          
          // Track change if history tracking is enabled
          if (importHistoryId) {
            await trackChange(importHistoryId, 'created', 'spare', String(newSpare.id), null, newSpare);
          }
          
          console.log(`✅ Created spare: ${partCode} - ${newSpare.partName}`);
          
        } else if (mode === 'update') {
          if (!existingSpare) {
            console.log(`⏭️ Part Code ${partCode} not found for update, skipping`);
            result.skipped++;
            continue;
          }
          
          // Update existing spare
          const updatedSpare = await storage.updateSpare(existingSpare.id, {
            partName: String(row['Part Name']).trim(),
            componentId: component.id,
            componentCode: componentCode,
            componentName: component.name || '',
            critical: row['Criticality (Yes/No)'] === 'Yes' ? 'Yes' : 'No',
            rob: row['ROB'] ? parseInt(row['ROB']) : existingSpare.rob,
            min: row['Min Stock'] ? parseInt(row['Min Stock']) : existingSpare.min,
            location: row['Location'] ? String(row['Location']).trim() : existingSpare.location,
            partNumber: row['Part Number'] ? String(row['Part Number']).trim() : existingSpare.partNumber,
            uom: row['Unit Of Measurement'] ? String(row['Unit Of Measurement']).toUpperCase() : existingSpare.uom,
            stockingNumber: row['Stocking Number'] ? String(row['Stocking Number']).trim() : existingSpare.stockingNumber,
            maker: row['Maker'] ? String(row['Maker']).trim() : existingSpare.maker,
            makerCode: row['Maker Code'] ? String(row['Maker Code']).trim() : existingSpare.makerCode,
            specification: row['Specification'] ? String(row['Specification']).trim() : existingSpare.specification,
            drawingNumber: row['Drawing No'] ? String(row['Drawing No']).trim() : existingSpare.drawingNumber,
            max: row['Max Stock'] ? parseInt(row['Max Stock']) : existingSpare.max,
            unitCost: row['Unit Cost'] ? String(row['Unit Cost']) : existingSpare.unitCost,
            leadTime: row['Lead Time'] ? String(row['Lead Time']).trim() : existingSpare.leadTime,
            supplier: row['Supplier'] ? String(row['Supplier']).trim() : existingSpare.supplier,
            lastOrderDate: row['Last Order Date'] ? String(row['Last Order Date']).trim() : existingSpare.lastOrderDate,
            note: row['Remarks'] ? String(row['Remarks']).trim() : existingSpare.note
          });
          
          sparesByPartCode.set(partCode, updatedSpare);
          result.updated++;
          
          if (importHistoryId) {
            await trackChange(importHistoryId, 'updated', 'spare', String(updatedSpare.id), existingSpare, updatedSpare);
          }
          
          console.log(`🔄 Updated spare: ${partCode} - ${updatedSpare.partName}`);
          
        } else if (mode === 'upsert') {
          if (existingSpare) {
            // Update existing
            const updatedSpare = await storage.updateSpare(existingSpare.id, {
              partName: String(row['Part Name']).trim(),
              componentId: component.id,
              componentCode: componentCode,
              componentName: component.name || '',
              critical: row['Criticality (Yes/No)'] === 'Yes' ? 'Yes' : 'No',
              rob: row['ROB'] ? parseInt(row['ROB']) : existingSpare.rob,
              min: row['Min Stock'] ? parseInt(row['Min Stock']) : existingSpare.min,
              location: row['Location'] ? String(row['Location']).trim() : existingSpare.location,
              partNumber: row['Part Number'] ? String(row['Part Number']).trim() : existingSpare.partNumber,
              uom: row['Unit Of Measurement'] ? String(row['Unit Of Measurement']).toUpperCase() : existingSpare.uom,
              stockingNumber: row['Stocking Number'] ? String(row['Stocking Number']).trim() : existingSpare.stockingNumber,
              maker: row['Maker'] ? String(row['Maker']).trim() : existingSpare.maker,
              makerCode: row['Maker Code'] ? String(row['Maker Code']).trim() : existingSpare.makerCode,
              specification: row['Specification'] ? String(row['Specification']).trim() : existingSpare.specification,
              drawingNumber: row['Drawing No'] ? String(row['Drawing No']).trim() : existingSpare.drawingNumber,
              max: row['Max Stock'] ? parseInt(row['Max Stock']) : existingSpare.max,
              unitCost: row['Unit Cost'] ? String(row['Unit Cost']) : existingSpare.unitCost,
              leadTime: row['Lead Time'] ? String(row['Lead Time']).trim() : existingSpare.leadTime,
              supplier: row['Supplier'] ? String(row['Supplier']).trim() : existingSpare.supplier,
              lastOrderDate: row['Last Order Date'] ? String(row['Last Order Date']).trim() : existingSpare.lastOrderDate,
              note: row['Remarks'] ? String(row['Remarks']).trim() : existingSpare.note
            });
            
            sparesByPartCode.set(partCode, updatedSpare);
            result.updated++;
            
            if (importHistoryId) {
              await trackChange(importHistoryId, 'updated', 'spare', String(updatedSpare.id), existingSpare, updatedSpare);
            }
            
            console.log(`🔄 Updated spare (upsert): ${partCode} - ${updatedSpare.partName}`);
          } else {
            // Create new
            const newSpare = await storage.createSpare({
              partCode: partCode,
              partName: String(row['Part Name']).trim(),
              componentId: component.id,
              componentCode: componentCode,
              componentName: component.name || '',
              componentSpareCode: `SP-${componentCode}-${String(result.created + 1).padStart(3, '0')}`,
              critical: row['Criticality (Yes/No)'] === 'Yes' ? 'Yes' : 'No',
              rob: row['ROB'] ? parseInt(row['ROB']) : 0,
              min: row['Min Stock'] ? parseInt(row['Min Stock']) : 0,
              location: row['Location'] ? String(row['Location']).trim() : null,
              vesselId: vesselId,
              partNumber: row['Part Number'] ? String(row['Part Number']).trim() : null,
              uom: row['Unit Of Measurement'] ? String(row['Unit Of Measurement']).toUpperCase() : null,
              stockingNumber: row['Stocking Number'] ? String(row['Stocking Number']).trim() : null,
              maker: row['Maker'] ? String(row['Maker']).trim() : null,
              makerCode: row['Maker Code'] ? String(row['Maker Code']).trim() : null,
              specification: row['Specification'] ? String(row['Specification']).trim() : null,
              drawingNumber: row['Drawing No'] ? String(row['Drawing No']).trim() : null,
              max: row['Max Stock'] ? parseInt(row['Max Stock']) : null,
              unitCost: row['Unit Cost'] ? String(row['Unit Cost']) : null,
              leadTime: row['Lead Time'] ? String(row['Lead Time']).trim() : null,
              supplier: row['Supplier'] ? String(row['Supplier']).trim() : null,
              lastOrderDate: row['Last Order Date'] ? String(row['Last Order Date']).trim() : null,
              note: row['Remarks'] ? String(row['Remarks']).trim() : null,
              dataScope: 'vessel'
            });
            
            sparesByPartCode.set(partCode, newSpare);
            result.created++;
            
            if (importHistoryId) {
              await trackChange(importHistoryId, 'created', 'spare', String(newSpare.id), null, newSpare);
            }
            
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
    // TODO: Implement stores import
    for (const row of data) {
      result.created++;
    }
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
      
      // Map Excel columns to job schema fields
      const jobData: any = {
        vesselId: canonicalVesselId,        // FK reference to vessel
        vesselCode: vesselCodeFromExcel,    // Display/tracking field from Excel
        componentId: component.id,          // FK reference to component (UUID)
        componentCode: componentCode,       // Display/tracking field (SFI code)
        componentName: row['Component Name'] || component.name || null,
        jobCategory: row['Job Category'] || null,
        jobTitle: row['Maintenance Task'],  // Job title from Maintenance Task column
        maintenanceType: row['Task Type'],   // maintenanceType from Task Type column
        maintenanceBasis: row['Maintenance Basis'],
        frequencyValue: row['Frequency Value'] ? parseFloat(row['Frequency Value']) : null,
        frequencyUnit: row['Frequency Unit'] || null,
        jobDescription: row['Brief Job Description'] || null,
        // JSON array fields - split comma-separated lists (normalize null to [] for consistent checksums)
        requiredSpareParts: row['Required Spare Parts'] 
          ? row['Required Spare Parts'].split(',').map((s: string) => s.trim()).filter((s: string) => s)
          : [],
        requiredTools: row['Required Tools']
          ? row['Required Tools'].split(',').map((s: string) => s.trim()).filter((s: string) => s)
          : [],
        safetyRequirements: row['Required Safety Items']
          ? row['Required Safety Items'].split(',').map((s: string) => s.trim()).filter((s: string) => s)
          : [],
        jobPriority: row['Job Priority'] || null,
        plannedDuration: row['Planned Duration'] ? parseFloat(row['Planned Duration']) : null,
        lastDoneDate: row['Last Done Date'] || null,
        initialNextDue: row['Initial Next Due'] || null,
        personInCharge: row['Person In Charge'] || null,
        responsibleDepartment: row['Responsible Department'] || null,
        deptCode: row['Dept Code'] || null,
        classRelated: row['Class Related'] ? (row['Class Related'].toString().toLowerCase() === 'yes') : null,
        critical: row['Critical'] ? (row['Critical'].toString().toLowerCase() === 'yes') : null
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
    // Maker and Model fields
    maker: row['Maker'] || null,
    makerCode: row['Maker Code'] || null,
    model: row['Model'] || null,
    modelNumber: row['Model Number'] || null,
    modelCode: null, // Can be computed from Maker Code + Model if needed
    // Component specific fields
    serialNo: row['Serial No'] || null,
    drawingNo: row['Drawing No'] || null,
    // Department and categorization
    department: row['Eqpt / System Department'] || null,
    deptCategory: row['Eqpt / System Department'] || null,
    componentCategory: row['Component Category'] || row['Main Group Name'] || null,
    location: row['Location'] || null,
    eqptSystemDept: row['Eqpt / System Department'] || null,
    // Dates
    commissionedDate: row['Commissioned Date'] || null,
    installationDate: row['Installation Date'] || null,
    // Status and classification
    critical: row['Critical (Yes/No)'] === true || row['Critical (Yes/No)'] === 'Yes',
    classItem: false, // Not in template, defaulting to false
    conditionBased: row['Condition Based (Yes/No)'] === true || row['Condition Based (Yes/No)'] === 'Yes',
    isActive: row['IS Active'] !== false && row['IS Active'] !== 'No', // Default to true
    // Technical specifications
    rating: row['Rating'] || null,
    noOfUnits: null, // Not in new template
    parentComponent: row['Parent Component Code'] ? String(row['Parent Component Code']).trim() : null,
    dimensionsSize: null, // Not in new template
    notes: row['Notes'] || null,
    // Running Hours
    runningHours: row['Running Hours'] ? String(row['Running Hours']) : null,
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
  // Use Parent Component Code (auto-calculated from SFI)
  if (row['Parent Component Code']) {
    updateData.parentId = String(row['Parent Component Code']).trim();
  }
  // Fleet Equipment fields
  if (row['Fleet Equipment Code']) updateData.fleetEquipmentCode = row['Fleet Equipment Code'];
  if (row['Fleet Equipment Name']) updateData.fleetEquipmentName = row['Fleet Equipment Name'];
  // Maker and Model fields
  if (row['Maker']) updateData.maker = row['Maker'];
  if (row['Maker Code']) updateData.makerCode = row['Maker Code'];
  if (row['Model']) updateData.model = row['Model'];
  if (row['Model Number']) updateData.modelNumber = row['Model Number'];
  // Component specific fields
  if (row['Serial No']) updateData.serialNo = row['Serial No'];
  if (row['Drawing No']) updateData.drawingNo = row['Drawing No'];
  // Department and categorization
  if (row['Eqpt / System Department']) {
    updateData.department = row['Eqpt / System Department'];
    updateData.deptCategory = row['Eqpt / System Department'];
    updateData.eqptSystemDept = row['Eqpt / System Department'];
  }
  if (row['Component Category'] || row['Main Group Name']) {
    updateData.componentCategory = row['Component Category'] || row['Main Group Name'];
  }
  if (row['Location']) updateData.location = row['Location'];
  // Dates
  if (row['Commissioned Date']) updateData.commissionedDate = row['Commissioned Date'];
  if (row['Installation Date']) updateData.installationDate = row['Installation Date'];
  // Status and classification
  if (row['Critical (Yes/No)'] !== undefined) {
    updateData.critical = row['Critical (Yes/No)'] === true || row['Critical (Yes/No)'] === 'Yes';
  }
  if (row['Condition Based (Yes/No)'] !== undefined) {
    updateData.conditionBased = row['Condition Based (Yes/No)'] === true || row['Condition Based (Yes/No)'] === 'Yes';
  }
  if (row['IS Active'] !== undefined) {
    updateData.isActive = row['IS Active'] !== false && row['IS Active'] !== 'No';
  }
  // Technical specifications
  if (row['Rating']) updateData.rating = row['Rating'];
  if (row['Parent Component Code']) updateData.parentComponent = String(row['Parent Component Code']).trim();
  if (row['Notes']) updateData.notes = row['Notes'];
  // Running Hours
  if (row['Running Hours']) {
    updateData.runningHours = String(row['Running Hours']);
    updateData.currentCumulativeRH = String(row['Running Hours']);
  }
  // Vessel Code - CRITICAL: Update BOTH vesselId and vesselCode for consistency
  if (row['Vessel Code']) {
    updateData.vesselId = row['Vessel Code'];  // FK/reference
    updateData.vesselCode = row['Vessel Code'];  // Display value
  }

  // Look up component by code to get its ID, then update by ID
  const component = await storage.getComponentByCode(componentCode, updateData.vesselId);
  if (!component) {
    throw new Error(`Component ${componentCode} not found`);
  }
  
  return await storage.updateComponent(component.id, updateData);
}

// Helper function to create work order from Excel row
async function createWorkOrderFromRow(row: any, templateCode: string, vesselId?: string) {
  const componentCode = String(row['Generated_Component_Code']).trim();
  const component = await storage.getComponent(componentCode);
  
  const workOrderData = {
    vesselId: vesselId || 'V001',
    component: component?.name || row['Component_Name'] || componentCode,
    componentCode: componentCode,
    workOrderNo: row['Job_Code'] || `WO-${Date.now()}`, // Use Job_Code if provided, else temporary
    templateCode: templateCode,
    jobTitle: row['Job_Title'] || '',
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
async function updateWorkOrderFromRow(workOrderId: string, row: any) {
  const updateData: any = {};
  
  if (row['Job_Title']) updateData.jobTitle = row['Job_Title'];
  if (row['Schedule_Type']) updateData.maintenanceBasis = row['Schedule_Type'];
  if (row['Interval']) updateData.frequencyValue = String(row['Interval']);
  if (row['Interval_Unit']) updateData.frequencyUnit = row['Interval_Unit'];
  if (row['Responsible_Rank']) updateData.assignedTo = row['Responsible_Rank'];
  if (row['Criticality']) updateData.classRelated = row['Criticality'];
  if (row['Job_Description']) updateData.briefWorkDescription = row['Job_Description'];
  // Map new fields to existing schema where possible
  if (row['Job_Code']) updateData.workOrderNo = row['Job_Code'];

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

export default router;