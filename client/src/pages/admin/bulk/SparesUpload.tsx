import { Package } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";
import { getSparesFieldMappings } from "@shared/sparesTemplateFields";

const SPARES_MARKERS = {
  header: "I1.6C.12",
  description: "I1.6C.13",
  downloadTemplate: "I1.6C.14",
  tabUpload: "I1.6C.15",
  tabMapping: "I1.6C.16",
  tabHistory: "I1.6C.17",
  importModeSection: "I1.6C.18",
  importModeLabel: "I1.6C.19",
  radioAddOnly: "I1.6C.20",
  radioUpdateOnly: "I1.6C.21",
  radioUpsert: "I1.6C.22",
  uploadSection: "I1.6C.23",
  uploadDescription: "I1.6C.24",
  dropZone: "I1.6C.25"
};

const FIELD_MAPPINGS = getSparesFieldMappings();

interface SparesUploadProps {
  vesselId: string;
}

export default function SparesUpload({ vesselId }: SparesUploadProps) {
  const handleRefreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/spares', vesselId] });
    queryClient.invalidateQueries({ queryKey: ['/api/spares'] });
  };

  return (
    <UniformBulkUpload
      title="Spares Bulk Upload"
      description="Upload spares via Excel. Template includes Component Codes + Names. Part Codes auto-generated as PT-XXXXXX."
      icon={Package}
      templateType="spares"
      templateFileName="spares_template.xlsx"
      fieldMappings={FIELD_MAPPINGS}
      vesselId={vesselId}
      previewColumns={["Part Code", "Part Name", "Component Code"]}
      onRefreshData={handleRefreshData}
      markers={SPARES_MARKERS}
    />
  );
}
