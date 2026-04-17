import { Wrench } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";
import { PageMarkers } from "./BulkDataImport";

const FIELD_MAPPINGS = [
  { field: "Job Code",                   required: false, description: "Auto-generated if not provided" },
  { field: "Fleet Equipment Code",       required: false, description: "Reference to fleet master equipment" },
  { field: "Fleet Equipment Name",       required: false, description: "Fleet equipment description" },
  { field: "WO Title",                   required: true,  description: "Work order title / maintenance task description" },
  { field: "Component Code",             required: true,  description: "Must match existing component SFI code" },
  { field: "Component Name",             required: false, description: "Auto-populated from component code" },
  { field: "Maintenance Basis",          required: true,  description: "Calendar / Running Hours / Condition Based" },
  { field: "Interval Value",             required: false, description: "Numeric interval (e.g., 6, 500) — required when Maintenance Basis is Calendar or Running Hours" },
  { field: "Unit",                       required: false, description: "Days / Weeks / Months / Years / Hours — required when Maintenance Basis is Calendar or Running Hours" },
  { field: "Task Type",                  required: true,  description: "Inspection, Overhaul, Service, Testing, etc." },
  { field: "Assigned To",               required: true,  description: "Person or rank responsible for the job" },
  { field: "Approver",                   required: true,  description: "Approval authority" },
  { field: "Job Priority",               required: true,  description: "Low, Medium, High, or Critical" },
  { field: "Class Related",              required: true,  description: "Yes or No" },
  { field: "Last Done Date",             required: false, description: "Date last completed (DD-MMM-YYYY)" },
  { field: "Brief Work Description",     required: true,  description: "Detailed description of work to be done" },
  { field: "Department",                 required: true,  description: "Engine / Deck / Electrical" },
  { field: "Criticality",               required: true,  description: "Yes or No" },
  { field: "Is Active",                  required: false, description: "Yes or No — defaults to Yes" },
  { field: "Vessel Code",                required: true,  description: "Vessel identification code (e.g., V001)" },
  { field: "Required Spare Parts",       required: false, description: "Format: PartCode1:Qty1, PartCode2:Qty2" },
  { field: "Required Tools",             required: false, description: "Semicolon-separated list of tools" },
  { field: "PPE Requirements",           required: false, description: "Personal protective equipment required" },
  { field: "Permit Requirements",        required: false, description: "Permits required (e.g., Hot Work, Enclosed Space Entry)" },
  { field: "Other Safety Requirements",  required: false, description: "Additional safety requirements" },
];

interface JobUploadProps {
  vesselId: string;
  markers?: PageMarkers;
}

export default function JobUpload({ vesselId, markers }: JobUploadProps) {
  const handleRefreshData = () => {
    // Invalidate all jobs queries (matching any vesselId parameter)
    queryClient.invalidateQueries({ predicate: (query) => 
      typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/technical/api/jobs')
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
      previewColumns={["Component Code", "WO Title", "Maintenance Basis"]}
      onRefreshData={handleRefreshData}
      markers={markers ? {
        header: markers.uploadHeader,
        description: markers.uploadDescription,
        downloadTemplate: markers.downloadTemplate,
        tabUpload: markers.tabUpload,
        tabMapping: markers.tabMapping,
        tabHistory: markers.tabHistory,
        importModeSection: markers.importModeSection,
        importModeLabel: markers.importModeLabel,
        radioAddOnly: markers.radioAddOnly,
        radioUpdateOnly: markers.radioUpdateOnly,
        radioUpsert: markers.radioUpsert,
        uploadSection: markers.uploadSection,
        uploadDescription: markers.uploadDescription2,
        dropZone: markers.dropZone,
      } : undefined}
    />
  );
}
