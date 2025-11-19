export interface SparePart {
  partNumber: string;
  description: string;
  quantity: number;
  unit: string;
  status: 'available' | 'reserved' | 'order-required';
  location?: string;
  rob?: number;
}

export interface Tool {
  toolId: string;
  description: string;
  quantity: number;
  status: 'available' | 'reserved';
  location?: string;
}

export interface SafetyRequirement {
  requirement: string;
  type: string;
  responsibility: string;
  status: 'completed' | 'postponed' | 'active';
}

export interface WorkHistoryEntry {
  date: string;
  workOrder: string;
  description: string;
  performedBy: string;
  status: 'completed' | 'postponed';
  remarks?: string;
}

export const sampleSpareParts: SparePart[] = [
  {
    partNumber: 'FLT-001-234',
    description: 'Oil Filter - Main Engine',
    quantity: 2,
    unit: 'EA',
    status: 'available',
    location: 'Store A-12',
    rob: 5
  },
  {
    partNumber: 'GSK-445-789',
    description: 'Gasket Set - Cooling System',
    quantity: 1,
    unit: 'SET',
    status: 'reserved',
    location: 'Store B-05',
    rob: 2
  },
  {
    partNumber: 'BRG-223-456',
    description: 'Bearing - Pump Assembly',
    quantity: 4,
    unit: 'EA',
    status: 'order-required',
    location: '-',
    rob: 0
  }
];

export const sampleTools: Tool[] = [
  {
    toolId: 'TL-WR-032',
    description: 'Torque Wrench 50-300 Nm',
    quantity: 1,
    status: 'available',
    location: 'Tool Room'
  },
  {
    toolId: 'TL-HY-015',
    description: 'Hydraulic Puller Set',
    quantity: 1,
    status: 'available',
    location: 'Tool Room'
  },
  {
    toolId: 'TL-MM-101',
    description: 'Multimeter Digital',
    quantity: 1,
    status: 'reserved',
    location: 'Tool Room'
  }
];

export const sampleSafetyRequirements: SafetyRequirement[] = [
  {
    requirement: 'Lock Out Tag Out (LOTO) - Main Engine',
    type: 'Electrical Safety',
    responsibility: 'Chief Engineer',
    status: 'completed'
  },
  {
    requirement: 'Hot Work Permit',
    type: 'Fire Safety',
    responsibility: 'Safety Officer',
    status: 'active'
  },
  {
    requirement: 'Confined Space Entry Permit',
    type: 'Entry Safety',
    responsibility: '2nd Engineer',
    status: 'postponed'
  }
];

export const sampleWorkHistory: WorkHistoryEntry[] = [
  {
    date: '15/11/2025',
    workOrder: 'WO-2024-1234',
    description: 'Main Engine Oil Change',
    performedBy: 'John Smith (3rd Eng)',
    status: 'completed',
    remarks: 'Completed on schedule. No issues found.'
  },
  {
    date: '10/11/2025',
    workOrder: 'WO-2024-1189',
    description: 'Cooling System Inspection',
    performedBy: 'Mike Johnson (2nd Eng)',
    status: 'completed',
    remarks: 'Minor leak detected and repaired.'
  },
  {
    date: '05/11/2025',
    workOrder: 'WO-2024-1145',
    description: 'Pump Bearing Replacement',
    performedBy: 'David Lee (4th Eng)',
    status: 'postponed',
    remarks: 'Spare parts not available. Rescheduled.'
  }
];
