import React, { useState } from 'react';
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
import { ArrowLeft, Plus, Upload, Eye, Trash2, Edit3, X, ChevronRight, ChevronDown, Search, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { getComponentCategory } from "@/utils/componentUtils";
import { FEATURES } from '@/config/features';
import { ScrollArea } from "@/components/ui/scroll-area";

interface FormConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  formName: string;
  formSubGroup?: string;
  currentVersion?: string;
  versionDate?: string;
}

const FormConfigurationModal: React.FC<FormConfigurationModalProps> = ({
  isOpen,
  onClose,
  formName
}) => {
  const { toast } = useToast();
  
  // Form state matching ComponentRegisterForm exactly
  const [formData, setFormData] = useState({
    componentCode: "",
    componentName: "",
    department: "",
    location: "",
    model: "",
    maker: "",
    type: "",
    noOfUnits: "",
    runningHours: "",
    runningHoursMeasuredOn: "",
    condition: "Good",
    criticalEquipment: "No",
    manufacturer: "",
    serialNumber: "",
    capacity: "",
    yearOfMake: "",
    yearOfInstallation: "",
    ihmStatus: "Unknown",
    ihmMaterials: [],
    ihmDocumentation: [],
    ihmMaintenanceDate: "",
    ihmRemarks: ""
  });

  const [selectedParent, setSelectedParent] = useState<{ code: string; name: string } | null>(null);
  const [showParentSelector, setShowParentSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Component tree data
  const componentTree = [
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
            { id: "1.1.1", code: "1.1.1", name: "Hydrophore Unit" },
            { id: "1.1.2", code: "1.1.2", name: "Potable Water Maker" }
          ]
        }
      ]
    },
    {
      id: "2",
      code: "2", 
      name: "Hull",
      children: [
        { id: "2.1", code: "2.1", name: "Ballast Tanks" },
        { id: "2.2", code: "2.2", name: "Cathodic Protection" }
      ]
    }
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleNodeExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderComponentTree = (nodes: any[], level = 0) => {
    return nodes.map(node => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(node.id);
      
      return (
        <div key={node.id}>
          <div 
            className={`flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer ${
              selectedParent?.code === node.code ? 'bg-blue-50 border-l-2 border-blue-500' : ''
            }`}
            style={{ paddingLeft: `${level * 20 + 8}px` }}
            onClick={() => {
              setSelectedParent({ code: node.code, name: node.name });
              setShowParentSelector(false);
            }}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNodeExpansion(node.id);
                }}
                className="p-0.5"
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
            {!hasChildren && <span className="w-4" />}
            <span className="text-sm">{node.code} - {node.name}</span>
          </div>
          {hasChildren && isExpanded && (
            <div>{renderComponentTree(node.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  const handleSave = () => {
    toast({
      title: "Form Configuration Saved",
      description: "The form configuration has been saved successfully."
    });
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[800px] max-h-[90vh] p-0 overflow-hidden">
          <div className="bg-white">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b">
              <div className="flex items-center gap-4">
                <button onClick={onClose}>
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-semibold">Component Register - Add Component</h2>
                <span className="text-sm text-gray-500">Configuration Mode</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-green-600 border-green-600">
                  Preview Mode
                </Button>
                <Button variant="outline" size="sm" className="text-blue-600 border-blue-600">
                  Edit Config
                </Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleSave}>
                  Save
                </Button>
              </div>
            </div>

            {/* Version and Status Bar */}
            <div className="flex items-center gap-4 px-6 py-2 border-b text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Version No:</span>
                <span>01</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Version Date:</span>
                <Input type="date" className="h-7 w-32" defaultValue="2024-01-15" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Select Date:</span>
                <Input type="date" className="h-7 w-32" />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-gray-600">Status:</span>
                <span className="text-green-600 font-medium">Draft</span>
              </div>
            </div>

            <ScrollArea className="h-[calc(90vh-140px)]">
              <div className="p-6 space-y-6">
                {/* Component Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">▶</span>
                    <h3 className="font-semibold">Component Information</h3>
                    <Button variant="ghost" size="sm" className="ml-auto text-gray-500">
                      + Add Field
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pl-6">
                    <div>
                      <Label className="text-sm">Component Code</Label>
                      <div className="flex gap-1">
                        <Input
                          value={formData.componentCode}
                          onChange={(e) => handleInputChange('componentCode', e.target.value)}
                          placeholder="Type / System / Category"
                        />
                        <Button size="icon" variant="ghost" className="h-9 w-9">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">Department Type</Label>
                      <Select value={formData.department} onValueChange={(value) => handleInputChange('department', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deck">Deck</SelectItem>
                          <SelectItem value="engine">Engine</SelectItem>
                          <SelectItem value="electrical">Electrical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm">Running Hrs</Label>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          value={formData.runningHours}
                          onChange={(e) => handleInputChange('runningHours', e.target.value)}
                        />
                        <Button size="icon" variant="ghost" className="h-9 w-9">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">Component Name</Label>
                      <Input
                        value={formData.componentName}
                        onChange={(e) => handleInputChange('componentName', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label className="text-sm">Commissioned Date</Label>
                      <Input
                        type="date"
                        onChange={(e) => handleInputChange('commissionedDate', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label className="text-sm">Condition Rating</Label>
                      <Select value={formData.condition} onValueChange={(value) => handleInputChange('condition', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Good">Good</SelectItem>
                          <SelectItem value="Fair">Fair</SelectItem>
                          <SelectItem value="Poor">Poor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm">Department Type</Label>
                      <Input
                        value={formData.type}
                        onChange={(e) => handleInputChange('type', e.target.value)}
                        placeholder="Type / System / Category"
                      />
                    </div>

                    <div>
                      <Label className="text-sm">Serial</Label>
                      <Input
                        value={formData.serialNumber}
                        onChange={(e) => handleInputChange('serialNumber', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label className="text-sm">Equipment Group</Label>
                      <div className="flex gap-1">
                        <Input placeholder="Equipment Group" />
                        <Button size="icon" variant="ghost" className="h-9 w-9">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">No of Units</Label>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          value={formData.noOfUnits}
                          onChange={(e) => handleInputChange('noOfUnits', e.target.value)}
                        />
                        <Button size="icon" variant="ghost" className="h-9 w-9">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Blue toggle fields */}
                    <div className="flex items-center gap-8">
                      <div className="flex items-center gap-2">
                        <Switch 
                          id="class-item" 
                          className="data-[state=checked]:bg-blue-600"
                        />
                        <Label htmlFor="class-item" className="text-sm text-blue-600">Class Item</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          id="critical" 
                          className="data-[state=checked]:bg-blue-600"
                        />
                        <Label htmlFor="critical" className="text-sm text-blue-600">Critical</Label>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="flex items-center gap-2">
                        <Switch 
                          id="ihm-item" 
                          className="data-[state=checked]:bg-blue-600"
                        />
                        <Label htmlFor="ihm-item" className="text-sm text-blue-600">IHM Item</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          id="safety-critical" 
                          className="data-[state=checked]:bg-blue-600"
                        />
                        <Label htmlFor="safety-critical" className="text-sm text-blue-600">Safety Critical</Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Running Hours & Condition Monitoring Metrics Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">▼</span>
                    <h3 className="font-semibold">Running Hours & Condition Monitoring Metrics</h3>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pl-6">
                    <div>
                      <Label className="text-sm">Running Group</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="main">Main</SelectItem>
                          <SelectItem value="aux">Auxiliary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm">Type</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="engine">Engine</SelectItem>
                          <SelectItem value="pump">Pump</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm">RH since date</Label>
                      <Input type="date" />
                    </div>
                  </div>

                  <div className="pl-6">
                    <Label className="text-sm">Condition Monitoring Metrics</Label>
                    <Textarea 
                      className="mt-1"
                      placeholder="Enter condition monitoring metrics"
                      rows={2}
                    />
                  </div>

                  <div className="pl-6">
                    <Label className="text-sm">Matrix</Label>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-1" />
                          Add New Section
                        </Button>
                        <Button variant="ghost" size="sm">
                          Picture / Thumbnail
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Work Orders Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">▼</span>
                    <h3 className="font-semibold">Work Orders</h3>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pl-6">
                    <div>
                      <Label className="text-sm">Bill No.</Label>
                      <Input placeholder="Enter bill number" />
                    </div>

                    <div>
                      <Label className="text-sm">Job Title</Label>
                      <Input placeholder="Enter job title" />
                    </div>

                    <div className="flex items-center gap-8">
                      <Label className="text-sm">Assigned to:</Label>
                      <div className="flex gap-2">
                        <Label className="text-sm">Duty Basis</Label>
                        <Label className="text-sm">Online</Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Maintenance History Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">▼</span>
                    <h3 className="font-semibold">Maintenance History</h3>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pl-6">
                    <div>
                      <Label className="text-sm">Work Order No</Label>
                      <Input placeholder="Enter work order number" />
                    </div>

                    <div>
                      <Label className="text-sm">Performed By</Label>
                      <Input placeholder="Enter name" />
                    </div>

                    <div>
                      <Label className="text-sm">Total Crew Hrs</Label>
                      <Input type="number" placeholder="Hours" />
                    </div>

                    <div>
                      <Label className="text-sm">Completion Date</Label>
                      <Input type="date" />
                    </div>

                    <div>
                      <Label className="text-sm">Status</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Spares Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">▼</span>
                    <h3 className="font-semibold">Spares</h3>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pl-6">
                    <div>
                      <Label className="text-sm">Part Code</Label>
                      <Input placeholder="Enter part code" />
                    </div>

                    <div>
                      <Label className="text-sm">Part Name</Label>
                      <Input placeholder="Enter part name" />
                    </div>

                    <div>
                      <Label className="text-sm">Min</Label>
                      <Input type="number" placeholder="Minimum quantity" />
                    </div>

                    <div>
                      <Label className="text-sm">Current</Label>
                      <Input type="number" placeholder="Current quantity" />
                    </div>

                    <div>
                      <Label className="text-sm">Location</Label>
                      <Input placeholder="Storage location" />
                    </div>
                  </div>
                </div>

                {/* Drawings & Manuals Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">▼</span>
                    <h3 className="font-semibold">Drawings & Manuals</h3>
                    <Button variant="ghost" size="sm" className="ml-auto text-gray-500">
                      + Add Field
                    </Button>
                  </div>
                </div>

                {/* Classification & Regulatory Data Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">▶</span>
                    <h3 className="font-semibold">Classification & Regulatory Data</h3>
                    <Button variant="ghost" size="sm" className="ml-auto text-gray-500">
                      + Add Field
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pl-6">
                    <div>
                      <Label className="text-sm">Classification Society</Label>
                      <Input placeholder="Enter classification society" />
                    </div>

                    <div>
                      <Label className="text-sm">Approval No.</Label>
                      <Input placeholder="Enter approval number" />
                    </div>

                    <div>
                      <Label className="text-sm">Last Survey Date</Label>
                      <Input type="date" />
                    </div>

                    <div>
                      <Label className="text-sm">Survey Type</Label>
                      <Input placeholder="Enter survey type" />
                    </div>

                    <div>
                      <Label className="text-sm">Class Requirement</Label>
                      <Input placeholder="Enter class requirement" />
                    </div>

                    <div>
                      <Label className="text-sm">Certificate</Label>
                      <Input placeholder="Certificate number" />
                    </div>

                    <div className="col-span-3 flex items-center gap-8">
                      <div className="flex items-center gap-2">
                        <Switch 
                          id="ihm-hull" 
                          className="data-[state=checked]:bg-blue-600"
                        />
                        <Label htmlFor="ihm-hull" className="text-sm text-blue-600">IHM (Hull)</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          id="ihm-hull-2" 
                          className="data-[state=checked]:bg-blue-600"
                        />
                        <Label htmlFor="ihm-hull-2" className="text-sm text-blue-600">IHM (Hull)</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          id="ihm-hull-3" 
                          className="data-[state=checked]:bg-blue-600"
                        />
                        <Label htmlFor="ihm-hull-3" className="text-sm text-blue-600">IHM (Hull)</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          id="ihm-hull-4" 
                          className="data-[state=checked]:bg-blue-600"
                        />
                        <Label htmlFor="ihm-hull-4" className="text-sm text-blue-600">IHM (Hull)</Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Next Section Fields */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">▼</span>
                    <h3 className="font-semibold">Next Section Fields</h3>
                    <Button variant="ghost" size="sm" className="ml-auto text-gray-500">
                      + Add Field
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pl-6">
                    <div>
                      <Label className="text-sm">Field 1</Label>
                      <div className="flex gap-1">
                        <Input />
                        <Button size="icon" variant="ghost" className="h-9 w-9">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">Field 2</Label>
                      <div className="flex gap-1">
                        <Input />
                        <Button size="icon" variant="ghost" className="h-9 w-9">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">Field 3</Label>
                      <div className="flex gap-1">
                        <Input />
                        <Button size="icon" variant="ghost" className="h-9 w-9">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="col-span-3 flex items-center gap-8">
                      <div className="flex items-center gap-2">
                        <Switch 
                          id="field-4" 
                          className="data-[state=checked]:bg-blue-600"
                        />
                        <Label htmlFor="field-4" className="text-sm text-blue-600">Field 4</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          id="field-5" 
                          className="data-[state=checked]:bg-blue-600"
                        />
                        <Label htmlFor="field-5" className="text-sm text-blue-600">Field 5</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          id="field-6" 
                          className="data-[state=checked]:bg-blue-600"
                        />
                        <Label htmlFor="field-6" className="text-sm text-blue-600">Field 6</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          id="field-7" 
                          className="data-[state=checked]:bg-blue-600"
                        />
                        <Label htmlFor="field-7" className="text-sm text-blue-600">Field 7</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Parent Component Selector Dialog */}
      <Dialog open={showParentSelector} onOpenChange={setShowParentSelector}>
        <DialogContent className="max-w-2xl max-h-[70vh]">
          <DialogHeader>
            <DialogTitle>Select Parent Component</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search components..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <ScrollArea className="h-[400px] border rounded-lg p-4">
              {renderComponentTree(componentTree)}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FormConfigurationModal;