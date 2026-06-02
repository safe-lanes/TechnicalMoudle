import { History } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { PageMarkers } from "../BulkDataImport";

const WO_HISTORY_FIELD_MAPPINGS = [
  { field: "WO Number",                  required: true,  description: "Unique work order number (e.g. 601.001.WO-2024-01)" },
  { field: "Component Code",             required: true,  description: "Equipment component code (must exist in vessel register)" },
  { field: "Job Title",                  required: true,  description: "Title of the maintenance job performed" },
  { field: "Maintenance Type",           required: true,  description: "Type of maintenance: Planned, Unplanned, Condition-Based" },
  { field: "Date Completed",             required: true,  description: "Date work was completed (DD-MMM-YYYY, e.g. 15-NOV-2024)" },
  { field: "Performed By",               required: true,  description: "Name or rank of person who performed the work" },
  { field: "WO Description",             required: false, description: "Detailed description of the work carried out" },
  { field: "Duration Hours",             required: false, description: "Time taken to complete the work (in hours)" },
  { field: "Running Hours at Completion",required: false, description: "Component running hours when work was completed" },
  { field: "Remarks",                    required: false, description: "Any observations, findings, or follow-up notes" },
  { field: "Next Due Date",              required: false, description: "Next scheduled maintenance date (DD-MMM-YYYY)" },
  { field: "Spare Parts Used",           required: false, description: "List of spare parts used (comma-separated part codes)" },
  { field: "Job Approved By",            required: false, description: "Name or rank of person who approved the work order" },
  { field: "WO Due Date",               required: false, description: "Date the work order was due (DD-MMM-YYYY)" },
  { field: "WO Due Hour",               required: false, description: "Running hours at which the work order became due" },
  { field: "Next Due Hour",             required: false, description: "Running hours at which the next maintenance is due" },
  { field: "Status",                    required: false, description: "WO status: Completed, Due, Overdue, Postponed, Pending Approval, Active" },
];

const SPARE_HISTORY_FIELD_MAPPINGS = [
  { field: "Part Code",            required: true,  description: "Part code of the spare — must exist in vessel's spares register" },
  { field: "Event Type",           required: true,  description: "Type of transaction: CONSUME, RECEIVE, or ADJUST" },
  { field: "Quantity",             required: true,  description: "Absolute quantity involved (always positive)" },
  { field: "ROB After",            required: true,  description: "Remaining on-board balance after this transaction" },
  { field: "Date",                 required: true,  description: "Date of the transaction (DD-MMM-YYYY)" },
  { field: "Vessel Code",          required: true,  description: "Vessel code (e.g. V001)" },
  { field: "Component Code",       required: false, description: "Component this spare is linked to" },
  { field: "Performed By",         required: false, description: "Name or rank of person who performed the transaction" },
  { field: "Remarks",              required: false, description: "Free-text notes about the transaction" },
  { field: "Reference",            required: false, description: "Work Order or Purchase Order number linked to this event" },
  { field: "Port/Place",           required: false, description: "Port or location where the transaction took place" },
  { field: "Timezone",             required: false, description: "Timezone string (e.g. Asia/Singapore)" },
  { field: "Component Spare Code", required: false, description: "Spare code as registered against the component" },
];

const STORE_HISTORY_FIELD_MAPPINGS = [
  { field: "Item Code",    required: true,  description: "Item code of the stores item — must exist in vessel's stores register" },
  { field: "Event Type",   required: true,  description: "Type of transaction: RECEIVE, CONSUME, ADJUST, TRANSFER_IN, or TRANSFER_OUT" },
  { field: "Quantity",     required: true,  description: "Absolute quantity involved (always positive)" },
  { field: "ROB After",    required: true,  description: "Remaining on-board balance after this transaction" },
  { field: "Date",         required: true,  description: "Date of the transaction (DD-MMM-YYYY)" },
  { field: "Vessel Code",  required: true,  description: "Vessel code (e.g. V001)" },
  { field: "Location",     required: false, description: "Storage location name (stored as a note in remarks)" },
  { field: "Remarks",      required: false, description: "Free-text notes about the transaction" },
  { field: "Reference",    required: false, description: "Work Order or Purchase Order number linked to this event" },
  { field: "Port/Place",   required: false, description: "Port or location where the transaction took place" },
  { field: "Timezone",     required: false, description: "Timezone string (e.g. Asia/Singapore)" },
  { field: "Performed By", required: false, description: "Name or rank of person who performed the transaction" },
];

const HISTORY_TYPES = [
  { value: 'work-order', label: 'Work Order' },
  { value: 'spares',     label: 'Spares' },
  { value: 'stores',     label: 'Stores' },
];

interface WoHistoryUploadProps {
  vesselId: string;
  markers?: PageMarkers;
  selectedHistorySubType?: string;
  onHistorySubTypeChange?: (value: string) => void;
}

export default function WoHistoryUpload({ vesselId, markers, selectedHistorySubType, onHistorySubTypeChange }: WoHistoryUploadProps) {
  const subType = selectedHistorySubType ?? 'work-order';

  const fieldMappings =
    subType === 'stores' ? STORE_HISTORY_FIELD_MAPPINGS :
    subType === 'spares' ? SPARE_HISTORY_FIELD_MAPPINGS :
    WO_HISTORY_FIELD_MAPPINGS;

  const description =
    subType === 'stores'
      ? "Upload historical stores transaction records. Imported entries are stored in the Stores ledger."
      : subType === 'spares'
      ? "Upload historical spare parts transaction records. Imported entries are stored in the Spares history ledger."
      : "Upload historical work order records. Imported entries are stored as Completed work orders.";

  return (
    <UniformBulkUpload
      title="History Import"
      description={description}
      icon={History}
      templateType="wo-history"
      templateFileName="wo_history_template.xlsx"
      fieldMappings={fieldMappings}
      vesselId={vesselId}
      previewColumns={
        subType === 'stores' ? ["Item Code", "Event Type", "Quantity"] :
        subType === 'spares' ? ["Part Code", "Event Type", "Quantity"] :
        ["WO Number", "Component Code", "Job Title"]
      }
      historySubTypes={HISTORY_TYPES}
      selectedHistorySubType={selectedHistorySubType}
      onHistorySubTypeChange={onHistorySubTypeChange}
      markers={markers ? {
        header: markers.uploadHeader,
        description: markers.uploadDescription,
        downloadTemplate: markers.downloadTemplate,
        tabUpload: markers.tabUpload,
        tabMapping: markers.tabMapping,
        tabHistory: markers.tabHistory,
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
