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
import { ArrowLeft, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SectionBlock } from '@/components/SectionBlock';
import { PartHeader } from '@/components/PartHeader';
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
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch active components from API
  const { data: components = [], isLoading: componentsLoading } = useQuery<Component[]>({
    queryKey: ['/technical/api/components', vesselId],
    queryFn: async () => {
      if (!vesselId) return [];
      const response = await fetch(`/technical/api/components/${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch components');
      const allComponents = await response.json() as Component[];
      const activeComponents = allComponents.filter(c => c.isActive === true && c.isParent !== true);
      return activeComponents;
    },
    enabled: isOpen && !!vesselId,
  });

  const ranks = [
    "Master",
    "Chief Officer",
    "2nd Officer",
    "3rd Officer",
    "Chief Engineer",
    "2nd Engineer",
    "3rd Engineer",
    "4th Engineer",
    "Deck Cadet",
    "Engine Cadet",
    "Bosun",
    "Pumpman",
    "Electrician",
    "Fitter",
    "Able Seaman",
    "Ordinary Seaman",
    "Oiler",
    "Wiper",
    "Cook",
    "Steward"
  ];

  const departments = [
    "Deck",
    "Engine",
    "Electrical",
    "Safety",
    "Catering",
    "Navigation",
    "Radio",
    "General"
  ];

  const jobCategories = [
    "Mechanical",
    "Electrical",
    "Hydraulic",
    "Safety",
    "Other"
  ];

  // Form Data (Part A - Job Information only)
  const [formData, setFormData] = useState({
    woTitle: "",
    component: "",
    componentId: "",
    componentName: "",
    componentCode: "",
    taskType: "Unplanned Maintenance",
    assignedTo: "",
    approver: "",
    jobPriority: "Medium",
    jobCategory: "",
    classRelated: "No",
    department: "",
    criticality: "",
    isActive: "Yes",
    briefWorkDescription: "",
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        woTitle: "",
        component: "",
        componentId: "",
        componentName: "",
        componentCode: "",
        taskType: "Unplanned Maintenance",
        assignedTo: "",
        approver: "",
        jobPriority: "Medium",
        jobCategory: "",
        classRelated: "No",
        department: "",
        criticality: "",
        isActive: "Yes",
        briefWorkDescription: "",
      });
    }
  }, [isOpen]);

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Component selection handler
  const handleComponentSelect = (componentId: string) => {
    const selectedComponent = components.find(c => String(c.id) === componentId);
    if (selectedComponent) {
      setFormData(prev => ({
        ...prev,
        componentId: componentId,
        componentCode: selectedComponent.componentCode || '',
        componentName: selectedComponent.name || '',
        component: selectedComponent.name || '',
      }));
    }
  };

  // Main submit handler
  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.woTitle) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a Job Title',
        variant: 'destructive'
      });
      return;
    }
    if (!formData.componentId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a Component',
        variant: 'destructive'
      });
      return;
    }
    if (!formData.briefWorkDescription) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a Brief Work Description',
        variant: 'destructive'
      });
      return;
    }

    if (onSubmit) {
      setIsSubmitting(true);
      try {
        const workOrderPayload = {
          vesselId: vesselId,
          component: formData.componentName,
          componentCode: formData.componentCode,
          jobTitle: formData.woTitle,
          workOrderType: 'Unplanned',
          maintenanceType: formData.taskType || 'Unplanned Maintenance',
          assignedTo: formData.assignedTo || 'Chief Engineer',
          approver: formData.approver || '',
          jobCategory: formData.jobCategory || '',
          jobPriority: formData.jobPriority || 'Medium',
          classRelated: formData.classRelated || 'No',
          department: formData.department || '',
          criticality: formData.criticality || '',
          status: 'Active',
          briefWorkDescription: formData.briefWorkDescription,
          dataScope: 'vessel',
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[80vw] max-w-none h-[90vh] flex flex-col">
        <DialogHeader className="pb-4 pr-12">
          <div className="flex items-center justify-between">
            <DialogTitle>Work Order Form - Unplanned Maintenance</DialogTitle>
            <Button variant="outline" size="sm" onClick={onClose}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Navigation (Only Part A) */}
          <div className="w-20 flex-shrink-0 bg-gray-50 border-r border-gray-200 p-4">
            <nav className="space-y-6">
              <div
                className="flex flex-col items-center gap-2 group cursor-pointer"
                data-testid="nav-step-part-a"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm bg-[hsl(var(--primary))] text-white">
                  A
                </div>
                <span className="text-xs text-center text-gray-500 max-w-[60px] leading-tight">
                  Job Details
                </span>
              </div>
            </nav>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-auto p-6">
            {/* Part A - Job Details (A1 Only) */}
            <div className="space-y-6">
              <PartHeader
                id="part-a"
                label="Part A"
                title="Job Details"
                description="Work details about this work order"
              />

              {/* A1. Job Information */}
              <SectionBlock 
                id="work-order-info"
                number="A1"
                title="Job Information" 
                description="Basic details and configuration for this work order"
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Job Title</Label>
                      <Input
                        value={formData.woTitle}
                        onChange={(e) => handleFormChange('woTitle', e.target.value)}
                        className="text-sm"
                        placeholder="Enter job title"
                        data-testid="input-job-title"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Component</Label>
                      <Select
                        value={formData.componentId}
                        onValueChange={handleComponentSelect}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-component">
                          <SelectValue placeholder={componentsLoading ? "Loading..." : "Select component"} />
                        </SelectTrigger>
                        <SelectContent>
                          {components.map((component) => (
                            <SelectItem key={component.id} value={String(component.id)}>
                              {component.componentCode} - {component.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Component Code</Label>
                      <Input
                        value={formData.componentCode}
                        className="text-sm bg-gray-50"
                        disabled
                        data-testid="input-component-code"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Task Type</Label>
                      <Select
                        value={formData.taskType}
                        onValueChange={(value) => handleFormChange('taskType', value)}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-task-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Unplanned Maintenance">Unplanned Maintenance</SelectItem>
                          <SelectItem value="Emergency Maintenance">Emergency Maintenance</SelectItem>
                          <SelectItem value="Breakdown Maintenance">Breakdown Maintenance</SelectItem>
                          <SelectItem value="Corrective Maintenance">Corrective Maintenance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Assigned To (Rank)</Label>
                      <Select
                        value={formData.assignedTo}
                        onValueChange={(value) => handleFormChange('assignedTo', value)}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-assigned-to">
                          <SelectValue placeholder="Select rank" />
                        </SelectTrigger>
                        <SelectContent>
                          {ranks.map((rank) => (
                            <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Approver (Rank)</Label>
                      <Select
                        value={formData.approver}
                        onValueChange={(value) => handleFormChange('approver', value)}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-approver">
                          <SelectValue placeholder="Select rank" />
                        </SelectTrigger>
                        <SelectContent>
                          {ranks.map((rank) => (
                            <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Job Priority</Label>
                      <Select
                        value={formData.jobPriority}
                        onValueChange={(value) => handleFormChange('jobPriority', value)}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Job Category</Label>
                      <Select
                        value={formData.jobCategory}
                        onValueChange={(value) => handleFormChange('jobCategory', value)}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {jobCategories.map((category) => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Class Related</Label>
                      <Select
                        value={formData.classRelated}
                        onValueChange={(value) => handleFormChange('classRelated', value)}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-class-related">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Department</Label>
                      <Select
                        value={formData.department}
                        onValueChange={(value) => handleFormChange('department', value)}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-department">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Criticality</Label>
                      <Select
                        value={formData.criticality}
                        onValueChange={(value) => handleFormChange('criticality', value)}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-criticality">
                          <SelectValue placeholder="Select criticality" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-[#8798ad]">Is Active</Label>
                      <Select
                        value={formData.isActive}
                        onValueChange={(value) => handleFormChange('isActive', value)}
                      >
                        <SelectTrigger className="text-sm" data-testid="select-is-active">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]">Brief Work Description</Label>
                    <Textarea
                      value={formData.briefWorkDescription}
                      onChange={(e) => handleFormChange('briefWorkDescription', e.target.value)}
                      className="text-sm min-h-[80px]"
                      placeholder="Describe the work to be performed"
                      data-testid="input-description"
                    />
                  </div>
                </div>
              </SectionBlock>

              {/* Submit Button */}
              <div className="flex justify-end mt-6 pb-6">
                <Button 
                  size="lg" 
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-white px-8 py-3 text-base font-medium"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  data-testid="button-submit"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UnplannedWorkOrderForm;
