import React, { useState, useEffect, useRef } from "react";
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
import { ChevronDown, ChevronRight, FileText, ArrowLeft, AlertCircle, Pencil, Trash2, Check, X, Plus, Eye, Upload, Save } from "lucide-react";
import { useLocation, useRoute, useParams } from "wouter";
import WorkInstructionsDialog from "@/components/WorkInstructionsDialog";
import { useToast } from "@/hooks/use-toast";
import { useModifyMode } from "@/hooks/useModifyMode";
import { ModifyFieldWrapper } from "@/components/modify/ModifyFieldWrapper";
import { ModifyStickyFooter } from "@/components/modify/ModifyStickyFooter";
import { generateSuggestions, extractContextFromWorkOrder, type WorkOrderContext } from "@/utils/suggestionEngine";
import { FEATURES, IHM_ACTIONS } from '@/config/features';
import type { WorkOrder, WorkOrderExecution } from '@shared/schema';

// Type for history mode payload
export interface HistoryWorkOrderPayload {
  template: WorkOrder;
  execution: WorkOrderExecution;
}

interface WorkOrderFormPageProps {
  mode?: 'template' | 'execution' | 'history' | 'new';
}

const WorkOrderFormPage: React.FC<WorkOrderFormPageProps> = ({
  mode = 'execution'
}) => {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/pms/work-order/:id");
  const workOrderId = params?.id;
  
  const [activeSection, setActiveSection] = useState<'partA' | 'partB'>('partA');
  const [isWorkInstructionsOpen, setIsWorkInstructionsOpen] = useState(false);
  
  // Quick Input functionality for Work Carried Out
  const workCarriedOutRef = useRef<HTMLTextAreaElement>(null);
  const [showQuickInputs, setShowQuickInputs] = useState(false);
  
  // Smart Suggestions functionality
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState<string[]>([]);
  
  // Predefined quick answers for Work Carried Out
  const quickAnswers = [
    "Work carried out, found satisfactory.",
    "Checked and tested, no defects observed.",
    "Alarm tested, found satisfactory.",
    "Routine maintenance carried out as per PMS.",
    "Equipment inspected, found in good condition.",
    "Lubrication/oiling carried out, parameters normal.",
    "Work completed, system restored to normal.",
    "Trial conducted, performance satisfactory.",
    "Defect rectified, equipment put back in service.",
    "Cleaning carried out, area left tidy."
  ];
  
  // Modify mode integration
  const { isModifyMode, targetId, fieldChanges, trackFieldChange, setOriginalSnapshot } = useModifyMode();
  
  // Template data (Part A)
  const [templateData, setTemplateData] = useState({
    woTitle: "",
    component: "",
    componentCode: "",
    woTemplateCode: "",
    maintenanceBasis: "Calendar",
    frequencyValue: "",
    frequencyUnit: "Months",
    taskType: "Inspection",
    assignedTo: "",
    approver: "",
    jobPriority: "Medium",
    classRelated: "No",
    briefWorkDescription: "",
    nextDueDate: "",
    nextDueReading: "",
    requiredSpareParts: [] as Array<{partNo: string, description: string, quantityRequired: string, quantityAvailable: string, status: string}>,
    requiredTools: [] as Array<{toolName: string, quantity: string, remarks: string}>,
    safetyRequirements: {
      ppeRequirements: [] as string[],
      permitRequirements: [] as string[],
      otherRequirements: [] as string[]
    },
    workHistory: [] as Array<{woNo: string, assignedTo: string, performedBy: string, workDate: string, runDate: string, completionDate: string, status: string}>
  });

  // State for Part B4 spare parts consumed inline editing
  const [editingConsumedSparePart, setEditingConsumedSparePart] = useState<number | null>(null);

  // Execution data (Part B)
  const [executionData, setExecutionData] = useState({
    woExecutionId: "",
    riskAssessment: "No",
    safetyChecklists: "No",
    operationalForms: "No",
    startDateTime: "",
    completionDateTime: "",
    dateOfCompletion: "", // NEW FIELD
    runningHours: "", // NEW FIELD
    assignedTo: "",
    performedBy: "",
    noOfPersons: "",
    totalTimeHours: "",
    manhours: "",
    workCarriedOut: "",
    jobExperienceNotes: "",
    previousReading: "",
    currentReading: "",
    uploadedDocuments: [] as Array<{type: string, fileName: string, fileKey: string, uploadedAt: string, uploadedBy: string}>,
    consumedSpareParts: [] as Array<{partNo: string, description: string, quantityConsumed: string, comments: string}>,
    // IHM fields
    ihmUpdate: {
      enabled: false,
      action: "",
      targetComponent: "",
      targetSpare: "",
      quantity: "",
      location: "",
      materials: [],
      remarks: ""
    }
  });

  // Ranks for dropdowns
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

  // Handle save
  const handleSave = async () => {
    try {
      // TODO: Implement save logic with running hours validation
      toast({
        title: "Success",
        description: "Work order saved successfully",
      });
      navigate("/pms/work-orders");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save work order",
        variant: "destructive",
      });
    }
  };

  // Handle back navigation
  const handleBack = () => {
    navigate("/pms/work-orders");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={handleBack}
                className="text-gray-600 hover:text-gray-900"
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Work Order Form</h1>
                <p className="text-sm text-gray-500">{templateData.woTemplateCode || "New Work Order"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white"
                data-testid="button-save"
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveSection('partA')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeSection === 'partA'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="tab-part-a"
            >
              Part A - Work Order Details
            </button>
            <button
              onClick={() => setActiveSection('partB')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeSection === 'partB'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid="tab-part-b"
            >
              Part B - Work Completion Record
            </button>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            {activeSection === 'partA' ? (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-blue-900">Part A - Work Order Details</h2>
                <p className="text-sm text-gray-500">Basic details about the work order will be shown here</p>
                {/* Part A content will be added in next iteration */}
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-blue-900">Part B - Work Completion Record</h2>
                
                {/* B4. DETAILS OF WORK carried out */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-md font-medium mb-4" style={{ color: '#16569e' }}>B4. DETAILS OF WORK carried out</h4>
                  
                  <div className="space-y-4">
                    {/* Date of Completion */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Date of Completion *</Label>
                        <Input
                          type="datetime-local"
                          value={executionData.dateOfCompletion}
                          onChange={(e) => setExecutionData({...executionData, dateOfCompletion: e.target.value})}
                          className="text-sm"
                          data-testid="input-date-of-completion"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad]">Running Hours *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={executionData.runningHours}
                          onChange={(e) => setExecutionData({...executionData, runningHours: e.target.value})}
                          placeholder="Enter running hours"
                          className="text-sm"
                          data-testid="input-running-hours"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Work Instructions Dialog */}
      <WorkInstructionsDialog
        isOpen={isWorkInstructionsOpen}
        onClose={() => setIsWorkInstructionsOpen(false)}
        workInstructions=""
      />
    </div>
  );
};

export default WorkOrderFormPage;
