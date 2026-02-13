import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Wrench, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVessel } from "@/contexts/VesselContext";
import { getJobsListQueryKey } from "@/modules/components/api/jobsApiV2";

interface Job {
  id: string;
  juuid: string;
  jobNo: string;
  jobTitle: string;
  componentCode: string;
  componentName: string;
  maintenanceType: string;
  maintenanceBasis: string;
  assignedTo: string;
  department: string;
  status: string;
  nextDueDate: string;
  critical: boolean;
}

const JobsSelector: React.FC = () => {
  const [, setLocation] = useLocation();
  const { vesselId } = useVessel();
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Filter jobs by vesselId at the database level
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: getJobsListQueryKey(vesselId),
    enabled: !!vesselId,
  });

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchQuery || 
      job.jobNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.componentCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.componentName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDepartment = departmentFilter === "all" || job.department === departmentFilter;
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const handleBack = () => {
    setLocation("/pms/modify-pms");
  };

  const handleJobSelect = (job: Job) => {
    setLocation(`/pms/job/${job.juuid}?modify=1`);
  };

  const uniqueDepartments = Array.from(new Set(jobs.map(job => job.department).filter(Boolean)));
  const uniqueStatuses = Array.from(new Set(jobs.map(job => job.status).filter(Boolean)));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="text-gray-600 hover:text-gray-900"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Modify PMS
          </Button>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Select Job to Modify</h1>
        <p className="text-sm text-gray-600">
          Choose a job from the list below. You will be able to make changes and submit them for approval.
        </p>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by job number, title, or component..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-jobs"
          />
        </div>
        
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-department">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {uniqueDepartments.map(dept => (
              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {uniqueStatuses.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="bg-[#52baf3] text-white px-6 py-4 rounded-t-lg">
          <div className="grid grid-cols-7 gap-4 text-sm font-medium">
            <div>Job No</div>
            <div className="col-span-2">Job Title</div>
            <div>Component</div>
            <div>Department</div>
            <div>Status</div>
            <div>Action</div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {isLoading ? (
            <div className="px-6 py-12 text-center text-gray-500">
              Loading jobs...
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              No jobs found matching your criteria.
            </div>
          ) : (
            filteredJobs.map((job) => (
              <div 
                key={job.juuid} 
                className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleJobSelect(job)}
                data-testid={`job-row-${job.juuid}`}
              >
                <div className="grid grid-cols-7 gap-4 items-center text-sm">
                  <div className="text-gray-900 font-medium">
                    {job.jobNo || job.juuid}
                  </div>
                  <div className="col-span-2 text-gray-700">
                    {job.jobTitle}
                    {job.critical && (
                      <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                        Critical
                      </span>
                    )}
                  </div>
                  <div className="text-gray-600 text-xs">
                    <div>{job.componentCode}</div>
                    <div className="text-gray-400">{job.componentName}</div>
                  </div>
                  <div className="text-gray-700">
                    {job.department}
                  </div>
                  <div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      job.status === 'Active' ? 'bg-green-100 text-green-700' :
                      job.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                      job.status === 'Due Soon' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {job.status || 'Active'}
                    </span>
                  </div>
                  <div>
                    <Button
                      size="sm"
                      className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJobSelect(job);
                      }}
                      data-testid={`button-modify-job-${job.juuid}`}
                    >
                      <Wrench className="h-3 w-3 mr-1" />
                      Modify
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500 rounded-b-lg">
          {filteredJobs.length} of {jobs.length} jobs
        </div>
      </div>
    </div>
  );
};

export default JobsSelector;
