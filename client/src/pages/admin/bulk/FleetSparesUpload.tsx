import { Package } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";
import { useVessel } from "@/contexts/VesselContext";

const FIELD_MAPPINGS = [
  { field: "Vessel Code", required: true, description: "Vessel identifier (e.g., V001)" },
  { field: "Component Code", required: true, description: "Must exist in system" },
  { field: "Component Name", required: false, description: "Auto-filled from component" },
  { field: "Part Code", required: false, description: "Auto-generated PT-XXXXXX if not provided" },
  { field: "Part Name", required: true, description: "Spare part description" },
  { field: "Part Number", required: false, description: "Manufacturer part number" },
  { field: "UOM", required: false, description: "Unit of Measurement (PCS, KG, LTR, etc.)" },
  { field: "Stocking Number", required: false, description: "Internal stock reference" },
  { field: "Maker", required: false, description: "Manufacturer name" },
  { field: "Maker Code", required: false, description: "Manufacturer code" },
  { field: "Specification", required: false, description: "Technical specifications" },
  { field: "Drawing Number", required: false, description: "Drawing reference" },
  { field: "Position Number", required: false, description: "Assembly position number" },
  { field: "Location A", required: false, description: "Primary storage location" },
  { field: "Location A - ROB", required: false, description: "ROB at Location A" },
  { field: "Location B", required: false, description: "Secondary storage location" },
  { field: "Location B - ROB", required: false, description: "ROB at Location B" },
  { field: "Total ROB", required: false, description: "Total remaining on board" },
  { field: "Minimum Stock", required: false, description: "Minimum stock level" },
  { field: "Criticality", required: false, description: "Yes or No - Critical spare flag" },
  { field: "Is Active", required: false, description: "Yes or No - defaults to Yes" },
  { field: "IHM (Inventory of Hazardous Materials)", required: false, description: "Yes or No" },
  { field: "Note", required: false, description: "Additional notes" },
  { field: "Manual Name", required: false, description: "Reference manual name" },
  { field: "Page Number", required: false, description: "Reference page number" },
  { field: "Evidence Type", required: false, description: "Type of evidence/remarks" },
];

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
