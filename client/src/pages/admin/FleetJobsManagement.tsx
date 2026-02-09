import { useState } from "react";
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
import { Plus, Search, Pencil, Trash2, Download, PlayCircle, Briefcase, Package } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import FleetJobForm from "./FleetJobForm";
import { Marker } from "@/components/Marker";

export default function FleetJobsManagement() {
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

  const handleAddNew = () => {
    setSelectedJob(null);
    setIsFormOpen(true);
  };

  const handleEdit = (job: FleetJobs) => {
    setSelectedJob(job);
    setIsFormOpen(true);
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

  return (
    <div className="p-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-white/20 rounded-lg">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Fleet Jobs Management</h1>
              <p className="text-cyan-100 text-sm mt-0.5" data-testid="I4.QL.4.9"><Marker id="I4.QL.4.9" />Manage fleet-level maintenance jobs and work orders</p>
            </div>
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
