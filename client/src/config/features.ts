// Feature flags configuration
export const FEATURES = {
  // IHM (Inventory of Hazardous Materials) feature flag
  // When ON: Shows IHM status chips, management buttons, and reports
  // When OFF: No IHM-related UI elements are displayed
  IHM: import.meta.env.VITE_FEATURE_IHM === 'true' || false,
};

// IHM material options
export const IHM_MATERIALS = [
  'Asbestos',
  'PCB (Polychlorinated Biphenyls)',
  'PFOS (Perfluorooctane Sulfonic Acid)',
  'TBT (Tributyltin)',
  'Lead',
  'Mercury',
  'Cadmium',
  'Hexavalent Chromium',
  'PBB (Polybrominated Biphenyls)',
  'PBDE (Polybrominated Diphenyl Ethers)',
  'Radioactive Materials',
  'ODS (Ozone Depleting Substances)',
] as const;

// IHM presence options
export const IHM_PRESENCE = [
  'Unknown',
  'Present',
  'Not Present',
] as const;

// IHM evidence types
export const IHM_EVIDENCE_TYPES = [
  'MD (Material Declaration)',
  'SDoC (Supplier Declaration of Conformity)',
  'Test (Laboratory Test Report)',
  'None',
] as const;

// IHM maintenance actions
export const IHM_ACTIONS = [
  'Installed',
  'Removed',
  'Replaced',
] as const;