import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { storage, calculateRecordChecksum, sortObjectKeys } from '../../../storage';
import { ObjectStorageService, ObjectNotFoundError } from '../../../objectStorage';
import {
  saveImportHistory,
  getImportHistoryById as getFileBasedHistoryById,
  updateImportHistory as updateFileBasedHistory
} from '../../../services/fileBasedImportHistory';
import { dryRunCache, cleanExpiredCache } from '../services/dryRunCache';
import {
  checkTemplateVersion,
  extractRawExcelData,
  normalizeColumnNames,
  getTypeFromSheetName,
  TEMPLATE_VERSION,
  UOM_LIST,
  STORES_CATEGORIES,
  COMPONENT_CATEGORIES,
  RESPONSIBLE_RANKS
} from '../services/helpers';
import { generateFleetMasterTemplate, generateWorkOrdersTemplate, generateJobsTemplate, generateSparesTemplate } from '../services/templateService';
import { validateData } from '../services/validationService';
import { performImport, storeImportHistory } from '../services/importService';
import { getImportHistory, getHistoryFile } from '../services/historyService';
import { createRecordSnapshot } from '../services/undoService';
import { getSparesExcelColumns } from '@shared/sparesTemplateFields';

// ── Template ──
export async function getTemplate(req: Request, res: Response) {
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
  
  if (!['components', 'spares', 'stores', 'work-orders', 'jobs', 'makers', 'fleet-components', 'fleet-jobs', 'fleet-spares'].includes(type as string)) {
    return res.status(400).json({ error: 'Invalid template type. Valid types: components, spares, stores, work-orders, jobs, makers, fleet-components, fleet-jobs, fleet-spares' });
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
        // Vessel_Spare - 27 columns (per specification, includes reserved Column B, no Vessel Code)
        'Part Code', '', 'Fleet Equipment Code', 'Fleet Equipment Name', 'Component Code', 'Component Name',
        'Part Name', 'Part Number', 'UOM', 'Drawing Number', 'Position Number',
        'Note', 'Specification', 'Maker', 'Maker Code', 'Manual Name', 'Page Number',
        'Criticality', 'Total ROB', 'Location A', 'Location A - ROB',
        'Location B', 'Location B - ROB', 'Minimum Stock', 'Is Active',
        'IHM (Inventory of Hazardous Materials)', 'Evidence Type'
      ];

      validValues = [
        'Text (Part ID)', '(Reserved)', 'Text (Fleet ID)', 'Text (Fleet description)', 'Required (Must exist)', 'Text (Component name)',
        'Required (Part name)', 'Text (P/N)', UOM_LIST.join('/').toUpperCase(), 'Text (Drawing ref)', 'Text (Position)',
        'Text (Notes)', 'Text (Specs)', 'Text (Manufacturer)', 'Text (Maker ID)', 'Text (Manual name)', 'Text (Page #)',
        'Yes/No', 'Number >= 0', 'Text (Location A)', 'Number >= 0',
        'Text (Location B)', 'Number >= 0', 'Number >= 0', 'Yes/No',
        'Yes/No', 'Text (Evidence type)'
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
      
    case 'makers':
      headers = [
        // Maker List template - matches maker_list database schema
        'Maker Code', 'Maker Name', 'Address', 'Address ID', 'Contact Person', 'Email', 'Phone', 'IS Active'
      ];

      validValues = [
        'Required (Unique identifier, e.g., MKR-000001)', 'Required (Full manufacturer name)', 
        'Text (Manufacturer address)', 'Text (Address reference ID)', 'Text (Contact person name)',
        'Text (Contact email)', 'Text (Contact phone)', 'Yes/No (defaults to Yes)'
      ];

      example = [];
      break;

    case 'fleet-components':
      headers = [
        'Parent Fleet Equipment Code', 'Fleet Equipment Code', 'Fleet Equipment Name',
        'Component Category', 'Maker Name', 'Maker Code', 'Model', 'Model Code',
        'Location', 'Rating', 'Eqpt / System Department', 'Notes', 'IS Active'
      ];

      validValues = [
        'Text (Parent code for hierarchy)', 'Required (Unique code, e.g., 601.002.01)', 'Required (Equipment name)',
        'Text (Category from Master List)', 'Text (Manufacturer name)', 'Text (Manufacturer code)',
        'Text (Equipment model)', 'Text (Model code)',
        'Text (Installation location)', 'Text (Power/capacity rating)',
        'Text (Engine/Deck/Electrical)', 'Text (Additional notes)', 'Yes/No (defaults to Yes)'
      ];

      example = [];
      break;

    case 'fleet-jobs':
      headers = [
        'Job Code', 'Fleet Equipment Code', 'Fleet Equipment Name', 'WO Title',
        'Task Type', 'Assigned To', 'Approver', 'Job Priority',
        'Class Related', 'Brief Work Description', 'Department', 'Criticality',
        'Is Active', 'Maintenance Basis', 'Interval Value', 'Unit',
        'Required Spare Parts', 'Required Tools', 'PPE Requirements',
        'Permit Requirements', 'Other Safety Requirements'
      ];

      validValues = [
        'Required (Unique job code)', 'Required (Fleet equipment code)', 'Required (Fleet equipment name)',
        'Required (Work order title)', 'Required (Inspection, Overhaul, Service, Testing, etc.)',
        'Required (Assigned person/rank)', 'Required (Approval authority)', 'Required (Low, Medium, High, Critical)',
        'Required (Yes/No)', 'Required (Work description)', 'Required (Department)', 'Required (Yes/No)',
        'Yes/No (defaults to Yes)', 'Text (Calendar, Running Hours, Condition Based)',
        'Number (Interval value)', 'Text (Days, Weeks, Months, Years)',
        'Text (Spare parts list)', 'Text (Tools list)', 'Text (PPE requirements)',
        'Text (Permit requirements)', 'Text (Other safety requirements)'
      ];

      example = [];
      break;
    case 'fleet-spares':
      headers = [
        'Part Code', 'Fleet Equipment Code', 'Fleet Equipment Name', 'Part Name',
        'Part Number', 'Unit Of Measurement', 'Drawing Number', 'Position Number',
        'Note', 'Specification', 'Maker', 'Maker Code',
        'Manual Name', 'Page Number', 'Criticality', 'Is Active',
        'IHM (Inventory of Hazardous Materials)', 'Evidence Type'
      ];

      validValues = [
        'Required (Unique part code)', 'Required (Fleet equipment code)', 'Required (Fleet equipment name)',
        'Required (Part name)', 'Text (Manufacturer part number)', 'Required (Unit of measurement)',
        'Text (Drawing number)', 'Text (Position number)',
        'Text (Notes)', 'Text (Specification)', 'Text (Maker name)', 'Text (Maker code)',
        'Text (Manual name)', 'Text (Page number)', 'Text (Yes/No)', 'Required (Yes/No, defaults to Yes)',
        'Text (Yes/No)', 'Text (Evidence type)'
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
}

// ── Sheets ──
export async function getSheets(req: Request, res: Response) {
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
}

// ── Dry Run ──
export async function dryRun(req: Request, res: Response) {
  try {
    const { type: requestedType, mode, archiveMissing, vesselId, sheetName } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Determine effective type: use sheet name mapping if available, otherwise use requested type
    const sheetBasedType = sheetName ? getTypeFromSheetName(sheetName) : null;
    const type = sheetBasedType || requestedType;
    
    console.log(`📋 Type determination: requested='${requestedType}', sheetName='${sheetName}', sheetBasedType='${sheetBasedType}', effective='${type}'`);

    if (!['components', 'spares', 'stores', 'work-orders', 'jobs', 'makers', 'fleet-components', 'fleet-jobs', 'fleet-spares'].includes(type)) {
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
      errorReportUrl: results.summary.errors > 0 ? `/technical/api/bulk/history/tmp/${fileToken}/errors.csv` : undefined
    });
  } catch (error) {
    console.error('Dry-run error:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
}

// ── Import ──
export async function doImport(req: Request, res: Response) {
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

    // Use cached type for consistency - this is the effective type determined during dry-run
    // (may differ from request type if sheet name indicated a different data type)
    const effectiveType = cachedData.type || type;
    
    // Log import details for debugging Issue #11
    console.log(`📦 [BULK_IMPORT] Starting import:`);
    console.log(`   RequestType: ${type}`);
    console.log(`   EffectiveType: ${effectiveType}`);
    console.log(`   Mode: ${mode}`);
    console.log(`   VesselId: ${vesselId}`);
    console.log(`   Rows: ${dataToImport.length}`);
    
    // Create initial ImportHistory with status='in_progress'
    // Save to file-based storage for history listing
    await storeImportHistory({
      id: historyId,
      type: effectiveType,
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
    // Note: Change tracking is disabled (pass undefined for historyId) to use file-based storage only
    const importResult = await performImport(
      effectiveType,
      dataToImport,
      mode,
      archiveMissing,
      vesselId,
      (req as any).user?.id || 'system',
      undefined, // Disable database change tracking - using file-based storage only
      storeType  // Pass store type for stores import (determines which tab: Stores, Lubes, Chemicals, Others)
    );

    // Save the uploaded file for later retrieval using Replit Object Storage SDK
    let storedFilePath: string | null = null;
    try {
      const { Client } = await import('@replit/object-storage');
      const client = new Client();
      
      const timestamp = Date.now();
      const safeFileName = cachedData.originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const objectPath = `bulk-imports/${effectiveType}/${timestamp}_${safeFileName}`;
      
      // Upload file using the Replit Object Storage SDK
      await client.uploadFromBytes(objectPath, cachedData.file);
      storedFilePath = `replit:${objectPath}`;
      console.log(`📁 File uploaded to Replit Object Storage: ${objectPath}`);
    } catch (uploadError) {
      console.warn('⚠️ Replit Object Storage failed, falling back to local storage:', (uploadError as Error).message);
      
      // Fallback: Save file locally
      try {
        const uploadsDir = path.join(process.cwd(), 'uploads', 'bulk-imports', effectiveType);
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

    // Update ImportHistory with status='complete' and include file path (file-based storage only)
    await updateFileBasedHistory(historyId, {
      ...importResult,
      completedAt: new Date().toISOString(),
      status: 'complete',
      originalName: cachedData.originalName,
      storedFilePath: storedFilePath
    });

    // Clean up cache
    dryRunCache.delete(fileToken);

    res.json({
      ...importResult,
      historyId
    });
  } catch (error: any) {
    console.error('Import error:', error);
    
    // Update ImportHistory with status='failed' and error message (file-based storage)
    try {
      await updateFileBasedHistory(historyId, {
        completedAt: new Date().toISOString(),
        status: 'failed'
      });
    } catch (updateError) {
      console.error('Failed to update import history:', updateError);
    }
    
    res.status(500).json({ 
      error: 'Failed to import data',
      message: error?.message || 'Unknown error'
    });
  }
}

// ── History ──
export async function getHistoryList(req: Request, res: Response) {
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
}

// ── Download Original ──
export async function downloadOriginal(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    // Get history record from file-based storage
    const history = await getFileBasedHistoryById(id);
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
}

// Download history files (legacy endpoint)

// ── History File ──
export async function getHistoryFileHandler(req: Request, res: Response) {
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
}

// ── Undo ──
export async function undoImport(req: Request, res: Response) {
  const { historyId } = req.params;
  
  try {
    // 1. Fetch and Validate Import History from file-based storage
    const history = await getFileBasedHistoryById(historyId);
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
        currentEntity = await storage.getStoresItem(log.entityId);
      } else if (log.entityType === 'spare') {
        currentEntity = await storage.getSpare(log.entityId);
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
          currentState = await storage.getStoresItem(log.entityId);
        } else if (log.entityType === 'spare') {
          currentState = await storage.getSpare(log.entityId);
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
          const storesItemId = log.entityId;
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
          const spareId = log.entityId;
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
      
      // All changes successful - mark as undone (file-based storage)
      await updateFileBasedHistory(historyId, {
        status: 'undone'
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
              await storage.updateStoresItem(change.log.entityId, change.previousState);
              console.log(`  ↩️ Rolled back stores item ${change.log.entityId}`);
            } else if (change.log.entityType === 'spare') {
              await storage.updateSpare(change.log.entityId, change.previousState);
              console.log(`  ↩️ Rolled back spare ${change.log.entityId}`);
            }
          }
        } catch (rollbackError: any) {
          rollbackErrors.push(`Failed to rollback ${change.log.entityType} ${change.log.entityId}: ${rollbackError.message}`);
          console.error(`  ❌ Rollback failed for ${change.log.entityType} ${change.log.entityId}:`, rollbackError);
        }
      }
      
      // Mark import as undo_failed (file-based storage)
      try {
        await updateFileBasedHistory(historyId, {
          status: 'undo_failed'
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
    
    // Try to mark history as failed (file-based storage)
    try {
      await updateFileBasedHistory(historyId, {
        status: 'undo_failed'
      });
    } catch (updateError) {
      console.error('Failed to update history status:', updateError);
    }
    
    res.status(500).json({ 
      error: 'Failed to undo import',
      details: error.message
    });
  }
}


// ═══════════════════════════════════════════════
// MAKER LIST CRUD
// ═══════════════════════════════════════════════
// MAKER LIST CRUD API ENDPOINTS
// =====================================================

// Export makers to Excel
export async function get_makers_export(req: Request, res: Response) {
  try {
    const makers = await storage.getMakerList();

    const headers = ['Maker Code', 'Maker Name', 'Address', 'Address ID', 'Contact Person', 'Email', 'Phone', 'IS Active'];

    const rows = makers.map((m: any) => [
      m.makerCode || '',
      m.makerName || '',
      m.address || '',
      m.addressId || '',
      m.contactPerson || '',
      m.email || '',
      m.phone || '',
      m.isActive === false ? 'No' : 'Yes',
    ]);

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const colWidths = [18, 40, 35, 15, 25, 30, 20, 10];
    ws['!cols'] = colWidths.map(w => ({ wch: w }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Maker List');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=maker-list-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting makers:', error);
    res.status(500).json({ error: 'Failed to export makers' });
  }
}

// Get all makers
export async function get_makers(req: Request, res: Response) {
  try {
    const makers = await storage.getMakerList();
    res.json(makers);
  } catch (error: any) {
    console.error('Error fetching makers:', error);
    res.status(500).json({ error: 'Failed to fetch makers' });
  }
}

// Get maker by ID
export async function get_makersByid(req: Request, res: Response) {
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
}

// Create maker
export async function post_makers(req: Request, res: Response) {
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
}

// Update maker
export async function patch_makersByid(req: Request, res: Response) {
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
}

// Delete maker (soft delete - sets isActive to false)
export async function delete_makersByid(req: Request, res: Response) {
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
}

// Bulk import makers from Excel
export async function post_makers_import(req: Request, res: Response) {
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
      const addressId = row['Address ID'] || null;
      const contactPerson = row['Contact Person'] || null;
      const email = row['Email'] || null;
      const phone = row['Phone'] || null;
      const isActiveRaw = row['IS Active'];
      const isActive = isActiveRaw === undefined || isActiveRaw === null || isActiveRaw === '' 
        ? true 
        : String(isActiveRaw).toLowerCase() === 'yes' || String(isActiveRaw).toLowerCase() === 'true' || isActiveRaw === true;
      
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
            address: address ? String(address).trim() : null,
            addressId: addressId ? String(addressId).trim() : null,
            contactPerson: contactPerson ? String(contactPerson).trim() : null,
            email: email ? String(email).trim() : null,
            phone: phone ? String(phone).trim() : null,
            isActive
          });
          results.updated++;
        } else {
          await storage.createMakerListItem({
            makerCode: String(makerCode).trim(),
            makerName: String(makerName).trim(),
            address: address ? String(address).trim() : null,
            addressId: addressId ? String(addressId).trim() : null,
            contactPerson: contactPerson ? String(contactPerson).trim() : null,
            email: email ? String(email).trim() : null,
            phone: phone ? String(phone).trim() : null,
            isActive
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
}

// ═══════════════════════════════════════════════
// SFI DETAILS CRUD
// ═══════════════════════════════════════════════
export async function get_sfi_details(req: Request, res: Response) {
  try {
    const sfiDetails = await storage.getSfiDetails();
    res.json(sfiDetails);
  } catch (error: any) {
    console.error('Error fetching SFI details:', error);
    res.status(500).json({ error: 'Failed to fetch SFI details' });
  }
}

// Get SFI detail by ID
export async function get_sfi_detailsByid(req: Request, res: Response) {
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
}

// Create SFI detail
export async function post_sfi_details(req: Request, res: Response) {
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
}

// Update SFI detail
export async function patch_sfi_detailsByid(req: Request, res: Response) {
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
}

// Delete SFI detail (soft delete - sets isActive to false)
export async function delete_sfi_detailsByid(req: Request, res: Response) {
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
}

// Bulk import SFI details from Excel
export async function post_sfi_details_import(req: Request, res: Response) {
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
}

// ═══════════════════════════════════════════════
// LOCATIONS CRUD
// ═══════════════════════════════════════════════
export async function get_locations_template(req: Request, res: Response) {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Locations');
    sheet.columns = [
      { header: 'Location Name', key: 'locationName', width: 30 },
      { header: 'Location Type', key: 'locationType', width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
    sheet.addRow({ locationName: 'Engine Room Store', locationType: 'STORE' });
    sheet.addRow({ locationName: 'Deck Locker', locationType: 'LOCKER' });
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=locations_template.xlsx');
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    console.error('Error generating locations template:', error);
    res.status(500).json({ error: 'Failed to generate locations template' });
  }
}

export async function post_locations_import(req: Request, res: Response) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const vesselId = req.query.vesselId as string;
    if (!vesselId) {
      return res.status(400).json({ error: 'vesselId query parameter is required' });
    }

    const userId = (req as any).user?.username || 'system';

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.find(name =>
      name.toLowerCase().includes('location')
    ) || workbook.SheetNames[0];

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    };

    const seenNames = new Set<string>();

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i];
      const rowNum = i + 2;

      const locationName = row['Location Name'] || row['location_name'] || row['locationName'] || row['location name'] || row['Name'] || row['name'];
      const locationType = row['Location Type'] || row['location_type'] || row['locationType'] || row['location type'] || row['Type'] || row['type'];

      if (!locationName || String(locationName).trim() === '') {
        results.errors.push(`Row ${rowNum}: Location Name is required`);
        results.skipped++;
        continue;
      }

      const trimmedName = String(locationName).trim();
      const normalizedName = trimmedName.toLowerCase();

      if (seenNames.has(normalizedName)) {
        results.errors.push(`Row ${rowNum}: Duplicate location name "${trimmedName}" within file`);
        results.skipped++;
        continue;
      }
      seenNames.add(normalizedName);

      try {
        const existing = await storage.getLocationByName(vesselId, trimmedName);
        const trimmedType = locationType ? String(locationType).trim() : null;

        if (existing) {
          if (trimmedType && trimmedType !== existing.locationType) {
            await storage.updateLocation(existing.id, { locationType: trimmedType });
            results.updated++;
          } else {
            results.skipped++;
          }
        } else {
          await storage.createLocation({
            vesselId,
            locationName: trimmedName,
            locationType: trimmedType,
            createdBy: userId,
          });
          results.created++;
        }
      } catch (error: any) {
        results.errors.push(`Row ${rowNum}: ${error.message}`);
        results.skipped++;
      }
    }

    console.log(`Locations import complete: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`);
    res.json(results);
  } catch (error: any) {
    console.error('Error importing locations:', error);
    res.status(500).json({ error: 'Failed to import locations' });
  }
}

export async function get_locations(req: Request, res: Response) {
  try {
    const vesselId = req.query.vesselId as string;
    if (!vesselId) {
      return res.status(400).json({ error: 'vesselId query parameter is required' });
    }
    const locations = await storage.getLocations(vesselId);
    res.json(locations);
  } catch (error: any) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
}

export async function put_locationsByid(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid location ID' });
    }
    const { locationName, locationType } = req.body;
    const updateData: any = {};
    if (locationName !== undefined) updateData.locationName = String(locationName).trim();
    if (locationType !== undefined) updateData.locationType = locationType ? String(locationType).trim() : null;

    const updated = await storage.updateLocation(id, updateData);
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: error.message || 'Failed to update location' });
  }
}

export async function delete_locationsByid(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid location ID' });
    }
    await storage.deleteLocation(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting location:', error);
    res.status(500).json({ error: error.message || 'Failed to delete location' });
  }
}

