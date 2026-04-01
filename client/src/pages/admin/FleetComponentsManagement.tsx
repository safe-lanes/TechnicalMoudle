import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type FleetComponents, type MakerList } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, ChevronRight, ChevronDown, Upload, Download, Settings, Package, ArrowLeft, Info, MapPin, Star, FileText, CheckCircle, XCircle, Save, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Marker } from "@/components/Marker";

export default function FleetComponentsManagement({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [componentToDelete, setComponentToDelete] = useState<FleetComponents | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [detailComponent, setDetailComponent] = useState<FleetComponents | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});

  const [makerSearchText, setMakerSearchText] = useState("");
  const [showMakerSuggestions, setShowMakerSuggestions] = useState(false);
  const makerSearchRef = useRef<HTMLDivElement>(null);

  const { data: components, isLoading, error } = useQuery<FleetComponents[]>({
    queryKey: ['/technical/api/fleet-admin/fleet-components'],
  });

  const { data: makersData } = useQuery<MakerList[]>({
    queryKey: ['/technical/api/fleet/makers'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/technical/api/fleet-admin/fleet-components/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet-admin/fleet-components'], exact: false });
      toast({
        title: "Success",
        description: "Component deleted successfully",
      });
      setDeleteDialogOpen(false);
      setComponentToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete component",
        variant: "destructive",
      });
    },
  });

  const inlineUpdateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, any> }) => {
      return apiRequest('PATCH', `/technical/api/fleet-admin/fleet-components/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet-admin/fleet-components'], exact: false });
      toast({
        title: "Success",
        description: "Component updated successfully",
      });
      setIsEditMode(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update component",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return apiRequest('POST', '/technical/api/fleet-admin/fleet-components', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet-admin/fleet-components'], exact: false });
      toast({
        title: "Success",
        description: "Component created successfully",
      });
      setIsAddMode(false);
      setEditFormData({});
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create component",
        variant: "destructive",
      });
    },
  });

  type TreeNode = FleetComponents & { children: TreeNode[] };

  const naturalSortCompare = (a: string, b: string): number => {
    const aParts = a.split(".");
    const bParts = b.split(".");
    const numRe = /^\d+$/;
    const len = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < len; i++) {
      if (i >= aParts.length) return -1;
      if (i >= bParts.length) return 1;
      const aIsNum = numRe.test(aParts[i]);
      const bIsNum = numRe.test(bParts[i]);
      if (aIsNum && bIsNum) {
        const diff = parseInt(aParts[i], 10) - parseInt(bParts[i], 10);
        if (diff !== 0) return diff;
      } else {
        const cmp = aParts[i].localeCompare(bParts[i]);
        if (cmp !== 0) return cmp;
      }
    }
    return 0;
  };

  const sortTreeNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => naturalSortCompare(a.fleetEquipmentCode, b.fleetEquipmentCode));
    nodes.forEach((n) => sortTreeNodes(n.children));
  };

  const buildTree = (components: FleetComponents[]): TreeNode[] => {
    const tree: TreeNode[] = [];
    const lookup = new Map<string, TreeNode>();

    components.forEach((comp) => {
      lookup.set(comp.fleetEquipmentCode, { ...comp, children: [] });
    });

    components.forEach((comp) => {
      const node = lookup.get(comp.fleetEquipmentCode);
      if (!node) return;

      if (comp.parentFleetEquipmentCode) {
        const parent = lookup.get(comp.parentFleetEquipmentCode);
        if (parent) {
          parent.children.push(node);
        } else {
          tree.push(node);
        }
      } else {
        tree.push(node);
      }
    });

    sortTreeNodes(tree);

    return tree;
  };

  const filteredComponents = components?.filter((comp) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      comp.fleetEquipmentName?.toLowerCase().includes(query) ||
      comp.fleetEquipmentCode?.toLowerCase().includes(query) ||
      comp.makerName?.toLowerCase().includes(query)
    );
  }) || [];

  const treeData = buildTree(filteredComponents);

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddNew = (parentCode?: string | null) => {
    setDetailComponent(null);
    setIsEditMode(false);
    setEditFormData({
      fleetEquipmentCode: "",
      fleetEquipmentName: "",
      parentFleetEquipmentCode: parentCode || "",
      componentCategory: "",
      eqptSystemDept: "",
      makerName: "",
      makerCode: "",
      model: "",
      modelCode: "",
      location: "",
      rating: "",
      isActive: true,
      notes: "",
    });
    setMakerSearchText("");
    setIsAddMode(true);
  };

  const handleEdit = (component: FleetComponents) => {
    setDetailComponent(component);
    setEditFormData({
      fleetEquipmentCode: component.fleetEquipmentCode || "",
      fleetEquipmentName: component.fleetEquipmentName || "",
      parentFleetEquipmentCode: component.parentFleetEquipmentCode || "",
      componentCategory: component.componentCategory || "",
      eqptSystemDept: component.eqptSystemDept || "",
      makerName: component.makerName || "",
      makerCode: component.makerCode || "",
      model: component.model || "",
      modelCode: component.modelCode || "",
      location: component.location || "",
      rating: component.rating || "",
      isActive: component.isActive,
      notes: component.notes || "",
    });
    setMakerSearchText(component.makerName || "");
    setIsEditMode(true);
  };

  const handleDeleteClick = (component: FleetComponents) => {
    setComponentToDelete(component);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (componentToDelete) {
      deleteMutation.mutate(componentToDelete.id);
    }
  };

  const handleRowDoubleClick = (component: FleetComponents) => {
    setDetailComponent(component);
  };

  useEffect(() => {
    if (detailComponent && components) {
      const updated = components.find(c => c.id === detailComponent.id);
      if (updated) {
        setDetailComponent(updated);
      }
    }
  }, [components]);

  const handleExport = async () => {
    try {
      const response = await fetch('/technical/api/fleet-admin/fleet-components/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fleet-components-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Success",
        description: "Components exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export components",
        variant: "destructive",
      });
    }
  };

  const totalComponents = components?.filter(c => c.fleetEquipmentCode?.length === 10).length || 0;
  const rootComponents = treeData.length;

  const renderDetailField = (label: string, value: string | null | undefined, testId?: string) => (
    <div className="space-y-1" data-testid={testId}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value || "-"}</p>
    </div>
  );

  const renderEditField = (label: string, fieldKey: string, testId?: string, placeholder?: string) => (
    <div className="space-y-1" data-testid={testId}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <Input
        value={editFormData[fieldKey] || ""}
        onChange={(e) => setEditFormData(prev => ({ ...prev, [fieldKey]: e.target.value }))}
        placeholder={placeholder || label}
        className="bg-white border-gray-300 text-sm"
        data-testid={`edit-input-${fieldKey}`}
      />
    </div>
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (makerSearchRef.current && !makerSearchRef.current.contains(event.target as Node)) {
        setShowMakerSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredMakers = (makersData || []).filter(m => {
    if (!makerSearchText) return true;
    const q = makerSearchText.toLowerCase();
    return m.makerName?.toLowerCase().includes(q) || m.makerCode?.toLowerCase().includes(q);
  });

  const handleSelectMaker = (maker: MakerList) => {
    setEditFormData(prev => ({
      ...prev,
      makerName: maker.makerName || "",
      makerCode: maker.makerCode || "",
    }));
    setMakerSearchText(maker.makerName || "");
    setShowMakerSuggestions(false);
  };

  const handleClearMaker = () => {
    setEditFormData(prev => ({
      ...prev,
      makerName: "",
      makerCode: "",
    }));
    setMakerSearchText("");
    setShowMakerSuggestions(false);
  };

  const renderMakerSearchField = (testId?: string) => (
    <div className="space-y-1 relative" ref={makerSearchRef} data-testid={testId}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Maker</p>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input
          value={makerSearchText}
          onChange={(e) => {
            setMakerSearchText(e.target.value);
            setShowMakerSuggestions(true);
          }}
          onFocus={() => setShowMakerSuggestions(true)}
          placeholder="Search maker name..."
          className="bg-white border-gray-300 text-sm pl-8 pr-8"
          data-testid="edit-input-makerSearch"
        />
        {makerSearchText && (
          <button
            type="button"
            onClick={handleClearMaker}
            className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            data-testid="btn-clear-maker"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {showMakerSuggestions && filteredMakers.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filteredMakers.slice(0, 20).map((maker) => (
            <div
              key={maker.id}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-cyan-50 flex items-center justify-between"
              onClick={() => handleSelectMaker(maker)}
              data-testid={`maker-suggestion-${maker.id}`}
            >
              <span className="font-medium text-gray-800 truncate">{maker.makerName}</span>
              {maker.makerCode && (
                <span className="text-xs text-gray-400 ml-2 shrink-0">{maker.makerCode}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {showMakerSuggestions && makerSearchText && filteredMakers.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="px-3 py-2 text-sm text-gray-500">No makers found</div>
        </div>
      )}
    </div>
  );

  const handleStartEdit = () => {
    if (!detailComponent) return;
    setEditFormData({
      fleetEquipmentCode: detailComponent.fleetEquipmentCode || "",
      fleetEquipmentName: detailComponent.fleetEquipmentName || "",
      parentFleetEquipmentCode: detailComponent.parentFleetEquipmentCode || "",
      componentCategory: detailComponent.componentCategory || "",
      eqptSystemDept: detailComponent.eqptSystemDept || "",
      makerName: detailComponent.makerName || "",
      makerCode: detailComponent.makerCode || "",
      model: detailComponent.model || "",
      modelCode: detailComponent.modelCode || "",
      location: detailComponent.location || "",
      rating: detailComponent.rating || "",
      isActive: detailComponent.isActive,
      notes: detailComponent.notes || "",
    });
    setMakerSearchText(detailComponent.makerName || "");
    setIsEditMode(true);
  };

  const handleSaveEdit = () => {
    if (!detailComponent) return;
    const changedFields: Record<string, any> = {};
    const originalData: Record<string, any> = {
      fleetEquipmentCode: detailComponent.fleetEquipmentCode || "",
      fleetEquipmentName: detailComponent.fleetEquipmentName || "",
      parentFleetEquipmentCode: detailComponent.parentFleetEquipmentCode || "",
      componentCategory: detailComponent.componentCategory || "",
      eqptSystemDept: detailComponent.eqptSystemDept || "",
      makerName: detailComponent.makerName || "",
      makerCode: detailComponent.makerCode || "",
      model: detailComponent.model || "",
      modelCode: detailComponent.modelCode || "",
      location: detailComponent.location || "",
      rating: detailComponent.rating || "",
      isActive: detailComponent.isActive,
      notes: detailComponent.notes || "",
    };

    for (const key of Object.keys(editFormData)) {
      if (editFormData[key] !== originalData[key]) {
        changedFields[key] = editFormData[key];
      }
    }

    if (Object.keys(changedFields).length === 0) {
      toast({ title: "No Changes", description: "No fields were modified" });
      setIsEditMode(false);
      return;
    }

    inlineUpdateMutation.mutate({ id: detailComponent.id, data: changedFields });
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditFormData({});
  };

  const handleSaveAdd = () => {
    if (!editFormData.fleetEquipmentCode || !editFormData.fleetEquipmentName) {
      toast({
        title: "Validation Error",
        description: "Fleet Equipment Code and Equipment Name are required",
        variant: "destructive",
      });
      return;
    }
    const payload: Record<string, any> = {};
    for (const [key, value] of Object.entries(editFormData)) {
      if (value !== "" && value !== null && value !== undefined) {
        payload[key] = value;
      }
    }
    createMutation.mutate(payload);
  };

  const handleCancelAdd = () => {
    setIsAddMode(false);
    setEditFormData({});
  };

  const parentOptionsForAdd = components?.filter(c => c.fleetEquipmentCode) || [];
  const parentOptions = components?.filter(c => c.id !== detailComponent?.id && c.fleetEquipmentCode) || [];

  if (isAddMode) {
    return (
      <div className="p-6">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Plus className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white" data-testid="title-add-component">Add New Component</h1>
                  <p className="text-cyan-100 text-sm mt-0.5">Create a new fleet component</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="bg-white/20 text-white border-white/30"
                  variant="outline"
                  onClick={handleSaveAdd}
                  disabled={createMutation.isPending}
                  data-testid="btn-save-add-component"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {createMutation.isPending ? "Saving..." : "Save"}
                </Button>
                <Button
                  className="bg-white/10 text-white border-white/20"
                  variant="outline"
                  onClick={handleCancelAdd}
                  disabled={createMutation.isPending}
                  data-testid="btn-cancel-add-component"
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-4 w-4 text-cyan-600" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Equipment Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                {renderEditField("Fleet Equipment Code", "fleetEquipmentCode", "add-fleet-code")}
                {renderEditField("Equipment Name", "fleetEquipmentName", "add-equipment-name")}
                <div className="space-y-1" data-testid="add-parent-code">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Parent Fleet Equipment Code</p>
                  <Select
                    value={editFormData.parentFleetEquipmentCode || "none"}
                    onValueChange={(val) => setEditFormData(prev => ({ ...prev, parentFleetEquipmentCode: val === "none" ? "" : val }))}
                  >
                    <SelectTrigger className="bg-white border-gray-300 text-sm" data-testid="add-select-parent">
                      <SelectValue placeholder="Select parent (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Top Level)</SelectItem>
                      {parentOptionsForAdd.map((c) => (
                        <SelectItem key={c.id} value={c.fleetEquipmentCode}>
                          {c.fleetEquipmentCode} - {c.fleetEquipmentName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {renderEditField("Component Category", "componentCategory", "add-category")}
                {renderEditField("Equipment System / Department", "eqptSystemDept", "add-eqpt-system-dept")}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-4 w-4 text-cyan-600" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Maker & Model Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                {renderMakerSearchField("add-maker-name")}
                <div className="space-y-1" data-testid="add-maker-code">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Maker Code</p>
                  <Input
                    value={editFormData.makerCode || ""}
                    readOnly
                    className="bg-gray-100 border-gray-300 text-sm text-gray-600"
                    placeholder="Auto-filled from maker selection"
                    data-testid="edit-input-makerCode"
                  />
                </div>
                {renderEditField("Model", "model", "add-model")}
                {renderEditField("Model Code", "modelCode", "add-model-code")}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-4 w-4 text-cyan-600" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Additional Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                {renderEditField("Location", "location", "add-location")}
                {renderEditField("Rating", "rating", "add-rating")}
                <div className="space-y-1" data-testid="add-is-active">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Is Active</p>
                  <Select
                    value={editFormData.isActive === true ? "Yes" : editFormData.isActive === false ? "No" : ""}
                    onValueChange={(val) => setEditFormData(prev => ({ ...prev, isActive: val === "Yes" }))}
                  >
                    <SelectTrigger className="bg-white border-gray-300 text-sm" data-testid="add-select-is-active">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4 text-cyan-600" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Notes</h3>
              </div>
              <Textarea
                value={editFormData.notes || ""}
                onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional details about the equipment"
                rows={4}
                className="bg-white border-gray-300 text-sm"
                data-testid="add-input-notes"
              />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (detailComponent) {
    const parentName = components?.find(c => c.fleetEquipmentCode === detailComponent.parentFleetEquipmentCode)?.fleetEquipmentName;

    return (
      <div className="p-6">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  {isEditMode ? <Pencil className="h-5 w-5 text-white" /> : <Info className="h-5 w-5 text-white" />}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white" data-testid="title-component-details">
                    {isEditMode ? "Edit Component Details" : "Component Details"}
                  </h1>
                  <p className="text-cyan-100 text-sm mt-0.5">
                    {detailComponent.fleetEquipmentCode} - {detailComponent.fleetEquipmentName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isEditMode ? (
                  <>
                    <Button
                      className="bg-white/20 text-white border-white/30"
                      variant="outline"
                      onClick={handleSaveEdit}
                      disabled={inlineUpdateMutation.isPending}
                      data-testid="btn-save-component-edit"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {inlineUpdateMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      className="bg-white/10 text-white border-white/20"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={inlineUpdateMutation.isPending}
                      data-testid="btn-cancel-component-edit"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      className="bg-white/20 text-white border-white/30"
                      variant="outline"
                      onClick={handleStartEdit}
                      data-testid="btn-edit-component-detail"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <button
                      onClick={() => { setDetailComponent(null); setIsEditMode(false); }}
                      className="flex items-center gap-1 text-cyan-100 hover:text-white text-sm transition-colors"
                      data-testid="button-back-to-list"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to List
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-4 w-4 text-cyan-600" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Equipment Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                {isEditMode ? (
                  <>
                    {renderEditField("Fleet Equipment Code", "fleetEquipmentCode", "detail-fleet-code")}
                    {renderEditField("Equipment Name", "fleetEquipmentName", "detail-equipment-name")}
                    <div className="space-y-1" data-testid="detail-parent-code">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Parent Fleet Equipment Code</p>
                      <Select
                        value={editFormData.parentFleetEquipmentCode || "none"}
                        onValueChange={(val) => setEditFormData(prev => ({ ...prev, parentFleetEquipmentCode: val === "none" ? "" : val }))}
                      >
                        <SelectTrigger className="bg-white border-gray-300 text-sm" data-testid="edit-select-parent">
                          <SelectValue placeholder="Select parent (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (Top Level)</SelectItem>
                          {parentOptions.map((c) => (
                            <SelectItem key={c.id} value={c.fleetEquipmentCode}>
                              {c.fleetEquipmentCode} - {c.fleetEquipmentName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {renderEditField("Component Category", "componentCategory", "detail-category")}
                    {renderEditField("Equipment System / Department", "eqptSystemDept", "detail-eqpt-system-dept")}
                  </>
                ) : (
                  <>
                    {renderDetailField("Fleet Equipment Code", detailComponent.fleetEquipmentCode, "detail-fleet-code")}
                    {renderDetailField("Equipment Name", detailComponent.fleetEquipmentName, "detail-equipment-name")}
                    {renderDetailField("Parent Fleet Equipment Code", detailComponent.parentFleetEquipmentCode, "detail-parent-code")}
                    {renderDetailField("Parent Equipment Name", parentName, "detail-parent-name")}
                    {renderDetailField("Component Category", detailComponent.componentCategory, "detail-category")}
                    {renderDetailField("Equipment System / Department", detailComponent.eqptSystemDept, "detail-eqpt-system-dept")}
                  </>
                )}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-4 w-4 text-cyan-600" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Maker & Model Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                {isEditMode ? (
                  <>
                    {renderMakerSearchField("detail-maker-name")}
                    <div className="space-y-1" data-testid="detail-maker-code">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Maker Code</p>
                      <Input
                        value={editFormData.makerCode || ""}
                        readOnly
                        className="bg-gray-100 border-gray-300 text-sm text-gray-600"
                        placeholder="Auto-filled from maker selection"
                        data-testid="edit-input-makerCode-detail"
                      />
                    </div>
                    {renderEditField("Model", "model", "detail-model")}
                    {renderEditField("Model Code", "modelCode", "detail-model-code")}
                  </>
                ) : (
                  <>
                    {renderDetailField("Maker Name", detailComponent.makerName, "detail-maker-name")}
                    {renderDetailField("Maker Code", detailComponent.makerCode, "detail-maker-code")}
                    {renderDetailField("Model", detailComponent.model, "detail-model")}
                    {renderDetailField("Model Code", detailComponent.modelCode, "detail-model-code")}
                  </>
                )}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-4 w-4 text-cyan-600" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Additional Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                {isEditMode ? (
                  <>
                    {renderEditField("Location", "location", "detail-location")}
                    {renderEditField("Rating", "rating", "detail-rating")}
                    <div className="space-y-1" data-testid="detail-is-active">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Is Active</p>
                      <Select
                        value={editFormData.isActive === true ? "Yes" : editFormData.isActive === false ? "No" : ""}
                        onValueChange={(val) => setEditFormData(prev => ({ ...prev, isActive: val === "Yes" }))}
                      >
                        <SelectTrigger className="bg-white border-gray-300 text-sm" data-testid="edit-select-is-active">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    {renderDetailField("Location", detailComponent.location, "detail-location")}
                    {renderDetailField("Rating", detailComponent.rating, "detail-rating")}
                    <div className="space-y-1" data-testid="detail-is-active">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Is Active</p>
                      <div className="flex items-center gap-1.5">
                        {detailComponent.isActive ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-700 font-medium">Yes</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-red-700 font-medium">No</span>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4 text-cyan-600" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Notes</h3>
              </div>
              {isEditMode ? (
                <Textarea
                  value={editFormData.notes || ""}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional details about the equipment"
                  rows={4}
                  className="bg-white border-gray-300 text-sm"
                  data-testid="edit-input-notes"
                />
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{detailComponent.notes || "-"}</p>
              )}
            </div>
          </div>
        </Card>

      </div>
    );
  }

  const renderTreeNode = (node: TreeNode, level: number = 0, isFirstRoot: boolean = false): JSX.Element => {
    const nodeKey = String(node.id);
    const isExpanded = expandedNodes.has(nodeKey);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <>
        <TableRow
          key={nodeKey}
          className="hover:bg-blue-50/40 transition-colors border-b border-gray-100 cursor-pointer"
          data-testid={`row-component-${nodeKey}`}
          onDoubleClick={() => handleRowDoubleClick(node)}
        >
          <TableCell style={{ paddingLeft: `${level * 28 + 16}px` }} className="font-mono text-sm py-3" data-testid={isFirstRoot ? "I4.QL.3.20" : undefined}>
            {isFirstRoot && <Marker id="I4.QL.3.20" />}
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleNode(nodeKey); }}
                  className="p-1 rounded-md hover:bg-cyan-100 text-cyan-700 transition-colors"
                  data-testid={`button-toggle-${nodeKey}`}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <div className="w-6" />
              )}
              <span className="text-gray-700 font-semibold">{node.fleetEquipmentCode}</span>
            </div>
          </TableCell>
          <TableCell className="py-3" data-testid={isFirstRoot ? "I4.QL.3.21" : undefined}>
            {isFirstRoot && <Marker id="I4.QL.3.21" />}
            <span className="font-medium text-gray-800">{node.fleetEquipmentName}</span>
          </TableCell>
          <TableCell className="font-mono text-sm text-gray-500 py-3" data-testid={isFirstRoot ? "I4.QL.3.22" : undefined}>
            {isFirstRoot && <Marker id="I4.QL.3.22" />}
            {node.componentCategory || "-"}
          </TableCell>
          <TableCell className="text-gray-600 py-3" data-testid={isFirstRoot ? "I4.QL.3.23" : undefined}>
            {isFirstRoot && <Marker id="I4.QL.3.23" />}
            {node.makerName || "-"}
          </TableCell>
          <TableCell className="text-gray-600 py-3" data-testid={isFirstRoot ? "I4.QL.3.24" : undefined}>
            {isFirstRoot && <Marker id="I4.QL.3.24" />}
            {node.model || "-"}
          </TableCell>
          <TableCell className="text-right py-3">
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); handleAddNew(node.fleetEquipmentCode); }}
                onDoubleClick={(e) => e.stopPropagation()}
                className="text-cyan-600"
                data-testid={isFirstRoot ? "I4.QL.3.25" : `button-add-child-${nodeKey}`}
                title="Add Child"
              >
                {isFirstRoot && <Marker id="I4.QL.3.25" />}
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); handleEdit(node); }}
                onDoubleClick={(e) => e.stopPropagation()}
                className="text-blue-600"
                data-testid={isFirstRoot ? "I4.QL.3.26" : `button-edit-${nodeKey}`}
                title="Edit"
              >
                {isFirstRoot && <Marker id="I4.QL.3.26" />}
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); handleDeleteClick(node); }}
                onDoubleClick={(e) => e.stopPropagation()}
                className="text-red-500"
                data-testid={isFirstRoot ? "I4.QL.3.27" : `button-delete-${nodeKey}`}
                title="Delete"
              >
                {isFirstRoot && <Marker id="I4.QL.3.27" />}
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        {isExpanded && hasChildren && node.children.map((child) => renderTreeNode(child, level + 1, false))}
      </>
    );
  };

  return (
    <div className="p-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Settings className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Fleet Components Management</h1>
                <p className="text-cyan-100 text-sm mt-0.5" data-testid="I4.QL.3.9"><Marker id="I4.QL.3.9" />Manage fleet-level equipment hierarchy (SFI structure)</p>
              </div>
            </div>
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-cyan-100 hover:text-white text-sm transition-colors"
                data-testid="button-back-to-dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-semibold text-gray-800" data-testid="I4.QL.3.10"><Marker id="I4.QL.3.10" />All Fleet Components</h2>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-total-components">
                  <Package className="h-3 w-3 mr-1" />
                  {totalComponents} Total
                </Badge>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-root-components">
                  {rootComponents} Root
                </Badge>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 sm:min-w-[280px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by name, code, or SFI..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-gray-300"
                  data-testid="I4.QL.3.11"
                />
                <Marker id="I4.QL.3.11" />
              </div>
              <Button
                variant="outline"
                onClick={handleExport}
                className="border-gray-300 text-gray-700"
                data-testid="I4.QL.3.12"
              >
                <Marker id="I4.QL.3.12" />
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button
                onClick={() => handleAddNew()}
                className="bg-cyan-600 whitespace-nowrap"
                data-testid="I4.QL.3.13"
              >
                <Marker id="I4.QL.3.13" />
                <Plus className="mr-2 h-4 w-4" />
                Add New Component
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-5 w-16 bg-gray-200 animate-pulse rounded" />
                  <div className="h-5 flex-1 bg-gray-100 animate-pulse rounded" />
                  <div className="h-5 w-20 bg-gray-100 animate-pulse rounded" />
                  <div className="h-5 w-24 bg-gray-100 animate-pulse rounded" />
                  <div className="h-5 w-20 bg-gray-100 animate-pulse rounded" />
                  <div className="h-5 w-24 bg-gray-100 animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <Trash2 className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-red-700 font-medium">Failed to load components</p>
              <p className="text-red-500 text-sm mt-1">Please try refreshing the page</p>
            </div>
          ) : filteredComponents.length === 0 ? (
            <div className="text-center py-16">
              <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Package className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">
                {searchQuery ? "No components found matching your search" : "No components yet"}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {searchQuery ? "Try adjusting your search terms" : "Add your first component to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-200">
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.3.14"><Marker id="I4.QL.3.14" />Fleet Code</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.3.15"><Marker id="I4.QL.3.15" />Equipment Name</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.3.16"><Marker id="I4.QL.3.16" />Category</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.3.17"><Marker id="I4.QL.3.17" />Maker</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.3.18"><Marker id="I4.QL.3.18" />Model</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.3.19"><Marker id="I4.QL.3.19" />Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treeData.map((node, index) => renderTreeNode(node, 0, index === 0))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-component">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Delete Component</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Are you sure you want to delete "<span className="font-medium text-gray-800">{componentToDelete?.fleetEquipmentName}</span>"? This action cannot be undone and will also delete all child components.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
