import { Package } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";
import { useVessel } from "@/contexts/VesselContext";
import { getSparesFieldMappings } from "@shared/sparesTemplateFields";

const FIELD_MAPPINGS = getSparesFieldMappings();

export default function FleetSparesUpload() {
  const { vesselId } = useVessel();
  
  const handleRefreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/spares', vesselId] });
    queryClient.invalidateQueries({ queryKey: ['/api/spares'] });
  };

  return (
    <UniformBulkUpload
      title="Fleet Spares Bulk Upload"
      description="Upload spares via Excel. Template includes Component Codes + Names. Part Codes auto-generated as PT-XXXXXX."
      icon={Package}
      templateType="spares"
      templateFileName="fleet_spares_template.xlsx"
      fieldMappings={FIELD_MAPPINGS}
      vesselId={vesselId}
      previewColumns={["Part Code", "Part Name", "Component Code"]}
      onRefreshData={handleRefreshData}
    />
  );
}
