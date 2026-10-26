import { Package } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";

const FLEET_SPARES_FIELD_MAPPINGS = [
  { field: 'Part Code', required: true, description: 'Unique part code identifier' },
  { field: 'Fleet Equipment Code', required: true, description: 'Fleet component equipment code' },
  { field: 'Fleet Equipment Name', required: true, description: 'Fleet component equipment name' },
  { field: 'Part Name', required: true, description: 'Name of the spare part' },
  { field: 'Part Number', required: false, description: 'Manufacturer part number' },
  { field: 'Unit Of Measurement', required: true, description: 'Unit of measurement (e.g., PCS, SET, KG)' },
  { field: 'Drawing Number', required: false, description: 'Technical drawing reference' },
  { field: 'Position Number', required: false, description: 'Position in assembly' },
  { field: 'Note', required: false, description: 'Additional notes' },
  { field: 'Specification', required: false, description: 'Technical specifications' },
  { field: 'Maker', required: false, description: 'Manufacturer name' },
  { field: 'Maker Code', required: false, description: 'Manufacturer code' },
  { field: 'Manual Name', required: false, description: 'Reference manual name' },
  { field: 'Page Number', required: false, description: 'Reference page number' },
  { field: 'Criticality', required: false, description: 'Yes/No criticality flag' },
  { field: 'Spare Category', required: true, description: 'Required category key from the Spare Category master list (essential, optimum or general)' },
  { field: 'Optimum Qty', required: false, description: 'Positive whole number (1–2147483647), required only for category key optimum' },
  { field: 'Is Active', required: true, description: 'Active status (Yes/No)' },
  { field: 'IHM (Inventory of Hazardous Materials)', required: false, description: 'Hazardous materials flag' },
  { field: 'Evidence Type', required: false, description: 'Evidence type classification' },
];

export default function FleetSparesUpload() {
  const handleRefreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/spares'] });
  };

  return (
    <UniformBulkUpload
      title="Fleet Spares Bulk Upload"
      description="Upload fleet-level spare parts via Excel. Template includes Fleet Equipment Codes + Names. Fleet Components must be imported first."
      icon={Package}
      templateType="fleet-spares"
      templateFileName="fleet_spares_template.xlsx"
      fieldMappings={FLEET_SPARES_FIELD_MAPPINGS}
      previewColumns={["Part Code", "Part Name", "Fleet Equipment Code", "Spare Category", "Optimum Qty"]}
      onRefreshData={handleRefreshData}
    />
  );
}
