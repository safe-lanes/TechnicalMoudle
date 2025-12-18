import { Package } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";
import { getSparesFieldMappings } from "@shared/sparesTemplateFields";

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
    />
  );
}
