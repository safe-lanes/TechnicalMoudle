import { Store } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { queryClient } from "@/lib/queryClient";
import { PageMarkers } from "../BulkDataImport";

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
  markers?: PageMarkers;
}

export default function StoresUpload({ vesselId, markers }: StoresUploadProps) {
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
      markers={markers ? {
        header: markers.uploadHeader,
        description: markers.uploadDescription,
        downloadTemplate: markers.downloadTemplate,
        tabUpload: markers.tabUpload,
        tabMapping: markers.tabMapping,
        tabHistory: markers.tabHistory,
        storeTypeSection: markers.storeTypeSection,
        storeTypeLabel: markers.storeTypeLabel,
        storeTypeDropdown: markers.storeTypeDropdown,
        importModeSection: markers.importModeSection,
        importModeLabel: markers.importModeLabel,
        radioAddOnly: markers.radioAddOnly,
        radioUpdateOnly: markers.radioUpdateOnly,
        radioUpsert: markers.radioUpsert,
        uploadSection: markers.uploadSection,
        uploadDescription: markers.uploadDescription2,
        dropZone: markers.dropZone,
      } : undefined}
    />
  );
}
