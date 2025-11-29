import { Store } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";

const FIELD_MAPPINGS = [
  { field: "Item Code", required: true, description: "Unique identifier for the stores item" },
  { field: "Item Name", required: true, description: "Name of the item" },
  { field: "Stores Category", required: false, description: "Category (General Stores, Electrical, etc.)" },
  { field: "UOM", required: false, description: "Unit of measurement" },
  { field: "Total ROB", required: false, description: "Remaining on Board (total)" },
  { field: "Min", required: false, description: "Minimum stock level" },
  { field: "Location A", required: false, description: "Primary storage location" },
  { field: "Location B", required: false, description: "Secondary storage location" },
  { field: "Location A - ROB", required: false, description: "ROB at Location A" },
  { field: "Location B - ROB", required: false, description: "ROB at Location B" },
  { field: "IMPA Code", required: false, description: "International Maritime Parts Association code" },
];

const STORE_TYPES = [
  { value: 'stores', label: 'Stores' },
  { value: 'lubricants', label: 'Lubes' },
  { value: 'chemicals', label: 'Chemicals' },
  { value: 'others', label: 'Others' }
];

interface StoresUploadProps {
  vesselId: string;
}

export default function StoresUpload({ vesselId }: StoresUploadProps) {
  const handleRefreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/stores', vesselId] });
    queryClient.invalidateQueries({ queryKey: ['/api/stores'] });
  };

  return (
    <UniformBulkUpload
      title="Stores Bulk Import"
      description="Upload stores inventory data. Select Store Type to route data to correct tab."
      icon={Store}
      templateType="stores"
      templateFileName="stores_template.xlsx"
      fieldMappings={FIELD_MAPPINGS}
      vesselId={vesselId}
      previewColumns={["Item Code", "Item Name", "Stores Category"]}
      storeTypes={STORE_TYPES}
      onRefreshData={handleRefreshData}
    />
  );
}
