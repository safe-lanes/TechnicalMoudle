import { Wrench } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";
import { useVessel } from "@/contexts/VesselContext";

const FIELD_MAPPINGS = [
  { field: "Vessel Code", required: true, description: "Vessel code (e.g., V001)" },
  { field: "Component Code", required: true, description: "Must match existing component SFI code" },
  { field: "Component Name", required: false, description: "Component name (auto-populated from component code)" },
  { field: "Job Code", required: false, description: "Auto-generated as JOB-XXXXXXX" },
  { field: "Job Category", required: false, description: "Category of the job" },
  { field: "Maintenance Task", required: true, description: "Job title/maintenance task description" },
  { field: "Maintenance Basis", required: true, description: "Calendar, Running Hours, or Condition Based" },
  { field: "Interval Value", required: false, description: "Required for Calendar jobs (e.g., 6, 12)" },
  { field: "Unit", required: false, description: "Required for Calendar only (Days, Weeks, Months, Years)" },
  { field: "Interval Running Hours", required: false, description: "Required for Running Hours jobs" },
  { field: "Task Type", required: true, description: "Inspection, Overhaul, Service, Testing, etc." },
  { field: "Brief Work Description", required: false, description: "Detailed description of work to be done" },
  { field: "Required Spare Parts", required: false, description: "Semicolon-separated list of spare parts" },
  { field: "Required Tools", required: false, description: "Semicolon-separated list of tools" },
  { field: "PPE Requirements", required: false, description: "Semicolon-separated list of PPE" },
  { field: "Permit Requirements", required: false, description: "Semicolon-separated list of permits" },
  { field: "Other Safety Requirements", required: false, description: "Semicolon-separated list" },
  { field: "Job Priority", required: false, description: "Low, Medium, High, or Critical" },
  { field: "Assigned To", required: false, description: "Person/rank responsible for the job" },
  { field: "Approver", required: false, description: "Approval authority" },
  { field: "Last Done Date", required: false, description: "Date last completed (DD-MMM-YYYY)" },
  { field: "Last Done RH", required: false, description: "Running hours when last done" },
  { field: "Department", required: false, description: "Department responsible" },
  { field: "Class Related", required: false, description: "Yes or No" },
  { field: "Critical Yes/No", required: false, description: "Yes or No" },
  { field: "Is Active", required: false, description: "Yes or No - defaults to Yes" },
];

export default function FleetJobsUpload() {
  const { vesselId } = useVessel();
  
  const handleRefreshData = () => {
    // Invalidate all jobs queries (matching any vesselId parameter)
    queryClient.invalidateQueries({ predicate: (query) => 
      typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/technical/api/jobs')
    });
  };

  return (
    <UniformBulkUpload
      title="Fleet Jobs Bulk Upload"
      description="Upload jobs via Excel. Download template to get dropdown of all system components. Job codes auto-generated as JOB-XXXXXXX."
      icon={Wrench}
      templateType="jobs"
      templateFileName="fleet_jobs_template.xlsx"
      fieldMappings={FIELD_MAPPINGS}
      vesselId={vesselId}
      previewColumns={["Vessel Code", "Component Code", "Maintenance Task"]}
      onRefreshData={handleRefreshData}
    />
  );
}
