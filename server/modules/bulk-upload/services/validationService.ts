import { storage } from '../../../storage';
import { getSFIName } from '../../../utils/sfiLookup';
import {
  normalizeColumnNames,
  getComponentCategory,
  getEffectiveComponentCategories,
  getSubGroupCode,
  getSubGroupName,
  stripSFISuffix,
  getParentSFICode,
  validateSFICode,
  getExplicitParentFromRow,
  getExplicitParentFromRowEarly,
  UOM_LIST,
  STORES_CATEGORIES,
  DEPARTMENTS,
  RESPONSIBLE_RANKS,
  SCHEDULE_TYPES,
  INTERVAL_UNITS
} from './helpers';
import { calculateNextDueDate, normalizeDateToDDMMMYYYY } from '@shared/dateUtils';

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
  let existingMakersByName = new Map<string, any>();
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
          });
          console.log(`📋 Loaded ${existingDbComponentCodes.size} existing component codes for vessel '${vesselId}'`);
        } catch (err) {
          console.error(`Failed to fetch existing components for vessel ${vesselId}:`, err);
        }
      }
    }

    try {
      const existingMakers = await storage.getMakerList();
      existingMakersByCode = new Map(existingMakers.map((m: any) => [m.makerCode, m]));
      existingMakersByName = new Map(existingMakers.map((m: any) => [m.makerName.toLowerCase(), m]));
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

      const deptValue = normalized['Equipment / System Department'] || normalized['Eqpt / System Department'];
      // "Null"/"null"/"NULL" is treated as explicit no-department — always valid regardless of case
      const deptIsNullSentinel = deptValue && deptValue.toLowerCase() === 'null';
      if (deptValue && !deptIsNullSentinel && !DEPARTMENTS.includes(deptValue)) {
        errors.push(`Row ${rowNum}: Invalid Equipment / System Department '${deptValue}'. Allowed values are: ${DEPARTMENTS.join(', ')}.`);
      }

      // Validate Maker exists in Maker List (only if maker list was loaded successfully)
      if (makerListLoaded) {
        const rowMakerCode = normalized['Maker Code'] || null;
        const rowMakerName = normalized['Maker'] || normalized['Maker Name'] || null;
        if (rowMakerCode) {
          const trimmedCode = String(rowMakerCode).trim();
          if (!existingMakersByCode.has(trimmedCode)) {
            if (rowMakerName) {
              const nameMatch = existingMakersByName.get(String(rowMakerName).trim().toLowerCase());
              if (nameMatch) {
                normalized['Maker Code'] = nameMatch.makerCode;
              } else {
                errors.push(`Row ${rowNum}: Maker Code '${trimmedCode}' not found in Maker List. Please import makers first.`);
              }
            } else {
              errors.push(`Row ${rowNum}: Maker Code '${trimmedCode}' not found in Maker List. Please import makers first.`);
            }
          }
        } else if (rowMakerName) {
          const trimmedName = String(rowMakerName).trim();
          const nameMatch = existingMakersByName.get(trimmedName.toLowerCase());
          if (nameMatch) {
            normalized['Maker Code'] = nameMatch.makerCode;
          } else {
            errors.push(`Row ${rowNum}: Maker '${trimmedName}' not found in Maker List. Please import makers first.`);
          }
        }
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

      // Validate Rotation Item (optional boolean: blank | Yes/Y/true/1 | No/N/false/0)
      const rotationField = row['Rotation Item'];
      const rawRotation = typeof rotationField === 'boolean'
        ? (rotationField ? 'yes' : 'no')
        : (rotationField === undefined || rotationField === null ? '' : String(rotationField).toLowerCase().trim());
      if (rawRotation !== '') {
        if (!['yes', 'no', 'y', 'n', 'true', 'false', '1', '0'].includes(rawRotation)) {
          errors.push(`Row ${rowNum}: Rotation Item must be Yes or No`);
        } else {
          normalized['Rotation Item'] = ['yes', 'y', 'true', '1'].includes(rawRotation) ? 'Yes' : 'No';
        }
      }

      // Fleet Equipment Code - accept as-is, no master data lookup
      if (row['Fleet Equipment Code']) {
        normalized['Fleet Equipment Code'] = String(row['Fleet Equipment Code']).trim();
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

      if (makerListLoaded) {
        const rowMakerCode = normalized['Maker Code'] || null;
        const rowMakerName = normalized['Maker'] || null;
        if (rowMakerCode) {
          const trimmedCode = String(rowMakerCode).trim();
          if (!existingMakersByCode.has(trimmedCode)) {
            if (rowMakerName) {
              const nameMatch = existingMakersByName.get(String(rowMakerName).trim().toLowerCase());
              if (nameMatch) {
                normalized['Maker Code'] = nameMatch.makerCode;
              } else {
                errors.push(`Row ${rowNum}: Maker Code '${trimmedCode}' not found in Maker List. Please import makers first.`);
              }
            } else {
              errors.push(`Row ${rowNum}: Maker Code '${trimmedCode}' not found in Maker List. Please import makers first.`);
            }
          }
        } else if (rowMakerName) {
          const trimmedName = String(rowMakerName).trim();
          const nameMatch = existingMakersByName.get(trimmedName.toLowerCase());
          if (nameMatch) {
            normalized['Maker Code'] = nameMatch.makerCode;
          } else {
            errors.push(`Row ${rowNum}: Maker '${trimmedName}' does not exist in Maker List. Please import makers first.`);
          }
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
      const validMaintenanceBasis = ['Calendar', 'Running Hours', 'Dual Frequency'];
      if (!row['Maintenance Basis']) {
        errors.push(`Row ${rowNum}: Maintenance Basis is required (must be 'Calendar', 'Running Hours', or 'Dual Frequency')`);
      } else if (!validMaintenanceBasis.includes(row['Maintenance Basis'])) {
        errors.push(`Row ${rowNum}: Invalid Maintenance Basis '${row['Maintenance Basis']}'. Must be 'Calendar', 'Running Hours', or 'Dual Frequency'`);
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
      const isActiveVal = row['Is Active'];
      if (isActiveVal === undefined || isActiveVal === null || String(isActiveVal).trim() === '') {
        errors.push(`Row ${rowNum}: Is Active is required`);
      } else {
        const val = String(isActiveVal).trim().toLowerCase();
        if (!['yes', 'no', 'y', 'n', 'true', 'false', '1', '0'].includes(val)) {
          errors.push(`Row ${rowNum}: Is Active must be Yes/No`);
        } else {
          normalized['Is Active'] = isActiveVal;
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
      if (row['Criticality']) normalized['Criticality'] = String(row['Criticality']).trim();
      if (row['IHM (Inventory of Hazardous Materials)']) normalized['IHM (Inventory of Hazardous Materials)'] = String(row['IHM (Inventory of Hazardous Materials)']).trim();
      if (row['Evidence Type']) normalized['Evidence Type'] = String(row['Evidence Type']).trim();

      if (makerListLoaded) {
        const rowMakerCode = normalized['Maker Code'] || null;
        const rowMakerName = normalized['Maker'] || null;
        if (rowMakerCode) {
          const trimmedCode = String(rowMakerCode).trim();
          if (!existingMakersByCode.has(trimmedCode)) {
            if (rowMakerName) {
              const nameMatch = existingMakersByName.get(String(rowMakerName).trim().toLowerCase());
              if (nameMatch) {
                normalized['Maker Code'] = nameMatch.makerCode;
              } else {
                errors.push(`Row ${rowNum}: Maker Code '${trimmedCode}' not found in Maker List. Please import makers first.`);
              }
            } else {
              errors.push(`Row ${rowNum}: Maker Code '${trimmedCode}' not found in Maker List. Please import makers first.`);
            }
          }
        } else if (rowMakerName) {
          const trimmedName = String(rowMakerName).trim();
          const nameMatch = existingMakersByName.get(trimmedName.toLowerCase());
          if (nameMatch) {
            normalized['Maker Code'] = nameMatch.makerCode;
          } else {
            errors.push(`Row ${rowNum}: Maker '${trimmedName}' does not exist in Maker List. Please import makers first.`);
          }
        }
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
