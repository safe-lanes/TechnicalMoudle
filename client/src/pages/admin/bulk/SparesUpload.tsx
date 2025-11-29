import { Package } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";

const FIELD_MAPPINGS = [
  { field: "Fleet Equipment Name", required: false, description: "Fleet reference name" },
  { field: "Vessel Code", required: true, description: "Vessel identifier (e.g., V001)" },
  { field: "Component Code", required: true, description: "Must exist in system" },
  { field: "Component Name", required: false, description: "Auto-filled from component" },
  { field: "Part Code", required: false, description: "Auto-generated PT-XXXXXX if not provided" },
  { field: "Part Name", required: true, description: "Spare part description" },
  { field: "Part Number", required: false, description: "Manufacturer part number" },
  { field: "Unit Of Measurement", required: false, description: "PCS, KG, LTR, etc." },
  { field: "Stocking Number", required: false, description: "Internal stock reference" },
  { field: "Maker", required: false, description: "Manufacturer name" },
  { field: "Maker Code", required: false, description: "Manufacturer code" },
  { field: "Specification", required: false, description: "Technical specifications" },
  { field: "Drawing No", required: false, description: "Drawing reference" },
  { field: "Location", required: false, description: "Storage location" },
  { field: "ROB", required: false, description: "Remaining on board quantity" },
  { field: "Min Stock", required: false, description: "Minimum stock level" },
  { field: "Max Stock", required: false, description: "Maximum stock level" },
  { field: "Unit Cost", required: false, description: "Cost per unit" },
  { field: "Criticality (Yes/No)", required: false, description: "Critical spare flag" },
  { field: "Lead Time", required: false, description: "Procurement lead time" },
  { field: "Supplier", required: false, description: "Supplier name" },
  { field: "Last Order Date", required: false, description: "DD-MMM-YYYY format" },
  { field: "Remarks", required: false, description: "Additional notes" },
];

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
