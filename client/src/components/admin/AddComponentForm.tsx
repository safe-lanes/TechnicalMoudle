import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FEATURES } from '@/config/features';

// IHM constants
const IHM_PRESENCE = ["Unknown", "Present", "Not Present"] as const;
const IHM_EVIDENCE_TYPES = ["None", "MD", "SDoC", "Test"] as const;

interface AddComponentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddComponentForm({ open, onOpenChange }: AddComponentFormProps) {
  const [formData, setFormData] = useState({
    // Component Name
    componentName: '',
    // Component Information
    origin: '',
    supplier: '',
    partNo: '',
    createdOn: '',
    component: '',
    maker: '',
    serialNo: '',
    installedDate: '',
    componentCode: '',
    type: '',
    blackoutComponent: '',
    modelSpecification: '',
    warrantyInfo: '',
    warrantyDays: '',
    warrantyDate: '',
    lastUsed: '',
    supplier2: '',
    
    // Running Hours
    runningHours: '',
    conditionMonitoring: '',
    
    // Work Orders
    workBy: '',
    jobTitle: '',
    dueDate: '',
    status: '',
    
    // Maintenance History
    serialNo2: '',
    performedBy: '',
    nextDue: '',
    completionDate: '',
    
    // Spares
    sparePart: '',
    partName: '',
    qty: '',
    critical: '',
    location: '',
    
    // Classification & Regulatory Data
    classificationSociety: '',
    certificateNo: '',
    lastClassDate: '',
    nextClassDate: '',
    classCode: '',
    classRemarks: '',
    
    // New Service Notes
    serviceNote: '',
    noteDate: '',
    nextNote: '',
    noteLevel: '',
    
    // IHM fields
    ihmPresence: 'Unknown' as typeof IHM_PRESENCE[number],
    ihmEvidenceType: 'None' as typeof IHM_EVIDENCE_TYPES[number]
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    console.log('Saving component:', formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden p-0">
        <DialogTitle className="sr-only">Add Component Form</DialogTitle>
        <DialogDescription className="sr-only">Add Component Form Configuration</DialogDescription>
        
        {/* Header */}
        <div className="bg-white border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold">Component Register - Add Component</h2>
              <Badge variant="secondary" className="bg-gray-100">Configuration Mode</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="outline" 
                size="sm"
              >
                Clear Form
              </Button>
              <Button 
                size="sm"
                className="bg-[#52baf3] hover:bg-[#3da8e0] text-white"
                onClick={handleSave}
              >
                Save Form
              </Button>
            </div>
          </div>
        </div>

        {/* Main Navigation Tabs */}
        <div className="bg-gray-50 border-b px-4">
          <div className="flex gap-1">
            <button className="px-4 py-2 text-sm font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-900">
              Version No
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-900">
              Version Date
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-900">
              Select Date
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-900 border-b-2 border-blue-500">
              Status: Draft
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(95vh - 120px)' }}>
          <div className="space-y-6 max-w-6xl mx-auto">
            
            {/* Component Name Section */}
            <div className="bg-white rounded-lg border p-4">
              <div className="mb-4">
                <Label htmlFor="component-name" className="text-sm font-semibold">Component Name</Label>
                <Input
                  id="component-name"
                  value={formData.componentName}
                  onChange={(e) => handleInputChange('componentName', e.target.value)}
                  className="mt-1"
                  placeholder="Component Information"
                />
              </div>
            </div>

            {/* A. Component Information */}
            <div className="bg-white rounded-lg border">
              <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="bg-[#52baf3] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">A</span>
                  Component Information
                </h3>
                <Button variant="link" size="sm" className="text-blue-600">
                  + Add Field
                </Button>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="origin" className="text-xs">Origin</Label>
                    <Input id="origin" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="supplier" className="text-xs">Supplier</Label>
                    <Input id="supplier" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="part-no" className="text-xs">Part No</Label>
                    <Input id="part-no" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="created-on" className="text-xs">Created On</Label>
                    <Input id="created-on" type="date" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="component" className="text-xs">Component *</Label>
                    <Input id="component" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="maker" className="text-xs">Maker / Maker Designator</Label>
                    <Input id="maker" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="serial-no" className="text-xs">Serial No</Label>
                    <Input id="serial-no" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="installed-date" className="text-xs">Installed Date</Label>
                    <Input id="installed-date" type="date" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="component-code" className="text-xs">Component Code</Label>
                    <Input id="component-code" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="type" className="text-xs">Type</Label>
                    <Input id="type" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="blackout" className="text-xs">Blackout Component</Label>
                    <Input id="blackout" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="model-spec" className="text-xs">Model Specification</Label>
                    <Input id="model-spec" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="warranty-info" className="text-xs">Warranty Info</Label>
                    <Input id="warranty-info" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="warranty-days" className="text-xs">Warranty Days</Label>
                    <Input id="warranty-days" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="warranty-date" className="text-xs">Warranty Date</Label>
                    <Input id="warranty-date" type="date" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="last-used" className="text-xs">Last Used</Label>
                    <Input id="last-used" className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* IHM Information (if feature enabled) */}
            {FEATURES.IHM && (
              <div className="bg-white rounded-lg border">
                <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <span className="bg-[#52baf3] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">IHM</span>
                    Inventory of Hazardous Materials
                  </h3>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="ihm-presence" className="text-xs">IHM Presence</Label>
                      <Select 
                        value={formData.ihmPresence} 
                        onValueChange={(value) => handleInputChange('ihmPresence', value)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select IHM presence" />
                        </SelectTrigger>
                        <SelectContent>
                          {IHM_PRESENCE.map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="ihm-evidence" className="text-xs">IHM Evidence Type</Label>
                      <Select 
                        value={formData.ihmEvidenceType} 
                        onValueChange={(value) => handleInputChange('ihmEvidenceType', value)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select evidence type" />
                        </SelectTrigger>
                        <SelectContent>
                          {IHM_EVIDENCE_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="ihm-notes" className="text-xs">IHM Notes</Label>
                      <Input 
                        id="ihm-notes" 
                        className="h-8 text-sm" 
                        placeholder="Additional IHM information"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* B. Running Hours & Condition Monitoring Metrics */}
            <div className="bg-white rounded-lg border">
              <div className="bg-gray-50 px-4 py-3 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="bg-[#52baf3] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">B</span>
                  Running Hours & Condition Monitoring Metrics
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="running-hours" className="text-xs">Running Hours</Label>
                    <Input id="running-hours" className="h-8 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="condition-metrics" className="text-xs">Condition Monitoring Metrics</Label>
                    <div className="flex gap-2 mt-1">
                      <Button variant="outline" size="sm" className="text-xs">
                        Add Metric Units
                      </Button>
                      <span className="text-sm text-gray-500">No Condition Monitoring Metrics</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* C. Work Orders */}
            <div className="bg-white rounded-lg border">
              <div className="bg-gray-50 px-4 py-3 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="bg-[#52baf3] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">C</span>
                  Work Orders
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-5 gap-4">
                  <div>
                    <Label htmlFor="work-by" className="text-xs">Work By</Label>
                    <Input id="work-by" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="job-title" className="text-xs">Job Title</Label>
                    <Input id="job-title" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="assigned-to" className="text-xs">Assigned To</Label>
                    <Input id="assigned-to" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="due-date" className="text-xs">Due Date</Label>
                    <Input id="due-date" type="date" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="status" className="text-xs">Status</Label>
                    <Input id="status" className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* D. Maintenance History */}
            <div className="bg-white rounded-lg border">
              <div className="bg-gray-50 px-4 py-3 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="bg-[#52baf3] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">D</span>
                  Maintenance History
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="work-order-no" className="text-xs">Work Order No</Label>
                    <Input id="work-order-no" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="performed-by" className="text-xs">Performed By</Label>
                    <Input id="performed-by" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="next-due-date" className="text-xs">Next Due Date</Label>
                    <Input id="next-due-date" type="date" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="completion-date" className="text-xs">Completion Date</Label>
                    <Input id="completion-date" type="date" className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* E. Spares */}
            <div className="bg-white rounded-lg border">
              <div className="bg-gray-50 px-4 py-3 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="bg-[#52baf3] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">E</span>
                  Spares
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-5 gap-4">
                  <div>
                    <Label htmlFor="spare-part" className="text-xs">Spare Part</Label>
                    <Input id="spare-part" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="part-name" className="text-xs">Part Name</Label>
                    <Input id="part-name" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="qty" className="text-xs">Qty</Label>
                    <Input id="qty" type="number" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="critical" className="text-xs">Critical</Label>
                    <Input id="critical" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="location" className="text-xs">Location</Label>
                    <Input id="location" className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* F. Drawings & Manuals */}
            <div className="bg-white rounded-lg border">
              <div className="bg-gray-50 px-4 py-3 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="bg-[#52baf3] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">F</span>
                  Drawings & Manuals
                </h3>
              </div>
              <div className="p-8 text-center text-gray-500">
                <p className="text-sm">No drawings or manuals uploaded</p>
              </div>
            </div>

            {/* G. Classification & Regulatory Data */}
            <div className="bg-white rounded-lg border">
              <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="bg-[#52baf3] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">G</span>
                  Classification & Regulatory Data
                </h3>
                <Button variant="link" size="sm" className="text-blue-600">
                  + Add Field
                </Button>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="classification-society" className="text-xs">Classification Society</Label>
                    <Input id="classification-society" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="certificate-no" className="text-xs">Certificate No</Label>
                    <Input id="certificate-no" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="last-class-date" className="text-xs">Last Class Date</Label>
                    <Input id="last-class-date" type="date" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="next-class-date" className="text-xs">Next Class Date</Label>
                    <Input id="next-class-date" type="date" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="class-code" className="text-xs">Class Code</Label>
                    <Input id="class-code" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="class-remarks" className="text-xs">Class Remarks</Label>
                    <Input id="class-remarks" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="class-code-2" className="text-xs">Class Code</Label>
                    <Input id="class-code-2" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="certificate" className="text-xs">Certificate</Label>
                    <Input id="certificate" className="h-8 text-sm" />
                  </div>
                </div>
                <div className="flex justify-center mt-4">
                  <Button variant="outline" size="sm" className="text-blue-600">
                    + Add New Service
                  </Button>
                </div>
              </div>
            </div>

            {/* H. New Service Notes */}
            <div className="bg-white rounded-lg border">
              <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="bg-[#52baf3] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">H</span>
                  New Service Notes
                </h3>
                <Button variant="link" size="sm" className="text-blue-600">
                  + Add Field
                </Button>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="service-note" className="text-xs">Service Note</Label>
                    <Input id="service-note" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="note-date" className="text-xs">Note Date</Label>
                    <Input id="note-date" type="date" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="next-note" className="text-xs">Next Note</Label>
                    <Input id="next-note" type="date" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label htmlFor="note-level" className="text-xs">Note Level</Label>
                    <Input id="note-level" className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pb-4">
              <Button 
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-700 text-white px-8"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}