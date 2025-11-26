import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type WorkOrder, type Component } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Search, Pencil, Trash2, Download, PlayCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import FleetJobForm from "./FleetJobForm";

export default function FleetJobsManagement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<WorkOrder | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<WorkOrder | null>(null);
  
  // On-demand WO generation state
  const [generateWODialogOpen, setGenerateWODialogOpen] = useState(false);
  const [jobForWO, setJobForWO] = useState<WorkOrder | null>(null);
  const [woReason, setWoReason] = useState<'Planning' | 'Breakdown' | 'Other'>('Planning');

  // Fetch fleet jobs
  const { data: jobs, isLoading, error } = useQuery<WorkOrder[]>({
    queryKey: ['/api/fleet/jobs'],
  });

  // Fetch fleet components for equipment filter
  const { data: components } = useQuery<Component[]>({
    queryKey: ['/api/fleet/components'],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/fleet/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fleet/jobs'], exact: false });
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

  // Generate WO on-demand mutation - use raw fetch to preserve JSON error body
  const generateWOMutation = useMutation({
    mutationFn: async ({ jobId, reason }: { jobId: string; reason: 'Planning' | 'Breakdown' | 'Other' }) => {
      const response = await fetch(`/api/jobs/${jobId}/generate-wo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Throw error with the backend message preserved
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
      queryClient.invalidateQueries({ queryKey: ['/api/work-orders'], exact: false });
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

  // Filter jobs based on search query and selected equipment
  const filteredJobs = jobs?.filter((job) => {
    // Equipment filter
    if (selectedEquipment !== "all" && job.fleetEquipmentCode !== selectedEquipment) {
      return false;
    }

    // Search filter
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      job.jobTitle?.toLowerCase().includes(query) ||
      job.fleetJobCode?.toLowerCase().includes(query) ||
      job.fleetEquipmentCode?.toLowerCase().includes(query)
    );
  }) || [];

  const handleAddNew = () => {
    setSelectedJob(null);
    setIsFormOpen(true);
  };

  const handleEdit = (job: WorkOrder) => {
    setSelectedJob(job);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (job: WorkOrder) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (jobToDelete) {
      deleteMutation.mutate(jobToDelete.id);
    }
  };

  const handleGenerateWOClick = (job: WorkOrder) => {
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
      const response = await fetch('/api/fleet/jobs/export');
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

  // Get unique equipment codes for filter
  const equipmentOptions = components?.filter(c => c.fleetEquipmentCode) || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Fleet Jobs Management</h1>
          <p className="text-gray-600 mt-2">Manage fleet-level maintenance jobs and work orders</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle>All Fleet Jobs</CardTitle>
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Equipment Filter */}
                <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                  <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-equipment-filter">
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

                {/* Search Bar */}
                <div className="relative flex-1 sm:min-w-[250px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search jobs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-jobs"
                  />
                </div>

                {/* Action Buttons */}
                <Button
                  variant="outline"
                  onClick={handleExport}
                  data-testid="button-export-jobs"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
                <Button
                  onClick={handleAddNew}
                  className="whitespace-nowrap"
                  data-testid="button-add-job"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Job
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 animate-pulse rounded"></div>
                ))}
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-700">Failed to load jobs</p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {searchQuery || selectedEquipment !== "all"
                    ? "No jobs found matching your filters"
                    : "No jobs yet. Add your first job to get started."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Code</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Interval</TableHead>
                      <TableHead>Task Type</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredJobs.map((job) => {
                      const equipment = components?.find(c => c.fleetEquipmentCode === job.fleetEquipmentCode);
                      return (
                        <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                          <TableCell className="font-mono text-sm">{job.fleetJobCode}</TableCell>
                          <TableCell className="font-medium max-w-xs truncate">{job.jobTitle}</TableCell>
                          <TableCell className="text-sm">
                            {equipment ? `${equipment.fleetEquipmentCode} - ${equipment.fleetEquipmentName}` : job.fleetEquipmentCode || "-"}
                          </TableCell>
                          <TableCell>
                            {job.maintenanceIntervalValue && job.maintenanceIntervalUnit
                              ? `${job.maintenanceIntervalValue} ${job.maintenanceIntervalUnit}`
                              : "-"}
                          </TableCell>
                          <TableCell>{job.taskType || "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleGenerateWOClick(job)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                                title="Create Work Order Now"
                                data-testid={`button-generate-wo-${job.id}`}
                              >
                                <PlayCircle className="h-4 w-4 mr-1" />
                                Create WO
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(job)}
                                data-testid={`button-edit-${job.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(job)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                data-testid={`button-delete-${job.id}`}
                              >
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
          </CardContent>
        </Card>
      </div>

      {/* Job Form Dialog */}
      <FleetJobForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        job={selectedJob}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-job">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fleet Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{jobToDelete?.jobTitle}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Generate Work Order Dialog */}
      <Dialog open={generateWODialogOpen} onOpenChange={setGenerateWODialogOpen}>
        <DialogContent data-testid="dialog-generate-wo">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-green-600" />
              Create Work Order Now
            </DialogTitle>
            <DialogDescription>
              Generate a new work order for job "{jobForWO?.jobTitle}" immediately.
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
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="Planning" id="reason-planning" data-testid="radio-planning" />
                  <Label htmlFor="reason-planning" className="flex-1 cursor-pointer">
                    <div className="font-medium">Planning</div>
                    <div className="text-sm text-gray-500">Scheduled or planned maintenance ahead of due date</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value="Breakdown" id="reason-breakdown" data-testid="radio-breakdown" />
                  <Label htmlFor="reason-breakdown" className="flex-1 cursor-pointer">
                    <div className="font-medium">Breakdown</div>
                    <div className="text-sm text-gray-500">Equipment failure requiring immediate repair</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
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
              className="bg-green-600 hover:bg-green-700 text-white"
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
