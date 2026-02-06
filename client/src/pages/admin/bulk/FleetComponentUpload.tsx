import { Cog } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";

const FIELD_MAPPINGS = [
  { field: "Parent Fleet Equipment Code", required: true, description: "Parent component code for hierarchy - Required" },
  { field: "Fleet Equipment Code", required: true, description: "Unique code (e.g., 601.002.01) - Required" },
  { field: "Fleet Equipment Name", required: true, description: "Equipment name - Required" },
  { field: "Component Category", required: true, description: "Component category from Master List - Required" },
  { field: "Maker Name", required: true, description: "Manufacturer name - Required" },
  { field: "Maker Code", required: true, description: "Manufacturer code - Required" },
  { field: "Model", required: true, description: "Equipment model - Required" },
  { field: "Model Code", required: true, description: "Model code - Required" },
  { field: "Location", required: false, description: "Installation location" },
  { field: "Rating", required: false, description: "Power/capacity rating" },
  { field: "Eqpt / System Department", required: true, description: "Department responsible - Required" },
  { field: "Notes", required: false, description: "Additional notes" },
  { field: "IS Active", required: true, description: "Yes/No - defaults to Yes - Required" },
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
