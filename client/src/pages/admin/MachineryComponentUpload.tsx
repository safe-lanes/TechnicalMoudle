import { Cog } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";
import { PageMarkers } from "./BulkDataImport";
import { getMachineryComponentFieldMappings } from "@shared/bulkImportTemplateFields";

const FIELD_MAPPINGS = getMachineryComponentFieldMappings();

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
