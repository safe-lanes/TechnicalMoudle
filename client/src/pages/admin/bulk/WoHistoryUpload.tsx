import { History } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { PageMarkers } from "../BulkDataImport";

const FIELD_MAPPINGS = [
  { field: "WO Number",                  required: true,  description: "Unique work order number (e.g. 601.001.WO-2024-01)" },
  { field: "Component Code",             required: true,  description: "Equipment component code (must exist in vessel register)" },
  { field: "Job Title",                  required: true,  description: "Title of the maintenance job performed" },
  { field: "Maintenance Type",           required: true,  description: "Type of maintenance: Planned, Unplanned, Condition-Based" },
  { field: "Date Completed",             required: true,  description: "Date work was completed (DD-MMM-YYYY, e.g. 15-NOV-2024)" },
  { field: "Performed By",               required: true,  description: "Name or rank of person who performed the work" },
  { field: "WO Description",             required: false, description: "Detailed description of the work carried out" },
  { field: "Duration Hours",             required: false, description: "Time taken to complete the work (in hours)" },
  { field: "Running Hours at Completion",required: false, description: "Component running hours when work was completed" },
  { field: "Remarks",                    required: false, description: "Any observations, findings, or follow-up notes" },
  { field: "Next Due Date",              required: false, description: "Next scheduled maintenance date (DD-MMM-YYYY)" },
  { field: "Spare Parts Used",           required: false, description: "List of spare parts used (comma-separated part codes)" },
];

const HISTORY_TYPES = [
  { value: 'work-order', label: 'Work Order' },
  { value: 'spares',     label: 'Spares' },
  { value: 'stores',     label: 'Stores' },
];

interface WoHistoryUploadProps {
  vesselId: string;
  markers?: PageMarkers;
}

export default function WoHistoryUpload({ vesselId, markers }: WoHistoryUploadProps) {
  return (
    <UniformBulkUpload
      title="WO History Import"
      description="Upload historical work order records. Imported entries are stored as Completed work orders."
      icon={History}
      templateType="wo-history"
      templateFileName="wo_history_template.xlsx"
      fieldMappings={FIELD_MAPPINGS}
      vesselId={vesselId}
      previewColumns={["WO Number", "Component Code", "Job Title"]}
      historySubTypes={HISTORY_TYPES}
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
