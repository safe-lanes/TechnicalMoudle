import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type FleetJobs, type FleetComponents } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Search, Pencil, Trash2, Download, PlayCircle, Briefcase, Package, ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import FleetJobForm from "./FleetJobForm";
import { Marker } from "@/components/Marker";
import { SectionBlock } from "@/components/SectionBlock";

export default function FleetJobsManagement({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<FleetJobs | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<FleetJobs | null>(null);
  
  const [generateWODialogOpen, setGenerateWODialogOpen] = useState(false);
  const [jobForWO, setJobForWO] = useState<FleetJobs | null>(null);
  const [woReason, setWoReason] = useState<'Planning' | 'Breakdown' | 'Other'>('Planning');

  const [editingJob, setEditingJob] = useState<FleetJobs | null>(null);
  const [jobFormData, setJobFormData] = useState<Partial<FleetJobs>>({});

  const { data: jobs, isLoading, error } = useQuery<FleetJobs[]>({
    queryKey: ['/technical/api/fleet/jobs'],
  });

  const { data: components } = useQuery<FleetComponents[]>({
    queryKey: ['/technical/api/fleet/components'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/technical/api/fleet/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/jobs'], exact: false });
      toast({
        title: "Success",
        description: "Fleet job deleted successfully",
      });
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete job",
        variant: "destructive",
      });
    },
  });

  const generateWOMutation = useMutation({
    mutationFn: async ({ jobId, reason }: { jobId: number; reason: 'Planning' | 'Breakdown' | 'Other' }) => {
      const response = await fetch(`/technical/api/jobs/${jobId}/generate-wo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const error = new Error(data.error || 'Failed to generate work order');
        (error as any).status = response.status;
        (error as any).isDuplicate = response.status === 409 || 
                                      (data.error && (
                                        data.error.toLowerCase().includes('duplicate') ||
                                        data.error.toLowerCase().includes('already exists') ||
                                        data.error.toLowerCase().includes('pending')
                                      ));
        throw error;
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/work-orders'], exact: false });
      toast({
        title: "Work Order Created",
        description: `Work Order ${data.workOrderNo || data.id || 'N/A'} has been created successfully.`,
      });
      setGenerateWODialogOpen(false);
      setJobForWO(null);
      setWoReason('Planning');
    },
    onError: (error: any) => {
      const isDuplicateError = error?.isDuplicate || 
                               (error?.message && (
                                 error.message.toLowerCase().includes('duplicate') || 
                                 error.message.toLowerCase().includes('already exists') ||
                                 error.message.toLowerCase().includes('pending')
                               ));
      toast({
        title: "Error",
        description: isDuplicateError 
          ? "A pending work order already exists for this job. Please complete or cancel the existing work order first."
          : (error?.message || "Failed to generate work order"),
        variant: "destructive",
      });
    },
  });

  const filteredJobs = jobs?.filter((job) => {
    if (selectedEquipment !== "all" && job.fleetEquipmentCode !== selectedEquipment) {
      return false;
    }

    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      job.woTitle?.toLowerCase().includes(query) ||
      job.jobCode?.toLowerCase().includes(query) ||
      job.fleetEquipmentCode?.toLowerCase().includes(query) ||
      job.fleetEquipmentName?.toLowerCase().includes(query)
    );
  }) || [];

  const updateJobMutation = useMutation({
    mutationFn: async ({ id, data, jobCode }: { id: number; data: Partial<FleetJobs>; jobCode?: string }) => {
      const res = await apiRequest('PATCH', `/technical/api/fleet/jobs/${id}`, data);
      try {
        const json = await res.json();
        return { ...json, _jobCode: jobCode };
      } catch {
        return { affectedCount: 1, _jobCode: jobCode };
      }
    },
    onSuccess: (responseData: any) => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/jobs'], exact: false });
      const count = responseData?.affectedCount || 1;
      const jobCode = responseData?._jobCode || '';
      toast({
        title: "Success",
        description: count > 1
          ? `Updated ${count} records with Job Code ${jobCode}`
          : "Job updated successfully",
      });
      setEditingJob(null);
      setJobFormData({});
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update job",
        variant: "destructive",
      });
    },
  });

  const handleAddNew = () => {
    setSelectedJob(null);
    setIsFormOpen(true);
  };

  const normalizeJobPriority = (val: string | null | undefined): string => {
    if (!val) return '';
    const lower = val.toLowerCase();
    if (lower === 'high') return 'High';
    if (lower === 'medium') return 'Medium';
    if (lower === 'low') return 'Low';
    return val;
  };

  const handleEdit = (job: FleetJobs) => {
    setEditingJob(job);
    setJobFormData({ ...job, jobPriority: normalizeJobPriority(job.jobPriority) });
  };

  const handleCancelEdit = () => {
    setEditingJob(null);
    setJobFormData({});
  };

  useEffect(() => {
    if (jobFormData.maintenanceBasis === 'Running Hours') {
      setJobFormData(prev => ({ ...prev, unit: 'Hours' }));
    }
  }, [jobFormData.maintenanceBasis]);

  const handleSaveEdit = () => {
    if (!editingJob) return;
    const EDITABLE_FIELDS: (keyof FleetJobs)[] = [
      'woTitle', 'jobCode', 'maintenanceBasis', 'intervalValue', 'unit',
      'taskType', 'assignedTo', 'approver', 'jobPriority',
      'classRelated', 'briefWorkDescription', 'department',
      'criticality', 'isActive',
      'ppeRequirements', 'permitRequirements', 'otherSafetyRequirements',
      'requiredSpareParts', 'requiredTools',
    ];
    const changedPayload: Record<string, any> = {};
    for (const field of EDITABLE_FIELDS) {
      const newVal = jobFormData[field];
      const oldVal = editingJob[field];
      if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
        changedPayload[field] = newVal;
      }
    }
    if (Object.keys(changedPayload).length === 0) {
      toast({
        title: "No Changes",
        description: "No fields were modified",
      });
      return;
    }
    updateJobMutation.mutate({
      id: editingJob.id,
      data: changedPayload,
      jobCode: jobFormData.jobCode,
    });
  };

  const handleDeleteClick = (job: FleetJobs) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (jobToDelete) {
      deleteMutation.mutate(jobToDelete.id);
    }
  };

  const handleGenerateWOClick = (job: FleetJobs) => {
    setJobForWO(job);
    setWoReason('Planning');
    setGenerateWODialogOpen(true);
  };

  const handleGenerateWOConfirm = () => {
    if (jobForWO) {
      generateWOMutation.mutate({ jobId: jobForWO.id, reason: woReason });
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/technical/api/fleet/jobs/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fleet-jobs-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Success",
        description: "Jobs exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export jobs",
        variant: "destructive",
      });
    }
  };

  const equipmentOptions = components?.filter(c => c.fleetEquipmentCode) || [];
  const totalJobs = jobs?.length || 0;

  if (editingJob) {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Pencil className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white" data-testid="title-edit-job">Edit Job Details</h1>
              <p className="text-cyan-100 text-sm mt-0.5">
                {jobFormData.woTitle || editingJob.woTitle || "Edit job information"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="bg-white/20 text-white border-white/30"
              variant="outline"
              onClick={handleCancelEdit}
              data-testid="btn-cancel-edit-job"
            >
              Cancel
            </Button>
            <Button
              className="bg-white text-blue-600"
              onClick={handleSaveEdit}
              disabled={updateJobMutation.isPending}
              data-testid="btn-save-job"
            >
              {updateJobMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <SectionBlock
              id="edit-job-info"
              number="A1"
              title="Job Information"
              description="Basic details and configuration for this job"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Job Title</Label>
                    <Input
                      placeholder="Enter job title"
                      value={jobFormData.woTitle || ""}
                      onChange={(e) => setJobFormData(prev => ({ ...prev, woTitle: e.target.value }))}
                      data-testid="input-edit-job-title"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Component Name</Label>
                    <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-edit-component-name">
                      {editingJob.fleetEquipmentName || '-'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Component Code</Label>
                    <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-edit-component-code">
                      {editingJob.fleetEquipmentCode || '-'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Job Code</Label>
                    <Input
                      placeholder="Enter job code"
                      value={jobFormData.jobCode || ""}
                      onChange={(e) => setJobFormData(prev => ({ ...prev, jobCode: e.target.value }))}
                      data-testid="input-edit-job-no"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Maintenance Basis</Label>
                    <Select
                      value={jobFormData.maintenanceBasis || ""}
                      onValueChange={(val) => setJobFormData(prev => ({ ...prev, maintenanceBasis: val }))}
                    >
                      <SelectTrigger data-testid="input-edit-maint-basis">
                        <SelectValue placeholder="Select maintenance basis" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Calendar">Calendar</SelectItem>
                        <SelectItem value="Running Hours">Running Hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Frequency</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Value"
                        type="number"
                        value={jobFormData.intervalValue || ""}
                        onChange={(e) => setJobFormData(prev => ({ ...prev, intervalValue: e.target.value }))}
                        className="flex-1"
                        data-testid="input-edit-interval-value"
                      />
                      {jobFormData.maintenanceBasis === 'Running Hours' ? (
                        <div className="flex-1 text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="input-edit-unit">
                          Hours
                        </div>
                      ) : (
                        <Select
                          value={jobFormData.unit || ""}
                          onValueChange={(val) => setJobFormData(prev => ({ ...prev, unit: val }))}
                        >
                          <SelectTrigger className="flex-1" data-testid="input-edit-unit">
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Months">Months</SelectItem>
                            <SelectItem value="Years">Years</SelectItem>
                            <SelectItem value="Weeks">Weeks</SelectItem>
                            <SelectItem value="Days">Days</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Task Type</Label>
                    <Input
                      placeholder="Enter task type"
                      value={jobFormData.taskType || ""}
                      onChange={(e) => setJobFormData(prev => ({ ...prev, taskType: e.target.value }))}
                      data-testid="input-edit-task-type"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Assigned To (Rank)</Label>
                    <Input
                      placeholder="Enter assigned rank"
                      value={jobFormData.assignedTo || ""}
                      onChange={(e) => setJobFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                      data-testid="input-edit-assigned-to"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Approver (Rank)</Label>
                    <Input
                      placeholder="Enter approver rank"
                      value={jobFormData.approver || ""}
                      onChange={(e) => setJobFormData(prev => ({ ...prev, approver: e.target.value }))}
                      data-testid="input-edit-approver"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Job Priority</Label>
                    <Select
                      value={jobFormData.jobPriority || ""}
                      onValueChange={(val) => setJobFormData(prev => ({ ...prev, jobPriority: val }))}
                    >
                      <SelectTrigger data-testid="input-edit-priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Class Related</Label>
                    <Select
                      value={jobFormData.classRelated || ""}
                      onValueChange={(val) => setJobFormData(prev => ({ ...prev, classRelated: val }))}
                    >
                      <SelectTrigger data-testid="input-edit-class-related">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Interval Running Hour</Label>
                    <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-edit-interval-rh">
                      -
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Department</Label>
                    <Input
                      placeholder="Enter department"
                      value={jobFormData.department || ""}
                      onChange={(e) => setJobFormData(prev => ({ ...prev, department: e.target.value }))}
                      data-testid="input-edit-department"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Criticality</Label>
                    <Select
                      value={jobFormData.criticality || ""}
                      onValueChange={(val) => setJobFormData(prev => ({ ...prev, criticality: val }))}
                    >
                      <SelectTrigger data-testid="input-edit-criticality">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-[#8798ad]">Is Active</Label>
                    <Select
                      value={jobFormData.isActive === true ? "Yes" : jobFormData.isActive === false ? "No" : ""}
                      onValueChange={(val) => setJobFormData(prev => ({ ...prev, isActive: val === "Yes" }))}
                    >
                      <SelectTrigger data-testid="input-edit-is-active">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Brief Work Description</Label>
                  <Input
                    placeholder="Enter brief work description"
                    value={jobFormData.briefWorkDescription || ""}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, briefWorkDescription: e.target.value }))}
                    data-testid="input-edit-job-desc"
                  />
                </div>
              </div>
            </SectionBlock>

            <SectionBlock
              id="edit-spare-parts"
              number="A2"
              title="Required Spare Parts"
              description="Spare parts needed for this job"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700 w-[20%]">PART NO.</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[40%]">DESCRIPTION</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]">QTY REQUIRED</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[10%]">ROB</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]">STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(jobFormData.requiredSpareParts) && (jobFormData.requiredSpareParts as any[]).length > 0) ? (
                      (jobFormData.requiredSpareParts as any[]).map((part: any, index: number) => {
                        const partNo = part.partNo || part.partNumber || part.code || '-';
                        const desc = part.description || part.name || part.partName || '-';
                        const qty = part.qty || part.quantity || part.qtyRequired || '-';
                        const rob = part.rob || '-';
                        const status = part.status || '-';
                        return (
                          <tr key={index} className="border-b border-gray-200">
                            <td className="p-2 font-mono text-xs" data-testid={`edit-spare-partno-${index}`}>{partNo}</td>
                            <td className="p-2" data-testid={`edit-spare-desc-${index}`}>{desc}</td>
                            <td className="p-2" data-testid={`edit-spare-qty-${index}`}>{qty}</td>
                            <td className="p-2" data-testid={`edit-spare-rob-${index}`}>{rob}</td>
                            <td className="p-2" data-testid={`edit-spare-status-${index}`}>{status}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center p-4 text-gray-500 italic">
                          No spare parts linked to this job
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionBlock>

            <SectionBlock
              id="edit-tools"
              number="A3"
              title="Required Tools & Equipment"
              description="Tools and equipment needed for this job"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700 w-[50%]">DESCRIPTION</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]">QTY REQUIRED</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[10%]">ROB</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]">STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(jobFormData.requiredTools) && (jobFormData.requiredTools as any[]).length > 0) ? (
                      (jobFormData.requiredTools as any[]).map((tool: any, index: number) => (
                        <tr key={index} className="border-b border-gray-200">
                          <td className="p-2" data-testid={`edit-tool-desc-${index}`}>{tool.description || tool.name || '-'}</td>
                          <td className="p-2" data-testid={`edit-tool-qty-${index}`}>{tool.qty || tool.quantity || '-'}</td>
                          <td className="p-2" data-testid={`edit-tool-rob-${index}`}>{tool.rob || '-'}</td>
                          <td className="p-2" data-testid={`edit-tool-status-${index}`}>{tool.status || '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="text-center p-4 text-gray-500 italic">
                          No tools linked to this job
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionBlock>

            <SectionBlock
              id="edit-safety"
              number="A4"
              title="Safety Requirements"
              description="Safety requirements and permits for this job"
            >
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Personal Protective Equipment (PPE):</Label>
                  <Input
                    placeholder="Enter PPE requirements (comma-separated)"
                    value={jobFormData.ppeRequirements || ""}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, ppeRequirements: e.target.value }))}
                    className="mt-1"
                    data-testid="input-edit-ppe"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Permits Required:</Label>
                  <Input
                    placeholder="Enter permit requirements (comma-separated)"
                    value={jobFormData.permitRequirements || ""}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, permitRequirements: e.target.value }))}
                    className="mt-1"
                    data-testid="input-edit-permits"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Other Safety Requirements:</Label>
                  <Input
                    placeholder="Enter other safety requirements (comma-separated)"
                    value={jobFormData.otherSafetyRequirements || ""}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, otherSafetyRequirements: e.target.value }))}
                    className="mt-1"
                    data-testid="input-edit-other-safety"
                  />
                </div>
              </div>
            </SectionBlock>

            <SectionBlock
              id="edit-vessel-mapping"
              number="A5"
              title="Job Mapped Vessel Details"
              description="Vessel mapping information related to this job"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700 w-[40%]">VESSEL CODE</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[60%]">VESSEL NAME</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={2} className="text-center p-4 text-gray-500 italic">
                        No vessels mapped to this job
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </SectionBlock>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Fleet Jobs Management</h1>
                <p className="text-cyan-100 text-sm mt-0.5" data-testid="I4.QL.4.9"><Marker id="I4.QL.4.9" />Manage fleet-level maintenance jobs and work orders</p>
              </div>
            </div>
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-cyan-100 hover:text-white text-sm transition-colors"
                data-testid="button-back-to-dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-semibold text-gray-800" data-testid="I4.QL.4.10"><Marker id="I4.QL.4.10" />All Fleet Jobs</h2>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-total-jobs">
                  <Package className="h-3 w-3 mr-1" />
                  {totalJobs} Total
                </Badge>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-filtered-jobs">
                  {filteredJobs.length} Shown
                </Badge>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                <SelectTrigger className="w-full sm:w-[200px]" data-testid="I4.QL.4.11">
                  <Marker id="I4.QL.4.11" />
                  <SelectValue placeholder="All Equipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Equipment</SelectItem>
                  {equipmentOptions.map((comp) => (
                    <SelectItem key={comp.id} value={comp.fleetEquipmentCode || ""}>
                      {comp.fleetEquipmentCode} - {comp.fleetEquipmentName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative flex-1 sm:min-w-[250px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search jobs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="I4.QL.4.12"
                />
                <Marker id="I4.QL.4.12" />
              </div>

              <Button
                variant="outline"
                onClick={handleExport}
                className="border-gray-300 text-gray-700"
                data-testid="I4.QL.4.13"
              >
                <Marker id="I4.QL.4.13" />
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button
                onClick={handleAddNew}
                className="bg-cyan-600 whitespace-nowrap"
                data-testid="I4.QL.4.14"
              >
                <Marker id="I4.QL.4.14" />
                <Plus className="mr-2 h-4 w-4" />
                Add New Job
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-md"></div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <Briefcase className="h-10 w-10 text-red-300 mx-auto mb-2" />
              <p className="text-red-700 font-medium">Failed to load jobs</p>
              <p className="text-red-500 text-sm mt-1">Please try refreshing the page</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {searchQuery || selectedEquipment !== "all"
                  ? "No jobs found matching your filters"
                  : "No jobs yet"}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {searchQuery ? "Try adjusting your search terms" : "Add your first job to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-200">
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.4.15"><Marker id="I4.QL.4.15" />Job Code</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.4.16"><Marker id="I4.QL.4.16" />Job Title</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.4.fleet-eq-code">Fleet Equipment Code</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.4.fleet-eq-name">Fleet Equipment Name</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.4.18"><Marker id="I4.QL.4.18" />Interval</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.4.19"><Marker id="I4.QL.4.19" />Task Type</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.4.20"><Marker id="I4.QL.4.20" />Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job, index) => {
                    const isFirstRow = index === 0;
                    return (
                      <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                        <TableCell className="font-mono text-sm" data-testid={isFirstRow ? "I4.QL.4.21" : undefined}>
                          {isFirstRow && <Marker id="I4.QL.4.21" />}
                          {job.jobCode}
                        </TableCell>
                        <TableCell className="font-medium max-w-xs truncate" data-testid={isFirstRow ? "I4.QL.4.22" : undefined}>
                          {isFirstRow && <Marker id="I4.QL.4.22" />}
                          {job.woTitle}
                        </TableCell>
                        <TableCell className="font-mono text-sm" data-testid={isFirstRow ? "I4.QL.4.23" : undefined}>
                          {isFirstRow && <Marker id="I4.QL.4.23" />}
                          {job.fleetEquipmentCode || "-"}
                        </TableCell>
                        <TableCell className="text-sm" data-testid={isFirstRow ? "I4.QL.4.fleet-eq-name-val" : undefined}>
                          {job.fleetEquipmentName || "-"}
                        </TableCell>
                        <TableCell data-testid={isFirstRow ? "I4.QL.4.24" : undefined}>
                          {isFirstRow && <Marker id="I4.QL.4.24" />}
                          {job.intervalValue && job.unit
                            ? `${job.intervalValue} ${job.unit}`
                            : "-"}
                        </TableCell>
                        <TableCell data-testid={isFirstRow ? "I4.QL.4.25" : undefined}>
                          {isFirstRow && <Marker id="I4.QL.4.25" />}
                          <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate" data-testid={isFirstRow ? "badge-task-type" : undefined}>
                            {job.taskType || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGenerateWOClick(job)}
                              className="text-green-600 border-green-200"
                              title="Create Work Order Now"
                              data-testid={isFirstRow ? "I4.QL.4.26" : `button-generate-wo-${job.id}`}
                            >
                              {isFirstRow && <Marker id="I4.QL.4.26" />}
                              <PlayCircle className="h-4 w-4 mr-1" />
                              Create WO
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(job)}
                              data-testid={isFirstRow ? "I4.QL.4.27" : `button-edit-${job.id}`}
                            >
                              {isFirstRow && <Marker id="I4.QL.4.27" />}
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(job)}
                              className="text-red-600"
                              data-testid={isFirstRow ? "I4.QL.4.28" : `button-delete-${job.id}`}
                            >
                              {isFirstRow && <Marker id="I4.QL.4.28" />}
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>

      <FleetJobForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        job={selectedJob as any}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-job">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Delete Fleet Job</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Are you sure you want to delete "<span className="font-medium text-gray-800">{jobToDelete?.woTitle}</span>"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={generateWODialogOpen} onOpenChange={setGenerateWODialogOpen}>
        <DialogContent data-testid="dialog-generate-wo">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-green-600" />
              Create Work Order Now
            </DialogTitle>
            <DialogDescription>
              Generate a new work order for job "{jobForWO?.woTitle}" immediately.
              This will create an on-demand work order outside the normal schedule.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Reason for On-Demand Work Order *</Label>
              <RadioGroup
                value={woReason}
                onValueChange={(value) => setWoReason(value as 'Planning' | 'Breakdown' | 'Other')}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem value="Planning" id="reason-planning" data-testid="radio-planning" />
                  <Label htmlFor="reason-planning" className="flex-1 cursor-pointer">
                    <div className="font-medium">Planning</div>
                    <div className="text-sm text-gray-500">Scheduled or planned maintenance ahead of due date</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem value="Breakdown" id="reason-breakdown" data-testid="radio-breakdown" />
                  <Label htmlFor="reason-breakdown" className="flex-1 cursor-pointer">
                    <div className="font-medium">Breakdown</div>
                    <div className="text-sm text-gray-500">Equipment failure requiring immediate repair</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem value="Other" id="reason-other" data-testid="radio-other" />
                  <Label htmlFor="reason-other" className="flex-1 cursor-pointer">
                    <div className="font-medium">Other</div>
                    <div className="text-sm text-gray-500">Other reason (will be documented in work order)</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> The work order will be created with today's date as the due date.
                If a pending work order already exists for this job, creation will be blocked.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateWODialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateWOConfirm}
              disabled={generateWOMutation.isPending}
              className="bg-green-600 text-white"
              data-testid="button-confirm-generate-wo"
            >
              {generateWOMutation.isPending ? "Creating..." : "Create Work Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
