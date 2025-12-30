import { Cog } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";

const MACHINERY_MARKERS = {
  header: "I1.A12",
  description: "I1.A13",
  downloadTemplate: "I1.A14",
  tabUpload: "I1.A15",
  tabMapping: "I1.A16",
  tabHistory: "I1.A17",
  importModeSection: "I1.A18",
  importModeLabel: "I1.A19",
  radioAddOnly: "I1.A20",
  radioUpdateOnly: "I1.A21",
  radioUpsert: "I1.A22",
  uploadSection: "I1.A23",
  uploadDescription: "I1.A24",
  dropZone: "I1.A25"
};

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
}

export default function MachineryComponentUpload({ vesselId }: MachineryComponentUploadProps) {
  const handleRefreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/components', vesselId] });
    queryClient.invalidateQueries({ queryKey: ['/api/components'] });
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
      markers={MACHINERY_MARKERS}
    />
  );
}
