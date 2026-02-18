/**
 * Single Source of Truth: Vessel_Spare Template Fields
 * 
 * This file defines the canonical 27-column specification for the Spares template.
 * Both frontend (field mappings display) and backend (Excel template generation)
 * MUST use these definitions to ensure consistency.
 * 
 * Column Order: Part Code, (Reserved), Fleet Equipment Code, Fleet Equipment Name, Component Code,
 * Component Name, Part Name, Part Number, UOM, Drawing Number, Position Number, Note,
 * Specification, Maker, Maker Code, Manual Name, Page Number, Criticality, Total ROB,
 * Location A, Location A - ROB, Location B, Location B - ROB, Minimum Stock, Is Active,
 * IHM (Inventory of Hazardous Materials), Evidence Type
 */

export interface SparesTemplateField {
  header: string;
  key: string;
  width: number;
  required: boolean;
  description: string;
}

/**
 * Canonical 27-column Vessel_Spare specification
 * DO NOT modify the order - this matches the exact template specification
 * Note: Column B is reserved/empty to match the standard template format
 */
export const SPARES_TEMPLATE_FIELDS: SparesTemplateField[] = [
  { header: 'Part Code', key: 'partCode', width: 18, required: false, description: 'Auto-generated PT-XXXXXX if not provided' },
  { header: '', key: 'reserved', width: 5, required: false, description: 'Reserved column' },
  { header: 'Fleet Equipment Code', key: 'fleetEquipmentCode', width: 20, required: false, description: 'Links to fleet master equipment' },
  { header: 'Fleet Equipment Name', key: 'fleetEquipmentName', width: 28, required: false, description: 'Fleet equipment reference name' },
  { header: 'Component Code', key: 'componentCode', width: 18, required: true, description: 'Must exist in system' },
  { header: 'Component Name', key: 'componentName', width: 28, required: false, description: 'Auto-filled from component' },
  { header: 'Part Name', key: 'partName', width: 32, required: true, description: 'Spare part description' },
  { header: 'Part Number', key: 'partNumber', width: 18, required: false, description: 'Manufacturer part number' },
  { header: 'UOM', key: 'uom', width: 12, required: false, description: 'Unit of Measurement (PCS, KG, LTR, etc.)' },
  { header: 'Drawing Number', key: 'drawingNumber', width: 18, required: false, description: 'Drawing reference' },
  { header: 'Position Number', key: 'positionNumber', width: 16, required: false, description: 'Assembly position number' },
  { header: 'Note', key: 'note', width: 35, required: false, description: 'Additional notes' },
  { header: 'Specification', key: 'specification', width: 35, required: false, description: 'Technical specifications' },
  { header: 'Maker', key: 'maker', width: 22, required: false, description: 'Manufacturer name' },
  { header: 'Maker Code', key: 'makerCode', width: 15, required: false, description: 'Manufacturer code' },
  { header: 'Manual Name', key: 'manualName', width: 20, required: false, description: 'Reference manual name' },
  { header: 'Page Number', key: 'pageNumber', width: 14, required: false, description: 'Reference page number' },
  { header: 'Criticality', key: 'criticality', width: 14, required: false, description: 'Yes or No - Critical spare flag' },
  { header: 'Total ROB', key: 'totalRob', width: 12, required: false, description: 'Total remaining on board' },
  { header: 'Location A', key: 'locationA', width: 15, required: false, description: 'Primary storage location' },
  { header: 'Location A - ROB', key: 'locationARob', width: 16, required: false, description: 'ROB at Location A' },
  { header: 'Location B', key: 'locationB', width: 15, required: false, description: 'Secondary storage location' },
  { header: 'Location B - ROB', key: 'locationBRob', width: 16, required: false, description: 'ROB at Location B' },
  { header: 'Minimum Stock', key: 'minimumStock', width: 14, required: false, description: 'Minimum stock level' },
  { header: 'Is Active', key: 'isActive', width: 12, required: false, description: 'Yes or No - defaults to Yes' },
  { header: 'IHM (Inventory of Hazardous Materials)', key: 'ihm', width: 35, required: false, description: 'Yes or No' },
  { header: 'Evidence Type', key: 'evidenceType', width: 16, required: false, description: 'Type of evidence/remarks' },
];

/**
 * Helper to get field mappings for frontend display
 * Returns array with field names and descriptions for UI
 * Note: Filters out the reserved empty column
 */
export function getSparesFieldMappings() {
  return SPARES_TEMPLATE_FIELDS
    .filter(f => f.key !== 'reserved')
    .map(f => ({
      field: f.header,
      required: f.required,
      description: f.description,
    }));
}

/**
 * Helper to get Excel column definitions for backend
 * Returns array suitable for ExcelJS columns property
 */
export function getSparesExcelColumns() {
  return SPARES_TEMPLATE_FIELDS.map(f => ({
    header: f.header,
    key: f.key,
    width: f.width,
  }));
}

/**
 * Get headers in exact order for validation
 */
export function getSparesHeaders(): string[] {
  return SPARES_TEMPLATE_FIELDS.map(f => f.header);
}
