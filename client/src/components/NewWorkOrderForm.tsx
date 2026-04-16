import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { ArrowLeft, FileText } from "lucide-react";
import WorkInstructionsDialog from "./WorkInstructionsDialog";

interface NewWorkOrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (formData: any) => void;
}

const NewWorkOrderForm: React.FC<NewWorkOrderFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [activeSection, setActiveSection] = useState<'partA' | 'partB'>('partA');
  const [isWorkInstructionsOpen, setIsWorkInstructionsOpen] = useState(false);

  const { data: ranksData } = useQuery<any[]>({
    queryKey: ['/technical/api/ranks'],
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });
  const availableRanks = (ranksData || []).map((r: any) => r.name || r.rank).filter(Boolean);
  const defaultRanks = ["Master", "Chief Officer", "2nd Officer", "3rd Officer", "Chief Engineer", "2nd Engineer", "3rd Engineer", "4th Engineer", "Deck Cadet", "Engine Cadet", "Bosun", "Electrician"];
  const rankOptions = availableRanks.length > 0 ? availableRanks : defaultRanks;
  const approverRanks = (ranksData || []).filter((r: any) => r.rankView === 'Head_of_Dept' || r.isHod).map((r: any) => r.name || r.rank).filter(Boolean);
  const approverOptions = approverRanks.length > 0 ? approverRanks : ["Master", "Chief Officer", "Chief Engineer"];

  const [formData, setFormData] = useState({
    workOrder: "WO-2025-17",
    jobTitle: "",
    component: "",
    maintenanceType: "Planned Maintenance",
    assignedTo: "",
    approver: "",
    jobCategory: "",
    classRelated: "",
    status: "",
    briefWorkDescription: "",
    ppeRequirements: "",
    permitRequirements: "",
    otherSafetyRequirements: "",
  });

  const selectSection = (section: 'partA' | 'partB') => {
    setActiveSection(section);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(formData);
      onClose();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[80vw] max-w-none h-[90vh] flex flex-col">
          <DialogHeader className="pb-4 pr-12">
            <div className="flex items-center justify-between">
              <DialogTitle>Work Order Form</DialogTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsWorkInstructionsOpen(true)}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  + Add Work Instructions
                </Button>
                <Button size="sm" className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white">
                  Save
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
                    <p className="text-sm text-[#52baf3]">Enter details related to the new work order</p>
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
                          <Select value={formData.component} onValueChange={(value) => handleInputChange('component', value)}>
                            <SelectTrigger className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]">
                              <SelectValue placeholder="601.002 Main Engine" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="601.002 Main Engine">601.002 Main Engine</SelectItem>
                              <SelectItem value="602.001 Diesel Generator 1">602.001 Diesel Generator 1</SelectItem>
                              <SelectItem value="603.001 Steering Gear">603.001 Steering Gear</SelectItem>
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
                              <SelectItem value="Planned Maintenance">Planned Maintenance</SelectItem>
                              <SelectItem value="Preventive Maintenance">Preventive Maintenance</SelectItem>
                              <SelectItem value="Corrective Maintenance">Corrective Maintenance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Assigned To</Label>
                          <Select value={formData.assignedTo} onValueChange={(value) => handleInputChange('assignedTo', value)}>
                            <SelectTrigger className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]">
                              <SelectValue placeholder="Select rank" />
                            </SelectTrigger>
                            <SelectContent>
                              {rankOptions.map((rank: string) => (
                                <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Approver</Label>
                          <Select value={formData.approver} onValueChange={(value) => handleInputChange('approver', value)}>
                            <SelectTrigger className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]">
                              <SelectValue placeholder="Select approver" />
                            </SelectTrigger>
                            <SelectContent>
                              {approverOptions.map((rank: string) => (
                                <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                              ))}
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
                          <Label className="text-sm text-[#8798ad]">PPE Requirements:</Label>
                          <Input 
                            value={formData.ppeRequirements} 
                            onChange={(e) => handleInputChange('ppeRequirements', e.target.value)}
                            className="mt-2 text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                            placeholder="[Leather Gloves] [Goggles] [Safety Helmet]"
                          />
                        </div>
                        <div>
                          <Label className="text-sm text-[#8798ad]">Permit Requirements:</Label>
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
                        <div className="flex items-center justify-between">
                          <Label className="text-sm text-[#8798ad]">B1.1 Risk Assessment Completed / Reviewed:</Label>
                          <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                              <input type="radio" name="riskAssessment" id="risk-yes" className="text-[#52baf3]" />
                              <label htmlFor="risk-yes" className="text-sm">Yes</label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="radio" name="riskAssessment" id="risk-no" className="text-[#52baf3]" />
                              <label htmlFor="risk-no" className="text-sm">No</label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="radio" name="riskAssessment" id="risk-na" className="text-[#52baf3]" />
                              <label htmlFor="risk-na" className="text-sm">N/A</label>
                            </div>
                            <Button size="sm" variant="outline" className="ml-4">Upload</Button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="text-sm text-[#8798ad]">B1.2 Safety Checklists Completed (As applicable):</Label>
                          <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                              <input type="radio" name="safetyChecklist" id="safety-yes" className="text-[#52baf3]" />
                              <label htmlFor="safety-yes" className="text-sm">Yes</label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="radio" name="safetyChecklist" id="safety-no" className="text-[#52baf3]" />
                              <label htmlFor="safety-no" className="text-sm">No</label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="radio" name="safetyChecklist" id="safety-na" className="text-[#52baf3]" />
                              <label htmlFor="safety-na" className="text-sm">N/A</label>
                            </div>
                            <Button size="sm" variant="outline" className="ml-4">Upload</Button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="text-sm text-[#8798ad]">B1.3 Operational Forms Completed (As applicable):</Label>
                          <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                              <input type="radio" name="operationalForms" id="op-yes" className="text-[#52baf3]" />
                              <label htmlFor="op-yes" className="text-sm">Yes</label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="radio" name="operationalForms" id="op-no" className="text-[#52baf3]" />
                              <label htmlFor="op-no" className="text-sm">No</label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="radio" name="operationalForms" id="op-na" className="text-[#52baf3]" />
                              <label htmlFor="op-na" className="text-sm">N/A</label>
                            </div>
                            <Button size="sm" variant="outline" className="ml-4">Upload</Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* B2. Details of Work Carried Out */}
                    <div className="border border-gray-200 rounded-lg p-4 mb-6">
                      <h4 className="text-md font-medium mb-4" style={{ color: '#16569e' }}>B2. Details of Work Carried Out</h4>
                      
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm text-[#8798ad] font-medium">B2.1 Work Duration:</Label>
                          
                          <div className="grid grid-cols-3 gap-6 mt-3">
                            <div className="space-y-2">
                              <Label className="text-sm text-[#8798ad]">Start Date</Label>
                              <Input 
                                type="date"
                                className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                                placeholder="dd-mm-yyyy"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm text-[#8798ad]">Start Time</Label>
                              <Input 
                                className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                                placeholder="1045"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm text-[#8798ad]">Assigned To</Label>
                              <Input 
                                className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                                placeholder="Select rank"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-6 mt-4">
                            <div className="space-y-2">
                              <Label className="text-sm text-[#8798ad]">Completion Date</Label>
                              <Input 
                                type="date"
                                className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                                placeholder="dd-mm-yyyy"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm text-[#8798ad]">Completion Time</Label>
                              <Input 
                                className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                                placeholder="1200"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm text-[#8798ad]">Performed by</Label>
                              <Select>
                                <SelectTrigger className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]">
                                  <SelectValue placeholder="Select rank" />
                                </SelectTrigger>
                                <SelectContent>
                                  {rankOptions.map((rank: string) => (
                                    <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-6 mt-4">
                            <div className="space-y-2">
                              <Label className="text-sm text-[#8798ad]">No of Persons in the team</Label>
                              <Input 
                                className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                                placeholder="3"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm text-[#8798ad]">Total Time Taken (Hours)</Label>
                              <Input 
                                className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                                placeholder="5"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm text-[#8798ad]">Manhours</Label>
                              <Input 
                                className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                                placeholder="15"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Work Carried Out</Label>
                          <Textarea 
                            className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                            rows={4}
                            placeholder="Work carried out"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Job Experience / Notes</Label>
                          <Textarea 
                            className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                            rows={4}
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
                          <Input 
                            className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-[#8798ad]">Current Reading</Label>
                          <Input 
                            className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* B4. Spare Parts Consumed */}
                    <div className="border border-gray-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-md font-medium" style={{ color: '#16569e' }}>B4. Spare Parts Consumed</h4>
                        <Button size="sm" className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white">
                          + Add Spare Part
                        </Button>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left p-3 text-sm font-medium text-[#8798ad]">Part No</th>
                              <th className="text-left p-3 text-sm font-medium text-[#8798ad]">Description</th>
                              <th className="text-left p-3 text-sm font-medium text-[#8798ad]">Quantity Consumed</th>
                              <th className="text-left p-3 text-sm font-medium text-[#8798ad]">Comments (if any)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-gray-100">
                              <td className="p-3">
                                <Input className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]" placeholder="SP - 001" />
                              </td>
                              <td className="p-3">
                                <Input className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]" placeholder="O-Ring Seal" />
                              </td>
                              <td className="p-3">
                                <Input className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]" placeholder="2" />
                              </td>
                              <td className="p-3">
                                <Input className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]" />
                              </td>
                            </tr>
                            <tr className="border-b border-gray-100">
                              <td className="p-3">
                                <Input className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]" placeholder="SP-002" />
                              </td>
                              <td className="p-3">
                                <Input className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]" placeholder="Filter Element" />
                              </td>
                              <td className="p-3">
                                <Input className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]" placeholder="1" />
                              </td>
                              <td className="p-3">
                                <Input className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]" />
                              </td>
                            </tr>
                            <tr className="border-b border-gray-100">
                              <td className="p-3">
                                <Input className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]" placeholder="SP - 003" />
                              </td>
                              <td className="p-3">
                                <Input className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]" placeholder="Bearing" />
                              </td>
                              <td className="p-3">
                                <Input className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]" placeholder="2" />
                              </td>
                              <td className="p-3">
                                <Input className="text-sm border-[#52baf3] focus:border-[#52baf3] focus:ring-[#52baf3]" />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end mt-6">
                      <Button className="bg-green-600 hover:bg-green-700 text-white px-8">
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

      {/* Work Instructions Dialog */}
      <WorkInstructionsDialog
        isOpen={isWorkInstructionsOpen}
        onClose={() => setIsWorkInstructionsOpen(false)}
      />
    </>
  );
};

export default NewWorkOrderForm;