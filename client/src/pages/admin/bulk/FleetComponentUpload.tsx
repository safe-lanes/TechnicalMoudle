import { Cog } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";
import { useVessel } from "@/contexts/VesselContext";

const FIELD_MAPPINGS = [
  { field: "Fleet Equipment Code", required: false, description: "10-character code (e.g., 601.002.01)" },
  { field: "Fleet Equipment Name", required: false, description: "Standard equipment name" },
  { field: "Parent Component Code", required: false, description: "Parent component code for hierarchy" },
  { field: "Component Code", required: true, description: "Component SFI code (e.g., 601.002.01)" },
  { field: "Component Name", required: true, description: "Component name" },
  { field: "Component Category", required: false, description: "Component category from Master List" },
  { field: "Maker", required: false, description: "Manufacturer name" },
  { field: "Maker Code", required: false, description: "Manufacturer code" },
  { field: "Model", required: false, description: "Equipment model" },
  { field: "Model Code", required: false, description: "Model code" },
  { field: "Serial No", required: false, description: "Serial number" },
  { field: "Drawing No", required: false, description: "Drawing number" },
  { field: "Location", required: false, description: "Installation location" },
  { field: "Criticality", required: false, description: "A/B/C criticality level" },
  { field: "Condition Based", required: false, description: "Yes/No - condition-based maintenance" },
  { field: "Installation Date", required: false, description: "Installation date (DD-MMM-YYYY)" },
  { field: "Commissioned Date", required: false, description: "Commissioned date (DD-MMM-YYYY)" },
  { field: "Rating", required: false, description: "Power/capacity rating" },
  { field: "Equipment / System Department", required: false, description: "Department responsible" },
  { field: "Class item", required: false, description: "Yes/No - is class item" },
  { field: "IS Active", required: false, description: "Yes/No - defaults to Yes" },
  { field: "Vessel Code", required: true, description: "Vessel identifier (e.g., V001)" },
  { field: "IS Parent", required: false, description: "Yes/No - is parent component" },
  { field: "Notes", required: false, description: "Additional notes" },
  { field: "RH Counter Type", required: false, description: "Running hours counter type (MASTER/INHERITED/NOT_RH_DRIVEN)" },
  { field: "RH Counter Source", required: false, description: "Source of running hours data" },
  { field: "Running Hours", required: false, description: "Current running hours" },
  { field: "Last Updated", required: false, description: "Last update timestamp" },
];

export default function FleetComponentUpload() {
  const { vesselId } = useVessel();
  
  const handleRefreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['/technical/api/components', vesselId] });
    queryClient.invalidateQueries({ queryKey: ['/technical/api/components'] });
  };

  return (
    <UniformBulkUpload
      title="Fleet Component Bulk Upload"
      description="Upload components via Excel. Template includes field mappings and hierarchy support."
      icon={Cog}
      templateType="components"
      templateFileName="fleet_components_template.xlsx"
      fieldMappings={FIELD_MAPPINGS}
      vesselId={vesselId}
      previewColumns={["Component Code", "Component Name", "Parent Component Code"]}
      onRefreshData={handleRefreshData}
    />
  );
}
