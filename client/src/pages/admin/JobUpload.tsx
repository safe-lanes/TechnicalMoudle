import { Wrench } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";

const FIELD_MAPPINGS = [
  { field: "Vessel Code", required: true, description: "Vessel code (e.g., V001)" },
  { field: "Component Code", required: true, description: "Must match existing component SFI code" },
  { field: "Component Name", required: false, description: "Component name (auto-populated from component code)" },
  { field: "Job Code", required: false, description: "Auto-generated as JOB-XXXXXXX" },
  { field: "Job Category", required: false, description: "Category of the job" },
  { field: "Maintenance Task", required: true, description: "Job title/maintenance task description" },
  { field: "Maintenance Basis", required: true, description: "Calendar, Running Hours, or Condition Based" },
  { field: "Frequency Value", required: false, description: "Required for Calendar/Running Hours (e.g., 6, 500)" },
  { field: "Frequency Unit", required: false, description: "Required for Calendar only (Days, Weeks, Months, Years)" },
  { field: "Task Type", required: true, description: "Inspection, Overhaul, Service, Testing, etc." },
  { field: "Brief Job Description", required: false, description: "Detailed description of work to be done" },
  { field: "Required Spare Parts", required: false, description: "Comma-separated list of spare part codes" },
  { field: "Required Tools", required: false, description: "Comma-separated list of tool names" },
  { field: "Required Safety Items", required: false, description: "Comma-separated list of safety requirements" },
  { field: "Job Priority", required: false, description: "Low, Medium, High, or Critical" },
  { field: "Planned Duration", required: false, description: "Estimated duration in hours" },
  { field: "Last Done Date", required: false, description: "Date last completed (DD/MM/YYYY)" },
  { field: "Initial Next Due", required: false, description: "Next due date (DD/MM/YYYY)" },
  { field: "Person In Charge", required: false, description: "Person responsible for the job" },
  { field: "Responsible Department", required: false, description: "Department responsible" },
  { field: "Dept Code", required: false, description: "Department code" },
  { field: "Class Related", required: false, description: "Yes or No" },
  { field: "Critical", required: false, description: "Yes or No" },
];

interface JobUploadProps {
  vesselId: string;
}

export default function JobUpload({ vesselId }: JobUploadProps) {
  const handleRefreshData = () => {
    // Invalidate all jobs queries (matching any vesselId parameter)
    queryClient.invalidateQueries({ predicate: (query) => 
      typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/api/jobs')
    });
  };

  return (
    <UniformBulkUpload
      title="Jobs Bulk Upload"
      description="Upload jobs via Excel. Download template to get dropdown of all system components. Job codes auto-generated as JOB-XXXXXXX."
      icon={Wrench}
      templateType="jobs"
      templateFileName="jobs_template.xlsx"
      fieldMappings={FIELD_MAPPINGS}
      vesselId={vesselId}
      previewColumns={["Vessel Code", "Component Code", "Maintenance Task"]}
      onRefreshData={handleRefreshData}
    />
  );
}
