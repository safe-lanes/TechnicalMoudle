import { Cog } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";
import { PageMarkers } from "./BulkDataImport";

const FIELD_MAPPINGS = [
  { field: "Component Code", required: true, description: "Unique identifier (e.g., 1.1.1)" },
  { field: "Component Name", required: true, description: "Component name" },
  { field: "Component Category", required: true, description: "One of the 8 main categories" },
  { field: "Vessel Code", required: true, description: "Vessel identification code (critical for tracking components)" },
  { field: "Parent Component Code", required: false, description: "Parent component code" },
  { field: "Maker", required: false, description: "Manufacturer name" },
  { field: "Model", required: false, description: "Model number" },
  { field: "Serial No", required: false, description: "Serial number" },
  { field: "Location", required: false, description: "Physical location" },
  { field: "Critical (Yes/No)", required: false, description: "Yes or No" },
  { field: "Condition Based (Yes/No)", required: false, description: "Yes or No" },
  { field: "Running Hours", required: false, description: "Numeric value" },
  { field: "Commissioned Date", required: false, description: "Date component was commissioned" },
  { field: "Class Item", required: false, description: "Yes or No" },
];

interface MachineryComponentUploadProps {
  vesselId: string;
  markers?: PageMarkers;
}

export default function MachineryComponentUpload({ vesselId, markers }: MachineryComponentUploadProps) {
  const handleRefreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['/technical/api/components', vesselId] });
    queryClient.invalidateQueries({ queryKey: ['/technical/api/components'] });
  };

  return (
    <UniformBulkUpload
      title="Machinery Component Upload"
      description="Bulk import machinery components via CSV or Excel files"
      icon={Cog}
      templateType="components"
      templateFileName="components_template.xlsx"
      fieldMappings={FIELD_MAPPINGS}
      vesselId={vesselId}
      previewColumns={["Component Code", "Component Name", "Component Category"]}
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
