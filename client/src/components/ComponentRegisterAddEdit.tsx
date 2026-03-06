import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Edit2, ChevronRight, ChevronDown, Search, Upload, Eye, Download, Trash2, FileText, Loader2, Check, ChevronsUpDown, X, ChevronUp } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getComponentCategory } from "@/utils/componentUtils";
import { useVessels } from "@/hooks/useVessels";
import { useDepartmentOptions } from "@/hooks/useDepartments";
import type { ComponentDocument } from "@shared/schema";

interface ComponentNode {
  id: string;
  code: string;
  name: string;
  children?: ComponentNode[];
  isExpanded?: boolean;
  [key: string]: any;
}

interface ComponentRegisterAddEditProps {
  onBack: () => void;
  componentId?: string | null;  // Database UUID for API calls
  componentCode?: string | null; // Component code for tree selection
  parentComponent?: { code: string; id: string; name: string } | null;
}

export default function ComponentRegisterAddEdit({
  onBack,
  componentId,
  componentCode: propComponentCode,
  parentComponent,
}: ComponentRegisterAddEditProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { vesselId, setVesselId } = useVessel();
  const { data: vessels = [] } = useVessels();
  const { options: departmentOptions } = useDepartmentOptions();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTreeNode, setSelectedTreeNode] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [criticalityFilter, setCriticalityFilter] = useState("all");
  const [makerOpen, setMakerOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const { data: makersList = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/fleet/makers'],
  });

  const isEditModeFromProp = !!componentId;
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(componentId || null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  
  const isMainCategoryCheck = (id: string): boolean => /^[1-8]$/.test(id);
  
  const isEditMode = !isAddingNew && (isEditModeFromProp || (!!selectedComponentId && !isMainCategoryCheck(selectedComponentId)));

  // Initialize selectedTreeNode from propComponentCode (for editing) or parentComponent (for adding)
  useEffect(() => {
    if (propComponentCode && componentId) {
      // Editing mode - select the component being edited
      setSelectedTreeNode(propComponentCode);
    } else if (parentComponent?.code && !componentId) {
      // Adding mode - select the parent
      setSelectedTreeNode(parentComponent.code);
    }
  }, [propComponentCode, parentComponent?.code, componentId]);

  const [componentData, setComponentData] = useState({
    // Row 1: Fleet Equipment Code, Fleet Equipment Name, Parent Component Code, Component Code
    fleetEquipmentCode: "",
    fleetEquipmentName: "",
    parentComponent: parentComponent?.code || "",
    componentCode: "",
    // Row 2: Component Name, Component Category, Maker, Maker Code
    componentName: "",
    eqptSystemCategory: parentComponent?.code ? getComponentCategory(parentComponent.code) : "",
    maker: "",
    makerCode: "",
    // Row 3: Model, Model Code, Serial No, Drawing No
    model: "",
    modelCode: "",
    serialNo: "",
    drawingNo: "",
    // Row 4: Location, Criticality, Condition Based, Installation Date
    location: "",
    critical: "",
    conditionBased: "",
    installationDate: "",
    // Row 5: Commissioned Date, Rating, Equipment/System Department, (spacer)
    commissionedDate: "",
    rating: "",
    eqptSystemDept: "",
    // Row 6: Running Hours, IS Active, Vessel Code, IS Parent
    runningHours: "",
    isActive: "Yes",
    vesselCode: "",
    isParent: "No",
    // Row 7: Class Item
    classItem: "No",
    // Row 7: Notes (full width)
    notes: "",
    // Section B: Running Hours & Condition Monitoring
    rhCounterType: "NOT_RH_DRIVEN",
    rhCounterSource: "",
    rhMasterComponentId: "",
    lastUpdated: "",
  });

  const [rhSourceOpen, setRhSourceOpen] = useState(false);

  const { data: masterComponents = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/rh-config/master-components', vesselId],
    queryFn: async () => {
      const res = await fetch(`/technical/api/rh-config/master-components/${vesselId}`);
      if (!res.ok) throw new Error("Failed to fetch master components");
      return res.json();
    },
    enabled: !!vesselId && componentData.rhCounterType === "INHERITED",
    staleTime: 0,
  });

  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [spares, setSpares] = useState<any[]>([]);
  
  const documentTypes = [
    { id: "1", type: "Equipment Drawing", fileType: "Drawing" },
    { id: "2", type: "Maintenance Manual", fileType: "Manual" },
    { id: "3", type: "Installation Guide", fileType: "Manual" },
    { id: "4", type: "Trouble shooting Guide", fileType: "Manual" },
  ];
  
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  
  const [classRegData, setClassRegData] = useState({
    classificationSociety: "",
    certificateNo: "",
    lastClassSurvey: "",
    nextClassSurvey: "",
    surveyType: "",
    classRequirements: "",
    classCode: "",
    information: "",
  });

  const { data: components = [], isLoading: isLoadingComponents } = useQuery<any[]>({
    queryKey: [`/technical/api/components/${vesselId}`],
  });

  // Auto-generate component code when form opens with a parent and components are loaded
  useEffect(() => {
    if (parentComponent?.code && !componentId && components.length > 0 && !componentData.componentCode) {
      const isCategory = isMainCategoryCheck(parentComponent.code);
      
      // We need to generate the code here since components are now loaded
      let nextCode = "";
      if (isCategory) {
        const categoryPrefix = parentComponent.code;
        const categoryComponents = components.filter(c => {
          const belongsToVessel = c.vesselId === vesselId;
          const isTopLevel = !c.parentId || c.parentId === categoryPrefix;
          const startsWithCategory = c.componentCode?.startsWith(categoryPrefix);
          return belongsToVessel && isTopLevel && startsWithCategory;
        });
        
        if (categoryComponents.length === 0) {
          nextCode = `${categoryPrefix}01`;
        } else {
          const codes = categoryComponents
            .map(c => c.componentCode || "")
            .map(code => {
              const numPart = code.substring(categoryPrefix.length);
              const num = parseInt(numPart, 10);
              return isNaN(num) ? 0 : num;
            });
          const maxNum = Math.max(0, ...codes);
          nextCode = `${categoryPrefix}${(maxNum + 1).toString().padStart(2, '0')}`;
        }
      } else {
        const parentComp = components.find(c => c.componentCode === parentComponent.code);
        if (parentComp) {
          const parentCode = parentComp.componentCode || "";
          const children = components.filter(c => c.parentId === parentCode && c.vesselId === vesselId);
          
          if (children.length === 0) {
            nextCode = `${parentCode}.001`;
          } else {
            const childCodes = children
              .map(c => c.componentCode || "")
              .filter(code => code.startsWith(parentCode + "."))
              .map(code => {
                const suffix = code.substring(parentCode.length + 1);
                const num = parseInt(suffix, 10);
                return isNaN(num) ? 0 : num;
              });
            const maxNum = Math.max(0, ...childCodes);
            nextCode = `${parentCode}.${(maxNum + 1).toString().padStart(3, '0')}`;
          }
        }
      }
      
      if (nextCode) {
        setComponentData(prev => ({
          ...prev,
          componentCode: nextCode,
          eqptSystemCategory: getComponentCategory(nextCode),
        }));
      }
    }
  }, [parentComponent?.code, componentId, components, vesselId, componentData.componentCode]);

  const { data: existingComponent, isLoading: isLoadingComponent } = useQuery<any>({
    queryKey: [`/technical/api/components/details/${componentId}`],
    enabled: isEditMode && !!componentId,
  });

  // Filter jobs by vesselId at the database level
  const { data: allJobs = [] } = useQuery<any[]>({
    queryKey: [`/technical/api/jobs?vesselId=${vesselId}`],
    enabled: isEditMode && !!vesselId,
  });

  const { data: allSpares = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/spares'],
    enabled: isEditMode,
  });

  const activeComponentId = componentId || selectedComponentId;

  const { data: maintenanceHistory = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/component-maintenance-history', activeComponentId],
    queryFn: async () => {
      if (!activeComponentId) return [];
      const response = await fetch(`/technical/api/component-maintenance-history/${activeComponentId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error('Failed to fetch maintenance history');
      }
      return response.json();
    },
    enabled: !!activeComponentId,
  });
  
  const { data: componentDocuments = [], isLoading: isLoadingDocuments, refetch: refetchDocuments } = useQuery<ComponentDocument[]>({
    queryKey: ['/technical/api/component-documents', activeComponentId],
    queryFn: async () => {
      if (!activeComponentId) return [];
      const response = await fetch(`/technical/api/component-documents/${activeComponentId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error('Failed to fetch documents');
      }
      return response.json();
    },
    enabled: isEditMode && !!activeComponentId,
  });

  const getDocumentForType = (docType: string): ComponentDocument | undefined => {
    return componentDocuments.find(doc => 
      doc.fileName.toLowerCase().includes(docType.toLowerCase()) || 
      doc.fileType.toLowerCase() === docType.toLowerCase() ||
      doc.notes?.toLowerCase().includes(docType.toLowerCase())
    );
  };

  const handleUploadClick = (docType: string) => {
    const inputRef = fileInputRefs.current[docType];
    if (inputRef) {
      inputRef.click();
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>, docType: string, fileType: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const compId = activeComponentId;
    const compCode = componentData.componentCode;
    const compVessel = componentData.vesselCode || vesselId;

    if (!compId || !compCode) {
      toast({
        title: "Error",
        description: "Please select a component first before uploading documents.",
        variant: "destructive",
      });
      return;
    }

    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/msword'];
    const maxSize = 25 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload PDF, Word, or image files only.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "File size must be less than 25MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingDocType(docType);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('componentId', compId);
      formData.append('componentCode', compCode);
      formData.append('vesselCode', compVessel);
      formData.append('fileName', `${docType} - ${file.name}`);
      formData.append('fileType', fileType);
      formData.append('version', '1.0');
      formData.append('canShipView', 'true');
      formData.append('canShipDownload', 'true');
      formData.append('notes', docType);

      const response = await fetch('/technical/api/component-documents', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload document');
      }

      toast({
        title: "Document Uploaded",
        description: `${docType} has been uploaded successfully.`,
      });

      refetchDocuments();
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setUploadingDocType(null);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleViewDocument = async (docId: number) => {
    try {
      window.open(`/technical/api/component-documents/${docId}/download`, '_blank');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open document",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDocument = async (docId: number, docName: string) => {
    if (!confirm(`Are you sure you want to delete "${docName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/technical/api/component-documents/${docId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      toast({
        title: "Document Deleted",
        description: `${docName} has been deleted.`,
      });

      refetchDocuments();
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (isEditMode && existingComponent && !isLoadingComponent) {
      const comp = existingComponent;
      setComponentData({
        // Row 1
        fleetEquipmentCode: comp.fleetEquipmentCode || "",
        fleetEquipmentName: comp.fleetEquipmentName || "",
        parentComponent: comp.parentId || "",
        componentCode: comp.componentCode || "",
        // Row 2
        componentName: comp.name || "",
        eqptSystemCategory: comp.componentCategory || getComponentCategory(comp.id),
        maker: comp.maker || "",
        makerCode: comp.makerCode || "",
        // Row 3
        model: comp.model || "",
        modelCode: comp.modelCode || "",
        serialNo: comp.serialNo || "",
        drawingNo: comp.drawingNo || "",
        // Row 4
        location: comp.location || "",
        critical: comp.critical ? "Yes" : "No",
        conditionBased: comp.conditionBased ? "Yes" : "No",
        installationDate: comp.installationDate || "",
        // Row 5
        commissionedDate: comp.commissionedDate || "",
        rating: comp.rating || "",
        eqptSystemDept: comp.eqptSystemDept || "",
        // Row 6
        runningHours: comp.runningHours?.toString() || comp.currentCumulativeRH?.toString() || "",
        isActive: comp.isActive === false ? "No" : "Yes",
        vesselCode: comp.vesselCode || "",
        isParent: comp.isParent ? "Yes" : "No",
        classItem: comp.classItem ? "Yes" : "No",
        // Row 7
        notes: comp.notes || "",
        // Section B: Running Hours & Condition Monitoring
        rhCounterType: comp.rhCounterType || "NOT_RH_DRIVEN",
        rhCounterSource: comp.rhCounterSource || "",
        rhMasterComponentId: comp.rhMasterComponentId || "",
        lastUpdated: comp.lastUpdated || comp.rhLastUpdated || "",
      });
      // Use propComponentCode if provided (passed from parent), otherwise use fetched comp.componentCode
      const compCode = propComponentCode || comp.componentCode || comp.id;
      setSelectedTreeNode(compCode);
      
      // Auto-expand parent nodes by traversing the parent chain
      const partsToExpand = new Set<string>();
      
      // Traverse parent chain using parentId from database
      // Find all ancestors by walking through components
      let currentParentId = comp.parentId;
      const visitedParents = new Set<string>();
      while (currentParentId && !visitedParents.has(currentParentId)) {
        visitedParents.add(currentParentId);
        partsToExpand.add(currentParentId);
        // Find the parent component to get its parentId
        const parentComp = components.find((c: any) => 
          c.componentCode === currentParentId || c.id === currentParentId
        );
        currentParentId = parentComp?.parentId || null;
      }
      
      // Always ensure the main category (1-8) is expanded
      // Main categories are single digit codes that match the first digit of component codes
      const mainCategory = compCode.match(/^([1-8])/)?.[1];
      if (mainCategory) {
        partsToExpand.add(mainCategory);
      }
      
      setExpandedNodes(prev => new Set([...Array.from(prev), ...Array.from(partsToExpand)]));

      const componentJobs = allJobs.filter(j => j.componentCode === comp.componentCode);
      setWorkOrders(componentJobs.map(job => ({
        id: job.id,
        woNo: job.jobNo || job.id,
        jobTitle: job.jobTitle || job.title,
        assignedTo: job.assignedTo || "Chief Engineer",
        dueDate: job.nextDueDate || "",
        status: job.status || "Due",
      })));

      const componentSpares = allSpares.filter(s => s.componentId === componentId);
      setSpares(componentSpares.map(spare => ({
        id: spare.id,
        partCode: spare.partNumber || spare.id,
        partName: spare.name || spare.description,
        min: spare.minQuantity || 1,
        critical: spare.critical ? "Yes" : "No",
        location: spare.location || "",
        location2: spare.location2 || "",
      })));
    }
  }, [existingComponent, isLoadingComponent, isEditMode, allJobs, allSpares, componentId, propComponentCode, components]);

  // Auto-update eqptSystemCategory when componentCode changes
  useEffect(() => {
    if (componentData.componentCode) {
      const derivedCategory = getComponentCategory(componentData.componentCode);
      if (derivedCategory && derivedCategory !== componentData.eqptSystemCategory) {
        setComponentData(prev => ({ ...prev, eqptSystemCategory: derivedCategory }));
      }
    }
  }, [componentData.componentCode]);

  const isCritical = (comp: any): boolean => {
    if (comp.critical === true) return true;
    if (comp.critical === "Yes" || comp.critical === "Y" || comp.critical === "yes" || comp.critical === "y") return true;
    return false;
  };

  const filterComponents = (comps: any[]): any[] => {
    let filtered = comps.filter(c => c.vesselId === vesselId);
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.name?.toLowerCase().includes(query) ||
        c.componentCode?.toLowerCase().includes(query) ||
        c.code?.toLowerCase().includes(query)
      );
    }
    
    if (criticalityFilter !== 'all') {
      if (criticalityFilter === 'critical') {
        filtered = filtered.filter(c => isCritical(c));
      } else if (criticalityFilter === 'non-critical') {
        filtered = filtered.filter(c => !isCritical(c));
      }
    }
    
    return filtered;
  };

  const buildComponentTree = (components: any[]): ComponentNode[] => {
    const clonedComponents = components
      .filter(c => c.vesselId === vesselId)
      .map(comp => ({ ...comp }));
    
    const mainCategories: ComponentNode[] = [
      { id: "1", code: "1", name: "1 Ship General", children: [] },
      { id: "2", code: "2", name: "2 Hull", children: [] },
      { id: "3", code: "3", name: "3 Equipment for Cargo", children: [] },
      { id: "4", code: "4", name: "4 Ship's Equipment", children: [] },
      { id: "5", code: "5", name: "5 Equipment for Crew & Passengers", children: [] },
      { id: "6", code: "6", name: "6 Machinery Main Components", children: [] },
      { id: "7", code: "7", name: "7 Systems for Machinery Main Components", children: [] },
      { id: "8", code: "8", name: "8 Ship Common Systems", children: [] },
    ];

    if (!clonedComponents || clonedComponents.length === 0) {
      return mainCategories;
    }

    const componentMap = new Map<string, ComponentNode>();
    
    mainCategories.forEach(cat => {
      componentMap.set(cat.code, cat);
    });

    clonedComponents.forEach((comp: any) => {
      const code = comp.componentCode || comp.id;
      if (code.match(/^[1-8]$/)) {
        return;
      }
      const node: ComponentNode = {
        ...comp,  // Include all component data FIRST
        id: code,  // Use componentCode as id for tree selection
        code: code,  // componentCode
        name: comp.name,
        componentId: comp.id,  // Keep original database ID as componentId
        critical: comp.critical === "Yes" || comp.critical === true,
        children: []
      };
      componentMap.set(node.code, node);
    });

    clonedComponents.forEach((comp: any) => {
      const code = comp.componentCode || comp.id;
      const node = componentMap.get(code);
      
      if (!node) return;
      
      if (comp.parentId) {
        const parent = componentMap.get(comp.parentId);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(node);
        }
      } else {
        const categoryCode = code.charAt(0);
        const category = componentMap.get(categoryCode);
        if (category && !code.match(/^[1-8]$/)) {
          if (!category.children) {
            category.children = [];
          }
          category.children.push(node);
        }
      }
    });

    if (searchQuery.trim() || criticalityFilter !== 'all') {
      const filterTree = (nodes: ComponentNode[]): ComponentNode[] => {
        const filtered: ComponentNode[] = [];
        
        for (const node of nodes) {
          const filteredChildren = node.children ? filterTree(node.children) : [];
          
          const searchLower = searchQuery.toLowerCase();
          const matchesSearch = !searchQuery.trim() || 
            node.name.toLowerCase().includes(searchLower) ||
            node.code.toLowerCase().includes(searchLower);
          
          const matchesCritical = 
            criticalityFilter === 'all' ||
            (criticalityFilter === 'critical' && node.critical === true) ||
            (criticalityFilter === 'non-critical' && node.critical !== true);
          
          const nodeMatches = matchesSearch && matchesCritical;
          const hasMatchingChildren = filteredChildren.length > 0;
          
          if (nodeMatches || hasMatchingChildren) {
            filtered.push({
              ...node,
              children: filteredChildren
            });
          }
        }
        
        return filtered;
      };
      
      return filterTree(mainCategories);
    }

    return mainCategories;
  };

  const generateNextComponentCode = (selectedId: string | null, isCategory: boolean = false): string => {
    if (!selectedId) return "";
    
    if (isCategory) {
      const categoryPrefix = selectedId;
      // For categories, find top-level components (parentId equals category code or is null/empty)
      // that belong to this category (code starts with category prefix)
      const categoryComponents = components.filter(c => {
        const belongsToVessel = c.vesselId === vesselId;
        const isTopLevel = !c.parentId || c.parentId === categoryPrefix;
        const startsWithCategory = c.componentCode?.startsWith(categoryPrefix);
        return belongsToVessel && isTopLevel && startsWithCategory;
      });
      
      if (categoryComponents.length === 0) {
        return `${categoryPrefix}01`;
      }
      
      const codes = categoryComponents
        .map(c => c.componentCode || "")
        .map(code => {
          const numPart = code.substring(categoryPrefix.length);
          const num = parseInt(numPart, 10);
          return isNaN(num) ? 0 : num;
        });
      
      const maxNum = Math.max(0, ...codes);
      const nextNum = maxNum + 1;
      return `${categoryPrefix}${nextNum.toString().padStart(2, '0')}`;
    }
    
    // selectedId is now a componentCode (e.g., "27"), not a database ID
    const parentComp = components.find(c => c.componentCode === selectedId);
    if (!parentComp) return "";
    
    const parentCode = parentComp.componentCode || "";
    
    // parentId in database stores the componentCode of the parent
    const children = components.filter(c => c.parentId === parentCode && c.vesselId === vesselId);
    
    if (children.length === 0) {
      return `${parentCode}.001`;
    }
    
    const childCodes = children
      .map(c => c.componentCode || "")
      .filter(code => code.startsWith(parentCode + "."))
      .map(code => {
        const suffix = code.substring(parentCode.length + 1);
        const num = parseInt(suffix, 10);
        return isNaN(num) ? 0 : num;
      });
    
    const maxNum = Math.max(0, ...childCodes);
    const nextNum = maxNum + 1;
    return `${parentCode}.${nextNum.toString().padStart(3, '0')}`;
  };

  const componentTree = buildComponentTree(components);

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

  const PARENT_OPTIONAL_FIELDS = ['model', 'modelCode', 'critical', 'conditionBased', 'eqptSystemDept'];

  const ALL_MANDATORY_FIELDS = [
    { key: 'parentComponent', label: 'Parent Component Code' },
    { key: 'componentCode', label: 'Component Code' },
    { key: 'componentName', label: 'Component Name' },
    { key: 'eqptSystemCategory', label: 'Component Category' },
    { key: 'model', label: 'Model' },
    { key: 'modelCode', label: 'Model Code' },
    { key: 'critical', label: 'Criticality' },
    { key: 'conditionBased', label: 'Condition Based' },
    { key: 'eqptSystemDept', label: 'Equipment / System Department' },
    { key: 'isActive', label: 'Is Active' },
  ] as const;

  const isParentComponent = componentData.isParent === "Yes";

  const MANDATORY_FIELDS = isParentComponent
    ? ALL_MANDATORY_FIELDS.filter(f => !PARENT_OPTIONAL_FIELDS.includes(f.key))
    : ALL_MANDATORY_FIELDS;

  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  const validateMandatoryFields = (): boolean => {
    const errors: Record<string, boolean> = {};
    let hasErrors = false;
    for (const field of MANDATORY_FIELDS) {
      const value = componentData[field.key as keyof typeof componentData];
      if (!value || value.trim() === '') {
        errors[field.key] = true;
        hasErrors = true;
      }
    }
    setValidationErrors(errors);
    return !hasErrors;
  };

  const handleFieldChange = (field: string, value: string) => {
    setComponentData(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSave = async () => {
    if (!validateMandatoryFields()) {
      toast({
        title: "Validation Error",
        description: "Please fill all mandatory fields before saving.",
        variant: "destructive",
      });
      return;
    }
    if (componentData.maker && componentData.maker.trim()) {
      if (makersList.length === 0) {
        toast({
          title: "Validation Error",
          description: "Maker list is still loading. Please try again in a moment.",
          variant: "destructive",
        });
        return;
      }
      const validMaker = makersList.find((m: any) => m.makerName === componentData.maker);
      if (!validMaker) {
        toast({
          title: "Validation Error",
          description: "Please select a valid Maker from the Maker List.",
          variant: "destructive",
        });
        return;
      }
      if (componentData.makerCode !== validMaker.makerCode) {
        handleFieldChange('makerCode', validMaker.makerCode);
      }
    } else if (componentData.makerCode) {
      handleFieldChange('makerCode', '');
    }
    if (componentData.rhCounterType === "INHERITED" && !componentData.rhMasterComponentId) {
      toast({
        title: "Validation Error",
        description: "Please select a RH Counter Source from MASTER components.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: componentData.componentName || componentData.componentCode,
        componentCode: componentData.componentCode,
        parentId: componentData.parentComponent || null,
        componentCategory: componentData.eqptSystemCategory || null,
        maker: componentData.maker || null,
        makerCode: componentData.makerCode || null,
        model: componentData.model || null,
        modelCode: componentData.modelCode || null,
        serialNo: componentData.serialNo || null,
        drawingNo: componentData.drawingNo || null,
        location: componentData.location || null,
        critical: componentData.critical === "Yes",
        conditionBased: componentData.conditionBased === "Yes",
        installationDate: componentData.installationDate || null,
        commissionedDate: componentData.commissionedDate || null,
        rating: componentData.rating || null,
        eqptSystemDept: componentData.eqptSystemDept || null,
        notes: componentData.notes || null,
        runningHours: componentData.runningHours ? parseFloat(componentData.runningHours) : null,
        vesselId: vesselId || "V001",
        isActive: componentData.isActive === "Yes",
        vesselCode: componentData.vesselCode || null,
        isParent: componentData.isParent === "Yes",
        classItem: componentData.classItem === "Yes",
        rhCounterType: componentData.rhCounterType === "NOT_RH_DRIVEN" ? "NOT_RH_DRIVEN" : componentData.rhCounterType,
        rhMasterComponentId: componentData.rhCounterType === "INHERITED" ? (componentData.rhMasterComponentId || null) : null,
      };

      if (isEditMode && !isAddingNew && componentId) {
        await apiRequest('PATCH', `/technical/api/components/${componentId}`, payload);
        toast({
          title: "Component Updated",
          description: "Component has been updated successfully.",
        });
      } else {
        await apiRequest('POST', '/technical/api/components', payload);
        toast({
          title: "Component Created",
          description: "New component has been created successfully.",
        });
      }

      // Refetch all component-related queries to ensure tree refreshes
      console.log('🔄 Refetching component queries after save, vesselId:', vesselId);
      await queryClient.refetchQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          const matches = typeof key === 'string' && key.startsWith('/technical/api/components');
          if (matches) console.log('🔄 Refetching query:', query.queryKey);
          return matches;
        }
      });
      console.log('✅ Component queries refetched');
      onBack();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save component",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isMainCategory = (id: string): boolean => {
    return /^[1-8]$/.test(id);
  };
  
  const isMainCategoryById = (id: string): boolean => {
    return /^[1-8]$/.test(id);
  };

  const loadComponentDataFromTree = (comp: any) => {
    if (!comp || isMainCategory(comp.id)) {
      setSelectedComponentId(null);
      return;
    }
    
    setIsAddingNew(false);
    setSelectedComponentId(comp.id);
    
    setComponentData({
      // Row 1
      fleetEquipmentCode: comp.fleetEquipmentCode || "",
      fleetEquipmentName: comp.fleetEquipmentName || "",
      parentComponent: comp.parentId || "",
      componentCode: comp.componentCode || comp.code || "",
      // Row 2
      componentName: comp.name || "",
      eqptSystemCategory: comp.componentCategory || getComponentCategory(comp.id),
      maker: comp.maker || "",
      makerCode: comp.makerCode || "",
      // Row 3
      model: comp.model || "",
      modelCode: comp.modelCode || "",
      serialNo: comp.serialNo || "",
      drawingNo: comp.drawingNo || "",
      // Row 4
      location: comp.location || "",
      critical: comp.critical ? "Yes" : "No",
      conditionBased: comp.conditionBased ? "Yes" : "No",
      installationDate: comp.installationDate || "",
      // Row 5
      commissionedDate: comp.commissionedDate || "",
      rating: comp.rating || "",
      eqptSystemDept: comp.eqptSystemDept || "",
      // Row 6
      runningHours: comp.runningHours?.toString() || comp.currentCumulativeRH?.toString() || "",
      isActive: comp.isActive === false ? "No" : "Yes",
      vesselCode: comp.vesselCode || "",
      isParent: comp.isParent ? "Yes" : "No",
      classItem: comp.classItem ? "Yes" : "No",
      // Row 7
      notes: comp.notes || "",
      // Section B: Running Hours & Condition Monitoring
      rhCounterType: comp.rhCounterType || "NOT_RH_DRIVEN",
      rhCounterSource: comp.rhCounterSource || "",
      rhMasterComponentId: comp.rhMasterComponentId || "",
      lastUpdated: comp.lastUpdated || comp.rhLastUpdated || "",
    });
    
    const componentJobs = allJobs.filter(j => j.componentCode === comp.componentCode);
    setWorkOrders(componentJobs.map(job => ({
      id: job.id,
      woNo: job.jobNo || job.id,
      jobTitle: job.jobTitle || job.title,
      assignedTo: job.assignedTo || "Chief Engineer",
      dueDate: job.nextDueDate || "",
      status: job.status || "Due",
    })));
    
    const componentSpares = allSpares.filter(s => s.componentId === comp.id);
    setSpares(componentSpares.map(spare => ({
      id: spare.id,
      partCode: spare.partNumber || spare.id,
      partName: spare.name || spare.description,
      min: spare.minQuantity || 1,
      critical: spare.critical ? "Yes" : "No",
      location: spare.location || "Store Room A",
    })));
  };

  const renderTreeNode = (node: ComponentNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedTreeNode === node.id;
    const isSfiGroup = node.id.startsWith('sfi-');
    const paddingLeft = level * 16 + 8;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center py-1.5 px-2 cursor-pointer hover:bg-sky-50 ${
            isSelected ? 'bg-sky-100' : ''
          }`}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => {
            setSelectedTreeNode(node.id);
            if (!isSfiGroup) {
              loadComponentDataFromTree(node);
            }
            if (hasChildren) toggleNode(node.id);
          }}
          data-testid={`tree-node-${node.code}`}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              className="mr-1 p-0.5 hover:bg-sky-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 text-gray-500" />
              ) : (
                <ChevronRight className="h-3 w-3 text-gray-500" />
              )}
            </button>
          ) : (
            <span className="w-4 mr-1" />
          )}
          <span className="text-xs text-gray-700 truncate">
            {node.name.startsWith(node.code + " ") ? node.name : `${node.code} ${node.name}`}
          </span>
        </div>
        {isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'due':
        return 'bg-yellow-400 text-yellow-900';
      case 'due (grace p)':
      case 'due grace p':
        return 'bg-orange-400 text-white';
      case 'overdue':
        return 'bg-red-500 text-white';
      case 'completed':
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">
            {isEditMode && !isAddingNew
              ? "Component Register \u2013 Edit Component"
              : "Component Register \u2013 Add Component"}
          </h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-[#16569e] text-white"
              onClick={() => {
                const isCategory = selectedTreeNode ? isMainCategory(selectedTreeNode) : false;
                const parentId = selectedTreeNode || "";
                const nextCode = selectedTreeNode ? generateNextComponentCode(selectedTreeNode, isCategory) : "";
                const derivedCategory = nextCode ? getComponentCategory(nextCode) : (selectedTreeNode ? getComponentCategory(selectedTreeNode) : "");
                
                setIsAddingNew(true);
                setSelectedComponentId(null);
                setComponentData({
                  fleetEquipmentCode: "",
                  fleetEquipmentName: "",
                  parentComponent: parentId,
                  componentCode: nextCode,
                  componentName: "",
                  eqptSystemCategory: derivedCategory,
                  maker: "",
                  makerCode: "",
                  model: "",
                  modelCode: "",
                  serialNo: "",
                  drawingNo: "",
                  location: "",
                  critical: "",
                  conditionBased: "",
                  installationDate: "",
                  commissionedDate: "",
                  rating: "",
                  eqptSystemDept: "",
                  runningHours: "",
                  isActive: "Yes",
                  vesselCode: "",
                  isParent: "No",
                  classItem: "No",
                  notes: "",
                  rhCounterType: "NOT_RH_DRIVEN",
                  rhCounterSource: "",
                  rhMasterComponentId: "",
                  lastUpdated: "",
                });
                setWorkOrders([]);
                setSpares([]);
                setClassRegData({
                  classificationSociety: "",
                  certificateNo: "",
                  lastClassSurvey: "",
                  nextClassSurvey: "",
                  surveyType: "",
                  classRequirements: "",
                  classCode: "",
                  information: "",
                });
                toast({
                  title: "New Component",
                  description: selectedTreeNode ? `Form cleared. Component code auto-generated: ${nextCode}` : "Form cleared for adding a new component. Select a location in the tree first.",
                });
              }}
              data-testid="button-add-edit-component"
            >
              <Plus className="h-4 w-4 mr-1" />
              + Add / Edit Component
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="text-gray-600 hover:bg-gray-50"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white border-b px-6 py-2 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Vessel:</span>
          <Select value={vesselId} onValueChange={(v) => setVesselId(v as any)}>
            <SelectTrigger className="w-40 h-8" data-testid="select-vessel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vessels.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search Components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8"
            data-testid="input-search-components"
          />
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-green-600 hover:bg-green-700 text-white h-8"
          data-testid="button-save"
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[30%] flex flex-col border-r">
          <div className="px-3 py-2 bg-sky-500">
            <span className="text-white font-semibold text-sm">COMPONENTS</span>
          </div>
          <div className="flex-1 overflow-y-auto bg-white">
            {isLoadingComponents ? (
              <div className="p-4 text-gray-500 text-sm">Loading...</div>
            ) : (
              componentTree.map(node => renderTreeNode(node))
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isEditMode && !isAddingNew && componentData.componentCode && (
            <h2 className="text-lg font-semibold text-gray-900 mb-4" data-testid="text-component-title">
              {componentData.componentCode} {componentData.componentName || ''}
            </h2>
          )}
          <div className="space-y-4">
              <Card className="rounded-sm border border-gray-200 shadow-none">
                <CardHeader
                  className="py-3 px-4 cursor-pointer hover:bg-gray-50 flex-row items-center justify-between"
                  onClick={() => toggleSection('A')}
                  data-testid="section-header-a"
                >
                  <span className="text-sm font-medium text-[#16569e]">A. Component Information</span>
                  {collapsedSections['A'] ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronUp className="h-4 w-4 text-gray-500" />}
                </CardHeader>
                {!collapsedSections['A'] && (
                <CardContent className="pt-4 pb-4 px-4 border-t border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Fleet Equipment Code</label>
                    <Input
                      value={componentData.fleetEquipmentCode}
                      onChange={(e) => handleFieldChange('fleetEquipmentCode', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-fleet-equipment-code"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Fleet Equipment Name</label>
                    <Input
                      value={componentData.fleetEquipmentName}
                      onChange={(e) => handleFieldChange('fleetEquipmentName', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-fleet-equipment-name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Parent Component Code<span className="text-red-500 ml-0.5">*</span></label>
                    <Input
                      value={componentData.parentComponent}
                      onChange={(e) => handleFieldChange('parentComponent', e.target.value)}
                      className={`h-8 text-sm ${validationErrors.parentComponent ? 'border-red-500' : ''}`}
                      data-testid="input-parent-component"
                    />
                    {validationErrors.parentComponent && <span className="text-xs text-red-500" data-testid="validation-error-parentComponent">This field is required</span>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Component Code<span className="text-red-500 ml-0.5">*</span></label>
                    <Input
                      value={componentData.componentCode}
                      onChange={(e) => handleFieldChange('componentCode', e.target.value)}
                      className={`h-8 text-sm ${validationErrors.componentCode ? 'border-red-500' : ''}`}
                      data-testid="input-component-code"
                    />
                    {validationErrors.componentCode && <span className="text-xs text-red-500" data-testid="validation-error-componentCode">This field is required</span>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Component Name<span className="text-red-500 ml-0.5">*</span></label>
                    <Input
                      value={componentData.componentName}
                      onChange={(e) => handleFieldChange('componentName', e.target.value)}
                      className={`h-8 text-sm ${validationErrors.componentName ? 'border-red-500' : ''}`}
                      data-testid="input-component-name"
                    />
                    {validationErrors.componentName && <span className="text-xs text-red-500" data-testid="validation-error-componentName">This field is required</span>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Component Category<span className="text-red-500 ml-0.5">*</span></label>
                    <Input
                      value={componentData.eqptSystemCategory}
                      readOnly
                      className={`h-8 text-sm bg-gray-50 text-gray-700 cursor-not-allowed ${validationErrors.eqptSystemCategory ? 'border-red-500' : ''}`}
                      data-testid="input-component-category"
                      title="Auto-populated based on component group (1-8)"
                    />
                    {validationErrors.eqptSystemCategory && <span className="text-xs text-red-500" data-testid="validation-error-eqptSystemCategory">This field is required</span>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Maker</label>
                    <div className="flex gap-1">
                      <Popover open={makerOpen} onOpenChange={setMakerOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            role="combobox"
                            aria-expanded={makerOpen}
                            className="flex items-center justify-between w-full h-8 px-2 text-sm border rounded-md bg-white hover:bg-gray-50 text-left"
                            data-testid="input-maker"
                          >
                            <span className={`truncate ${componentData.maker ? 'text-gray-900' : 'text-gray-400'}`}>
                              {componentData.maker || "Select maker..."}
                            </span>
                            <ChevronsUpDown className="h-3 w-3 flex-shrink-0 text-gray-400 ml-1" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search makers..." data-testid="input-search-maker" />
                            <CommandList className="max-h-[200px]">
                              <CommandEmpty>No makers found.</CommandEmpty>
                              <CommandGroup>
                                {makersList.map((maker: any) => (
                                  <CommandItem
                                    key={maker.id || maker.makerListUuid}
                                    value={maker.makerName}
                                    onSelect={() => {
                                      handleFieldChange('maker', maker.makerName);
                                      handleFieldChange('makerCode', maker.makerCode);
                                      setMakerOpen(false);
                                    }}
                                    data-testid={`option-maker-${maker.makerCode}`}
                                  >
                                    <span className="truncate">{maker.makerName}</span>
                                    {componentData.maker === maker.makerName && <Check className="h-3 w-3 ml-auto text-blue-600" />}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {componentData.maker && (
                        <button
                          type="button"
                          onClick={() => {
                            handleFieldChange('maker', '');
                            handleFieldChange('makerCode', '');
                          }}
                          className="flex items-center justify-center h-8 w-8 text-gray-400 hover:text-red-500 border rounded-md"
                          data-testid="button-clear-maker"
                          title="Clear maker"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Maker Code</label>
                    <Input
                      value={componentData.makerCode}
                      readOnly
                      className="h-8 text-sm bg-gray-50 text-gray-700 cursor-not-allowed"
                      data-testid="input-maker-code"
                      title="Auto-populated from selected maker"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Model{!isParentComponent && <span className="text-red-500 ml-0.5">*</span>}</label>
                    <Input
                      value={componentData.model}
                      onChange={(e) => handleFieldChange('model', e.target.value)}
                      className={`h-8 text-sm ${validationErrors.model ? 'border-red-500' : ''}`}
                      data-testid="input-model"
                    />
                    {validationErrors.model && <span className="text-xs text-red-500" data-testid="validation-error-model">This field is required</span>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Model Code{!isParentComponent && <span className="text-red-500 ml-0.5">*</span>}</label>
                    <Input
                      value={componentData.modelCode}
                      onChange={(e) => handleFieldChange('modelCode', e.target.value)}
                      className={`h-8 text-sm ${validationErrors.modelCode ? 'border-red-500' : ''}`}
                      data-testid="input-model-code"
                    />
                    {validationErrors.modelCode && <span className="text-xs text-red-500" data-testid="validation-error-modelCode">This field is required</span>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Serial No</label>
                    <Input
                      value={componentData.serialNo}
                      onChange={(e) => handleFieldChange('serialNo', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-serial-no"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Drawing No</label>
                    <Input
                      value={componentData.drawingNo}
                      onChange={(e) => handleFieldChange('drawingNo', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-drawing-no"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Location</label>
                    <Input
                      value={componentData.location}
                      onChange={(e) => handleFieldChange('location', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-location"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Criticality{!isParentComponent && <span className="text-red-500 ml-0.5">*</span>}</label>
                    <select
                      value={componentData.critical}
                      onChange={(e) => handleFieldChange('critical', e.target.value)}
                      className={`h-8 w-full text-sm px-2 border rounded ${validationErrors.critical ? 'border-red-500' : 'border-gray-200'}`}
                      data-testid="select-criticality-field"
                    >
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                    {validationErrors.critical && <span className="text-xs text-red-500" data-testid="validation-error-critical">This field is required</span>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Condition Based{!isParentComponent && <span className="text-red-500 ml-0.5">*</span>}</label>
                    <select
                      value={componentData.conditionBased}
                      onChange={(e) => handleFieldChange('conditionBased', e.target.value)}
                      className={`h-8 w-full text-sm px-2 border rounded ${validationErrors.conditionBased ? 'border-red-500' : 'border-gray-200'}`}
                      data-testid="select-condition-based"
                    >
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                    {validationErrors.conditionBased && <span className="text-xs text-red-500" data-testid="validation-error-conditionBased">This field is required</span>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Installation Date</label>
                    <Input
                      type="date"
                      value={componentData.installationDate}
                      onChange={(e) => handleFieldChange('installationDate', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-installation-date"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Commissioned Date</label>
                    <Input
                      type="date"
                      value={componentData.commissionedDate}
                      onChange={(e) => handleFieldChange('commissionedDate', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-commissioned-date"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Rating</label>
                    <Input
                      value={componentData.rating}
                      onChange={(e) => handleFieldChange('rating', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-rating"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Equipment / System Department{!isParentComponent && <span className="text-red-500 ml-0.5">*</span>}</label>
                    <select
                      value={componentData.eqptSystemDept}
                      onChange={(e) => handleFieldChange('eqptSystemDept', e.target.value)}
                      className={`h-8 w-full text-sm px-2 border rounded ${validationErrors.eqptSystemDept ? 'border-red-500' : 'border-gray-200'}`}
                      data-testid="select-eqpt-system-dept"
                    >
                      <option value="">Select</option>
                      {departmentOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {validationErrors.eqptSystemDept && <span className="text-xs text-red-500" data-testid="validation-error-eqptSystemDept">This field is required</span>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Class Item</label>
                    <select
                      value={componentData.classItem}
                      onChange={(e) => handleFieldChange('classItem', e.target.value)}
                      className="h-8 w-full text-sm px-2 border rounded border-gray-200"
                      data-testid="select-class-item"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Running Hours</label>
                    <Input
                      value={componentData.runningHours}
                      onChange={(e) => handleFieldChange('runningHours', e.target.value)}
                      className="h-8 text-sm"
                      placeholder="20000"
                      data-testid="input-running-hours"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Is Active<span className="text-red-500 ml-0.5">*</span></label>
                    <select
                      value={componentData.isActive}
                      onChange={(e) => handleFieldChange('isActive', e.target.value)}
                      className={`h-8 w-full text-sm px-2 border rounded ${validationErrors.isActive ? 'border-red-500' : 'border-gray-200'}`}
                      data-testid="select-is-active"
                    >
                      <option value="Yes">Yes (Active)</option>
                      <option value="No">No (Inactive)</option>
                    </select>
                    {validationErrors.isActive && <span className="text-xs text-red-500" data-testid="validation-error-isActive">This field is required</span>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Vessel Code</label>
                    <Input
                      value={componentData.vesselCode}
                      onChange={(e) => handleFieldChange('vesselCode', e.target.value)}
                      className="h-8 text-sm"
                      placeholder="e.g., V001"
                      data-testid="input-vessel-code"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Is Parent</label>
                    <select
                      value={componentData.isParent}
                      onChange={(e) => handleFieldChange('isParent', e.target.value)}
                      className="h-8 w-full text-sm px-2 border rounded border-gray-200"
                      data-testid="select-is-parent"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                </div>

                {/* Row 7: Notes (full width) */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label>
                  <Textarea
                    value={componentData.notes}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    className="min-h-[60px] bg-yellow-50 border-yellow-200 text-sm"
                    placeholder="Notes"
                    data-testid="textarea-notes"
                  />
                </div>
                </CardContent>
                )}
              </Card>

              <Card className="rounded-sm border border-gray-200 shadow-none">
                <CardHeader
                  className="py-3 px-4 cursor-pointer hover:bg-gray-50 flex-row items-center justify-between"
                  onClick={() => toggleSection('B')}
                  data-testid="section-header-b"
                >
                  <span className="text-sm font-medium text-[#16569e]">B. Running Hours & Condition Monitoring</span>
                  {collapsedSections['B'] ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronUp className="h-4 w-4 text-gray-500" />}
                </CardHeader>
                {!collapsedSections['B'] && (
                <CardContent className="pt-0 pb-0 px-0 border-t border-gray-100">
                <div className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">RH Counter Type</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">RH Counter Source</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Running Hours</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white">
                        <td className="px-3 py-2">
                          <select
                            value={componentData.rhCounterType}
                            onChange={(e) => {
                              const newType = e.target.value;
                              handleFieldChange('rhCounterType', newType);
                              if (newType !== "INHERITED") {
                                handleFieldChange('rhMasterComponentId', '');
                              }
                            }}
                            className="h-8 w-full text-sm px-2 border rounded border-gray-200"
                            data-testid="select-rh-counter-type"
                          >
                            <option value="NOT_RH_DRIVEN">None</option>
                            <option value="MASTER">Master</option>
                            <option value="INHERITED">Inherited</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {componentData.rhCounterType === "INHERITED" ? (
                            <div className="flex gap-1">
                              <Popover open={rhSourceOpen} onOpenChange={setRhSourceOpen}>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    role="combobox"
                                    aria-expanded={rhSourceOpen}
                                    className="flex items-center justify-between w-full h-8 px-2 text-sm border rounded-md bg-white hover:bg-gray-50 text-left"
                                    data-testid="input-rh-counter-source"
                                  >
                                    <span className={`truncate ${componentData.rhMasterComponentId ? 'text-gray-900' : 'text-gray-400'}`}>
                                      {componentData.rhMasterComponentId
                                        ? (() => {
                                            const mc = masterComponents.find((m: any) => m.id === componentData.rhMasterComponentId);
                                            return mc ? `${mc.componentCode} — ${mc.name}` : componentData.rhCounterSource || "Select source...";
                                          })()
                                        : "Select source..."}
                                    </span>
                                    <ChevronsUpDown className="h-3 w-3 flex-shrink-0 text-gray-400 ml-1" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[350px] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Search by code or name..." data-testid="input-search-rh-source" />
                                    <CommandList className="max-h-[200px]">
                                      <CommandEmpty>No MASTER components found.</CommandEmpty>
                                      <CommandGroup>
                                        {masterComponents
                                          .filter((m: any) => m.id !== (componentId || selectedComponentId))
                                          .map((mc: any) => (
                                            <CommandItem
                                              key={mc.id}
                                              value={`${mc.componentCode} ${mc.name}`}
                                              onSelect={() => {
                                                handleFieldChange('rhMasterComponentId', mc.id);
                                                handleFieldChange('rhCounterSource', mc.name);
                                                setRhSourceOpen(false);
                                              }}
                                              data-testid={`option-rh-source-${mc.componentCode}`}
                                            >
                                              <div className="flex flex-col">
                                                <span className="text-sm font-medium">{mc.componentCode}</span>
                                                <span className="text-xs text-gray-500">{mc.name}</span>
                                              </div>
                                              {componentData.rhMasterComponentId === mc.id && <Check className="h-3 w-3 ml-auto text-blue-600" />}
                                            </CommandItem>
                                          ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              {componentData.rhMasterComponentId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleFieldChange('rhMasterComponentId', '');
                                    handleFieldChange('rhCounterSource', '');
                                  }}
                                  className="h-8 w-8 flex items-center justify-center border rounded-md hover:bg-red-50"
                                  data-testid="button-clear-rh-source"
                                >
                                  <X className="h-3 w-3 text-gray-500" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <Input
                              value={componentData.rhCounterType === "MASTER" ? "SELF" : "—"}
                              readOnly
                              className="h-8 text-sm bg-gray-50"
                              data-testid="input-rh-counter-source"
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={componentData.runningHours}
                            onChange={(e) => handleFieldChange('runningHours', e.target.value)}
                            className="h-8 text-sm"
                            placeholder=""
                            data-testid="input-running-hours-b"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="date"
                            value={componentData.lastUpdated}
                            onChange={(e) => handleFieldChange('lastUpdated', e.target.value)}
                            className="h-8 text-sm"
                            data-testid="input-last-updated"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                </CardContent>
                )}
              </Card>

              <Card className="rounded-sm border border-gray-200 shadow-none">
                <CardHeader
                  className="py-3 px-4 cursor-pointer hover:bg-gray-50 flex-row items-center justify-between"
                  onClick={() => toggleSection('C')}
                  data-testid="section-header-c"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#16569e]">C. Jobs</span>
                  </div>
                  {collapsedSections['C'] ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronUp className="h-4 w-4 text-gray-500" />}
                </CardHeader>
                {!collapsedSections['C'] && (
                <CardContent className="pt-4 pb-4 px-4 border-t border-gray-100">
                {activeComponentId && componentData.componentCode && (
                <div className="flex items-center justify-end mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-sky-600 border-sky-300"
                    data-testid="button-add-job"
                    onClick={() => setLocation(`/pms/work-order/new/${componentData.componentCode}?mode=template&componentName=${encodeURIComponent(componentData.componentName)}`)}
                  >
                    + Add Jobs
                  </Button>
                </div>
                )}
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">W.O No.</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Job Title</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Assigned to</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Due Date</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {workOrders.length > 0 ? workOrders.map((wo) => (
                        <tr key={wo.id} className="border-t">
                          <td className="px-3 py-2 text-gray-700">{wo.woNo}</td>
                          <td className="px-3 py-2 text-gray-700">{wo.jobTitle}</td>
                          <td className="px-3 py-2 text-gray-700">{wo.assignedTo}</td>
                          <td className="px-3 py-2 text-gray-700">{wo.dueDate}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(wo.status)}`}>
                              {wo.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" data-testid={`button-delete-wo-${wo.id}`}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-center text-gray-400">
                            No work orders found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                </CardContent>
                )}
              </Card>

              <Card className="rounded-sm border border-gray-200 shadow-none">
                <CardHeader
                  className="py-3 px-4 cursor-pointer hover:bg-gray-50 flex-row items-center justify-between"
                  onClick={() => toggleSection('D')}
                  data-testid="section-header-d"
                >
                  <span className="text-sm font-medium text-[#16569e]">D. Maintenance History</span>
                  {collapsedSections['D'] ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronUp className="h-4 w-4 text-gray-500" />}
                </CardHeader>
                {!collapsedSections['D'] && (
                <CardContent className="pt-4 pb-4 px-4 border-t border-gray-100">
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Work Order No.</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Performed By</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Total Time (Hrs)</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Completion Date</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenanceHistory.length > 0 ? maintenanceHistory.map((item: any) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-2 text-gray-700">{item.workOrderNo || ""}</td>
                          <td className="px-3 py-2 text-gray-700">{item.performedBy || ""}</td>
                          <td className="px-3 py-2 text-gray-700">{item.runningHoursAtCompletion || ""}</td>
                          <td className="px-3 py-2 text-gray-700">{item.dateCompleted || ""}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" data-testid={`button-delete-history-${item.id}`}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-center text-gray-400">
                            No maintenance history found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                </CardContent>
                )}
              </Card>

              <Card className="rounded-sm border border-gray-200 shadow-none">
                <CardHeader
                  className="py-3 px-4 cursor-pointer hover:bg-gray-50 flex-row items-center justify-between"
                  onClick={() => toggleSection('E')}
                  data-testid="section-header-e"
                >
                  <span className="text-sm font-medium text-[#16569e]">E. Spares</span>
                  {collapsedSections['E'] ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronUp className="h-4 w-4 text-gray-500" />}
                </CardHeader>
                {!collapsedSections['E'] && (
                <CardContent className="pt-4 pb-4 px-4 border-t border-gray-100">
                <div className="flex items-center justify-end mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 sr-only">E. Spares</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-sky-600 border-sky-300"
                    data-testid="button-add-spares"
                  >
                    + Add Spares
                  </Button>
                </div>
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Part Code</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Part Name</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Min</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Critical</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Location A</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Location B</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spares.length > 0 ? spares.map((spare) => (
                        <tr key={spare.id} className="border-t">
                          <td className="px-3 py-2">
                            <Input value={spare.partCode || ""} className="h-7 text-xs" />
                          </td>
                          <td className="px-3 py-2">
                            <Input value={spare.partName || ""} className="h-7 text-xs" />
                          </td>
                          <td className="px-3 py-2">
                            <Input value={spare.min || ""} className="h-7 text-xs w-16" />
                          </td>
                          <td className="px-3 py-2">
                            <Select defaultValue={spare.critical || "No"}>
                              <SelectTrigger className="h-7 text-xs w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Yes">Y</SelectItem>
                                <SelectItem value="No">N</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Input value={spare.location || ""} className="h-7 text-xs" />
                          </td>
                          <td className="px-3 py-2">
                            <Input value={spare.location2 || ""} className="h-7 text-xs" />
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-center text-gray-400">
                            No spares linked
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                </CardContent>
                )}
              </Card>

              <Card className="rounded-sm border border-gray-200 shadow-none">
                <CardHeader
                  className="py-3 px-4 cursor-pointer hover:bg-gray-50 flex-row items-center justify-between"
                  onClick={() => toggleSection('F')}
                  data-testid="section-header-f"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#16569e]">F. Drawings & Manuals</span>
                    {isLoadingDocuments && (
                      <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                    )}
                  </div>
                  {collapsedSections['F'] ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronUp className="h-4 w-4 text-gray-500" />}
                </CardHeader>
                {!collapsedSections['F'] && (
                <CardContent className="pt-4 pb-4 px-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 sr-only">F. Drawings & Manuals</h3>
                  {isLoadingDocuments && (
                    <span className="text-xs text-gray-500 flex items-center gap-1 sr-only">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading...
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {documentTypes.map((docTypeInfo) => {
                    const existingDoc = componentDocuments.find(doc => 
                      doc.notes?.toLowerCase().includes(docTypeInfo.type.toLowerCase()) ||
                      doc.fileName.toLowerCase().includes(docTypeInfo.type.toLowerCase())
                    );
                    const isUploading = uploadingDocType === docTypeInfo.type;
                    
                    return (
                      <div key={docTypeInfo.id} className="flex items-center gap-3">
                        <input
                          type="file"
                          ref={(el) => { fileInputRefs.current[docTypeInfo.type] = el; }}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileSelected(e, docTypeInfo.type, docTypeInfo.fileType)}
                          data-testid={`file-input-${docTypeInfo.id}`}
                        />
                        <Input
                          value={docTypeInfo.type}
                          className="h-8 text-sm flex-1 bg-yellow-50"
                          readOnly
                        />
                        {existingDoc ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-green-600 flex items-center gap-1" title={existingDoc.fileName}>
                              <FileText className="h-3 w-3" />
                              Uploaded
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-sky-600"
                              onClick={() => handleViewDocument(existingDoc.id)}
                              data-testid={`button-view-${docTypeInfo.id}`}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteDocument(existingDoc.id, existingDoc.fileName)}
                              data-testid={`button-delete-${docTypeInfo.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-gray-500"
                              onClick={() => handleUploadClick(docTypeInfo.type)}
                              disabled={isUploading}
                              data-testid={`button-replace-${docTypeInfo.id}`}
                            >
                              {isUploading ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Upload className="h-3 w-3 mr-1" />
                              )}
                              Replace
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs text-gray-500"
                            onClick={() => handleUploadClick(docTypeInfo.type)}
                            disabled={isUploading || !isEditMode}
                            title={!isEditMode ? "Save component first to upload documents" : ""}
                            data-testid={`button-upload-${docTypeInfo.id}`}
                          >
                            {isUploading ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="h-3 w-3 mr-1" />
                                Upload
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {componentDocuments.length > 0 && (
                  <div className="mt-4 p-3 bg-gray-50 rounded border">
                    <h4 className="text-xs font-semibold text-gray-600 mb-2">All Uploaded Documents ({componentDocuments.length})</h4>
                    <div className="space-y-1">
                      {componentDocuments.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-200 last:border-0">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3 text-gray-400" />
                            <span className="text-gray-700">{doc.fileName}</span>
                            <span className="text-gray-400">({doc.fileType})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-sky-600 px-2"
                              onClick={() => handleViewDocument(doc.id)}
                              data-testid={`button-view-doc-${doc.id}`}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-red-500 px-2"
                              onClick={() => handleDeleteDocument(doc.id, doc.fileName)}
                              data-testid={`button-delete-doc-${doc.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </CardContent>
                )}
              </Card>

              <Card className="rounded-sm border border-gray-200 shadow-none">
                <CardHeader
                  className="py-3 px-4 cursor-pointer hover:bg-gray-50 flex-row items-center justify-between"
                  onClick={() => toggleSection('G')}
                  data-testid="section-header-g"
                >
                  <span className="text-sm font-medium text-[#16569e]">G. Classification & Regulatory Data</span>
                  {collapsedSections['G'] ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronUp className="h-4 w-4 text-gray-500" />}
                </CardHeader>
                {!collapsedSections['G'] && (
                <CardContent className="pt-4 pb-4 px-4 border-t border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Classification Society</label>
                    <Input
                      value={classRegData.classificationSociety}
                      onChange={(e) => setClassRegData(prev => ({ ...prev, classificationSociety: e.target.value }))}
                      className="h-8 text-sm"
                      data-testid="input-classification-society"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Certificate No</label>
                    <Input
                      value={classRegData.certificateNo}
                      onChange={(e) => setClassRegData(prev => ({ ...prev, certificateNo: e.target.value }))}
                      className="h-8 text-sm"
                      data-testid="input-certificate-no"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Last Class Survey</label>
                    <Input
                      type="date"
                      value={classRegData.lastClassSurvey}
                      onChange={(e) => setClassRegData(prev => ({ ...prev, lastClassSurvey: e.target.value }))}
                      className="h-8 text-sm"
                      data-testid="input-last-class-survey"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Next Class Survey</label>
                    <Input
                      type="date"
                      value={classRegData.nextClassSurvey}
                      onChange={(e) => setClassRegData(prev => ({ ...prev, nextClassSurvey: e.target.value }))}
                      className="h-8 text-sm"
                      data-testid="input-next-class-survey"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Survey Type</label>
                    <Input
                      value={classRegData.surveyType}
                      onChange={(e) => setClassRegData(prev => ({ ...prev, surveyType: e.target.value }))}
                      className="h-8 text-sm"
                      data-testid="input-survey-type"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Class Requirements</label>
                    <Input
                      value={classRegData.classRequirements}
                      onChange={(e) => setClassRegData(prev => ({ ...prev, classRequirements: e.target.value }))}
                      className="h-8 text-sm"
                      data-testid="input-class-requirements"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Class Code</label>
                    <Input
                      value={classRegData.classCode}
                      onChange={(e) => setClassRegData(prev => ({ ...prev, classCode: e.target.value }))}
                      className="h-8 text-sm"
                      data-testid="input-class-code"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Information</label>
                    <Input
                      value={classRegData.information}
                      onChange={(e) => setClassRegData(prev => ({ ...prev, information: e.target.value }))}
                      className="h-8 text-sm"
                      data-testid="input-information"
                    />
                  </div>
                </div>
                </CardContent>
                )}
              </Card>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white px-8"
                  data-testid="button-submit"
                >
                  {isSaving ? "Saving..." : "Submit"}
                </Button>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
