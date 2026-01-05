import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Upload, Eye, Trash2, Edit3, X, ChevronRight, ChevronDown, Search, AlertCircle, History, GitBranch, Clock, RotateCcw, Save } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { getComponentCategory } from "@/utils/componentUtils";
import AddFieldModal from "@/components/modals/AddFieldModal";
import AddSectionModal from "@/components/modals/AddSectionModal";
import { FEATURES } from '@/config/features';
import IhmManagementModal from '@/components/modals/IhmManagementModal';
import { useQuery } from '@tanstack/react-query';

interface ComponentNode {
  id: string;
  code: string;
  name: string;
  children?: ComponentNode[];
  isExpanded?: boolean;
}

interface FormVersion {
  id: string;
  version: string;
  timestamp: Date;
  author: string;
  changes: string;
  fieldLabels: Record<string, string>;
  deletedFields: Set<string>;
  customFields: any[];
  customSections: any[];
  componentData: any;
}

interface FormConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  formName: string;
  formSubGroup?: string;
  currentVersion?: string;
  versionDate?: string;
}

// Use the same component tree data as Components screen
const dummyComponents: ComponentNode[] = [
  {
    id: "1",
    code: "1",
    name: "Ship General",
    children: [
      {
        id: "1.1",
        code: "1.1",
        name: "Fresh Water System",
        children: [
          {
            id: "1.1.1",
            code: "1.1.1",
            name: "Hydrophore Unit",
            children: [
              {
                id: "1.1.1.1",
                code: "1.1.1.1",
                name: "Pressure Vessel"
              },
              {
                id: "1.1.1.2",
                code: "1.1.1.2",
                name: "Feed Pump"
              },
              {
                id: "1.1.1.3",
                code: "1.1.1.3",
                name: "Pressure Switch"
              }
            ]
          },
          {
            id: "1.1.2",
            code: "1.1.2",
            name: "Potable Water Maker",
            children: []
          },
          {
            id: "1.1.3",
            code: "1.1.3",
            name: "UV Sterilizer",
            children: []
          }
        ]
      },
      {
        id: "1.2",
        code: "1.2",
        name: "Sewage Treatment System",
        children: []
      },
      {
        id: "1.3",
        code: "1.3",
        name: "HVAC – Accommodation",
        children: []
      }
    ]
  },
  {
    id: "2", 
    code: "2",
    name: "Hull",
    children: [
      {
        id: "2.1",
        code: "2.1",
        name: "Ballast Tanks",
        children: []
      },
      {
        id: "2.2",
        code: "2.2",
        name: "Cathodic Protection",
        children: []
      },
      {
        id: "2.3",
        code: "2.3",
        name: "Hull Openings – Hatches",
        children: []
      }
    ]
  },
  {
    id: "3",
    code: "3", 
    name: "Equipment for Cargo",
    children: [
      {
        id: "3.1",
        code: "3.1",
        name: "Cargo Cranes",
        children: []
      },
      {
        id: "3.2",
        code: "3.2",
        name: "Hatch Cover Hydraulics",
        children: []
      },
      {
        id: "3.3",
        code: "3.3",
        name: "Cargo Hold Ventilation",
        children: []
      }
    ]
  },
  {
    id: "4",
    code: "4",
    name: "Ship's Equipment",
    children: [
      {
        id: "4.1",
        code: "4.1",
        name: "Mooring System",
        children: []
      },
      {
        id: "4.2",
        code: "4.2",
        name: "Windlass",
        children: []
      },
      {
        id: "4.3",
        code: "4.3",
        name: "Steering Gear",
        children: []
      }
    ]
  },
  {
    id: "5",
    code: "5",
    name: "Equipment for Crew & Passengers",
    children: [
      {
        id: "5.1",
        code: "5.1",
        name: "Lifeboat System",
        children: []
      },
      {
        id: "5.2",
        code: "5.2",
        name: "Fire Main System",
        children: []
      },
      {
        id: "5.3",
        code: "5.3",
        name: "Emergency Lighting",
        children: []
      }
    ]
  },
  {
    id: "6",
    code: "6",
    name: "Machinery Main Components",
    isExpanded: true,
    children: [
      {
        id: "6.1",
        code: "6.1",
        name: "Main Engine",
        isExpanded: true,
        children: [
          {
            id: "6.1.1",
            code: "6.1.1",
            name: "Cylinder Head",
            isExpanded: true,
            children: [
              {
                id: "6.1.1.1",
                code: "6.1.1.1",
                name: "Valve Seats"
              },
              {
                id: "6.1.1.2",
                code: "6.1.1.2",
                name: "Injector Sleeve"
              },
              {
                id: "6.1.1.3",
                code: "6.1.1.3",
                name: "Rocker Arm"
              }
            ]
          },
          {
            id: "6.1.2",
            code: "6.1.2",
            name: "Main Bearings",
            children: []
          },
          {
            id: "6.1.3",
            code: "6.1.3",
            name: "Cylinder Liners",
            children: []
          }
        ]
      },
      {
        id: "6.2",
        code: "6.2",
        name: "Diesel Generators",
        children: [
          {
            id: "6.2.1",
            code: "6.2.1",
            name: "DG #1",
            children: []
          },
          {
            id: "6.2.2",
            code: "6.2.2",
            name: "DG #2",
            children: []
          },
          {
            id: "6.2.3",
            code: "6.2.3",
            name: "DG #3",
            children: []
          }
        ]
      },
      {
        id: "6.3",
        code: "6.3",
        name: "Auxiliary Boiler",
        children: []
      }
    ]
  },
  {
    id: "7",
    code: "7",
    name: "Systems for Machinery Main Components",
    children: [
      {
        id: "7.1",
        code: "7.1",
        name: "Fuel Oil System",
        children: []
      }
    ]
  },
  {
    id: "8",
    code: "8",
    name: "Ship Common Systems",
    children: []
  }
];

// Function to get mock data for a component based on its code
const getComponentMockData = (code: string) => {
  // Generate realistic mock data based on component code and type
  const getComponentDetails = (code: string, name?: string) => {
    // Parse component hierarchy from code
    const levels = code.split('.');
    const topLevel = levels[0];
    
    // Department mapping based on top-level code
    const departmentMap: { [key: string]: string } = {
      "1": "Hull & Deck",
      "2": "Deck Machinery",
      "3": "Accommodation",
      "4": "Ship's Equipment",
      "5": "Safety Equipment",
      "6": "Engine Department",
      "7": "Engine Systems",
      "8": "Common Systems"
    };
    
    // Location mapping
    const locationMap: { [key: string]: string } = {
      "1": "Main Deck",
      "2": "Fore Deck",
      "3": "Accommodation Block",
      "4": "Main Deck",
      "5": "Bridge/Safety Station",
      "6": "Engine Room",
      "7": "Engine Room",
      "8": "Various"
    };
    
    // Criticality based on component level and type
    const isCritical = topLevel === "6" || topLevel === "7" || (topLevel === "1" && levels.length > 2);
    
    // Generate appropriate maker based on component type
    const getMaker = () => {
      if (topLevel === "6") return ["MAN B&W", "Wärtsilä", "Caterpillar", "Yanmar"][Math.floor(Math.random() * 4)];
      if (topLevel === "1") return ["Hyundai", "Samsung", "Daewoo"][Math.floor(Math.random() * 3)];
      if (topLevel === "2") return ["MacGregor", "TTS Marine", "Rolls-Royce"][Math.floor(Math.random() * 3)];
      if (topLevel === "3") return ["Marine Air Systems", "Novenco", "Heinen & Hopman"][Math.floor(Math.random() * 3)];
      if (topLevel === "4") return ["Kongsberg", "Furuno", "JRC"][Math.floor(Math.random() * 3)];
      if (topLevel === "5") return ["Viking", "Survitec", "LALIZAS"][Math.floor(Math.random() * 3)];
      return "OEM Manufacturer";
    };
    
    // Generate model based on code
    const model = `${getMaker().split(' ')[0].toUpperCase()}-${code.replace(/\./g, '')}-${levels.length > 2 ? 'ADV' : 'STD'}`;
    
    // Generate serial number
    const serialNo = `SN-${new Date().getFullYear()}-${code.replace(/\./g, '')}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
    
    // Rating based on component type
    const getRating = () => {
      if (topLevel === "6" && levels.length === 3) return "7,200 kW";
      if (topLevel === "6" && levels.length === 4) return "High Performance";
      if (topLevel === "2") return "SWL 25 MT";
      if (topLevel === "7") return "Medium Pressure";
      return "Standard";
    };
    
    return {
      maker: getMaker(),
      model: model,
      serialNo: serialNo,
      drawingNo: `DWG-${code.replace(/\./g, '-')}`,
      department: departmentMap[topLevel] || "General",
      critical: isCritical ? "Yes" : "No",
      classItem: isCritical ? "Yes" : "No",
      location: locationMap[topLevel] || "Ship",
      commissionedDate: "2020-01-15",
      installationDate: "2019-12-20",
      rating: getRating(),
      conditionBased: levels.length > 2 ? "Yes" : "No",
      noOfUnits: levels.length === 4 ? "6" : levels.length === 3 ? "2" : "1",
      eqptSystemDept: departmentMap[topLevel] || "General",
      parentComponent: levels.length > 1 ? `Level ${levels.slice(0, -1).join('.')}` : "Ship Structure",
      dimensionsSize: levels.length === 4 ? "0.5m x 0.3m" : levels.length === 3 ? "2m x 1m" : "5m x 3m",
      notes: `Component ${code} - ${isCritical ? 'Critical for vessel operations' : 'Standard equipment'}`
    };
  };
  
  // Special cases for specific well-known components
  const specialCases: { [key: string]: any } = {
    "6.1.1": {
      maker: "MAN Energy Solutions",
      model: "6S60MC-C",
      serialNo: "ME-2020-001",
      drawingNo: "DWG-6-1-1",
      department: "Engine Department",
      critical: "Yes",
      classItem: "Yes",
      location: "Engine Room",
      commissionedDate: "2020-02-01",
      installationDate: "2020-01-15",
      rating: "7,200 kW @ 105 RPM",
      conditionBased: "Yes",
      noOfUnits: "1",
      eqptSystemDept: "Engine Department",
      parentComponent: "6.1 Main Engine",
      dimensionsSize: "15m x 3m x 4m",
      notes: "Main propulsion engine - 6 cylinder, 2-stroke diesel"
    },
    "1.1.1.1": {
      maker: "Grundfos",
      model: "CR-64-3",
      serialNo: "PV-2020-001",
      drawingNo: "DWG-1-1-1-1",
      department: "Hull & Deck",
      critical: "Yes",
      classItem: "No",
      location: "Fresh Water Room",
      commissionedDate: "2020-01-01",
      installationDate: "2019-11-15",
      rating: "300 L/min @ 6 Bar",
      conditionBased: "Yes",
      noOfUnits: "2",
      eqptSystemDept: "Hull & Deck",
      parentComponent: "1.1.1 Hydrophore Unit",
      dimensionsSize: "2m x 1m x 1.5m",
      notes: "Pressure vessel for fresh water system"
    }
  };
  
  // Return special case if exists, otherwise generate based on pattern
  return specialCases[code] || getComponentDetails(code);
};

const FormConfigurationModal: React.FC<FormConfigurationModalProps> = ({
  isOpen,
  onClose,
  formName
}) => {
  const { toast } = useToast();
  const [selectedNode, setSelectedNode] = useState<ComponentNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["6", "6.1", "6.1.1"]));
  const [isAddMode, setIsAddMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Permission state - Admin Forms should allow FULL editing (labels and data)
  const [hasFormConfigPermission] = useState(true);
  
  // Modal states for adding fields and sections
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [currentSection, setCurrentSection] = useState<string>("");
  const [showIhmModal, setShowIhmModal] = useState(false);
  
  // New fields and sections tracking
  const [customFields, setCustomFields] = useState<Record<string, any[]>>({});
  const [customSections, setCustomSections] = useState<any[]>([]);
  const [formVersion, setFormVersion] = useState(1);
  
  // Version control state
  const [versions, setVersions] = useState<FormVersion[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showSaveVersion, setShowSaveVersion] = useState(false);
  const [versionComment, setVersionComment] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<FormVersion | null>(null);
  const [showVersionComparison, setShowVersionComparison] = useState(false);
  const [currentVersionId, setCurrentVersionId] = useState("1");
  
  // Track newly added fields for session
  const [sessionAddedFields, setSessionAddedFields] = useState<Set<string>>(new Set());
  const [sessionModifiedFields, setSessionModifiedFields] = useState<Set<string>>(new Set());

  // Auto-generate component code based on parent
  const generateComponentCode = (parent: ComponentNode | null) => {
    if (!parent) return "";
    // Calculate next available number at this level
    const siblingCount = parent.children?.length || 0;
    return `${parent.code}.${siblingCount + 1}`;
  };

  // State for editable field labels and deletable fields
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [deletedFields, setDeletedFields] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [fieldLabels, setFieldLabels] = useState({
    maker: "Maker",
    model: "Model", 
    serialNo: "Serial No",
    drawingNo: "Drawing No",
    location: "Location",
    critical: "Critical",
    installation: "Installation Date",
    commissionedDate: "Commissioned Date",
    rating: "Rating",
    conditionBased: "Condition Based",
    noOfUnits: "No of Units",
    eqptSystemDept: "Eqpt / System Department",
    parentComponent: "Parent Component",
    dimensionsSize: "Dimensions/Size",
    notes: "Notes",
    runningHours: "Running Hours",
    dateUpdated: "Date Updated",
    nextDue: "Next Due",
    metric: "Metric",
    alertsThresholds: "Alerts/ Thresholds",
    woTitle: "WO Title",
    assignedTo: "Assigned To",
    maintenanceType: "Maintenance Type",
    frequency: "Frequency",
    initialNextDue: "Initial Next Due",
    classificationProvider: "Classification Provider",
    certificateNo: "Certificate No.",
    lastDataSurvey: "Last Data Survey",
    nextDataSurvey: "Next Data Survey",
    surveyType: "Survey Type",
    classRequirements: "Class Requirements",
    classCode: "Class Code",
    information: "Information"
  });

  const [componentData, setComponentData] = useState({
    componentId: "601.003.XXX",
    componentName: "",
    serialNo: "",
    drawingNo: "",
    componentCode: "",
    equipmentCategory: "",
    location: "",
    installation: "",
    componentType: "",
    rating: "",
    noOfUnits: "",
    equipmentDepartment: "",
    parentComponent: "",
    facility: "",
    runningHoursUnit1: "",
    runningHoursUnit2: "",
    maker: "",
    model: "",
    department: "",
    critical: "No",
    classItem: "No",
    conditionBased: "No",
    dimensionsSize: "",
    notes: "",
    commissionedDate: "",
    installationDate: "",
    eqptSystemDept: "",
    // Section B: Running Hours & Condition Monitoring
    runningHours: "20000",
    dateUpdated: "",
    metric: "",
    alertsThresholds: "",
    // Section C: Work Orders
    woTitle: "",
    assignedTo: "",
    maintenanceType: "",
    frequency: "",
    initialNextDue: "",
    // Section D: Maintenance History
    workOrderNo: "WO-2025-01", 
    performedBy: "Kane",
    totalTimeHrs: "3",
    completionDate: "08-Jan-2025",
    status: "Completed",
    // Section E: Spare Parts
    partCode: "SP-306-001",
    partName: "Fuel Injection",
    minQty: "5",
    criticalQty: "5",
    locationStore: "Engine Room R-3",
    // Section H: Requisitions  
    reqNo: "REQ-2025-089",
    reqPart: "Fuel Injection Pump",
    reqQty: "2",
    reqDate: "15-Jan-2025",
    reqStatus: "Pending",
    conditionMonitoringMetrics: {
      metric: "",
      interval: "",
      temperature: "",
      pressure: ""
    },
    workOrders: [],
    maintenanceHistory: [],
    spares: [],
    drawings: [],
    classificationData: {
      classificationProvider: "",
      certificateNo: "",
      lastDataSurvey: "",
      nextDataSurvey: "",
      surveyType: "",
      classRequirements: "",
      classCode: "",
      information: ""
    }
  });

  // Fetch IHM data for the component
  const { data: ihmData } = useQuery<{
    presence?: 'Unknown' | 'Present' | 'Not Present';
    evidenceType?: string;
    materials?: string[];
  }>({
    queryKey: [`/technical/api/ihm/component/${componentData.componentId}`],
    enabled: FEATURES.IHM && !!componentData.componentId,
  });

  // Handle node selection
  const handleNodeSelect = (node: ComponentNode) => {
    setSelectedNode(node);
    setIsAddMode(false);
    // Load mock data for the selected component
    const mockData = getComponentMockData(node.code);
    setComponentData(prev => ({
      ...prev,
      componentName: node.name,
      componentCode: node.code,
      serialNo: mockData.serialNo || '',
      drawingNo: mockData.drawingNo || '',
      maker: mockData.maker || '',
      model: mockData.model || '',
      location: mockData.location || '',
      installation: mockData.installationDate || '',
      rating: mockData.rating || '',
      noOfUnits: mockData.noOfUnits || '',
      equipmentDepartment: mockData.eqptSystemDept || '',
      parentComponent: mockData.parentComponent || '',
      critical: mockData.critical || 'No',
      classItem: mockData.classItem || 'No',
      conditionBased: mockData.conditionBased || 'No',
      dimensionsSize: mockData.dimensionsSize || '',
      notes: mockData.notes || '',
      commissionedDate: mockData.commissionedDate || '',
      department: mockData.department || ''
    }));
  };

  // Handle Add Sub Component
  const handleAddSubComponent = () => {
    if (!selectedNode) {
      toast({
        title: "No Parent Selected",
        description: "Select a parent in the tree to add a child component.",
        variant: "destructive"
      });
      return;
    }
    setIsAddMode(true);
    const newCode = generateComponentCode(selectedNode);
    // Reset form for new component
    setComponentData({
      componentId: "601.003.XXX",
      componentName: "",
      serialNo: "",
      drawingNo: "",
      componentCode: newCode,
      equipmentCategory: "",
      location: "",
      installation: "",
      componentType: "",
      rating: "",
      noOfUnits: "",
      equipmentDepartment: "",
      parentComponent: selectedNode.name,
      facility: "",
      runningHoursUnit1: "",
      runningHoursUnit2: "",
      maker: "",
      model: "",
      department: "",
      critical: "No",
      classItem: "No",
      conditionBased: "No",
      dimensionsSize: "",
      notes: "",
      commissionedDate: "",
      installationDate: "",
      eqptSystemDept: "",
      runningHours: "20000",
      dateUpdated: "",
      metric: "",
      alertsThresholds: "",
      woTitle: "",
      assignedTo: "",
      maintenanceType: "",
      frequency: "",
      initialNextDue: "",
      workOrderNo: "WO-2025-01",
      performedBy: "Kane",
      totalTimeHrs: "3",
      completionDate: "08-Jan-2025",
      status: "Completed",
      partCode: "SP-306-001",
      partName: "Fuel Injection",
      minQty: "5",
      criticalQty: "5",
      locationStore: "Engine Room R-3",
      reqNo: "REQ-2025-089",
      reqPart: "Fuel Injection Pump",
      reqQty: "2",
      reqDate: "15-Jan-2025",
      reqStatus: "Pending",
      conditionMonitoringMetrics: {
        metric: "",
        interval: "",
        temperature: "",
        pressure: ""
      },
      workOrders: [],
      maintenanceHistory: [],
      spares: [],
      drawings: [],
      classificationData: {
        classificationProvider: "",
        certificateNo: "",
        lastDataSurvey: "",
        nextDataSurvey: "",
        surveyType: "",
        classRequirements: "",
        classCode: "",
        information: ""
      }
    });
  };

  // Toggle node expansion
  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };
  
  // Version control functions
  const saveVersion = () => {
    const newVersion: FormVersion = {
      id: `v${versions.length + 1}`,
      version: `1.${versions.length}.0`,
      timestamp: new Date(),
      author: "Admin User",
      changes: versionComment || `Version ${versions.length + 1}`,
      fieldLabels: { ...fieldLabels },
      deletedFields: new Set(deletedFields),
      customFields: { ...customFields },
      customSections: [...customSections],
      componentData: { ...componentData }
    };
    
    const updatedVersions = [...versions, newVersion];
    setVersions(updatedVersions);
    setCurrentVersionId(newVersion.id);
    
    // Save to localStorage
    const versionsToStore = updatedVersions.map(v => ({
      ...v,
      timestamp: v.timestamp.toISOString(),
      deletedFields: Array.from(v.deletedFields)
    }));
    localStorage.setItem(`form-versions-${formName}`, JSON.stringify(versionsToStore));
    
    setShowSaveVersion(false);
    setVersionComment("");
    
    toast({
      title: "Version Saved",
      description: `Version ${newVersion.version} has been saved successfully.`
    });
  };
  
  const loadVersion = (version: FormVersion) => {
    setFieldLabels(version.fieldLabels as any);
    setDeletedFields(new Set(version.deletedFields));
    setCustomFields(version.customFields);
    setCustomSections(version.customSections);
    setComponentData(version.componentData as any);
    setCurrentVersionId(version.id);
    setShowVersionHistory(false);
    
    toast({
      title: "Version Loaded",
      description: `Form has been restored to version ${version.version}.`
    });
  };
  
  const compareVersions = (version1: FormVersion, version2: FormVersion) => {
    const changes: string[] = [];
    
    // Compare field labels
    Object.keys(version2.fieldLabels).forEach(key => {
      if (version1.fieldLabels[key] !== version2.fieldLabels[key]) {
        changes.push(`Label "${key}": "${version1.fieldLabels[key]}" → "${version2.fieldLabels[key]}"`);
      }
    });
    
    // Check for deleted fields
    const v1Deleted = Array.from(version1.deletedFields);
    const v2Deleted = Array.from(version2.deletedFields);
    const newlyDeleted = v2Deleted.filter(f => !v1Deleted.includes(f));
    if (newlyDeleted.length > 0) {
      changes.push(`Deleted fields: ${newlyDeleted.join(", ")}`);
    }
    
    return changes;
  };

  // Render component tree
  const renderComponentTree = (nodes: ComponentNode[], level: number = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(node.id);
      const isSelected = selectedNode?.id === node.id;

      return (
        <div key={node.id}>
          <div
            className={`flex items-center px-3 py-2 cursor-pointer hover:bg-white/10 ${
              isSelected ? "bg-white/20" : ""
            }`}
            style={{ paddingLeft: `${level * 20 + 12}px` }}
            onClick={() => {
              handleNodeSelect(node);
              if (hasChildren) {
                toggleNode(node.id);
              }
            }}
          >
            <button
              className="mr-2 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) {
                  toggleNode(node.id);
                }
              }}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-white" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-white" />
                )
              ) : (
                <ChevronRight className="h-4 w-4 text-white/50" />
              )}
            </button>
            <span className="text-sm text-white">
              {node.code} {node.name}
            </span>
          </div>
          {hasChildren && isExpanded && (
            <div>{renderComponentTree(node.children!, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  const handleInputChange = (field: string, value: string) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setComponentData(prev => {
        const parentValue = prev[parent as keyof typeof prev];
        return {
          ...prev,
          [parent]: {
            ...(typeof parentValue === 'object' ? parentValue : {}),
            [child]: value
          }
        };
      });
    } else {
      setComponentData(prev => ({
        ...prev,
        [field]: value
      }));
    }
    
    // Mark field as modified
    if (!sessionAddedFields.has(field)) {
      setSessionModifiedFields(prev => new Set([...Array.from(prev), field]));
    }
  };

  // Edit label functionality
  const EditableLabel = ({ fieldKey, className = "" }: { fieldKey: string; className?: string }) => {
    const isEditing = editingLabel === fieldKey;
    const label = fieldLabels[fieldKey as keyof typeof fieldLabels] || fieldKey;
    const [tempLabel, setTempLabel] = useState(label);
    const isNewField = sessionAddedFields.has(fieldKey);
    const isModified = sessionModifiedFields.has(fieldKey);

    // Update tempLabel when label changes
    useEffect(() => {
      setTempLabel(label);
    }, [label]);

    if (!hasFormConfigPermission) {
      return <div className={className || "text-sm text-[#8798ad]"}>{label}</div>;
    }

    const handleLabelSave = () => {
      setFieldLabels(prev => ({ ...prev, [fieldKey]: tempLabel }));
      setEditingLabel(null);
      // Mark as modified
      if (!sessionAddedFields.has(fieldKey)) {
        setSessionModifiedFields(prev => new Set([...Array.from(prev), fieldKey]));
      }
    };

    return (
      <div className="group flex items-center gap-1">
        {isEditing ? (
          <Input
            value={tempLabel}
            onChange={(e) => setTempLabel(e.target.value)}
            onBlur={handleLabelSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleLabelSave();
              } else if (e.key === 'Escape') {
                setTempLabel(label);
                setEditingLabel(null);
              }
            }}
            className="h-6 text-sm border-[#52baf3]"
            autoFocus
          />
        ) : (
          <div 
            className={`${className || "text-sm text-[#8798ad]"} ${hasFormConfigPermission ? 'cursor-pointer hover:text-[#52baf3]' : ''}`}
            onClick={hasFormConfigPermission ? () => {
              console.log('Label clicked:', fieldKey);
              setEditingLabel(fieldKey);
            } : undefined}
          >
            {label}
            {isNewField && <span className="ml-1 text-green-600 text-xs">(New)</span>}
            {isModified && !isNewField && <span className="ml-1 text-blue-600 text-xs">(Modified)</span>}
          </div>
        )}
        {hasFormConfigPermission && !isEditing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log('Edit button clicked:', fieldKey);
              setEditingLabel(fieldKey);
            }}
            className="opacity-50 hover:opacity-100 transition-opacity"
            title="Click to edit label"
          >
            <Edit3 className="h-3 w-3 text-gray-400 hover:text-[#52baf3]" />
          </button>
        )}
      </div>
    );
  };

  // Deletable field wrapper
  const DeletableField = ({ fieldKey, children }: { fieldKey: string; children: React.ReactNode }) => {
    if (deletedFields.has(fieldKey)) {
      return null;
    }

    if (!hasFormConfigPermission) {
      return <div className="space-y-2">{children}</div>;
    }

    return (
      <div className="space-y-2 group relative">
        {children}
        {hasFormConfigPermission && (
          <button
            onClick={() => setShowDeleteConfirm(fieldKey)}
            className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 rounded-full p-1"
          >
            <Trash2 className="h-3 w-3 text-red-600" />
          </button>
        )}
      </div>
    );
  };

  const confirmFieldDelete = () => {
    if (showDeleteConfirm) {
      setDeletedFields(prev => new Set([...Array.from(prev), showDeleteConfirm]));
      setShowDeleteConfirm(null);
      toast({
        title: "Field Deleted",
        description: `The "${fieldLabels[showDeleteConfirm as keyof typeof fieldLabels]}" field has been removed.`,
      });
    }
  };

  const cancelFieldDelete = () => {
    setShowDeleteConfirm(null);
  };

  // Render custom field based on its type
  const renderCustomField = (field: any) => {
    if (!field) return null;

    const getValue = () => {
      const val = componentData[field.key as keyof typeof componentData];
      if (typeof val === 'string' || typeof val === 'number') {
        return String(val);
      }
      return '';
    };

    const fieldElement = (() => {
      switch (field.type) {
        case 'text':
          return (
            <Input
              value={getValue()}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="border-[#52baf3] border-2 focus:border-[#52baf3]"
              required={field.required}
            />
          );
        case 'number':
          return (
            <Input
              type="number"
              value={getValue()}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="border-[#52baf3] border-2 focus:border-[#52baf3]"
              required={field.required}
            />
          );
        case 'date':
          return (
            <Input
              type="date"
              value={getValue()}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              className="border-[#52baf3] border-2 focus:border-[#52baf3]"
              required={field.required}
            />
          );
        case 'select':
          return (
            <Select
              value={getValue()}
              onValueChange={(value) => handleInputChange(field.key, value)}
            >
              <SelectTrigger className="border-[#52baf3] border-2">
                <SelectValue placeholder={field.placeholder || "Select..."} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option: string) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        case 'textarea':
          return (
            <Textarea
              value={getValue()}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="border-[#52baf3] border-2 focus:border-[#52baf3]"
              rows={field.rows || 3}
              required={field.required}
            />
          );
        case 'toggle':
          return (
            <div className="flex items-center gap-2">
              <Switch
                id={field.key}
                checked={getValue() === 'true'}
                onCheckedChange={(checked) => handleInputChange(field.key, checked ? 'true' : 'false')}
                className="data-[state=checked]:bg-[#52baf3]"
              />
              <Label htmlFor={field.key} className="text-sm">
                {field.label}
              </Label>
            </div>
          );
        default:
          return null;
      }
    })();

    if (!fieldElement) return null;

    return (
      <div key={field.key} className="space-y-2">
        {field.type !== 'toggle' && (
          <Label className="text-sm text-[#8798ad]">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
            <span className="ml-1 text-green-600 text-xs">(Custom)</span>
          </Label>
        )}
        {fieldElement}
      </div>
    );
  };

  const handleSubmit = () => {
    // Validate required fields
    if (!componentData.componentName) {
      toast({
        title: "Validation Error",
        description: "Component Name is required.",
        variant: "destructive"
      });
      return;
    }
    
    if (isAddMode && selectedNode) {
      const expectedCode = generateComponentCode(selectedNode);
      if (componentData.componentCode !== expectedCode) {
        toast({
          title: "Validation Error", 
          description: "Component Code must match tree position.",
          variant: "destructive"
        });
        return;
      }
    }

    toast({
      title: "Form Configuration Saved",
      description: "The form configuration has been saved successfully."
    });
    onClose();
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-none h-[95vh] flex flex-col">
        <DialogHeader className="pb-4 pr-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <DialogTitle>Component Register - {isAddMode ? 'Add Component' : 'Edit Component'}</DialogTitle>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                <span>Version: {versions.find(v => v.id === currentVersionId)?.version || '1.0.0'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowVersionHistory(true)}
                className="border-[#52baf3] text-[#52baf3] hover:bg-[#52baf3]/10"
              >
                <History className="h-4 w-4 mr-1" />
                Version History
              </Button>
              <Button
                size="sm"
                onClick={() => setShowSaveVersion(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Save className="h-4 w-4 mr-1" />
                Save Version
              </Button>
              <Button 
                size="sm" 
                className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
                onClick={handleAddSubComponent}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Sub Component
              </Button>
              <Button 
                size="sm" 
                className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
                onClick={handleSubmit}
              >
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Components Tree */}
          <div className="w-80 bg-[#52baf3] text-white p-4 overflow-auto">
            <div className="mb-4">
              <h3 className="font-semibold text-white mb-2">COMPONENTS</h3>
              <div className="mb-3">
                <Input
                  placeholder="Search components..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder-white/60"
                />
              </div>
              <div className="space-y-0">
                {renderComponentTree(dummyComponents)}
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-auto p-6">
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Input 
                      value={componentData.componentName || ''}
                      onChange={(e) => handleInputChange('componentName', e.target.value)}
                      placeholder="Component Name (required)"
                      className="text-lg font-semibold mb-1"
                      required
                    />
                    <div className="text-sm text-gray-500">
                      Component Code: {componentData.componentCode || 'Auto-generated'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Select defaultValue="vessel">
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vessel">Vessel</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Search Components" className="w-48" />
                    <Select defaultValue="criticality">
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="criticality">Criticality</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* A. Component Information */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold text-[#16569e]">A. Component Information</h4>
                    {hasFormConfigPermission && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setCurrentSection('A');
                          setShowAddFieldModal(true);
                        }}
                        className="text-[#52baf3] hover:text-[#52baf3]"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add field
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <EditableLabel fieldKey="maker" />
                      <Input 
                        value={componentData.maker}
                        onChange={(e) => handleInputChange('maker', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </div>
                    <div className="space-y-2">
                      <EditableLabel fieldKey="model" />
                      <Input 
                        value={componentData.model}
                        onChange={(e) => handleInputChange('model', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </div>
                    <div className="space-y-2">
                      <EditableLabel fieldKey="serialNo" />
                      <Input 
                        value={componentData.serialNo}
                        onChange={(e) => handleInputChange('serialNo', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </div>
                    <div className="space-y-2">
                      <EditableLabel fieldKey="drawingNo" />
                      <Input 
                        value={componentData.drawingNo}
                        onChange={(e) => handleInputChange('drawingNo', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Component Code</Label>
                      <Input 
                        value={componentData.componentCode}
                        readOnly
                        className="border-gray-300 bg-gray-50"
                        title="Component Code is auto-generated based on tree position"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Component Category</Label>
                      <Input 
                        value={selectedNode ? getComponentCategory(selectedNode.id) : ''}
                        readOnly
                        className="border-gray-300 bg-gray-50"
                        title="Component Category is derived from the component's tree position"
                      />
                    </div>
                    <div className="space-y-2">
                      <EditableLabel fieldKey="location" />
                      <Input 
                        value={componentData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </div>
                    <div className="space-y-2">
                      <EditableLabel fieldKey="critical" />
                      <Input 
                        value={componentData.critical}
                        onChange={(e) => handleInputChange('critical', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </div>
                    <div className="space-y-2">
                      <EditableLabel fieldKey="installation" />
                      <Input 
                        value={componentData.installation}
                        onChange={(e) => handleInputChange('installation', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </div>
                    <div className="space-y-2">
                      <EditableLabel fieldKey="commissionedDate" />
                      <Input 
                        value={componentData.commissionedDate}
                        onChange={(e) => handleInputChange('commissionedDate', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </div>
                    <div className="space-y-2">
                      <EditableLabel fieldKey="rating" />
                      <Input 
                        value={componentData.rating}
                        onChange={(e) => handleInputChange('rating', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </div>
                    <div className="space-y-2">
                      <EditableLabel fieldKey="conditionBased" />
                      <Input 
                        value={componentData.conditionBased}
                        onChange={(e) => handleInputChange('conditionBased', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </div>
                    <DeletableField fieldKey="noOfUnits">
                      <EditableLabel fieldKey="noOfUnits" />
                      <Input 
                        value={componentData.noOfUnits}
                        onChange={(e) => handleInputChange('noOfUnits', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </DeletableField>
                    <DeletableField fieldKey="eqptSystemDept">
                      <EditableLabel fieldKey="eqptSystemDept" />
                      <Input 
                        value={componentData.equipmentDepartment}
                        onChange={(e) => handleInputChange('equipmentDepartment', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </DeletableField>
                    <DeletableField fieldKey="parentComponent">
                      <EditableLabel fieldKey="parentComponent" />
                      <Input 
                        value={componentData.parentComponent}
                        onChange={(e) => handleInputChange('parentComponent', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </DeletableField>
                    <DeletableField fieldKey="dimensionsSize">
                      <EditableLabel fieldKey="dimensionsSize" />
                      <Input 
                        value={componentData.dimensionsSize}
                        onChange={(e) => handleInputChange('dimensionsSize', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </DeletableField>
                  </div>
                  
                  {/* IHM Row - Full width below No of Units */}
                  {FEATURES.IHM && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Label className="text-sm font-medium text-[#8798ad]">IHM</Label>
                          {ihmData?.presence === 'Present' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              Attention
                            </span>
                          ) : ihmData?.presence === 'Not Present' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              Compliant
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              Unknown
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowIhmModal(true)}
                        >
                          Manage IHM
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-4">
                    <DeletableField fieldKey="notes">
                      <EditableLabel fieldKey="notes" />
                      <Textarea 
                        value={componentData.notes}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                        placeholder="Notes"
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        rows={2}
                      />
                    </DeletableField>
                  </div>
                  
                  {/* Custom Fields for Section A */}
                  {customFields['A'] && customFields['A'].length > 0 && (
                    <div className="grid grid-cols-4 gap-6 mt-6 pt-6 border-t border-gray-200">
                      {customFields['A'].map(field => renderCustomField(field))}
                    </div>
                  )}
                </div>

                {/* B. Running Hours & Condition Monitoring Metrics */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold text-[#16569e]">B. Running Hours & Condition Monitoring Metrics</h4>
                    {hasFormConfigPermission && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setCurrentSection('B');
                          setShowAddFieldModal(true);
                        }}
                        className="text-[#52baf3] hover:text-[#52baf3]"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add field
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-6 mb-4">
                    <DeletableField fieldKey="runningHours">
                      <EditableLabel fieldKey="runningHours" />
                      <Input 
                        value={componentData.runningHours}
                        onChange={(e) => handleInputChange('runningHours', e.target.value)}
                        placeholder="20000"
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </DeletableField>
                    <DeletableField fieldKey="dateUpdated">
                      <EditableLabel fieldKey="dateUpdated" />
                      <Input 
                        value={componentData.dateUpdated}
                        onChange={(e) => handleInputChange('dateUpdated', e.target.value)}
                        placeholder="dd-mm-yyyy"
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </DeletableField>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-gray-900">Condition Monitoring Metrics</h5>
                      <Button size="sm" className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Metric
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <DeletableField fieldKey="metric">
                        <EditableLabel fieldKey="metric" />
                        <Input 
                          value={componentData.metric}
                          onChange={(e) => handleInputChange('metric', e.target.value)}
                          className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        />
                      </DeletableField>
                      <DeletableField fieldKey="alertsThresholds">
                        <EditableLabel fieldKey="alertsThresholds" />
                        <Input 
                          value={componentData.alertsThresholds}
                          onChange={(e) => handleInputChange('alertsThresholds', e.target.value)}
                          className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        />
                      </DeletableField>
                    </div>
                  </div>
                  
                  {/* Custom Fields for Section B */}
                  {customFields['B'] && customFields['B'].length > 0 && (
                    <div className="grid grid-cols-2 gap-6 mt-6 pt-6 border-t border-gray-200">
                      {customFields['B'].map(field => renderCustomField(field))}
                    </div>
                  )}
                </div>

                {/* C. Work Orders */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-[#16569e]">C. Work Orders</h4>
                    <div className="flex gap-2">
                      {hasFormConfigPermission && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setCurrentSection('C');
                            setShowAddFieldModal(true);
                          }}
                          className="text-[#52baf3] hover:text-[#52baf3]"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add field
                        </Button>
                      )}
                      <Button size="sm" className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white">
                        <Plus className="h-4 w-4 mr-1" />
                        Add W.O
                      </Button>
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="grid grid-cols-6 gap-4 text-sm font-medium text-gray-700">
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="woTitle" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="assignedTo" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="maintenanceType" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="frequency" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="initialNextDue" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div></div>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {isAddMode ? (
                        <div className="px-4 py-8 text-center text-sm text-gray-500">
                          No work orders yet. Click "Add W.O" to create one.
                        </div>
                      ) : (
                        <>
                          <div className="px-4 py-3">
                            <div className="grid grid-cols-6 gap-4 text-sm items-center">
                              <div className="text-gray-900">Main Engine Overhaul - Replace Main Bearings</div>
                              <div className="text-gray-900">Chief Engineer</div>
                              <div className="text-gray-900">Running Hours</div>
                              <div className="text-gray-900">500</div>
                              <div className="text-gray-900">02-Jun-2025</div>
                              <div className="flex gap-2">
                                <button className="text-gray-400 hover:text-gray-600">
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="px-4 py-3">
                            <div className="grid grid-cols-6 gap-4 text-sm items-center">
                              <div className="text-gray-900">Main Engine Overhaul - Replace Main Bearings</div>
                              <div className="text-gray-900">Chief Engineer</div>
                              <div className="text-gray-900">Calendar</div>
                              <div className="text-gray-900">30</div>
                              <div className="text-gray-900">02-Jun-2025</div>
                              <div className="flex gap-2">
                                <button className="text-gray-400 hover:text-gray-600">
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* D. Maintenance History */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-[#16569e]">D. Maintenance History</h4>
                    <div className="flex gap-2">
                      {hasFormConfigPermission && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setCurrentSection('D');
                            setShowAddFieldModal(true);
                          }}
                          className="text-[#52baf3] hover:text-[#52baf3]"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add field
                        </Button>
                      )}
                      <Button size="sm" className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white">
                        <Plus className="h-4 w-4 mr-1" />
                        Add M History
                      </Button>
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="grid grid-cols-5 gap-4 text-sm font-medium text-gray-700">
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="woTitle" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="assignedTo" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="frequency" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="dateUpdated" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="maintenanceType" className="text-sm font-medium text-gray-700" />
                        </div>
                      </div>
                    </div>
                    {isAddMode ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">
                        No maintenance history yet. Click "Add M History" to create one.
                      </div>
                    ) : (
                      <div className="px-4 py-3">
                        <div className="grid grid-cols-5 gap-4 text-sm items-center">
                          <div>
                            <Input 
                              value={componentData.workOrderNo}
                              onChange={(e) => handleInputChange('workOrderNo', e.target.value)}
                              className="border-[#52baf3] border-2 focus:border-[#52baf3] text-sm"
                            />
                          </div>
                          <div>
                            <Input 
                              value={componentData.performedBy}
                              onChange={(e) => handleInputChange('performedBy', e.target.value)}
                              className="border-[#52baf3] border-2 focus:border-[#52baf3] text-sm"
                            />
                          </div>
                          <div>
                            <Input 
                              value={componentData.totalTimeHrs}
                              onChange={(e) => handleInputChange('totalTimeHrs', e.target.value)}
                              className="border-[#52baf3] border-2 focus:border-[#52baf3] text-sm"
                            />
                          </div>
                          <div>
                            <Input 
                              value={componentData.completionDate}
                              onChange={(e) => handleInputChange('completionDate', e.target.value)}
                              className="border-[#52baf3] border-2 focus:border-[#52baf3] text-sm"
                            />
                          </div>
                          <div>
                            <Input 
                              value={componentData.status}
                              onChange={(e) => handleInputChange('status', e.target.value)}
                              className="border-[#52baf3] border-2 focus:border-[#52baf3] text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* E. Spares */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-[#16569e]">E. Spares</h4>
                    <Button size="sm" className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Spares
                    </Button>
                  </div>
                  <div className="border border-gray-200 rounded">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="grid grid-cols-5 gap-4 text-sm font-medium text-gray-700">
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="woTitle" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="assignedTo" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="metric" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="alertsThresholds" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="frequency" className="text-sm font-medium text-gray-700" />
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="grid grid-cols-5 gap-4 text-sm items-center">
                        <div>
                          <Input 
                            value={componentData.partCode}
                            onChange={(e) => handleInputChange('partCode', e.target.value)}
                            className="border-[#52baf3] border-2 focus:border-[#52baf3] text-sm"
                          />
                        </div>
                        <div>
                          <Input 
                            value={componentData.partName}
                            onChange={(e) => handleInputChange('partName', e.target.value)}
                            className="border-[#52baf3] border-2 focus:border-[#52baf3] text-sm"
                          />
                        </div>
                        <div>
                          <Input 
                            value={componentData.minQty}
                            onChange={(e) => handleInputChange('minQty', e.target.value)}
                            className="border-[#52baf3] border-2 focus:border-[#52baf3] text-sm"
                          />
                        </div>
                        <div>
                          <Input 
                            value={componentData.criticalQty}
                            onChange={(e) => handleInputChange('criticalQty', e.target.value)}
                            className="border-[#52baf3] border-2 focus:border-[#52baf3] text-sm"
                          />
                        </div>
                        <div>
                          <Input 
                            value={componentData.locationStore}
                            onChange={(e) => handleInputChange('locationStore', e.target.value)}
                            className="border-[#52baf3] border-2 focus:border-[#52baf3] text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* F. Drawings & Manuals */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-[#16569e]">F. Drawings & Manuals</h4>
                    <Button size="sm" className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Document
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 border border-[#52baf3] rounded">
                      <div className="flex items-center gap-2">
                        <EditableLabel fieldKey="woTitle" className="text-sm" />
                      </div>
                      <Upload className="h-4 w-4 text-[#52baf3]" />
                    </div>
                    <div className="flex items-center justify-between p-2 border border-[#52baf3] rounded">
                      <div className="flex items-center gap-2">
                        <EditableLabel fieldKey="assignedTo" className="text-sm" />
                      </div>
                      <Upload className="h-4 w-4 text-[#52baf3]" />
                    </div>
                    <div className="flex items-center justify-between p-2 border border-[#52baf3] rounded">
                      <div className="flex items-center gap-2">
                        <EditableLabel fieldKey="metric" className="text-sm" />
                      </div>
                      <Upload className="h-4 w-4 text-[#52baf3]" />
                    </div>
                    <div className="flex items-center justify-between p-2 border border-[#52baf3] rounded">
                      <div className="flex items-center gap-2">
                        <EditableLabel fieldKey="alertsThresholds" className="text-sm" />
                      </div>
                      <Upload className="h-4 w-4 text-[#52baf3]" />
                    </div>
                  </div>
                </div>

                {/* G. Classification & Regulatory Data */}
                <div>
                  <h4 className="text-lg font-semibold mb-4 text-[#16569e]">G. Classification & Regulatory Data</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <DeletableField fieldKey="classificationProvider">
                      <EditableLabel fieldKey="classificationProvider" />
                      <Input 
                        value={componentData.classificationData.classificationProvider}
                        onChange={(e) => handleInputChange('classificationData.classificationProvider', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </DeletableField>
                    <DeletableField fieldKey="certificateNo">
                      <EditableLabel fieldKey="certificateNo" />
                      <Input 
                        value={componentData.classificationData.certificateNo}
                        onChange={(e) => handleInputChange('classificationData.certificateNo', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </DeletableField>
                    <DeletableField fieldKey="lastDataSurvey">
                      <EditableLabel fieldKey="lastDataSurvey" />
                      <Input 
                        value={componentData.classificationData.lastDataSurvey}
                        onChange={(e) => handleInputChange('classificationData.lastDataSurvey', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </DeletableField>
                    <DeletableField fieldKey="nextDataSurvey">
                      <EditableLabel fieldKey="nextDataSurvey" />
                      <Input 
                        value={componentData.classificationData.nextDataSurvey}
                        onChange={(e) => handleInputChange('classificationData.nextDataSurvey', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </DeletableField>
                    <DeletableField fieldKey="surveyType">
                      <EditableLabel fieldKey="surveyType" />
                      <Input 
                        value={componentData.classificationData.surveyType}
                        onChange={(e) => handleInputChange('classificationData.surveyType', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </DeletableField>
                    <DeletableField fieldKey="classRequirements">
                      <EditableLabel fieldKey="classRequirements" />
                      <Input 
                        value={componentData.classificationData.classRequirements}
                        onChange={(e) => handleInputChange('classificationData.classRequirements', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </DeletableField>
                    <DeletableField fieldKey="classCode">
                      <EditableLabel fieldKey="classCode" />
                      <Input 
                        value={componentData.classificationData.classCode}
                        onChange={(e) => handleInputChange('classificationData.classCode', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </DeletableField>
                    <DeletableField fieldKey="information">
                      <EditableLabel fieldKey="information" />
                      <Input 
                        value={componentData.classificationData.information}
                        onChange={(e) => handleInputChange('classificationData.information', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                      />
                    </DeletableField>
                  </div>
                </div>

                {/* H. Requisitions */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-[#16569e]">H. Requisitions</h4>
                    <div className="flex gap-2">
                      {hasFormConfigPermission && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setCurrentSection('H');
                            setShowAddFieldModal(true);
                          }}
                          className="text-[#52baf3] hover:text-[#52baf3]"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add field
                        </Button>
                      )}
                      <Button size="sm" className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Requisition
                      </Button>
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="grid grid-cols-5 gap-4 text-sm font-medium text-gray-700">
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="woTitle" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="assignedTo" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="metric" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="dateUpdated" className="text-sm font-medium text-gray-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <EditableLabel fieldKey="frequency" className="text-sm font-medium text-gray-700" />
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="grid grid-cols-5 gap-4 text-sm items-center">
                        <div>
                          <Input 
                            value={componentData.reqNo}
                            onChange={(e) => handleInputChange('reqNo', e.target.value)}
                            className="border-[#52baf3] border-2 focus:border-[#52baf3] text-sm"
                          />
                        </div>
                        <div>
                          <Input 
                            value={componentData.reqPart}
                            onChange={(e) => handleInputChange('reqPart', e.target.value)}
                            className="border-[#52baf3] border-2 focus:border-[#52baf3] text-sm"
                          />
                        </div>
                        <div>
                          <Input 
                            value={componentData.reqQty}
                            onChange={(e) => handleInputChange('reqQty', e.target.value)}
                            className="border-[#52baf3] border-2 focus:border-[#52baf3] text-sm"
                          />
                        </div>
                        <div>
                          <Input 
                            value={componentData.reqDate}
                            onChange={(e) => handleInputChange('reqDate', e.target.value)}
                            className="border-[#52baf3] border-2 focus:border-[#52baf3] text-sm"
                          />
                        </div>
                        <div>
                          <Input 
                            value={componentData.reqStatus}
                            onChange={(e) => handleInputChange('reqStatus', e.target.value)}
                            className="border-[#52baf3] border-2 focus:border-[#52baf3] text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Render Custom Sections */}
                {customSections.map((section) => (
                  <div key={section.id}>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-semibold text-[#52baf3]">{section.title}</h4>
                      {hasFormConfigPermission && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setCurrentSection(section.id);
                            setShowAddFieldModal(true);
                          }}
                          className="text-[#52baf3] hover:text-[#52baf3]"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add field
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {section.fields?.map((field: any) => renderCustomField(field))}
                      {customFields[section.id]?.map((field: any) => renderCustomField(field))}
                    </div>
                  </div>
                ))}

                {/* Add New Section Button - Only for admins */}
                {hasFormConfigPermission && (
                  <div className="mt-6 pt-6 border-t">
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto sm:float-right text-[#52baf3] hover:text-[#52baf3] border-[#52baf3]"
                      onClick={() => setShowAddSectionModal(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add new section
                    </Button>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-end pt-6">
                  <Button 
                    size="lg" 
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-base font-medium"
                    onClick={handleSubmit}
                  >
                    Submit
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Field Deletion Confirmation Dialog */}
      <AlertDialog open={!!showDeleteConfirm} onOpenChange={cancelFieldDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{showDeleteConfirm ? fieldLabels[showDeleteConfirm as keyof typeof fieldLabels] : ''}" field? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelFieldDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmFieldDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Field Modal */}
      <AddFieldModal
        isOpen={showAddFieldModal}
        onClose={() => {
          setShowAddFieldModal(false);
          setCurrentSection('');
        }}
        onSave={(fieldData) => {
          // Add field to the appropriate section
          setCustomFields(prev => ({
            ...prev,
            [currentSection]: [...(prev[currentSection] || []), fieldData]
          }));
          
          // Mark field as newly added
          setSessionAddedFields(prev => new Set([...Array.from(prev), fieldData.key]));
          
          // Increment form version
          setFormVersion(prev => prev + 1);
          
          toast({
            title: "Field Added",
            description: `Field "${fieldData.label}" has been added to Section ${currentSection}.`,
          });
          
          setShowAddFieldModal(false);
          setCurrentSection('');
        }}
        section={currentSection}
        existingKeys={Object.keys(fieldLabels)}
        isAdmin={hasFormConfigPermission}
      />

      {/* Add Section Modal */}
      <AddSectionModal
        isOpen={showAddSectionModal}
        onClose={() => setShowAddSectionModal(false)}
        onSave={(sectionData) => {
          // Add new section
          setCustomSections(prev => [...prev, sectionData]);
          
          // Increment form version
          setFormVersion(prev => prev + 1);
          
          toast({
            title: "Section Added",
            description: `Section "${sectionData.title}" has been added to the form.`,
          });
          
          setShowAddSectionModal(false);
        }}
        nextSectionLetter={String.fromCharCode(72 + customSections.length + 1)} // Start from I (H=72, I=73)
      />
      
      {/* IHM Management Modal */}
      {FEATURES.IHM && (
        <IhmManagementModal
          isOpen={showIhmModal}
          onClose={() => setShowIhmModal(false)}
          componentId={componentData.componentId}
          type="component"
        />
      )}
    </Dialog>
    
    {/* Save Version Dialog */}
    <Dialog open={showSaveVersion} onOpenChange={setShowSaveVersion}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save Form Version</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Version Comment</Label>
            <Textarea
              placeholder="Describe the changes in this version..."
              value={versionComment}
              onChange={(e) => setVersionComment(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSaveVersion(false)}>
              Cancel
            </Button>
            <Button onClick={saveVersion} className="bg-green-600 hover:bg-green-700">
              <Save className="h-4 w-4 mr-1" />
              Save Version
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    
    {/* Version History Dialog */}
    <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh]">
          <div className="space-y-4">
            {versions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No version history available</p>
            ) : (
              versions.slice().reverse().map((version) => (
                <div
                  key={version.id}
                  className={`border rounded-lg p-4 ${
                    version.id === currentVersionId ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Version {version.version}</span>
                        {version.id === currentVersionId && (
                          <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">Current</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{version.changes}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(version.timestamp).toLocaleString()}
                        </span>
                        <span>by {version.author}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {version.id !== currentVersionId && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedVersion(version);
                              setShowVersionComparison(true);
                            }}
                          >
                            <GitBranch className="h-3 w-3 mr-1" />
                            Compare
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => loadVersion(version)}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Restore
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
    
    {/* Version Comparison Dialog */}
    <Dialog open={showVersionComparison} onOpenChange={setShowVersionComparison}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Version Comparison</DialogTitle>
        </DialogHeader>
        {selectedVersion && (
          <ScrollArea className="h-[60vh]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Current Version ({versions.find(v => v.id === currentVersionId)?.version})</h3>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Version {selectedVersion.version}</h3>
                </div>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Changes</h3>
                <ul className="space-y-2">
                  {selectedVersion && compareVersions(
                    versions.find(v => v.id === currentVersionId) || selectedVersion,
                    selectedVersion
                  ).map((change, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
};

export default FormConfigurationModal;