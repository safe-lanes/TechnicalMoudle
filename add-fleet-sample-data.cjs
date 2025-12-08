const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'test-data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Add sample fleet components following the hierarchy in the screenshot
// 6. Machinery Main Components
//   > 60. Diesel Engines for Propulsion
//     > 601. Diesel Engines  
//       > 601.001 Main Diesel Engines
//       > 601.002 ME Cylinder Covers W/ valves (selected in screenshot)

const sampleComponents = {
  "fleet_60": {
    "id": "fleet_60",
    "componentCode": "60",
    "name": "Diesel Engines for Propulsion",
    "fleetEquipmentCode": "60",
    "fleetEquipmentName": "Diesel Engines for Propulsion",
    "parentFleetEquipmentCode": "6",
    "parentId": null,
    "category": "Machinery Main Components",
    "componentCategory": "Machinery Main Components",
    "vesselId": null,
    "dataScope": "fleet",
    "maker": null,
    "makerCode": null,
    "model": null,
    "modelCode": null,
    "location": null,
    "rating": null,
    "eqptSystemDept": null,
    "serialNo": null,
    "notes": null,
    "isActive": true,
    "isParent": true,
    "createdAt": "2025-12-08T00:00:00.000Z",
    "updatedAt": "2025-12-08T00:00:00.000Z"
  },
  "fleet_601": {
    "id": "fleet_601",
    "componentCode": "601",
    "name": "Diesel Engines",
    "fleetEquipmentCode": "601",
    "fleetEquipmentName": "Diesel Engines",
    "parentFleetEquipmentCode": "60",
    "parentId": "fleet_60",
    "category": "Machinery Main Components",
    "componentCategory": "Machinery Main Components",
    "vesselId": null,
    "dataScope": "fleet",
    "maker": null,
    "makerCode": null,
    "model": null,
    "modelCode": null,
    "location": null,
    "rating": null,
    "eqptSystemDept": null,
    "serialNo": null,
    "notes": null,
    "isActive": true,
    "isParent": true,
    "createdAt": "2025-12-08T00:00:00.000Z",
    "updatedAt": "2025-12-08T00:00:00.000Z"
  },
  "fleet_601.001": {
    "id": "fleet_601.001",
    "componentCode": "601.001",
    "name": "Main Diesel Engines",
    "fleetEquipmentCode": "601.001",
    "fleetEquipmentName": "Main Diesel Engines",
    "parentFleetEquipmentCode": "601",
    "parentId": "fleet_601",
    "category": "Machinery Main Components",
    "componentCategory": "AAA-BBB",
    "vesselId": null,
    "dataScope": "fleet",
    "maker": "MAN Energy Solutions",
    "makerCode": "MKR000001",
    "model": "D12F6748",
    "modelCode": "MKR00001-D12F6748",
    "location": "Engine Room",
    "rating": "20000KW",
    "eqptSystemDept": "AAA-BB-CC",
    "serialNo": null,
    "notes": "6-Cylinder / 20000KW",
    "isActive": true,
    "isParent": true,
    "createdAt": "2025-12-08T00:00:00.000Z",
    "updatedAt": "2025-12-08T00:00:00.000Z"
  },
  "fleet_601.002": {
    "id": "fleet_601.002",
    "componentCode": "601.002",
    "name": "ME Cylinder Covers W/ valves",
    "fleetEquipmentCode": "601.002",
    "fleetEquipmentName": "ME Cylinder Covers W/ valves",
    "parentFleetEquipmentCode": "601",
    "parentId": "fleet_601",
    "category": "Machinery Main Components",
    "componentCategory": "AAA-BBB",
    "vesselId": null,
    "dataScope": "fleet",
    "maker": "MAN Energy Solutions",
    "makerCode": "MKR000001",
    "model": "D12F6748",
    "modelCode": "MKR00001-D12F6748",
    "location": "Engine Room",
    "rating": "20000KW",
    "eqptSystemDept": "AAA-BB-CC",
    "serialNo": null,
    "notes": "6-Cylinder / 20000KW",
    "isActive": true,
    "isParent": false,
    "createdAt": "2025-12-08T00:00:00.000Z",
    "updatedAt": "2025-12-08T00:00:00.000Z"
  }
};

// Add sample jobs linked to component 601.002
const sampleJobs = {
  "fleet_job_mkr_ov_00001": {
    "id": "fleet_job_mkr_ov_00001",
    "jobNo": "MKR-OV-00001",
    "fleetJobCode": "MKR-OV-00001",
    "jobTitle": "ME Cylinder Head Overhaul - 16000 RHS",
    "componentId": "fleet_601.002",
    "componentCode": "601.002",
    "componentName": "ME Cylinder Covers W/ valves",
    "fleetEquipmentCode": "601.002",
    "fleetEquipmentName": "ME Cylinder Covers W/ valves",
    "maintenanceType": "Overhaul",
    "maintenanceBasis": "Running Hours",
    "frequencyValue": 16000,
    "frequencyUnit": "RHS",
    "intervalRunningHour": 16000,
    "jobDescription": "Complete cylinder head overhaul including valve inspection and reconditioning",
    "briefWorkDescription": "Complete cylinder head overhaul",
    "assignedTo": "Chief Engineer",
    "approver": "Technical Superintendent",
    "jobPriority": "High",
    "classRelated": "Yes",
    "department": "Engine",
    "criticality": "Yes",
    "isActive": true,
    "dataScope": "fleet",
    "vesselId": null,
    "createdAt": "2025-12-08T00:00:00.000Z",
    "updatedAt": "2025-12-08T00:00:00.000Z"
  },
  "fleet_job_mkr_in_00001": {
    "id": "fleet_job_mkr_in_00001",
    "jobNo": "MKR-IN-00001",
    "fleetJobCode": "MKR-IN-00001",
    "jobTitle": "ME Cylinder Head Routine Inspection- 4000 RHS",
    "componentId": "fleet_601.002",
    "componentCode": "601.002",
    "componentName": "ME Cylinder Covers W/ valves",
    "fleetEquipmentCode": "601.002",
    "fleetEquipmentName": "ME Cylinder Covers W/ valves",
    "maintenanceType": "Inspection",
    "maintenanceBasis": "Running Hours",
    "frequencyValue": 4000,
    "frequencyUnit": "RHS",
    "intervalRunningHour": 4000,
    "jobDescription": "Routine inspection of cylinder head and valves",
    "briefWorkDescription": "Routine cylinder head inspection",
    "assignedTo": "2nd Engineer",
    "approver": "Chief Engineer",
    "jobPriority": "Medium",
    "classRelated": "No",
    "department": "Engine",
    "criticality": "No",
    "isActive": true,
    "dataScope": "fleet",
    "vesselId": null,
    "createdAt": "2025-12-08T00:00:00.000Z",
    "updatedAt": "2025-12-08T00:00:00.000Z"
  }
};

// Add sample spare linked to component 601.002
const sampleSpares = {
  "fleet_spare_mv0001_00001": {
    "id": "fleet_spare_mv0001_00001",
    "partCode": "MV0001-00001",
    "fleetPartCode": "MV0001-00001",
    "partName": "O-Ring",
    "partNumber": "0103-0875",
    "componentId": "fleet_601.002",
    "componentCode": "601.002",
    "componentName": "ME Cylinder Covers W/ valves",
    "fleetEquipmentCode": "601.002",
    "fleetEquipmentName": "ME Cylinder Covers W/ valves",
    "maker": "MAN B&W",
    "makerCode": "MKR000001",
    "uom": "Pcs",
    "unit": "Pcs",
    "specification": "Viton O-Ring for cylinder head",
    "critical": "Yes",
    "rob": 10,
    "min": 5,
    "max": 20,
    "location": "Engine Store",
    "isActive": true,
    "dataScope": "fleet",
    "vesselId": null,
    "createdAt": "2025-12-08T00:00:00.000Z",
    "updatedAt": "2025-12-08T00:00:00.000Z"
  }
};

// Add sample vessels for mapping
const sampleVessels = {
  "MV0001": {
    "id": "MV0001",
    "code": "MV0001",
    "name": "Test Vessel_01",
    "fleetId": null,
    "imoNumber": null,
    "vesselType": "Oil Tanker",
    "flag": null,
    "isActive": true,
    "createdAt": "2025-12-08T00:00:00.000Z",
    "updatedAt": "2025-12-08T00:00:00.000Z"
  },
  "MV0002": {
    "id": "MV0002",
    "code": "MV0002",
    "name": "Test Vessel_02",
    "fleetId": null,
    "imoNumber": null,
    "vesselType": "Container",
    "flag": null,
    "isActive": true,
    "createdAt": "2025-12-08T00:00:00.000Z",
    "updatedAt": "2025-12-08T00:00:00.000Z"
  }
};

// Add component-vessel mapping
if (!data.componentVesselMappings) {
  data.componentVesselMappings = {};
}

const sampleMappings = {
  "mapping_601.002_MV0001": {
    "id": "mapping_601.002_MV0001",
    "componentId": "fleet_601.002",
    "fleetEquipmentCode": "601.002",
    "vesselId": "MV0001",
    "vesselCode": "MV0001",
    "vesselName": "Test Vessel_01",
    "isActive": true,
    "createdAt": "2025-12-08T00:00:00.000Z"
  },
  "mapping_601.002_MV0002": {
    "id": "mapping_601.002_MV0002",
    "componentId": "fleet_601.002",
    "fleetEquipmentCode": "601.002",
    "vesselId": "MV0002",
    "vesselCode": "MV0002",
    "vesselName": "Test Vessel_02",
    "isActive": true,
    "createdAt": "2025-12-08T00:00:00.000Z"
  }
};

// Merge sample data
Object.assign(data.components, sampleComponents);
Object.assign(data.jobs, sampleJobs);
Object.assign(data.spares, sampleSpares);
Object.assign(data.vessels, sampleVessels);
Object.assign(data.componentVesselMappings, sampleMappings);

// Write back
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

console.log('Sample fleet data added successfully!');
console.log('Added components:', Object.keys(sampleComponents).length);
console.log('Added jobs:', Object.keys(sampleJobs).length);
console.log('Added spares:', Object.keys(sampleSpares).length);
console.log('Added vessels:', Object.keys(sampleVessels).length);
console.log('Added mappings:', Object.keys(sampleMappings).length);
