import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CalendarIcon, ChevronRight, ChevronDown, Package, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Change {
  path: string;
  label: string;
  before: any;
  after: any;
}

interface MovePreview {
  oldPath: string;
  newPath: string;
  oldCode: string;
  newCodePreview: string;
}

interface ProposeChangesProps {
  targetType: string | null;
  snapshotData: any;
  existingProposedChanges?: Change[];
  existingMovePreview?: MovePreview | null;
  onSaveProposed: (changes: Change[], movePreview?: MovePreview | null) => void;
  disabled?: boolean;
}

// Component tree selector for move functionality
function ComponentTreeSelector({ 
  open, 
  onOpenChange, 
  onSelect,
  vesselId 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSelect: (component: any) => void;
  vesselId: string;
}) {
  const [components, setComponents] = useState<any[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedComponent, setSelectedComponent] = useState<any>(null);

  useEffect(() => {
    if (open) {
      // Fetch components
      fetch(`/technical/api/components/${vesselId}`)
        .then(res => res.json())
        .then(data => setComponents(data || []))
        .catch(console.error);
    }
  }, [open, vesselId]);

  const toggleExpand = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderTree = (nodes: any[], level = 0) => {
    if (!nodes) return null;
    
    return nodes.map(node => (
      <div key={node.id || node.code}>
        <div
          className={cn(
            "flex items-center py-2 px-2 hover:bg-gray-100 cursor-pointer rounded",
            selectedComponent?.id === node.id && "bg-blue-50 border-blue-500"
          )}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => setSelectedComponent(node)}
        >
          {node.children && node.children.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id || node.code);
              }}
              className="mr-1"
            >
              {expandedNodes.has(node.id || node.code) ? 
                <ChevronDown className="h-4 w-4" /> : 
                <ChevronRight className="h-4 w-4" />
              }
            </button>
          )}
          <Package className="h-4 w-4 mr-2 text-gray-500" />
          <span className="font-mono text-sm mr-2">{node.code}</span>
          <span className="text-sm">{node.name}</span>
        </div>
        {node.children && expandedNodes.has(node.id || node.code) && (
          <div>{renderTree(node.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[600px]">
        <DialogHeader>
          <DialogTitle>Select New Parent Component</DialogTitle>
          <DialogDescription>
            Choose the component where this item should be moved to
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex h-[450px]">
          <ScrollArea className="flex-1 border rounded-lg p-4">
            {renderTree(components)}
          </ScrollArea>
          
          {selectedComponent && (
            <div className="w-[300px] ml-4 p-4 border rounded-lg bg-gray-50">
              <h3 className="font-semibold mb-2">Selected Parent</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <Label className="text-xs text-gray-500">Code</Label>
                  <p className="font-mono">{selectedComponent.code}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Name</Label>
                  <p>{selectedComponent.name}</p>
                </div>
                {selectedComponent.maker && (
                  <div>
                    <Label className="text-xs text-gray-500">Maker</Label>
                    <p>{selectedComponent.maker}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              if (selectedComponent) {
                onSelect(selectedComponent);
                onOpenChange(false);
              }
            }}
            disabled={!selectedComponent}
          >
            Select as New Parent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProposeChanges({
  targetType,
  snapshotData,
  existingProposedChanges = [],
  existingMovePreview = null,
  onSaveProposed,
  disabled = false
}: ProposeChangesProps) {
  const [proposedFields, setProposedFields] = useState<Record<string, boolean>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [movePreview, setMovePreview] = useState<MovePreview | null>(existingMovePreview);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showTreeSelector, setShowTreeSelector] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Change[]>([]);

  // Initialize from existing proposed changes
  useEffect(() => {
    if (existingProposedChanges.length > 0) {
      const fields: Record<string, boolean> = {};
      const values: Record<string, any> = {};
      
      existingProposedChanges.forEach(change => {
        fields[change.path] = true;
        values[change.path] = change.after;
      });
      
      setProposedFields(fields);
      setFieldValues(values);
    }
    
    if (existingMovePreview) {
      setMovePreview(existingMovePreview);
    }
  }, [existingProposedChanges, existingMovePreview]);

  if (!targetType || !snapshotData) {
    return null;
  }

  const handleToggleField = (path: string, enabled: boolean) => {
    setProposedFields(prev => ({ ...prev, [path]: enabled }));
    if (!enabled) {
      // Clear the value when toggled off
      setFieldValues(prev => {
        const updated = { ...prev };
        delete updated[path];
        return updated;
      });
    }
  };

  const handleFieldChange = (path: string, value: any) => {
    setFieldValues(prev => ({ ...prev, [path]: value }));
  };

  const buildChanges = (): Change[] => {
    const changes: Change[] = [];
    const fields = snapshotData.fields || {};

    Object.keys(proposedFields).forEach(path => {
      if (proposedFields[path] && fieldValues[path] !== undefined) {
        const fieldKey = path.split('.').pop() || path;
        const before = fields[fieldKey];
        const after = fieldValues[path];
        
        if (before !== after) {
          changes.push({
            path,
            label: getFieldLabel(path, targetType),
            before,
            after
          });
        }
      }
    });

    return changes;
  };

  const getFieldLabel = (path: string, type: string): string => {
    const labels: Record<string, Record<string, string>> = {
      work_order: {
        jobTitle: "Job Title",
        frequencyType: "Frequency Type",
        frequencyValue: "Frequency Value",
        frequencyUnit: "Frequency Unit",
        critical: "Criticality",
        assignedTo: "Assigned Rank",
        instructions: "Instructions"
      },
      component: {
        maker: "Maker",
        model: "Model",
        serialNo: "Serial No",
        deptCategory: "Department",
        componentCategory: "Component Category",
        location: "Location",
        commissionedDate: "Commissioned Date",
        critical: "Critical",
        classItem: "Class Item"
      },
      spare: {
        uom: "UOM",
        min: "Minimum",
        critical: "Critical",
        location: "Location"
      },
      store: {
        itemName: "Item Name",
        uom: "UOM",
        min: "Minimum",
        location: "Location"
      }
    };

    const fieldKey = path.split('.').pop() || path;
    return labels[type]?.[fieldKey] || fieldKey;
  };

  const handleReviewChanges = () => {
    const changes = buildChanges();
    setPendingChanges(changes);
    setShowReviewDialog(true);
  };

  const handleClearProposed = () => {
    setProposedFields({});
    setFieldValues({});
    setMovePreview(null);
  };

  const handleNewParentSelect = (parent: any) => {
    // Generate new code preview based on parent
    const currentCode = snapshotData.fields?.code || '';
    const parentCode = parent.code;
    const siblings = parent.children || [];
    const nextNumber = siblings.length + 1;
    const newCodePreview = `${parentCode}.${nextNumber}`;
    
    // Build path strings
    const oldPath = snapshotData.displayPath || currentCode;
    const newPath = `${parent.name} > ${snapshotData.displayName}`;
    
    setMovePreview({
      oldPath,
      newPath,
      oldCode: currentCode,
      newCodePreview
    });
  };

  const renderWorkOrderFields = () => {
    const fields = snapshotData.fields || {};
    
    return (
      <>
        {/* Job Title */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Job Title</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.jobTitle || '-'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['jobTitle'] || false}
              onCheckedChange={(checked) => handleToggleField('jobTitle', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Input
              value={fieldValues['jobTitle'] || fields.jobTitle || ''}
              onChange={(e) => handleFieldChange('jobTitle', e.target.value)}
              disabled={!proposedFields['jobTitle'] || disabled}
              maxLength={120}
              placeholder="Enter new job title"
            />
          </div>
        </div>

        {/* Frequency Type */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Frequency Type</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.frequencyType || '-'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['frequencyType'] || false}
              onCheckedChange={(checked) => handleToggleField('frequencyType', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Select
              value={fieldValues['frequencyType'] || fields.frequencyType || ''}
              onValueChange={(value) => handleFieldChange('frequencyType', value)}
              disabled={!proposedFields['frequencyType'] || disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select frequency type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Period">Period</SelectItem>
                <SelectItem value="Running Hours">Running Hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Frequency Value & Unit */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Frequency Value</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">
              {fields.frequencyValue} {fields.frequencyType === 'Period' ? fields.frequencyUnit : 'hours'}
            </p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['frequencyValue'] || false}
              onCheckedChange={(checked) => handleToggleField('frequencyValue', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <div className="flex gap-2">
              <Input
                type="number"
                min="1"
                value={fieldValues['frequencyValue'] || fields.frequencyValue || ''}
                onChange={(e) => handleFieldChange('frequencyValue', parseInt(e.target.value))}
                disabled={!proposedFields['frequencyValue'] || disabled}
                className="w-24"
              />
              {(fieldValues['frequencyType'] || fields.frequencyType) === 'Period' && (
                <Select
                  value={fieldValues['frequencyUnit'] || fields.frequencyUnit || ''}
                  onValueChange={(value) => handleFieldChange('frequencyUnit', value)}
                  disabled={!proposedFields['frequencyValue'] || disabled}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Days">Days</SelectItem>
                    <SelectItem value="Weeks">Weeks</SelectItem>
                    <SelectItem value="Months">Months</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {(fieldValues['frequencyType'] || fields.frequencyType) === 'Running Hours' && (
                <span className="flex items-center px-3">hours</span>
              )}
            </div>
          </div>
        </div>

        {/* Criticality */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Criticality</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.critical ? 'Yes' : 'No'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['critical'] || false}
              onCheckedChange={(checked) => handleToggleField('critical', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Select
              value={fieldValues['critical']?.toString() || fields.critical?.toString() || 'false'}
              onValueChange={(value) => handleFieldChange('critical', value === 'true')}
              disabled={!proposedFields['critical'] || disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Assigned Rank */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Assigned Rank</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.assignedTo || '-'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['assignedTo'] || false}
              onCheckedChange={(checked) => handleToggleField('assignedTo', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Select
              value={fieldValues['assignedTo'] || fields.assignedTo || ''}
              onValueChange={(value) => handleFieldChange('assignedTo', value)}
              disabled={!proposedFields['assignedTo'] || disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select rank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Chief Engineer">Chief Engineer</SelectItem>
                <SelectItem value="2nd Engineer">2nd Engineer</SelectItem>
                <SelectItem value="3rd Engineer">3rd Engineer</SelectItem>
                <SelectItem value="4th Engineer">4th Engineer</SelectItem>
                <SelectItem value="Electrical Officer">Electrical Officer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Instructions */}
        <div className="grid grid-cols-12 gap-4 items-start py-2 border-b">
          <div className="col-span-3">
            <Label>Instructions</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm whitespace-pre-wrap">{fields.instructions || '-'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['instructions'] || false}
              onCheckedChange={(checked) => handleToggleField('instructions', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Textarea
              value={fieldValues['instructions'] || fields.instructions || ''}
              onChange={(e) => handleFieldChange('instructions', e.target.value)}
              disabled={!proposedFields['instructions'] || disabled}
              rows={4}
              placeholder="Enter new instructions"
            />
          </div>
        </div>
      </>
    );
  };

  const renderComponentFields = () => {
    const fields = snapshotData.fields || {};
    
    return (
      <>
        <div className="mb-4">
          <h4 className="font-semibold">Section A - Component Information</h4>
        </div>

        {/* Maker */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Maker</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.maker || '-'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['maker'] || false}
              onCheckedChange={(checked) => handleToggleField('maker', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Input
              value={fieldValues['maker'] || fields.maker || ''}
              onChange={(e) => handleFieldChange('maker', e.target.value)}
              disabled={!proposedFields['maker'] || disabled}
              placeholder="Enter maker"
            />
          </div>
        </div>

        {/* Model */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Model</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.model || '-'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['model'] || false}
              onCheckedChange={(checked) => handleToggleField('model', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Input
              value={fieldValues['model'] || fields.model || ''}
              onChange={(e) => handleFieldChange('model', e.target.value)}
              disabled={!proposedFields['model'] || disabled}
              placeholder="Enter model"
            />
          </div>
        </div>

        {/* Serial No */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Serial No</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.serialNo || '-'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['serialNo'] || false}
              onCheckedChange={(checked) => handleToggleField('serialNo', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Input
              value={fieldValues['serialNo'] || fields.serialNo || ''}
              onChange={(e) => handleFieldChange('serialNo', e.target.value)}
              disabled={!proposedFields['serialNo'] || disabled}
              placeholder="Enter serial number"
            />
          </div>
        </div>

        {/* Department */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Department</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.deptCategory || '-'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['deptCategory'] || false}
              onCheckedChange={(checked) => handleToggleField('deptCategory', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Input
              value={fieldValues['deptCategory'] || fields.deptCategory || ''}
              onChange={(e) => handleFieldChange('deptCategory', e.target.value)}
              disabled={!proposedFields['deptCategory'] || disabled}
              placeholder="Enter department"
            />
          </div>
        </div>

        {/* Location */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Location</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.location || '-'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['location'] || false}
              onCheckedChange={(checked) => handleToggleField('location', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Input
              value={fieldValues['location'] || fields.location || ''}
              onChange={(e) => handleFieldChange('location', e.target.value)}
              disabled={!proposedFields['location'] || disabled}
              placeholder="Enter location"
            />
          </div>
        </div>

        {/* Commissioned Date */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Commissioned Date</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.commissionedDate || '-'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['commissionedDate'] || false}
              onCheckedChange={(checked) => handleToggleField('commissionedDate', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={!proposedFields['commissionedDate'] || disabled}
                  className={cn(
                    "justify-start text-left font-normal",
                    !fieldValues['commissionedDate'] && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fieldValues['commissionedDate'] ? 
                    format(new Date(fieldValues['commissionedDate']), "PPP") : 
                    "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={fieldValues['commissionedDate'] ? new Date(fieldValues['commissionedDate']) : undefined}
                  onSelect={(date) => handleFieldChange('commissionedDate', date?.toISOString())}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Critical */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Critical</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.critical ? 'Yes' : 'No'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['critical'] || false}
              onCheckedChange={(checked) => handleToggleField('critical', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Select
              value={fieldValues['critical']?.toString() || fields.critical?.toString() || 'false'}
              onValueChange={(value) => handleFieldChange('critical', value === 'true')}
              disabled={!proposedFields['critical'] || disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Class Item */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Class Item</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.classItem ? 'Yes' : 'No'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['classItem'] || false}
              onCheckedChange={(checked) => handleToggleField('classItem', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Select
              value={fieldValues['classItem']?.toString() || fields.classItem?.toString() || 'false'}
              onValueChange={(value) => handleFieldChange('classItem', value === 'true')}
              disabled={!proposedFields['classItem'] || disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Move Component Preview */}
        <div className="mt-6">
          <h4 className="font-semibold mb-4">Move Component (Preview)</h4>
          {movePreview ? (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-gray-500">Current Path</Label>
                    <p className="text-sm font-mono">{movePreview.oldPath}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">New Path</Label>
                    <p className="text-sm font-mono">{movePreview.newPath}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500">Current Code</Label>
                      <p className="text-sm font-mono">{movePreview.oldCode}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">New Code (Preview)</Label>
                      <p className="text-sm font-mono text-blue-600">{movePreview.newCodePreview}</p>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMovePreview(null)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove Move
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowTreeSelector(true)}
              disabled={disabled}
            >
              <Package className="h-4 w-4 mr-2" />
              Propose New Parent
            </Button>
          )}
        </div>
      </>
    );
  };

  const renderSpareFields = () => {
    const fields = snapshotData.fields || {};
    const uomOptions = ["Each", "Pair", "Set", "Kg", "Ltr", "Mtr", "Box", "Roll", "Pack", "Bottle"];
    
    return (
      <>
        {/* UOM */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>UOM</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.uom || '-'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['uom'] || false}
              onCheckedChange={(checked) => handleToggleField('uom', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Select
              value={fieldValues['uom'] || fields.uom || ''}
              onValueChange={(value) => handleFieldChange('uom', value)}
              disabled={!proposedFields['uom'] || disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select UOM" />
              </SelectTrigger>
              <SelectContent>
                {uomOptions.map(uom => (
                  <SelectItem key={uom} value={uom}>{uom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Minimum */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Minimum</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.min !== undefined ? fields.min : 'N/A'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['min'] || false}
              onCheckedChange={(checked) => handleToggleField('min', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Input
              type="number"
              min="0"
              value={fieldValues['min'] ?? fields.min ?? ''}
              onChange={(e) => handleFieldChange('min', e.target.value ? parseInt(e.target.value) : null)}
              disabled={!proposedFields['min'] || disabled}
              placeholder="Enter minimum (blank for N/A)"
            />
          </div>
        </div>

        {/* Critical */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Critical</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.critical === 'Critical' || fields.critical === 'Yes' ? 'Yes' : 'No'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['critical'] || false}
              onCheckedChange={(checked) => handleToggleField('critical', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Select
              value={fieldValues['critical'] || fields.critical || 'Non-Critical'}
              onValueChange={(value) => handleFieldChange('critical', value)}
              disabled={!proposedFields['critical'] || disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Critical">Yes (Critical)</SelectItem>
                <SelectItem value="Non-Critical">No (Non-Critical)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Location */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Location</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.location || '-'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['location'] || false}
              onCheckedChange={(checked) => handleToggleField('location', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Input
              value={fieldValues['location'] || fields.location || ''}
              onChange={(e) => handleFieldChange('location', e.target.value)}
              disabled={!proposedFields['location'] || disabled}
              placeholder="Enter location"
            />
          </div>
        </div>

        {/* Impact Preview */}
        {proposedFields['min'] && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Impact Preview:</strong> Stock badge would become{' '}
              {getStockStatus(fields.rob, fieldValues['min'] ?? fields.min)}{' '}
              based on current ROB of {fields.rob || 0}.
            </p>
          </div>
        )}
      </>
    );
  };

  const renderStoreFields = () => {
    const fields = snapshotData.fields || {};
    const uomOptions = ["Each", "Pair", "Set", "Kg", "Ltr", "Mtr", "Box", "Roll", "Pack", "Bottle"];
    
    return (
      <>
        {/* Item Name */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Item Name</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.itemName || '-'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['itemName'] || false}
              onCheckedChange={(checked) => handleToggleField('itemName', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Input
              value={fieldValues['itemName'] || fields.itemName || ''}
              onChange={(e) => handleFieldChange('itemName', e.target.value)}
              disabled={!proposedFields['itemName'] || disabled}
              placeholder="Enter item name"
            />
          </div>
        </div>

        {/* UOM */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>UOM</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.uom || '-'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['uom'] || false}
              onCheckedChange={(checked) => handleToggleField('uom', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Select
              value={fieldValues['uom'] || fields.uom || ''}
              onValueChange={(value) => handleFieldChange('uom', value)}
              disabled={!proposedFields['uom'] || disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select UOM" />
              </SelectTrigger>
              <SelectContent>
                {uomOptions.map(uom => (
                  <SelectItem key={uom} value={uom}>{uom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Minimum */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Minimum</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.min !== undefined ? fields.min : 'N/A'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['min'] || false}
              onCheckedChange={(checked) => handleToggleField('min', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Input
              type="number"
              min="0"
              value={fieldValues['min'] ?? fields.min ?? ''}
              onChange={(e) => handleFieldChange('min', e.target.value ? parseInt(e.target.value) : null)}
              disabled={!proposedFields['min'] || disabled}
              placeholder="Enter minimum (blank for N/A)"
            />
          </div>
        </div>

        {/* Location */}
        <div className="grid grid-cols-12 gap-4 items-center py-2 border-b">
          <div className="col-span-3">
            <Label>Location</Label>
          </div>
          <div className="col-span-4">
            <p className="text-sm">{fields.location || '-'}</p>
          </div>
          <div className="col-span-1">
            <Switch
              checked={proposedFields['location'] || false}
              onCheckedChange={(checked) => handleToggleField('location', checked)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-4">
            <Input
              value={fieldValues['location'] || fields.location || ''}
              onChange={(e) => handleFieldChange('location', e.target.value)}
              disabled={!proposedFields['location'] || disabled}
              placeholder="Enter location"
            />
          </div>
        </div>

        {/* Impact Preview */}
        {proposedFields['min'] && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Impact Preview:</strong> Stock badge would become{' '}
              {getStockStatus(fields.rob, fieldValues['min'] ?? fields.min)}{' '}
              based on current ROB of {fields.rob || 0}.
            </p>
          </div>
        )}
      </>
    );
  };

  const getStockStatus = (rob: number, min: number | null) => {
    if (min === null || min === undefined) return "N/A";
    if (rob <= 0) return "Low";
    if (rob < min) return "Low";
    if (rob === min) return "Minimum";
    return "OK";
  };

  const renderFields = () => {
    switch (targetType) {
      case 'work_order':
        return renderWorkOrderFields();
      case 'component':
        return renderComponentFields();
      case 'spare':
        return renderSpareFields();
      case 'store':
        return renderStoreFields();
      default:
        return null;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Propose Changes</CardTitle>
          <CardDescription>
            Toggle fields you want to change and enter new values
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderFields()}
          
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={handleClearProposed}
              disabled={disabled || Object.keys(proposedFields).length === 0}
            >
              Clear Proposed
            </Button>
            <Button
              onClick={handleReviewChanges}
              disabled={disabled || Object.keys(proposedFields).filter(k => proposedFields[k]).length === 0}
            >
              Review Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Review Changes Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Proposed Changes</DialogTitle>
            <DialogDescription>
              Review your proposed changes before saving or submitting
            </DialogDescription>
          </DialogHeader>

          {pendingChanges.length > 0 && (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Proposed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingChanges.map((change, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{change.label}</TableCell>
                      <TableCell>{String(change.before || '-')}</TableCell>
                      <TableCell className="text-blue-600 font-medium">
                        {String(change.after || '-')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {movePreview && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Component Move (Preview)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-gray-500">From</Label>
                          <p className="text-sm font-mono">{movePreview.oldPath}</p>
                          <p className="text-xs text-gray-500 mt-1">Code: {movePreview.oldCode}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">To</Label>
                          <p className="text-sm font-mono">{movePreview.newPath}</p>
                          <p className="text-xs text-gray-500 mt-1">New Code: {movePreview.newCodePreview}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {targetType === 'work_order' && pendingChanges.some(c => c.path.includes('frequency')) && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> If approved, next due date will be recalculated per new frequency.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSaveProposed(pendingChanges, movePreview);
                setShowReviewDialog(false);
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Component Tree Selector */}
      {targetType === 'component' && (
        <ComponentTreeSelector
          open={showTreeSelector}
          onOpenChange={setShowTreeSelector}
          onSelect={handleNewParentSelect}
          vesselId={snapshotData.vesselId || 'MV Test Vessel'}
        />
      )}
    </>
  );
}