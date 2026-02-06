import { Cog } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";

const FIELD_MAPPINGS = [
  { field: "Parent Fleet Equipment Code", required: false, description: "Parent component code for hierarchy" },
  { field: "Fleet Equipment Code", required: true, description: "Unique code (e.g., 601.002.01) - Required" },
  { field: "Fleet Equipment Name", required: true, description: "Equipment name - Required" },
  { field: "Component Category", required: false, description: "Component category from Master List" },
  { field: "Maker Name", required: false, description: "Manufacturer name" },
  { field: "Maker Code", required: false, description: "Manufacturer code" },
  { field: "Model", required: false, description: "Equipment model" },
  { field: "Model Code", required: false, description: "Model code" },
  { field: "Location", required: false, description: "Installation location" },
  { field: "Rating", required: false, description: "Power/capacity rating" },
  { field: "Eqpt / System Department", required: false, description: "Department responsible" },
  { field: "Notes", required: false, description: "Additional notes" },
  { field: "IS Active", required: false, description: "Yes/No - defaults to Yes" },
];

export default function FleetComponentUpload() {
  const handleRefreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet-admin/fleet-components'] });
    queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet-admin/master-data'] });
  };

  return (
    <UniformBulkUpload
      title="Fleet Component Bulk Upload"
      description="Upload fleet components via Excel. 13-column template with hierarchy support."
      icon={Cog}
      templateType="fleet-components"
      templateFileName="fleet_components_template.xlsx"
      fieldMappings={FIELD_MAPPINGS}
      vesselId=""
      previewColumns={["Fleet Equipment Code", "Fleet Equipment Name", "Parent Fleet Equipment Code"]}
      onRefreshData={handleRefreshData}
    />
  );
}
