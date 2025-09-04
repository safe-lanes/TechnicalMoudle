import React, { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Save, 
  X, 
  Plus, 
  Edit3, 
  Trash2, 
  ChevronRight,
  ChevronDown,
  Search,
  History,
  FileText,
  Settings,
  Upload,
  Eye,
  AlertCircle
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { getComponentCategory } from "@/utils/componentUtils";
import { FEATURES } from '@/config/features';
import IhmManagementModal from '@/components/modals/IhmManagementModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FormField {
  id: string;
  name: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
  order: number;
  section: string;
}

interface FormVersion {
  versionNo: string;
  versionDate: string;
  changedBy: string;
  changes: string[];
  status: 'draft' | 'published' | 'archived';
}

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
  formName,
  formSubGroup,
  currentVersion = "01",
  versionDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("configuration");
  const [hasChanges, setHasChanges] = useState(false);
  
  // Version control state
  const [newVersion, setNewVersion] = useState(currentVersion);
  const [changeDescription, setChangeDescription] = useState("");
  const [versionHistory, setVersionHistory] = useState<FormVersion[]>([
    {
      versionNo: "01",
      versionDate: "15 Jan 2025",
      changedBy: "Admin User",
      changes: ["Initial form creation"],
      status: 'published'
    }
  ]);

  // Form configuration state (from ComponentRegisterForm)
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
    isMarkedCritical: false,
    manufacturer: "",
    serialNumber: "",
    capacity: "",
    yearOfMake: "",
    yearOfInstallation: "",
    // IHM fields
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
  const [showIhmModal, setShowIhmModal] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Component tree data (same as ComponentRegisterForm)
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
    setHasChanges(true);
  };

  const handleSaveVersion = () => {
    if (!changeDescription.trim()) {
      toast({
        title: "Version Description Required",
        description: "Please provide a description of changes for this version",
        variant: "destructive"
      });
      return;
    }

    const nextVersionNo = String(parseInt(currentVersion) + 1).padStart(2, '0');
    const newVersionEntry: FormVersion = {
      versionNo: nextVersionNo,
      versionDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      changedBy: "Admin User",
      changes: changeDescription.split('\n').filter(c => c.trim()),
      status: 'draft'
    };

    setVersionHistory([...versionHistory, newVersionEntry]);
    setNewVersion(nextVersionNo);
    setChangeDescription("");
    setHasChanges(false);

    toast({
      title: "Version Saved",
      description: `Form version ${nextVersionNo} has been saved as draft`,
    });
  };

  const handlePublishVersion = (versionNo: string) => {
    setVersionHistory(prev => prev.map(v => 
      v.versionNo === versionNo ? { ...v, status: 'published' } : v
    ));
    
    toast({
      title: "Version Published",
      description: `Form version ${versionNo} has been published`,
    });
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

  const renderFormConfiguration = () => (
    <div className="space-y-6">
      {/* Version Info Header */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg">{formName}</h3>
            {formSubGroup && <p className="text-sm text-gray-600">{formSubGroup}</p>}
          </div>
          <div className="text-right">
            <Badge variant="outline" className="mb-2">Version {newVersion}</Badge>
            <p className="text-sm text-gray-600">{versionDate}</p>
          </div>
        </div>
      </div>

      {/* Component Information Section */}
      <div className="space-y-4">
        <h4 className="font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Component Information
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Parent Component</Label>
            <div className="relative">
              <Input
                value={selectedParent ? `${selectedParent.code} - ${selectedParent.name}` : ''}
                placeholder="Select parent component"
                readOnly
                onClick={() => setShowParentSelector(true)}
                className="cursor-pointer"
              />
              <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
            </div>
          </div>

          <div>
            <Label>Component Code *</Label>
            <Input
              value={formData.componentCode}
              onChange={(e) => handleInputChange('componentCode', e.target.value)}
              placeholder="e.g., 1.1.1.1"
            />
          </div>

          <div>
            <Label>Component Name *</Label>
            <Input
              value={formData.componentName}
              onChange={(e) => handleInputChange('componentName', e.target.value)}
              placeholder="Enter component name"
            />
          </div>

          <div>
            <Label>Department</Label>
            <Select value={formData.department} onValueChange={(value) => handleInputChange('department', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deck">Deck</SelectItem>
                <SelectItem value="engine">Engine</SelectItem>
                <SelectItem value="electrical">Electrical</SelectItem>
                <SelectItem value="catering">Catering</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Location</Label>
            <Input
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="Enter location"
            />
          </div>

          <div>
            <Label>Model</Label>
            <Input
              value={formData.model}
              onChange={(e) => handleInputChange('model', e.target.value)}
              placeholder="Enter model"
            />
          </div>

          <div>
            <Label>Maker</Label>
            <Input
              value={formData.maker}
              onChange={(e) => handleInputChange('maker', e.target.value)}
              placeholder="Enter maker"
            />
          </div>

          <div>
            <Label>Type</Label>
            <Input
              value={formData.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
              placeholder="Enter type"
            />
          </div>

          <div>
            <Label>No of Units</Label>
            <Input
              type="number"
              value={formData.noOfUnits}
              onChange={(e) => handleInputChange('noOfUnits', e.target.value)}
              placeholder="Enter number of units"
            />
          </div>

          {/* Component Category (auto-calculated) */}
          <div>
            <Label>Component Category</Label>
            <Input
              value={getComponentCategory(formData.componentCode)}
              readOnly
              className="bg-gray-50"
            />
          </div>
        </div>

        {/* IHM Controls (if feature enabled) */}
        {FEATURES.IHM && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Label className="text-[#52baf3] font-medium">IHM Status</Label>
                <RadioGroup
                  value={formData.ihmStatus}
                  onValueChange={(value) => handleInputChange('ihmStatus', value)}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="Unknown" id="ihm-unknown" />
                    <Label htmlFor="ihm-unknown" className="font-normal">Unknown</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="Present" id="ihm-present" />
                    <Label htmlFor="ihm-present" className="font-normal">Present</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="Not Present" id="ihm-not-present" />
                    <Label htmlFor="ihm-not-present" className="font-normal">Not Present</Label>
                  </div>
                </RadioGroup>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowIhmModal(true)}
                className="text-[#52baf3] border-[#52baf3] hover:bg-[#52baf3]/10"
              >
                <Settings className="h-4 w-4 mr-2" />
                IHM Details
              </Button>
            </div>
          </div>
        )}

        {/* Running Hours & Condition Section */}
        <div className="space-y-4 border-t pt-4">
          <h4 className="font-semibold">Running Hours & Condition Monitoring Metrics</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Running Hours</Label>
              <Input
                type="number"
                value={formData.runningHours}
                onChange={(e) => handleInputChange('runningHours', e.target.value)}
                placeholder="Enter running hours"
              />
            </div>

            <div>
              <Label>Running Hours Measured On</Label>
              <Input
                type="date"
                value={formData.runningHoursMeasuredOn}
                onChange={(e) => handleInputChange('runningHoursMeasuredOn', e.target.value)}
              />
            </div>

            <div>
              <Label>Condition</Label>
              <Select value={formData.condition} onValueChange={(value) => handleInputChange('condition', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Good">Good</SelectItem>
                  <SelectItem value="Fair">Fair</SelectItem>
                  <SelectItem value="Poor">Poor</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Critical Equipment</Label>
              <RadioGroup
                value={formData.criticalEquipment}
                onValueChange={(value) => handleInputChange('criticalEquipment', value)}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Yes" id="critical-yes" />
                  <Label htmlFor="critical-yes">Yes</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="No" id="critical-no" />
                  <Label htmlFor="critical-no">No</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="space-y-4 border-t pt-4">
          <h4 className="font-semibold">Additional Information</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Manufacturer</Label>
              <Input
                value={formData.manufacturer}
                onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                placeholder="Enter manufacturer"
              />
            </div>

            <div>
              <Label>Serial Number</Label>
              <Input
                value={formData.serialNumber}
                onChange={(e) => handleInputChange('serialNumber', e.target.value)}
                placeholder="Enter serial number"
              />
            </div>

            <div>
              <Label>Capacity</Label>
              <Input
                value={formData.capacity}
                onChange={(e) => handleInputChange('capacity', e.target.value)}
                placeholder="Enter capacity"
              />
            </div>

            <div>
              <Label>Year of Make</Label>
              <Input
                type="number"
                value={formData.yearOfMake}
                onChange={(e) => handleInputChange('yearOfMake', e.target.value)}
                placeholder="YYYY"
              />
            </div>

            <div>
              <Label>Year of Installation</Label>
              <Input
                type="number"
                value={formData.yearOfInstallation}
                onChange={(e) => handleInputChange('yearOfInstallation', e.target.value)}
                placeholder="YYYY"
              />
            </div>
          </div>
        </div>

        {/* Attachments Section */}
        <div className="space-y-4 border-t pt-4">
          <h4 className="font-semibold">Attachments</h4>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600">Drag and drop files here or click to browse</p>
              <Input
                type="file"
                multiple
                className="hidden"
                id="file-upload"
                onChange={(e) => {
                  if (e.target.files) {
                    setUploadedFiles(Array.from(e.target.files));
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                Select Files
              </Button>
            </div>
            
            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm">{file.name}</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setUploadedFiles(files => files.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderVersionHistory = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Version History</h3>
        <Badge variant="outline">Total Versions: {versionHistory.length}</Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Changed By</TableHead>
            <TableHead>Changes</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versionHistory.map((version) => (
            <TableRow key={version.versionNo}>
              <TableCell className="font-medium">{version.versionNo}</TableCell>
              <TableCell>{version.versionDate}</TableCell>
              <TableCell>{version.changedBy}</TableCell>
              <TableCell>
                <ul className="text-sm">
                  {version.changes.map((change, idx) => (
                    <li key={idx}>• {change}</li>
                  ))}
                </ul>
              </TableCell>
              <TableCell>
                <Badge 
                  variant={version.status === 'published' ? 'default' : version.status === 'draft' ? 'secondary' : 'outline'}
                  className={version.status === 'published' ? 'bg-green-100 text-green-800' : ''}
                >
                  {version.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {version.status === 'draft' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePublishVersion(version.versionNo)}
                    >
                      Publish
                    </Button>
                  )}
                  <Button size="sm" variant="ghost">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* New Version Section */}
      {hasChanges && (
        <Card className="p-4 bg-blue-50">
          <h4 className="font-semibold mb-3">Create New Version</h4>
          <div className="space-y-3">
            <div>
              <Label>Version Number</Label>
              <Input value={String(parseInt(currentVersion) + 1).padStart(2, '0')} disabled />
            </div>
            <div>
              <Label>Change Description *</Label>
              <Textarea
                value={changeDescription}
                onChange={(e) => setChangeDescription(e.target.value)}
                placeholder="Describe what changes were made in this version..."
                rows={3}
              />
            </div>
            <Button onClick={handleSaveVersion} className="bg-[#52baf3] hover:bg-[#3da5e0]">
              <Save className="h-4 w-4 mr-2" />
              Save as New Version
            </Button>
          </div>
        </Card>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-semibold">
                Form Configuration - {formName}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {hasChanges && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Unsaved Changes
                  </Badge>
                )}
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
              <TabsList className="grid w-full grid-cols-3 px-6">
                <TabsTrigger value="configuration" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configuration
                </TabsTrigger>
                <TabsTrigger value="version-history" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Version History
                </TabsTrigger>
                <TabsTrigger value="preview" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[calc(90vh-200px)]">
                <div className="px-6 py-4">
                  <TabsContent value="configuration">
                    {renderFormConfiguration()}
                  </TabsContent>

                  <TabsContent value="version-history">
                    {renderVersionHistory()}
                  </TabsContent>

                  <TabsContent value="preview">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Form Preview</h3>
                      <Card className="p-6">
                        <p className="text-center text-gray-500">
                          Form preview will be displayed here showing how it appears to users
                        </p>
                      </Card>
                    </div>
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>

          <div className="px-6 py-4 border-t flex justify-between">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex gap-2">
              {hasChanges && (
                <Button 
                  variant="outline"
                  onClick={() => {
                    setFormData({
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
                      isMarkedCritical: false,
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
                    setHasChanges(false);
                  }}
                >
                  Reset Changes
                </Button>
              )}
              <Button className="bg-[#52baf3] hover:bg-[#3da5e0]">
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </Button>
            </div>
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

      {/* IHM Management Modal - To be integrated later */}
      {/* {FEATURES.IHM && showIhmModal && (
        <IhmManagementModal
          isOpen={showIhmModal}
          onClose={() => setShowIhmModal(false)}
          type="component"
          componentId={formData.componentCode}
        />
      )} */}
    </>
  );
};

export default FormConfigurationModal;