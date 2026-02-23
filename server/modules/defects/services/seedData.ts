/**
 * Defect seed data for recurring defects testing (development only).
 * Extracted from server/routes.ts to keep the routing file clean.
 */

export interface SeedDefect {
  seedId: string;
  vesselName: string;
  vesselId?: string;
  issuedDate: string;
  targetDate: string;
  status: string;
  isCoC: boolean;
  source?: string;
  defectCategory: string;
  defectType: string;
  responsibleRole: string;
  equipment: {
    category: string;
    type: string;
    make: string;
    model: string;
  };
  description: string;
  actionRequested: string;
  dateCompleted?: string;
}

export function getSeedDefectsData(vesselNames: string[]): SeedDefect[] {
  // Use provided vessel names from external API (or fallback)
  const vessel1 = vesselNames[0] || 'Vessel 1';
  const vessel2 = vesselNames[1] || 'Vessel 2';
  const vessel3 = vesselNames[2] || 'Vessel 3';
  const vessel4 = vesselNames[3] || 'Vessel 4';
  const vessel5 = vesselNames[4] || 'Vessel 5';

  return [
    // Equipment Group A: Main Engine Fuel Pump - 4 occurrences across 2 vessels (recurring)
    {
      seedId: 'RD-A-001',
      vesselName: vessel1,
      issuedDate: '2025-03-15',
      targetDate: '2025-04-15',
      status: 'closed',
      dateCompleted: '2025-04-10',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Machinery',
      defectType: 'Breakdown',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Fuel Injection Pump',
        make: 'MAN B&W',
        model: 'ME-C 7G80'
      },
      description: 'Fuel injection pump Unit #3 showing reduced pressure output. Fuel delivery fluctuating during high load operations.',
      actionRequested: 'Inspect and overhaul fuel injection pump. Replace worn plungers and delivery valves.'
    },
    {
      seedId: 'RD-A-002',
      vesselName: vessel1,
      issuedDate: '2025-06-20',
      targetDate: '2025-07-20',
      status: 'open',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Machinery',
      defectType: 'Breakdown',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Fuel Injection Pump',
        make: 'MAN B&W',
        model: 'ME-C 7G80'
      },
      description: 'Fuel injection pump Unit #5 exhibiting similar symptoms to previous Unit #3 failure. Suspect systemic fuel quality issue.',
      actionRequested: 'Overhaul pump unit. Conduct fuel quality analysis. Review bunkering procedures.'
    },
    {
      seedId: 'RD-A-003',
      vesselName: vessel2,
      issuedDate: '2025-04-01',
      targetDate: '2025-05-01',
      status: 'closed',
      dateCompleted: '2025-04-28',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Machinery',
      defectType: 'Breakdown',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Fuel Injection Pump',
        make: 'MAN B&W',
        model: 'ME-C 7G80'
      },
      description: 'Fuel pump delivery valve stuck. Engine performance degraded at full ahead.',
      actionRequested: 'Replace delivery valve and inspect related components.'
    },
    {
      seedId: 'RD-A-004',
      vesselName: vessel2,
      issuedDate: '2025-09-10',
      targetDate: '2025-10-10',
      status: 'open',
      isCoC: true,
      source: 'Class',
      defectCategory: 'Machinery',
      defectType: 'Breakdown',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Fuel Injection Pump',
        make: 'MAN B&W',
        model: 'ME-C 7G80'
      },
      description: 'Multiple fuel pump units showing wear. Class surveyor raised CoC for engine reliability concerns.',
      actionRequested: 'Complete overhaul of all fuel injection pump units. Submit repair plan to Class.'
    },

    // Equipment Group B: Navigation Radar - 3 occurrences across 3 vessels (recurring)
    {
      seedId: 'RD-B-001',
      vesselName: vessel1,
      issuedDate: '2025-02-10',
      targetDate: '2025-03-10',
      status: 'closed',
      dateCompleted: '2025-03-05',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Navigation',
      defectType: 'Equipment Failure',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Navigation',
        type: 'X-Band Radar',
        make: 'Furuno',
        model: 'FAR-2228'
      },
      description: 'Radar display flickering intermittently. Target tracking unreliable in heavy weather.',
      actionRequested: 'Service technician to inspect display unit and antenna motor assembly.'
    },
    {
      seedId: 'RD-B-002',
      vesselName: vessel3,
      issuedDate: '2025-05-15',
      targetDate: '2025-06-15',
      status: 'open',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Navigation',
      defectType: 'Equipment Failure',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Navigation',
        type: 'X-Band Radar',
        make: 'Furuno',
        model: 'FAR-2228'
      },
      description: 'Radar bearing accuracy degraded. ARPA tracking showing errors in target courses.',
      actionRequested: 'Calibrate radar. Replace gyro interface if necessary.'
    },
    {
      seedId: 'RD-B-003',
      vesselName: vessel2,
      issuedDate: '2025-08-20',
      targetDate: '2025-09-20',
      status: 'open',
      isCoC: true,
      source: 'PSC',
      defectCategory: 'Navigation',
      defectType: 'Equipment Failure',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Navigation',
        type: 'X-Band Radar',
        make: 'Furuno',
        model: 'FAR-2228'
      },
      description: 'PSC detention due to radar malfunction. Complete failure of X-Band radar during port state inspection.',
      actionRequested: 'Urgent repair required. Replace main processing unit and conduct sea trials.'
    },

    // Equipment Group C: Lifeboat Davit - 2 occurrences (minimum recurring)
    {
      seedId: 'RD-C-001',
      vesselName: vessel1,
      issuedDate: '2025-01-20',
      targetDate: '2025-02-20',
      status: 'closed',
      dateCompleted: '2025-02-15',
      isCoC: true,
      source: 'Class',
      defectCategory: 'Deck',
      defectType: 'Safety Equipment',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Deck',
        type: 'Lifeboat Davit',
        make: 'Norsafe',
        model: 'LBD-500'
      },
      description: 'Lifeboat davit wire showing corrosion. Brake test failed during annual survey.',
      actionRequested: 'Replace davit wire and overhaul brake mechanism. Re-survey by Class.'
    },
    {
      seedId: 'RD-C-002',
      vesselName: vessel2,
      issuedDate: '2025-07-05',
      targetDate: '2025-08-05',
      status: 'open',
      isCoC: true,
      source: 'Class',
      defectCategory: 'Deck',
      defectType: 'Safety Equipment',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Deck',
        type: 'Lifeboat Davit',
        make: 'Norsafe',
        model: 'LBD-500'
      },
      description: 'Similar davit wire corrosion identified during routine inspection. Potential fleet-wide issue.',
      actionRequested: 'Full inspection of davit system. Coordinate with fleet for common maintenance schedule.'
    },

    // Equipment Group D: Steering Gear - 3 occurrences (recurring with CoC)
    {
      seedId: 'RD-D-001',
      vesselName: vessel3,
      issuedDate: '2025-03-01',
      targetDate: '2025-04-01',
      status: 'closed',
      dateCompleted: '2025-03-28',
      isCoC: true,
      source: 'Class',
      defectCategory: 'Machinery',
      defectType: 'Critical System',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Steering Gear',
        make: 'Rolls-Royce',
        model: 'Aquamaster US-255'
      },
      description: 'Steering gear hydraulic leak detected. Emergency steering tested satisfactory.',
      actionRequested: 'Repair hydraulic seals. Conduct steering trials before departure.'
    },
    {
      seedId: 'RD-D-002',
      vesselName: vessel1,
      issuedDate: '2025-06-15',
      targetDate: '2025-07-15',
      status: 'open',
      isCoC: true,
      source: 'Class',
      defectCategory: 'Machinery',
      defectType: 'Critical System',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Steering Gear',
        make: 'Rolls-Royce',
        model: 'Aquamaster US-255'
      },
      description: 'Steering gear slow response. Hydraulic pump showing signs of wear.',
      actionRequested: 'Overhaul hydraulic pump. Replace worn seals and bearings.'
    },
    {
      seedId: 'RD-D-003',
      vesselName: vessel2,
      issuedDate: '2025-10-01',
      targetDate: '2025-11-01',
      status: 'open',
      isCoC: true,
      source: 'Ship',
      defectCategory: 'Machinery',
      defectType: 'Critical System',
      responsibleRole: 'Chief Engineer',
      equipment: {
        category: 'Machinery',
        type: 'Steering Gear',
        make: 'Rolls-Royce',
        model: 'Aquamaster US-255'
      },
      description: 'Fleet-wide steering gear issue. Third vessel reporting similar hydraulic problems.',
      actionRequested: 'Urgent fleet-wide inspection. Manufacturer to review design tolerances.'
    },

    // Equipment Group E: Cargo Hold Ventilation - 2 occurrences
    {
      seedId: 'RD-E-001',
      vesselName: vessel3,
      issuedDate: '2025-04-10',
      targetDate: '2025-05-10',
      status: 'closed',
      dateCompleted: '2025-05-08',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Cargo',
      defectType: 'Ventilation',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Cargo',
        type: 'Hold Ventilation Fan',
        make: 'Kongsberg',
        model: 'KV-3000'
      },
      description: 'Cargo hold #2 ventilation fan motor overheating. Reduced airflow affecting cargo condition.',
      actionRequested: 'Replace fan motor bearings. Check electrical supply and motor windings.'
    },
    {
      seedId: 'RD-E-002',
      vesselName: vessel1,
      issuedDate: '2025-08-25',
      targetDate: '2025-09-25',
      status: 'open',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Cargo',
      defectType: 'Ventilation',
      responsibleRole: 'Chief Officer',
      equipment: {
        category: 'Cargo',
        type: 'Hold Ventilation Fan',
        make: 'Kongsberg',
        model: 'KV-3000'
      },
      description: 'Same ventilation fan model failing on another vessel. Suspect manufacturing defect.',
      actionRequested: 'Full inspection of all hold ventilation fans fleet-wide.'
    },

    // Single defects (not recurring - for variety)
    {
      seedId: 'RD-F-001',
      vesselName: vessel3,
      issuedDate: '2025-09-01',
      targetDate: '2025-10-01',
      status: 'open',
      isCoC: false,
      source: 'Ship',
      defectCategory: 'Electrical',
      defectType: 'Lighting',
      responsibleRole: '2nd Engineer',
      equipment: {
        category: 'Electrical',
        type: 'Navigation Light',
        make: 'Glamox',
        model: 'NL-200'
      },
      description: 'Port side navigation light flickering. LED driver unit suspected faulty.',
      actionRequested: 'Replace LED driver unit. Test light operation during night watches.'
    }
  ];
}

/** All seed IDs for cleanup purposes */
export const ALL_SEED_IDS = [
  // Equipment Group A: Fuel Injection Pump (4)
  'RD-A-001', 'RD-A-002', 'RD-A-003', 'RD-A-004',
  // Equipment Group B: X-Band Radar (3)
  'RD-B-001', 'RD-B-002', 'RD-B-003',
  // Equipment Group C: Lifeboat Davit (2)
  'RD-C-001', 'RD-C-002',
  // Equipment Group D: Steering Gear (3)
  'RD-D-001', 'RD-D-002', 'RD-D-003',
  // Equipment Group E: Hold Ventilation Fan (2)
  'RD-E-001', 'RD-E-002',
  // Single defects
  'RD-F-001'
];
