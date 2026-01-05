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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowLeft, Plus, Upload, Eye, Trash2, Edit3, X, ChevronRight, ChevronDown, Search, AlertCircle } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { getComponentCategory } from "@/utils/componentUtils";
import AddFieldModal from "@/components/modals/AddFieldModal";
import AddSectionModal from "@/components/modals/AddSectionModal";
import { FEATURES } from '@/config/features';
import IhmManagementModal from '@/components/modals/IhmManagementModal';
import { useQuery } from '@tanstack/react-query';
import { useVessel } from "@/contexts/VesselContext";

interface ComponentNode {
  id: string;
  code: string;
  name: string;
  children?: ComponentNode[];
  isExpanded?: boolean;
}

interface ComponentRegisterFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (componentData: any) => void;
  parentComponent?: { code: string; id: string; name: string } | null;
}

const ComponentRegisterForm: React.FC<ComponentRegisterFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  parentComponent,
}) => {
  const { toast } = useToast();
  const { vesselId } = useVessel();
  
  // Fetch components from API
  const { data: fetchedComponents = [], isLoading: isLoadingComponents } = useQuery<any[]>({
    queryKey: [`/technical/api/components/${vesselId}`],
  });
  
  const [selectedNode, setSelectedNode] = useState<ComponentNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["6", "6.1", "6.1.1"]));
  const [isAddMode, setIsAddMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Permission state - Components module should NOT allow label editing
  const [hasFormConfigPermission] = useState(false);
  
  // Modal states for adding fields and sections
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [currentSection, setCurrentSection] = useState<string>("");
  const [showIhmModal, setShowIhmModal] = useState(false);
  
  // New fields and sections tracking
  const [customFields, setCustomFields] = useState<Record<string, any[]>>({});
  const [customSections, setCustomSections] = useState<any[]>([]);
  const [formVersion, setFormVersion] = useState(1);
  
  // Track newly added fields for session
  const [sessionAddedFields, setSessionAddedFields] = useState<Set<string>>(new Set());
  const [sessionModifiedFields, setSessionModifiedFields] = useState<Set<string>>(new Set());
  
  // Collapsible sections state (B-H) - all start collapsed
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    B: true,
    C: true,
    D: true,
    E: true,
    F: true,
    G: true,
    H: true,
  });

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
    criticality: "Criticality",
    installation: "Installation Date",
    commissionedDate: "Commissioned Date",
    rating: "Rating",
    conditionBased: "Condition Based",
    equipmentDepartment: "Equipment / System Department",
    parentComponentCode: "Parent Component Code",
    notes: "Notes",
    runningHours: "Running Hours",
    nextDue: "Next Due",
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
    componentId: "",
    componentName: "",
    serialNo: "",
    drawingNo: "",
    componentCode: "",
    equipmentCategory: "",
    location: "",
    installation: "",
    componentType: "",
    rating: "",
    equipmentDepartment: "",
    parentComponent: "",
    facility: "",
    runningHoursUnit1: "",
    runningHoursUnit2: "",
    maker: "",
    makerCode: "",
    model: "",
    modelCode: "",
    department: "",
    criticality: "",
    classItem: "",
    conditionBased: "",
    notes: "",
    commissionedDate: "",
    installationDate: "",
    fleetEquipmentCode: "",
    fleetEquipmentName: "",
    vesselCode: "",
    isActive: "",
    isParent: "",
    // Section B: Running Hours
    runningHours: "",
    // Section C: Work Orders
    woTitle: "",
    assignedTo: "",
    maintenanceType: "",
    frequency: "",
    initialNextDue: "",
    // Section D: Maintenance History
    workOrderNo: "",
    performedBy: "",
    totalTimeHrs: "",
    completionDate: "",
    status: "",
    // Section E: Spare Parts
    partCode: "",
    partName: "",
    minQty: "",
    criticalQty: "",
    locationStore: "",
    // Section H: Requisitions  
    requisitions: [],
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

  // Fetch linked spares with inventory for the component
  const { data: linkedSparesResponse, isLoading: isLoadingLinkedSpares } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['/technical/api/inventory/spares-by-component', componentData.componentId],
    enabled: !!componentData.componentId,
  });
  const linkedSpares = linkedSparesResponse?.data || [];

  // State for viewing spare detail dialog
  const [selectedSpareDetail, setSelectedSpareDetail] = useState<any | null>(null);

  // Build component tree from fetched data
  const componentTreeData = React.useMemo(() => {
    // Start with the 8 main categories
    const mainCategories: ComponentNode[] = [
      { id: "1", code: "1", name: "Ship General", children: [] },
      { id: "2", code: "2", name: "Hull", children: [] },
      { id: "3", code: "3", name: "Equipment for Cargo", children: [] },
      { id: "4", code: "4", name: "Ship's Equipment", children: [] },
      { id: "5", code: "5", name: "Equipment for Crew & Passengers", children: [] },
      { id: "6", code: "6", name: "Machinery Main Components", children: [] },
      { id: "7", code: "7", name: "Systems for Machinery Main Components", children: [] },
      { id: "8", code: "8", name: "Ship Common Systems", children: [] }
    ];
    
    if (!fetchedComponents || fetchedComponents.length === 0) {
      return mainCategories;
    }
    
    // Build a map for quick lookup
    const componentMap = new Map<string, ComponentNode>();
    
    // First, add all main categories to the map
    mainCategories.forEach(cat => {
      componentMap.set(cat.code, cat);
    });
    
    // Convert fetched components to ComponentNode format and add to map
    // Skip main categories (1-8) as they're already in the map
    fetchedComponents.forEach((comp: any) => {
      const code = comp.componentCode || comp.id;
      // Skip if this is a main category (single digit 1-8)
      if (code.match(/^[1-8]$/)) {
        return;
      }
      const node: ComponentNode = {
        id: code,
        code: code,
        name: comp.name,
        ...comp,
        critical: comp.critical === "Yes" || comp.critical === true,
        children: []
      };
      componentMap.set(node.code, node);
    });
    
    // Build parent-child relationships
    fetchedComponents.forEach((comp: any) => {
      const code = comp.componentCode || comp.id;
      const node = componentMap.get(code);
      
      if (!node) return;
      
      if (comp.parentId) {
        // Has explicit parent ID - use it
        const parent = componentMap.get(comp.parentId);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(node);
        }
      } else {
        // No parent ID - determine category from code prefix
        const categoryCode = code.split('.')[0];
        const category = componentMap.get(categoryCode);
        if (category && categoryCode !== code) {
          if (!category.children) {
            category.children = [];
          }
          category.children.push(node);
        }
      }
    });
    
    return mainCategories;
  }, [fetchedComponents]);

  // Handle node selection
  const handleNodeSelect = (node: ComponentNode) => {
    setSelectedNode(node);
    setIsAddMode(false);
    // Load actual component data from the node object (which contains real database values)
    setComponentData(prev => ({
      ...prev,
      componentId: node.id || '',
      componentName: node.name || '',
      componentCode: node.code || '',
      serialNo: (node as any).serialNo || '',
      drawingNo: (node as any).drawingNo || '',
      maker: (node as any).maker || '',
      model: (node as any).model || '',
      location: (node as any).location || '',
      installation: (node as any).installationDate || (node as any).installation || '',
      rating: (node as any).rating || '',
      noOfUnits: (node as any).noOfUnits || '',
      equipmentDepartment: (node as any).equipmentDepartment || (node as any).eqptSystemDept || '',
      parentComponent: (node as any).parentComponent || '',
      critical: (node as any).critical ? 'Yes' : 'No',
      classItem: (node as any).classItem || 'No',
      conditionBased: (node as any).conditionBased || 'No',
      dimensionsSize: (node as any).dimensionsSize || '',
      notes: (node as any).notes || '',
      commissionedDate: (node as any).commissionedDate || '',
      department: (node as any).department || '',
      installationDate: (node as any).installationDate || '',
      eqptSystemDept: (node as any).eqptSystemDept || '',
      runningHours: (node as any).runningHours?.toString() || '',
      // Clear out arrays and other sections - these should come from separate API calls if needed
      workOrders: [],
      maintenanceHistory: [],
      spares: [],
      requisitions: [],
      drawings: []
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
    // Reset form for new component - completely blank except for auto-generated code and parent
    setComponentData({
      componentId: "",
      componentName: "",
      serialNo: "",
      drawingNo: "",
      componentCode: newCode,
      equipmentCategory: "",
      location: "",
      installation: "",
      componentType: "",
      rating: "",
      equipmentDepartment: "",
      parentComponent: selectedNode.name,
      facility: "",
      runningHoursUnit1: "",
      runningHoursUnit2: "",
      maker: "",
      makerCode: "",
      model: "",
      modelCode: "",
      department: "",
      criticality: "",
      classItem: "",
      conditionBased: "",
      notes: "",
      commissionedDate: "",
      installationDate: "",
      fleetEquipmentCode: "",
      fleetEquipmentName: "",
      vesselCode: "",
      isActive: "",
      isParent: "",
      // Section B: Running Hours
      runningHours: "",
      // Section C: Work Orders
      woTitle: "",
      assignedTo: "",
      maintenanceType: "",
      frequency: "",
      initialNextDue: "",
      // Section D: Maintenance History
      workOrderNo: "",
      performedBy: "",
      totalTimeHrs: "",
      completionDate: "",
      status: "",
      // Section E: Spare Parts
      partCode: "",
      partName: "",
      minQty: "",
      criticalQty: "",
      locationStore: "",
      // Section H: Requisitions
      requisitions: [],
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
            ...(typeof parentValue === 'object' && parentValue !== null ? parentValue as any : {}),
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
  };

  // Handle label editing
  const handleLabelEdit = (fieldKey: string) => {
    setEditingLabel(fieldKey);
  };

  const handleLabelSave = (fieldKey: string, newLabel: string) => {
    setFieldLabels(prev => ({
      ...prev,
      [fieldKey]: newLabel
    }));
    setEditingLabel(null);
  };

  const handleLabelCancel = () => {
    setEditingLabel(null);
  };

  // Field deletion handlers
  const handleFieldDelete = (fieldKey: string) => {
    setShowDeleteConfirm(fieldKey);
  };

  const confirmFieldDelete = () => {
    if (showDeleteConfirm) {
      setDeletedFields(prev => new Set([...Array.from(prev), showDeleteConfirm]));
      setShowDeleteConfirm(null);
      toast({
        title: "Field Deleted",
        description: `${fieldLabels[showDeleteConfirm as keyof typeof fieldLabels]} field has been removed.`,
      });
    }
  };

  const cancelFieldDelete = () => {
    setShowDeleteConfirm(null);
  };

  // Editable Label Component with deletion support
  const EditableLabel = ({ fieldKey, className = "" }: { fieldKey: string; className?: string }) => {
    const isEditing = editingLabel === fieldKey;
    const label = fieldLabels[fieldKey as keyof typeof fieldLabels] || fieldKey;
    const isNewField = sessionAddedFields.has(fieldKey);
    const isModified = sessionModifiedFields.has(fieldKey);

    // If no permission, just return a plain label
    if (!hasFormConfigPermission) {
      return <Label className={className || "text-sm text-[#8798ad]"}>{label}</Label>;
    }

    // Admin has permission - allow editing
    return (
      <div className="flex items-center gap-1">
        {isEditing ? (
          <Input
            value={label}
            onChange={(e) => setFieldLabels(prev => ({ ...prev, [fieldKey]: e.target.value }))}
            onBlur={() => setEditingLabel(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setEditingLabel(null);
              }
            }}
            className="h-6 text-sm"
            autoFocus
          />
        ) : (
          <Label className={className || "text-sm text-[#8798ad]"}>
            {label}
            {isNewField && <span className="ml-1 text-green-600 text-xs">(New)</span>}
            {isModified && !isNewField && <span className="ml-1 text-blue-600 text-xs">(Modified)</span>}
          </Label>
        )}
        {hasFormConfigPermission && !isEditing && (
          <button
            onClick={() => setEditingLabel(fieldKey)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Edit3 className="h-3 w-3 text-gray-400" />
          </button>
        )}
      </div>
    );
  };

  // Deletable Field Wrapper Component
  const DeletableField = ({ fieldKey, children, className = "space-y-2" }: { fieldKey: string, children: React.ReactNode, className?: string }) => {
    if (deletedFields.has(fieldKey)) {
      return null;
    }

    return (
      <div className={className}>
        {children}
      </div>
    );
  };

  // Render custom field based on type
  const renderCustomField = (field: any) => {
    const isNewField = sessionAddedFields.has(field.key);
    const isModified = sessionModifiedFields.has(field.key);
    const borderColor = isModified ? '#FF3B30' : '#52baf3';
    
    switch (field.type) {
      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <Label className={`text-sm ${isModified ? 'text-[#FF3B30]' : 'text-[#52baf3]'} cursor-pointer hover:underline`}>
              {field.label} {field.required && '*'}
            </Label>
            <Textarea 
              placeholder={field.placeholder}
              className={`border-2 focus:border-[${borderColor}]`}
              style={{ borderColor }}
            />
          </div>
        );
      case 'number':
        return (
          <div key={field.id} className="space-y-2">
            <Label className={`text-sm ${isModified ? 'text-[#FF3B30]' : 'text-[#52baf3]'} cursor-pointer hover:underline`}>
              {field.label} {field.unit && `(${field.unit})`} {field.required && '*'}
            </Label>
            <Input 
              type="number"
              placeholder={field.placeholder}
              className={`border-2 focus:border-[${borderColor}]`}
              style={{ borderColor }}
              min={field.validation?.min}
              max={field.validation?.max}
            />
          </div>
        );
      case 'date':
        return (
          <div key={field.id} className="space-y-2">
            <Label className={`text-sm ${isModified ? 'text-[#FF3B30]' : 'text-[#52baf3]'} cursor-pointer hover:underline`}>
              {field.label} {field.required && '*'}
            </Label>
            <Input 
              type="date"
              placeholder={field.placeholder}
              className={`border-2 focus:border-[${borderColor}]`}
              style={{ borderColor }}
              min={field.validation?.minDate}
              max={field.validation?.maxDate}
            />
          </div>
        );
      case 'boolean':
        return (
          <div key={field.id} className="flex items-center space-x-2">
            <Switch 
              defaultChecked={field.defaultValue === 'true'}
            />
            <Label className={`text-sm ${isModified ? 'text-[#FF3B30]' : 'text-[#52baf3]'} cursor-pointer hover:underline`}>
              {field.label} {field.required && '*'}
            </Label>
          </div>
        );
      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label className={`text-sm ${isModified ? 'text-[#FF3B30]' : 'text-[#52baf3]'} cursor-pointer hover:underline`}>
              {field.label} {field.required && '*'}
            </Label>
            <Select defaultValue={field.defaultValue}>
              <SelectTrigger className={`border-2 focus:border-[${borderColor}]`} style={{ borderColor }}>
                <SelectValue placeholder={field.placeholder || 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option: any) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      default:
        return (
          <div key={field.id} className="space-y-2">
            <Label className={`text-sm ${isModified ? 'text-[#FF3B30]' : 'text-[#52baf3]'} cursor-pointer hover:underline`}>
              {field.label} {field.required && '*'}
            </Label>
            <Input 
              placeholder={field.placeholder}
              defaultValue={field.defaultValue}
              className={`border-2 focus:border-[${borderColor}]`}
              style={{ borderColor }}
              maxLength={field.validation?.maxLength}
            />
          </div>
        );
    }
  };

  const handleSubmit = () => {
    // Validate Component Name is required
    if (!componentData.componentName || componentData.componentName.trim() === '') {
      toast({
        title: "Validation Error",
        description: "Component Name is required.",
        variant: "destructive"
      });
      return;
    }

    // Validate Component Code matches tree position
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

    if (onSubmit) {
      // Include parentId if parentComponent prop is provided (for creating child components)
      const submissionData = {
        ...componentData,
        ...(parentComponent && { parentId: parentComponent.id })
      };
      onSubmit(submissionData);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-none h-[95vh] flex flex-col">
        <DialogHeader className="pb-4 pr-12">
          <div className="flex items-center justify-between">
            <DialogTitle>Component Register - {isAddMode ? 'Add Component' : 'Edit Component'}</DialogTitle>
            <div className="flex items-center gap-2">
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
                {isLoadingComponents ? (
                  <div className="space-y-2 text-white/70 text-sm">
                    <div className="animate-pulse">Loading components...</div>
                    <div className="animate-pulse h-6 bg-white/10 rounded"></div>
                    <div className="animate-pulse h-6 bg-white/10 rounded"></div>
                    <div className="animate-pulse h-6 bg-white/10 rounded"></div>
                  </div>
                ) : (
                  renderComponentTree(componentTreeData)
                )}
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
                    {/* Row 1: Fleet Equipment Code, Fleet Equipment Name, Parent Component Code, Component Code */}
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Fleet Equipment Code</Label>
                      <Input 
                        value={componentData.fleetEquipmentCode || ''}
                        onChange={(e) => handleInputChange('fleetEquipmentCode', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        data-testid="input-fleet-equipment-code"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Fleet Equipment Name</Label>
                      <Input 
                        value={componentData.fleetEquipmentName || ''}
                        onChange={(e) => handleInputChange('fleetEquipmentName', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        data-testid="input-fleet-equipment-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Parent Component Code</Label>
                      <Input 
                        value={componentData.parentComponent || ''}
                        onChange={(e) => handleInputChange('parentComponent', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        data-testid="input-parent-component-code"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Component Code</Label>
                      <Input 
                        value={componentData.componentCode || ''}
                        readOnly
                        className="border-gray-300 bg-gray-50"
                        title="Component Code is auto-generated based on tree position"
                        data-testid="input-component-code"
                      />
                    </div>
                    
                    {/* Row 2: Component Name, Component Category, Maker, Maker Code */}
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Component Name</Label>
                      <Input 
                        value={componentData.componentName || ''}
                        onChange={(e) => handleInputChange('componentName', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        data-testid="input-component-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Component Category</Label>
                      <Input 
                        value={selectedNode ? getComponentCategory(selectedNode.id) : ''}
                        readOnly
                        className="border-gray-300 bg-gray-50"
                        title="Component Category is derived from the component's tree position"
                        data-testid="input-component-category"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Maker</Label>
                      <Input 
                        value={componentData.maker || ''}
                        onChange={(e) => handleInputChange('maker', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        data-testid="input-maker"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Maker Code</Label>
                      <Input 
                        value={componentData.makerCode || ''}
                        onChange={(e) => handleInputChange('makerCode', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        data-testid="input-maker-code"
                      />
                    </div>
                    
                    {/* Row 3: Model, Model Code, Serial No, Drawing No */}
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Model</Label>
                      <Input 
                        value={componentData.model || ''}
                        onChange={(e) => handleInputChange('model', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        data-testid="input-model"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Model Code</Label>
                      <Input 
                        value={componentData.modelCode || ''}
                        onChange={(e) => handleInputChange('modelCode', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        data-testid="input-model-code"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Serial No</Label>
                      <Input 
                        value={componentData.serialNo || ''}
                        onChange={(e) => handleInputChange('serialNo', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        data-testid="input-serial-no"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Drawing No</Label>
                      <Input 
                        value={componentData.drawingNo || ''}
                        onChange={(e) => handleInputChange('drawingNo', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        data-testid="input-drawing-no"
                      />
                    </div>
                    
                    {/* Row 4: Location, Critical, Condition Based, Installation Date */}
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Location</Label>
                      <Input 
                        value={componentData.location || ''}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        data-testid="input-location"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Criticality</Label>
                      <Select 
                        value={componentData.criticality || ''}
                        onValueChange={(value) => handleInputChange('criticality', value)}
                      >
                        <SelectTrigger className="border-[#52baf3] border-2 focus:border-[#52baf3]" data-testid="select-criticality">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Condition Based</Label>
                      <Select 
                        value={componentData.conditionBased || ''}
                        onValueChange={(value) => handleInputChange('conditionBased', value)}
                      >
                        <SelectTrigger className="border-[#52baf3] border-2 focus:border-[#52baf3]" data-testid="select-condition-based">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Installation Date</Label>
                      <Input 
                        type="date"
                        value={componentData.installationDate || ''}
                        onChange={(e) => handleInputChange('installationDate', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        data-testid="input-installation-date"
                      />
                    </div>
                    
                    {/* Row 5: Commissioning Date, Rating, Equip/System Department, (spacer) */}
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Commissioning Date</Label>
                      <Input 
                        type="date"
                        value={componentData.commissionedDate || ''}
                        onChange={(e) => handleInputChange('commissionedDate', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        data-testid="input-commissioned-date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Rating</Label>
                      <Input 
                        value={componentData.rating || ''}
                        onChange={(e) => handleInputChange('rating', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        data-testid="input-rating"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Equipment / System Department</Label>
                      <Input 
                        value={componentData.equipmentDepartment || ''}
                        onChange={(e) => handleInputChange('equipmentDepartment', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        data-testid="input-equipment-department"
                      />
                    </div>
                    <div className="space-y-2">
                      {/* Empty spacer */}
                    </div>
                    
                    {/* Row 6: IS Active, Vessel Code, IS Parent */}
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">IS Active</Label>
                      <Select 
                        value={componentData.isActive || ''}
                        onValueChange={(value) => handleInputChange('isActive', value)}
                      >
                        <SelectTrigger className="border-[#52baf3] border-2 focus:border-[#52baf3]" data-testid="select-is-active">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Vessel Code</Label>
                      <Input 
                        value={componentData.vesselCode || ''}
                        onChange={(e) => handleInputChange('vesselCode', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        data-testid="input-vessel-code"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">IS Parent</Label>
                      <Select 
                        value={componentData.isParent || ''}
                        onValueChange={(value) => handleInputChange('isParent', value)}
                      >
                        <SelectTrigger className="border-[#52baf3] border-2 focus:border-[#52baf3]" data-testid="select-is-parent">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Row 7: Notes (full width) */}
                    <div className="space-y-2 col-span-4">
                      <Label className="text-sm text-[#8798ad]">Notes</Label>
                      <Textarea 
                        value={componentData.notes || ''}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                        className="border-[#52baf3] border-2 focus:border-[#52baf3]"
                        rows={3}
                        data-testid="input-notes"
                      />
                    </div>
                  </div>
                  
                  {/* IHM Row - Full width below Notes */}
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
                  
                  {/* Custom Fields for Section A */}
                  {customFields['A'] && customFields['A'].length > 0 && (
                    <div className="grid grid-cols-4 gap-6 mt-6 pt-6 border-t border-gray-200">
                      {customFields['A'].map(field => renderCustomField(field))}
                    </div>
                  )}
                </div>

                {/* B. Running Hours & Condition Monitoring Metrics */}
                <div>
                  <Collapsible open={!collapsedSections.B} onOpenChange={(open) => setCollapsedSections(prev => ({ ...prev, B: !open }))}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex justify-between items-center mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded -ml-2">
                        <div className="flex items-center gap-2">
                          {collapsedSections.B ? <ChevronRight className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
                          <h4 className="text-lg font-semibold text-[#16569e]">B. Running Hours</h4>
                        </div>
                        {hasFormConfigPermission && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentSection('B');
                              setShowAddFieldModal(true);
                            }}
                            className="text-[#52baf3] hover:text-[#52baf3]"
                          >
                            <Plus className="h-3 w-3 mr-1" /> Add field
                          </Button>
                        )}
                      </div>
                    </CollapsibleTrigger>
                    
                    {/* Full content when expanded */}
                    <CollapsibleContent>
                      {/* Running Hours field removed - managed in Running Hours module */}
                      
                      {/* Custom Fields for Section B */}
                      {customFields['B'] && customFields['B'].length > 0 && (
                        <div className="grid grid-cols-2 gap-6 mt-6 pt-6 border-t border-gray-200">
                          {customFields['B'].map(field => renderCustomField(field))}
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* Preview when collapsed - Running Hours removed */}
                </div>

                {/* C. Jobs */}
                <div>
                  <Collapsible open={!collapsedSections.C} onOpenChange={(open) => setCollapsedSections(prev => ({ ...prev, C: !open }))}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded -ml-2">
                        <div className="flex items-center gap-2">
                          {collapsedSections.C ? <ChevronRight className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
                          <h4 className="text-lg font-semibold text-[#16569e]">C. Jobs</h4>
                        </div>
                        <div className="flex gap-2">
                          {hasFormConfigPermission && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentSection('C');
                                setShowAddFieldModal(true);
                              }}
                              className="text-[#52baf3] hover:text-[#52baf3]"
                            >
                              <Plus className="h-3 w-3 mr-1" /> Add field
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
                            onClick={(e) => e.stopPropagation()}
                            data-testid="button-add-wo"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add WO
                          </Button>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    
                    {/* Full content when expanded */}
                    <CollapsibleContent>
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
                              <EditableLabel fieldKey="status" className="text-sm font-medium text-gray-700" />
                            </div>
                            <div></div>
                          </div>
                        </div>
                        <div className="divide-y divide-gray-200">
                          {isAddMode ? (
                            <div className="px-4 py-8 text-center text-sm text-gray-500">
                              No work orders yet. Click "Add WO" to create one.
                            </div>
                          ) : componentData.workOrders.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-gray-500">
                              No work orders found for this component.
                            </div>
                          ) : (
                            componentData.workOrders.map((wo: any) => (
                              <div key={wo.title} className="px-4 py-3">
                                <div className="grid grid-cols-5 gap-4 text-sm items-center">
                                  <div className="text-gray-900">{wo.title}</div>
                                  <div className="text-gray-900">{wo.assignedTo}</div>
                                  <div className="text-gray-900">{wo.frequency}</div>
                                  <div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                      wo.status === "Overdue" 
                                        ? "bg-red-100 text-red-800" 
                                        : "bg-yellow-100 text-yellow-800"
                                    }`}>
                                      {wo.status}
                                    </span>
                                  </div>
                                  <div className="flex gap-2">
                                    <button className="text-gray-400 hover:text-gray-600">
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* Preview when collapsed - header + 2 rows - OUTSIDE Collapsible */}
                  {collapsedSections.C && (
                    <div className="border border-gray-200 rounded mb-4">
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
                            <EditableLabel fieldKey="status" className="text-sm font-medium text-gray-700" />
                          </div>
                          <div></div>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-200">
                        {isAddMode ? (
                          <div className="px-4 py-8 text-center text-sm text-gray-500">
                            No work orders yet. Click "Add WO" to create one.
                          </div>
                        ) : componentData.workOrders.length === 0 ? (
                          <div className="px-4 py-8 text-center text-sm text-gray-500">
                            No work orders found for this component.
                          </div>
                        ) : (
                          componentData.workOrders.slice(0, 2).map((wo: any) => (
                            <div key={wo.title} className="px-4 py-3">
                              <div className="grid grid-cols-5 gap-4 text-sm items-center">
                                <div className="text-gray-900">{wo.title}</div>
                                <div className="text-gray-900">{wo.assignedTo}</div>
                                <div className="text-gray-900">{wo.frequency}</div>
                                <div>
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    wo.status === "Overdue" 
                                      ? "bg-red-100 text-red-800" 
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}>
                                    {wo.status}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  <button className="text-gray-400 hover:text-gray-600">
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* D. Maintenance History */}
                <div>
                  <Collapsible open={!collapsedSections.D} onOpenChange={(open) => setCollapsedSections(prev => ({ ...prev, D: !open }))}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded -ml-2">
                        <div className="flex items-center gap-2">
                          {collapsedSections.D ? <ChevronRight className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
                          <h4 className="text-lg font-semibold text-[#16569e]">D. Maintenance History</h4>
                        </div>
                        <div className="flex gap-2">
                          {hasFormConfigPermission && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentSection('D');
                                setShowAddFieldModal(true);
                              }}
                              className="text-[#52baf3] hover:text-[#52baf3]"
                            >
                              <Plus className="h-3 w-3 mr-1" /> Add field
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add M History
                          </Button>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    
                    {/* Full content when expanded */}
                    <CollapsibleContent>
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
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* Preview when collapsed - header + 2 rows - OUTSIDE Collapsible */}
                  {collapsedSections.D && (
                    <div className="border border-gray-200 rounded mb-4">
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
                  )}
                </div>

                {/* E. Spares - Linked Spares with Inventory */}
                <div>
                  <Collapsible open={!collapsedSections.E} onOpenChange={(open) => setCollapsedSections(prev => ({ ...prev, E: !open }))}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded -ml-2">
                        <div className="flex items-center gap-2">
                          {collapsedSections.E ? <ChevronRight className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
                          <h4 className="text-lg font-semibold text-[#16569e]">E. Spares</h4>
                          {linkedSpares && linkedSpares.length > 0 && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {linkedSpares.length} linked
                            </span>
                          )}
                        </div>
                        <Button 
                          size="sm" 
                          className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
                          onClick={(e) => e.stopPropagation()}
                          data-testid="button-add-spare"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Link Spare
                        </Button>
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="border border-gray-200 rounded mb-4">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                          <div className="grid grid-cols-6 gap-4 text-sm font-medium text-gray-700">
                            <div>Part Number</div>
                            <div>Description</div>
                            <div className="text-center">ROB Total</div>
                            <div>Locations</div>
                            <div className="text-center">Status</div>
                            <div className="text-center">Actions</div>
                          </div>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {isLoadingLinkedSpares ? (
                            <div className="px-4 py-8 text-center text-gray-500">
                              <div className="animate-spin h-5 w-5 border-2 border-[#52baf3] border-t-transparent rounded-full mx-auto mb-2"></div>
                              Loading linked spares...
                            </div>
                          ) : linkedSpares && linkedSpares.length > 0 ? (
                            linkedSpares.map((item: any) => (
                              <div key={item.spare.id} className="px-4 py-3 hover:bg-gray-50">
                                <div className="grid grid-cols-6 gap-4 text-sm items-center">
                                  <div className="font-medium text-gray-900" data-testid={`text-spare-partno-${item.spare.id}`}>
                                    {item.spare.partNumber}
                                  </div>
                                  <div className="text-gray-600 truncate" title={item.spare.description}>
                                    {item.spare.description}
                                  </div>
                                  <div className="text-center font-semibold" data-testid={`text-spare-rob-${item.spare.id}`}>
                                    {item.robTotal}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {item.locations && item.locations.length > 0 ? (
                                      item.locations.map((loc: any, idx: number) => (
                                        <span key={loc.locationId} className="mr-2">
                                          {loc.locationName}: {loc.qty}
                                          {idx < item.locations.length - 1 && ", "}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="italic text-gray-400">No locations</span>
                                    )}
                                  </div>
                                  <div className="text-center">
                                    <span 
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        item.stockStatus === 'OK' 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-red-100 text-red-800'
                                      }`}
                                      data-testid={`status-spare-${item.spare.id}`}
                                    >
                                      {item.stockStatus === 'OK' ? 'OK' : 'Low Stock'}
                                    </span>
                                  </div>
                                  <div className="text-center">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setSelectedSpareDetail(item)}
                                      data-testid={`button-view-spare-${item.spare.id}`}
                                    >
                                      <Eye className="h-4 w-4 text-[#52baf3]" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-8 text-center text-gray-500">
                              No spares linked to this component
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* Preview when collapsed */}
                  {collapsedSections.E && linkedSpares && linkedSpares.length > 0 && (
                    <div className="border border-gray-200 rounded mb-4">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <div className="grid grid-cols-6 gap-4 text-sm font-medium text-gray-700">
                          <div>Part Number</div>
                          <div>Description</div>
                          <div className="text-center">ROB Total</div>
                          <div>Locations</div>
                          <div className="text-center">Status</div>
                          <div className="text-center">Actions</div>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {linkedSpares.slice(0, 2).map((item: any) => (
                          <div key={item.spare.id} className="px-4 py-3">
                            <div className="grid grid-cols-6 gap-4 text-sm items-center">
                              <div className="font-medium text-gray-900">{item.spare.partNumber}</div>
                              <div className="text-gray-600 truncate">{item.spare.description}</div>
                              <div className="text-center font-semibold">{item.robTotal}</div>
                              <div className="text-xs text-gray-500">
                                {item.locations && item.locations.length > 0 ? (
                                  item.locations.slice(0, 2).map((loc: any, idx: number) => (
                                    <span key={loc.locationId}>{loc.locationName}: {loc.qty}{idx < Math.min(item.locations.length, 2) - 1 && ", "}</span>
                                  ))
                                ) : "-"}
                              </div>
                              <div className="text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.stockStatus === 'OK' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                  {item.stockStatus === 'OK' ? 'OK' : 'Low'}
                                </span>
                              </div>
                              <div className="text-center">
                                <Button size="sm" variant="ghost" onClick={() => setSelectedSpareDetail(item)}>
                                  <Eye className="h-4 w-4 text-[#52baf3]" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {linkedSpares.length > 2 && (
                          <div className="px-4 py-2 text-center text-sm text-gray-500">
                            +{linkedSpares.length - 2} more spares...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* F. Drawings & Manuals */}
                <div>
                  <Collapsible open={!collapsedSections.F} onOpenChange={(open) => setCollapsedSections(prev => ({ ...prev, F: !open }))}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded -ml-2">
                        <div className="flex items-center gap-2">
                          {collapsedSections.F ? <ChevronRight className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
                          <h4 className="text-lg font-semibold text-[#16569e]">F. Drawings & Manuals</h4>
                        </div>
                        <Button 
                          size="sm" 
                          className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Document
                        </Button>
                      </div>
                    </CollapsibleTrigger>
                    
                    {/* Full content when expanded */}
                    <CollapsibleContent>
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
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* Preview when collapsed - first 2 rows - OUTSIDE Collapsible */}
                  {collapsedSections.F && (
                    <div className="space-y-2 mb-4">
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
                    </div>
                  )}
                </div>

                {/* G. Classification & Regulatory Data */}
                <div>
                  <Collapsible open={!collapsedSections.G} onOpenChange={(open) => setCollapsedSections(prev => ({ ...prev, G: !open }))}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center gap-2 mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded -ml-2">
                        {collapsedSections.G ? <ChevronRight className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
                        <h4 className="text-lg font-semibold text-[#16569e]">G. Classification & Regulatory Data</h4>
                      </div>
                    </CollapsibleTrigger>
                    
                    {/* Full content when expanded */}
                    <CollapsibleContent>
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
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* Preview when collapsed - first 2 fields - OUTSIDE Collapsible */}
                  {collapsedSections.G && (
                    <div className="grid grid-cols-2 gap-6 mb-4">
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
                    </div>
                  )}
                </div>

                {/* H. Requisitions */}
                <div>
                  <Collapsible open={!collapsedSections.H} onOpenChange={(open) => setCollapsedSections(prev => ({ ...prev, H: !open }))}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded -ml-2">
                        <div className="flex items-center gap-2">
                          {collapsedSections.H ? <ChevronRight className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
                          <h4 className="text-lg font-semibold text-[#16569e]">H. Requisitions</h4>
                        </div>
                        <div className="flex gap-2">
                          {hasFormConfigPermission && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentSection('H');
                                setShowAddFieldModal(true);
                              }}
                              className="text-[#52baf3] hover:text-[#52baf3]"
                            >
                              <Plus className="h-3 w-3 mr-1" /> Add field
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Requisition
                          </Button>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    
                    {/* Full content when expanded */}
                    <CollapsibleContent>
                      <div className="border border-gray-200 rounded">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                          <div className="grid grid-cols-5 gap-4 text-sm font-medium text-gray-700">
                            <div>Req. No.</div>
                            <div>Part/Description</div>
                            <div>Qty</div>
                            <div>Date</div>
                            <div>Status</div>
                          </div>
                        </div>
                        <div className="divide-y divide-gray-200">
                          {componentData.requisitions?.map((req: any, index: number) => (
                            <div key={index} className="px-4 py-3">
                              <div className="grid grid-cols-5 gap-4 text-sm items-center">
                                <div className="text-gray-900">{req.reqNo}</div>
                                <div className="text-gray-900">{req.reqPart}</div>
                                <div className="text-gray-900">{req.reqQty}</div>
                                <div className="text-gray-900">{req.reqDate}</div>
                                <div className="text-gray-900">{req.reqStatus}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* Preview when collapsed - header + 2 rows - OUTSIDE Collapsible */}
                  {collapsedSections.H && (
                    <div className="border border-gray-200 rounded mb-4">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <div className="grid grid-cols-5 gap-4 text-sm font-medium text-gray-700">
                          <div>Req. No.</div>
                          <div>Part/Description</div>
                          <div>Qty</div>
                          <div>Date</div>
                          <div>Status</div>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-200">
                        {componentData.requisitions?.slice(0, 2).map((req: any, index: number) => (
                          <div key={index} className="px-4 py-3">
                            <div className="grid grid-cols-5 gap-4 text-sm items-center">
                              <div className="text-gray-900">{req.reqNo}</div>
                              <div className="text-gray-900">{req.reqPart}</div>
                              <div className="text-gray-900">{req.reqQty}</div>
                              <div className="text-gray-900">{req.reqDate}</div>
                              <div className="text-gray-900">{req.reqStatus}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
      
      {/* Spare Detail Dialog */}
      <Dialog open={!!selectedSpareDetail} onOpenChange={() => setSelectedSpareDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#16569e]">Spare Part Details</DialogTitle>
          </DialogHeader>
          {selectedSpareDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Part Number</Label>
                  <p className="font-medium" data-testid="text-detail-partno">{selectedSpareDetail.spare.partNumber}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Min Quantity</Label>
                  <p className="font-medium">{selectedSpareDetail.spare.minQty || 'Not set'}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500">Description</Label>
                  <p className="font-medium">{selectedSpareDetail.spare.description}</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold">Stock Status</Label>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    selectedSpareDetail.stockStatus === 'OK' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`} data-testid="status-detail-stock">
                    {selectedSpareDetail.stockStatus === 'OK' ? 'Stock OK' : 'Low Stock - Below Minimum'}
                  </span>
                </div>
                <div className="text-2xl font-bold text-center py-4 bg-gray-50 rounded" data-testid="text-detail-rob">
                  ROB Total: {selectedSpareDetail.robTotal}
                </div>
              </div>
              
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold mb-2 block">Stock by Location</Label>
                {selectedSpareDetail.locations && selectedSpareDetail.locations.length > 0 ? (
                  <div className="space-y-2">
                    {selectedSpareDetail.locations.map((loc: any) => (
                      <div key={loc.locationId} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <span className="font-medium">{loc.locationName}</span>
                        <span className="text-lg font-semibold">{loc.qty}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No stock at any location</p>
                )}
              </div>
              
              {selectedSpareDetail.linkedComponents && selectedSpareDetail.linkedComponents.length > 1 && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold mb-2 block">Also Linked To</Label>
                  <div className="text-sm text-gray-600">
                    {selectedSpareDetail.linkedComponents
                      .filter((c: any) => c.componentId !== componentData.componentId)
                      .map((c: any) => (
                        <span key={c.componentId} className="inline-block bg-gray-100 px-2 py-1 rounded mr-2 mb-1">
                          {c.componentCode} - {c.componentName}
                        </span>
                      ))}
                  </div>
                </div>
              )}
              
              <div className="flex justify-end pt-4">
                <Button variant="outline" onClick={() => setSelectedSpareDetail(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
  );
};

export default ComponentRegisterForm;