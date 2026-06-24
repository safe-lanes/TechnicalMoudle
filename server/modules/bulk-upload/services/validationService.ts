import { storage } from '../../../storage';
import { getSFIName } from '../../../utils/sfiLookup';
import {
  normalizeColumnNames,
  getComponentCategory,
  getEffectiveComponentCategories,
  getSubGroupCode,
  stripSFISuffix,
  getParentSFICode,
  validateSFICode,
  getExplicitParentFromRow,
  getExplicitParentFromRowEarly,
  UOM_LIST,
  STORES_CATEGORIES,
  DEPARTMENTS,
  RESPONSIBLE_RANKS,
  JOB_ASSIGNED_TO_RANKS,
  SCHEDULE_TYPES,
  INTERVAL_UNITS
} from './helpers';
import { calculateNextDueDate, normalizeDateToDDMMMYYYY } from '@shared/dateUtils';
import { getAllRanks } from '../../ranks/service';

/**
 * Validate a row's Maker Code / Maker Name reference against the Maker List master.
 * The Maker Code is the primary reference; the Maker Name is cross-verified against it.
 * Both fields are trimmed; the name comparison is case-insensitive. Returns a list of
 * blocking validation errors (empty when the reference is valid or both fields are blank).
 *
 * Rules (Task #295):
 *  - Maker Code present but not in the Maker List -> error.
 *  - Maker Code present and found, but Maker Name does not match the master name for
 *    that code -> error.
 *  - Maker Name present without a (valid) Maker Code -> error.
 *  - No silent back-fill of the Maker Code from a Maker-Name match.
 */
function validateMakerReference(
  rowMakerCode: string | null | undefined,
  rowMakerName: string | null | undefined,
  existingMakersByCode: Map<string, any>,
  rowNum: number,
): string[] {
  const errs: string[] = [];
  const trimmedCode = rowMakerCode != null ? String(rowMakerCode).trim() : '';
  const trimmedName = rowMakerName != null ? String(rowMakerName).trim() : '';

  if (trimmedCode) {
    const master = existingMakersByCode.get(trimmedCode.toLowerCase());
    if (!master) {
      errs.push(`Row ${rowNum}: Maker Code '${trimmedCode}' not found in Maker List. Please import makers first.`);
    } else if (trimmedName && String(master.makerName ?? '').trim().toLowerCase() !== trimmedName.toLowerCase()) {
      errs.push(`Row ${rowNum}: Maker Name '${trimmedName}' does not match the Maker List entry for Maker Code '${trimmedCode}' (expected '${master.makerName}').`);
    }
  } else if (trimmedName) {
    errs.push(`Row ${rowNum}: Maker Name '${trimmedName}' was provided without a valid Maker Code. Please specify a Maker Code that exists in the Maker List.`);
  }

  return errs;
}

/**
 * Accepted synonym set for Yes/No reference fields. Kept intentionally lenient
 * (Yes/No/Y/N/True/False/1/0, case-insensitive) so existing import templates keep
 * working; values outside this set (and outside blank) are rejected.
 */
const YES_NO_SYNONYMS = ['yes', 'no', 'y', 'n', 'true', 'false', '1', '0'];

/**
 * Validate/normalize a Yes/No reference field for the bulk-import dry run.
 *  - Blank is allowed unless `required` is set (then it is an error).
 *  - Accepted synonyms normalize to the canonical 'Yes' / 'No'.
 *  - Anything else is a blocking error.
 */
function validateYesNoField(
  rawValue: any,
  fieldLabel: string,
  rowNum: number,
  opts: { required?: boolean } = {},
): { error?: string; normalized?: 'Yes' | 'No' } {
  const isBlank = rawValue === undefined || rawValue === null || String(rawValue).trim() === '';
  if (isBlank) {
    if (opts.required) {
      return { error: `Row ${rowNum}: ${fieldLabel} is required` };
    }
    return {};
  }
  const value = String(rawValue).toLowerCase().trim();
  if (!YES_NO_SYNONYMS.includes(value)) {
    return { error: `Row ${rowNum}: ${fieldLabel} must be Yes or No` };
  }
  return { normalized: ['yes', 'y', 'true', '1'].includes(value) ? 'Yes' : 'No' };
}

/**
 * Validate a strict DD-MM-YYYY calendar date for the bulk-import dry run.
 *  - Blank is allowed (returns nothing).
 *  - Must match DD-MM-YYYY exactly (no letters, no symbols, no Excel serials).
 *  - Must be a real calendar date (rejects e.g. 31-02-2025).
 *  - On success returns the trimmed value unchanged.
 */
function validateDateDDMMYYYY(
  rawValue: any,
  fieldLabel: string,
  rowNum: number,
): { error?: string; normalized?: string } {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
    return {};
  }
  const value = String(rawValue).trim();
  const match = value.match(/^([0-9]{2})-([0-9]{2})-([0-9]{4})$/);
  if (!match) {
    return { error: `Row ${rowNum}: ${fieldLabel} must be a valid date in DD-MM-YYYY format` };
  }
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return { error: `Row ${rowNum}: ${fieldLabel} must be a valid date in DD-MM-YYYY format` };
  }
  return { normalized: value };
}

export async function validateData(type: string, data: any[], mode: string, vesselId?: string) {
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
      case 'wo-history':
        primaryField = 'WO Number';
        break;
      case 'makers':
        primaryField = 'Maker Code';
        break;
      case 'fleet-components':
        primaryField = 'Fleet Equipment Code';
        break;
      case 'fleet-jobs':
        primaryField = 'Job Code';
        break;
      case 'fleet-spares':
        primaryField = 'Part Code';
        break;
      case 'spare-history':
        primaryField = 'Part Code';
        break;
      case 'store-history':
        primaryField = 'Item Code';
        break;
      default:
        primaryField = 'Component Code';
    }
    
    const fieldValue = row[primaryField];

    // For spare-history: a row that is missing Part Code but has other data (e.g. Event Type,
    // Quantity, Date) must pass through so the per-row validator can emit a "Part Code is required"
    // error. Only truly empty rows (no data in any relevant field) should be silently dropped.
    if (type === 'spare-history') {
      const spareHistoryDataFields = ['Event Type', 'Quantity', 'ROB After', 'Date', 'Performed By', 'Remarks', 'Reference', 'Port/Place'];
      const hasOtherData = spareHistoryDataFields.some(f => {
        const v = row[f];
        return v !== undefined && v !== null && String(v).trim() !== '';
      });
      const partCodePresent = fieldValue && String(fieldValue).trim() !== '';
      if (!partCodePresent && !hasOtherData) {
        return false;
      }
      return true;
    }

    if (type === 'store-history') {
      const storeHistoryDataFields = ['Event Type', 'Quantity', 'ROB After', 'Date', 'Performed By', 'Remarks', 'Reference', 'Port/Place'];
      const hasOtherData = storeHistoryDataFields.some(f => {
        const v = row[f];
        return v !== undefined && v !== null && String(v).trim() !== '';
      });
      const itemCodePresent = fieldValue && String(fieldValue).trim() !== '';
      if (!itemCodePresent && !hasOtherData) {
        return false;
      }
      return true;
    }

    // For jobs: Job Code is OPTIONAL (auto-generated on import), so it cannot be the
    // gate for which rows are "real". Keep any row that has meaningful job data so the
    // per-row validator can run — most importantly so a row with data but a blank
    // WO Title surfaces the "WO Title is mandatory." error instead of being silently
    // dropped. Only genuinely empty rows (no data in any relevant field) are skipped.
    if (type === 'jobs') {
      const jobsDataFields = ['WO Title', 'Component Code', 'Job Code', 'Maintenance Basis', 'Interval Value', 'Task Type', 'Assigned To'];
      const hasJobData = jobsDataFields.some(f => {
        const v = row[f];
        return v !== undefined && v !== null && String(v).trim() !== '';
      });
      return hasJobData;
    }

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

  // Track duplicate Component Codes (case-insensitive, per vessel)
  // Also fetch existing component codes from database for validation
  const componentCodeOccurrences = new Map<string, number[]>(); // Key: uppercase code, Value: row numbers
  const existingDbComponentCodes = new Set<string>(); // Uppercase codes from database

  // Track duplicate Component Names (case-insensitive, trimmed, per vessel)
  // Also fetch existing component names from database for validation
  const componentNameOccurrences = new Map<string, number[]>(); // Key: uppercase trimmed name, Value: row numbers
  // Key: uppercase trimmed name, Value: set of uppercase Component Codes already using that name in the vessel.
  // The code set lets update/upsert rows keep their own existing name while still rejecting a name owned by a different component.
  const existingDbComponentNames = new Map<string, Set<string>>();
  
  // Track duplicate Fleet Equipment Codes (case-insensitive)
  // Also fetch existing fleet equipment codes from database for validation
  const fleetEquipmentCodeOccurrences = new Map<string, number[]>(); // Key: uppercase code, Value: row numbers
  const existingDbFleetEquipmentCodes = new Set<string>(); // Uppercase codes from database
  
  if (type === 'fleet-components') {
    // Fetch existing fleet equipment codes from the database
    try {
      const existingFleetComponents = await storage.getFleetComponents();
      existingFleetComponents.forEach(fc => {
        if (fc.fleetEquipmentCode) {
          existingDbFleetEquipmentCodes.add(fc.fleetEquipmentCode.toUpperCase());
        }
      });
      console.log(`📋 Loaded ${existingDbFleetEquipmentCodes.size} existing fleet equipment codes from database`);
    } catch (err) {
      console.error(`Failed to fetch existing fleet components:`, err);
    }
    
    // Track occurrences within the uploaded file (case-insensitive)
    filteredData.forEach((row, index) => {
      const fleetEquipmentCode = row['Fleet Equipment Code'];
      if (fleetEquipmentCode) {
        const code = String(fleetEquipmentCode).trim().toUpperCase(); // Case-insensitive
        if (!fleetEquipmentCodeOccurrences.has(code)) {
          fleetEquipmentCodeOccurrences.set(code, []);
        }
        fleetEquipmentCodeOccurrences.get(code)!.push(index + 2); // Row number (Excel is 1-indexed + header)
      }
    });
  }
  
  // Track duplicate Fleet Jobs by composite key (Job Code + Fleet Equipment Code) - case-insensitive
  // The same Job Code can legitimately appear under different Fleet Equipment Codes
  const fleetJobCompositeOccurrences = new Map<string, number[]>();
  const existingDbFleetJobCompositeKeys = new Set<string>();
  
  if (type === 'fleet-jobs') {
    try {
      const existingFleetJobs = await storage.getFleetJobs();
      existingFleetJobs.forEach((fj: any) => {
        if (fj.jobCode && fj.fleetEquipmentCode) {
          const compositeKey = `${fj.jobCode.toUpperCase()}|${fj.fleetEquipmentCode.toUpperCase()}`;
          existingDbFleetJobCompositeKeys.add(compositeKey);
        }
      });
      console.log(`📋 Loaded ${existingDbFleetJobCompositeKeys.size} existing fleet job composite keys from database`);
    } catch (err) {
      console.error(`Failed to fetch existing fleet jobs:`, err);
    }
    
    filteredData.forEach((row, index) => {
      const jobCode = row['Job Code'];
      const equipCode = row['Fleet Equipment Code'];
      if (jobCode && equipCode) {
        const compositeKey = `${String(jobCode).trim().toUpperCase()}|${String(equipCode).trim().toUpperCase()}`;
        if (!fleetJobCompositeOccurrences.has(compositeKey)) {
          fleetJobCompositeOccurrences.set(compositeKey, []);
        }
        fleetJobCompositeOccurrences.get(compositeKey)!.push(index + 2);
      }
    });
  }

  // Track duplicate Fleet Spares by composite key (Part Code + Fleet Equipment Code) - case-insensitive
  // The same Part Code can legitimately appear under different Fleet Equipment Codes
  const fleetSpareCompositeOccurrences = new Map<string, number[]>();
  const existingDbFleetSpareCompositeKeys = new Set<string>();
  
  if (type === 'fleet-spares') {
    try {
      const existingFleetSpares = await storage.getFleetSparesFromTable();
      existingFleetSpares.forEach((fs: any) => {
        if (fs.partCode && fs.fleetEquipmentCode) {
          const compositeKey = `${fs.partCode.toUpperCase()}|${fs.fleetEquipmentCode.toUpperCase()}`;
          existingDbFleetSpareCompositeKeys.add(compositeKey);
        }
      });
      console.log(`📋 Loaded ${existingDbFleetSpareCompositeKeys.size} existing fleet spare composite keys from database`);
    } catch (err) {
      console.warn('⚠️ Could not load existing fleet spare composite keys:', err);
    }
    
    filteredData.forEach((row: any, index: number) => {
      const partCode = row['Part Code'];
      const equipCode = row['Fleet Equipment Code'];
      if (partCode && equipCode) {
        const compositeKey = `${String(partCode).trim().toUpperCase()}|${String(equipCode).trim().toUpperCase()}`;
        if (!fleetSpareCompositeOccurrences.has(compositeKey)) {
          fleetSpareCompositeOccurrences.set(compositeKey, []);
        }
        fleetSpareCompositeOccurrences.get(compositeKey)!.push(index + 2);
      }
    });
  }
  
  // Track duplicate Spares by composite key (Part Code + Component Code + Vessel Code) - case-insensitive
  const spareCompositeOccurrences = new Map<string, number[]>();
  const existingDbSpareCompositeKeys = new Set<string>();
  // Vessel components map for Component Code validation and name auto-fill (spares block)
  const vesselComponentsByCode = new Map<string, any>();
  let vesselComponentsLoaded = false; // true only when the DB fetch succeeded
  // Vessel location name set for Location A/B reference validation (spares block)
  const vesselLocationNameSet = new Set<string>();
  let vesselLocationsLoaded = false; // true only when the DB fetch succeeded

  if (type === 'spares') {
    if (vesselId) {
      // Load existing spares for DB composite-key duplicate check
      try {
        const existingSparesList = await storage.getSpares(vesselId);
        existingSparesList.forEach((s: any) => {
          if (s.partCode && s.componentCode) {
            const vessel = (s.vesselId ?? vesselId ?? '').toUpperCase();
            const ck = `${String(s.partCode).trim().toUpperCase()}|${String(s.componentCode).trim().toUpperCase()}|${vessel}`;
            existingDbSpareCompositeKeys.add(ck);
          }
        });
        console.log(`📋 Loaded ${existingDbSpareCompositeKeys.size} existing spare composite keys from database`);
      } catch (err) {
        console.warn('⚠️ Could not load existing spare composite keys:', err);
      }

      // Load vessel components for Component Code validation and name auto-fill
      try {
        const vesselComponents = await storage.getComponents(vesselId);
        vesselComponents.forEach((c: any) => {
          if (c.componentCode) {
            vesselComponentsByCode.set(String(c.componentCode).trim(), c);
          }
        });
        vesselComponentsLoaded = true;
        console.log(`📋 Loaded ${vesselComponentsByCode.size} components for spares validation`);
      } catch (err) {
        console.warn('⚠️ Could not load vessel components for spares validation:', err);
      }

      // Load vessel locations for Location A/B reference validation
      try {
        const vesselLocations = await storage.getLocations(vesselId);
        vesselLocations.forEach((loc: any) => {
          if (loc.locationName) {
            vesselLocationNameSet.add(String(loc.locationName).trim().toLowerCase());
          }
        });
        vesselLocationsLoaded = true;
        console.log(`📋 Loaded ${vesselLocationNameSet.size} locations for spares validation`);
      } catch (err) {
        console.warn('⚠️ Could not load vessel locations for spares validation:', err);
      }
    }

    // Track in-file composite key occurrences
    filteredData.forEach((row: any, index: number) => {
      const partCode = row['Part Code'];
      const componentCode = row['Component Code'];
      if (partCode && componentCode) {
        const vessel = (vesselId ?? '').toUpperCase();
        const ck = `${String(partCode).trim().toUpperCase()}|${String(componentCode).trim().toUpperCase()}|${vessel}`;
        if (!spareCompositeOccurrences.has(ck)) {
          spareCompositeOccurrences.set(ck, []);
        }
        spareCompositeOccurrences.get(ck)!.push(index + 2);
      }
    });
  }

  // Track duplicate Jobs by composite key (Job Code + Component Code + Vessel Code) - case-insensitive.
  // Job Code is optional (auto-generated and therefore unique), so duplicate detection only
  // applies to rows that actually supply a Job Code AND a Component Code. Only importable rows
  // (non-blank WO Title) participate, so a rejected/blank row never "claims" a composite key.
  const jobCompositeOccurrences = new Map<string, number[]>();
  const existingDbJobCompositeKeys = new Set<string>();

  // Allowed Approver values come from the Rank Master (admAvailableRanks), loaded via the
  // ranks module service layer. Case-insensitive set keyed on rank name (and label),
  // mapping to the canonical name for normalization. Null => rank master unavailable.
  let approverRankMaster: Map<string, string> | null = null;
  if (type === 'jobs') {
    try {
      const ranks = await getAllRanks();
      if (ranks) {
        approverRankMaster = new Map<string, string>();
        for (const r of ranks as any[]) {
          const canonical = r?.name ? String(r.name).trim() : '';
          if (canonical) {
            approverRankMaster.set(canonical.toLowerCase(), canonical);
            if (r?.label && String(r.label).trim() !== '') {
              approverRankMaster.set(String(r.label).trim().toLowerCase(), canonical);
            }
          }
        }
      }
      console.log(`📋 Loaded ${approverRankMaster?.size ?? 0} Rank Master entries for Approver validation`);
    } catch (err) {
      console.error('Failed to fetch Rank Master for Approver validation:', err);
    }
  }

  if (type === 'jobs') {
    try {
      const existingJobs = await storage.getJobs(vesselId);
      existingJobs.forEach((j: any) => {
        if (j.jobNo && j.componentCode) {
          const vesselPart = String(j.vesselCode || vesselId || '').trim().toUpperCase();
          const compositeKey = `${String(j.jobNo).trim().toUpperCase()}|${String(j.componentCode).trim().toUpperCase()}|${vesselPart}`;
          existingDbJobCompositeKeys.add(compositeKey);
        }
      });
      console.log(`📋 Loaded ${existingDbJobCompositeKeys.size} existing job composite keys for vessel '${vesselId}'`);
    } catch (err) {
      console.error('Failed to fetch existing jobs for duplicate validation:', err);
    }

    filteredData.forEach((row: any, index: number) => {
      const woTitle = row['WO Title'];
      const jobCode = row['Job Code'];
      const componentCode = row['Component Code'];
      const vesselCode = row['Vessel Code'];
      const hasWoTitle = woTitle !== undefined && woTitle !== null && String(woTitle).trim() !== '';
      const hasJobCode = jobCode !== undefined && jobCode !== null && String(jobCode).trim() !== '';
      const hasComponentCode = componentCode !== undefined && componentCode !== null && String(componentCode).trim() !== '';
      if (hasWoTitle && hasJobCode && hasComponentCode) {
        const vesselPart = String(vesselCode || vesselId || '').trim().toUpperCase();
        const compositeKey = `${String(jobCode).trim().toUpperCase()}|${String(componentCode).trim().toUpperCase()}|${vesselPart}`;
        if (!jobCompositeOccurrences.has(compositeKey)) {
          jobCompositeOccurrences.set(compositeKey, []);
        }
        jobCompositeOccurrences.get(compositeKey)!.push(index + 2);
      }
    });
  }

  // Pre-load vessel spares for spare-history Part Code validation
  const vesselSparesByPartCode = new Map<string, any>();
  if (type === 'spare-history' && vesselId) {
    try {
      const vesselSpares = await storage.getSpares(vesselId);
      vesselSpares.forEach((s: any) => {
        if (s.partCode) {
          vesselSparesByPartCode.set(String(s.partCode).trim(), s);
        }
      });
      console.log(`📋 Loaded ${vesselSparesByPartCode.size} spares for vessel '${vesselId}' (spare-history validation)`);
    } catch (err) {
      console.warn('⚠️ Could not pre-load vessel spares for spare-history validation:', err);
    }
  }

  // Pre-load vessel stores for store-history Item Code validation
  const vesselStoresByItemCode = new Map<string, any>();
  if (type === 'store-history' && vesselId) {
    try {
      const vesselStores = await storage.getStoresItems(vesselId);
      vesselStores.forEach((s: any) => {
        if (s.itemCode) {
          vesselStoresByItemCode.set(String(s.itemCode).trim(), s);
        }
      });
      console.log(`📋 Loaded ${vesselStoresByItemCode.size} stores items for vessel '${vesselId}' (store-history validation)`);
    } catch (err) {
      console.warn('⚠️ Could not pre-load vessel stores for store-history validation:', err);
    }
  }

  let existingMakersByCode = new Map<string, any>();
  let makerListLoaded = false;

  if (type === 'components' || type === 'spares' || type === 'fleet-spares') {
    if (type === 'components') {
      // Fetch existing component codes for the vessel from the database
      if (vesselId) {
        try {
          const existingComponents = await storage.getComponents(vesselId);
          existingComponents.forEach(comp => {
            if (comp.componentCode) {
              existingDbComponentCodes.add(comp.componentCode.toUpperCase());
            }
            if (comp.name) {
              const nameKey = String(comp.name).trim().toUpperCase();
              if (nameKey) {
                if (!existingDbComponentNames.has(nameKey)) {
                  existingDbComponentNames.set(nameKey, new Set<string>());
                }
                if (comp.componentCode) {
                  existingDbComponentNames.get(nameKey)!.add(String(comp.componentCode).trim().toUpperCase());
                }
              }
            }
          });
          console.log(`📋 Loaded ${existingDbComponentCodes.size} existing component codes and ${existingDbComponentNames.size} existing component names for vessel '${vesselId}'`);
        } catch (err) {
          console.error(`Failed to fetch existing components for vessel ${vesselId}:`, err);
        }
      }
    }

    try {
      const existingMakers = await storage.getMakerList();
      // Key by trimmed+lowercased Maker Code so lookups are case-insensitive and space-tolerant.
      existingMakersByCode = new Map(
        existingMakers.map((m: any) => [String(m.makerCode ?? '').trim().toLowerCase(), m]),
      );
      makerListLoaded = true;
      console.log(`📋 Loaded ${existingMakers.length} existing makers for validation`);
    } catch (err) {
      console.error('Failed to fetch maker list for validation:', err);
    }
    
    if (type === 'components') {
      // Track occurrences within the uploaded file (case-insensitive)
      filteredData.forEach((row, index) => {
        const componentCode = row['Component Code'];
        if (componentCode) {
          const code = String(componentCode).trim().toUpperCase(); // Case-insensitive
          if (!componentCodeOccurrences.has(code)) {
            componentCodeOccurrences.set(code, []);
          }
          componentCodeOccurrences.get(code)!.push(index + 2); // Row number (Excel is 1-indexed + header)
        }
        // Track Component Name occurrences (case-insensitive, trimmed) for in-file duplicate detection
        const componentName = row['Component Name'];
        if (componentName !== undefined && componentName !== null) {
          const name = String(componentName).trim().toUpperCase();
          if (name !== '') {
            if (!componentNameOccurrences.has(name)) {
              componentNameOccurrences.set(name, []);
            }
            componentNameOccurrences.get(name)!.push(index + 2); // Row number (Excel is 1-indexed + header)
          }
        }
      });
    }
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
          errors.push(`Row ${rowNum}: Invalid Component Code format. Expected SFI format: 6, 61, 612, 612.005, 601001, 601001001, etc.`);
        } else {
          normalized['Component Code'] = codeStr;
          const codeUpperCase = codeStr.toUpperCase();
          
          // Check for duplicate Component Codes within the uploaded file (case-insensitive)
          // Only flag rows that are NOT the first occurrence - the first occurrence is valid
          const occurrences = componentCodeOccurrences.get(codeUpperCase);
          if (occurrences && occurrences.length > 1) {
            const firstOccurrence = occurrences[0];
            if (rowNum !== firstOccurrence) {
              // This is a duplicate occurrence (not the first one)
              errors.push(`Row ${rowNum}: Duplicate Component Code '${codeStr}' - this code already appears in row ${firstOccurrence}. Each Component Code must be unique within the vessel.`);
            }
          }
          
          // Check for duplicate Component Codes against existing database records (mode-specific)
          // 'add' mode: existing code = error (cannot create duplicate)
          // 'update'/'upsert' mode: existing code = OK (updating existing is expected)
          if (mode === 'add' && existingDbComponentCodes.has(codeUpperCase)) {
            errors.push(`Row ${rowNum}: Component Code '${codeStr}' already exists in vessel '${vesselId}'. Cannot add duplicate component.`);
          }
          
          // Parent Component Code handling — no auto-derivation.
          // The user must explicitly supply a parent for every non-top-level component.
          // Use centralized helper that checks all header variants.
          const explicitParent = getExplicitParentFromRow(row);
          // A single-character (top-level) Component Code does not require a parent.
          const isTopLevel = stripSFISuffix(codeStr).length === 1;

          if (explicitParent) {
            // Validate the explicitly-typed parent against the same SFI format as Component Code
            if (!validateSFICode(explicitParent)) {
              errors.push(`Row ${rowNum}: Invalid Parent Component Code format '${explicitParent}'. Expected SFI format: 6, 61, 612, 612.005, 601001, 601001001, etc.`);
            } else {
              normalized['Parent Component Code'] = explicitParent;
              const resolvedParentUpper = explicitParent.toUpperCase();

              if (codeUpperCase === resolvedParentUpper) {
                errors.push(`Row ${rowNum}: Component Code and Parent Component Code are both '${codeStr}'. A component cannot be its own parent.`);
              } else {
                // Parent Component Code must exist in the uploaded file OR in the vessel's database
                const parentInFile = componentCodeOccurrences.has(resolvedParentUpper);
                const parentInDb = existingDbComponentCodes.has(resolvedParentUpper);
                if (!parentInFile && !parentInDb) {
                  errors.push(`Row ${rowNum}: Parent Component Code '${explicitParent}' does not exist in the uploaded file or in the vessel's component register. Cannot create a component without a valid parent.`);
                }
              }
            }
          } else if (!isTopLevel) {
            // No parent supplied and the code is not a single-digit top-level code → required
            errors.push(`Row ${rowNum}: Parent Component Code is required for '${codeStr}'. Only a single-digit top-level Component Code may omit the parent.`);
          }

          // NOTE: __meta is set at the END of the component validation block
          // to ensure it survives all field copy operations
          
          // Auto-calculate Component Category from first digit
          const firstDigit = parseInt(codeStr.charAt(0));
          if (!isNaN(firstDigit) && firstDigit >= 1 && firstDigit <= 8) {
            const category = getComponentCategory(firstDigit);
            if (category && !row['Component Category']) {
              normalized['Component Category'] = category;
            }
          }
        }
      }

      const providedCategory = normalized['Component Category'] || row['Component Category'];
      if (providedCategory && typeof providedCategory === 'string') {
        const activeCats = getEffectiveComponentCategories();
        const catValue = providedCategory.trim();
        const catNameOnly = catValue.replace(/^\d+\s+/, '');
        const isValid = activeCats.some(ac => {
          const acName = ac.replace(/^\d+\s+/, '');
          return ac === catValue || acName === catValue || acName === catNameOnly;
        });
        if (!isValid && activeCats.length > 0) {
          const allowedValues = activeCats.join(', ');
          errors.push(`Row ${rowNum}: Invalid Component Category "${catValue}". Allowed values: ${allowedValues}`);
        }
      }
      
      // Component Name validation:
      // 1. Mandatory — blank (or whitespace-only) is a blocking error; no auto-generation.
      // 2. Allowed characters: letters, numbers, spaces, period, comma, hyphen, round brackets.
      // 3. Unique within the import file (case-insensitive, trimmed).
      // 4. Trimmed before validation; trimmed value is what gets imported.
      // 5. Unique within the selected vessel (case-insensitive, trimmed).
      const componentNameTrimmed = row['Component Name'] === undefined || row['Component Name'] === null
        ? ''
        : String(row['Component Name']).trim();
      if (componentNameTrimmed === '') {
        errors.push(`Row ${rowNum}: Component Name is required and cannot be blank`);
      } else if (!/^[A-Za-z0-9 .,()\-]+$/.test(componentNameTrimmed)) {
        errors.push(`Row ${rowNum}: Component Name contains invalid characters. Only letters, numbers, spaces, periods (.), commas (,), hyphens (-), and brackets () are allowed.`);
      } else {
        normalized['Component Name'] = componentNameTrimmed;
        const nameUpperCase = componentNameTrimmed.toUpperCase();

        // Duplicate within the uploaded file (case-insensitive). Flag only non-first occurrences.
        const nameOccurrences = componentNameOccurrences.get(nameUpperCase);
        if (nameOccurrences && nameOccurrences.length > 1) {
          const firstOccurrence = nameOccurrences[0];
          if (rowNum !== firstOccurrence) {
            errors.push(`Row ${rowNum}: Duplicate Component Name '${componentNameTrimmed}' - this name already appears in row ${firstOccurrence}. Each Component Name must be unique within the import file.`);
          }
        }

        // Duplicate against existing components for the vessel (case-insensitive).
        // In 'add' mode any pre-existing name is a conflict. In 'update'/'upsert' mode a row
        // may legitimately keep its own existing name, so only flag a name that belongs to a
        // DIFFERENT component (matched by Component Code).
        const codesWithName = existingDbComponentNames.get(nameUpperCase);
        if (codesWithName) {
          const ownCode = normalized['Component Code']
            ? String(normalized['Component Code']).trim().toUpperCase()
            : null;
          const belongsOnlyToThisRow = ownCode !== null && codesWithName.size === 1 && codesWithName.has(ownCode);
          if (mode === 'add' || !belongsOnlyToThisRow) {
            errors.push(`Row ${rowNum}: Component Name '${componentNameTrimmed}' already exists in vessel '${vesselId}'. Component Name must be unique within the vessel.`);
          }
        }
      }

      // Validate Yes/No fields - Support both template format and legacy format
      // Template uses: Critical Yes/No; Legacy uses: Critical (Yes/No)
      // (Condition Based is validated in the Yes/No reference block below because the
      //  active template header is the plain 'Condition Based', not 'Condition Based Yes/No'.)
      const yesNoFieldMappings = [
        { template: 'Critical Yes/No', legacy: 'Critical (Yes/No)', required: false },
        { template: 'IS Active', legacy: 'IS Active', required: true }
      ];
      
      yesNoFieldMappings.forEach(({ template, legacy, required }) => {
        const fieldValue = row[template] ?? row[legacy];
        const isBlank = fieldValue === undefined || fieldValue === null || String(fieldValue).trim() === '';
        if (isBlank) {
          if (required) {
            errors.push(`Row ${rowNum}: ${template} is required`);
          }
          return;
        }
        const value = String(fieldValue).toLowerCase().trim();
        if (!YES_NO_SYNONYMS.includes(value)) {
          errors.push(`Row ${rowNum}: ${template} must be Yes or No`);
        } else {
          // Normalize to boolean-friendly format - store in both formats
          const normalizedValue = ['yes', 'y', 'true', '1'].includes(value);
          normalized[template] = normalizedValue;
          normalized[legacy] = normalizedValue;
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

      // Validate date fields - strict DD-MM-YYYY only (no Excel serials, no letters/symbols)
      ['Installation Date', 'Commissioned Date', 'Last Updated'].forEach(field => {
        const { error, normalized: normDate } = validateDateDDMMYYYY(row[field], field, rowNum);
        if (error) {
          errors.push(error);
        } else if (normDate !== undefined) {
          normalized[field] = normDate;
        }
      });

      // Validate Yes/No reference fields that were previously copied as free text.
      // Criticality is validated here for the plain 'Criticality' template header
      // (the legacy 'Critical Yes/No' header is handled by the mapping above).
      // Condition Based is validated here because the active template header is the
      // plain 'Condition Based' (the 'Condition Based Yes/No' variants are legacy).
      [
        { keys: ['Class Item', 'Class item'], label: 'Class Item' },
        { keys: ['IS Parent', 'Is Parent'], label: 'Is Parent' },
        { keys: ['Criticality'], label: 'Criticality' },
        { keys: ['Condition Based', 'Condition Based Yes/No', 'Condition Based (Yes/No)'], label: 'Condition Based' },
      ].forEach(({ keys, label }) => {
        const rawValue = keys.map(k => row[k]).find(v => v !== undefined && v !== null && v !== '');
        const { error, normalized: normYesNo } = validateYesNoField(rawValue, label, rowNum);
        if (error) {
          errors.push(error);
        } else if (normYesNo !== undefined) {
          keys.forEach(k => { normalized[k] = normYesNo; });
        }
      });

      // Copy text fields directly - support both new and legacy header formats
      // IMPORTANT: Include RH Counter Type and RH Counter Source for Running Hours tracking.
      // Note: Last Updated is validated as a date above; Class Item / IS Parent /
      // Criticality / Condition Based are validated as Yes/No in the reference block above.
      const textFields = [
        'Fleet Equipment Code', 'Fleet Equipment Name', 'Maker', 'Maker Code',
        'Model', 'Model Code', 'Model Number', 'Serial No', 'Drawing No', 'Location',
        'Rating', 'Equipment / System Department', 'Eqpt / System Department', 'Notes', 'Vessel Code',
        'RH Counter Type', 'RH Counter Source'
      ];
      
      textFields.forEach(field => {
        if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
          normalized[field] = String(row[field]).trim();
        }
      });

      const deptValue = normalized['Equipment / System Department'] || normalized['Eqpt / System Department'];
      // "Null"/"null"/"NULL" is treated as explicit no-department — always valid regardless of case
      const deptIsNullSentinel = deptValue && deptValue.toLowerCase() === 'null';
      if (deptValue && !deptIsNullSentinel && !DEPARTMENTS.includes(deptValue)) {
        errors.push(`Row ${rowNum}: Invalid Equipment / System Department '${deptValue}'. Allowed values are: ${DEPARTMENTS.join(', ')}.`);
      }

      // Validate Maker Code / Maker Name reference (only if maker list was loaded successfully)
      if (makerListLoaded) {
        const rowMakerCode = normalized['Maker Code'] || null;
        const rowMakerName = normalized['Maker'] || normalized['Maker Name'] || null;
        errors.push(...validateMakerReference(rowMakerCode, rowMakerName, existingMakersByCode, rowNum));
      }

      // Note: Parent Component Code is now handled by the centralized logic above
      // using getExplicitParentFromRow() which checks all header variants
      // No additional copy needed here - metadata is already properly set

      // Copy Component Category if provided
      if (row['Component Category'] && !normalized['Component Category']) {
        normalized['Component Category'] = String(row['Component Category']).trim();
      }
      
      // FINAL STEP: Ensure __meta is set at the END of component validation
      // This prevents any previous operations from overwriting or losing the metadata
      // Even if validation failed, we still need the metadata for proper parent handling
      const explicitParentFinal = getExplicitParentFromRow(row) || (row['__meta']?.originalExplicitParent);
      normalized['__meta'] = {
        explicitParentProvided: !!explicitParentFinal,
        originalExplicitParent: explicitParentFinal || null
      };
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
        normalized['Vessel Code'] = vesselId;
      }

      // Validate Component Code — mandatory + vessel-scoped existence check
      if (!row['Component Code'] || String(row['Component Code']).trim() === '') {
        errors.push(`Row ${rowNum}: Component Code is mandatory.`);
      } else {
        const componentCode = String(row['Component Code']).trim();
        normalized['Component Code'] = componentCode;

        const matchedComponent = vesselComponentsByCode.get(componentCode);
        if (vesselComponentsLoaded && !matchedComponent) {
          errors.push(`Row ${rowNum}: Component Code does not exist for the selected vessel.`);
        } else if (matchedComponent) {
          // Always source Component Name from the DB; file-supplied value is discarded
          normalized['Component Name'] = matchedComponent.name || '';
        }
      }

      // Composite duplicate check (Part Code + Component Code + Vessel Code)
      // ALL rows in a duplicated group are rejected (including the first occurrence).
      const _sparePartCodeForDup = row['Part Code'] ? String(row['Part Code']).trim() : null;
      const _spareCompCodeForDup = normalized['Component Code'] || null;
      if (_sparePartCodeForDup && _spareCompCodeForDup) {
        const _vessel = (vesselId ?? '').toUpperCase();
        const _ck = `${_sparePartCodeForDup.toUpperCase()}|${_spareCompCodeForDup.toUpperCase()}|${_vessel}`;
        const _inFile = spareCompositeOccurrences.get(_ck);
        if (_inFile && _inFile.length > 1) {
          const _others = _inFile.filter(r => r !== rowNum);
          errors.push(`Row ${rowNum}: Duplicate spare — Part Code '${_sparePartCodeForDup}' linked to Component Code '${_spareCompCodeForDup}' also appears in row(s) ${_others.join(', ')} of this upload. All duplicate rows are rejected.`);
        }
        if (mode === 'add' && existingDbSpareCompositeKeys.has(_ck)) {
          errors.push(`Row ${rowNum}: Spare with Part Code '${_sparePartCodeForDup}' linked to Component Code '${_spareCompCodeForDup}' already exists in the vessel register.`);
        }
      }

      // Part Code - optional, auto-generated during import if blank
      if (row['Part Code'] && String(row['Part Code']).trim()) {
        normalized['Part Code'] = String(row['Part Code']).trim();
      }

      // Part Name - required
      if (!row['Part Name'] || String(row['Part Name']).trim() === '') {
        errors.push(`Row ${rowNum}: Part Name is mandatory.`);
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

      // Validate numeric fields
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

      // Validate Criticality (optional Yes/No)
      {
        const rawVal = row['Criticality'] ?? row['Critical Yes/No'] ?? row['Criticality (Yes/No)'];
        const isBlank = rawVal === undefined || rawVal === null || String(rawVal).trim() === '';
        if (!isBlank) {
          const val = String(rawVal).toLowerCase().trim();
          if (!YES_NO_SYNONYMS.includes(val)) {
            errors.push(`Row ${rowNum}: Invalid Criticality value.`);
          } else {
            normalized['Criticality'] = ['yes', 'y', 'true', '1'].includes(val) ? 'Yes' : 'No';
          }
        }
      }

      // Validate Is Active (required Yes/No)
      {
        const rawVal = row['Is Active'] ?? row['IS Active'];
        const isBlank = rawVal === undefined || rawVal === null || String(rawVal).trim() === '';
        if (isBlank) {
          errors.push(`Row ${rowNum}: Is Active is required`);
        } else {
          const val = String(rawVal).toLowerCase().trim();
          if (!YES_NO_SYNONYMS.includes(val)) {
            errors.push(`Row ${rowNum}: Invalid Is Active value.`);
          } else {
            normalized['Is Active'] = ['yes', 'y', 'true', '1'].includes(val) ? 'Yes' : 'No';
          }
        }
      }

      // Validate IHM (optional Yes/No)
      {
        const rawVal = row['IHM (Inventory of Hazardous Materials)'];
        const isBlank = rawVal === undefined || rawVal === null || String(rawVal).trim() === '';
        if (!isBlank) {
          const val = String(rawVal).toLowerCase().trim();
          if (!YES_NO_SYNONYMS.includes(val)) {
            errors.push(`Row ${rowNum}: Invalid IHM value.`);
          } else {
            normalized['IHM (Inventory of Hazardous Materials)'] = ['yes', 'y', 'true', '1'].includes(val) ? 'Yes' : 'No';
          }
        }
      }

      // Validate Rotation Item (optional Yes/No)
      {
        const rawVal = row['Rotation Item'];
        const isBlank = rawVal === undefined || rawVal === null || String(rawVal).trim() === '';
        if (!isBlank) {
          const val = typeof rawVal === 'boolean'
            ? (rawVal ? 'yes' : 'no')
            : String(rawVal).toLowerCase().trim();
          if (!YES_NO_SYNONYMS.includes(val)) {
            errors.push(`Row ${rowNum}: Invalid Rotation Item value.`);
          } else {
            normalized['Rotation Item'] = ['yes', 'y', 'true', '1'].includes(val) ? 'Yes' : 'No';
          }
        }
      }

      // Location A/B — conditional presence + vessel-scoped reference validation
      const _locAName = row['Location A'] ? String(row['Location A']).trim() : '';
      const _locBName = row['Location B'] ? String(row['Location B']).trim() : '';
      const _locARaw = row['Location A - ROB'];
      const _locBRaw = row['Location B - ROB'];
      const _locARobPresent = _locARaw !== undefined && _locARaw !== null && String(_locARaw).trim() !== '';
      const _locBRobPresent = _locBRaw !== undefined && _locBRaw !== null && String(_locBRaw).trim() !== '';

      if (_locARobPresent && _locAName === '') {
        errors.push(`Row ${rowNum}: Location A is mandatory when Location A ROB is entered.`);
      } else if (_locAName !== '' && vesselLocationsLoaded && !vesselLocationNameSet.has(_locAName.toLowerCase())) {
        errors.push(`Row ${rowNum}: Invalid Location A.`);
      }

      if (_locBRobPresent && _locBName === '') {
        errors.push(`Row ${rowNum}: Location B is mandatory when Location B ROB is entered.`);
      } else if (_locBName !== '' && vesselLocationsLoaded && !vesselLocationNameSet.has(_locBName.toLowerCase())) {
        errors.push(`Row ${rowNum}: Invalid Location B.`);
      }

      // Fleet Equipment Code - accept as-is, no master data lookup
      if (row['Fleet Equipment Code']) {
        normalized['Fleet Equipment Code'] = String(row['Fleet Equipment Code']).trim();
      }

      // Copy text fields directly
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

      // Validate Maker Code reference (spec: "Invalid Maker Code.")
      if (makerListLoaded) {
        const _makerCode = normalized['Maker Code'] != null ? String(normalized['Maker Code']).trim() : '';
        const _makerName = normalized['Maker'] != null ? String(normalized['Maker']).trim() : '';
        if (_makerCode) {
          const master = existingMakersByCode.get(_makerCode.toLowerCase());
          if (!master) {
            errors.push(`Row ${rowNum}: Invalid Maker Code.`);
          } else if (_makerName && String(master.makerName ?? '').trim().toLowerCase() !== _makerName.toLowerCase()) {
            errors.push(`Row ${rowNum}: Invalid Maker Code.`);
          }
        } else if (_makerName) {
          errors.push(`Row ${rowNum}: Invalid Maker Code.`);
        }
      }
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
      const validScheduleTypes = ['Calendar', 'Running Hours', 'Dual Frequency'];
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
    } else if (type === 'wo-history') {
      // ── WO History import validation ──
      // Required: WO Number, Component Code, Job Title, Maintenance Type, Date Completed, Performed By

      const woNumber = row['WO Number'];
      if (!woNumber || String(woNumber).trim() === '') {
        errors.push(`Row ${rowNum}: WO Number is required`);
      } else {
        normalized['WO Number'] = String(woNumber).trim();
      }

      const componentCode = row['Component Code'];
      if (!componentCode || String(componentCode).trim() === '') {
        errors.push(`Row ${rowNum}: Component Code is required`);
      } else {
        normalized['Component Code'] = String(componentCode).trim();
      }

      const jobTitle = row['Job Title'];
      if (!jobTitle || String(jobTitle).trim() === '') {
        errors.push(`Row ${rowNum}: Job Title is required`);
      } else {
        normalized['Job Title'] = String(jobTitle).trim();
      }

      const maintenanceType = row['Maintenance Type'];
      if (!maintenanceType || String(maintenanceType).trim() === '') {
        errors.push(`Row ${rowNum}: Maintenance Type is required`);
      } else {
        normalized['Maintenance Type'] = String(maintenanceType).trim();
      }

      if (!row['Date Completed'] && row['Date Completed'] !== 0) {
        errors.push(`Row ${rowNum}: Date Completed is required`);
      } else {
        normalized['Date Completed'] = row['Date Completed'];
      }

      const performedBy = row['Performed By'];
      if (!performedBy || String(performedBy).trim() === '') {
        errors.push(`Row ${rowNum}: Performed By is required`);
      } else {
        normalized['Performed By'] = String(performedBy).trim();
      }

      // Status — optional, default to 'Completed'
      const validStatuses = ['Completed', 'Approved'];
      const rawStatus = row['Status'] ? String(row['Status']).trim() : '';
      if (rawStatus && !validStatuses.includes(rawStatus)) {
        warnings.push(`Row ${rowNum}: Status '${rawStatus}' is not standard. Will default to 'Completed'.`);
        normalized['Status'] = 'Completed';
      } else {
        normalized['Status'] = rawStatus || 'Completed';
      }

      // Optional fields — copy as-is (dates stored raw for import service to parse)
      const optionalFields = [
        'WO Description', 'Duration Hours', 'Running Hours at Completion',
        'Remarks', 'Next Due Date', 'Spare Parts Used', 'Job Approved By',
        'WO Due Date', 'WO Due Hour', 'Next Due Hour'
      ];
      for (const field of optionalFields) {
        if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== '') {
          normalized[field] = row[field];
        }
      }
    } else if (type === 'spare-history') {
      // ── Spare History import validation ──
      // Required: Part Code, Event Type, Quantity, ROB After, Date

      const partCode = row['Part Code'];
      if (!partCode || String(partCode).trim() === '') {
        errors.push(`Row ${rowNum}: Part Code is required`);
      } else {
        const partCodeStr = String(partCode).trim();
        normalized['Part Code'] = partCodeStr;
        // Verify the part code exists in this vessel's spares register
        if (vesselSparesByPartCode.size > 0 && !vesselSparesByPartCode.has(partCodeStr)) {
          errors.push(`Row ${rowNum}: Part Code '${partCodeStr}' not found in vessel's spares register`);
        }
      }

      const eventType = row['Event Type'];
      const validEventTypes = ['CONSUME', 'RECEIVE', 'ADJUST'];
      if (!eventType || String(eventType).trim() === '') {
        errors.push(`Row ${rowNum}: Event Type is required`);
      } else {
        const evtNorm = String(eventType).trim().toUpperCase();
        if (!validEventTypes.includes(evtNorm)) {
          errors.push(`Row ${rowNum}: Event Type '${eventType}' is invalid. Accepted values: CONSUME, RECEIVE, ADJUST`);
        } else {
          normalized['Event Type'] = evtNorm;
        }
      }

      const quantity = row['Quantity'];
      if (quantity === undefined || quantity === null || String(quantity).trim() === '') {
        errors.push(`Row ${rowNum}: Quantity is required`);
      } else {
        const qtyStr = String(quantity).trim();
        const qtyNum = Number(qtyStr);
        if (!Number.isInteger(qtyNum) || qtyNum < 0 || isNaN(qtyNum)) {
          errors.push(`Row ${rowNum}: Quantity must be a non-negative integer (got '${qtyStr}')`);
        } else {
          normalized['Quantity'] = qtyNum;
        }
      }

      const robAfter = row['ROB After'];
      if (robAfter === undefined || robAfter === null || String(robAfter).trim() === '') {
        errors.push(`Row ${rowNum}: ROB After is required`);
      } else {
        const robStr = String(robAfter).trim();
        const robNum = Number(robStr);
        if (!Number.isInteger(robNum) || robNum < 0 || isNaN(robNum)) {
          errors.push(`Row ${rowNum}: ROB After must be a non-negative integer (got '${robStr}')`);
        } else {
          normalized['ROB After'] = robNum;
        }
      }

      if (!row['Date'] && row['Date'] !== 0) {
        errors.push(`Row ${rowNum}: Date is required`);
      } else {
        normalized['Date'] = row['Date'];
      }

      // Optional fields — copy as-is
      const optionalFields = [
        'Vessel Code', 'Component Code', 'Performed By', 'Remarks',
        'Reference', 'Port/Place', 'Timezone', 'Component Spare Code'
      ];
      for (const field of optionalFields) {
        if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== '') {
          normalized[field] = row[field];
        }
      }

    } else if (type === 'store-history') {
      // ── Store History import validation ──
      // Required: Item Code, Event Type, Quantity, ROB After, Date, Vessel Code

      const itemCode = row['Item Code'];
      if (!itemCode || String(itemCode).trim() === '') {
        errors.push(`Row ${rowNum}: Item Code is required`);
      } else {
        const itemCodeStr = String(itemCode).trim();
        normalized['Item Code'] = itemCodeStr;
        if (vesselStoresByItemCode.size > 0 && !vesselStoresByItemCode.has(itemCodeStr)) {
          errors.push(`Row ${rowNum}: Item Code '${itemCodeStr}' not found in vessel's stores register`);
        }
      }

      const eventType = row['Event Type'];
      const validStoreEventTypes = ['RECEIVE', 'CONSUME', 'ADJUST', 'TRANSFER_IN', 'TRANSFER_OUT'];
      if (!eventType || String(eventType).trim() === '') {
        errors.push(`Row ${rowNum}: Event Type is required`);
      } else {
        const evtNorm = String(eventType).trim().toUpperCase();
        if (!validStoreEventTypes.includes(evtNorm)) {
          errors.push(`Row ${rowNum}: Event Type '${eventType}' is invalid. Accepted values: RECEIVE, CONSUME, ADJUST, TRANSFER_IN, TRANSFER_OUT`);
        } else {
          normalized['Event Type'] = evtNorm;
        }
      }

      const quantity = row['Quantity'];
      if (quantity === undefined || quantity === null || String(quantity).trim() === '') {
        errors.push(`Row ${rowNum}: Quantity is required`);
      } else {
        const qtyNum = Number(String(quantity).trim());
        if (isNaN(qtyNum) || qtyNum <= 0) {
          errors.push(`Row ${rowNum}: Quantity must be a positive number greater than zero (got '${quantity}')`);
        } else {
          normalized['Quantity'] = qtyNum;
        }
      }

      const robAfter = row['ROB After'];
      if (robAfter === undefined || robAfter === null || String(robAfter).trim() === '') {
        errors.push(`Row ${rowNum}: ROB After is required`);
      } else {
        const robNum = Number(String(robAfter).trim());
        if (isNaN(robNum) || robNum < 0) {
          errors.push(`Row ${rowNum}: ROB After must be a non-negative number (got '${robAfter}')`);
        } else {
          normalized['ROB After'] = robNum;
        }
      }

      if (!row['Date'] && row['Date'] !== 0) {
        errors.push(`Row ${rowNum}: Date is required`);
      } else {
        normalized['Date'] = row['Date'];
      }

      if (!row['Vessel Code'] || String(row['Vessel Code']).trim() === '') {
        errors.push(`Row ${rowNum}: Vessel Code is required`);
      } else {
        const rowVesselCode = String(row['Vessel Code']).trim();
        normalized['Vessel Code'] = rowVesselCode;
        if (vesselId && rowVesselCode.toUpperCase() !== vesselId.trim().toUpperCase()) {
          errors.push(`Row ${rowNum}: Vessel Code '${rowVesselCode}' does not match selected vessel '${vesselId}'. All rows must belong to the same vessel.`);
        }
      }

      // Optional fields — copy as-is
      const storeOptionalFields = ['Location', 'Remarks', 'Reference', 'Port/Place', 'Timezone', 'Performed By'];
      for (const field of storeOptionalFields) {
        if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== '') {
          normalized[field] = row[field];
        }
      }

    } else if (type === 'jobs') {
      // Validate jobs (21-column specification format)
      // WO Title is mandatory (spec item 2). The top-level filter already dropped
      // genuinely empty rows, so a blank WO Title here means a row with data but no
      // title — surface it as an error in the Import Summary instead of silently skipping.
      if (!row['WO Title'] || String(row['WO Title']).trim() === '') {
        results.summary.errors++;
        results.rows.push({
          row: rowNum,
          status: 'error',
          errors: [`Row ${rowNum}: WO Title is mandatory.`],
          normalized: { __meta: { rowNumber: rowNum } }
        });
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
      
      // Component Code - mandatory and must exist in the selected vessel (spec item 3)
      let resolvedComponent: any = null;
      if (!row['Component Code'] || String(row['Component Code']).trim() === '') {
        errors.push(`Row ${rowNum}: Component Code is mandatory.`);
      } else {
        const componentCode = String(row['Component Code']).trim();
        normalized['Component Code'] = componentCode;
        
        // Validate that Component Code exists in the vessel
        const vesselCode = row['Vessel Code'] ? String(row['Vessel Code']).trim() : null;
        if (vesselCode) {
          resolvedComponent = await storage.getComponentByCode(componentCode, vesselCode);
          if (!resolvedComponent) {
            errors.push(`Row ${rowNum}: Component Code does not exist for the selected vessel.`);
          }
        }
      }

      // Component Name (spec item 4): any value in the file is ignored. The system
      // auto-populates the name from the Component master via Component Code. The
      // authoritative override is applied after the "Copy other fields" loop below so
      // the file value can never win.

      // Job Code is optional (will be auto-generated)
      if (row['Job Code']) {
        normalized['Job Code'] = String(row['Job Code']).trim();
      }

      // Duplicate Job (spec item 1): the combination Job Code + Component Code + Vessel Code
      // must be unique. The first occurrence imports; the second and later are rejected.
      // Only enforced when a Job Code is supplied (blank Job Codes auto-generate uniquely).
      {
        const jobCodeVal = row['Job Code'] ? String(row['Job Code']).trim() : '';
        const compCodeVal = row['Component Code'] ? String(row['Component Code']).trim() : '';
        if (jobCodeVal && compCodeVal) {
          const vesselPart = String(row['Vessel Code'] ? String(row['Vessel Code']).trim() : (vesselId || '')).toUpperCase();
          const compositeKey = `${jobCodeVal.toUpperCase()}|${compCodeVal.toUpperCase()}|${vesselPart}`;
          const occ = jobCompositeOccurrences.get(compositeKey);
          const isInFileDuplicate = !!occ && occ.length > 1 && rowNum !== occ[0];
          const isDbDuplicate = mode === 'add' && existingDbJobCompositeKeys.has(compositeKey);
          if (isInFileDuplicate || isDbDuplicate) {
            errors.push(`Row ${rowNum}: Duplicate Job Code and Component Code combination.`);
          }
        }
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
      const validMaintenanceBasis = ['Calendar', 'Running Hours', 'Dual Frequency'];
      if (!row['Maintenance Basis']) {
        errors.push(`Row ${rowNum}: Maintenance Basis is required (must be 'Calendar', 'Running Hours', or 'Dual Frequency')`);
      } else if (!validMaintenanceBasis.includes(row['Maintenance Basis'])) {
        errors.push(`Row ${rowNum}: Invalid Maintenance Basis.`);
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
        if (isNaN(interval)) {
          errors.push(`Row ${rowNum}: Interval Value must be numeric.`);
        } else if (interval <= 0) {
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
      } else if (maintenanceBasis === 'Dual Frequency') {
        // Dual Frequency requires BOTH calendar unit AND Interval Running Hours
        // Calendar leg: Interval Value + Unit define the calendar frequency
        const validCalendarUnits = ['Hours', 'Days', 'Weeks', 'Months', 'Years'];
        if (!row['Unit']) {
          errors.push(`Row ${rowNum}: Unit is REQUIRED for Dual Frequency (calendar leg). Allowed: ${validCalendarUnits.join(', ')}`);
        } else if (!validCalendarUnits.includes(row['Unit'])) {
          errors.push(`Row ${rowNum}: Invalid Unit '${row['Unit']}' for Dual Frequency. Allowed: ${validCalendarUnits.join(', ')}`);
        } else {
          normalized['Unit'] = row['Unit'];
        }
        // RH leg: Interval Running Hours must be present and > 0
        const dualIntervalRH = row['Interval Running Hours'];
        if (!dualIntervalRH || String(dualIntervalRH).trim() === '') {
          errors.push(`Row ${rowNum}: Interval Running Hours is REQUIRED for Dual Frequency jobs (RH leg)`);
        } else {
          const dualRH = parseFloat(String(dualIntervalRH).trim());
          if (isNaN(dualRH) || dualRH <= 0) {
            errors.push(`Row ${rowNum}: Interval Running Hours must be a positive number for Dual Frequency (got: '${dualIntervalRH}')`);
          } else {
            normalized['Interval Running Hours'] = String(dualRH);
          }
        }
      }

      // Task Type - required
      const validTaskTypes = ['Inspection', 'Overhaul', 'Service', 'Test', 'Renew/Replace', 'Measurement/Calibration', 'Megger Test', 'Cleaning', 'Lubrication', 'Survey', 'Analysis', 'Checks'];
      if (!row['Task Type']) {
        errors.push(`Row ${rowNum}: Task Type is required`);
      } else if (!validTaskTypes.includes(row['Task Type'])) {
        errors.push(`Row ${rowNum}: Invalid Task Type. Allowed: ${validTaskTypes.join(', ')}`);
      } else {
        normalized['Task Type'] = row['Task Type'];
      }

      // Assigned To - must match one of the valid configured ranks (spec item 7)
      let assignedToNormalized: string | null = null;
      if (row['Assigned To'] && String(row['Assigned To']).trim() !== '') {
        const assignedToVal = String(row['Assigned To']).trim();
        const matchedRank = JOB_ASSIGNED_TO_RANKS.find(r => r.toLowerCase() === assignedToVal.toLowerCase());
        if (!matchedRank) {
          errors.push(`Row ${rowNum}: Invalid Assigned To value.`);
        } else {
          assignedToNormalized = matchedRank;
          normalized['Assigned To'] = matchedRank;
        }
      }

      // Approver - mandatory; allowed values come from the Rank Master (admAvailableRanks).
      // No longer coupled to Assigned To. Blank -> error; a value not in the Rank Master ->
      // error; a valid value is normalized to the canonical Rank Master name.
      if (!row['Approver'] || String(row['Approver']).trim() === '') {
        errors.push(`Row ${rowNum}: Approver is mandatory.`);
      } else {
        const approverVal = String(row['Approver']).trim();
        if (approverRankMaster) {
          const canonical = approverRankMaster.get(approverVal.toLowerCase());
          if (!canonical) {
            errors.push(`Row ${rowNum}: Invalid Approver value.`);
          } else {
            normalized['Approver'] = canonical;
          }
        } else {
          // Rank Master unavailable (DB down) - accept the provided value rather than
          // blocking the whole import on an infrastructure failure.
          normalized['Approver'] = approverVal;
        }
      }

      // Job Priority - allowed values High/Medium/Low only (spec item 9)
      const validJobPriorities = ['Low', 'Medium', 'High'];
      if (row['Job Priority'] && !validJobPriorities.includes(row['Job Priority'])) {
        errors.push(`Row ${rowNum}: Invalid Job Priority.`);
      } else if (row['Job Priority']) {
        normalized['Job Priority'] = row['Job Priority'];
      }

      // Class Related - optional, accepts Yes/No, Y/N, True/False, 1/0 (spec item 10)
      {
        const classRelatedResult = validateYesNoField(row['Class Related'], 'Class Related', rowNum);
        if (classRelatedResult.error) {
          errors.push(`Row ${rowNum}: Invalid Class Related value.`);
        } else if (classRelatedResult.normalized) {
          normalized['Class Related'] = classRelatedResult.normalized;
        }
      }
      
      // Last Done Date - optional, no format validation.
      // Excel auto-converts typed dates to serial numbers, so a strict DD-MM-YYYY
      // text check would reject valid dates. The import step normalizes whatever
      // value is provided (Excel serials and mixed date strings), so pass it through.
      {
        if (row['Last Done Date'] !== undefined && row['Last Done Date'] !== null && String(row['Last Done Date']).trim() !== '') {
          normalized['Last Done Date'] = row['Last Done Date'];
        }
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
      
      // Criticality - accepts Yes/No, Y/N, True/False, 1/0 (spec item 12).
      // Supports both template format ('Critical Yes/No') and legacy format ('Criticality').
      {
        const criticalJobField = row['Critical Yes/No'] ?? row['Criticality'];
        const criticalityResult = validateYesNoField(criticalJobField, 'Criticality', rowNum);
        if (criticalityResult.error) {
          errors.push(`Row ${rowNum}: Invalid Criticality value.`);
        } else if (criticalityResult.normalized) {
          normalized['Critical Yes/No'] = criticalityResult.normalized;
          normalized['Criticality'] = criticalityResult.normalized;
        }
      }
      
      // Is Active - accepts Yes/No, Y/N, True/False, 1/0; defaults to Yes when blank (spec item 13)
      {
        const isActiveResult = validateYesNoField(row['Is Active'], 'Is Active', rowNum);
        if (isActiveResult.error) {
          errors.push(`Row ${rowNum}: Invalid Is Active value.`);
        } else if (isActiveResult.normalized) {
          normalized['Is Active'] = isActiveResult.normalized;
        } else {
          normalized['Is Active'] = 'Yes';  // Default to active
        }
      }

      // Copy other fields
      Object.keys(row).forEach(key => {
        if (!normalized[key]) {
          normalized[key] = row[key];
        }
      });

      // Component Name (spec item 4): enforce the master value AFTER the copy loop so any
      // value carried over from the file is overwritten. Null when the component is unknown.
      normalized['Component Name'] = resolvedComponent?.name ?? null;
    } else if (type === 'makers') {
      // Validate makers - matches maker_list database schema (makerCode, makerName, address, isActive)
      
      // Maker Code - required and unique
      const makerCode = row['Maker Code'];
      if (makerCode === undefined || makerCode === null || String(makerCode).trim() === '') {
        errors.push(`Row ${rowNum}: Maker Code is required`);
      } else {
        normalized['Maker Code'] = String(makerCode).trim();
      }
      
      // Maker Name - required
      const makerName = row['Maker Name'];
      if (makerName === undefined || makerName === null || String(makerName).trim() === '') {
        errors.push(`Row ${rowNum}: Maker Name is required`);
      } else {
        normalized['Maker Name'] = String(makerName).trim();
      }
      
      // Address - optional
      if (row['Address'] !== undefined && row['Address'] !== null && String(row['Address']).trim() !== '') {
        normalized['Address'] = String(row['Address']).trim();
      } else {
        normalized['Address'] = null;
      }
      
      // Is Active - optional yes/no (defaults to Yes), case-insensitive parsing
      if (row['Is Active'] !== undefined && row['Is Active'] !== null && String(row['Is Active']).trim() !== '') {
        const value = String(row['Is Active']).toLowerCase().trim();
        if (!['yes', 'no', 'y', 'n', 'true', 'false', '1', '0'].includes(value)) {
          errors.push(`Row ${rowNum}: Is Active must be Yes or No`);
        } else {
          normalized['Is Active'] = ['yes', 'y', 'true', '1'].includes(value);
        }
      } else {
        normalized['Is Active'] = true; // Default to active
      }
    } else if (type === 'fleet-components') {
      // Validate fleet-components - matches fleet_components database schema
      // 13 columns: Parent Fleet Equipment Code, Fleet Equipment Code, Fleet Equipment Name,
      // Component Category, Maker Name, Maker Code, Model, Model Code, Location, Rating,
      // Eqpt / System Department, Notes, IS Active
      
      // Fleet Equipment Code - required and unique
      const fleetEquipmentCode = row['Fleet Equipment Code'];
      if (fleetEquipmentCode === undefined || fleetEquipmentCode === null || String(fleetEquipmentCode).trim() === '') {
        errors.push(`Row ${rowNum}: Fleet Equipment Code is required`);
      } else {
        const codeStr = String(fleetEquipmentCode).trim();
        normalized['Fleet Equipment Code'] = codeStr;
        const codeUpperCase = codeStr.toUpperCase();
        
        // Check for duplicate Fleet Equipment Codes within the uploaded file (case-insensitive)
        // Only flag rows that are NOT the first occurrence - the first occurrence is valid
        const occurrences = fleetEquipmentCodeOccurrences.get(codeUpperCase);
        if (occurrences && occurrences.length > 1) {
          const firstOccurrence = occurrences[0];
          if (rowNum !== firstOccurrence) {
            // This is a duplicate occurrence (not the first one)
            errors.push(`Row ${rowNum}: Duplicate Fleet Equipment Code '${codeStr}' - this code already appears in row ${firstOccurrence}. Each Fleet Equipment Code must be unique.`);
          }
        }
        
        // Check for duplicate Fleet Equipment Codes against existing database records (mode-specific)
        // 'add' mode: existing code = error (cannot create duplicate)
        // 'update' mode: missing code = error (must exist to update)
        // 'upsert' mode: no error (will create or update as needed)
        if (existingDbFleetEquipmentCodes.has(codeUpperCase)) {
          if (mode === 'add') {
            errors.push(`Row ${rowNum}: Fleet Equipment Code '${codeStr}' already exists in database. Use 'Update' or 'Upsert' mode to modify existing records.`);
          }
        } else {
          if (mode === 'update') {
            errors.push(`Row ${rowNum}: Fleet Equipment Code '${codeStr}' does not exist in database. Use 'Add' or 'Upsert' mode to create new records.`);
          }
        }
      }
      
      // Fleet Equipment Name - required
      const fleetEquipmentName = row['Fleet Equipment Name'];
      if (fleetEquipmentName === undefined || fleetEquipmentName === null || String(fleetEquipmentName).trim() === '') {
        errors.push(`Row ${rowNum}: Fleet Equipment Name is required`);
      } else {
        normalized['Fleet Equipment Name'] = String(fleetEquipmentName).trim();
      }
      
      // Parent Fleet Equipment Code - optional
      if (row['Parent Fleet Equipment Code'] !== undefined && row['Parent Fleet Equipment Code'] !== null && String(row['Parent Fleet Equipment Code']).trim() !== '') {
        normalized['Parent Fleet Equipment Code'] = String(row['Parent Fleet Equipment Code']).trim();
      } else {
        normalized['Parent Fleet Equipment Code'] = null;
      }
      
      // Component Category - optional
      if (row['Component Category'] !== undefined && row['Component Category'] !== null && String(row['Component Category']).trim() !== '') {
        normalized['Component Category'] = String(row['Component Category']).trim();
      } else {
        normalized['Component Category'] = null;
      }
      
      // Maker Name - optional
      if (row['Maker Name'] !== undefined && row['Maker Name'] !== null && String(row['Maker Name']).trim() !== '') {
        normalized['Maker Name'] = String(row['Maker Name']).trim();
      } else {
        normalized['Maker Name'] = null;
      }
      
      // Maker Code - optional
      if (row['Maker Code'] !== undefined && row['Maker Code'] !== null && String(row['Maker Code']).trim() !== '') {
        normalized['Maker Code'] = String(row['Maker Code']).trim();
      } else {
        normalized['Maker Code'] = null;
      }
      
      // Model - optional
      if (row['Model'] !== undefined && row['Model'] !== null && String(row['Model']).trim() !== '') {
        normalized['Model'] = String(row['Model']).trim();
      } else {
        normalized['Model'] = null;
      }
      
      // Model Code - optional
      if (row['Model Code'] !== undefined && row['Model Code'] !== null && String(row['Model Code']).trim() !== '') {
        normalized['Model Code'] = String(row['Model Code']).trim();
      } else {
        normalized['Model Code'] = null;
      }
      
      // Location - optional
      if (row['Location'] !== undefined && row['Location'] !== null && String(row['Location']).trim() !== '') {
        normalized['Location'] = String(row['Location']).trim();
      } else {
        normalized['Location'] = null;
      }
      
      // Rating - optional
      if (row['Rating'] !== undefined && row['Rating'] !== null && String(row['Rating']).trim() !== '') {
        normalized['Rating'] = String(row['Rating']).trim();
      } else {
        normalized['Rating'] = null;
      }
      
      // Eqpt / System Department - optional
      if (row['Eqpt / System Department'] !== undefined && row['Eqpt / System Department'] !== null && String(row['Eqpt / System Department']).trim() !== '') {
        normalized['Eqpt / System Department'] = String(row['Eqpt / System Department']).trim();
      } else {
        normalized['Eqpt / System Department'] = null;
      }
      
      // Notes - optional
      if (row['Notes'] !== undefined && row['Notes'] !== null && String(row['Notes']).trim() !== '') {
        normalized['Notes'] = String(row['Notes']).trim();
      } else {
        normalized['Notes'] = null;
      }
      
      // IS Active - optional yes/no (defaults to Yes), case-insensitive parsing
      if (row['IS Active'] !== undefined && row['IS Active'] !== null && String(row['IS Active']).trim() !== '') {
        const value = String(row['IS Active']).toLowerCase().trim();
        if (!['yes', 'no', 'y', 'n', 'true', 'false', '1', '0'].includes(value)) {
          errors.push(`Row ${rowNum}: IS Active must be Yes or No`);
        } else {
          normalized['IS Active'] = ['yes', 'y', 'true', '1'].includes(value);
        }
      } else {
        normalized['IS Active'] = true; // Default to active
      }
    } else if (type === 'fleet-jobs') {
      // Validate fleet-jobs - matches fleet_jobs database schema
      // 21 columns from Fleet Jobs Import Sheet to Table Mapping
      
      // Job Code - required (unique per Fleet Equipment Code, not globally unique)
      const jobCode = row['Job Code'];
      if (jobCode === undefined || jobCode === null || String(jobCode).trim() === '') {
        errors.push(`Row ${rowNum}: Job Code is required`);
      } else {
        const codeStr = String(jobCode).trim();
        normalized['Job Code'] = codeStr;
        const codeUpperCase = codeStr.toUpperCase();
        
        const rawEqCode = row['Fleet Equipment Code'];
        const hasEquipCode = rawEqCode !== undefined && rawEqCode !== null && String(rawEqCode).trim() !== '';
        
        if (hasEquipCode) {
          const fleetEqCodeForCheck = String(rawEqCode).trim().toUpperCase();
          const compositeKey = `${codeUpperCase}|${fleetEqCodeForCheck}`;
          
          const occurrences = fleetJobCompositeOccurrences.get(compositeKey);
          if (occurrences && occurrences.length > 1) {
            const firstOccurrence = occurrences[0];
            if (rowNum !== firstOccurrence) {
              errors.push(`Row ${rowNum}: Duplicate Job Code '${codeStr}' with same Fleet Equipment Code '${String(rawEqCode).trim()}' - this combination already appears in row ${firstOccurrence}.`);
            }
          }
          
          if (existingDbFleetJobCompositeKeys.has(compositeKey)) {
            if (mode === 'add') {
              errors.push(`Row ${rowNum}: Job Code '${codeStr}' with Fleet Equipment Code '${String(rawEqCode).trim()}' already exists in database. Use 'Update' or 'Upsert' mode to modify existing records.`);
            }
          } else {
            if (mode === 'update') {
              errors.push(`Row ${rowNum}: Job Code '${codeStr}' with Fleet Equipment Code '${String(rawEqCode).trim()}' does not exist in database. Use 'Add' or 'Upsert' mode to create new records.`);
            }
          }
        }
      }
      
      // Fleet Equipment Code - required
      const fleetEqCode = row['Fleet Equipment Code'];
      if (fleetEqCode === undefined || fleetEqCode === null || String(fleetEqCode).trim() === '') {
        errors.push(`Row ${rowNum}: Fleet Equipment Code is required`);
      } else {
        normalized['Fleet Equipment Code'] = String(fleetEqCode).trim();
      }
      
      // Fleet Equipment Name - required
      const fleetEqName = row['Fleet Equipment Name'];
      if (fleetEqName === undefined || fleetEqName === null || String(fleetEqName).trim() === '') {
        errors.push(`Row ${rowNum}: Fleet Equipment Name is required`);
      } else {
        normalized['Fleet Equipment Name'] = String(fleetEqName).trim();
      }
      
      // WO Title - required
      const woTitle = row['WO Title'];
      if (woTitle === undefined || woTitle === null || String(woTitle).trim() === '') {
        errors.push(`Row ${rowNum}: WO Title is required`);
      } else {
        normalized['WO Title'] = String(woTitle).trim();
      }
      
      // Task Type - required
      const taskType = row['Task Type'];
      if (taskType === undefined || taskType === null || String(taskType).trim() === '') {
        errors.push(`Row ${rowNum}: Task Type is required`);
      } else {
        normalized['Task Type'] = String(taskType).trim();
      }
      
      // Assigned To - required
      const assignedTo = row['Assigned To'];
      if (assignedTo === undefined || assignedTo === null || String(assignedTo).trim() === '') {
        errors.push(`Row ${rowNum}: Assigned To is required`);
      } else {
        normalized['Assigned To'] = String(assignedTo).trim();
      }
      
      // Approver - required
      const approver = row['Approver'];
      if (approver === undefined || approver === null || String(approver).trim() === '') {
        errors.push(`Row ${rowNum}: Approver is required`);
      } else {
        normalized['Approver'] = String(approver).trim();
      }

      // Reviewer Rank - optional, but if provided must be a known rank
      const reviewerRankVal = row['Reviewer Rank'];
      if (reviewerRankVal !== undefined && reviewerRankVal !== null && String(reviewerRankVal).trim() !== '') {
        const rr = String(reviewerRankVal).trim();
        if (!RESPONSIBLE_RANKS.includes(rr)) {
          errors.push(`Row ${rowNum}: Reviewer '${rr}' not found in the rank list. Allowed values: ${RESPONSIBLE_RANKS.join(', ')}`);
        } else {
          normalized['Reviewer Rank'] = rr;
        }
      }
      
      // Job Priority - required
      const jobPriority = row['Job Priority'];
      if (jobPriority === undefined || jobPriority === null || String(jobPriority).trim() === '') {
        errors.push(`Row ${rowNum}: Job Priority is required`);
      } else {
        normalized['Job Priority'] = String(jobPriority).trim();
      }
      
      // Class Related - required
      const classRelated = row['Class Related'];
      if (classRelated === undefined || classRelated === null || String(classRelated).trim() === '') {
        errors.push(`Row ${rowNum}: Class Related is required`);
      } else {
        const value = String(classRelated).toLowerCase().trim();
        if (!['yes', 'no', 'y', 'n'].includes(value)) {
          errors.push(`Row ${rowNum}: Class Related must be Yes or No`);
        } else {
          normalized['Class Related'] = ['yes', 'y'].includes(value) ? 'Yes' : 'No';
        }
      }
      
      // Brief Work Description - required
      const briefWorkDesc = row['Brief Work Description'];
      if (briefWorkDesc === undefined || briefWorkDesc === null || String(briefWorkDesc).trim() === '') {
        errors.push(`Row ${rowNum}: Brief Work Description is required`);
      } else {
        normalized['Brief Work Description'] = String(briefWorkDesc).trim();
      }
      
      // Department - required
      const department = row['Department'];
      if (department === undefined || department === null || String(department).trim() === '') {
        errors.push(`Row ${rowNum}: Department is required`);
      } else {
        normalized['Department'] = String(department).trim();
      }
      
      // Criticality - required
      const criticality = row['Criticality'];
      if (criticality === undefined || criticality === null || String(criticality).trim() === '') {
        errors.push(`Row ${rowNum}: Criticality is required`);
      } else {
        const value = String(criticality).toLowerCase().trim();
        if (!['yes', 'no', 'y', 'n'].includes(value)) {
          errors.push(`Row ${rowNum}: Criticality must be Yes or No`);
        } else {
          normalized['Criticality'] = ['yes', 'y'].includes(value) ? 'Yes' : 'No';
        }
      }
      
      // Is Active - required (defaults to Yes if not provided)
      if (row['Is Active'] !== undefined && row['Is Active'] !== null && String(row['Is Active']).trim() !== '') {
        const value = String(row['Is Active']).toLowerCase().trim();
        if (!['yes', 'no', 'y', 'n', 'true', 'false', '1', '0'].includes(value)) {
          errors.push(`Row ${rowNum}: Is Active must be Yes or No`);
        } else {
          normalized['Is Active'] = ['yes', 'y', 'true', '1'].includes(value);
        }
      } else {
        normalized['Is Active'] = true;
      }
      
      // Maintenance Basis - optional
      if (row['Maintenance Basis'] !== undefined && row['Maintenance Basis'] !== null && String(row['Maintenance Basis']).trim() !== '') {
        normalized['Maintenance Basis'] = String(row['Maintenance Basis']).trim();
      } else {
        normalized['Maintenance Basis'] = null;
      }
      
      // Interval Value - optional
      if (row['Interval Value'] !== undefined && row['Interval Value'] !== null && String(row['Interval Value']).trim() !== '') {
        normalized['Interval Value'] = String(row['Interval Value']).trim();
      } else {
        normalized['Interval Value'] = null;
      }
      
      // Unit - optional
      if (row['Unit'] !== undefined && row['Unit'] !== null && String(row['Unit']).trim() !== '') {
        normalized['Unit'] = String(row['Unit']).trim();
      } else {
        normalized['Unit'] = null;
      }
      
      // Required Spare Parts - optional
      if (row['Required Spare Parts'] !== undefined && row['Required Spare Parts'] !== null && String(row['Required Spare Parts']).trim() !== '') {
        normalized['Required Spare Parts'] = String(row['Required Spare Parts']).trim();
      } else {
        normalized['Required Spare Parts'] = null;
      }
      
      // Required Tools - optional
      if (row['Required Tools'] !== undefined && row['Required Tools'] !== null && String(row['Required Tools']).trim() !== '') {
        normalized['Required Tools'] = String(row['Required Tools']).trim();
      } else {
        normalized['Required Tools'] = null;
      }
      
      // PPE Requirements - optional
      if (row['PPE Requirements'] !== undefined && row['PPE Requirements'] !== null && String(row['PPE Requirements']).trim() !== '') {
        normalized['PPE Requirements'] = String(row['PPE Requirements']).trim();
      } else {
        normalized['PPE Requirements'] = null;
      }
      
      // Permit Requirements - optional
      if (row['Permit Requirements'] !== undefined && row['Permit Requirements'] !== null && String(row['Permit Requirements']).trim() !== '') {
        normalized['Permit Requirements'] = String(row['Permit Requirements']).trim();
      } else {
        normalized['Permit Requirements'] = null;
      }
      
      // Other Safety Requirements - optional
      if (row['Other Safety Requirements'] !== undefined && row['Other Safety Requirements'] !== null && String(row['Other Safety Requirements']).trim() !== '') {
        normalized['Other Safety Requirements'] = String(row['Other Safety Requirements']).trim();
      } else {
        normalized['Other Safety Requirements'] = null;
      }
    } else if (type === 'fleet-spares') {
      // Validate fleet-spares - matches fleet_spares database schema
      // 18 columns from Fleet Spares Import Template
      
      // Part Code - required (unique per Fleet Equipment Code, not globally unique)
      const partCode = row['Part Code'];
      if (partCode === undefined || partCode === null || String(partCode).trim() === '') {
        errors.push(`Row ${rowNum}: Part Code is required`);
      } else {
        const codeStr = String(partCode).trim();
        normalized['Part Code'] = codeStr;
        const codeUpperCase = codeStr.toUpperCase();
        
        const rawEqCode = row['Fleet Equipment Code'];
        const hasEquipCode = rawEqCode !== undefined && rawEqCode !== null && String(rawEqCode).trim() !== '';
        
        if (hasEquipCode) {
          const fleetEqCodeForCheck = String(rawEqCode).trim().toUpperCase();
          const compositeKey = `${codeUpperCase}|${fleetEqCodeForCheck}`;
          
          const occurrences = fleetSpareCompositeOccurrences.get(compositeKey);
          if (occurrences && occurrences.length > 1) {
            const firstOccurrence = occurrences[0];
            if (rowNum !== firstOccurrence) {
              errors.push(`Row ${rowNum}: Duplicate Part Code '${codeStr}' with same Fleet Equipment Code '${String(rawEqCode).trim()}' - this combination already appears in row ${firstOccurrence}.`);
            }
          }
          
          if (existingDbFleetSpareCompositeKeys.has(compositeKey)) {
            if (mode === 'add') {
              errors.push(`Row ${rowNum}: Part Code '${codeStr}' with Fleet Equipment Code '${String(rawEqCode).trim()}' already exists in database. Use 'Update' or 'Upsert' mode to modify existing records.`);
            }
          } else {
            if (mode === 'update') {
              errors.push(`Row ${rowNum}: Part Code '${codeStr}' with Fleet Equipment Code '${String(rawEqCode).trim()}' does not exist in database. Use 'Add' or 'Upsert' mode to create new records.`);
            }
          }
        }
      }
      
      // Fleet Equipment Code - required
      const fleetEqCode = row['Fleet Equipment Code'];
      if (fleetEqCode === undefined || fleetEqCode === null || String(fleetEqCode).trim() === '') {
        errors.push(`Row ${rowNum}: Fleet Equipment Code is required`);
      } else {
        normalized['Fleet Equipment Code'] = String(fleetEqCode).trim();
      }
      
      // Fleet Equipment Name - required
      const fleetEqName = row['Fleet Equipment Name'];
      if (fleetEqName === undefined || fleetEqName === null || String(fleetEqName).trim() === '') {
        errors.push(`Row ${rowNum}: Fleet Equipment Name is required`);
      } else {
        normalized['Fleet Equipment Name'] = String(fleetEqName).trim();
      }
      
      // Part Name - required
      const partName = row['Part Name'];
      if (partName === undefined || partName === null || String(partName).trim() === '') {
        errors.push(`Row ${rowNum}: Part Name is required`);
      } else {
        normalized['Part Name'] = String(partName).trim();
      }
      
      // Unit Of Measurement - required
      const uom = row['Unit Of Measurement'];
      if (uom === undefined || uom === null || String(uom).trim() === '') {
        errors.push(`Row ${rowNum}: Unit Of Measurement is required`);
      } else {
        normalized['Unit Of Measurement'] = String(uom).trim().toUpperCase();
      }
      
      // Is Active - required
      {
        const { error, normalized: normActive } = validateYesNoField(row['Is Active'], 'Is Active', rowNum, { required: true });
        if (error) {
          errors.push(error);
        } else if (normActive !== undefined) {
          normalized['Is Active'] = normActive;
        }
      }
      
      // Optional fields - normalize if present
      if (row['Part Number']) normalized['Part Number'] = String(row['Part Number']).trim();
      if (row['Drawing Number']) normalized['Drawing Number'] = String(row['Drawing Number']).trim();
      if (row['Position Number']) normalized['Position Number'] = String(row['Position Number']).trim();
      if (row['Note']) normalized['Note'] = String(row['Note']).trim();
      if (row['Specification']) normalized['Specification'] = String(row['Specification']).trim();
      if (row['Maker']) normalized['Maker'] = String(row['Maker']).trim();
      if (row['Maker Code']) normalized['Maker Code'] = String(row['Maker Code']).trim();
      if (row['Manual Name']) normalized['Manual Name'] = String(row['Manual Name']).trim();
      if (row['Page Number']) normalized['Page Number'] = String(row['Page Number']).trim();
      {
        const { error, normalized: normCritical } = validateYesNoField(row['Criticality'], 'Criticality', rowNum);
        if (error) {
          errors.push(error);
        } else if (normCritical !== undefined) {
          normalized['Criticality'] = normCritical;
        }
      }
      if (row['IHM (Inventory of Hazardous Materials)']) normalized['IHM (Inventory of Hazardous Materials)'] = String(row['IHM (Inventory of Hazardous Materials)']).trim();
      if (row['Evidence Type']) normalized['Evidence Type'] = String(row['Evidence Type']).trim();

      if (makerListLoaded) {
        const rowMakerCode = normalized['Maker Code'] || null;
        const rowMakerName = normalized['Maker'] || null;
        errors.push(...validateMakerReference(rowMakerCode, rowMakerName, existingMakersByCode, rowNum));
      }
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

    if (!normalized['__meta']) {
      normalized['__meta'] = {};
    }
    normalized['__meta'].rowNumber = rowNum;

    results.rows.push({
      row: rowNum,
      status,
      errors: [...errors, ...warnings],
      normalized
    });
  }

  return results;
}
