import { storage } from '../../../storage';
import { v4 as uuidv4 } from 'uuid';
import { getSFIName } from '../../../utils/sfiLookup';
import { calculateNextDueDate, normalizeDateToDDMMMYYYY } from '@shared/dateUtils';
import { generatePlannedWorkOrderNumber, generateUnplannedWorkOrderNumber } from '../../../utils/workOrderNumbering';
import {
  getComponentCategory,
  getSubGroupCode,
  getSubGroupName,
  stripSFISuffix,
  getParentSFICode,
  getExplicitParentFromRow,
  UOM_LIST,
  STORES_CATEGORIES,
  DEPARTMENTS,
  RESPONSIBLE_RANKS
} from './helpers';
import { createRecordSnapshot } from './undoService';
import { saveImportHistory } from '../../../services/fileBasedImportHistory';


export async function processSpareInventory(params: {
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

export async function trackChange(
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

export interface RowResult {
  rowNumber: number;
  primaryIdentifier: string;
  action: 'created' | 'updated' | 'skipped' | 'failed';
  error?: string;
}

// Perform actual import
export async function performImport(
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
    archived: 0,
    jobComponentLinksCreated: 0,
    spareComponentLinksCreated: 0,
    rowResults: [] as RowResult[]
  };

  if (type === 'components') {
    console.log(`🚀 Starting component import: ${data.length} rows, mode: ${mode}`);
    
    // Step 1: Prefetch all existing components by codes for performance
    const allCodes = data.map(row => String(row['Component Code'] || row['Generated Code'] || row['Original SFI Code']).trim());
    const existingComponentsMap = await storage.getComponentsByCodes(allCodes, vesselId);
    
    // First, ensure all intermediate parent nodes exist
    // For each component, create parent hierarchy if missing
    // BUT: Skip automatic parent inference if an EXPLICIT Parent Component Code is provided
    // HOWEVER: Still create the explicit parent itself if it's missing from both DB and this upload file
    const parentsToCreate = new Set<string>();
    const explicitParentsNeeded = new Set<string>(); // Track explicit parents that need creation
    const componentCodesInUpload = new Set(data.map(row => 
      String(row['Component Code'] || row['Generated Code'] || row['Original SFI Code']).trim()
    ));
    
    for (const row of data) {
      const componentCode = String(row['Component Code'] || row['Generated Code'] || row['Original SFI Code']).trim();
      
      // Check if user explicitly provided Parent Component Code in the Excel file
      const meta = row['__meta'] || {};
      const explicitParentProvided = meta.explicitParentProvided === true;
      const explicitParentCode = meta.originalExplicitParent;
      
      if (explicitParentProvided && explicitParentCode) {
        // User explicitly provided Parent Component Code in the Excel file
        // Do NOT auto-create intermediate parents from code structure (e.g., don't create 721.801 for 721.801.01)
        // BUT: Still ensure the explicit parent exists - either in DB, in this upload, or needs creation
        const parentInDb = existingComponentsMap.get(explicitParentCode);
        const parentInUpload = componentCodesInUpload.has(explicitParentCode);
        
        if (!parentInDb && !parentInUpload) {
          // Explicit parent is missing from both DB and upload file
          // We need to create it as a placeholder
          explicitParentsNeeded.add(explicitParentCode);
          console.log(`📋 Explicit parent ${explicitParentCode} for ${componentCode} needs creation`);
        }
        
        // Skip the automatic code-based parent inference for this component
        continue;
      }
      
      // No explicit parent provided - use automatic code-based hierarchy inference
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
    
    // Also add any explicit parents that need creation to the set
    // These are parents explicitly referenced by user but not in DB or upload file
    Array.from(explicitParentsNeeded).forEach(explicitParent => {
      if (!existingComponentsMap.get(explicitParent)) {
        parentsToCreate.add(explicitParent);
      }
    });
    
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
        await trackChange(importHistoryId, 'created', 'component', parentComponent.cuuid, null, parentComponent);
      }
    }
    
    // Step 3: Sort components to ensure parents are created before children
    // Priority: 1) Rows that are referenced as explicit parents by other rows
    //           2) Lower hierarchy depth (parents before children based on code structure)
    
    // Build a set of component codes that are referenced as explicit parents
    const explicitParentCodes = new Set<string>();
    for (const row of data) {
      const meta = row['__meta'] || {};
      // Use the stored original explicit parent from metadata (survives all transformations)
      if (meta.explicitParentProvided && meta.originalExplicitParent) {
        explicitParentCodes.add(String(meta.originalExplicitParent).trim());
      }
    }
    
    const sortedData = [...data].sort((a, b) => {
      const aCode = String(a['Component Code'] || a['Generated Code'] || a['Original SFI Code'] || '').trim();
      const bCode = String(b['Component Code'] || b['Generated Code'] || b['Original SFI Code'] || '').trim();
      
      // Prioritize rows whose codes are referenced as explicit parents
      const aIsExplicitParent = explicitParentCodes.has(aCode) ? 0 : 1;
      const bIsExplicitParent = explicitParentCodes.has(bCode) ? 0 : 1;
      
      if (aIsExplicitParent !== bIsExplicitParent) {
        return aIsExplicitParent - bIsExplicitParent; // Explicit parents first
      }
      
      // Then sort by hierarchy depth (lower depth = parents first)
      const aDepth = (aCode.match(/\./g) || []).length;
      const bDepth = (bCode.match(/\./g) || []).length;
      return aDepth - bDepth;
    });

    // Step 4: Process each data row individually with authoritative state capture
    for (const row of sortedData) {
      const componentCode = String(row['Component Code'] || row['Generated Code'] || row['Original SFI Code']).trim();
      const existingComponent = existingComponentsMap.get(componentCode);
      const rowNum = row['__meta']?.rowNumber || 0;

      try {
        if (mode === 'add') {
          if (!existingComponent) {
            const newComponent = await createComponentFromRow(row, vesselId);
            existingComponentsMap.set(componentCode, newComponent);
            result.created++;
            result.rowResults.push({ rowNumber: rowNum, primaryIdentifier: componentCode, action: 'created' });
            
            if (importHistoryId) {
              await trackChange(importHistoryId, 'created', 'component', newComponent.cuuid, null, newComponent);
            }
          } else {
            result.skipped++;
            result.rowResults.push({ rowNumber: rowNum, primaryIdentifier: componentCode, action: 'skipped', error: 'Component already exists' });
          }
        } else if (mode === 'update') {
          if (existingComponent) {
            const previousSnapshot = createRecordSnapshot(existingComponent);
            const updatedComponent = await updateComponentFromRow(componentCode, row, vesselId, existingComponent);
            existingComponentsMap.set(componentCode, updatedComponent);
            result.updated++;
            result.rowResults.push({ rowNumber: rowNum, primaryIdentifier: componentCode, action: 'updated' });
            
            if (importHistoryId) {
              await trackChange(importHistoryId, 'updated', 'component', updatedComponent.cuuid, existingComponent, updatedComponent);
            }
          } else {
            result.skipped++;
            result.rowResults.push({ rowNumber: rowNum, primaryIdentifier: componentCode, action: 'skipped', error: 'Component not found for update' });
          }
        } else if (mode === 'upsert') {
          if (existingComponent && existingComponent.id) {
            console.log(`🔄 Updating existing component: ${componentCode}`);
            const previousSnapshot = createRecordSnapshot(existingComponent);
            const updatedComponent = await updateComponentFromRow(componentCode, row, vesselId, existingComponent);
            existingComponentsMap.set(componentCode, updatedComponent);
            result.updated++;
            result.rowResults.push({ rowNumber: rowNum, primaryIdentifier: componentCode, action: 'updated' });
            
            if (importHistoryId) {
              await trackChange(importHistoryId, 'updated', 'component', updatedComponent.cuuid, existingComponent, updatedComponent);
            }
          } else {
            const newComponent = await createComponentFromRow(row, vesselId);
            existingComponentsMap.set(componentCode, newComponent);
            result.created++;
            result.rowResults.push({ rowNumber: rowNum, primaryIdentifier: componentCode, action: 'created' });
            
            if (importHistoryId) {
              await trackChange(importHistoryId, 'created', 'component', newComponent.cuuid, null, newComponent);
            }
          }
        }
      } catch (rowError: any) {
        console.error(`Error processing component row ${componentCode}:`, rowError.message);
        result.skipped++;
        result.rowResults.push({ rowNumber: rowNum, primaryIdentifier: componentCode, action: 'failed', error: rowError.message });
      }
    }
    
    // Step 5: Archive missing components if requested
    if (archiveMissing) {
      const importedCodes = new Set(data.map(row => String(row['Component Code'] || row['Generated Code'] || row['Original SFI Code']).trim()));
      const allVesselComponents = await storage.getComponents(vesselId || 'V001');
      
      for (const component of allVesselComponents) {
        if (component.componentCode && !importedCodes.has(component.componentCode) && component.isActive !== false) {
          const previousSnapshot = createRecordSnapshot(component);
          const archivedComponent = await storage.archiveComponent(component.cuuid);
          result.archived++;
          
          // Track component archive with authoritative before/after snapshots
          if (importHistoryId) {
            await trackChange(importHistoryId, 'archived', 'component', component.cuuid, component, archivedComponent);
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
    for (let _spareIdx = 0; _spareIdx < data.length; _spareIdx++) {
      const row = data[_spareIdx];
      const _spareRowNum = row['__meta']?.rowNumber || (_spareIdx + 1);
      try {
        // Validate Component Code exists
        const componentCode = String(row['Component Code']).trim();
        const component = componentsByCode.get(componentCode);
        
        if (!component) {
          console.warn(`⚠️ Component ${componentCode} not found in system, skipping spare`);
          result.skipped++;
          const _sparePartCode = row['Part Code'] ? String(row['Part Code']).trim() : `row-${_spareRowNum}`;
          result.rowResults.push({ rowNumber: _spareRowNum, primaryIdentifier: _sparePartCode, action: 'skipped', error: `Component ${componentCode} not found` });
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
            // MANY-TO-MANY SUPPORT: Check via spareComponentLinks (source of truth) if spare is already linked to this component
            try {
              const existingLinks = await storage.getSpareComponentLinksBySpare(existingSpare.id);
              const linkAlreadyExists = existingLinks.some(link => link.componentId === component.cuuid);
              
              if (!linkAlreadyExists) {
                await storage.createSpareComponentLink({
                  vesselId: sparesVesselId,
                  spareId: existingSpare.id,
                  componentId: component.cuuid,
                  linkedBy: 'system-bulk-import',
                });
                result.spareComponentLinksCreated++;
                console.log(`🔗 Linked spare ${partCode} to additional component ${componentCode}`);
                
                result.updated++;
                result.rowResults.push({ rowNumber: _spareRowNum, primaryIdentifier: partCode, action: 'updated' });
              } else {
                console.log(`⏭️ Spare ${partCode} already linked to component ${componentCode}, skipping`);
                result.skipped++;
                result.rowResults.push({ rowNumber: _spareRowNum, primaryIdentifier: partCode, action: 'skipped', error: 'Already linked to component' });
              }
            } catch (linkError: any) {
              console.warn(`⚠️ Failed to create spare-component link for ${partCode} -> ${componentCode}: ${linkError.message}`);
              result.skipped++;
              result.rowResults.push({ rowNumber: _spareRowNum, primaryIdentifier: partCode, action: 'failed', error: linkError.message });
            }
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
            componentId: component.cuuid,
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
            fleetEquipmentCode: row['Fleet Equipment Code'] ? String(row['Fleet Equipment Code']).trim() : null,
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
            componentId: component.cuuid,
            locationAName: row['Location A'] ? String(row['Location A']).trim() : null,
            locationBName: row['Location B'] ? String(row['Location B']).trim() : null,
            robLocationA: robLocationAVal,
            robLocationB: robLocationBVal,
            isNewSpare: true,
            userId: 'system-import',
          });
          result.spareComponentLinksCreated++; // Link created by processSpareInventory
          result.rowResults.push({ rowNumber: _spareRowNum, primaryIdentifier: partCode, action: 'created' });
          
          console.log(`✅ Created spare: ${partCode} - ${newSpare.partName}`);
          
        } else if (mode === 'update') {
          if (!existingSpare) {
            console.log(`⏭️ Part Code ${partCode} not found for update, skipping`);
            result.skipped++;
            result.rowResults.push({ rowNumber: _spareRowNum, primaryIdentifier: partCode, action: 'skipped', error: 'Part Code not found for update' });
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
          
          const updatedSpare = await storage.updateSpare(existingSpare.suuid, {
            partName: String(row['Part Name']).trim(),
            componentId: component.cuuid,
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
            remarks: row['Evidence Type'] ? String(row['Evidence Type']).trim() : existingSpare.remarks,
            fleetEquipmentCode: row['Fleet Equipment Code'] ? String(row['Fleet Equipment Code']).trim() : existingSpare.fleetEquipmentCode
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
            componentId: component.cuuid,
            locationAName: row['Location A'] ? String(row['Location A']).trim() : existingSpare.location,
            locationBName: row['Location B'] ? String(row['Location B']).trim() : existingSpare.location2,
            robLocationA: robLocationAUpdate,
            robLocationB: robLocationBUpdate,
            isNewSpare: false,
            userId: 'system-import',
          });
          
          result.rowResults.push({ rowNumber: _spareRowNum, primaryIdentifier: partCode, action: 'updated' });
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
            // MANY-TO-MANY SUPPORT: Check via spareComponentLinks (source of truth) if spare is already linked to this component
            try {
              const existingLinks = await storage.getSpareComponentLinksBySpare(existingSpare.id);
              const linkAlreadyExists = existingLinks.some(link => link.componentId === component.cuuid);
              
              if (!linkAlreadyExists) {
                // Create new link for this component
                await storage.createSpareComponentLink({
                  vesselId: sparesVesselId,
                  spareId: existingSpare.id,
                  componentId: component.cuuid,
                  linkedBy: 'system-bulk-import',
                });
                result.spareComponentLinksCreated++;
                console.log(`🔗 Linked spare ${partCode} to additional component ${componentCode} (upsert mode)`);
              }
              
              // Always update the spare with latest data (upsert behavior)
              // Same component - update existing spare
              const updatedSpare = await storage.updateSpare(existingSpare.suuid, {
                partName: String(row['Part Name']).trim(),
                componentId: component.cuuid,
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
                remarks: row['Evidence Type'] ? String(row['Evidence Type']).trim() : existingSpare.remarks,
                fleetEquipmentCode: row['Fleet Equipment Code'] ? String(row['Fleet Equipment Code']).trim() : existingSpare.fleetEquipmentCode
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
                componentId: component.cuuid,
                locationAName: row['Location A'] ? String(row['Location A']).trim() : existingSpare.location,
                locationBName: row['Location B'] ? String(row['Location B']).trim() : existingSpare.location2,
                robLocationA: row['Location A - ROB'] !== undefined ? robLocationAUpsert : existingSpare.robLocationA,
                robLocationB: row['Location B - ROB'] !== undefined ? robLocationBUpsert : existingSpare.robLocationB,
                isNewSpare: false,
                userId: 'system-import',
              });
              
              result.rowResults.push({ rowNumber: _spareRowNum, primaryIdentifier: partCode, action: 'updated' });
              console.log(`🔄 Updated spare (upsert): ${partCode} - ${updatedSpare.partName}`);
            } catch (linkError: any) {
              console.warn(`⚠️ Failed to process spare-component link for ${partCode} -> ${componentCode}: ${linkError.message}`);
              result.skipped++;
              result.rowResults.push({ rowNumber: _spareRowNum, primaryIdentifier: partCode, action: 'failed', error: linkError.message });
            }
          } else {
            // Create new - use criticalValUpsert from parent scope
            const newSpare = await storage.createSpare({
              partCode: partCode,
              partName: String(row['Part Name']).trim(),
              componentId: component.cuuid,
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
              fleetEquipmentCode: row['Fleet Equipment Code'] ? String(row['Fleet Equipment Code']).trim() : null,
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
              componentId: component.cuuid,
              locationAName: row['Location A'] ? String(row['Location A']).trim() : null,
              locationBName: row['Location B'] ? String(row['Location B']).trim() : null,
              robLocationA: robLocationAUpsert,
              robLocationB: robLocationBUpsert,
              isNewSpare: true,
              userId: 'system-import',
            });
            result.spareComponentLinksCreated++; // Link created by processSpareInventory
            result.rowResults.push({ rowNumber: _spareRowNum, primaryIdentifier: partCode, action: 'created' });
            
            console.log(`✅ Created spare (upsert): ${partCode} - ${newSpare.partName}`);
          }
        }
      } catch (error: any) {
        console.error(`❌ Error processing spare row:`, error);
        result.skipped++;
        const _errPartCode = row['Part Code'] ? String(row['Part Code']).trim() : `row-${_spareRowNum}`;
        result.rowResults.push({ rowNumber: _spareRowNum, primaryIdentifier: _errPartCode, action: 'failed', error: error.message });
      }
    }
    
    console.log(`✅ Spares import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.spareComponentLinksCreated} spare-component links created`);
  } else if (type === 'stores') {
    console.log(`🚀 Starting stores import: ${data.length} rows, mode: ${mode}, vesselId: ${vesselId}, storeType: ${storeType}`);
    
    // Fetch existing stores items for this vessel
    const existingStoresItems = await storage.getStoresItems(vesselId || '');
    const storesByItemCode = new Map(existingStoresItems.map(s => [s.itemCode, s]));
    
    // Use the storeType passed from frontend - this determines which tab the data goes to
    // Valid values: 'stores', 'lubricants', 'chemicals', 'others'
    const itemType = storeType || 'stores';
    console.log(`📌 All imported items will be assigned to itemType: ${itemType}`);
    
    for (let _storeIdx = 0; _storeIdx < data.length; _storeIdx++) {
      const row = data[_storeIdx];
      const _storeRowNum = row['__meta']?.rowNumber || (_storeIdx + 1);
      try {
        const itemCode = String(row['Item Code'] || '').trim();
        if (!itemCode) {
          console.log('⏭️ Skipping row with empty Item Code');
          result.skipped++;
          result.rowResults.push({ rowNumber: _storeRowNum, primaryIdentifier: `row-${_storeRowNum}`, action: 'skipped', error: 'Empty Item Code' });
          continue;
        }
        
        const itemName = String(row['Item Name'] || '').trim();
        if (!itemName) {
          console.log(`⏭️ Skipping row ${itemCode} with empty Item Name`);
          result.skipped++;
          result.rowResults.push({ rowNumber: _storeRowNum, primaryIdentifier: itemCode, action: 'skipped', error: 'Empty Item Name' });
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
            result.rowResults.push({ rowNumber: _storeRowNum, primaryIdentifier: itemCode, action: 'skipped', error: 'Item already exists' });
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
            await trackChange(importHistoryId, 'created', 'storesItem', newStoresItem.stuuid, null, newStoresItem);
          }

          result.rowResults.push({ rowNumber: _storeRowNum, primaryIdentifier: itemCode, action: 'created' });
          console.log(`✅ Created stores item: ${itemCode} - ${itemName}`);
        } else if (mode === 'update') {
          if (!existingItem) {
            result.skipped++;
            result.rowResults.push({ rowNumber: _storeRowNum, primaryIdentifier: itemCode, action: 'skipped', error: 'Item not found for update' });
            continue;
          }
          
          const previousSnapshot = createRecordSnapshot(existingItem);
          
          const updated = await storage.updateStoresItem(existingItem.stuuid, {
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
            await trackChange(importHistoryId, 'updated', 'storesItem', existingItem.stuuid, previousSnapshot, updated);
          }

          result.rowResults.push({ rowNumber: _storeRowNum, primaryIdentifier: itemCode, action: 'updated' });
          console.log(`✅ Updated stores item: ${itemCode}`);
        } else {
          // Upsert mode
          if (existingItem) {
            const previousSnapshot = createRecordSnapshot(existingItem);
            
            const updated = await storage.updateStoresItem(existingItem.stuuid, {
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
              await trackChange(importHistoryId, 'updated', 'storesItem', existingItem.stuuid, previousSnapshot, updated);
            }

            result.rowResults.push({ rowNumber: _storeRowNum, primaryIdentifier: itemCode, action: 'updated' });
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
              await trackChange(importHistoryId, 'created', 'storesItem', newStoresItem.stuuid, null, newStoresItem);
            }

            result.rowResults.push({ rowNumber: _storeRowNum, primaryIdentifier: itemCode, action: 'created' });
            console.log(`✅ Created stores item (upsert): ${itemCode} - ${itemName}`);
          }
        }
      } catch (error: any) {
        console.error(`❌ Error processing stores item row:`, error);
        result.skipped++;
        const _errItemCode = String(row['Item Code'] || '').trim() || `row-${_storeRowNum}`;
        result.rowResults.push({ rowNumber: _storeRowNum, primaryIdentifier: _errItemCode, action: 'failed', error: error.message });
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
    for (let _woIdx = 0; _woIdx < data.length; _woIdx++) {
      const row = data[_woIdx];
      const _woRowNum = row['__meta']?.rowNumber || (_woIdx + 1);
      const componentCode = String(row['Generated_Component_Code']).trim();
      const componentYearKey = `${componentCode}-${currentYear}`;
      
      const sequence = woSequenceMap.get(componentYearKey)!;
      const templateCode = `WO-${componentCode}-${currentYear}-${String(sequence).padStart(2, '0')}`;
      
      const existingWorkOrder = workOrdersByTemplateCode.get(templateCode);

      try {
        if (mode === 'add') {
          if (!existingWorkOrder) {
            const newWorkOrder = await createWorkOrderFromRow(row, templateCode, vesselId);
            workOrdersByTemplateCode.set(templateCode, newWorkOrder);
            result.created++;
            result.rowResults.push({ rowNumber: _woRowNum, primaryIdentifier: templateCode, action: 'created' });
            woSequenceMap.set(componentYearKey, sequence + 1);
            
            if (importHistoryId) {
              await trackChange(importHistoryId, 'created', 'workOrder', newWorkOrder.id, null, newWorkOrder);
            }
          } else {
            result.skipped++;
            result.rowResults.push({ rowNumber: _woRowNum, primaryIdentifier: templateCode, action: 'skipped', error: 'Work order already exists' });
          }
        } else if (mode === 'update') {
          if (existingWorkOrder) {
            const previousSnapshot = createRecordSnapshot(existingWorkOrder);
            const updatedWorkOrder = await updateWorkOrderFromRow(existingWorkOrder.id, row);
            workOrdersByTemplateCode.set(templateCode, updatedWorkOrder);
            result.updated++;
            result.rowResults.push({ rowNumber: _woRowNum, primaryIdentifier: templateCode, action: 'updated' });
            
            if (importHistoryId) {
              await trackChange(importHistoryId, 'updated', 'workOrder', updatedWorkOrder.id, existingWorkOrder, updatedWorkOrder);
            }
          } else {
            result.skipped++;
            result.rowResults.push({ rowNumber: _woRowNum, primaryIdentifier: templateCode, action: 'skipped', error: 'Work order not found for update' });
          }
        } else if (mode === 'upsert') {
          if (existingWorkOrder) {
            const previousSnapshot = createRecordSnapshot(existingWorkOrder);
            const updatedWorkOrder = await updateWorkOrderFromRow(existingWorkOrder.id, row);
            workOrdersByTemplateCode.set(templateCode, updatedWorkOrder);
            result.updated++;
            result.rowResults.push({ rowNumber: _woRowNum, primaryIdentifier: templateCode, action: 'updated' });
            
            if (importHistoryId) {
              await trackChange(importHistoryId, 'updated', 'workOrder', updatedWorkOrder.id, existingWorkOrder, updatedWorkOrder);
            }
          } else {
            const newWorkOrder = await createWorkOrderFromRow(row, templateCode, vesselId);
            workOrdersByTemplateCode.set(templateCode, newWorkOrder);
            result.created++;
            result.rowResults.push({ rowNumber: _woRowNum, primaryIdentifier: templateCode, action: 'created' });
            woSequenceMap.set(componentYearKey, sequence + 1);
            
            if (importHistoryId) {
              await trackChange(importHistoryId, 'created', 'workOrder', newWorkOrder.id, null, newWorkOrder);
            }
          }
        }
      } catch (woError: any) {
        console.error(`Error processing work order row ${templateCode}:`, woError.message);
        result.skipped++;
        result.rowResults.push({ rowNumber: _woRowNum, primaryIdentifier: templateCode, action: 'failed', error: woError.message });
      }
    }
    
    // Step 3: Archive missing work orders if requested
    if (archiveMissing) {
      const importedTemplateCodes = new Set(allTemplateCodes);
      
      for (const workOrder of allWorkOrders) {
        if (workOrder.templateCode && !importedTemplateCodes.has(workOrder.templateCode)) {
          const previousSnapshot = createRecordSnapshot(workOrder);
          const archivedWorkOrder = await storage.archiveWorkOrder(workOrder.wouuid);
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
    
    // FIX: Job uniqueness is determined by composite key: vesselId + componentCode + jobNo
    // This allows the same jobNo to exist for different components within the same vessel
    // Helper function to generate composite unique key
    const getJobUniqueKey = (vesselIdVal: string, componentCodeVal: string, jobNoVal: string): string => {
      return `${vesselIdVal}::${componentCodeVal}::${jobNoVal}`;
    };
    
    // Step 1: Prefetch all existing jobs for this vessel to build composite key map
    // NOTE: We fetch all jobs for the vessel rather than filtering by jobNo alone,
    // because the same jobNo can exist across different components
    const allExistingJobs = await storage.getJobs(vesselId);
    const jobsByCompositeKey = new Map<string, any>();
    for (const job of allExistingJobs) {
      if (job.jobNo && job.componentCode) {
        const key = getJobUniqueKey(job.vesselId || vesselId || '', job.componentCode, job.jobNo);
        jobsByCompositeKey.set(key, job);
      }
    }
    console.log(`📦 Prefetched ${allExistingJobs.length} existing jobs for composite key matching`);
    
    // Step 1.5: Prefetch all existing components by codes for performance
    const allComponentCodes = data.map(row => String(row['Component Code']).trim());
    const componentsByCode = await storage.getComponentsByCodes(allComponentCodes, vesselId);
    
    // Step 1.6: Prefetch all spares for this vessel to enable spare part linking
    // This allows parsing "PartCode:Quantity" format and looking up actual spare details
    const allSpares = vesselId ? await storage.getSpares(vesselId) : [];
    const sparesByPartCode = new Map(allSpares.map(s => [s.partCode, s]));
    console.log(`📦 Prefetched ${allSpares.length} spares for spare part linking`);
    
    // Step 2: Process each row individually with authoritative state capture
    for (let _jobIdx = 0; _jobIdx < data.length; _jobIdx++) {
      const row = data[_jobIdx];
      const _jobRowNum = row['__meta']?.rowNumber || (_jobIdx + 1);
      const componentCode = String(row['Component Code']).trim();
      const vesselCodeFromExcel = String(row['Vessel Code']).trim();
      
      // Resolve actual component from prefetched map
      const component = componentsByCode.get(componentCode);
      if (!component) {
        console.error(`⚠️ Component not found: ${componentCode}, skipping job`);
        result.skipped++;
        const _jobCode = row['Job Code'] ? String(row['Job Code']).trim() : `row-${_jobRowNum}`;
        result.rowResults.push({ rowNumber: _jobRowNum, primaryIdentifier: _jobCode, action: 'skipped', error: `Component ${componentCode} not found` });
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
          const _jobCode2 = row['Job Code'] ? String(row['Job Code']).trim() : `row-${_jobRowNum}`;
          result.rowResults.push({ rowNumber: _jobRowNum, primaryIdentifier: _jobCode2, action: 'skipped', error: 'Invalid or missing Interval Running Hours (must be > 0)' });
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
          const _jobCode3 = row['Job Code'] ? String(row['Job Code']).trim() : `row-${_jobRowNum}`;
          result.rowResults.push({ rowNumber: _jobRowNum, primaryIdentifier: _jobCode3, action: 'skipped', error: 'lastDoneRH is not a valid number' });
          console.warn(`⚠️ Skipping RH job for component ${componentCode}: lastDoneRH is not a valid number`);
          continue;
        }
        
        // Calculate nextDueRH = lastDoneRH + interval (guaranteed to succeed)
        nextDueRH = String(lastRH + intervalRH);
      }
      
      // Parse spare parts, tools, and safety requirements from Excel
      // Supports both comma-separated and semicolon-separated formats
      // Returns string array for safety requirements
      const parseStringList = (value: any): string[] => {
        if (!value) return [];
        const str = String(value).trim();
        if (!str) return [];
        // Support both comma and semicolon separators
        // If semicolon is present, use it as primary separator (for backwards compatibility)
        // Otherwise fall back to comma separator
        const separator = str.includes(';') ? ';' : ',';
        return str.split(separator).map(s => s.trim()).filter(s => s.length > 0);
      };
      
      // Parse spare parts from comma or semicolon-separated string into structured objects
      // FORMAT: "PartCode1:Quantity1, PartCode2:Quantity2" or "PartCode1:Quantity1; PartCode2:Quantity2"
      // Example: "PC-001:2, PC-002:1, PC-003:4" => looks up spare by partCode and fills in details
      // Falls back to old format if no colon present: "Part Name 1, Part Name 2" => [{partCode: '', partNo: '', description: 'Part Name 1', ...}]
      const parseSpareParts = (value: any): Array<{partCode: string, partNo: string, description: string, quantityRequired: string, remarks: string}> => {
        const items = parseStringList(value);
        const result: Array<{partCode: string, partNo: string, description: string, quantityRequired: string, remarks: string}> = [];
        
        for (const item of items) {
          // Check if item contains colon (new format: PartCode:Quantity)
          if (item.includes(':')) {
            const [partCode, quantityStr] = item.split(':').map(s => s.trim());
            const quantity = parseInt(quantityStr) || 1;
            
            // Look up spare by partCode from prefetched map
            const spare = sparesByPartCode.get(partCode);
            if (spare) {
              result.push({
                partCode: partCode, // Store Part Code as the primary reference key for ROB lookup
                partNo: spare.partNumber || '', // Part Number is optional, for display only
                description: spare.partName || '',
                quantityRequired: String(quantity),
                remarks: ''
              });
              console.log(`✅ Linked spare: ${partCode} (${spare.partName}) x${quantity}`);
            } else {
              // Spare not found - still add entry but mark as not found
              result.push({
                partCode: partCode, // Still store the partCode for potential future matching
                partNo: '',
                description: `[NOT FOUND: ${partCode}]`,
                quantityRequired: String(quantity),
                remarks: `PartCode not found in spares database`
              });
              console.warn(`⚠️ Spare not found for PartCode: ${partCode}`);
            }
          } else {
            // Old format: just a description string (no partCode available)
            result.push({
              partCode: '',
              partNo: '',
              description: item,
              quantityRequired: '',
              remarks: ''
            });
          }
        }
        
        return result;
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
      
      // MANY-TO-MANY: Separate component fields from job master data
      // Component association is now handled via jobComponentLinks table, NOT the job record
      const componentFields = {
        componentId: component.cuuid,          // DEPRECATED: FK reference to component (UUID)
        componentCode: componentCode,       // DEPRECATED: Display/tracking field (SFI code)
        componentName: row['Component Name'] || component.name || null, // DEPRECATED
      };
      
      const jobData: any = {
        vesselId: canonicalVesselId,        // FK reference to vessel
        vesselCode: vesselCodeFromExcel,    // Display/tracking field from Excel
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
      
      // Auto-generate job number if not provided (format: MKR-XX-NNNNN)
      if (!row['Job Code']) {
        const { generateJobNumber } = await import('../../../utils/workOrderNumbering');
        jobData.jobNo = await generateJobNumber(storage, jobData.taskType);
      } else {
        jobData.jobNo = String(row['Job Code']).trim();
      }
      
      // FIX: Check if job already exists using composite key (vesselId + componentCode + jobNo)
      // This allows the same jobNo to exist for different components
      const compositeKey = getJobUniqueKey(canonicalVesselId, componentCode, jobData.jobNo);
      const existingJob = jobsByCompositeKey.get(compositeKey);
      
      if (mode === 'add') {
        if (!existingJob) {
          const newJobData = { ...jobData, ...componentFields };
          const createdJob = await storage.createJob(newJobData);
          const newKey = getJobUniqueKey(canonicalVesselId, componentCode, createdJob.jobNo);
          jobsByCompositeKey.set(newKey, createdJob);
          result.created++;
          result.rowResults.push({ rowNumber: _jobRowNum, primaryIdentifier: jobData.jobNo, action: 'created' });
          
          try {
            await storage.createJobComponentLink({
              vesselId: canonicalVesselId,
              jobId: createdJob.id,
              componentId: component.cuuid,
              componentCode: componentCode,
              linkedBy: 'system-bulk-import',
            });
            result.jobComponentLinksCreated++;
            console.log(`🔗 Created job ${createdJob.jobNo} for component ${componentCode}`);
          } catch (linkError: any) {
            console.warn(`⚠️ Job created but failed to create job-component link: ${linkError.message}`);
          }
          
          if (importHistoryId) {
            const canonicalJob = await storage.getJob(createdJob.id);
            await trackChange(importHistoryId, 'created', 'job', createdJob.id, null, canonicalJob);
          }
        } else {
          console.log(`⏭️ Job ${jobData.jobNo} already exists for component ${componentCode}, skipping`);
          result.skipped++;
          result.rowResults.push({ rowNumber: _jobRowNum, primaryIdentifier: jobData.jobNo, action: 'skipped', error: 'Job already exists for this component' });
        }
      } else if (mode === 'update') {
        if (existingJob) {
          try {
            const existingLinks = await storage.getJobComponentLinksByJob(existingJob.id);
            const linkAlreadyExists = existingLinks.some(link => link.componentId === component.cuuid);
            
            if (!linkAlreadyExists) {
              await storage.createJobComponentLink({
                vesselId: canonicalVesselId,
                jobId: existingJob.id,
                componentId: component.cuuid,
                componentCode: componentCode,
                linkedBy: 'system-bulk-import',
              });
              result.jobComponentLinksCreated++;
              console.log(`🔗 Linked job ${jobData.jobNo} to component ${componentCode} (update mode)`);
            }
          } catch (linkError: any) {
            console.warn(`⚠️ Failed to create job-component link: ${linkError.message}`);
          }
          
          const previousSnapshot = createRecordSnapshot(existingJob);
          const updatedJob = await storage.updateJob(existingJob.id, jobData);
          const updateKey = getJobUniqueKey(canonicalVesselId, componentCode, updatedJob.jobNo);
          jobsByCompositeKey.set(updateKey, updatedJob);
          result.updated++;
          result.rowResults.push({ rowNumber: _jobRowNum, primaryIdentifier: jobData.jobNo, action: 'updated' });
          
          if (importHistoryId) {
            const canonicalJob = await storage.getJob(updatedJob.id);
            await trackChange(importHistoryId, 'updated', 'job', updatedJob.id, existingJob, canonicalJob);
          }
        } else {
          result.skipped++;
          result.rowResults.push({ rowNumber: _jobRowNum, primaryIdentifier: jobData.jobNo, action: 'skipped', error: 'Job not found for update' });
        }
      } else if (mode === 'upsert') {
        if (existingJob) {
          try {
            const existingLinks = await storage.getJobComponentLinksByJob(existingJob.id);
            const linkAlreadyExists = existingLinks.some(link => link.componentId === component.cuuid);
            
            if (!linkAlreadyExists) {
              await storage.createJobComponentLink({
                vesselId: canonicalVesselId,
                jobId: existingJob.id,
                componentId: component.cuuid,
                componentCode: componentCode,
                linkedBy: 'system-bulk-import',
              });
              result.jobComponentLinksCreated++;
              console.log(`🔗 Linked job ${jobData.jobNo} to component ${componentCode} (upsert mode)`);
            }
            
            const previousSnapshot = createRecordSnapshot(existingJob);
            const updatedJob = await storage.updateJob(existingJob.id, jobData);
            const upsertKey = getJobUniqueKey(canonicalVesselId, componentCode, updatedJob.jobNo);
            jobsByCompositeKey.set(upsertKey, updatedJob);
            result.updated++;
            result.rowResults.push({ rowNumber: _jobRowNum, primaryIdentifier: jobData.jobNo, action: 'updated' });
            
            if (importHistoryId) {
              const canonicalJob = await storage.getJob(updatedJob.id);
              await trackChange(importHistoryId, 'updated', 'job', updatedJob.id, existingJob, canonicalJob);
            }
          } catch (linkError: any) {
            console.warn(`⚠️ Failed to process job-component link for ${jobData.jobNo} -> ${componentCode}: ${linkError.message}`);
            result.skipped++;
            result.rowResults.push({ rowNumber: _jobRowNum, primaryIdentifier: jobData.jobNo, action: 'failed', error: linkError.message });
          }
        } else {
          // For NEW jobs (upsert creates): include deprecated component fields for backwards compatibility
          const newJobData = { ...jobData, ...componentFields };
          const createdJob = await storage.createJob(newJobData);
          // FIX: Store in map using composite key
          const newKey = getJobUniqueKey(canonicalVesselId, componentCode, createdJob.jobNo);
          jobsByCompositeKey.set(newKey, createdJob);
          result.created++;
          result.rowResults.push({ rowNumber: _jobRowNum, primaryIdentifier: jobData.jobNo, action: 'created' });
          
          try {
            await storage.createJobComponentLink({
              vesselId: canonicalVesselId,
              jobId: createdJob.id,
              componentId: component.cuuid,
              componentCode: componentCode,
              linkedBy: 'system-bulk-import',
            });
            result.jobComponentLinksCreated++;
            console.log(`🔗 Created job ${createdJob.jobNo} for component ${componentCode}`);
          } catch (linkError: any) {
            console.warn(`⚠️ Job created but failed to create job-component link: ${linkError.message}`);
          }
          
          if (importHistoryId) {
            const canonicalJob = await storage.getJob(createdJob.id);
            await trackChange(importHistoryId, 'created', 'job', createdJob.id, null, canonicalJob);
          }
        }
      }
    }
    
    // Step 3: Archive missing jobs if requested
    // FIX: Archive logic also uses composite key (vesselId + componentCode + jobNo) for consistency
    if (archiveMissing) {
      // Build set of imported composite keys from Excel data
      const importedCompositeKeys = new Set<string>();
      for (const row of data) {
        const rowJobCode = row['Job Code'] ? String(row['Job Code']).trim() : null;
        const rowComponentCode = row['Component Code'] ? String(row['Component Code']).trim() : null;
        if (rowJobCode && rowComponentCode) {
          const key = getJobUniqueKey(vesselId || '', rowComponentCode, rowJobCode);
          importedCompositeKeys.add(key);
        }
      }
      
      const allVesselJobs = await storage.getJobs(vesselId);
      
      for (const job of allVesselJobs) {
        if (job.jobNo && job.componentCode) {
          const jobKey = getJobUniqueKey(job.vesselId || vesselId || '', job.componentCode, job.jobNo);
          if (!importedCompositeKeys.has(jobKey)) {
            const previousSnapshot = createRecordSnapshot(job);
            const archivedJob = await storage.archiveJob(job.juuid);
            result.archived++;
            
            // Track job archive with authoritative before/after snapshots
            if (importHistoryId) {
              await trackChange(importHistoryId, 'archived', 'job', job.juuid, job, archivedJob);
            }
            
            console.log(`📦 Archived job: ${job.jobNo} for component ${job.componentCode}`);
          }
        }
      }
    }
    
    console.log(`✅ Jobs import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.archived} archived, ${result.jobComponentLinksCreated || 0} job-component links created`);
  } else if (type === 'makers') {
    // Import makers to maker_list table
    console.log(`🚀 Starting makers import: ${data.length} rows, mode: ${mode}`);
    
    // Step 1: Prefetch all existing makers for duplicate checking
    const existingMakers = await storage.getMakerList();
    const makersByCode = new Map(existingMakers.map(m => [m.makerCode, m]));
    console.log(`📦 Prefetched ${existingMakers.length} existing makers`);
    
    // Step 2: Process each row - using validated/normalized data from dry-run
    for (let _makerIdx = 0; _makerIdx < data.length; _makerIdx++) {
      const row = data[_makerIdx];
      const _makerRowNum = row['__meta']?.rowNumber || (_makerIdx + 1);
      const makerCode = row['Maker Code'];
      const makerName = row['Maker Name'];
      const address = row['Address'] || null;
      
      let isActive = true;
      if (row['Is Active'] !== undefined && row['Is Active'] !== null) {
        if (typeof row['Is Active'] === 'boolean') {
          isActive = row['Is Active'];
        } else {
          const value = String(row['Is Active']).toLowerCase().trim();
          isActive = ['yes', 'y', 'true', '1'].includes(value);
        }
      }
      
      if (!makerCode || !makerName) {
        console.warn(`⚠️ Skipping row with missing required fields: code=${makerCode}, name=${makerName}`);
        result.skipped++;
        result.rowResults.push({ rowNumber: _makerRowNum, primaryIdentifier: makerCode || `row-${_makerRowNum}`, action: 'skipped', error: 'Missing required fields' });
        continue;
      }
      
      const existingMaker = makersByCode.get(makerCode);
      
      try {
        if (mode === 'add') {
          if (existingMaker) {
            console.log(`⏭️ Skipping existing maker: ${makerCode}`);
            result.skipped++;
            result.rowResults.push({ rowNumber: _makerRowNum, primaryIdentifier: makerCode, action: 'skipped', error: 'Maker already exists' });
          } else {
            const newMaker = await storage.createMakerListItem({ makerCode, makerName, address, isActive });
            makersByCode.set(makerCode, newMaker);
            result.created++;
            result.rowResults.push({ rowNumber: _makerRowNum, primaryIdentifier: makerCode, action: 'created' });
            console.log(`✅ Created maker: ${makerCode} - ${makerName}`);
          }
        } else if (mode === 'update') {
          if (existingMaker) {
            await storage.updateMakerListItem(existingMaker.id, { makerName, address, isActive });
            result.updated++;
            result.rowResults.push({ rowNumber: _makerRowNum, primaryIdentifier: makerCode, action: 'updated' });
            console.log(`🔄 Updated maker: ${makerCode} - ${makerName}`);
          } else {
            console.log(`⏭️ Skipping non-existent maker (update mode): ${makerCode}`);
            result.skipped++;
            result.rowResults.push({ rowNumber: _makerRowNum, primaryIdentifier: makerCode, action: 'skipped', error: 'Maker not found for update' });
          }
        } else if (mode === 'upsert') {
          if (existingMaker) {
            await storage.updateMakerListItem(existingMaker.id, { makerName, address, isActive });
            result.updated++;
            result.rowResults.push({ rowNumber: _makerRowNum, primaryIdentifier: makerCode, action: 'updated' });
            console.log(`🔄 Updated maker: ${makerCode} - ${makerName}`);
          } else {
            const newMaker = await storage.createMakerListItem({ makerCode, makerName, address, isActive });
            makersByCode.set(makerCode, newMaker);
            result.created++;
            result.rowResults.push({ rowNumber: _makerRowNum, primaryIdentifier: makerCode, action: 'created' });
            console.log(`✅ Created maker: ${makerCode} - ${makerName}`);
          }
        }
      } catch (makerError: any) {
        console.error(`Error processing maker row ${makerCode}:`, makerError.message);
        result.skipped++;
        result.rowResults.push({ rowNumber: _makerRowNum, primaryIdentifier: makerCode, action: 'failed', error: makerError.message });
      }
    }
    
    console.log(`✅ Makers import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
  } else if (type === 'fleet-components') {
    // Import fleet components to fleet_components table
    console.log(`🚀 Starting fleet-components import: ${data.length} rows, mode: ${mode}`);
    
    // Step 1: Prefetch all existing fleet components for duplicate checking
    const existingFleetComponents = await storage.getFleetComponents();
    const fleetComponentsByCode = new Map(existingFleetComponents.map(fc => [fc.fleetEquipmentCode, fc]));
    console.log(`📦 Prefetched ${existingFleetComponents.length} existing fleet components`);
    
    // Step 2: Process each row - using validated/normalized data from dry-run
    for (let _fcIdx = 0; _fcIdx < data.length; _fcIdx++) {
      const row = data[_fcIdx];
      const _fcRowNum = row['__meta']?.rowNumber || (_fcIdx + 1);
      const fleetEquipmentCode = row['Fleet Equipment Code'];
      const fleetEquipmentName = row['Fleet Equipment Name'];
      const parentFleetEquipmentCode = row['Parent Fleet Equipment Code'] || null;
      const componentCategory = row['Component Category'] || null;
      const makerName = row['Maker Name'] || null;
      const makerCode = row['Maker Code'] || null;
      const model = row['Model'] || null;
      const modelCode = row['Model Code'] || null;
      const location = row['Location'] || null;
      const rating = row['Rating'] || null;
      const eqptSystemDept = row['Eqpt / System Department'] || null;
      const notes = row['Notes'] || null;
      
      let isActive = true;
      if (row['IS Active'] !== undefined && row['IS Active'] !== null) {
        if (typeof row['IS Active'] === 'boolean') {
          isActive = row['IS Active'];
        } else {
          const value = String(row['IS Active']).toLowerCase().trim();
          isActive = ['yes', 'y', 'true', '1'].includes(value);
        }
      }
      
      if (!fleetEquipmentCode || !fleetEquipmentName) {
        console.warn(`⚠️ Skipping row with missing required fields: code=${fleetEquipmentCode}, name=${fleetEquipmentName}`);
        result.skipped++;
        result.rowResults.push({ rowNumber: _fcRowNum, primaryIdentifier: fleetEquipmentCode || `row-${_fcRowNum}`, action: 'skipped', error: 'Missing required fields' });
        continue;
      }
      
      const existingFleetComponent = fleetComponentsByCode.get(fleetEquipmentCode);
      
      try {
        if (mode === 'add') {
          if (existingFleetComponent) {
            console.log(`⏭️ Skipping existing fleet component: ${fleetEquipmentCode}`);
            result.skipped++;
            result.rowResults.push({ rowNumber: _fcRowNum, primaryIdentifier: fleetEquipmentCode, action: 'skipped', error: 'Fleet component already exists' });
          } else {
            const newFleetComponent = await storage.createFleetComponent({
              fleetEquipmentCode, fleetEquipmentName, parentFleetEquipmentCode, componentCategory,
              makerName, makerCode, model, modelCode, location, rating, eqptSystemDept, notes, isActive
            });
            fleetComponentsByCode.set(fleetEquipmentCode, newFleetComponent);
            result.created++;
            result.rowResults.push({ rowNumber: _fcRowNum, primaryIdentifier: fleetEquipmentCode, action: 'created' });
            console.log(`✅ Created fleet component: ${fleetEquipmentCode} - ${fleetEquipmentName}`);
          }
        } else if (mode === 'update') {
          if (existingFleetComponent) {
            await storage.updateFleetComponent(existingFleetComponent.id, {
              fleetEquipmentName, parentFleetEquipmentCode, componentCategory,
              makerName, makerCode, model, modelCode, location, rating, eqptSystemDept, notes, isActive
            });
            result.updated++;
            result.rowResults.push({ rowNumber: _fcRowNum, primaryIdentifier: fleetEquipmentCode, action: 'updated' });
            console.log(`🔄 Updated fleet component: ${fleetEquipmentCode} - ${fleetEquipmentName}`);
          } else {
            console.log(`⏭️ Skipping non-existent fleet component (update mode): ${fleetEquipmentCode}`);
            result.skipped++;
            result.rowResults.push({ rowNumber: _fcRowNum, primaryIdentifier: fleetEquipmentCode, action: 'skipped', error: 'Fleet component not found for update' });
          }
        } else if (mode === 'upsert') {
          if (existingFleetComponent) {
            await storage.updateFleetComponent(existingFleetComponent.id, {
              fleetEquipmentName, parentFleetEquipmentCode, componentCategory,
              makerName, makerCode, model, modelCode, location, rating, eqptSystemDept, notes, isActive
            });
            result.updated++;
            result.rowResults.push({ rowNumber: _fcRowNum, primaryIdentifier: fleetEquipmentCode, action: 'updated' });
            console.log(`🔄 Updated fleet component: ${fleetEquipmentCode} - ${fleetEquipmentName}`);
          } else {
            const newFleetComponent = await storage.createFleetComponent({
              fleetEquipmentCode, fleetEquipmentName, parentFleetEquipmentCode, componentCategory,
              makerName, makerCode, model, modelCode, location, rating, eqptSystemDept, notes, isActive
            });
            fleetComponentsByCode.set(fleetEquipmentCode, newFleetComponent);
            result.created++;
            result.rowResults.push({ rowNumber: _fcRowNum, primaryIdentifier: fleetEquipmentCode, action: 'created' });
            console.log(`✅ Created fleet component: ${fleetEquipmentCode} - ${fleetEquipmentName}`);
          }
        }
      } catch (fcError: any) {
        console.error(`Error processing fleet component row ${fleetEquipmentCode}:`, fcError.message);
        result.skipped++;
        result.rowResults.push({ rowNumber: _fcRowNum, primaryIdentifier: fleetEquipmentCode, action: 'failed', error: fcError.message });
      }
    }
    
    console.log(`✅ Fleet components import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
  } else if (type === 'fleet-jobs') {
    console.log(`🚀 Starting fleet-jobs import: ${data.length} rows, mode: ${mode}`);
    
    const existingFleetJobs = await storage.getFleetJobs();
    const fleetJobsByCompositeKey = new Map(existingFleetJobs.map((fj: any) => {
      const compositeKey = `${(fj.jobCode || '').toUpperCase()}|${(fj.fleetEquipmentCode || '').toUpperCase()}`;
      return [compositeKey, fj];
    }));
    console.log(`📦 Prefetched ${existingFleetJobs.length} existing fleet jobs (${fleetJobsByCompositeKey.size} unique composite keys)`);
    
    const existingFleetComponents = await storage.getFleetComponents();
    const fleetComponentsByCode = new Map(existingFleetComponents.map((fc: any) => [fc.fleetEquipmentCode, fc]));
    console.log(`📦 Prefetched ${existingFleetComponents.length} fleet components for UUID lookup`);
    
    for (let _fjIdx = 0; _fjIdx < data.length; _fjIdx++) {
      const row = data[_fjIdx];
      const _fjRowNum = row['__meta']?.rowNumber || (_fjIdx + 1);
      const jobCode = row['Job Code'];
      const fleetEquipmentCode = row['Fleet Equipment Code'];
      const fleetEquipmentName = row['Fleet Equipment Name'];
      const woTitle = row['WO Title'];
      const taskType = row['Task Type'];
      const assignedTo = row['Assigned To'];
      const approver = row['Approver'];
      const jobPriority = row['Job Priority'];
      const briefWorkDescription = row['Brief Work Description'];
      const department = row['Department'];
      
      const classRelated = row['Class Related'] || null;
      const criticality = row['Criticality'] || null;
      
      const maintenanceBasis = row['Maintenance Basis'] || null;
      const intervalValue = row['Interval Value'] || null;
      const unit = row['Unit'] || null;
      
      const requiredSpareParts = row['Required Spare Parts'] || null;
      const requiredTools = row['Required Tools'] || null;
      const ppeRequirements = row['PPE Requirements'] || null;
      const permitRequirements = row['Permit Requirements'] || null;
      const otherSafetyRequirements = row['Other Safety Requirements'] || null;
      
      let isActive = true;
      if (row['Is Active'] !== undefined && row['Is Active'] !== null) {
        if (typeof row['Is Active'] === 'boolean') {
          isActive = row['Is Active'];
        } else {
          const value = String(row['Is Active']).toLowerCase().trim();
          isActive = ['yes', 'y', 'true', '1'].includes(value);
        }
      }
      
      if (!jobCode || !fleetEquipmentCode || !fleetEquipmentName || !woTitle || !taskType) {
        console.warn(`⚠️ Skipping row with missing required fields: jobCode=${jobCode}`);
        result.skipped++;
        result.rowResults.push({ rowNumber: _fjRowNum, primaryIdentifier: jobCode || `row-${_fjRowNum}`, action: 'skipped', error: 'Missing required fields' });
        continue;
      }
      
      const matchedComponent = fleetComponentsByCode.get(String(fleetEquipmentCode).trim());
      if (!matchedComponent) {
        console.warn(`⚠️ Skipping fleet job ${jobCode}: Fleet Equipment Code '${fleetEquipmentCode}' not found in fleet_components. Fleet Components must be uploaded first.`);
        result.skipped++;
        result.rowResults.push({ rowNumber: _fjRowNum, primaryIdentifier: jobCode, action: 'skipped', error: `Fleet Equipment Code '${fleetEquipmentCode}' not found` });
        continue;
      }
      
      const fleetComponentsUuid = matchedComponent.fleetComponentsUuid;
      
      const fleetJobData = {
        jobCode,
        fleetComponentsUuid,
        fleetEquipmentCode,
        fleetEquipmentName,
        woTitle,
        maintenanceBasis,
        intervalValue,
        unit,
        taskType,
        assignedTo,
        approver,
        jobPriority,
        classRelated,
        briefWorkDescription,
        department,
        criticality,
        isActive,
        requiredSpareParts: requiredSpareParts ? [requiredSpareParts] : [],
        requiredTools: requiredTools ? [requiredTools] : [],
        ppeRequirements,
        permitRequirements,
        otherSafetyRequirements,
      };
      
      const compositeKey = `${String(jobCode).toUpperCase()}|${String(fleetEquipmentCode).trim().toUpperCase()}`;
      const existingFleetJob = fleetJobsByCompositeKey.get(compositeKey);
      
      try {
        if (mode === 'add') {
          if (existingFleetJob) {
            console.log(`⏭️ Skipping existing fleet job: ${jobCode} (equipment: ${fleetEquipmentCode})`);
            result.skipped++;
            result.rowResults.push({ rowNumber: _fjRowNum, primaryIdentifier: jobCode, action: 'skipped', error: 'Fleet job already exists' });
          } else {
            const newFleetJob = await storage.createFleetJob(fleetJobData);
            fleetJobsByCompositeKey.set(compositeKey, newFleetJob);
            result.created++;
            result.rowResults.push({ rowNumber: _fjRowNum, primaryIdentifier: jobCode, action: 'created' });
            console.log(`✅ Created fleet job: ${jobCode} - ${woTitle} (equipment: ${fleetEquipmentCode}, component: ${fleetComponentsUuid})`);
          }
        } else if (mode === 'update') {
          if (existingFleetJob) {
            await storage.updateFleetJob(existingFleetJob.id, fleetJobData);
            result.updated++;
            result.rowResults.push({ rowNumber: _fjRowNum, primaryIdentifier: jobCode, action: 'updated' });
            console.log(`🔄 Updated fleet job: ${jobCode} - ${woTitle} (equipment: ${fleetEquipmentCode}, component: ${fleetComponentsUuid})`);
          } else {
            console.log(`⏭️ Skipping non-existent fleet job (update mode): ${jobCode} (equipment: ${fleetEquipmentCode})`);
            result.skipped++;
            result.rowResults.push({ rowNumber: _fjRowNum, primaryIdentifier: jobCode, action: 'skipped', error: 'Fleet job not found for update' });
          }
        } else if (mode === 'upsert') {
          if (existingFleetJob) {
            await storage.updateFleetJob(existingFleetJob.id, fleetJobData);
            result.updated++;
            result.rowResults.push({ rowNumber: _fjRowNum, primaryIdentifier: jobCode, action: 'updated' });
            console.log(`🔄 Updated fleet job: ${jobCode} - ${woTitle} (equipment: ${fleetEquipmentCode}, component: ${fleetComponentsUuid})`);
          } else {
            const newFleetJob = await storage.createFleetJob(fleetJobData);
            fleetJobsByCompositeKey.set(compositeKey, newFleetJob);
            result.created++;
            result.rowResults.push({ rowNumber: _fjRowNum, primaryIdentifier: jobCode, action: 'created' });
            console.log(`✅ Created fleet job: ${jobCode} - ${woTitle} (equipment: ${fleetEquipmentCode}, component: ${fleetComponentsUuid})`);
          }
        }
      } catch (fjError: any) {
        console.error(`Error processing fleet job row ${jobCode}:`, fjError.message);
        result.skipped++;
        result.rowResults.push({ rowNumber: _fjRowNum, primaryIdentifier: jobCode, action: 'failed', error: fjError.message });
      }
    }
    
    console.log(`✅ Fleet jobs import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
  } else if (type === 'fleet-spares') {
    console.log(`🚀 Starting fleet-spares import: ${data.length} rows, mode: ${mode}`);
    
    const existingFleetSpares = await storage.getFleetSparesFromTable();
    const fleetSparesByCompositeKey = new Map(existingFleetSpares.map((fs: any) => {
      const compositeKey = `${(fs.partCode || '').toUpperCase()}|${(fs.fleetEquipmentCode || '').toUpperCase()}`;
      return [compositeKey, fs];
    }));
    console.log(`📦 Prefetched ${existingFleetSpares.length} existing fleet spares (${fleetSparesByCompositeKey.size} unique composite keys)`);
    
    const existingFleetComponents = await storage.getFleetComponents();
    const fleetComponentsByCode = new Map(existingFleetComponents.map((fc: any) => [fc.fleetEquipmentCode, fc]));
    console.log(`📦 Prefetched ${existingFleetComponents.length} fleet components for UUID lookup`);
    
    for (let _fsIdx = 0; _fsIdx < data.length; _fsIdx++) {
      const row = data[_fsIdx];
      const _fsRowNum = row['__meta']?.rowNumber || (_fsIdx + 1);
      const partCode = row['Part Code'];
      const fleetEquipmentCode = row['Fleet Equipment Code'];
      const fleetEquipmentName = row['Fleet Equipment Name'];
      const partName = row['Part Name'];
      const unitOfMeasurement = row['Unit Of Measurement'];
      
      const partNumber = row['Part Number'] || null;
      const drawingNumber = row['Drawing Number'] || null;
      const positionNumber = row['Position Number'] || null;
      const note = row['Note'] || null;
      const specification = row['Specification'] || null;
      const maker = row['Maker'] || null;
      const makerCode = row['Maker Code'] || null;
      const manualName = row['Manual Name'] || null;
      const pageNumber = row['Page Number'] || null;
      const criticality = row['Criticality'] || null;
      const ihmVal = row['IHM (Inventory of Hazardous Materials)'] || null;
      const evidenceType = row['Evidence Type'] || null;
      
      let isActive = true;
      if (row['Is Active'] !== undefined && row['Is Active'] !== null) {
        if (typeof row['Is Active'] === 'boolean') {
          isActive = row['Is Active'];
        } else {
          const value = String(row['Is Active']).toLowerCase().trim();
          isActive = ['yes', 'y', 'true', '1'].includes(value);
        }
      }
      
      if (!partCode || !fleetEquipmentCode || !fleetEquipmentName || !partName || !unitOfMeasurement) {
        console.warn(`⚠️ Skipping row with missing required fields: partCode=${partCode}`);
        result.skipped++;
        result.rowResults.push({ rowNumber: _fsRowNum, primaryIdentifier: partCode || `row-${_fsRowNum}`, action: 'skipped', error: 'Missing required fields' });
        continue;
      }
      
      const matchedComponent = fleetComponentsByCode.get(String(fleetEquipmentCode).trim());
      if (!matchedComponent) {
        console.warn(`⚠️ Skipping fleet spare ${partCode}: Fleet Equipment Code '${fleetEquipmentCode}' not found in fleet_components. Fleet Components must be uploaded first.`);
        result.skipped++;
        result.rowResults.push({ rowNumber: _fsRowNum, primaryIdentifier: partCode, action: 'skipped', error: `Fleet Equipment Code '${fleetEquipmentCode}' not found` });
        continue;
      }
      
      const fleetComponentsUuid = matchedComponent.fleetComponentsUuid;
      
      const fleetSpareData = {
        partCode: String(partCode).trim(),
        fleetComponentsUuid,
        fleetEquipmentCode: String(fleetEquipmentCode).trim(),
        fleetEquipmentName: String(fleetEquipmentName).trim(),
        partName: String(partName).trim(),
        partNumber: partNumber ? String(partNumber).trim() : null,
        unitOfMeasurement: String(unitOfMeasurement).trim().toUpperCase(),
        drawingNumber: drawingNumber ? String(drawingNumber).trim() : null,
        positionNumber: positionNumber ? String(positionNumber).trim() : null,
        note: note ? String(note).trim() : null,
        specification: specification ? String(specification).trim() : null,
        maker: maker ? String(maker).trim() : null,
        makerCode: makerCode ? String(makerCode).trim() : null,
        manualName: manualName ? String(manualName).trim() : null,
        pageNumber: pageNumber ? String(pageNumber).trim() : null,
        criticality: criticality ? String(criticality).trim() : null,
        isActive,
        ihm: ihmVal ? String(ihmVal).trim() : null,
        evidenceType: evidenceType ? String(evidenceType).trim() : null,
      };
      
      const compositeKey = `${String(partCode).trim().toUpperCase()}|${String(fleetEquipmentCode).trim().toUpperCase()}`;
      const existingFleetSpare = fleetSparesByCompositeKey.get(compositeKey);
      
      try {
        if (mode === 'add') {
          if (existingFleetSpare) {
            console.log(`⏭️ Skipping existing fleet spare: ${partCode} (equipment: ${fleetEquipmentCode})`);
            result.skipped++;
            result.rowResults.push({ rowNumber: _fsRowNum, primaryIdentifier: partCode, action: 'skipped', error: 'Fleet spare already exists' });
          } else {
            const newFleetSpare = await storage.createFleetSpareInTable(fleetSpareData);
            fleetSparesByCompositeKey.set(compositeKey, newFleetSpare);
            result.created++;
            result.rowResults.push({ rowNumber: _fsRowNum, primaryIdentifier: partCode, action: 'created' });
            console.log(`✅ Created fleet spare: ${partCode} - ${partName} (equipment: ${fleetEquipmentCode}, component: ${fleetComponentsUuid})`);
          }
        } else if (mode === 'update') {
          if (existingFleetSpare) {
            await storage.updateFleetSpareInTable(existingFleetSpare.id, fleetSpareData);
            result.updated++;
            result.rowResults.push({ rowNumber: _fsRowNum, primaryIdentifier: partCode, action: 'updated' });
            console.log(`🔄 Updated fleet spare: ${partCode} - ${partName} (equipment: ${fleetEquipmentCode}, component: ${fleetComponentsUuid})`);
          } else {
            console.log(`⏭️ Skipping non-existent fleet spare (update mode): ${partCode} (equipment: ${fleetEquipmentCode})`);
            result.skipped++;
            result.rowResults.push({ rowNumber: _fsRowNum, primaryIdentifier: partCode, action: 'skipped', error: 'Fleet spare not found for update' });
          }
        } else if (mode === 'upsert') {
          if (existingFleetSpare) {
            await storage.updateFleetSpareInTable(existingFleetSpare.id, fleetSpareData);
            result.updated++;
            result.rowResults.push({ rowNumber: _fsRowNum, primaryIdentifier: partCode, action: 'updated' });
            console.log(`🔄 Updated fleet spare: ${partCode} - ${partName} (equipment: ${fleetEquipmentCode}, component: ${fleetComponentsUuid})`);
          } else {
            const newFleetSpare = await storage.createFleetSpareInTable(fleetSpareData);
            fleetSparesByCompositeKey.set(compositeKey, newFleetSpare);
            result.created++;
            result.rowResults.push({ rowNumber: _fsRowNum, primaryIdentifier: partCode, action: 'created' });
            console.log(`✅ Created fleet spare: ${partCode} - ${partName} (equipment: ${fleetEquipmentCode}, component: ${fleetComponentsUuid})`);
          }
        }
      } catch (fsError: any) {
        console.error(`Error processing fleet spare row ${partCode}:`, fsError.message);
        result.skipped++;
        result.rowResults.push({ rowNumber: _fsRowNum, primaryIdentifier: partCode, action: 'failed', error: fsError.message });
      }
    }
    
    console.log(`✅ Fleet spares import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
  }

  return result;
}

// Helper function to create component from Excel row
export async function createComponentFromRow(row: any, vesselId?: string) {
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
export async function updateComponentFromRow(componentCode: string, row: any, vesselId?: string, existingComponent?: any) {
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
  
  return await storage.updateComponent(component.cuuid, updateData);
}

// Helper function to create work order from Excel row
export async function createWorkOrderFromRow(row: any, templateCode: string, vesselId?: string) {
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
        j.componentId === component.cuuid && 
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
  
  // Generate spec-compliant work order number: <JOB_CODE>-<COMPONENT_CODE>-<YEAR>-<RUNNING NUMBER>
  // Use job code from matched job, or from Excel row, or generate unplanned format
  let workOrderNo: string;
  const jobCode = matchingJob?.jobNo || row['Job_Code'];
  
  if (jobCode) {
    // Planned work order: use job code and component code to generate proper format
    // Validate componentCode before calling generator
    if (!componentCode || !componentCode.trim()) {
      throw new Error(`Component code is required for planned work order generation. Row has Job_Code "${jobCode}" but no component code.`);
    }
    workOrderNo = await generatePlannedWorkOrderNumber(storage, jobCode, componentCode, effectiveVesselId);
  } else {
    // Unplanned work order: use UWO format with componentCode
    if (!componentCode || !componentCode.trim()) {
      throw new Error('Component code is required for unplanned work order generation');
    }
    workOrderNo = await generateUnplannedWorkOrderNumber(storage, effectiveVesselId, componentCode);
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
export async function updateWorkOrderFromRow(workOrderId: string, row: any) {
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

// Store import history - NOW USES FILE-BASED STORAGE
export async function storeImportHistory(data: any) {
  const result = await saveImportHistory({
    id: data.id,
    type: data.type,
    mode: data.mode,
    vesselId: data.vesselId,
    userId: data.userId,
    startedAt: data.startedAt || new Date().toISOString(),
    completedAt: data.finishedAt || new Date().toISOString(),
    status: data.status,
    created: data.created || 0,
    updated: data.updated || 0,
    skipped: data.skipped || 0,
    archived: data.archived || 0,
    originalName: data.originalName,
    storedFilePath: data.storedFilePath || null,
    errorReport: null
  });
  return result;
}
