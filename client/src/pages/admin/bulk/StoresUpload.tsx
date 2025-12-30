import { Store } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";

const STORES_MARKERS = {
  header: "I1.6D.13",
  description: "I1.6D.14",
  downloadTemplate: "I1.6D.15",
  tabUpload: "I1.6D.16",
  tabMapping: "I1.6D.17",
  tabHistory: "I1.6D.18",
  storeTypeSection: "I1.6D.1A",
  storeTypeLabel: "I1.6D.19",
  storeTypeDropdown: "I1.6D.20",
  importModeSection: "I1.6D.21",
  importModeLabel: "I1.6D.22",
  radioAddOnly: "I1.6D.23",
  radioUpdateOnly: "I1.6D.24",
  radioUpsert: "I1.6D.25",
  uploadSection: "I1.6D.26",
  uploadDescription: "I1.6D.27",
  dropZone: "I1.6D.28"
};

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
  { value: 'lubes', label: 'Lubes' },
  { value: 'chemicals', label: 'Chemicals' },
  { value: 'others', label: 'Others' }
];

interface StoresUploadProps {
  vesselId: string;
}

export default function StoresUpload({ vesselId }: StoresUploadProps) {
  const handleRefreshData = () => {
    // Invalidate all stores queries for all tabs (stores, lubes, chemicals, others)
    ['stores', 'lubes', 'chemicals', 'others'].forEach(tab => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${vesselId}?itemType=${tab}`] });
    });
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
      markers={STORES_MARKERS}
    />
  );
}
