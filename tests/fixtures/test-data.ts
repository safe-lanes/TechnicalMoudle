import { nanoid } from 'nanoid';

export function generateUniqueId(prefix: string = 'test'): string {
  return `${prefix}_${nanoid(8)}`;
}

export function generateTestEmail(): string {
  return `test_${nanoid(8)}@testpms.com`;
}

export function generateWorkOrderData() {
  const id = generateUniqueId('WO');
  return {
    id,
    vesselId: 'V001',
    component: `Test Component ${nanoid(4)}`,
    componentCode: `TC-${nanoid(4)}`,
    taskType: 'Inspection',
    templateCode: `${id}-INS`,
    briefDescription: `Test Work Order ${id}`,
    frequency: '3',
    unit: 'Months',
    responsibleRank: 'Chief Engineer',
    status: 'Pending',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    maintenanceBasis: 'Calendar',
    nextDue: '3 months',
    estimatedDuration: '2 hours',
    numberOfPeople: 2,
    location: 'Engine Room',
    tools: 'Standard toolkit',
    spares: 'None',
    permits: 'Hot work permit',
    specialNotes: `Generated for test ${id}`,
  };
}

export function generateSparePartData() {
  const id = generateUniqueId('SP');
  return {
    partCode: id,
    partName: `Test Spare Part ${nanoid(4)}`,
    component: 'Main Engine #1 (Wartsila 8L46F)',
    componentId: '6.01.001',
    critical: Math.random() > 0.5 ? 'Yes' : 'No',
    rob: Math.floor(Math.random() * 10) + 1,
    min: Math.floor(Math.random() * 5) + 1,
    location: `Store Room ${['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)]}`,
    vesselId: 'V001',
  };
}

export function generateStoresItemData() {
  const id = generateUniqueId('ST');
  const categories = ['stores', 'lubes', 'chemicals', 'others'] as const;
  return {
    itemCode: id,
    itemName: `Test Store Item ${nanoid(4)}`,
    storesCategory: categories[Math.floor(Math.random() * categories.length)],
    uom: ['Liters', 'Kg', 'Pieces', 'Sets'][Math.floor(Math.random() * 4)],
    rob: Math.floor(Math.random() * 100) + 1,
    min: Math.floor(Math.random() * 20) + 1,
    location: `Store ${nanoid(2)}`,
    vesselId: 'V001',
  };
}

export function generateComponentData() {
  const id = generateUniqueId('COMP');
  return {
    id,
    name: `Test Component ${nanoid(4)}`,
    componentCode: `${id}-${nanoid(4)}`,
    category: 'machinery',
    maker: 'Test Manufacturer',
    model: `Model-${nanoid(4)}`,
    serialNo: `SN-${nanoid(8)}`,
    location: 'Engine Room',
    critical: Math.random() > 0.5,
    classItem: Math.random() > 0.7,
    vesselId: 'V001',
  };
}

export function generateRunningHoursData() {
  return {
    previousRH: Math.floor(Math.random() * 1000),
    newRH: Math.floor(Math.random() * 100) + 10,
    dateUpdatedLocal: new Date().toLocaleString(),
    dateUpdatedTZ: Intl.DateTimeFormat().resolvedOptions().timeZone,
    userId: 'test_user',
    source: 'single' as const,
    notes: `Test update ${nanoid(4)}`,
  };
}