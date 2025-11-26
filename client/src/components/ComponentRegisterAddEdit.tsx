import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Edit2, ChevronRight, ChevronDown, Search, Upload } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getComponentCategory } from "@/utils/componentUtils";
import { VESSELS } from "@/lib/vessels";

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
  componentId?: string | null;
  parentComponent?: { code: string; id: string; name: string } | null;
}

export default function ComponentRegisterAddEdit({
  onBack,
  componentId,
  parentComponent,
}: ComponentRegisterAddEditProps) {
  const { toast } = useToast();
  const { vesselId, setVesselId } = useVessel();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTreeNode, setSelectedTreeNode] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["6"]));
  const [isSaving, setIsSaving] = useState(false);
  const [criticalityFilter, setCriticalityFilter] = useState("all");

  const isEditMode = !!componentId;

  const [componentData, setComponentData] = useState({
    maker: "",
    model: "",
    serialNo: "",
    drawingNo: "",
    componentCode: "",
    eqptSystemCategory: "",
    location: "",
    critical: "",
    installationDate: "",
    commissionedDate: "",
    rating: "",
    conditionBased: "",
    noOfUnits: "",
    eqptSystemDept: "",
    parentComponent: parentComponent?.id || "",
    dimensionsSize: "",
    notes: "",
    runningHours: "",
    dateUpdated: "",
  });


  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState<any[]>([]);
  const [spares, setSpares] = useState<any[]>([]);
  const [documents, setDocuments] = useState([
    { id: "1", type: "Equipment Drawing", fileName: "", uploaded: false },
    { id: "2", type: "Maintenance Manual", fileName: "", uploaded: false },
    { id: "3", type: "Installation Guide", fileName: "", uploaded: false },
    { id: "4", type: "Trouble shooting Guide", fileName: "", uploaded: false },
  ]);
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
    queryKey: [`/api/components/${vesselId}`],
  });

  const { data: existingComponent, isLoading: isLoadingComponent } = useQuery<any>({
    queryKey: ['/api/components', componentId],
    enabled: isEditMode && !!componentId,
  });

  const { data: allJobs = [] } = useQuery<any[]>({
    queryKey: ['/api/jobs'],
    enabled: isEditMode,
  });

  const { data: allSpares = [] } = useQuery<any[]>({
    queryKey: ['/api/spares'],
    enabled: isEditMode,
  });

  useEffect(() => {
    if (isEditMode && existingComponent && !isLoadingComponent) {
      const comp = existingComponent;
      setComponentData({
        maker: comp.maker || "",
        model: comp.model || "",
        serialNo: comp.serialNo || "",
        drawingNo: comp.drawingNo || "",
        componentCode: comp.componentCode || "",
        eqptSystemCategory: comp.componentCategory || getComponentCategory(comp.id),
        location: comp.location || "",
        critical: comp.critical ? "Yes" : "No",
        installationDate: comp.installationDate || "",
        commissionedDate: comp.commissionedDate || "",
        rating: comp.rating || "",
        conditionBased: comp.conditionBased ? "Yes" : "No",
        noOfUnits: comp.noOfUnits || "",
        eqptSystemDept: comp.eqptSystemDept || "",
        parentComponent: comp.parentId || "",
        dimensionsSize: comp.dimensionsSize || "",
        notes: comp.notes || "",
        runningHours: comp.runningHours?.toString() || comp.currentCumulativeRH?.toString() || "",
        dateUpdated: comp.dateUpdated || new Date().toISOString().split('T')[0],
      });
      setSelectedTreeNode(comp.id);

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
        location: spare.location || "Store Room A",
      })));
    }
  }, [existingComponent, isLoadingComponent, isEditMode, allJobs, allSpares, componentId]);

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
        id: code,
        code: code,
        name: comp.name,
        ...comp,
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
      const categoryComponents = components.filter(c => 
        c.vesselId === vesselId && 
        !c.parentId && 
        c.componentCode?.startsWith(categoryPrefix)
      );
      
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
    
    const parentComp = components.find(c => c.id === selectedId);
    if (!parentComp) return "";
    
    const parentCode = parentComp.componentCode || "";
    
    const children = components.filter(c => c.parentId === selectedId && c.vesselId === vesselId);
    
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

  const handleFieldChange = (field: string, value: string) => {
    setComponentData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name: componentData.componentCode,
        componentCode: componentData.componentCode,
        parentId: componentData.parentComponent || null,
        componentCategory: componentData.eqptSystemCategory || null,
        maker: componentData.maker || null,
        model: componentData.model || null,
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
      };

      if (isEditMode && componentId) {
        await apiRequest('PATCH', `/api/components/${componentId}`, payload);
        toast({
          title: "Component Updated",
          description: "Component has been updated successfully.",
        });
      } else {
        await apiRequest('POST', '/api/components', payload);
        toast({
          title: "Component Created",
          description: "New component has been created successfully.",
        });
      }

      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
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

  const loadComponentDataFromTree = (comp: any) => {
    if (!comp || isMainCategory(comp.id)) return;
    
    setComponentData({
      maker: comp.maker || "",
      model: comp.model || "",
      serialNo: comp.serialNo || "",
      drawingNo: comp.drawingNo || "",
      componentCode: comp.componentCode || comp.code || "",
      eqptSystemCategory: comp.componentCategory || getComponentCategory(comp.id),
      location: comp.location || "",
      critical: comp.critical ? "Yes" : "No",
      installationDate: comp.installationDate || "",
      commissionedDate: comp.commissionedDate || "",
      rating: comp.rating || "",
      conditionBased: comp.conditionBased ? "Yes" : "No",
      noOfUnits: comp.noOfUnits || "",
      eqptSystemDept: comp.eqptSystemDept || "",
      parentComponent: comp.parentId || "",
      dimensionsSize: comp.dimensionsSize || "",
      notes: comp.notes || "",
      runningHours: comp.runningHours?.toString() || comp.currentCumulativeRH?.toString() || "",
      dateUpdated: comp.dateUpdated || new Date().toISOString().split('T')[0],
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
            {node.name}
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
      <div className="bg-sky-500 px-6 py-3 flex items-center justify-between">
        <h1 className="text-white text-lg font-semibold">
          Component Register - {isEditMode ? "Edit Component" : "Add Component"}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-white text-sky-600 hover:bg-sky-50 border-white"
            onClick={() => {
              const isCategory = selectedTreeNode ? isMainCategory(selectedTreeNode) : false;
              const parentId = selectedTreeNode && !isCategory ? selectedTreeNode : "";
              const nextCode = selectedTreeNode ? generateNextComponentCode(selectedTreeNode, isCategory) : "";
              
              setComponentData({
                maker: "",
                model: "",
                serialNo: "",
                drawingNo: "",
                componentCode: nextCode,
                eqptSystemCategory: "",
                location: "",
                critical: "",
                installationDate: "",
                commissionedDate: "",
                rating: "",
                conditionBased: "",
                noOfUnits: "",
                eqptSystemDept: "",
                parentComponent: parentId,
                dimensionsSize: "",
                notes: "",
                runningHours: "",
                dateUpdated: new Date().toISOString().split('T')[0],
              });
              setWorkOrders([]);
              setMaintenanceHistory([]);
              setSpares([]);
              setDocuments([
                { id: "1", type: "Equipment Drawing", fileName: "", uploaded: false },
                { id: "2", type: "Maintenance Manual", fileName: "", uploaded: false },
                { id: "3", type: "Installation Guide", fileName: "", uploaded: false },
                { id: "4", type: "Trouble shooting Guide", fileName: "", uploaded: false },
              ]);
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
            Add/ Edit Component
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="bg-white text-gray-600 hover:bg-gray-50 border-white"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>
      </div>

      <div className="bg-white border-b px-6 py-2 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Vessel</span>
          <Select value={vesselId} onValueChange={(v) => setVesselId(v as any)}>
            <SelectTrigger className="w-40 h-8" data-testid="select-vessel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VESSELS.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Criticality</span>
          <Select value={criticalityFilter} onValueChange={setCriticalityFilter}>
            <SelectTrigger className="w-24 h-8" data-testid="select-criticality">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="non-critical">Non-Critical</SelectItem>
            </SelectContent>
          </Select>
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
        <div className="w-64 bg-sky-500 flex flex-col">
          <div className="px-3 py-2 border-b border-sky-400">
            <span className="text-white font-semibold text-sm">COMPONENTS</span>
          </div>
          <div className="flex-1 overflow-y-auto bg-white">
            {isLoadingComponents ? (
              <div className="p-4 text-gray-500 text-sm">Loading...</div>
            ) : (
              componentTree.map(node => renderTreeNode(node))
            )}
          </div>
          <div className="p-2 bg-sky-600">
            <Input
              value={componentData.componentCode}
              onChange={(e) => handleFieldChange('componentCode', e.target.value)}
              placeholder="Component Code"
              className="h-7 text-xs bg-sky-100 border-sky-300"
              data-testid="input-component-code-bottom"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">A. Component Information</h3>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Maker*</label>
                    <Input
                      value={componentData.maker}
                      onChange={(e) => handleFieldChange('maker', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-maker"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Model</label>
                    <Input
                      value={componentData.model}
                      onChange={(e) => handleFieldChange('model', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-model"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Serial No</label>
                    <Input
                      value={componentData.serialNo}
                      onChange={(e) => handleFieldChange('serialNo', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-serial-no"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Drawing No</label>
                    <Input
                      value={componentData.drawingNo}
                      onChange={(e) => handleFieldChange('drawingNo', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-drawing-no"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Component Code</label>
                    <Input
                      value={componentData.componentCode}
                      onChange={(e) => handleFieldChange('componentCode', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-component-code"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Eqpt. / System Category</label>
                    <Input
                      value={componentData.eqptSystemCategory}
                      onChange={(e) => handleFieldChange('eqptSystemCategory', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-eqpt-category"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Location</label>
                    <Input
                      value={componentData.location}
                      onChange={(e) => handleFieldChange('location', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-location"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Critical</label>
                    <Input
                      value={componentData.critical}
                      onChange={(e) => handleFieldChange('critical', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-critical"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Installation Date</label>
                    <Input
                      type="date"
                      value={componentData.installationDate}
                      onChange={(e) => handleFieldChange('installationDate', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-installation-date"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Commissioned Date</label>
                    <Input
                      type="date"
                      value={componentData.commissionedDate}
                      onChange={(e) => handleFieldChange('commissionedDate', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-commissioned-date"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Rating</label>
                    <Input
                      value={componentData.rating}
                      onChange={(e) => handleFieldChange('rating', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-rating"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Condition Based</label>
                    <Input
                      value={componentData.conditionBased}
                      onChange={(e) => handleFieldChange('conditionBased', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-condition-based"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">No of Units</label>
                    <Input
                      value={componentData.noOfUnits}
                      onChange={(e) => handleFieldChange('noOfUnits', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-no-of-units"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Eqpt. / System Department</label>
                    <Input
                      value={componentData.eqptSystemDept}
                      onChange={(e) => handleFieldChange('eqptSystemDept', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-eqpt-dept"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Parent Component</label>
                    <Input
                      value={componentData.parentComponent}
                      onChange={(e) => handleFieldChange('parentComponent', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-parent-component"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Dimensions/Size</label>
                    <Input
                      value={componentData.dimensionsSize}
                      onChange={(e) => handleFieldChange('dimensionsSize', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-dimensions-size"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                  <Textarea
                    value={componentData.notes}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    className="min-h-[60px] bg-yellow-50 border-yellow-200 text-sm"
                    placeholder="Notes"
                    data-testid="textarea-notes"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">B. Running Hours & Condition Monitoring Metrics</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Running Hours</label>
                    <Input
                      value={componentData.runningHours}
                      onChange={(e) => handleFieldChange('runningHours', e.target.value)}
                      className="h-8 text-sm"
                      placeholder="20000"
                      data-testid="input-running-hours"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Date Updated</label>
                    <Input
                      type="date"
                      value={componentData.dateUpdated}
                      onChange={(e) => handleFieldChange('dateUpdated', e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-date-updated"
                    />
                  </div>
                </div>

              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">C. Work Orders</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-sky-600 border-sky-300"
                    data-testid="button-add-wo"
                  >
                    + Add W.O
                  </Button>
                </div>
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
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <Edit2 className="h-3 w-3" />
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
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">D. Maintenance History</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-sky-600 border-sky-300"
                    data-testid="button-add-wo-history"
                  >
                    + Add W.O History
                  </Button>
                </div>
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Work Order No.</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Performed By</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Total Time (Hrs)</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Completion Date</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenanceHistory.length > 0 ? maintenanceHistory.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-2">
                            <Input value={item.woNo || ""} className="h-7 text-xs" readOnly />
                          </td>
                          <td className="px-3 py-2">
                            <Input value={item.performedBy || ""} className="h-7 text-xs" />
                          </td>
                          <td className="px-3 py-2">
                            <Input value={item.totalTime || ""} className="h-7 text-xs" />
                          </td>
                          <td className="px-3 py-2 flex items-center gap-1">
                            <Input value={item.completionDate || ""} className="h-7 text-xs" placeholder="dd-mm-yyyy" />
                            <span className="text-gray-400">📅</span>
                          </td>
                          <td className="px-3 py-2">
                            <Select defaultValue={item.status || "completed"}>
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-gray-400">
                            No maintenance history found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">E. Spares</h3>
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
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Location</th>
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
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-gray-400">
                            No spares linked
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">F. Drawings & Manuals</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-sky-600 border-sky-300"
                    data-testid="button-add-document"
                  >
                    + Add Document
                  </Button>
                </div>
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3">
                      <Input
                        value={doc.type}
                        className="h-8 text-sm flex-1 bg-yellow-50"
                        readOnly
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs text-gray-500"
                        data-testid={`button-upload-${doc.id}`}
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Upload
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">G. Classification & Regulatory Data</h3>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Classification Society</label>
                    <Input
                      value={classRegData.classificationSociety}
                      onChange={(e) => setClassRegData(prev => ({ ...prev, classificationSociety: e.target.value }))}
                      className="h-8 text-sm"
                      data-testid="input-classification-society"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Certificate No</label>
                    <Input
                      value={classRegData.certificateNo}
                      onChange={(e) => setClassRegData(prev => ({ ...prev, certificateNo: e.target.value }))}
                      className="h-8 text-sm"
                      data-testid="input-certificate-no"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Last Class Survey</label>
                    <Input
                      type="date"
                      value={classRegData.lastClassSurvey}
                      onChange={(e) => setClassRegData(prev => ({ ...prev, lastClassSurvey: e.target.value }))}
                      className="h-8 text-sm"
                      data-testid="input-last-class-survey"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Next Class Survey</label>
                    <Input
                      type="date"
                      value={classRegData.nextClassSurvey}
                      onChange={(e) => setClassRegData(prev => ({ ...prev, nextClassSurvey: e.target.value }))}
                      className="h-8 text-sm"
                      data-testid="input-next-class-survey"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Survey Type</label>
                    <Input
                      value={classRegData.surveyType}
                      onChange={(e) => setClassRegData(prev => ({ ...prev, surveyType: e.target.value }))}
                      className="h-8 text-sm"
                      data-testid="input-survey-type"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Class Requirements</label>
                    <Input
                      value={classRegData.classRequirements}
                      onChange={(e) => setClassRegData(prev => ({ ...prev, classRequirements: e.target.value }))}
                      className="h-8 text-sm"
                      data-testid="input-class-requirements"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Class Code</label>
                    <Input
                      value={classRegData.classCode}
                      onChange={(e) => setClassRegData(prev => ({ ...prev, classCode: e.target.value }))}
                      className="h-8 text-sm"
                      data-testid="input-class-code"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Information</label>
                    <Input
                      value={classRegData.information}
                      onChange={(e) => setClassRegData(prev => ({ ...prev, information: e.target.value }))}
                      className="h-8 text-sm"
                      data-testid="input-information"
                    />
                  </div>
                </div>
              </div>

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
    </div>
  );
}
