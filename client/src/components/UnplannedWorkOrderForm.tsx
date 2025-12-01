import { useState, useEffect } from "react";
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
import { ArrowLeft, List, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Component } from "@shared/schema";

interface UnplannedWorkOrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (formData: any) => void;
  vesselId?: string;
}

const UnplannedWorkOrderForm: React.FC<UnplannedWorkOrderFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  vesselId,
}) => {
  const [activeSection, setActiveSection] = useState<'partA' | 'partB'>('partA');
  const [isPpeDialogOpen, setIsPpeDialogOpen] = useState(false);
  const [isPermitDialogOpen, setIsPermitDialogOpen] = useState(false);
  const [selectedPpeItems, setSelectedPpeItems] = useState<string[]>([]);
  const [selectedPermitItems, setSelectedPermitItems] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch active components from API for the component selector (Issue #6)
  const { data: components = [], isLoading: componentsLoading } = useQuery<Component[]>({
    queryKey: ['/api/components', vesselId],
    queryFn: async () => {
      if (!vesselId) return [];
      const response = await fetch(`/api/components/${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch components');
      const allComponents = await response.json() as Component[];
      // Filter to show only active components (isActive can be boolean or null)
      const activeComponents = allComponents.filter(c => c.isActive === true);
      console.log('[UNPLANNED_WO] Components loaded:', activeComponents.length);
      return activeComponents;
    },
    enabled: isOpen && !!vesselId,
  });

  const [formData, setFormData] = useState({
    workOrder: "",
    jobTitle: "",
    componentId: "",
    componentCode: "",
    componentName: "",
    maintenanceType: "Unplanned Maintenance",
    assignedTo: "",
    approver: "",
    jobCategory: "",
    classRelated: "No",
    status: "Active",
    briefWorkDescription: "",
    ppeRequirements: "",
    permitRequirements: "",
    otherSafetyRequirements: "",
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        workOrder: "",
        jobTitle: "",
        componentId: "",
        componentCode: "",
        componentName: "",
        maintenanceType: "Unplanned Maintenance",
        assignedTo: "",
        approver: "",
        jobCategory: "",
        classRelated: "No",
        status: "Active",
        briefWorkDescription: "",
        ppeRequirements: "",
        permitRequirements: "",
        otherSafetyRequirements: "",
      });
      setActiveSection('partA');
    }
  }, [isOpen]);

  const selectSection = (section: 'partA' | 'partB') => {
    setActiveSection(section);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const ppeOptions = [
    "Leather Gloves",
    "Goggles", 
    "Safety Helmet",
    "Text",
    "Text",
    "Text",
    "Text",
    "Text"
  ];

  const permitOptions = [
    "Enclosed Space Entry Permit",
    "Hot Work Permit",
    "Work Aloft Permit", 
    "Cold Work Permit",
    "Text",
    "Text",
    "Text",
    "Text"
  ];

  const handlePpeSelection = (item: string, checked: boolean) => {
    if (checked) {
      setSelectedPpeItems(prev => [...prev, item]);
    } else {
      setSelectedPpeItems(prev => prev.filter(i => i !== item));
    }
  };

  const handlePermitSelection = (item: string, checked: boolean) => {
    if (checked) {
      setSelectedPermitItems(prev => [...prev, item]);
    } else {
      setSelectedPermitItems(prev => prev.filter(i => i !== item));
    }
  };

  const savePpeSelection = () => {
    const selectedText = selectedPpeItems.map(item => `[${item}]`).join(' ');
    handleInputChange('ppeRequirements', selectedText);
    setIsPpeDialogOpen(false);
  };

  const savePermitSelection = () => {
    const selectedText = selectedPermitItems.map(item => `[${item}]`).join(' ');
    handleInputChange('permitRequirements', selectedText);
    setIsPermitDialogOpen(false);
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.jobTitle) {
      alert('Please enter a Job Title');
      return;
    }
    if (!formData.componentId) {
      alert('Please select a Component');
      return;
    }
    if (!formData.briefWorkDescription) {
      alert('Please enter a Brief Work Description');
      return;
    }

    console.log('[UNPLANNED_WO] Submitting:', JSON.stringify(formData, null, 2));

    if (onSubmit) {
      setIsSubmitting(true);
      try {
        // Build the work order payload
        const workOrderPayload = {
          vesselId: vesselId,
          componentId: formData.componentId,
          componentCode: formData.componentCode,
          componentName: formData.componentName,
          jobTitle: formData.jobTitle,
          workOrderType: 'Unplanned',
          maintenanceType: formData.maintenanceType,
          assignedTo: formData.assignedTo,
          approver: formData.approver,
          jobCategory: formData.jobCategory,
          classRelated: formData.classRelated,
          status: formData.status || 'Active',
          briefWorkDescription: formData.briefWorkDescription,
          safetyRequirements: {
            ppeRequirements: formData.ppeRequirements ? formData.ppeRequirements.split('] [').map(s => s.replace(/[\[\]]/g, '').trim()).filter(Boolean) : [],
            permitRequirements: formData.permitRequirements ? formData.permitRequirements.split('] [').map(s => s.replace(/[\[\]]/g, '').trim()).filter(Boolean) : [],
            otherRequirements: formData.otherSafetyRequirements ? [formData.otherSafetyRequirements] : []
          },
          maintenanceBasis: 'Calendar',
          frequencyValue: '',
          frequencyUnit: '',
        };
        
        await onSubmit(workOrderPayload);
        onClose();
      } catch (error) {
        console.error('[UNPLANNED_WO] Error submitting:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Handle component selection - store both ID and display info
  const handleComponentSelect = (componentId: string) => {
    const selectedComponent = components.find(c => c.id === componentId);
    if (selectedComponent) {
      setFormData(prev => ({
        ...prev,
        componentId: componentId,
        componentCode: selectedComponent.componentCode || '',
        componentName: selectedComponent.name || '',
      }));
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[80vw] max-w-none h-[90vh] flex flex-col">
        <DialogHeader className="pb-4 pr-12">
          <div className="flex items-center justify-between">
            <DialogTitle>Work Order Form - Unplanned Maintenance</DialogTitle>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
                onClick={handleSubmit}
                disabled={isSubmitting}
                data-testid="button-save-unplanned-wo"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Navigation */}
          <div className="w-72 bg-gray-50 border-r border-gray-200 p-4">
            <div className="space-y-2">
              <div 
                className={`flex items-center gap-2 p-3 rounded cursor-pointer ${
                  activeSection === 'partA' ? 'bg-[#16569e] text-white' : 'bg-transparent text-[#8a8a8a] hover:bg-gray-100'
                }`}
                onClick={() => selectSection('partA')}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold ${
                  activeSection === 'partA' ? 'bg-white text-[#52baf3]' : 'bg-gray-300 text-white'
                }`}>
                  A
                </div>
                <span className="font-medium">Work Order Details</span>
              </div>
              <div 
                className={`flex items-center gap-2 p-3 rounded cursor-pointer ${
                  activeSection === 'partB' ? 'bg-[#16569e] text-white' : 'bg-transparent text-[#8a8a8a] hover:bg-gray-100'
                }`}
                onClick={() => selectSection('partB')}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold ${
                  activeSection === 'partB' ? 'bg-white text-[#52baf3]' : 'bg-gray-300 text-white'
                }`}>
                  B
                </div>
                <span className="font-medium">Work Completion Record</span>
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-auto p-6">
            {/* Part A - Work Order Details */}
            {activeSection === 'partA' && (
              <div className="border border-gray-200 rounded-lg mb-6">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Part A - Work Order Details</h3>
                  <p className="text-sm text-[#52baf3]">Enter details related to the unplanned new work order</p>
                </div>

                <div className="p-6">
                  {/* A1. Work Order Information */}
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <h4 className="text-md font-medium mb-4" style={{ color: '#16569e' }}>A1. Work Order Information</h4>
                    
                    <div className="grid grid-cols-3 gap-6">
                      {/* Row 1 */}
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Work Order</Label>
                        <Input 
                          value={formData.workOrder} 
                          onChange={(e) => handleInputChange('workOrder', e.target.value)}
                          className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Job Title</Label>
                        <Input 
                          value={formData.jobTitle} 
                          onChange={(e) => handleInputChange('jobTitle', e.target.value)}
                          className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                          placeholder="Main Engine - Replace Fuel Filters"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Component</Label>
                        <Select 
                          value={formData.componentId} 
                          onValueChange={handleComponentSelect}
                          disabled={componentsLoading}
                        >
                          <SelectTrigger className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]" data-testid="select-component">
                            <SelectValue placeholder={componentsLoading ? "Loading components..." : "Select Component"} />
                          </SelectTrigger>
                          <SelectContent>
                            {componentsLoading ? (
                              <SelectItem value="loading" disabled>Loading...</SelectItem>
                            ) : components.length === 0 ? (
                              <SelectItem value="none" disabled>No active components found</SelectItem>
                            ) : (
                              components.map((component) => (
                                <SelectItem 
                                  key={component.id} 
                                  value={component.id}
                                  data-testid={`select-component-${component.id}`}
                                >
                                  {component.componentCode} - {component.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Row 2 */}
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Maintenance Type</Label>
                        <Select value={formData.maintenanceType} onValueChange={(value) => handleInputChange('maintenanceType', value)}>
                          <SelectTrigger className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Unplanned Maintenance">Unplanned Maintenance</SelectItem>
                            <SelectItem value="Emergency Maintenance">Emergency Maintenance</SelectItem>
                            <SelectItem value="Breakdown Maintenance">Breakdown Maintenance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Assigned To</Label>
                        <Select value={formData.assignedTo} onValueChange={(value) => handleInputChange('assignedTo', value)}>
                          <SelectTrigger className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]">
                            <SelectValue placeholder="Rank" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Chief Engineer">Chief Engineer</SelectItem>
                            <SelectItem value="2nd Engineer">2nd Engineer</SelectItem>
                            <SelectItem value="3rd Engineer">3rd Engineer</SelectItem>
                            <SelectItem value="4th Engineer">4th Engineer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Approver</Label>
                        <Select value={formData.approver} onValueChange={(value) => handleInputChange('approver', value)}>
                          <SelectTrigger className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]">
                            <SelectValue placeholder="Rank" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Chief Engineer">Chief Engineer</SelectItem>
                            <SelectItem value="Captain">Captain</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Row 3 */}
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Job Category</Label>
                        <Select value={formData.jobCategory} onValueChange={(value) => handleInputChange('jobCategory', value)}>
                          <SelectTrigger className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]">
                            <SelectValue placeholder="Mechanical" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Mechanical">Mechanical</SelectItem>
                            <SelectItem value="Electrical">Electrical</SelectItem>
                            <SelectItem value="Hydraulic">Hydraulic</SelectItem>
                            <SelectItem value="Safety">Safety</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Class Related</Label>
                        <Select value={formData.classRelated} onValueChange={(value) => handleInputChange('classRelated', value)}>
                          <SelectTrigger className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]">
                            <SelectValue placeholder="Yes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Status</Label>
                        <Input 
                          value={formData.status} 
                          onChange={(e) => handleInputChange('status', e.target.value)}
                          className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                          placeholder="Status"
                        />
                      </div>
                    </div>

                    {/* Brief Work Description */}
                    <div className="mt-6">
                      <Label className="text-sm text-[#8798ad]">Brief Work Description</Label>
                      <Textarea 
                        value={formData.briefWorkDescription} 
                        onChange={(e) => handleInputChange('briefWorkDescription', e.target.value)}
                        className="mt-2 text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                        rows={3}
                        placeholder="Add Work description"
                      />
                    </div>
                  </div>

                  {/* A2. Safety Requirements */}
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <h4 className="text-md font-medium mb-4" style={{ color: '#16569e' }}>A2. Safety Requirements</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-[#8798ad]">PPE Requirements:</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsPpeDialogOpen(true)}
                            className="p-1 h-6 w-6"
                          >
                            <List className="h-3 w-3" />
                          </Button>
                        </div>
                        <Input 
                          value={formData.ppeRequirements} 
                          onChange={(e) => handleInputChange('ppeRequirements', e.target.value)}
                          className="mt-2 text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                          placeholder="[Leather Gloves] [Goggles] [Safety Helmet]"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-[#8798ad]">Permit Requirements:</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsPermitDialogOpen(true)}
                            className="p-1 h-6 w-6"
                          >
                            <List className="h-3 w-3" />
                          </Button>
                        </div>
                        <Input 
                          value={formData.permitRequirements} 
                          onChange={(e) => handleInputChange('permitRequirements', e.target.value)}
                          className="mt-2 text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                          placeholder="[Enclosed Space Entry Permit]"
                        />
                      </div>
                      <div>
                        <Label className="text-sm text-[#8798ad]">Other Safety Requirements:</Label>
                        <Input 
                          value={formData.otherSafetyRequirements} 
                          onChange={(e) => handleInputChange('otherSafetyRequirements', e.target.value)}
                          className="mt-2 text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                          placeholder="Free Text"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Part B - Work Completion Record */}
            {activeSection === 'partB' && (
              <div className="border border-gray-200 rounded-lg mb-6">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#16569e]">Part B - Work Completion Record</h3>
                  <p className="text-sm text-[#52baf3]">Enter work completion details here including Risk assessment, checklists, comments etc.</p>
                </div>

                <div className="p-6">
                  {/* B1. Risk Assessment, Checklists & Records */}
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <h4 className="text-md font-medium mb-4" style={{ color: '#16569e' }}>B1. Risk Assessment, Checklists & Records</h4>
                    
                    <div className="space-y-4">
                      {/* B1.1 Risk Assessment Completed / Reviewed */}
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-6">
                          <Label className="text-sm text-gray-900">B1.1 Risk Assessment Completed / Reviewed:</Label>
                        </div>
                        <div className="col-span-3 flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input type="radio" name="riskAssessment" value="yes" defaultChecked className="text-blue-600" />
                            <span className="text-sm">Yes</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="riskAssessment" value="no" className="text-blue-600" />
                            <span className="text-sm">No</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="riskAssessment" value="na" className="text-blue-600" />
                            <span className="text-sm">NA</span>
                          </label>
                        </div>
                        <div className="col-span-3 flex items-center gap-2">
                          <Button variant="outline" size="sm" className="text-xs">Upload</Button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                            </svg>
                          </button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd"/>
                              <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h8a1 1 0 001-1V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM8 8a1 1 0 012 0v3a1 1 0 11-2 0V8zm4 0a1 1 0 10-2 0v3a1 1 0 102 0V8z" clipRule="evenodd"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* B1.2 Safety Checklists Completed */}
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-6">
                          <Label className="text-sm text-gray-900">B1.2 Safety Checklists Completed (As applicable):</Label>
                        </div>
                        <div className="col-span-3 flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input type="radio" name="safetyChecklists" value="yes" defaultChecked className="text-blue-600" />
                            <span className="text-sm">Yes</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="safetyChecklists" value="no" className="text-blue-600" />
                            <span className="text-sm">No</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="safetyChecklists" value="na" className="text-blue-600" />
                            <span className="text-sm">NA</span>
                          </label>
                        </div>
                        <div className="col-span-3 flex items-center gap-2">
                          <Button variant="outline" size="sm" className="text-xs">Upload</Button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                            </svg>
                          </button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd"/>
                              <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h8a1 1 0 001-1V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM8 8a1 1 0 012 0v3a1 1 0 11-2 0V8zm4 0a1 1 0 10-2 0v3a1 1 0 102 0V8z" clipRule="evenodd"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* B1.3 Operational Forms Completed */}
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-6">
                          <Label className="text-sm text-gray-900">B1.3 Operational Forms Completed (As applicable):</Label>
                        </div>
                        <div className="col-span-3 flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input type="radio" name="operationalForms" value="yes" defaultChecked className="text-blue-600" />
                            <span className="text-sm">Yes</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="operationalForms" value="no" className="text-blue-600" />
                            <span className="text-sm">No</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="operationalForms" value="na" className="text-blue-600" />
                            <span className="text-sm">NA</span>
                          </label>
                        </div>
                        <div className="col-span-3 flex items-center gap-2">
                          <Button variant="outline" size="sm" className="text-xs">Upload</Button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                            </svg>
                          </button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd"/>
                              <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h8a1 1 0 001-1V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM8 8a1 1 0 012 0v3a1 1 0 11-2 0V8zm4 0a1 1 0 10-2 0v3a1 1 0 102 0V8z" clipRule="evenodd"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* B2. Details of Work Carried Out */}
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <h4 className="text-md font-medium mb-4" style={{ color: '#16569e' }}>B2. Details of Work Carried Out</h4>
                    
                    <div className="mb-6">
                      <h5 className="text-sm font-medium text-gray-900 mb-4">B2.1 Work Duration:</h5>
                      
                      <div className="grid grid-cols-3 gap-6 mb-4">
                        {/* Row 1 */}
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Start Date</Label>
                          <Input type="date" className="w-full" placeholder="dd-mm-yyyy" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Start Time</Label>
                          <Input type="text" className="w-full" defaultValue="1045" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Assigned To</Label>
                          <Input type="text" className="w-full" defaultValue="Chief Engineer" />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-6 mb-4">
                        {/* Row 2 */}
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Completion Date</Label>
                          <Input type="date" className="w-full" placeholder="dd-mm-yyyy" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Completion Time</Label>
                          <Input type="text" className="w-full" defaultValue="1200" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Performed by</Label>
                          <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            <option>Chief Engineer</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-6 mb-6">
                        {/* Row 3 */}
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">No of Persons in the team</Label>
                          <Input type="text" className="w-full" defaultValue="3" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Total Time Taken (Hours)</Label>
                          <Input type="text" className="w-full" defaultValue="3" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Manhours</Label>
                          <Input type="text" className="w-full" defaultValue="3.3" />
                        </div>
                      </div>
                      
                      {/* Work Carried Out */}
                      <div className="space-y-2 mb-4">
                        <Label className="text-sm text-[#8798ad]">Work Carried Out</Label>
                        <Textarea 
                          className="w-full min-h-[80px]" 
                          placeholder="Work carried out"
                        />
                      </div>
                      
                      {/* Job Experience / Notes */}
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Job Experience / Notes</Label>
                        <Textarea 
                          className="w-full min-h-[80px]" 
                          placeholder="Job Experience / Notes"
                        />
                      </div>
                    </div>
                  </div>

                  {/* B3. Running Hours */}
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <h4 className="text-md font-medium mb-4" style={{ color: '#16569e' }}>B3. Running Hours</h4>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Previous reading</Label>
                        <Input type="text" className="w-full" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Current Reading</Label>
                        <Input type="text" className="w-full" />
                      </div>
                    </div>
                  </div>

                  {/* B4. Spare Parts Consumed */}
                  <div className="border border-gray-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-md font-medium" style={{ color: '#16569e' }}>B4. Spare Parts Consumed</h4>
                      <button className="text-sm text-blue-600 hover:text-blue-800">+ Add Spare Part</button>
                    </div>
                    
                    <div className="border border-gray-200 rounded">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-700">
                          <div>Part No</div>
                          <div>Description</div>
                          <div>Quantity Consumed</div>
                          <div>Comments (if any)</div>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-200">
                        <div className="px-4 py-3">
                          <div className="grid grid-cols-4 gap-4 text-sm items-center">
                            <div className="text-gray-900">SP -001</div>
                            <div className="text-gray-900">O-Ring Seal</div>
                            <div>
                              <Input type="text" className="w-full" defaultValue="2" />
                            </div>
                            <div>
                              <Input type="text" className="w-full" />
                            </div>
                          </div>
                        </div>
                        <div className="px-4 py-3">
                          <div className="grid grid-cols-4 gap-4 text-sm items-center">
                            <div className="text-gray-900">SP-002</div>
                            <div className="text-gray-900">Filter Element</div>
                            <div>
                              <Input type="text" className="w-full" defaultValue="1" />
                            </div>
                            <div>
                              <Input type="text" className="w-full" />
                            </div>
                          </div>
                        </div>
                        <div className="px-4 py-3">
                          <div className="grid grid-cols-4 gap-4 text-sm items-center">
                            <div className="text-gray-900">SP -003</div>
                            <div className="text-gray-900">Bearing</div>
                            <div>
                              <Input type="text" className="w-full" defaultValue="2" />
                            </div>
                            <div>
                              <Input type="text" className="w-full" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end mt-6">
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
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* PPE Requirements Dialog */}
    <Dialog open={isPpeDialogOpen} onOpenChange={setIsPpeDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#52baf3] border-b border-[#52baf3] pb-2">
            PPE Requirements
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {ppeOptions.map((item, index) => (
            <div key={index} className="flex items-center space-x-3">
              <input
                type="checkbox"
                id={`ppe-${index}`}
                checked={selectedPpeItems.includes(item)}
                onChange={(e) => handlePpeSelection(item, e.target.checked)}
                className="h-4 w-4 text-[#52baf3] border border-gray-300 rounded focus:ring-[#52baf3]"
              />
              <label htmlFor={`ppe-${index}`} className="text-sm text-gray-700 border border-gray-200 rounded px-3 py-2 flex-1">
                {item}
              </label>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setIsPpeDialogOpen(false)}>
            Cancel
          </Button>
          <Button className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white" onClick={savePpeSelection}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Permit Requirements Dialog */}
    <Dialog open={isPermitDialogOpen} onOpenChange={setIsPermitDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#52baf3] border-b border-[#52baf3] pb-2">
            Permit Requirements
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {permitOptions.map((item, index) => (
            <div key={index} className="flex items-center space-x-3">
              <input
                type="checkbox"
                id={`permit-${index}`}
                checked={selectedPermitItems.includes(item)}
                onChange={(e) => handlePermitSelection(item, e.target.checked)}
                className="h-4 w-4 text-[#52baf3] border border-gray-300 rounded focus:ring-[#52baf3]"
              />
              <label htmlFor={`permit-${index}`} className="text-sm text-gray-700 border border-gray-200 rounded px-3 py-2 flex-1">
                {item}
              </label>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setIsPermitDialogOpen(false)}>
            Cancel
          </Button>
          <Button className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white" onClick={savePermitSelection}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default UnplannedWorkOrderForm;