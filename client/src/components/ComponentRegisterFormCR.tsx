import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Plus, Upload, Eye, Trash2, Edit3, X, ChevronRight, 
  ChevronDown, Search, Save, Edit2, Link
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getComponentCategory } from "@/utils/componentUtils";
import { useChangeMode } from "@/contexts/ChangeModeContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import "../styles/change-request.css";

interface ComponentNode {
  id: string;
  code: string;
  name: string;
  children?: ComponentNode[];
  isExpanded?: boolean;
}

interface WorkOrder {
  id?: string;
  woNo?: string;
  jobTitle: string;
  assignedTo: string;
  frequencyType: "Calendar" | "Running Hours";
  frequencyValue: number;
  initialNextDue: string;
  notes?: string;
  isNew?: boolean;
  isEditing?: boolean;
  pendingDelete?: boolean;
  originalData?: any;
}

interface Spare {
  id?: string;
  partCode: string;
  partName: string;
  min: number;
  critical: "Yes" | "No";
  location: string;
  isLinkedNew?: boolean;
  pendingUnlink?: boolean;
  isEditing?: boolean;
  originalData?: any;
}

interface ComponentData {
  code: string;
  name: string;
  description: string;
  criticality: string;
  maker: string;
  makerCode: string;
  model: string;
  modelCode: string;
  serialNo: string;
  drawingNo: string;
  componentCategory: string;
  location: string;
  critical: string;
  installation: string;
  commissionedDate: string;
  rating: string;
  conditionBased: string;
  equipmentDepartment: string;
  parentComponent: string;
  notes: string;
  runningHours: string;
  utilizationRate: string;
  avgDailyUsage: string;
  fleetEquipmentCode: string;
  fleetEquipmentName: string;
  vesselId: string;
  isActive: string;
  workOrders: WorkOrder[];
  spares: Spare[];
  documents: Document[];
  classification: Classification;
  requisitions: Requisition[];
  maintenanceHistory: MaintenanceHistory[];
}

interface ConditionMetric {
  id?: string;
  name: string;
  value: number;
  isNew?: boolean;
  isEditing?: boolean;
  pendingDelete?: boolean;
  originalData?: any;
}

interface Document {
  id?: string;
  type: string;
  name: string;
  isNew?: boolean;
  pendingDelete?: boolean;
}

interface Classification {
  classProvider: string;
  certificateNo: string;
  nextDataSurvey: string;
  classNotation: string;
  surveyor: string;
}

interface Requisition {
  id?: string;
  reqNo: string;
  part: string;
  qty: number;
  date: string;
  status: string;
  isNew?: boolean;
  pendingDelete?: boolean;
}

interface MaintenanceHistory {
  id?: string;
  woNo: string;
  performedBy: string;
  totalTime: number;
  completionDate: string;
  status: string;
  isNew?: boolean;
}

interface ConditionMetric {
  id?: string;
  name: string;
  value: number;
  isNew?: boolean;
  isEditing?: boolean;
  pendingDelete?: boolean;
  originalData?: any;
}

interface FieldChange {
  from: any;
  to: any;
  path: string;
}

interface ComponentRegisterFormCRProps {
  isOpen: boolean;
  onClose: () => void;
  selectedComponent: ComponentNode | null;
}

// Generate comprehensive mock data
const generateMockComponentData = (component: ComponentNode): ComponentData => {
  const isEngine = component.code.startsWith("6");
  const isDeck = component.code.startsWith("4");
  const isHull = component.code.startsWith("2");
  const isAccommodation = component.code.startsWith("3");
  
  const baseData: ComponentData = {
    code: component.code,
    name: component.name,
    description: `${component.name} - Critical ship component for vessel operations`,
    criticality: "High",
    maker: isEngine ? "MAN B&W" : isDeck ? "MacGregor" : isHull ? "Hyundai Heavy Industries" : "Daikin Industries",
    makerCode: isEngine ? "MAN-BW" : isDeck ? "MCG" : isHull ? "HHI" : "DKN",
    model: isEngine ? "6S60ME-C8.2" : isDeck ? "TTS-2400" : isHull ? "HHI-TANK-500" : "FXMQ-200",
    modelCode: isEngine ? "6S60ME" : isDeck ? "TTS2400" : isHull ? "TANK500" : "FXMQ200",
    serialNo: `SN-${component.code.replace(/\./g, "")}-2024-${Math.floor(Math.random() * 9000) + 1000}`,
    drawingNo: `DRW-${component.code.replace(/\./g, "")}-001`,
    componentCategory: getComponentCategory(String(component.id)),
    location: isEngine ? "Engine Room" : isDeck ? "Main Deck" : isHull ? "Double Bottom" : "Accommodation Block",
    critical: Math.random() > 0.5 ? "Yes" : "No",
    installation: "2020-03-15",
    commissionedDate: "2020-04-01",
    rating: isEngine ? "6000 kW" : isDeck ? "25 tons" : isHull ? "500 m³" : "200 kW",
    conditionBased: "Yes",
    equipmentDepartment: isEngine ? "Engine" : isDeck ? "Deck" : isHull ? "Hull" : "Hotel",
    parentComponent: component.code.split(".").slice(0, -1).join(".") || "Ship",
    notes: `Regular maintenance required. Last inspection completed successfully.`,
    runningHours: String(Math.floor(Math.random() * 50000) + 10000),
    fleetEquipmentCode: `FLEET-${component.code.split(".")[0]}`,
    fleetEquipmentName: isEngine ? "Main Propulsion System" : isDeck ? "Cargo Handling System" : "Ship Structure",
    vesselId: "V001",
    isActive: "Yes",
    utilizationRate: `${Math.floor(Math.random() * 30) + 70}%`,
    avgDailyUsage: `${Math.floor(Math.random() * 8) + 16} hrs`,
    workOrders: [
      {
        id: `wo-${component.code}-1`,
        woNo: `WO-${component.code}-OHM6`,
        jobTitle: "6-Monthly Overhaul",
        assignedTo: "Chief Engineer",
        frequencyType: "Calendar",
        frequencyValue: 180,
        initialNextDue: "2025-06-01",
        notes: "Complete overhaul including all checks"
      },
      {
        id: `wo-${component.code}-2`,
        woNo: `WO-${component.code}-RH500`,
        jobTitle: "500 Hours Service",
        assignedTo: "2nd Engineer",
        frequencyType: "Running Hours",
        frequencyValue: 500,
        initialNextDue: "2025-02-15",
        notes: "Running hours based maintenance"
      },
      {
        id: `wo-${component.code}-3`,
        woNo: `WO-${component.code}-DAILY`,
        jobTitle: "Daily Checks",
        assignedTo: "3rd Engineer",
        frequencyType: "Calendar",
        frequencyValue: 1,
        initialNextDue: "2025-01-15",
        notes: ""
      }
    ],
    spares: [
      {
        id: `spare-${component.code}-1`,
        partCode: `SP-${component.code.replace(/\./g, "")}-001`,
        partName: "Gasket Set",
        min: 2,
        critical: "Yes",
        location: "Store Room A"
      },
      {
        id: `spare-${component.code}-2`,
        partCode: `SP-${component.code.replace(/\./g, "")}-002`,
        partName: "Filter Element",
        min: 5,
        critical: "No",
        location: "Engine Store"
      },
      {
        id: `spare-${component.code}-3`,
        partCode: `SP-${component.code.replace(/\./g, "")}-003`,
        partName: "Seal Ring",
        min: 10,
        critical: "No",
        location: "Store Room B"
      }
    ],
    documents: [
      { id: "doc1", type: "General Arrangement", name: "GA_Drawing_v1.pdf" },
      { id: "doc2", type: "Maintenance Manual", name: "MM_2024.pdf" },
      { id: "doc3", type: "Installation Guide", name: "IG_v2.pdf" }
    ],
    classification: {
      classProvider: "DNV GL",
      certificateNo: "CERT-2024-001234",
      nextDataSurvey: "2025-06-15",
      classNotation: "1A1 General Cargo",
      surveyor: "John Smith"
    },
    requisitions: [
      { id: "req1", reqNo: "REQ-2025-001", part: "Bearing Set", qty: 2, date: "2025-01-10", status: "Pending" },
      { id: "req2", reqNo: "REQ-2025-002", part: "Filter Element", qty: 5, date: "2025-01-12", status: "Approved" }
    ],
    maintenanceHistory: [
      { id: "mh1", woNo: "WO-2024-100", performedBy: "Chief Engineer", totalTime: 4.5, completionDate: "2024-12-01", status: "Completed" },
      { id: "mh2", woNo: "WO-2024-095", performedBy: "2nd Engineer", totalTime: 2.0, completionDate: "2024-11-15", status: "Completed" }
    ]
  };

  return baseData;
};

// Available spares for linking (mock data)
const availableSpares: Spare[] = [
  { partCode: "SP-NEW-001", partName: "Bearing Set", min: 3, critical: "Yes", location: "Store Room A" },
  { partCode: "SP-NEW-002", partName: "O-Ring Kit", min: 10, critical: "No", location: "Store Room B" },
  { partCode: "SP-NEW-003", partName: "Valve Assembly", min: 1, critical: "Yes", location: "Engine Store" },
  { partCode: "SP-NEW-004", partName: "Pump Seal", min: 5, critical: "No", location: "Store Room A" },
  { partCode: "SP-NEW-005", partName: "Pressure Gauge", min: 2, critical: "Yes", location: "Control Room" },
  { partCode: "SP-NEW-006", partName: "Temperature Sensor", min: 3, critical: "Yes", location: "Store Room C" },
  { partCode: "SP-NEW-007", partName: "Flow Meter", min: 1, critical: "No", location: "Engine Store" },
  { partCode: "SP-NEW-008", partName: "Safety Valve", min: 2, critical: "Yes", location: "Store Room A" }
];

export default function ComponentRegisterFormCR({
  isOpen,
  onClose,
  selectedComponent
}: ComponentRegisterFormCRProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isChangeMode } = useChangeMode();

  // State for component data
  const [componentData, setComponentData] = useState<ComponentData | null>(null);
  const [originalData, setOriginalData] = useState<ComponentData | null>(null);
  const [changeTracking, setChangeTracking] = useState<Map<string, FieldChange>>(new Map());
  const [sectionChangeCounts, setSectionChangeCounts] = useState<Record<string, number>>({});
  
  // State for Work Orders
  const [editingWorkOrders, setEditingWorkOrders] = useState<Set<string>>(new Set());
  const [workOrderErrors, setWorkOrderErrors] = useState<Record<string, string>>({});
  
  // State for Spares
  const [showSpareLinkPicker, setShowSpareLinkPicker] = useState(false);
  const [selectedNewSpares, setSelectedNewSpares] = useState<Set<string>>(new Set());
  const [spareSearchQuery, setSpareSearchQuery] = useState("");

  // State for expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["A", "B", "C", "D", "E", "F", "G", "H"])
  );

  // Initialize component data when component is selected
  useEffect(() => {
    if (selectedComponent) {
      const mockData = generateMockComponentData(selectedComponent);
      setComponentData(mockData);
      setOriginalData(JSON.parse(JSON.stringify(mockData))); // Deep clone
      setChangeTracking(new Map());
      setSectionChangeCounts({});
    }
  }, [selectedComponent]);

  // Track field changes
  const trackFieldChange = useCallback((path: string, newValue: any, section: string) => {
    if (!originalData || !componentData) return;

    const originalValue = path.split('.').reduce((obj, key) => obj?.[key], originalData as any);
    
    if (JSON.stringify(originalValue) !== JSON.stringify(newValue)) {
      const newTracking = new Map(changeTracking);
      newTracking.set(path, { from: originalValue, to: newValue, path });
      setChangeTracking(newTracking);
    } else {
      const newTracking = new Map(changeTracking);
      newTracking.delete(path);
      setChangeTracking(newTracking);
    }

    // Update section change counts
    updateSectionChangeCount();
  }, [originalData, componentData, changeTracking]);

  // Update section change counts
  const updateSectionChangeCount = useCallback(() => {
    const counts: Record<string, number> = {};
    
    changeTracking.forEach((change, path) => {
      const section = path.charAt(0); // Get first character as section
      counts[section] = (counts[section] || 0) + 1;
    });

    // Count Work Order changes
    if (componentData?.workOrders) {
      const woChanges = componentData.workOrders.filter(wo => 
        wo.isNew || wo.pendingDelete || wo.isEditing
      ).length;
      if (woChanges > 0) counts['C'] = (counts['C'] || 0) + woChanges;
    }

    // Count Spare changes
    if (componentData?.spares) {
      const spareChanges = componentData.spares.filter(spare => 
        spare.isLinkedNew || spare.pendingUnlink || spare.isEditing
      ).length;
      if (spareChanges > 0) counts['E'] = (counts['E'] || 0) + spareChanges;
    }

    setSectionChangeCounts(counts);
  }, [changeTracking, componentData]);

  // Handle input changes
  const handleInputChange = (field: string, value: any, section: string = 'A') => {
    if (!componentData) return;
    
    setComponentData(prev => ({
      ...prev!,
      [field]: value
    }));
    
    trackFieldChange(`${section}.${field}`, value, section);
  };

  // Work Order functions
  const handleEditWorkOrder = (woId: string) => {
    console.log('Edit Work Order clicked:', woId);
    setEditingWorkOrders(prev => new Set(prev).add(woId));
    setComponentData(prev => ({
      ...prev!,
      workOrders: prev!.workOrders.map(wo => 
        wo.wouuid === woId ? { ...wo, isEditing: true, originalData: { ...wo } } : wo
      )
    }));
  };

  const handleSaveWorkOrderEdit = (woId: string) => {
    const wo = componentData?.workOrders.find(w => w.wouuid === woId);
    if (!wo) return;

    // Validate
    if (!wo.jobTitle || !wo.frequencyType || !wo.frequencyValue || wo.frequencyValue <= 0) {
      setWorkOrderErrors({ [woId]: "Please fill all required fields" });
      return;
    }

    setEditingWorkOrders(prev => {
      const newSet = new Set(prev);
      newSet.delete(woId);
      return newSet;
    });
    
    setComponentData(prev => ({
      ...prev!,
      workOrders: prev!.workOrders.map(w => 
        w.wouuid === woId ? { ...w, isEditing: false } : w
      )
    }));
    
    setWorkOrderErrors({});
    updateSectionChangeCount();
  };

  const handleCancelWorkOrderEdit = (woId: string) => {
    setEditingWorkOrders(prev => {
      const newSet = new Set(prev);
      newSet.delete(woId);
      return newSet;
    });
    
    setComponentData(prev => ({
      ...prev!,
      workOrders: prev!.workOrders.map(wo => {
        if (wo.wouuid === woId && wo.originalData) {
          const { originalData, isEditing, ...rest } = wo;
          return { ...originalData, wouuid: wo.wouuid };
        }
        return wo;
      })
    }));
    
    setWorkOrderErrors({});
  };

  const handleDeleteWorkOrder = (woId: string) => {
    console.log('Delete Work Order clicked:', woId);
    setComponentData(prev => ({
      ...prev!,
      workOrders: prev!.workOrders.map(wo => 
        wo.wouuid === woId ? { ...wo, pendingDelete: true } : wo
      )
    }));
    updateSectionChangeCount();
  };

  const handleAddWorkOrder = () => {
    const newWO: WorkOrder = {
      wouuid: `new-wo-${Date.now()}`,
      jobTitle: "",
      assignedTo: "",
      frequencyType: "Calendar",
      frequencyValue: 30,
      initialNextDue: "",
      notes: "",
      isNew: true,
      isEditing: true
    };
    
    setComponentData(prev => ({
      ...prev!,
      workOrders: [...prev!.workOrders, newWO]
    }));
    
    setEditingWorkOrders(prev => new Set(prev).add(newWO.wouuid!));
    updateSectionChangeCount();
  };

  const handleWorkOrderFieldChange = (woId: string, field: string, value: any) => {
    setComponentData(prev => ({
      ...prev!,
      workOrders: prev!.workOrders.map(wo => 
        wo.wouuid === woId ? { ...wo, [field]: value } : wo
      )
    }));
  };

  // Spare functions
  const handleEditSpare = (spareId: string, field: string, value: any) => {
    setComponentData(prev => ({
      ...prev!,
      spares: prev!.spares.map(spare => 
        spare.id === spareId 
          ? { ...spare, [field]: value, isEditing: true } 
          : spare
      )
    }));
    updateSectionChangeCount();
  };

  const handleUnlinkSpare = (spareId: string) => {
    console.log('handleUnlinkSpare called with:', spareId);
    setComponentData(prev => ({
      ...prev!,
      spares: prev!.spares.map(spare => 
        spare.id === spareId ? { ...spare, pendingUnlink: true } : spare
      )
    }));
    updateSectionChangeCount();
  };

  const handleLinkNewSpares = () => {
    const newSpares: Spare[] = Array.from(selectedNewSpares).map(partCode => {
      const spare = availableSpares.find(s => s.partCode === partCode)!;
      return {
        ...spare,
        id: `linked-${partCode}-${Date.now()}`,
        isLinkedNew: true
      };
    });
    
    setComponentData(prev => ({
      ...prev!,
      spares: [...prev!.spares, ...newSpares]
    }));
    
    setShowSpareLinkPicker(false);
    setSelectedNewSpares(new Set());
    setSpareSearchQuery("");
    updateSectionChangeCount();
  };


  // Build change request payload
  const buildChangeRequestPayload = () => {
    if (!componentData || !originalData) return null;

    const diff: any = {};
    const summary: any = {};

    // Track Section A changes
    const sectionAFields = ['maker', 'model', 'modelCode', 'serialNo', 'location', 'critical', 
                           'installation', 'commissionedDate', 'rating', 'conditionBased',
                           'equipmentDepartment', 'parentComponent', 'notes'];
    
    let sectionACount = 0;
    sectionAFields.forEach(field => {
      if (componentData[field as keyof ComponentData] !== originalData[field as keyof ComponentData]) {
        diff[`A.${field}`] = {
          from: originalData[field as keyof ComponentData],
          to: componentData[field as keyof ComponentData]
        };
        sectionACount++;
      }
    });
    if (sectionACount > 0) summary['A'] = sectionACount;

    // Track Section B changes
    const sectionBFields = ['runningHours', 'utilizationRate', 'avgDailyUsage'];
    
    let sectionBCount = 0;
    sectionBFields.forEach(field => {
      if (componentData[field as keyof ComponentData] !== originalData[field as keyof ComponentData]) {
        diff[`B.${field}`] = {
          from: originalData[field as keyof ComponentData],
          to: componentData[field as keyof ComponentData]
        };
        sectionBCount++;
      }
    });
    if (sectionBCount > 0) summary['B'] = sectionBCount;

    // Track Work Order changes (Section C)
    const woAdded: any[] = [];
    const woModified: any[] = [];
    const woRemoved: any[] = [];

    componentData.workOrders.forEach(wo => {
      if (wo.isNew && !wo.pendingDelete) {
        woAdded.push({
          tempId: wo.wouuid,
          jobTitle: wo.jobTitle,
          assignedTo: wo.assignedTo,
          frequencyType: wo.frequencyType,
          frequencyValue: wo.frequencyValue,
          initialNextDue: wo.initialNextDue,
          notes: wo.notes
        });
      } else if (wo.pendingDelete && !wo.isNew) {
        woRemoved.push({ woNo: wo.woNo });
      } else if (wo.originalData && !wo.pendingDelete) {
        const fields: any = {};
        Object.keys(wo.originalData).forEach(key => {
          if (wo[key as keyof WorkOrder] !== wo.originalData[key]) {
            fields[key] = { from: wo.originalData[key], to: wo[key as keyof WorkOrder] };
          }
        });
        if (Object.keys(fields).length > 0) {
          woModified.push({ woNo: wo.woNo, fields });
        }
      }
    });

    if (woAdded.length > 0) diff['C.workOrders.added'] = woAdded;
    if (woModified.length > 0) diff['C.workOrders.modified'] = woModified;
    if (woRemoved.length > 0) diff['C.workOrders.removed'] = woRemoved;
    
    if (woAdded.length + woModified.length + woRemoved.length > 0) {
      summary['C'] = {
        added: woAdded.length,
        modified: woModified.length,
        removed: woRemoved.length
      };
    }

    // Track Spare changes (Section E)
    const sparesAdded: any[] = [];
    const sparesModified: any[] = [];
    const sparesRemoved: any[] = [];

    componentData.spares.forEach(spare => {
      if (spare.isLinkedNew && !spare.pendingUnlink) {
        sparesAdded.push({
          partCode: spare.partCode,
          min: spare.min,
          critical: spare.critical,
          location: spare.location
        });
      } else if (spare.pendingUnlink && !spare.isLinkedNew) {
        sparesRemoved.push({ partCode: spare.partCode });
      } else if (spare.isEditing && !spare.pendingUnlink && !spare.isLinkedNew) {
        const original = originalData.spares.find(s => s.id === spare.id);
        if (original) {
          const fields: any = {};
          if (spare.min !== original.min) fields.min = { from: original.min, to: spare.min };
          if (spare.critical !== original.critical) fields.critical = { from: original.critical, to: spare.critical };
          if (spare.location !== original.location) fields.location = { from: original.location, to: spare.location };
          
          if (Object.keys(fields).length > 0) {
            sparesModified.push({ partCode: spare.partCode, fields });
          }
        }
      }
    });

    if (sparesAdded.length > 0) diff['E.spares.added'] = sparesAdded;
    if (sparesModified.length > 0) diff['E.spares.modified'] = sparesModified;
    if (sparesRemoved.length > 0) diff['E.spares.removed'] = sparesRemoved;
    
    if (sparesAdded.length + sparesModified.length + sparesRemoved.length > 0) {
      summary['E'] = {
        added: sparesAdded.length,
        modified: sparesModified.length,
        removed: sparesRemoved.length
      };
    }

    return {
      type: "COMPONENT",
      target: {
        componentId: selectedComponent?.id,
        componentCode: selectedComponent?.code,
        componentName: selectedComponent?.name,
        vesselId: "vessel-001"
      },
      title: `Component Update - ${selectedComponent?.code} ${selectedComponent?.name}`,
      reason: "Component maintenance and configuration update",
      summary,
      diff
    };
  };

  // Submit mutation
  const submitChangeRequest = useMutation({
    mutationFn: async (payload: any) => {
      const response = await apiRequest("POST", "/technical/api/modify-pms/requests", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/modify-pms/requests"] });
      toast({
        title: "Success",
        description: "Change request submitted successfully"
      });
      onClose();
      setLocation("/pms/modify-pms");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit change request",
        variant: "destructive"
      });
    }
  });

  // Handle submit
  const handleSubmit = () => {
    // Validate all editing work orders
    const invalidWOs = componentData?.workOrders.filter(wo => 
      wo.isEditing && (!wo.jobTitle || !wo.frequencyType || !wo.frequencyValue || wo.frequencyValue <= 0)
    );
    
    if (invalidWOs && invalidWOs.length > 0) {
      toast({
        title: "Validation Error",
        description: "Please complete all work order edits before submitting",
        variant: "destructive"
      });
      return;
    }

    const payload = buildChangeRequestPayload();
    if (!payload || Object.keys(payload.diff).length === 0) {
      toast({
        title: "No Changes",
        description: "No changes have been made to submit",
        variant: "destructive"
      });
      return;
    }

    submitChangeRequest.mutate(payload);
  };

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  // Check if a field has changed
  const hasFieldChanged = (path: string): boolean => {
    return changeTracking.has(path);
  };

  // Get CSS class for changed field
  const getFieldClass = (path: string, baseClass: string = ""): string => {
    const classes = [baseClass];
    if (hasFieldChanged(path)) {
      classes.push("cr-changed");
    }
    return classes.join(" ");
  };

  // Get label class for changed field
  const getLabelClass = (path: string): string => {
    return hasFieldChanged(path) ? "cr-changed-label" : "";
  };

  if (!selectedComponent || !componentData) {
    return null;
  }

  // Filter spares for link picker
  const filteredAvailableSpares = availableSpares.filter(spare => 
    !componentData.spares.some(s => s.partCode === spare.partCode) &&
    (spare.partCode.toLowerCase().includes(spareSearchQuery.toLowerCase()) ||
     spare.partName.toLowerCase().includes(spareSearchQuery.toLowerCase()))
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#2c5282]">
            Modify PMS - {selectedComponent.code} {selectedComponent.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Section A - Component Information */}
          <div className={expandedSections.has('A') ? "cr-changed-row" : ""}>
            <h4 
              className="text-lg font-semibold mb-4 text-[#16569e] cursor-pointer flex items-center justify-between"
              onClick={() => toggleSection('A')}
            >
              <span className="flex items-center">
                A. Component Information
                {sectionChangeCounts['A'] > 0 && (
                  <span className="section-chip">
                    {sectionChangeCounts['A']} changes
                  </span>
                )}
              </span>
              {expandedSections.has('A') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </h4>
            
            {expandedSections.has('A') && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.maker')}>Maker</Label>
                    <Input 
                      value={componentData.maker}
                      onChange={(e) => handleInputChange('maker', e.target.value, 'A')}
                      className={getFieldClass('A.maker', "border-[#52baf3] border-2")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.makerCode')}>Maker Code</Label>
                    <Input 
                      value={componentData.makerCode}
                      onChange={(e) => handleInputChange('makerCode', e.target.value, 'A')}
                      className={getFieldClass('A.makerCode', "border-[#52baf3] border-2")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.serialNo')}>Serial No</Label>
                    <Input 
                      value={componentData.serialNo}
                      onChange={(e) => handleInputChange('serialNo', e.target.value, 'A')}
                      className={getFieldClass('A.serialNo', "border-[#52baf3] border-2")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.model')}>Model</Label>
                    <Input 
                      value={componentData.model}
                      onChange={(e) => handleInputChange('model', e.target.value, 'A')}
                      className={getFieldClass('A.model', "border-[#52baf3] border-2")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.modelCode')}>Model Code</Label>
                    <Input 
                      value={componentData.modelCode}
                      onChange={(e) => handleInputChange('modelCode', e.target.value, 'A')}
                      className={getFieldClass('A.modelCode', "border-[#52baf3] border-2")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.drawingNo')}>Drawing No</Label>
                    <Input 
                      value={componentData.drawingNo}
                      onChange={(e) => handleInputChange('drawingNo', e.target.value, 'A')}
                      className={getFieldClass('A.drawingNo', "border-[#52baf3] border-2")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Component Code</Label>
                    <Input 
                      value={componentData.code}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.componentCategory')}>Component Category</Label>
                    <Select 
                      value={componentData.componentCategory}
                      onValueChange={(value) => handleInputChange('componentCategory', value, 'A')}
                    >
                      <SelectTrigger className={getFieldClass('A.componentCategory', "border-[#52baf3] border-2")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ship's Structure">Ship's Structure</SelectItem>
                        <SelectItem value="Deck Machinery">Deck Machinery</SelectItem>
                        <SelectItem value="Engine Department">Engine Department</SelectItem>
                        <SelectItem value="Safety Equipment">Safety Equipment</SelectItem>
                        <SelectItem value="Accommodation">Accommodation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.location')}>Location</Label>
                    <Input 
                      value={componentData.location}
                      onChange={(e) => handleInputChange('location', e.target.value, 'A')}
                      className={getFieldClass('A.location', "border-[#52baf3] border-2")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.critical')}>Criticality</Label>
                    <Select 
                      value={componentData.critical}
                      onValueChange={(value) => handleInputChange('critical', value, 'A')}
                    >
                      <SelectTrigger className={getFieldClass('A.critical', "border-[#52baf3] border-2")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.conditionBased')}>Condition Based</Label>
                    <Select 
                      value={componentData.conditionBased}
                      onValueChange={(value) => handleInputChange('conditionBased', value, 'A')}
                    >
                      <SelectTrigger className={getFieldClass('A.conditionBased', "border-[#52baf3] border-2")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.installation')}>Installation Date</Label>
                    <Input 
                      type="date"
                      value={componentData.installation}
                      onChange={(e) => handleInputChange('installation', e.target.value, 'A')}
                      className={getFieldClass('A.installation', "border-[#52baf3] border-2")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.commissionedDate')}>Commissioned Date</Label>
                    <Input 
                      type="date"
                      value={componentData.commissionedDate}
                      onChange={(e) => handleInputChange('commissionedDate', e.target.value, 'A')}
                      className={getFieldClass('A.commissionedDate', "border-[#52baf3] border-2")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.rating')}>Rating</Label>
                    <Input 
                      value={componentData.rating}
                      onChange={(e) => handleInputChange('rating', e.target.value, 'A')}
                      className={getFieldClass('A.rating', "border-[#52baf3] border-2")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.equipmentDepartment')}>Equipment / System Department</Label>
                    <Input 
                      value={componentData.equipmentDepartment}
                      onChange={(e) => handleInputChange('equipmentDepartment', e.target.value, 'A')}
                      className={getFieldClass('A.equipmentDepartment', "border-[#52baf3] border-2")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.parentComponent')}>Parent Component Code</Label>
                    <Input 
                      value={componentData.parentComponent}
                      onChange={(e) => handleInputChange('parentComponent', e.target.value, 'A')}
                      className={getFieldClass('A.parentComponent', "border-[#52baf3] border-2")}
                      placeholder="Select parent component"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.fleetEquipmentCode')}>Fleet Equipment Code</Label>
                    <Input 
                      value={componentData.fleetEquipmentCode}
                      onChange={(e) => handleInputChange('fleetEquipmentCode', e.target.value, 'A')}
                      className={getFieldClass('A.fleetEquipmentCode', "border-[#52baf3] border-2")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.fleetEquipmentName')}>Fleet Equipment Name</Label>
                    <Input 
                      value={componentData.fleetEquipmentName}
                      onChange={(e) => handleInputChange('fleetEquipmentName', e.target.value, 'A')}
                      className={getFieldClass('A.fleetEquipmentName', "border-[#52baf3] border-2")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.vesselId')}>Vessel Code</Label>
                    <Input 
                      value={componentData.vesselId}
                      onChange={(e) => handleInputChange('vesselId', e.target.value, 'A')}
                      className={getFieldClass('A.vesselId', "border-[#52baf3] border-2")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.isActive')}>IS Active</Label>
                    <Select 
                      value={componentData.isActive}
                      onValueChange={(value) => handleInputChange('isActive', value, 'A')}
                    >
                      <SelectTrigger className={getFieldClass('A.isActive', "border-[#52baf3] border-2")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <Label className={getLabelClass('A.notes')}>Notes</Label>
                    <Textarea 
                      value={componentData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value, 'A')}
                      className={getFieldClass('A.notes', "border-[#52baf3] border-2")}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section B - Running Hours */}
          <div>
            <h4 
              className="text-lg font-semibold mb-4 text-[#16569e] cursor-pointer flex items-center justify-between"
              onClick={() => toggleSection('B')}
            >
              <span className="flex items-center">
                B. Running Hours
                {sectionChangeCounts['B'] > 0 && (
                  <span className="section-chip">
                    {sectionChangeCounts['B']} changes
                  </span>
                )}
              </span>
              {expandedSections.has('B') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </h4>
            
            {expandedSections.has('B') && (
              <div className="space-y-6">
                <div className="space-y-2 max-w-xs">
                  <Label className={getLabelClass('B.runningHours')}>Running Hours</Label>
                  <Input 
                    type="number"
                    value={componentData.runningHours}
                    onChange={(e) => handleInputChange('runningHours', e.target.value, 'B')}
                    className={getFieldClass('B.runningHours', "border-[#52baf3] border-2")}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section C - Work Orders */}
          <div>
            <h4 
              className="text-lg font-semibold mb-4 text-[#16569e] cursor-pointer flex items-center justify-between"
              onClick={() => toggleSection('C')}
            >
              <span className="flex items-center">
                C. Work Orders
                {sectionChangeCounts['C'] > 0 && (
                  <span className="section-chip">
                    {sectionChangeCounts['C']} changes
                  </span>
                )}
              </span>
              {expandedSections.has('C') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </h4>
            
            {expandedSections.has('C') && (
              <div>
                <div className="flex justify-end mb-4 gap-2">
                  <Button 
                    onClick={() => {
                      console.log('Test button clicked!');
                      alert('Test button works!');
                    }}
                    className="bg-gray-500 hover:bg-gray-600 text-white"
                  >
                    Test Click
                  </Button>
                  <Button 
                    onClick={handleAddWorkOrder}
                    className="bg-[#52baf3] hover:bg-[#4299d1] text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Work Order
                  </Button>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Job Title</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Assigned To</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Frequency Type</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Frequency Value</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Initial Next Due</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Notes</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {componentData.workOrders.map((wo) => (
                        <tr 
                          key={wo.wouuid} 
                          className={`
                            ${wo.pendingDelete ? 'strike-removed cr-changed-row' : ''}
                            ${wo.isNew ? 'cr-new-item' : ''}
                            ${wo.isEditing && !wo.isNew ? 'cr-modified-item' : ''}
                          `}
                        >
                          {wo.isEditing && !wo.pendingDelete ? (
                            <>
                              <td className="px-4 py-2">
                                <Input 
                                  value={wo.jobTitle}
                                  onChange={(e) => handleWorkOrderFieldChange(wo.wouuid!, 'jobTitle', e.target.value)}
                                  className={`h-8 ${workOrderErrors[wo.wouuid!] && !wo.jobTitle ? 'border-red-500' : ''}`}
                                  placeholder="Job Title"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <Input 
                                  value={wo.assignedTo}
                                  onChange={(e) => handleWorkOrderFieldChange(wo.wouuid!, 'assignedTo', e.target.value)}
                                  className="h-8"
                                  placeholder="Assigned To"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <Select 
                                  value={wo.frequencyType}
                                  onValueChange={(value) => handleWorkOrderFieldChange(wo.wouuid!, 'frequencyType', value)}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Calendar">Calendar</SelectItem>
                                    <SelectItem value="Running Hours">Running Hours</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-4 py-2">
                                <Input 
                                  type="number"
                                  value={wo.frequencyValue}
                                  onChange={(e) => handleWorkOrderFieldChange(wo.wouuid!, 'frequencyValue', parseInt(e.target.value))}
                                  className={`h-8 ${workOrderErrors[wo.wouuid!] && wo.frequencyValue <= 0 ? 'border-red-500' : ''}`}
                                  placeholder="Value"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <Input 
                                  type="date"
                                  value={wo.initialNextDue}
                                  onChange={(e) => handleWorkOrderFieldChange(wo.wouuid!, 'initialNextDue', e.target.value)}
                                  className="h-8"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <Input 
                                  value={wo.notes || ''}
                                  onChange={(e) => handleWorkOrderFieldChange(wo.wouuid!, 'notes', e.target.value)}
                                  className="h-8"
                                  placeholder="Notes"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm"
                                    onClick={() => handleSaveWorkOrderEdit(wo.wouuid!)}
                                    className="bg-green-600 hover:bg-green-700 text-white h-8"
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCancelWorkOrderEdit(wo.wouuid!)}
                                    className="h-8"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-2 text-sm">{wo.jobTitle}</td>
                              <td className="px-4 py-2 text-sm">{wo.assignedTo}</td>
                              <td className="px-4 py-2 text-sm">{wo.frequencyType}</td>
                              <td className="px-4 py-2 text-sm">{wo.frequencyValue}</td>
                              <td className="px-4 py-2 text-sm">{wo.initialNextDue}</td>
                              <td className="px-4 py-2 text-sm">{wo.notes}</td>
                              <td className="px-4 py-2">
                                {!wo.pendingDelete && (
                                  <div className="flex gap-2">
                                    <Button 
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('Edit button actually clicked for:', wo.wouuid);
                                        handleEditWorkOrder(wo.wouuid!);
                                      }}
                                      className="h-8"
                                      type="button"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('Delete button actually clicked for:', wo.wouuid);
                                        handleDeleteWorkOrder(wo.wouuid!);
                                      }}
                                      className="h-8 text-red-600 hover:text-red-700"
                                      type="button"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {workOrderErrors[Object.keys(workOrderErrors)[0]] && (
                    <div className="field-error px-4 py-2">
                      {workOrderErrors[Object.keys(workOrderErrors)[0]]}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section E - Spares */}
          <div>
            <h4 
              className="text-lg font-semibold mb-4 text-[#16569e] cursor-pointer flex items-center justify-between"
              onClick={() => toggleSection('E')}
            >
              <span className="flex items-center">
                E. Spares
                {sectionChangeCounts['E'] > 0 && (
                  <span className="section-chip">
                    {sectionChangeCounts['E']} changes
                  </span>
                )}
              </span>
              {expandedSections.has('E') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </h4>
            
            {expandedSections.has('E') && (
              <div>
                <div className="flex justify-end mb-4">
                  <Button 
                    onClick={() => setShowSpareLinkPicker(true)}
                    className="bg-[#52baf3] hover:bg-[#4299d1] text-white"
                  >
                    <Link className="h-4 w-4 mr-2" />
                    Link Spares
                  </Button>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Part Code</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Part Name</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Min</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Critical</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Location</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {componentData.spares.map((spare) => (
                        <tr 
                          key={spare.id} 
                          className={`
                            ${spare.pendingUnlink ? 'strike-removed cr-changed-row' : ''}
                            ${spare.isLinkedNew ? 'cr-new-item' : ''}
                            ${spare.isEditing && !spare.isLinkedNew ? 'cr-modified-item' : ''}
                          `}
                        >
                          <td className="px-4 py-2 text-sm">{spare.partCode}</td>
                          <td className="px-4 py-2 text-sm">{spare.partName}</td>
                          <td className="px-4 py-2">
                            <Input 
                              type="number"
                              value={spare.min}
                              onChange={(e) => handleEditSpare(spare.id!, 'min', parseInt(e.target.value))}
                              className={`h-8 w-20 ${spare.isEditing ? 'cr-changed' : ''}`}
                              disabled={spare.pendingUnlink}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Select 
                              value={spare.critical}
                              onValueChange={(value) => handleEditSpare(spare.id!, 'critical', value)}
                              disabled={spare.pendingUnlink}
                            >
                              <SelectTrigger className={`h-8 w-24 ${spare.isEditing ? 'cr-changed' : ''}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Yes">Yes</SelectItem>
                                <SelectItem value="No">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2">
                            <Input 
                              value={spare.location}
                              onChange={(e) => handleEditSpare(spare.id!, 'location', e.target.value)}
                              className={`h-8 ${spare.isEditing ? 'cr-changed' : ''}`}
                              disabled={spare.pendingUnlink}
                            />
                          </td>
                          <td className="px-4 py-2">
                            {!spare.pendingUnlink && (
                              <Button 
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log('Unlink spare clicked:', spare.id);
                                  handleUnlinkSpare(spare.id!);
                                }}
                                className="h-8 text-red-600 hover:text-red-700"
                                type="button"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={submitChangeRequest.isPending}
              className="bg-[#52baf3] hover:bg-[#4299d1] text-white"
            >
              {submitChangeRequest.isPending ? "Submitting..." : "Submit Change Request"}
            </Button>
          </div>
        </div>

        {/* Spare Link Picker Dialog */}
        {showSpareLinkPicker && (
          <Dialog open={showSpareLinkPicker} onOpenChange={setShowSpareLinkPicker}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Link Spares to Component</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-gray-400" />
                  <Input 
                    placeholder="Search by part code or name..."
                    value={spareSearchQuery}
                    onChange={(e) => setSpareSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="spare-link-picker">
                  {filteredAvailableSpares.map((spare) => (
                    <div 
                      key={spare.partCode}
                      className={`spare-link-item ${selectedNewSpares.has(spare.partCode) ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedNewSpares(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(spare.partCode)) {
                            newSet.delete(spare.partCode);
                          } else {
                            newSet.add(spare.partCode);
                          }
                          return newSet;
                        });
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{spare.partCode}</div>
                          <div className="text-sm text-gray-600">{spare.partName}</div>
                        </div>
                        <div className="text-right text-sm">
                          <div>Min: {spare.min}</div>
                          <div>Critical: {spare.critical}</div>
                          <div>{spare.location}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-end gap-4 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowSpareLinkPicker(false);
                      setSelectedNewSpares(new Set());
                      setSpareSearchQuery("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleLinkNewSpares}
                    disabled={selectedNewSpares.size === 0}
                    className="bg-[#52baf3] hover:bg-[#4299d1] text-white"
                  >
                    Link {selectedNewSpares.size} Spare{selectedNewSpares.size !== 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}