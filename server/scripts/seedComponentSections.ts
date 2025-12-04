/**
 * SEED COMPONENT SECTIONS D, F, G, H
 * ===================================
 * This script generates realistic dummy data for:
 * - Section D: Maintenance History (historical work orders)
 * - Section F: Drawings & Manuals (technical documents)
 * - Section G: Classification & Regulatory Data (survey/class records)
 * - Section H: Requisitions (purchase/service requisitions)
 * 
 * The data is matched to component types (Steering Gear, Rudder, Pump, Motor, etc.)
 */

import fs from 'fs';
import path from 'path';

const TEST_DATA_PATH = path.resolve(process.cwd(), 'test-data.json');

interface Component {
  id: string;
  name: string;
  componentCode: string;
  vesselCode?: string;
  category?: string;
  department?: string;
}

interface TestData {
  components: Record<string, Component>;
  componentMaintenanceHistory?: Record<string, any>;
  componentDocuments?: Record<string, any>;
  componentClassRegulatory?: Record<string, any>;
  componentRequisitions?: Record<string, any>;
  spares?: Record<string, any>;
  counters: Record<string, number>;
}

// Component type detection based on name keywords
function getComponentType(name: string): string {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('steering') || nameLower.includes('telemotor')) return 'steering_gear';
  if (nameLower.includes('rudder')) return 'rudder';
  if (nameLower.includes('pump')) return 'pump';
  if (nameLower.includes('engine') || nameLower.includes('diesel')) return 'engine';
  if (nameLower.includes('generator') || nameLower.includes('alternator')) return 'generator';
  if (nameLower.includes('compressor')) return 'compressor';
  if (nameLower.includes('motor')) return 'motor';
  if (nameLower.includes('crane') || nameLower.includes('hoist')) return 'crane';
  if (nameLower.includes('anchor') || nameLower.includes('windlass')) return 'anchor';
  if (nameLower.includes('boiler')) return 'boiler';
  if (nameLower.includes('separator') || nameLower.includes('purifier')) return 'separator';
  if (nameLower.includes('valve')) return 'valve';
  if (nameLower.includes('filter')) return 'filter';
  if (nameLower.includes('cooler') || nameLower.includes('heat exchanger')) return 'cooler';
  if (nameLower.includes('navigation') || nameLower.includes('radar') || nameLower.includes('gps')) return 'navigation';
  if (nameLower.includes('fire') || nameLower.includes('safety')) return 'safety';
  if (nameLower.includes('electrical') || nameLower.includes('switchboard')) return 'electrical';
  if (nameLower.includes('cathodic') || nameLower.includes('protection')) return 'cathodic';
  if (nameLower.includes('hull')) return 'hull';
  return 'general';
}

// Generate realistic dates in the past (within last 3 years)
function randomPastDate(maxMonthsAgo: number = 36): string {
  const now = new Date();
  const monthsAgo = Math.floor(Math.random() * maxMonthsAgo);
  const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, Math.floor(Math.random() * 28) + 1);
  return date.toISOString().split('T')[0];
}

// Generate future date
function randomFutureDate(minMonthsAhead: number = 1, maxMonthsAhead: number = 48): string {
  const now = new Date();
  const monthsAhead = minMonthsAhead + Math.floor(Math.random() * (maxMonthsAhead - minMonthsAhead));
  const date = new Date(now.getFullYear(), now.getMonth() + monthsAhead, Math.floor(Math.random() * 28) + 1);
  return date.toISOString().split('T')[0];
}

// Format date as DD-MMM-YYYY
function formatDate(isoDate: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, month, day] = isoDate.split('-');
  return `${day}-${months[parseInt(month) - 1]}-${year}`;
}

// Maintenance history templates by component type
const maintenanceTemplates: Record<string, Array<{
  jobTitle: string;
  maintenanceType: string;
  workDescription: string;
  remarks: string;
}>> = {
  steering_gear: [
    { jobTitle: 'Quarterly Steering Gear Inspection', maintenanceType: 'Inspection', workDescription: 'Visual inspection of steering gear system, check for leaks and unusual noises', remarks: 'No defects found, system operating normally' },
    { jobTitle: 'Hydraulic Oil Filter Renewal', maintenanceType: 'Replacement', workDescription: 'Replaced hydraulic oil filters and topped up oil level', remarks: 'Filters replaced, oil level restored' },
    { jobTitle: 'Steering Gear Oil Analysis', maintenanceType: 'Testing', workDescription: 'Oil sample taken for laboratory analysis', remarks: 'Oil condition satisfactory' },
    { jobTitle: 'Annual Steering Gear Test', maintenanceType: 'Testing', workDescription: 'Full function test including emergency steering', remarks: 'All tests passed satisfactorily' },
  ],
  rudder: [
    { jobTitle: 'Rudder Stock Clearance Check', maintenanceType: 'Inspection', workDescription: 'Measured rudder stock clearances at carrier and pintle bearings', remarks: 'Clearances within limits' },
    { jobTitle: 'Greasing of Pintle Bearing', maintenanceType: 'Lubrication', workDescription: 'Applied grease to pintle bearing as per schedule', remarks: 'Greasing completed' },
    { jobTitle: 'Rudder Indicator Calibration', maintenanceType: 'Testing', workDescription: 'Calibrated bridge and local rudder indicators', remarks: 'Indicators calibrated and synchronized' },
  ],
  pump: [
    { jobTitle: 'Pump Performance Test', maintenanceType: 'Testing', workDescription: 'Measured pump discharge pressure and flow rate', remarks: 'Performance within acceptable range' },
    { jobTitle: 'Mechanical Seal Inspection', maintenanceType: 'Inspection', workDescription: 'Inspected mechanical seal for leakage', remarks: 'Minor weepage observed, monitoring' },
    { jobTitle: 'Pump Bearing Replacement', maintenanceType: 'Replacement', workDescription: 'Replaced pump bearings and realigned pump', remarks: 'New bearings installed, alignment checked' },
    { jobTitle: 'Pump Impeller Inspection', maintenanceType: 'Overhaul', workDescription: 'Opened pump and inspected impeller for wear', remarks: 'Impeller in good condition' },
  ],
  engine: [
    { jobTitle: 'Engine Running Hours Service', maintenanceType: 'Servicing', workDescription: 'Changed lube oil and filters as per running hours', remarks: 'Service completed per OEM schedule' },
    { jobTitle: 'Cylinder Head Overhaul', maintenanceType: 'Overhaul', workDescription: 'Overhauled cylinder head, replaced valves and seals', remarks: 'All parts within tolerance' },
    { jobTitle: 'Fuel Injector Testing', maintenanceType: 'Testing', workDescription: 'Tested fuel injectors on test bench', remarks: 'Spray pattern satisfactory' },
    { jobTitle: 'Turbocharger Inspection', maintenanceType: 'Inspection', workDescription: 'Inspected turbocharger bearings and rotor', remarks: 'Bearing clearances within limits' },
  ],
  generator: [
    { jobTitle: 'Generator Insulation Resistance Test', maintenanceType: 'Testing', workDescription: 'Measured insulation resistance of stator windings', remarks: 'IR values satisfactory' },
    { jobTitle: 'AVR Calibration', maintenanceType: 'Testing', workDescription: 'Calibrated automatic voltage regulator', remarks: 'Voltage stability verified' },
    { jobTitle: 'Generator Bearing Inspection', maintenanceType: 'Inspection', workDescription: 'Checked generator bearing temperature and vibration', remarks: 'Operating normally' },
  ],
  general: [
    { jobTitle: 'Routine Inspection', maintenanceType: 'Inspection', workDescription: 'General visual inspection and operational check', remarks: 'No issues found' },
    { jobTitle: 'Preventive Maintenance', maintenanceType: 'Servicing', workDescription: 'Performed scheduled preventive maintenance', remarks: 'Maintenance completed as per schedule' },
    { jobTitle: 'Cleaning and Lubrication', maintenanceType: 'Cleaning', workDescription: 'Cleaned and lubricated moving parts', remarks: 'Completed satisfactorily' },
  ],
};

// Document templates by component type
const documentTemplates: Record<string, Array<{
  fileName: string;
  fileType: string;
  version: string;
}>> = {
  steering_gear: [
    { fileName: 'Steering Gear GA Drawing - RV700-2.pdf', fileType: 'Drawing', version: 'Rev.0' },
    { fileName: 'Steering Gear Hydraulic System P&ID.pdf', fileType: 'Drawing', version: 'Rev.1' },
    { fileName: 'Steering Gear Operation & Maintenance Manual.pdf', fileType: 'Manual', version: '2.0' },
    { fileName: 'Steering Gear Foundation & Bolt Layout.dwg', fileType: 'Drawing', version: 'Rev.0' },
    { fileName: 'Steering Gear Spare Parts Catalogue.pdf', fileType: 'Catalogue', version: '1.0' },
  ],
  rudder: [
    { fileName: 'Rudder Arrangement Drawing.pdf', fileType: 'Drawing', version: 'Rev.0' },
    { fileName: 'Rudder & Nozzle Assembly GA.pdf', fileType: 'Drawing', version: 'Rev.1' },
    { fileName: 'Rudder Stock Material Certificate.pdf', fileType: 'Certificate', version: '1.0' },
    { fileName: 'Rudder Bearing Maintenance Manual.pdf', fileType: 'Manual', version: '1.0' },
  ],
  pump: [
    { fileName: 'Pump Assembly Drawing.pdf', fileType: 'Drawing', version: 'Rev.0' },
    { fileName: 'Pump Installation & Operation Manual.pdf', fileType: 'Manual', version: '3.0' },
    { fileName: 'Pump Performance Curve.pdf', fileType: 'OEM Doc', version: '1.0' },
    { fileName: 'Pump Spare Parts List.pdf', fileType: 'Catalogue', version: '2.0' },
  ],
  engine: [
    { fileName: 'Engine Cross Section Drawing.pdf', fileType: 'Drawing', version: 'Rev.0' },
    { fileName: 'Engine Service Manual Vol.1 - Maintenance.pdf', fileType: 'Manual', version: '4.0' },
    { fileName: 'Engine Service Manual Vol.2 - Overhaul.pdf', fileType: 'Manual', version: '4.0' },
    { fileName: 'Engine Performance Data Sheet.pdf', fileType: 'OEM Doc', version: '1.0' },
    { fileName: 'Engine Spare Parts Catalogue.pdf', fileType: 'Catalogue', version: '3.0' },
  ],
  generator: [
    { fileName: 'Generator Wiring Diagram.pdf', fileType: 'Drawing', version: 'Rev.1' },
    { fileName: 'Generator Operation & Maintenance Manual.pdf', fileType: 'Manual', version: '2.0' },
    { fileName: 'AVR Settings & Calibration Guide.pdf', fileType: 'OEM Doc', version: '1.0' },
  ],
  general: [
    { fileName: 'Equipment Technical Datasheet.pdf', fileType: 'OEM Doc', version: '1.0' },
    { fileName: 'Maintenance Manual.pdf', fileType: 'Manual', version: '1.0' },
    { fileName: 'Spare Parts List.pdf', fileType: 'Catalogue', version: '1.0' },
  ],
};

// Class/Regulatory templates by component type
const classRegulatoryTemplates: Record<string, Array<{
  surveyType: string;
  classRequirements: string;
  classificationSociety: string;
}>> = {
  steering_gear: [
    { surveyType: 'Annual Survey', classRequirements: 'Annual Steering Gear Test - Class Requirement', classificationSociety: 'DNV' },
    { surveyType: '5-Year Survey', classRequirements: '5-Year Steering Gear Overhaul - Class Survey', classificationSociety: 'DNV' },
    { surveyType: 'Statutory Requirement', classRequirements: 'Emergency Steering Drill - SOLAS II-1 Reg.29', classificationSociety: 'Flag State' },
  ],
  rudder: [
    { surveyType: '5-Year Survey', classRequirements: 'Rudder Stock NDT - 5-Year Class Survey', classificationSociety: 'DNV' },
    { surveyType: 'Intermediate Survey', classRequirements: 'Underwater Inspection - Rudder & Nozzle', classificationSociety: 'DNV' },
    { surveyType: 'Annual Survey', classRequirements: 'Rudder Clearance Check - Annual Survey', classificationSociety: 'DNV' },
  ],
  engine: [
    { surveyType: 'Annual Survey', classRequirements: 'Main Engine Survey - Annual', classificationSociety: 'DNV' },
    { surveyType: '5-Year Survey', classRequirements: 'Main Engine Overhaul - Special Survey', classificationSociety: 'DNV' },
    { surveyType: 'OEM Test', classRequirements: 'Engine Performance Test - Maker Requirement', classificationSociety: 'OEM' },
  ],
  pump: [
    { surveyType: 'Annual Survey', classRequirements: 'Fire Pump Capacity Test', classificationSociety: 'DNV' },
    { surveyType: 'Statutory Requirement', classRequirements: 'Bilge Pump Test - SOLAS Requirement', classificationSociety: 'Flag State' },
  ],
  generator: [
    { surveyType: 'Annual Survey', classRequirements: 'Generator Insulation Test', classificationSociety: 'DNV' },
    { surveyType: '5-Year Survey', classRequirements: 'Generator Overhaul - Special Survey', classificationSociety: 'DNV' },
  ],
  general: [
    { surveyType: 'Annual Survey', classRequirements: 'Equipment Annual Survey', classificationSociety: 'DNV' },
    { surveyType: 'Internal Company Requirement', classRequirements: 'Company Inspection Requirement', classificationSociety: 'Company' },
  ],
};

// Requisition templates by component type
const requisitionTemplates: Record<string, Array<{
  itemOrService: string;
  priority: string;
  status: string;
}>> = {
  steering_gear: [
    { itemOrService: 'Steering Gear Hydraulic Oil Seal Kit', priority: 'Normal', status: 'PO Raised' },
    { itemOrService: 'Steering Gear Actuator Piston Ring Set', priority: 'Urgent', status: 'Delivered On Board' },
    { itemOrService: 'Hydraulic Oil Filter Element', priority: 'Normal', status: 'RFQ Sent' },
  ],
  rudder: [
    { itemOrService: 'Rudder Bearing Grease - Marine Grade', priority: 'Normal', status: 'Delivered On Board' },
    { itemOrService: 'Pintle Bearing Seal Kit', priority: 'Normal', status: 'PO Raised' },
  ],
  pump: [
    { itemOrService: 'Pump Mechanical Seal Kit', priority: 'Urgent', status: 'PO Raised' },
    { itemOrService: 'Pump Bearing Set', priority: 'Normal', status: 'RFQ Sent' },
    { itemOrService: 'Impeller Replacement', priority: 'Normal', status: 'Draft' },
  ],
  engine: [
    { itemOrService: 'Cylinder Liner Set', priority: 'Urgent', status: 'PO Raised' },
    { itemOrService: 'Fuel Injector Overhaul Kit', priority: 'Normal', status: 'Delivered On Board' },
    { itemOrService: 'Turbocharger Bearing Kit', priority: 'Normal', status: 'RFQ Sent' },
  ],
  generator: [
    { itemOrService: 'Generator Bearing Set', priority: 'Normal', status: 'PO Raised' },
    { itemOrService: 'AVR Module Replacement', priority: 'Urgent', status: 'Ordered' },
  ],
  general: [
    { itemOrService: 'General Maintenance Spares', priority: 'Normal', status: 'Draft' },
    { itemOrService: 'Consumables for PM Service', priority: 'Normal', status: 'RFQ Sent' },
  ],
};

const performedByOptions = ['C/E', '2/E', '3/E', '4/E', 'E/C', 'Fitter', 'Motorman', 'C/O', '2/O', '3/O'];
const approvedByOptions = ['C/E', 'Master', '2/E', 'C/O', 'Superintendent'];
const uploadedByOptions = ['Technical Superintendent', 'C/E', 'Fleet Manager', 'PMS Admin'];
const requestedByOptions = ['C/E', '2/E', 'C/O', 'Bosun', 'E/C'];

function generateMaintenanceHistory(component: Component, startId: number): any[] {
  const compType = getComponentType(component.name);
  const templates = maintenanceTemplates[compType] || maintenanceTemplates.general;
  const count = 2 + Math.floor(Math.random() * 3); // 2-4 records
  const records: any[] = [];
  
  for (let i = 0; i < count && i < templates.length; i++) {
    const template = templates[i];
    const dateCompleted = randomPastDate(24);
    const runningHours = 1000 + Math.floor(Math.random() * 15000);
    
    records.push({
      id: startId + i,
      componentId: component.id,
      componentCode: component.componentCode,
      vesselCode: component.vesselCode || 'V001',
      workOrderId: `WO-HIST-${startId + i}`,
      workOrderNo: `${component.componentCode}.WO-${new Date(dateCompleted).getFullYear()}-${String(i + 1).padStart(3, '0')}`,
      jobTitle: template.jobTitle,
      maintenanceType: template.maintenanceType,
      dateCompleted: dateCompleted,
      runningHoursAtCompletion: String(runningHours),
      performedBy: performedByOptions[Math.floor(Math.random() * performedByOptions.length)],
      approvedBy: approvedByOptions[Math.floor(Math.random() * approvedByOptions.length)],
      approvalDate: dateCompleted,
      status: 'Approved',
      workDescription: template.workDescription,
      sparesUsed: [],
      remarks: template.remarks,
      isComponentReplaced: false,
      createdAt: new Date().toISOString(),
    });
  }
  
  return records;
}

function generateDocuments(component: Component, startId: number): any[] {
  const compType = getComponentType(component.name);
  const templates = documentTemplates[compType] || documentTemplates.general;
  const count = 3 + Math.floor(Math.random() * 3); // 3-5 documents
  const records: any[] = [];
  
  for (let i = 0; i < count && i < templates.length; i++) {
    const template = templates[i];
    const uploadDate = randomPastDate(36);
    
    records.push({
      id: startId + i,
      componentId: component.id,
      componentCode: component.componentCode,
      vesselCode: component.vesselCode || 'V001',
      fileName: template.fileName.replace(/\.(pdf|dwg)$/, ` - ${component.componentCode}$&`),
      fileKey: `docs/${component.componentCode}/${Date.now()}_${i}.pdf`,
      fileType: template.fileType,
      fileSize: 500000 + Math.floor(Math.random() * 5000000), // 500KB - 5.5MB
      version: template.version,
      uploadedBy: uploadedByOptions[Math.floor(Math.random() * uploadedByOptions.length)],
      uploadedAt: new Date(uploadDate).toISOString(),
      canShipView: true,
      canShipDownload: Math.random() > 0.3,
      isActive: true,
      notes: `Document for ${component.name}`,
      storageBackend: 'local',
    });
  }
  
  return records;
}

function generateClassRegulatory(component: Component, startId: number): any[] {
  const compType = getComponentType(component.name);
  const templates = classRegulatoryTemplates[compType] || classRegulatoryTemplates.general;
  const count = 2 + Math.floor(Math.random() * 2); // 2-3 records
  const records: any[] = [];
  
  for (let i = 0; i < count && i < templates.length; i++) {
    const template = templates[i];
    const lastSurveyDate = randomPastDate(18);
    const nextDueDate = randomFutureDate(6, 48);
    
    // Determine survey status based on next due date
    const now = new Date();
    const dueDate = new Date(nextDueDate);
    const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    let surveyStatus = 'Active';
    if (daysUntilDue < 0) surveyStatus = 'Expired';
    else if (daysUntilDue < 90) surveyStatus = 'Pending';
    
    records.push({
      id: startId + i,
      componentId: component.id,
      componentCode: component.componentCode,
      vesselCode: component.vesselCode || 'V001',
      classificationSociety: template.classificationSociety,
      surveyType: template.surveyType,
      certificateNumber: `CERT-${component.componentCode}-${String(startId + i).padStart(4, '0')}`,
      issueDate: formatDate(lastSurveyDate),
      expiryDate: formatDate(nextDueDate),
      lastClassSurvey: formatDate(lastSurveyDate),
      nextSurveyDue: formatDate(nextDueDate),
      classRequirements: template.classRequirements,
      surveyStatus: surveyStatus,
      remarks: `${template.surveyType} for ${component.name}`,
      createdBy: 'System',
      createdAt: new Date().toISOString(),
      updatedBy: 'System',
      updatedAt: new Date().toISOString(),
      isActive: true,
    });
  }
  
  return records;
}

function generateRequisitions(component: Component, spares: any[], startId: number, reqCounter: number): any[] {
  const compType = getComponentType(component.name);
  const templates = requisitionTemplates[compType] || requisitionTemplates.general;
  const count = 1 + Math.floor(Math.random() * 3); // 1-3 requisitions
  const records: any[] = [];
  
  // Get relevant spares for this component
  const componentSpares = Object.values(spares).filter((s: any) => 
    s && (s.componentId === component.id || s.componentCode === component.componentCode)
  );
  
  for (let i = 0; i < count && i < templates.length; i++) {
    const template = templates[i];
    const raisedOn = randomPastDate(6);
    const spare = componentSpares[i % Math.max(componentSpares.length, 1)] as any;
    
    records.push({
      id: startId + i,
      requisitionNo: `REQ-V001-${new Date().getFullYear()}-${String(reqCounter + i).padStart(3, '0')}`,
      componentId: component.id,
      componentCode: component.componentCode,
      vesselCode: component.vesselCode || 'V001',
      raisedOn: formatDate(raisedOn),
      itemOrService: template.itemOrService,
      relatedPartCode: spare?.partCode || null,
      relatedPartName: spare?.partName || null,
      quantity: 1 + Math.floor(Math.random() * 5),
      uom: 'EA',
      status: template.status,
      priority: template.priority,
      requestedBy: requestedByOptions[Math.floor(Math.random() * requestedByOptions.length)],
      approvedBy: template.status !== 'Draft' ? approvedByOptions[Math.floor(Math.random() * approvedByOptions.length)] : null,
      approvalDate: template.status !== 'Draft' ? formatDate(raisedOn) : null,
      purchaseOrderNo: template.status === 'PO Raised' || template.status === 'Delivered On Board' ? `PO-${new Date().getFullYear()}-${String(reqCounter + i).padStart(4, '0')}` : null,
      expectedDelivery: template.status !== 'Draft' ? formatDate(randomFutureDate(1, 3)) : null,
      actualDelivery: template.status === 'Delivered On Board' ? formatDate(randomPastDate(2)) : null,
      supplier: template.status !== 'Draft' && template.status !== 'RFQ Sent' ? 'Marine Supplies Co.' : null,
      estimatedCost: String(100 + Math.floor(Math.random() * 5000)),
      actualCost: template.status === 'Delivered On Board' ? String(100 + Math.floor(Math.random() * 5000)) : null,
      remarks: `Requisition for ${component.name}`,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  
  return records;
}

async function seedComponentSections() {
  console.log('🌱 Starting Component Sections Seeding (D, F, G, H)...\n');
  
  // Load existing test data
  if (!fs.existsSync(TEST_DATA_PATH)) {
    console.error('❌ test-data.json not found!');
    process.exit(1);
  }
  
  const rawData = fs.readFileSync(TEST_DATA_PATH, 'utf-8');
  const data: TestData = JSON.parse(rawData);
  
  // Initialize sections if not present
  if (!data.componentMaintenanceHistory) data.componentMaintenanceHistory = {};
  if (!data.componentDocuments) data.componentDocuments = {};
  if (!data.componentClassRegulatory) data.componentClassRegulatory = {};
  if (!data.componentRequisitions) data.componentRequisitions = {};
  if (!data.counters) data.counters = {};
  
  // Initialize counters if not present
  let historyId = data.counters.componentMaintenanceHistoryId || 1;
  let docId = data.counters.componentDocumentId || 1;
  let classId = data.counters.componentClassRegulatoryId || 1;
  let reqId = data.counters.componentRequisitionId || 1;
  let reqCounter = 1;
  
  const components = Object.values(data.components).filter(c => c !== null);
  const spares = data.spares || {};
  
  console.log(`📊 Found ${components.length} components to process\n`);
  
  let statsD = 0, statsF = 0, statsG = 0, statsH = 0;
  
  for (const component of components) {
    // Skip parent categories (usually have short codes like "2", "4", "6")
    if (component.componentCode.length <= 2) {
      console.log(`⏭️  Skipping category: ${component.name} (${component.componentCode})`);
      continue;
    }
    
    // Check if sections are empty for this component
    const hasHistory = Object.values(data.componentMaintenanceHistory).some((h: any) => h?.componentId === component.id);
    const hasDocs = Object.values(data.componentDocuments).some((d: any) => d?.componentId === component.id);
    const hasClass = Object.values(data.componentClassRegulatory).some((c: any) => c?.componentId === component.id);
    const hasReqs = Object.values(data.componentRequisitions).some((r: any) => r?.componentId === component.id);
    
    console.log(`\n🔧 Processing: ${component.name} (${component.componentCode})`);
    console.log(`   Type detected: ${getComponentType(component.name)}`);
    
    // Section D: Maintenance History
    if (!hasHistory) {
      const history = generateMaintenanceHistory(component, historyId);
      history.forEach(h => {
        data.componentMaintenanceHistory![h.id] = h;
      });
      historyId += history.length;
      statsD += history.length;
      console.log(`   ✅ D: Added ${history.length} maintenance history records`);
    } else {
      console.log(`   ⏭️  D: Already has maintenance history`);
    }
    
    // Section F: Documents
    if (!hasDocs) {
      const docs = generateDocuments(component, docId);
      docs.forEach(d => {
        data.componentDocuments![d.id] = d;
      });
      docId += docs.length;
      statsF += docs.length;
      console.log(`   ✅ F: Added ${docs.length} documents`);
    } else {
      console.log(`   ⏭️  F: Already has documents`);
    }
    
    // Section G: Class Regulatory
    if (!hasClass) {
      const classItems = generateClassRegulatory(component, classId);
      classItems.forEach(c => {
        data.componentClassRegulatory![c.id] = c;
      });
      classId += classItems.length;
      statsG += classItems.length;
      console.log(`   ✅ G: Added ${classItems.length} class/regulatory records`);
    } else {
      console.log(`   ⏭️  G: Already has class/regulatory data`);
    }
    
    // Section H: Requisitions
    if (!hasReqs) {
      const reqs = generateRequisitions(component, spares, reqId, reqCounter);
      reqs.forEach(r => {
        data.componentRequisitions![r.id] = r;
      });
      reqId += reqs.length;
      reqCounter += reqs.length;
      statsH += reqs.length;
      console.log(`   ✅ H: Added ${reqs.length} requisitions`);
    } else {
      console.log(`   ⏭️  H: Already has requisitions`);
    }
  }
  
  // Update counters
  data.counters.componentMaintenanceHistoryId = historyId;
  data.counters.componentDocumentId = docId;
  data.counters.componentClassRegulatoryId = classId;
  data.counters.componentRequisitionId = reqCounter;
  
  // Save updated data
  fs.writeFileSync(TEST_DATA_PATH, JSON.stringify(data, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SEEDING COMPLETE - SUMMARY');
  console.log('='.repeat(60));
  console.log(`   Section D (Maintenance History): ${statsD} records added`);
  console.log(`   Section F (Documents):           ${statsF} records added`);
  console.log(`   Section G (Class/Regulatory):    ${statsG} records added`);
  console.log(`   Section H (Requisitions):        ${statsH} records added`);
  console.log('='.repeat(60));
  console.log('\n✅ Data saved to test-data.json');
}

// Run the seeder
seedComponentSections().catch(console.error);
