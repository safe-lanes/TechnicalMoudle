import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, ClipboardList, Archive, Store } from "lucide-react";
import { ComponentTreeSelector } from "./ComponentTreeSelector";
import { TableSelector } from "./TableSelector";
import { buildComponentTree } from "@/utils/componentUtils";

interface TargetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
  vesselId: string;
  onTargetSelect: (targetType: string, targetId: string, snapshot: any) => void;
}

export function TargetPicker({
  open,
  onOpenChange,
  category,
  vesselId,
  onTargetSelect
}: TargetPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Fetch data based on category
  const { data, isLoading, error } = useQuery({
    queryKey: [`/technical/api/${getApiEndpoint(category)}`, vesselId],
    queryFn: async () => {
      const endpoint = getApiEndpoint(category);
      const response = await fetch(`/technical/api/${endpoint}${endpoint === 'components' ? `/${vesselId}` : `?vesselId=${vesselId}`}`);
      if (!response.ok) throw new Error(`Failed to fetch ${category}`);
      return response.json();
    },
    enabled: open && !!category && !!vesselId
  });

  function getApiEndpoint(cat: string) {
    switch (cat) {
      case 'components': return 'components';
      case 'work_orders': return 'work-orders';
      case 'spares': return 'spares';
      case 'stores': return 'stores';
      default: return 'components';
    }
  }

  const handleUseTarget = () => {
    if (!selectedItem) return;

    const targetType = category === 'work_orders' ? 'work_order' : 
                      category === 'stores' ? 'store' : 
                      category.slice(0, -1); // Remove 's' from components/spares

    const targetDisplay = {
      name: getItemName(selectedItem, category),
      code: getItemCode(selectedItem, category),
      path: category === 'components' ? getComponentPath(selectedItem) : undefined
    };

    const snapshot = createSnapshot(selectedItem, category);
    
    // Pass the full payload structure as expected by the spec
    const payload = {
      targetType,
      targetId: getItemId(selectedItem, category),
      targetDisplay,
      snapshotBeforeJson: snapshot
    };
    
    onTargetSelect(targetType, payload.targetId, payload);
    onOpenChange(false);
  };

  const getItemId = (item: any, cat: string) => {
    // Always return UUID columns as canonical identifiers for change_request.target_id
    if (cat === 'work_orders') return item.wouuid || item.id || item.woNo;
    if (cat === 'spares') return item.suuid || String(item.id || item.partCode);
    if (cat === 'stores') return item.stuuid || String(item.id || item.itemCode);
    return item.cuuid || item.id || item.componentId;
  };

  const getItemName = (item: any, cat: string) => {
    if (cat === 'work_orders') return item.jobTitle;
    if (cat === 'spares') return item.partName;
    if (cat === 'stores') return item.itemName;
    return item.name;
  };

  const getItemCode = (item: any, cat: string) => {
    if (cat === 'work_orders') return item.woNo;
    if (cat === 'spares') return item.partCode;
    if (cat === 'stores') return item.itemCode;
    return item.code;
  };

  const getComponentPath = (component: any): string => {
    // Build path from component hierarchy  
    const buildPath = (node: any, allComponents: any[]): string[] => {
      const parts: string[] = [`${node.componentCode || node.code} ${node.name}`];
      
      if (node.parentId) {
        const parent = allComponents.find(c => (c.id || c.componentId) === node.parentId);
        if (parent) {
          return [...buildPath(parent, allComponents), ...parts];
        }
      }
      
      return parts;
    };
    
    if (data && Array.isArray(data)) {
      const pathParts = buildPath(component, data);
      return pathParts.join(' > ');
    }
    
    return `${component.componentCode || component.code} ${component.name}`;
  };

  const createSnapshot = (item: any, cat: string) => {
    const now = new Date().toISOString();
    const snapshot: any = {
      capturedAtUtc: now,
      vesselId: vesselId,
      displayKey: getItemCode(item, cat),
      displayName: getItemName(item, cat),
      fields: {}
    };

    if (cat === 'components') {
      snapshot.displayPath = getComponentPath(item);
      snapshot.fields = {
        maker: item.maker || '',
        model: item.model || '',
        serialNo: item.serialNo || '',
        department: item.deptCategory || '',
        componentCategory: item.componentCategory || '',
        location: item.location || '',
        commissionedDate: item.commissionedDate || '',
        critical: item.critical || false,
        classItem: item.classItem || false
      };
    } else if (cat === 'work_orders') {
      snapshot.fields = {
        jobTitle: item.jobTitle,
        frequencyType: item.frequencyType || '',
        frequencyValue: item.frequencyValue || '',
        frequencyUnit: item.frequencyUnit || '',
        assignedTo: item.assignedTo || '',
        priority: item.priority || '',
        status: item.status || '',
        dueDate: item.dueDate || ''
      };
    } else if (cat === 'spares') {
      snapshot.fields = {
        partCode: item.partCode,
        partName: item.partName,
        linkedComponentName: item.componentName || '',
        linkedComponentCode: item.componentCode || '',
        uom: item.uom || '',
        min: item.min || 0,
        rob: item.rob || 0,
        location: item.location || '',
        critical: item.critical === 'Critical' || item.critical === true
      };
    } else if (cat === 'stores') {
      snapshot.fields = {
        itemCode: item.itemCode,
        itemName: item.itemName,
        storesCategory: item.storesCategory || '',
        uom: item.uom || '',
        min: item.min || 0,
        rob: item.rob || 0,
        location: item.location || ''
      };
    }

    return snapshot;
  };

  // Process component data for tree structure
  const componentTree = category === 'components' && data ? buildComponentTree(data) : [];

  const renderPreview = () => {
    if (!selectedItem) return <div className="text-center text-gray-500 py-8">Select an item to preview</div>;

    const getIcon = () => {
      switch (category) {
        case 'components': return <Package className="h-5 w-5" />;
        case 'work_orders': return <ClipboardList className="h-5 w-5" />;
        case 'spares': return <Archive className="h-5 w-5" />;
        case 'stores': return <Store className="h-5 w-5" />;
        default: return null;
      }
    };

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          {getIcon()}
          <div className="flex-1">
            <h3 className="font-semibold text-lg">
              {getItemName(selectedItem, category)}
            </h3>
            <p className="text-sm text-gray-600 font-mono">
              {getItemCode(selectedItem, category)}
            </p>
            {category === 'components' && selectedItem && (
              <p className="text-xs text-gray-500 mt-1">
                {getComponentPath(selectedItem)}
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Fields */}
        <div className="space-y-3">
          {category === 'components' && (
            <>
              <h4 className="text-sm font-medium">Component Information</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Maker</Label>
                  <p className="text-sm">{selectedItem.maker || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Model</Label>
                  <p className="text-sm">{selectedItem.model || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Serial No</Label>
                  <p className="text-sm">{selectedItem.serialNo || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Department</Label>
                  <p className="text-sm">{selectedItem.deptCategory || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Component Category</Label>
                  <p className="text-sm">{selectedItem.componentCategory || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Location</Label>
                  <p className="text-sm">{selectedItem.location || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Commissioned Date</Label>
                  <p className="text-sm">{selectedItem.commissionedDate || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Critical</Label>
                  <p className="text-sm">{selectedItem.critical ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Class Item</Label>
                  <p className="text-sm">{selectedItem.classItem ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </>
          )}

          {category === 'work_orders' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">WO No</Label>
                  <p className="text-sm font-mono">{selectedItem.woNo}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Job Title</Label>
                  <p className="text-sm">{selectedItem.jobTitle}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500">Component</Label>
                  <p className="text-sm">{selectedItem.componentName || '-'}</p>
                  {selectedItem.componentCode && (
                    <p className="text-xs text-gray-400">{selectedItem.componentCode}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Frequency Type</Label>
                  <p className="text-sm">{selectedItem.frequencyType || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Frequency Value</Label>
                  <p className="text-sm">
                    {selectedItem.frequencyValue} {selectedItem.frequencyUnit}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Assigned To</Label>
                  <p className="text-sm">{selectedItem.assignedTo || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Priority</Label>
                  <p className="text-sm">{selectedItem.priority || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Status</Label>
                  <p className="text-sm">{selectedItem.status || 'Active'}</p>
                </div>
                {selectedItem.dueDate && (
                  <div>
                    <Label className="text-xs text-gray-500">Due Date</Label>
                    <p className="text-sm">{selectedItem.dueDate}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {category === 'spares' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Part Code</Label>
                  <p className="text-sm font-mono">{selectedItem.partCode}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Part Name</Label>
                  <p className="text-sm">{selectedItem.partName}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500">Linked Component</Label>
                  <p className="text-sm">{selectedItem.componentName || '-'}</p>
                  {selectedItem.componentCode && (
                    <p className="text-xs text-gray-400">{selectedItem.componentCode}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-gray-500">UOM</Label>
                  <p className="text-sm">{selectedItem.uom || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Min</Label>
                  <p className="text-sm">{selectedItem.min}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">ROB</Label>
                  <p className="text-sm">{selectedItem.rob}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Location</Label>
                  <p className="text-sm">{selectedItem.location || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Critical</Label>
                  <p className="text-sm">
                    {selectedItem.critical === 'Critical' || selectedItem.critical === true ? 'Critical' : 'No'}
                  </p>
                </div>
              </div>
            </>
          )}

          {category === 'stores' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Item Code</Label>
                  <p className="text-sm font-mono">{selectedItem.itemCode}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Item Name</Label>
                  <p className="text-sm">{selectedItem.itemName}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Stores Category</Label>
                  <p className="text-sm">{selectedItem.storesCategory || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">UOM</Label>
                  <p className="text-sm">{selectedItem.uom || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Min</Label>
                  <p className="text-sm">{selectedItem.min}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">ROB</Label>
                  <p className="text-sm">{selectedItem.rob}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500">Location</Label>
                  <p className="text-sm">{selectedItem.location || '-'}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[85vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Select Target {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}</DialogTitle>
        </DialogHeader>

        <div className="flex h-[calc(100%-8rem)]">
          {/* Left Pane - List/Tree (~60%) */}
          <div className="w-3/5 border-r">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading {category.replace('_', ' ')}...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-red-500">
                  <p className="mb-2">Failed to load {category.replace('_', ' ')}</p>
                  <p className="text-sm text-gray-500">Please try again</p>
                </div>
              </div>
            ) : (
              <>
                {category === 'components' ? (
                  <ComponentTreeSelector
                    components={componentTree}
                    selectedItem={selectedItem}
                    onSelect={setSelectedItem}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                  />
                ) : (
                  <TableSelector
                    category={category as 'work_orders' | 'spares' | 'stores'}
                    items={data || []}
                    selectedItem={selectedItem}
                    onSelect={setSelectedItem}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                  />
                )}
              </>
            )}
          </div>

          {/* Right Pane - Preview (~40%) */}
          <div className="w-2/5 p-6 bg-gray-50">
            {renderPreview()}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleUseTarget} 
            disabled={!selectedItem}
          >
            Use this target
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}