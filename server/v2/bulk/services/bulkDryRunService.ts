import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { setCachedDryRun } from '../cache/dryRunCache';
import type { BulkRepository } from '../repositories/bulkRepository';
import type { DryRunResults, RowValidationResult, DryRunSummary } from './types/strategyTypes';
import { getSFIName } from '../utils/sfiLookup';

const COMPONENT_COLUMN_MAPPINGS: Record<string, string> = {
  'componentcode': 'Component Code',
  'component_code': 'Component Code',
  'component code': 'Component Code',
  'componentname': 'Component Name',
  'component_name': 'Component Name',
  'component name': 'Component Name',
  'category': 'Category',
  'maingroupcode': 'Main Group Code',
  'main_group_code': 'Main Group Code',
  'main group code': 'Main Group Code',
  'fleetequipmentcode': 'Fleet Equipment Code',
  'fleet_equipment_code': 'Fleet Equipment Code',
  'fleet equipment code': 'Fleet Equipment Code',
  'fleetequipmentname': 'Fleet Equipment Name',
  'fleet_equipment_name': 'Fleet Equipment Name',
  'fleet equipment name': 'Fleet Equipment Name',
  'parentcomponentcode': 'Parent Component Code',
  'parent_component_code': 'Parent Component Code',
  'parent component code': 'Parent Component Code',
  'componentcategory': 'Component Category',
  'component_category': 'Component Category',
  'component category': 'Component Category',
  'maker': 'Maker',
  'makercode': 'Maker Code',
  'maker_code': 'Maker Code',
  'maker code': 'Maker Code',
  'model': 'Model',
  'modelcode': 'Model Code',
  'model_code': 'Model Code',
  'model code': 'Model Code',
  'serialno': 'Serial No',
  'serial_no': 'Serial No',
  'serial no': 'Serial No',
  'drawingno': 'Drawing No',
  'drawing_no': 'Drawing No',
  'drawing no': 'Drawing No',
  'location': 'Location',
  'criticality': 'Criticality',
  'critical': 'Criticality',
  'conditionbased': 'Condition Based',
  'condition_based': 'Condition Based',
  'condition based': 'Condition Based',
  'installationdate': 'Installation Date',
  'installation_date': 'Installation Date',
  'installation date': 'Installation Date',
  'commissioneddate': 'Commissioned Date',
  'commissioned_date': 'Commissioned Date',
  'commissioned date': 'Commissioned Date',
  'rating': 'Rating',
  'equipmentsystemdepartment': 'Equipment / System Department',
  'equipment_system_department': 'Equipment / System Department',
  'equipment / system department': 'Equipment / System Department',
  'eqptsystemdept': 'Equipment / System Department',
  'classitem': 'Class item',
  'class_item': 'Class item',
  'class item': 'Class item',
  'isactive': 'IS Active',
  'is_active': 'IS Active',
  'is active': 'IS Active',
  'vesselcode': 'Vessel Code',
  'vessel_code': 'Vessel Code',
  'vessel code': 'Vessel Code',
  'isparent': 'IS Parent',
  'is_parent': 'IS Parent',
  'is parent': 'IS Parent',
  'notes': 'Notes',
  'rhcountertype': 'RH Counter Type',
  'rh_counter_type': 'RH Counter Type',
  'rh counter type': 'RH Counter Type',
  'rhcountersource': 'RH Counter Source',
  'rh_counter_source': 'RH Counter Source',
  'rh counter source': 'RH Counter Source',
  'runninghours': 'Running Hours',
  'running_hours': 'Running Hours',
  'running hours': 'Running Hours',
  'lastupdated': 'Last Updated',
  'last_updated': 'Last Updated',
  'last updated': 'Last Updated',
};

const JOB_COLUMN_MAPPINGS: Record<string, string> = {
  'vesselcode': 'Vessel Code',
  'vessel_code': 'Vessel Code',
  'vessel code': 'Vessel Code',
  'componentcode': 'Component Code',
  'component_code': 'Component Code',
  'component code': 'Component Code',
  'componentname': 'Component Name',
  'component_name': 'Component Name',
  'component name': 'Component Name',
  'jobcode': 'Job Code',
  'job_code': 'Job Code',
  'job code': 'Job Code',
  'wotitle': 'WO Title',
  'wo_title': 'WO Title',
  'wo title': 'WO Title',
  'jobtitle': 'WO Title',
  'job_title': 'WO Title',
  'job title': 'WO Title',
  'fleetequipmentcode': 'Fleet Equipment Code',
  'fleet_equipment_code': 'Fleet Equipment Code',
  'fleet equipment code': 'Fleet Equipment Code',
  'fleetequipmentname': 'Fleet Equipment Name',
  'fleet_equipment_name': 'Fleet Equipment Name',
  'fleet equipment name': 'Fleet Equipment Name',
  'maintenancebasis': 'Maintenance Basis',
  'maintenance_basis': 'Maintenance Basis',
  'maintenance basis': 'Maintenance Basis',
  'intervalvalue': 'Interval Value',
  'interval_value': 'Interval Value',
  'interval value': 'Interval Value',
  'unit': 'Unit',
  'frequencyunit': 'Unit',
  'frequency_unit': 'Unit',
  'frequency unit': 'Unit',
  'intervalrunninghours': 'Interval Running Hours',
  'interval_running_hours': 'Interval Running Hours',
  'interval running hours': 'Interval Running Hours',
  'lastdonedate': 'Last Done Date',
  'last_done_date': 'Last Done Date',
  'last done date': 'Last Done Date',
  'lastdonerh': 'Last Done RH',
  'last_done_rh': 'Last Done RH',
  'last done rh': 'Last Done RH',
  'jobpriority': 'Job Priority',
  'job_priority': 'Job Priority',
  'job priority': 'Job Priority',
  'classrelated': 'Class Related',
  'class_related': 'Class Related',
  'class related': 'Class Related',
  'briefworkdescription': 'Brief Work Description',
  'brief_work_description': 'Brief Work Description',
  'brief work description': 'Brief Work Description',
  'jobdescription': 'Job Description',
  'job_description': 'Job Description',
  'job description': 'Job Description',
  'spareparts': 'Spare Parts',
  'spare_parts': 'Spare Parts',
  'spare parts': 'Spare Parts',
  'requiredtools': 'Required Tools',
  'required_tools': 'Required Tools',
  'required tools': 'Required Tools',
  'safetyrequirements': 'Safety Requirements',
  'safety_requirements': 'Safety Requirements',
  'safety requirements': 'Safety Requirements',
  'safetypermit': 'Safety Permit',
  'safety_permit': 'Safety Permit',
  'safety permit': 'Safety Permit',
  'safetypermit_required': 'Safety Permit',
  'safety_permit_required': 'Safety Permit',
  'department': 'Department',
  'assignedto': 'Assigned To',
  'assigned_to': 'Assigned To',
  'assigned to': 'Assigned To',
  'estimatedmanhours': 'Estimated Man Hours',
  'estimated_man_hours': 'Estimated Man Hours',
  'estimated man hours': 'Estimated Man Hours',
  'criticality': 'Criticality',
};

const SPARE_COLUMN_MAPPINGS: Record<string, string> = {
  'componentcode': 'Component Code',
  'component_code': 'Component Code',
  'component code': 'Component Code',
  'componentname': 'Component Name',
  'component_name': 'Component Name',
  'component name': 'Component Name',
  'partcode': 'Part Code',
  'part_code': 'Part Code',
  'part code': 'Part Code',
  'partname': 'Part Name',
  'part_name': 'Part Name',
  'part name': 'Part Name',
  'partnumber': 'Part Number',
  'part_number': 'Part Number',
  'part number': 'Part Number',
  'uom': 'UOM',
  'unitofmeasurement': 'UOM',
  'unit_of_measurement': 'UOM',
  'unit of measurement': 'UOM',
  'maker': 'Maker',
  'makername': 'Maker',
  'maker_name': 'Maker',
  'maker name': 'Maker',
  'makercode': 'Maker Code',
  'maker_code': 'Maker Code',
  'maker code': 'Maker Code',
  'specification': 'Specification',
  'drawingnumber': 'Drawing Number',
  'drawing_number': 'Drawing Number',
  'drawing number': 'Drawing Number',
  'drawingno': 'Drawing Number',
  'drawing_no': 'Drawing Number',
  'drawing no': 'Drawing Number',
  'positionnumber': 'Position Number',
  'position_number': 'Position Number',
  'position number': 'Position Number',
  'locationa': 'Location A',
  'location_a': 'Location A',
  'location a': 'Location A',
  'locationb': 'Location B',
  'location_b': 'Location B',
  'location b': 'Location B',
  'locationarob': 'Location A - ROB',
  'location_a_rob': 'Location A - ROB',
  'location a - rob': 'Location A - ROB',
  'locationbrob': 'Location B - ROB',
  'location_b_rob': 'Location B - ROB',
  'location b - rob': 'Location B - ROB',
  'totalrob': 'Total ROB',
  'total_rob': 'Total ROB',
  'total rob': 'Total ROB',
  'minimumstock': 'Minimum Stock',
  'minimum_stock': 'Minimum Stock',
  'minimum stock': 'Minimum Stock',
  'min': 'Minimum Stock',
  'criticality': 'Criticality',
  'critical': 'Criticality',
  'criticalyes/no': 'Criticality',
  'critical yes/no': 'Criticality',
  'criticality (yes/no)': 'Criticality',
  'isactive': 'Is Active',
  'is_active': 'Is Active',
  'is active': 'Is Active',
  'ihm': 'IHM (Inventory of Hazardous Materials)',
  'ihm(inventoryofhazardousmaterials)': 'IHM (Inventory of Hazardous Materials)',
  'ihm (inventory of hazardous materials)': 'IHM (Inventory of Hazardous Materials)',
  'note': 'Note',
  'manualname': 'Manual Name',
  'manual_name': 'Manual Name',
  'manual name': 'Manual Name',
  'pagenumber': 'Page Number',
  'page_number': 'Page Number',
  'page number': 'Page Number',
  'evidencetype': 'Evidence Type',
  'evidence_type': 'Evidence Type',
  'evidence type': 'Evidence Type',
  'remarks': 'Remarks',
  'fleetequipmentcode': 'Fleet Equipment Code',
  'fleet_equipment_code': 'Fleet Equipment Code',
  'fleet equipment code': 'Fleet Equipment Code',
  'vesselcode': 'Vessel Code',
  'vessel_code': 'Vessel Code',
  'vessel code': 'Vessel Code',
};

const COMPONENT_CATEGORY_MAP: Record<string, string> = {
  '1': '1 Ship General',
  '2': '2 Hull',
  '3': '3 Cargo Equipment',
  '4': '4 Ship Equipment',
  '5': '5 Equipment for Crew and Passengers',
  '6': '6 Machinery Main Components',
  '7': '7 Systems for Machinery Main Components',
  '8': '8 Ship Common Systems',
};

const SUB_GROUP_NAMES: Record<string, string> = {
  '10': 'SHIP GENERAL',
  '11': 'SHIP IDENTIFICATION',
  '12': 'SHIP DATA',
  '13': 'SHIP DESIGN AND CLASSIFICATION',
  '14': 'SURVEYS',
  '21': 'HULL STRUCTURE',
  '30': 'CARGO EQUIPMENT',
  '31': 'CARGO HANDLING',
  '40': 'SHIP EQUIPMENT',
  '41': 'NAVIGATION AND BRIDGE',
  '42': 'COMMUNICATION',
  '43': 'ANCHORING AND MOORING',
  '44': 'LIFTING AND DECK',
  '50': 'ACCOMMODATION',
  '51': 'SAFETY AND FIRE FIGHTING',
  '52': 'LIFE SAVING',
  '60': 'MAIN ENGINE',
  '61': 'PROPULSION',
  '62': 'AUXILIARY ENGINES',
  '63': 'BOILERS',
  '64': 'OTHER MACHINERY',
  '70': 'FUEL OIL SYSTEMS',
  '71': 'LUBE OIL SYSTEMS',
  '72': 'COOLING WATER SYSTEMS',
  '73': 'COMPRESSED AIR SYSTEMS',
  '74': 'EXHAUST GAS SYSTEMS',
  '75': 'STEAM SYSTEMS',
  '76': 'ELECTRICAL SYSTEMS',
  '80': 'BALLAST AND BILGE',
  '81': 'FRESH WATER SYSTEMS',
  '82': 'FIRE FIGHTING AND SAFETY',
  '83': 'VENTILATION AND AIR CONDITIONING',
  '84': 'SEWAGE AND WASTE',
  '85': 'HYDRAULIC SYSTEMS',
};

export function stripSFISuffix(code: string): string {
  return code.replace(/\s*\(\d+\)\s*$/, '').trim();
}

export function validateSFICode(code: string): boolean {
  const stripped = stripSFISuffix(code);
  return /^\d{1,3}(\.\d{1,3})*$/.test(stripped);
}

export function getParentSFICode(code: string): string | null {
  const stripped = stripSFISuffix(code);
  const dotIndex = stripped.lastIndexOf('.');
  if (dotIndex > 0) {
    return stripped.substring(0, dotIndex);
  }
  if (stripped.length > 1) {
    return stripped.substring(0, stripped.length - 1);
  }
  return null;
}

export function getComponentCategory(digit: string): string {
  return COMPONENT_CATEGORY_MAP[digit] || '';
}

export function getSubGroupName(code: string): string {
  const twoDigit = code.substring(0, 2);
  return SUB_GROUP_NAMES[twoDigit] || '';
}

function getExplicitParentFromRow(row: Record<string, any>): string | null {
  const parentKeys = [
    'Parent Component Code',
    'parent component code',
    'Parent_Component_Code',
    'parentcomponentcode',
    'ParentComponentCode',
    'parent_component_code',
    'Main Group Code',
    'main group code',
    'Main_Group_Code',
    'maingroupcode',
    'MainGroupCode',
    'main_group_code',
  ];
  for (const key of parentKeys) {
    const val = row[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return null;
}

function isInstructionRow(row: Record<string, any>): boolean {
  const values = Object.values(row).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
  if (values.length === 0) return true;
  const firstVal = String(values[0]).toLowerCase();
  if (firstVal.startsWith('instruction') || firstVal.startsWith('description') || firstVal.startsWith('valid values')) return true;
  if (firstVal === 'yes / no' || firstVal === 'dd-mmm-yyyy') return true;
  return false;
}

function getColumnMappingsForType(type: string): Record<string, string> {
  switch (type) {
    case 'jobs': return JOB_COLUMN_MAPPINGS;
    case 'spares': return SPARE_COLUMN_MAPPINGS;
    default: return COMPONENT_COLUMN_MAPPINGS;
  }
}

function normalizeColumnName(col: string, type: string = 'components'): string {
  const lower = col.toLowerCase().trim();
  const mappings = getColumnMappingsForType(type);
  return mappings[lower] || col;
}

function parseYesNo(value: any): { valid: boolean; result: boolean | null; error?: string } {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { valid: true, result: null };
  }
  const str = String(value).trim().toLowerCase();
  if (str === 'yes' || str === 'y' || str === 'true' || str === '1') {
    return { valid: true, result: true };
  }
  if (str === 'no' || str === 'n' || str === 'false' || str === '0') {
    return { valid: true, result: false };
  }
  return { valid: false, result: null, error: `Invalid Yes/No value: "${value}"` };
}

function parseRunningHours(value: any): { valid: boolean; result: number | null; error?: string } {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { valid: true, result: null };
  }
  const num = Number(value);
  if (isNaN(num)) {
    return { valid: false, result: null, error: `Invalid running hours: "${value}" is not a number` };
  }
  if (num < 0) {
    return { valid: false, result: null, error: `Running hours cannot be negative: ${num}` };
  }
  return { valid: true, result: num };
}

export class BulkDryRunService {
  constructor(private repository: BulkRepository) {}

  async dryRun(
    file: { buffer: Buffer; originalname: string },
    type: string,
    mode: string,
    vesselId: string | undefined,
    sheetName?: string
  ): Promise<{ fileToken: string; results: DryRunResults }> {
    const rawData = this.parseFile(file, sheetName);

    if (rawData.length === 0) {
      return {
        fileToken: uuidv4(),
        results: {
          columns: [],
          summary: { ok: 0, warnings: 0, errors: 0, total: 0 },
          rows: [],
        },
      };
    }

    const allColumns = Object.keys(rawData[0]);
    const normalizedColumns = allColumns.map(c => normalizeColumnName(c, type));

    const normalizedData = rawData.map(row => {
      const normalized: Record<string, any> = {};
      for (const [key, value] of Object.entries(row)) {
        const normalizedKey = normalizeColumnName(key, type);
        normalized[normalizedKey] = value;
      }
      return normalized;
    });

    const filteredData = normalizedData.filter(row => !isInstructionRow(row));

    let rows: RowValidationResult[];
    if (type === 'jobs') {
      rows = await this.validateJobRows(filteredData, mode, vesselId);
    } else if (type === 'spares') {
      rows = await this.validateSpareRows(filteredData, mode, vesselId);
    } else {
      rows = await this.validateComponentRows(filteredData, mode, vesselId);
    }

    const summary: DryRunSummary = {
      ok: rows.filter(r => r.status === 'ok').length,
      warnings: rows.filter(r => r.status === 'warning').length,
      errors: rows.filter(r => r.status === 'error').length,
      total: rows.length,
    };

    const results: DryRunResults = {
      columns: normalizedColumns,
      summary,
      rows,
    };

    const fileToken = uuidv4();

    setCachedDryRun(fileToken, {
      data: filteredData,
      normalizedData: rows.map(r => r.normalized),
      results,
      type,
      file: file.buffer,
      originalName: file.originalname,
      createdAt: Date.now(),
    });

    return { fileToken, results };
  }

  private async validateComponentRows(
    filteredData: Record<string, any>[],
    mode: string,
    vesselId: string | undefined
  ): Promise<RowValidationResult[]> {
    const codeCounts = new Map<string, number>();
    for (const row of filteredData) {
      const code = String(row['Component Code'] || '').trim().toLowerCase();
      if (code) {
        codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
      }
    }

    let existingMap = new Map<string, any>();
    if (vesselId && (mode === 'add' || mode === 'upsert')) {
      const codes = filteredData
        .map(r => String(r['Component Code'] || '').trim())
        .filter(c => c);
      if (codes.length > 0) {
        existingMap = await this.repository.getComponentsByCodes(codes, vesselId);
      }
    }

    const rows: RowValidationResult[] = [];

    for (let i = 0; i < filteredData.length; i++) {
      const row = filteredData[i];
      const rowNum = i + 2;
      const errors: string[] = [];
      const warnings: string[] = [];
      const normalized: Record<string, any> = {};

      const rawCode = String(row['Component Code'] || '').trim();
      if (!rawCode) {
        errors.push('Component Code is required');
      } else {
        const strippedCode = stripSFISuffix(rawCode);
        if (!validateSFICode(strippedCode)) {
          errors.push(`Invalid SFI code format: "${rawCode}". Expected format like 7, 71, 711, 711.001`);
        } else {
          normalized['Component Code'] = strippedCode;

          const lowerCode = strippedCode.toLowerCase();
          if ((codeCounts.get(lowerCode) || 0) > 1) {
            warnings.push(`Duplicate Component Code "${strippedCode}" found in file`);
          }

          if (mode === 'add' && existingMap.has(strippedCode)) {
            errors.push(`Component Code "${strippedCode}" already exists in the database`);
          }

          const explicitParent = getExplicitParentFromRow(row);
          if (explicitParent) {
            normalized['Parent Component Code'] = explicitParent;
            normalized['__meta'] = { explicitParent: true, parentCode: explicitParent };
          } else {
            const autoParent = getParentSFICode(strippedCode);
            if (autoParent) {
              normalized['Parent Component Code'] = autoParent;
              normalized['__meta'] = { explicitParent: false, parentCode: autoParent };
            }
          }

          const firstDigit = strippedCode.charAt(0);
          const autoCategory = getComponentCategory(firstDigit);
          const providedCategory = String(row['Component Category'] || '').trim();
          normalized['Component Category'] = providedCategory || autoCategory;

          if (!String(row['Component Name'] || '').trim()) {
            if (strippedCode.length === 1) {
              const catName = getComponentCategory(strippedCode);
              if (catName) {
                normalized['Component Name'] = catName;
                warnings.push(`Auto-generated Component Name from category: "${catName}"`);
              }
            } else if (strippedCode.length === 2) {
              const subName = getSubGroupName(strippedCode);
              const sfiName = getSFIName(strippedCode);
              const autoName = sfiName || subName;
              if (autoName) {
                normalized['Component Name'] = autoName;
                warnings.push(`Auto-generated Component Name from SFI: "${autoName}"`);
              }
            }
          } else {
            normalized['Component Name'] = String(row['Component Name']).trim();
          }
        }
      }

      const critResult = parseYesNo(row['Criticality']);
      if (!critResult.valid) {
        errors.push(critResult.error!);
      } else if (critResult.result !== null) {
        normalized['Criticality'] = critResult.result;
      }

      const cbResult = parseYesNo(row['Condition Based']);
      if (!cbResult.valid) {
        errors.push(cbResult.error!);
      } else if (cbResult.result !== null) {
        normalized['Condition Based'] = cbResult.result;
      }

      const activeResult = parseYesNo(row['IS Active']);
      if (!activeResult.valid) {
        errors.push(activeResult.error!);
      } else if (activeResult.result !== null) {
        normalized['IS Active'] = activeResult.result;
      }

      const classResult = parseYesNo(row['Class item']);
      if (!classResult.valid) {
        errors.push(classResult.error!);
      } else if (classResult.result !== null) {
        normalized['Class item'] = classResult.result;
      }

      const parentResult = parseYesNo(row['IS Parent']);
      if (!parentResult.valid) {
        errors.push(parentResult.error!);
      } else if (parentResult.result !== null) {
        normalized['IS Parent'] = parentResult.result;
      }

      const rhResult = parseRunningHours(row['Running Hours']);
      if (!rhResult.valid) {
        errors.push(rhResult.error!);
      } else if (rhResult.result !== null) {
        normalized['Running Hours'] = rhResult.result;
      }

      const textFields = [
        'Fleet Equipment Code', 'Fleet Equipment Name', 'Maker', 'Maker Code',
        'Model', 'Model Code', 'Serial No', 'Drawing No', 'Location',
        'Installation Date', 'Commissioned Date', 'Rating',
        'Equipment / System Department', 'Vessel Code', 'Notes',
        'RH Counter Type', 'RH Counter Source', 'Last Updated',
      ];
      for (const field of textFields) {
        const val = row[field];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          normalized[field] = String(val).trim();
        }
      }

      const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok';

      rows.push({
        row: rowNum,
        status,
        errors,
        warnings,
        normalized,
        original: row,
      });
    }

    return rows;
  }

  private async validateJobRows(
    filteredData: Record<string, any>[],
    mode: string,
    vesselId: string | undefined
  ): Promise<RowValidationResult[]> {
    const rows: RowValidationResult[] = [];

    for (let i = 0; i < filteredData.length; i++) {
      const row = filteredData[i];
      const rowNum = i + 2;
      const errors: string[] = [];
      const warnings: string[] = [];
      const normalized: Record<string, any> = {};

      const woTitle = String(row['WO Title'] || '').trim();
      if (!woTitle) {
        continue;
      }
      normalized['WO Title'] = woTitle;

      if (!row['Vessel Code'] && vesselId) {
        normalized['Vessel Code'] = vesselId;
      } else if (row['Vessel Code']) {
        normalized['Vessel Code'] = String(row['Vessel Code']).trim();
      }

      const componentCode = String(row['Component Code'] || '').trim();
      if (!componentCode) {
        errors.push(`Row ${rowNum}: Component Code is required`);
      } else {
        normalized['Component Code'] = componentCode;
      }

      if (row['Component Name']) {
        normalized['Component Name'] = String(row['Component Name']).trim();
      }

      if (row['Job Code']) {
        normalized['Job Code'] = String(row['Job Code']).trim();
      }

      if (row['Fleet Equipment Code']) {
        normalized['Fleet Equipment Code'] = String(row['Fleet Equipment Code']).trim();
      }
      if (row['Fleet Equipment Name']) {
        normalized['Fleet Equipment Name'] = String(row['Fleet Equipment Name']).trim();
      }

      const validMaintenanceBasis = ['Calendar', 'Running Hours'];
      if (!row['Maintenance Basis']) {
        errors.push(`Row ${rowNum}: Maintenance Basis is required (must be 'Calendar' or 'Running Hours')`);
      } else if (!validMaintenanceBasis.includes(row['Maintenance Basis'])) {
        errors.push(`Row ${rowNum}: Invalid Maintenance Basis '${row['Maintenance Basis']}'. Must be 'Calendar' or 'Running Hours'`);
      } else {
        normalized['Maintenance Basis'] = row['Maintenance Basis'];
      }

      if (!row['Interval Value']) {
        errors.push(`Row ${rowNum}: Interval Value is required`);
      } else {
        const interval = parseFloat(row['Interval Value']);
        if (isNaN(interval) || interval <= 0) {
          errors.push(`Row ${rowNum}: Interval Value must be a positive number (got: '${row['Interval Value']}')`);
        } else {
          normalized['Interval Value'] = String(interval);
        }
      }

      if (row['Unit']) {
        normalized['Unit'] = String(row['Unit']).trim();
      }

      if (row['Interval Running Hours']) {
        const irh = parseFloat(row['Interval Running Hours']);
        if (isNaN(irh) || irh <= 0) {
          warnings.push(`Row ${rowNum}: Interval Running Hours should be a positive number`);
        } else {
          normalized['Interval Running Hours'] = String(irh);
        }
      }

      const textFields = [
        'Last Done Date', 'Last Done RH', 'Job Priority', 'Class Related',
        'Brief Work Description', 'Job Description', 'Spare Parts',
        'Required Tools', 'Safety Requirements', 'Safety Permit',
        'Department', 'Assigned To', 'Estimated Man Hours', 'Criticality',
      ];
      for (const field of textFields) {
        const val = row[field];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          normalized[field] = String(val).trim();
        }
      }

      const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok';

      rows.push({
        row: rowNum,
        status,
        errors,
        warnings,
        normalized,
        original: row,
      });
    }

    return rows;
  }

  private async validateSpareRows(
    filteredData: Record<string, any>[],
    mode: string,
    vesselId: string | undefined
  ): Promise<RowValidationResult[]> {
    const rows: RowValidationResult[] = [];

    for (let i = 0; i < filteredData.length; i++) {
      const row = filteredData[i];
      const rowNum = i + 2;
      const errors: string[] = [];
      const warnings: string[] = [];
      const normalized: Record<string, any> = {};

      if (vesselId && row['Vessel Code']) {
        const rowVesselCode = String(row['Vessel Code']).trim().toUpperCase();
        const selectedVessel = vesselId.trim().toUpperCase();
        if (rowVesselCode !== selectedVessel) {
          errors.push(`Row ${rowNum}: Vessel Code '${rowVesselCode}' does not match selected vessel '${vesselId}'`);
        } else {
          normalized['Vessel Code'] = rowVesselCode;
        }
      } else if (vesselId && !row['Vessel Code']) {
        normalized['Vessel Code'] = vesselId;
      }

      const componentCode = String(row['Component Code'] || '').trim();
      if (!componentCode) {
        errors.push(`Row ${rowNum}: Component Code is required`);
      } else {
        normalized['Component Code'] = componentCode;
      }

      if (row['Component Name']) {
        normalized['Component Name'] = String(row['Component Name']).trim();
      }

      if (row['Part Code'] && String(row['Part Code']).trim()) {
        normalized['Part Code'] = String(row['Part Code']).trim();
      }

      if (!row['Part Name'] || !String(row['Part Name']).trim()) {
        errors.push(`Row ${rowNum}: Part Name is required`);
      } else {
        normalized['Part Name'] = String(row['Part Name']).trim();
      }

      if (row['Part Number']) {
        normalized['Part Number'] = String(row['Part Number']).trim();
      }

      if (row['UOM']) {
        normalized['UOM'] = String(row['UOM']).trim().toUpperCase();
      }

      const critResult = parseYesNo(row['Criticality']);
      if (!critResult.valid) {
        errors.push(`Row ${rowNum}: ${critResult.error}`);
      } else if (critResult.result !== null) {
        normalized['Criticality'] = critResult.result ? 'Yes' : 'No';
      }

      const activeResult = parseYesNo(row['Is Active']);
      if (!activeResult.valid) {
        errors.push(`Row ${rowNum}: ${activeResult.error}`);
      } else if (activeResult.result !== null) {
        normalized['Is Active'] = activeResult.result;
      }

      const ihmResult = parseYesNo(row['IHM (Inventory of Hazardous Materials)']);
      if (!ihmResult.valid) {
        warnings.push(`Row ${rowNum}: ${ihmResult.error}`);
      } else if (ihmResult.result !== null) {
        normalized['IHM (Inventory of Hazardous Materials)'] = ihmResult.result ? 'Yes' : 'No';
      }

      const numericFields = ['Location A - ROB', 'Location B - ROB', 'Total ROB', 'Minimum Stock'];
      for (const field of numericFields) {
        const val = row[field];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const num = parseInt(String(val));
          if (isNaN(num)) {
            warnings.push(`Row ${rowNum}: ${field} should be a number (got: '${val}')`);
          } else {
            normalized[field] = num;
          }
        }
      }

      const textFields = [
        'Maker', 'Maker Code', 'Specification', 'Drawing Number',
        'Position Number', 'Location A', 'Location B', 'Note',
        'Manual Name', 'Page Number', 'Evidence Type', 'Fleet Equipment Code', 'Remarks',
      ];
      for (const field of textFields) {
        const val = row[field];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          normalized[field] = String(val).trim();
        }
      }

      const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok';

      rows.push({
        row: rowNum,
        status,
        errors,
        warnings,
        normalized,
        original: row,
      });
    }

    return rows;
  }

  private parseFile(file: { buffer: Buffer; originalname: string }, sheetName?: string): Record<string, any>[] {
    const ext = file.originalname.toLowerCase();

    if (ext.endsWith('.csv')) {
      const content = file.buffer.toString('utf-8');
      const parsed = Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      });
      return parsed.data as Record<string, any>[];
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
    const targetSheet = sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[targetSheet];
    if (!worksheet) return [];

    return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  }
}
