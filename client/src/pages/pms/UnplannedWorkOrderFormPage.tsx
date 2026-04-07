import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
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
import { ArrowLeft, Loader2, Copy, Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";
import { apiRequest } from "@/lib/queryClient";
import { SectionBlock } from "@/components/SectionBlock";
import { PartHeader } from "@/components/PartHeader";
import type { Component } from "@shared/schema";

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
  "Steward",
];

const departments = [
  "Deck",
  "Engine",
  "Electrical",
  "Safety",
  "Catering",
  "Navigation",
  "Radio",
  "General",
];

const jobCategories = [
  "Mechanical",
  "Electrical",
  "Hydraulic",
  "Safety",
  "Other",
];

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
  "Cleaning carried out, area left tidy.",
];

interface ConsumedSparePart {
  partNo: string;
  description: string;
  quantityConsumed: string;
  location: string;
  comments: string;
}

interface PartAData {
  woTitle: string;
  componentId: string;
  componentName: string;
  componentCode: string;
  taskType: string;
  assignedTo: string;
  approver: string;
  jobPriority: string;
  jobCategory: string;
  classRelated: string;
  department: string;
  criticality: string;
  isActive: string;
  briefWorkDescription: string;
}

interface ExecutionData {
  riskAssessment: string;
  safetyChecklists: string;
  operationalForms: string;
  startDateTime: string;
  completionDateTime: string;
  dateOfCompletion: string;
  performedBy: string;
  noOfPersons: string;
  totalTimeHours: string;
  manhours: string;
  workCarriedOut: string;
  jobExperienceNotes: string;
  previousReading: string;
  currentReading: string;
  consumedSpareParts: ConsumedSparePart[];
}

export default function UnplannedWorkOrderFormPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { vesselId } = useVessel();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState<"part-a" | "part-b">("part-a");
  const [showQuickInputs, setShowQuickInputs] = useState(false);
  const workCarriedOutRef = useRef<HTMLTextAreaElement>(null);

  const [partAData, setPartAData] = useState<PartAData>({
    woTitle: "",
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

  const [executionData, setExecutionData] = useState<ExecutionData>({
    riskAssessment: "",
    safetyChecklists: "",
    operationalForms: "",
    startDateTime: "",
    completionDateTime: "",
    dateOfCompletion: "",
    performedBy: "",
    noOfPersons: "",
    totalTimeHours: "",
    manhours: "",
    workCarriedOut: "",
    jobExperienceNotes: "",
    previousReading: "",
    currentReading: "",
    consumedSpareParts: [],
  });

  const { data: components = [], isLoading: componentsLoading } = useQuery<Component[]>({
    queryKey: ["/technical/api/components", vesselId],
    queryFn: async () => {
      if (!vesselId) return [];
      const response = await fetch(`/technical/api/components/${vesselId}`);
      if (!response.ok) throw new Error("Failed to fetch components");
      const allComponents = (await response.json()) as Component[];
      return allComponents.filter((c) => c.isActive === true && c.isParent !== true);
    },
    enabled: !!vesselId,
  });

  const handlePartAChange = (field: keyof PartAData, value: string) => {
    setPartAData((prev) => ({ ...prev, [field]: value }));
  };

  const handleComponentSelect = (componentId: string) => {
    const selected = components.find((c) => c.id === componentId);
    if (selected) {
      setPartAData((prev) => ({
        ...prev,
        componentId,
        componentCode: selected.componentCode || "",
        componentName: selected.name || "",
      }));
      const rh = (selected as any).currentCumulativeRH ?? (selected as any).currentRH ?? "";
      if (rh !== "") {
        setExecutionData((prev) => ({ ...prev, previousReading: String(rh) }));
      }
    }
  };

  const handleExecutionChange = (field: keyof ExecutionData, value: string) => {
    setExecutionData((prev) => {
      const newData = { ...prev, [field]: value };

      if (field === "noOfPersons") {
        const persons = parseFloat(value);
        const hours = parseFloat(newData.totalTimeHours);
        if (!isNaN(persons) && !isNaN(hours) && persons > 0 && hours > 0) {
          newData.manhours = (persons * hours).toString();
        } else {
          newData.manhours = "";
        }
      }

      return newData;
    });
  };

  useEffect(() => {
    const startDate = executionData.startDateTime ? executionData.startDateTime.split("T")[0] : "";
    const startTime = executionData.startDateTime
      ? executionData.startDateTime.split("T")[1]?.substring(0, 5) || ""
      : "";
    const compDate = executionData.completionDateTime
      ? executionData.completionDateTime.split("T")[0]
      : "";
    const compTime = executionData.completionDateTime
      ? executionData.completionDateTime.split("T")[1]?.substring(0, 5) || ""
      : "";

    if (startDate && startTime && compDate && compTime) {
      const start = new Date(`${startDate}T${startTime}:00`);
      const end = new Date(`${compDate}T${compTime}:00`);
      const diffMs = end.getTime() - start.getTime();
      if (diffMs > 0) {
        const hours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        const hoursStr = hours.toString();
        setExecutionData((prev) => {
          if (prev.totalTimeHours === hoursStr) return prev;
          const persons = parseFloat(prev.noOfPersons);
          const manhours =
            !isNaN(persons) && persons > 0 && hours > 0
              ? (persons * hours).toString()
              : prev.manhours;
          return { ...prev, totalTimeHours: hoursStr, manhours };
        });
      }
    }
  }, [executionData.startDateTime, executionData.completionDateTime]);

  const insertQuickText = (text: string) => {
    const textarea = workCarriedOutRef.current;
    if (!textarea) {
      handleExecutionChange("workCarriedOut", (executionData.workCarriedOut || "") + "\n" + text);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = executionData.workCarriedOut;
    const before = current.substring(0, start);
    const after = current.substring(end);
    const prefix = before && start > 0 ? "\n" : "";
    const newValue = before + prefix + text + after;
    handleExecutionChange("workCarriedOut", newValue);
    setTimeout(() => {
      textarea.focus();
      const pos = start + prefix.length + text.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  const addConsumedSparePart = () => {
    setExecutionData((prev) => ({
      ...prev,
      consumedSpareParts: [
        ...prev.consumedSpareParts,
        { partNo: "", description: "", quantityConsumed: "", location: "", comments: "" },
      ],
    }));
  };

  const updateConsumedSparePart = (index: number, field: keyof ConsumedSparePart, value: string) => {
    setExecutionData((prev) => {
      const updated = [...prev.consumedSpareParts];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, consumedSpareParts: updated };
    });
  };

  const removeConsumedSparePart = (index: number) => {
    setExecutionData((prev) => ({
      ...prev,
      consumedSpareParts: prev.consumedSpareParts.filter((_, i) => i !== index),
    }));
  };

  const validate = (): string | null => {
    if (!partAData.woTitle.trim()) return "Please enter a Job Title.";
    if (!partAData.componentId) return "Please select a Component.";
    if (!partAData.briefWorkDescription.trim()) return "Please enter a Brief Work Description.";
    if (!executionData.riskAssessment) return "Please select a Risk Assessment value in Part B (B1).";
    if (!executionData.safetyChecklists) return "Please select a Safety Checklists value in Part B (B1).";
    if (!executionData.operationalForms) return "Please select an Operational Forms value in Part B (B1).";
    if (!executionData.startDateTime || !executionData.startDateTime.includes("T") || executionData.startDateTime.split("T")[0] === "")
      return "Please enter a Start Date in Part B (B2).";
    if (!executionData.startDateTime.split("T")[1]?.substring(0, 5))
      return "Please enter a Start Time in Part B (B2).";
    if (!executionData.completionDateTime || !executionData.completionDateTime.includes("T") || executionData.completionDateTime.split("T")[0] === "")
      return "Please enter a Completion Date in Part B (B2).";
    if (!executionData.completionDateTime.split("T")[1]?.substring(0, 5))
      return "Please enter a Completion Time in Part B (B2).";
    if (!executionData.performedBy) return "Please select Performed By in Part B (B2).";
    if (!executionData.noOfPersons || isNaN(parseInt(executionData.noOfPersons)) || parseInt(executionData.noOfPersons) < 1)
      return "Please enter a valid number of persons in Part B (B2).";
    if (!executionData.workCarriedOut.trim()) return "Please enter Work Carried Out in Part B (B2).";
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      toast({ title: "Validation Error", description: error, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const woPayload: Record<string, any> = {
        vesselId,
        component: partAData.componentName,
        componentCode: partAData.componentCode,
        jobTitle: partAData.woTitle,
        workOrderType: "Unplanned",
        maintenanceType: partAData.taskType || "Unplanned Maintenance",
        assignedTo: partAData.assignedTo || "Chief Engineer",
        approver: partAData.approver || "",
        jobCategory: partAData.jobCategory || "",
        jobPriority: partAData.jobPriority || "Medium",
        classRelated: partAData.classRelated || "No",
        department: partAData.department || "",
        criticality: partAData.criticality || "",
        status: "Pending Approval",
        briefWorkDescription: partAData.briefWorkDescription,
        dataScope: "vessel",
        maintenanceBasis: "Calendar",
        frequencyValue: "",
        frequencyUnit: "",
      };

      const createRes = await apiRequest("POST", "/technical/api/work-orders", woPayload);
      const createdWO = await createRes.json();
      const newWoId = createdWO?.id || createdWO?.workOrderId;

      if (!newWoId) {
        throw new Error("Failed to create work order — no ID returned.");
      }

      const execPayload: Record<string, any> = {
        riskAssessment: executionData.riskAssessment || null,
        safetyChecklists: executionData.safetyChecklists || null,
        operationalForms: executionData.operationalForms || null,
        startDateTime: executionData.startDateTime || null,
        completionDateTime: executionData.completionDateTime || null,
        dateOfCompletion: executionData.dateOfCompletion || executionData.completionDateTime?.split("T")[0] || null,
        performedBy: executionData.performedBy || null,
        noOfPersons: executionData.noOfPersons || null,
        totalTimeHours: executionData.totalTimeHours || null,
        manhours: executionData.manhours || null,
        workCarriedOut: executionData.workCarriedOut || null,
        jobExperienceNotes: executionData.jobExperienceNotes || null,
        previousReading: executionData.previousReading || null,
        currentReading: executionData.currentReading || null,
        consumedSpareParts: executionData.consumedSpareParts.filter(
          (s) => s.description.trim() || s.partNo.trim()
        ),
        status: "Pending Approval",
      };

      await apiRequest("PATCH", `/technical/api/work-orders/${newWoId}`, execPayload);

      sessionStorage.setItem("workOrdersActiveTab", "Pending Approval");

      toast({
        title: "Work Order Created",
        description: "Unplanned work order submitted for approval.",
      });

      setLocation("/pms/work-orders");
    } catch (err: any) {
      console.error("[UNPLANNED_WO_PAGE] Error:", err);
      toast({
        title: "Error",
        description: err?.message || "Failed to create work order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setActiveSection(sectionId as "part-a" | "part-b");
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/pms/work-orders")}
            data-testid="button-back-unplanned-wo"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-base font-semibold text-gray-900">
            Work Order Form — Unplanned Maintenance
          </h1>
        </div>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-medium px-6"
          data-testid="button-submit-unplanned-wo"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting…
            </>
          ) : (
            "Submit for Approval"
          )}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar Navigation */}
        <div className="w-20 shrink-0 bg-gray-50 border-r border-gray-200 p-4">
          <nav className="space-y-6">
            <button
              className="flex flex-col items-center gap-2 cursor-pointer w-full"
              onClick={() => scrollToSection("part-a")}
              data-testid="nav-step-part-a"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                  activeSection === "part-a"
                    ? "bg-[hsl(var(--primary))] text-white"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                }`}
              >
                A
              </div>
              <span className="text-xs text-center text-gray-500 max-w-[60px] leading-tight">
                Job Details
              </span>
            </button>
            <button
              className="flex flex-col items-center gap-2 cursor-pointer w-full"
              onClick={() => scrollToSection("part-b")}
              data-testid="nav-step-part-b"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                  activeSection === "part-b"
                    ? "bg-[hsl(var(--primary))] text-white"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                }`}
              >
                B
              </div>
              <span className="text-xs text-center text-gray-500 max-w-[60px] leading-tight">
                Work Completion
              </span>
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6 space-y-0">
          {/* ─── PART A ─────────────────────────────────────────────────────────── */}
          <div id="part-a">
            <PartHeader
              id="part-a-header"
              label="Part A"
              title="Job Details"
              description="Work details about this work order"
            />
          </div>

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
                  <Label className="text-sm text-[#8798ad]">
                    Job Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={partAData.woTitle}
                    onChange={(e) => handlePartAChange("woTitle", e.target.value)}
                    className="text-sm"
                    placeholder="Enter job title"
                    data-testid="input-job-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">
                    Component <span className="text-red-500">*</span>
                  </Label>
                  <Select value={partAData.componentId} onValueChange={handleComponentSelect}>
                    <SelectTrigger className="text-sm" data-testid="select-component">
                      <SelectValue
                        placeholder={componentsLoading ? "Loading…" : "Select component"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {components.map((component) => (
                        <SelectItem key={component.id} value={component.id}>
                          {component.componentCode} — {component.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Component Code</Label>
                  <Input
                    value={partAData.componentCode}
                    className="text-sm bg-gray-50"
                    disabled
                    data-testid="input-component-code"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Task Type</Label>
                  <Select
                    value={partAData.taskType}
                    onValueChange={(v) => handlePartAChange("taskType", v)}
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
                    value={partAData.assignedTo}
                    onValueChange={(v) => handlePartAChange("assignedTo", v)}
                  >
                    <SelectTrigger className="text-sm" data-testid="select-assigned-to">
                      <SelectValue placeholder="Select rank" />
                    </SelectTrigger>
                    <SelectContent>
                      {ranks.map((rank) => (
                        <SelectItem key={rank} value={rank}>
                          {rank}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Approver (Rank)</Label>
                  <Select
                    value={partAData.approver}
                    onValueChange={(v) => handlePartAChange("approver", v)}
                  >
                    <SelectTrigger className="text-sm" data-testid="select-approver">
                      <SelectValue placeholder="Select rank" />
                    </SelectTrigger>
                    <SelectContent>
                      {ranks.map((rank) => (
                        <SelectItem key={rank} value={rank}>
                          {rank}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Job Priority</Label>
                  <Select
                    value={partAData.jobPriority}
                    onValueChange={(v) => handlePartAChange("jobPriority", v)}
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
                    value={partAData.jobCategory}
                    onValueChange={(v) => handlePartAChange("jobCategory", v)}
                  >
                    <SelectTrigger className="text-sm" data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Class Related</Label>
                  <Select
                    value={partAData.classRelated}
                    onValueChange={(v) => handlePartAChange("classRelated", v)}
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
                    value={partAData.department}
                    onValueChange={(v) => handlePartAChange("department", v)}
                  >
                    <SelectTrigger className="text-sm" data-testid="select-department">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-[#8798ad]">Criticality</Label>
                  <Select
                    value={partAData.criticality}
                    onValueChange={(v) => handlePartAChange("criticality", v)}
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
                    value={partAData.isActive}
                    onValueChange={(v) => handlePartAChange("isActive", v)}
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
                <Label className="text-sm text-[#8798ad]">
                  Brief Work Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={partAData.briefWorkDescription}
                  onChange={(e) => handlePartAChange("briefWorkDescription", e.target.value)}
                  className="text-sm min-h-[80px]"
                  placeholder="Describe the work to be performed"
                  data-testid="input-description"
                />
              </div>
            </div>
          </SectionBlock>

          {/* ─── PART B ─────────────────────────────────────────────────────────── */}
          <div id="part-b" className="mt-2">
            <PartHeader
              id="part-b-header"
              label="Part B"
              title="Work Completion Record"
              description="Enter work completion details here including Risk assessment, checklists, comments etc."
            />
          </div>

          {/* B1. Risk Assessment, Checklists & Records */}
          <SectionBlock id="completion" number="B1" title="Risk Assessment, Checklists & Records">
            <div className="space-y-4">
              {/* B1.1 Risk Assessment */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100" data-testid="b1-risk-assessment-row">
                <Label className="text-sm text-gray-700">
                  B1.1 Risk Assessment Completed / Reviewed: <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-4">
                  {(["Yes", "No", "NA"] as const).map((opt) => (
                    <label key={opt} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="riskAssessment"
                        value={opt}
                        checked={executionData.riskAssessment === opt}
                        onChange={(e) => handleExecutionChange("riskAssessment", e.target.value)}
                        className="text-blue-600"
                        data-testid={`radio-risk-assessment-${opt.toLowerCase()}`}
                      />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* B1.2 Safety Checklists */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100" data-testid="b1-safety-checklists-row">
                <Label className="text-sm text-gray-700">
                  B1.2 Safety Checklists Completed (As applicable): <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-4">
                  {(["Yes", "No", "NA"] as const).map((opt) => (
                    <label key={opt} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="safetyChecklists"
                        value={opt}
                        checked={executionData.safetyChecklists === opt}
                        onChange={(e) => handleExecutionChange("safetyChecklists", e.target.value)}
                        className="text-blue-600"
                        data-testid={`radio-safety-checklists-${opt.toLowerCase()}`}
                      />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* B1.3 Operational Forms */}
              <div className="flex items-center justify-between py-3" data-testid="b1-operational-forms-row">
                <Label className="text-sm text-gray-700">
                  B1.3 Operational Forms / Permits Completed (As applicable): <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-4">
                  {(["Yes", "No", "NA"] as const).map((opt) => (
                    <label key={opt} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="operationalForms"
                        value={opt}
                        checked={executionData.operationalForms === opt}
                        onChange={(e) => handleExecutionChange("operationalForms", e.target.value)}
                        className="text-blue-600"
                        data-testid={`radio-operational-forms-${opt.toLowerCase()}`}
                      />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </SectionBlock>

          {/* B2. Details of Work Carried Out */}
          <SectionBlock id="work-details" number="B2" title="Details of Work Carried Out">
            <div className="space-y-6">
              {/* B2.1 Work Duration */}
              <div data-testid="b2-work-duration">
                <h4 className="text-sm font-medium text-gray-700 mb-4">B2.1 Work Duration:</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]">
                      Start Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={
                        executionData.startDateTime ? executionData.startDateTime.split("T")[0] : ""
                      }
                      onChange={(e) => {
                        const currentTime = executionData.startDateTime
                          ? executionData.startDateTime.split("T")[1] || ""
                          : "";
                        handleExecutionChange(
                          "startDateTime",
                          currentTime ? `${e.target.value}T${currentTime}` : e.target.value
                        );
                      }}
                      className="text-sm"
                      data-testid="input-start-date"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]">
                      Start Time <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="time"
                      value={
                        executionData.startDateTime
                          ? executionData.startDateTime.split("T")[1]?.substring(0, 5) || ""
                          : ""
                      }
                      onChange={(e) => {
                        const currentDate = executionData.startDateTime
                          ? executionData.startDateTime.split("T")[0]
                          : "";
                        handleExecutionChange(
                          "startDateTime",
                          currentDate ? `${currentDate}T${e.target.value}` : e.target.value
                        );
                      }}
                      className="text-sm"
                      data-testid="input-start-time"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]">
                      Completion Date <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={
                          executionData.completionDateTime
                            ? executionData.completionDateTime.split("T")[0]
                            : executionData.dateOfCompletion || ""
                        }
                        onChange={(e) => {
                          const currentTime = executionData.completionDateTime
                            ? executionData.completionDateTime.split("T")[1] || ""
                            : "";
                          handleExecutionChange(
                            "completionDateTime",
                            currentTime ? `${e.target.value}T${currentTime}` : e.target.value
                          );
                          handleExecutionChange("dateOfCompletion", e.target.value);
                        }}
                        className="text-sm flex-1"
                        data-testid="input-completion-date"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const startDate = executionData.startDateTime
                            ? executionData.startDateTime.split("T")[0]
                            : "";
                          if (startDate) {
                            const currentTime = executionData.completionDateTime
                              ? executionData.completionDateTime.split("T")[1] || ""
                              : "";
                            handleExecutionChange(
                              "completionDateTime",
                              currentTime ? `${startDate}T${currentTime}` : startDate
                            );
                            handleExecutionChange("dateOfCompletion", startDate);
                          }
                        }}
                        className="text-xs whitespace-nowrap"
                        title="Same as Start Date"
                        data-testid="button-copy-start-date"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Same as Start
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]">
                      Completion Time <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="time"
                      value={
                        executionData.completionDateTime
                          ? executionData.completionDateTime.split("T")[1]?.substring(0, 5) || ""
                          : ""
                      }
                      onChange={(e) => {
                        const currentDate = executionData.completionDateTime
                          ? executionData.completionDateTime.split("T")[0]
                          : "";
                        handleExecutionChange(
                          "completionDateTime",
                          currentDate ? `${currentDate}T${e.target.value}` : e.target.value
                        );
                      }}
                      className="text-sm"
                      data-testid="input-completion-time"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]">
                      Performed by <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={executionData.performedBy}
                      onValueChange={(v) => handleExecutionChange("performedBy", v)}
                    >
                      <SelectTrigger className="text-sm" data-testid="select-performed-by">
                        <SelectValue placeholder="Select rank" />
                      </SelectTrigger>
                      <SelectContent>
                        {ranks.map((rank) => (
                          <SelectItem key={rank} value={rank}>
                            {rank}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]">
                      No of Persons in the team <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      value={executionData.noOfPersons}
                      onChange={(e) => handleExecutionChange("noOfPersons", e.target.value)}
                      className="text-sm"
                      placeholder="3"
                      min={1}
                      max={50}
                      step={1}
                      data-testid="input-no-of-persons"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]">
                      Total Time Taken (Hours) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      value={executionData.totalTimeHours}
                      readOnly
                      className="text-sm bg-gray-100"
                      placeholder="Auto-calculated"
                      data-testid="input-total-time-hours"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#8798ad]">Manhours</Label>
                    <Input
                      type="number"
                      value={executionData.manhours}
                      readOnly
                      className="text-sm bg-gray-100"
                      placeholder="Auto-calculated"
                      data-testid="input-manhours"
                    />
                  </div>
                </div>
              </div>

              {/* Work Carried Out */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-[#8798ad]">
                    Work Carried Out <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQuickInputs(!showQuickInputs)}
                    className="h-8 px-3 text-xs font-medium border-[#17a2b8] text-[#17a2b8] hover:bg-[#17a2b8]/10"
                    data-testid="button-quick-input"
                  >
                    Quick Input {showQuickInputs ? "▲" : "▼"}
                  </Button>
                </div>

                {showQuickInputs && (
                  <div className="p-3 border border-[#17a2b8]/30 rounded-lg bg-[#f0fbfc]">
                    <p className="text-xs text-gray-600 mb-2">Click to insert common phrases:</p>
                    <div className="flex flex-wrap gap-2">
                      {quickAnswers.map((phrase, i) => (
                        <Button
                          key={i}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => insertQuickText(phrase)}
                          className="h-auto py-1.5 px-3 text-xs font-normal bg-white border-gray-200 text-gray-700 hover:bg-gray-50 whitespace-normal text-left"
                          data-testid={`button-quick-phrase-${i}`}
                        >
                          {phrase}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <Textarea
                  ref={workCarriedOutRef}
                  value={executionData.workCarriedOut}
                  onChange={(e) => handleExecutionChange("workCarriedOut", e.target.value)}
                  maxLength={2000}
                  className="text-sm min-h-[100px]"
                  placeholder="Describe work carried out…"
                  data-testid="textarea-work-carried-out"
                />
                <span className="text-xs text-gray-400 text-right block">
                  {(executionData.workCarriedOut || "").length} / 2000
                </span>
              </div>

              {/* Job Experience / Notes */}
              <div className="space-y-2" data-testid="b2-job-experience">
                <Label className="text-sm text-[#8798ad]">Job Experience / Notes</Label>
                <Textarea
                  value={executionData.jobExperienceNotes}
                  onChange={(e) => handleExecutionChange("jobExperienceNotes", e.target.value)}
                  maxLength={2000}
                  className="text-sm min-h-[80px]"
                  placeholder="Job Experience / Notes"
                  data-testid="textarea-job-experience-notes"
                />
                <span className="text-xs text-gray-400 block">
                  {(executionData.jobExperienceNotes || "").length} / 2000
                </span>
              </div>
            </div>
          </SectionBlock>

          {/* B3. Running Hours */}
          <SectionBlock id="running-hours" number="B3" title="Running Hours">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-[#8798ad]">Previous reading</Label>
                <Input
                  value={executionData.previousReading}
                  className="text-sm bg-gray-50"
                  disabled
                  placeholder="Auto-populated from component"
                  data-testid="input-previous-reading"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-[#8798ad]">Current Reading (hrs)</Label>
                <Input
                  type="number"
                  value={executionData.currentReading}
                  onChange={(e) => handleExecutionChange("currentReading", e.target.value)}
                  className="text-sm"
                  placeholder="Enter current RH"
                  min={0}
                  data-testid="input-current-reading"
                />
              </div>
            </div>
          </SectionBlock>

          {/* B4. Spare Parts Consumed */}
          <SectionBlock id="spare-parts-consumed" number="B4" title="Spare Parts Consumed">
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addConsumedSparePart}
                  data-testid="button-add-spare-part"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Spare Part
                </Button>
              </div>

              {executionData.consumedSpareParts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  No spare parts added. Click "+ Add Spare Part" to record parts consumed.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 font-medium text-gray-700 w-[15%]">Part No</th>
                        <th className="text-left py-2 font-medium text-gray-700 w-[25%]">Description</th>
                        <th className="text-left py-2 font-medium text-gray-700 w-[12%]">Qty Used</th>
                        <th className="text-left py-2 font-medium text-gray-700 w-[20%]">Location</th>
                        <th className="text-left py-2 font-medium text-gray-700 w-[20%]">Comments</th>
                        <th className="w-[8%]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {executionData.consumedSpareParts.map((spare, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="py-2 pr-2">
                            <Input
                              value={spare.partNo}
                              onChange={(e) =>
                                updateConsumedSparePart(index, "partNo", e.target.value)
                              }
                              className="text-sm h-8"
                              placeholder="Part No"
                              data-testid={`input-spare-part-no-${index}`}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <Input
                              value={spare.description}
                              onChange={(e) =>
                                updateConsumedSparePart(index, "description", e.target.value)
                              }
                              className="text-sm h-8"
                              placeholder="Description"
                              data-testid={`input-spare-description-${index}`}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <Input
                              type="number"
                              value={spare.quantityConsumed}
                              onChange={(e) =>
                                updateConsumedSparePart(index, "quantityConsumed", e.target.value)
                              }
                              className="text-sm h-8 w-20"
                              placeholder="0"
                              min={0}
                              data-testid={`input-spare-qty-${index}`}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <Input
                              value={spare.location}
                              onChange={(e) =>
                                updateConsumedSparePart(index, "location", e.target.value)
                              }
                              className="text-sm h-8"
                              placeholder="Location"
                              data-testid={`input-spare-location-${index}`}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <Input
                              value={spare.comments}
                              onChange={(e) =>
                                updateConsumedSparePart(index, "comments", e.target.value)
                              }
                              className="text-sm h-8"
                              placeholder="Comments"
                              data-testid={`input-spare-comments-${index}`}
                            />
                          </td>
                          <td className="py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeConsumedSparePart(index)}
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                              data-testid={`button-remove-spare-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </SectionBlock>

          {/* Submit Button at Bottom */}
          <div className="flex justify-end mt-6 pb-6">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold px-12 py-2.5 h-auto text-sm shadow-md"
              data-testid="button-submit-bottom"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit for Approval"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
