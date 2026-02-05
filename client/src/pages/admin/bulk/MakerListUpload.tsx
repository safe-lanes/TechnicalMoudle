import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { Factory } from "lucide-react";
import { useVessel } from "@/contexts/VesselContext";

const FIELD_MAPPINGS = [
  { field: "Maker Code", required: true, description: "Unique identifier for the maker (e.g., MAN, CAT, ABB)" },
  { field: "Maker Name", required: true, description: "Full name of the manufacturer" },
  { field: "Address", required: false, description: "Manufacturer address" },
  { field: "Is Active", required: false, description: "Yes/No - defaults to Yes" },
];

const PREVIEW_COLUMNS = ["Maker Code", "Maker Name", "Address", "Is Active"];

export default function MakerListUpload() {
  const { vesselId } = useVessel();

  return (
    <UniformBulkUpload
      title="Maker List Upload"
      description="Bulk import Maker Details via CSV or Excel files"
      icon={Factory}
      templateType="makers"
      templateFileName="makers-template"
      fieldMappings={FIELD_MAPPINGS}
      vesselId={vesselId}
      previewColumns={PREVIEW_COLUMNS}
      markers={{
        header: "maker-list-upload-header",
        description: "maker-list-upload-description",
        downloadTemplate: "button-download-makers-template",
        tabUpload: "tab-makers-upload",
        tabMapping: "tab-makers-mapping",
        tabHistory: "tab-makers-history",
        importModeSection: "makers-import-mode-section",
        importModeLabel: "makers-import-mode-label",
        radioAddOnly: "makers-radio-add-only",
        radioUpdateOnly: "makers-radio-update-only",
        radioUpsert: "makers-radio-upsert",
        uploadSection: "makers-upload-section",
        uploadDescription: "makers-upload-description",
        dropZone: "makers-drop-zone",
      }}
    />
  );
}
