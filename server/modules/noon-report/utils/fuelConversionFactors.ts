// ====== NOON REPORT MODULE — Fuel Conversion Factors & CII Constants ======

// IMO CO₂ emission factors per fuel type (tonne CO₂ per tonne fuel)
export const CO2_FACTORS: Record<string, number> = {
  HFO: 3.114,
  LSMGO: 3.206,
  MGO: 3.206,
  VLSFO: 3.151,
  LPG: 3.030,
};

// CII reference line coefficients for bulk carriers (IMO MEPC.338(76))
// CII_ref = a × DWT^(-c), result in g CO₂ / (tonne·NM)
export const CII_BULK_CARRIER = { a: 4745, c: 0.622 };

// CII band boundary ratios relative to the reference line
// ratio = vessel_AER / CII_ref_line
export const CII_BAND_RATIOS = [
  { rating: 'A' as const, maxRatio: 0.86 },
  { rating: 'B' as const, maxRatio: 0.94 },
  { rating: 'C' as const, maxRatio: 1.06 },
  { rating: 'D' as const, maxRatio: 1.18 },
  { rating: 'E' as const, maxRatio: Infinity },
];

// Bunker planning safety margin (15%)
export const BUNKER_SAFETY_MARGIN_PCT = 15;

// Alert thresholds
export const ALERT_THRESHOLDS = {
  consumptionSpike: { warning: 0.15, critical: 0.25 }, // fraction above 7-day avg
  enduranceDays: { warning: 10, critical: 5 }, // days remaining
  aeHoursSpike: { warning: 0.20 }, // fraction above 7-day avg AE hours
  aeMinDataPoints: 3, // minimum prior reports required to compute AE hours spike
};

// Fuel types used throughout the module
export const FUEL_TYPES = ['HFO', 'LSMGO', 'MGO', 'VLSFO', 'LPG'] as const;

// Consumption field names on a noon report, keyed by fuel type
export const FUEL_CONSUMPTION_FIELDS: Record<string, string> = {
  HFO: 'hfoConsumption',
  LSMGO: 'lsmgoConsumption',
  MGO: 'mgoConsumption',
  VLSFO: 'vlsfoConsumption',
  LPG: 'lpgConsumption',
};

// ROB field names on a noon report, keyed by fuel type
export const FUEL_ROB_FIELDS: Record<string, string> = {
  HFO: 'hfoRob',
  LSMGO: 'lsmgoRob',
  MGO: 'mgoRob',
  VLSFO: 'vlsfoRob',
  LPG: 'lpgRob',
};

/**
 * Compute the CII reference line value (g CO₂ / tonne·NM) for a vessel's DWT.
 * Returns null if DWT is falsy or zero.
 */
export function computeCiiRefLine(dwt: number | null | undefined): number | null {
  if (!dwt || dwt <= 0) return null;
  return CII_BULK_CARRIER.a * Math.pow(dwt, -CII_BULK_CARRIER.c);
}

/**
 * Assign a CII rating (A–E) given the vessel's AER and the reference line.
 * Returns null if either argument is null/undefined.
 */
export function assignCiiRating(aer: number | null, refLine: number | null): 'A' | 'B' | 'C' | 'D' | 'E' | null {
  if (aer === null || aer === undefined || refLine === null || refLine === undefined) return null;
  const ratio = aer / refLine;
  for (const band of CII_BAND_RATIOS) {
    if (ratio < band.maxRatio) return band.rating;
  }
  return 'E';
}
