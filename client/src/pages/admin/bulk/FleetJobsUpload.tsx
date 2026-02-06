import { Wrench } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";

const FIELD_MAPPINGS = [
  { field: "Job Code", required: true, description: "Unique fleet job identifier code" },
  { field: "Fleet Equipment Code", required: true, description: "Fleet equipment code this job belongs to" },
  { field: "Fleet Equipment Name", required: true, description: "Fleet equipment name" },
  { field: "WO Title", required: true, description: "Work order title / maintenance task description" },
  { field: "Task Type", required: true, description: "Inspection, Overhaul, Service, Testing, etc." },
  { field: "Assigned To", required: true, description: "Person/rank responsible for the job" },
  { field: "Approver", required: true, description: "Approval authority" },
  { field: "Job Priority", required: true, description: "Low, Medium, High, or Critical" },
  { field: "Class Related", required: true, description: "Yes or No" },
  { field: "Brief Work Description", required: true, description: "Detailed description of work to be done" },
  { field: "Department", required: true, description: "Department responsible" },
  { field: "Criticality", required: true, description: "Yes or No" },
  { field: "Is Active", required: false, description: "Yes or No - defaults to Yes" },
  { field: "Maintenance Basis", required: false, description: "Calendar, Running Hours, or Condition Based" },
  { field: "Interval Value", required: false, description: "Numeric interval (e.g., 6, 12)" },
  { field: "Unit", required: false, description: "Days, Weeks, Months, Years" },
  { field: "Required Spare Parts", required: false, description: "Semicolon-separated list of spare parts" },
  { field: "Required Tools", required: false, description: "Semicolon-separated list of tools" },
  { field: "PPE Requirements", required: false, description: "PPE required for the job" },
  { field: "Permit Requirements", required: false, description: "Permits required for the job" },
  { field: "Other Safety Requirements", required: false, description: "Additional safety requirements" },
];

export default function FleetJobsUpload() {
  const handleRefreshData = () => {
    queryClient.invalidateQueries({ predicate: (query) => 
      typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/technical/api/fleet-jobs')
    });
  };

  return (
    <UniformBulkUpload
      title="Fleet Jobs Bulk Upload"
      description="Upload fleet-level job master data via Excel. These are template jobs shared across the fleet, distinct from vessel-specific work orders."
      icon={Wrench}
      templateType="fleet-jobs"
      templateFileName="fleet_jobs_template.xlsx"
      fieldMappings={FIELD_MAPPINGS}
      previewColumns={["Job Code", "Fleet Equipment Code", "WO Title"]}
      onRefreshData={handleRefreshData}
    />
  );
}
