export interface DefectSource {
  id: string;
  name: string;
  category: string;
}

export const defectSources: DefectSource[] = [
  { id: "SIRE_2_0", name: "SIRE 2.0", category: "SIRE Inspections" },
  { id: "SIRE", name: "SIRE", category: "SIRE Inspections" },
  { id: "NON_SIRE", name: "Non-SIRE", category: "SIRE Inspections" },
  { id: "CDI", name: "CDI", category: "External Inspections" },
  { id: "PSC", name: "PSC", category: "External Inspections" },
  { id: "TERMINAL", name: "Terminal", category: "External Inspections" },
  { id: "EXTERNAL_AUDIT_CLASS", name: "External Audit (Class)", category: "External Inspections" },
  { id: "FLAG_STATE_INSPECTION", name: "Flag State Inspection", category: "External Inspections" },
  { id: "RISQ_INSPECTION", name: "RISQ Inspection", category: "External Inspections" },
  { id: "INTERNAL_AUDIT", name: "Internal Audit", category: "Internal Audits" },
  { id: "SUPERINTENDENT_INSPECTION", name: "Superintendent Inspection", category: "Internal Audits" },
  { id: "NAVIGATION_AUDIT", name: "Navigation Audit", category: "Operational Audits" },
  { id: "REAL_TIME_NAVIGATION_AUDIT", name: "Real Time Navigation Audit", category: "Operational Audits" },
  { id: "VDR_REVIEW", name: "VDR Review", category: "Operational Audits" },
  { id: "CARGO_AUDIT", name: "Cargo Audit", category: "Operational Audits" },
  { id: "MOORING_AUDIT", name: "Mooring Audit", category: "Operational Audits" },
  { id: "BUNKERING_AUDIT", name: "Bunkering Audit", category: "Operational Audits" },
  { id: "ENGINEERING_AUDIT", name: "Engineering Audit", category: "Operational Audits" },
  { id: "ENVIRONMENT_AUDIT", name: "Environment Audit", category: "Operational Audits" },
  { id: "PRE_VETTING", name: "Pre-Vetting", category: "Preparation" },
  { id: "SIRE_2_0_PREPARATION", name: "SIRE 2.0 Preparation", category: "Preparation" },
  { id: "RISQ_PREPARATION", name: "RISQ Preparation", category: "Preparation" },
  { id: "OBSERVED_BY_SHIP_STAFF", name: "Observed by Ship Staff", category: "Observations" },
  { id: "OBSERVED_BY_OFFICE_STAFF", name: "Observed by Office Staff", category: "Observations" },
  { id: "OBSERVED_BY_OTHER_3RD_PARTIES", name: "Observed by Other 3rd Parties", category: "Observations" },
  { id: "INCIDENT", name: "Incident", category: "Incident Management" },
];

export function findSourceById(id: string): DefectSource | undefined {
  return defectSources.find(source => source.id === id);
}

export function getSourcesByCategory(): Record<string, DefectSource[]> {
  return defectSources.reduce((acc, source) => {
    if (!acc[source.category]) {
      acc[source.category] = [];
    }
    acc[source.category].push(source);
    return acc;
  }, {} as Record<string, DefectSource[]>);
}
