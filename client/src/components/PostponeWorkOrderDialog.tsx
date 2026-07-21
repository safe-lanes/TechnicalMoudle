import React, { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Paperclip,
  ArrowUpRight,
  Upload,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { POSTPONEMENT_REASONS } from "@shared/postponementReasons";
import { useVessel } from "@/contexts/VesselContext";
import { useToast } from "@/hooks/use-toast";
import { viewAuthedDocument } from "@/lib/authedDownload";

const OTHER_REASON = "Other Reason";
const DOC_TYPE = "postponement";
const RA_DOC_TYPE = "postponementRiskAssessment";
const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".xlsx"];

interface MasterListItem {
  id: number;
  listType: string;
  listKey: string;
  listValue: string;
  displayOrder: number;
  isActive: boolean;
}

interface PostponementDoc {
  id: string;
  workOrderId: string;
  documentType: string;
  fileName: string;
  fileKey: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
}

interface PostponeWorkOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: {
    id?: string | null;
    workOrderNo?: string | null;
    templateCode?: string | null;
    component?: string | null;
    jobTitle: string;
    dueDate?: string | null;
    assignedTo?: string | null;
    /** Pre-fill: existing requested new date (for Awaiting Office Approval / Postponement Rejected WOs) */
    postponeRequestedDate?: string | null;
    /** Pre-fill: existing postponement reason */
    postponementReason?: string | null;
    /** Pre-fill: existing postponement remarks */
    postponementRemarks?: string | null;
    /** Current status — used to detect resubmit mode and approved mode */
    status?: string | null;
    computedStatus?: string | null;
    /** Approved-postponement read-only fields */
    postponeDate?: string | null;
    postponementEndDate?: string | null;
    postponementAuthorizedBy?: string | null;
    postponementApprovalRemarks?: string | null;
    /** Maintenance basis — used to determine cap type (date vs RH) */
    maintenanceBasis?: string | null;
    /** Original due running hours — used for RH/Dual Frequency WO cap */
    dueRH?: number | null;
  } | null;
  onConfirm?: (workOrderId: string, postponeData: any) => void;
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext))
    return <ImageIcon className="h-3.5 w-3.5" />;
  if (ext === "pdf") return <FileText className="h-3.5 w-3.5" />;
  if (["xls", "xlsx"].includes(ext)) return <FileSpreadsheet className="h-3.5 w-3.5" />;
  return <Paperclip className="h-3.5 w-3.5" />;
};

const parseDateFlexible = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) return new Date(+m[3], months[m[2]] ?? 0, +m[1]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const formatDDMMMYYYY = (date: Date): string => {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(date.getDate()).padStart(2,"0")}-${months[date.getMonth()]}-${date.getFullYear()}`;
};

const PostponeWorkOrderDialog: React.FC<PostponeWorkOrderDialogProps> = ({
  isOpen,
  onClose,
  workOrder,
  onConfirm,
}) => {
  const { vesselId } = useVessel();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    workOrderId: "",
    component: "",
    jobTitle: "",
    originalDueDate: "",
    postponeDate: "",
    newDueRH: "",
    reasonForPostponement: "",
    postponementRemarks: "",
    approver: "Office",
  });

  const [errors, setErrors] = useState<{
    postponeDate?: string;
    reason?: string;
    remarks?: string;
    newDueRH?: string;
  }>({});

  const [postponementDocs, setPostponementDocs] = useState<PostponementDoc[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [riskAssessmentDoc, setRiskAssessmentDoc] = useState<PostponementDoc | null>(null);
  const [isRAUploading, setIsRAUploading] = useState(false);
  const raFileInputRef = useRef<HTMLInputElement>(null);

  const { data: masterListItems, isLoading: reasonsLoading, isError: reasonsError } = useQuery<MasterListItem[]>({
    queryKey: ["/technical/api/fleet/master-lists", "postponementReason"],
    queryFn: async () => {
      const r = await fetch("/technical/api/fleet/master-lists?listType=postponementReason");
      if (!r.ok) throw new Error(`Failed to fetch postponement reasons: ${r.status}`);
      const json = await r.json();
      return Array.isArray(json) ? json : [];
    },
  });

  const dbActiveReasons: string[] =
    !reasonsError && masterListItems && masterListItems.length > 0
      ? masterListItems
          .filter((i) => i.isActive)
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((i) => i.listValue)
      : [];

  const baseReasons: string[] =
    dbActiveReasons.length > 0 ? dbActiveReasons : [...POSTPONEMENT_REASONS];

  const allReasons: string[] = [...baseReasons, OTHER_REASON];

  const isOtherReason = formData.reasonForPostponement === OTHER_REASON;

  const computedNextDueDate = useMemo(() => {
    if (!formData.postponeDate) return "";
    const d = new Date(formData.postponeDate + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    return formatDDMMMYYYY(d);
  }, [formData.postponeDate]);

  const computedDuration = useMemo(() => {
    if (!formData.postponeDate) return "";
    const orig = parseDateFlexible(formData.originalDueDate);
    const postpone = new Date(formData.postponeDate + "T00:00:00");
    if (!orig || isNaN(orig.getTime()) || isNaN(postpone.getTime())) return "";
    orig.setHours(0, 0, 0, 0);
    postpone.setHours(0, 0, 0, 0);
    const diffDays = Math.round((postpone.getTime() - orig.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays === 1 ? "1 day" : `${diffDays} days`;
  }, [formData.postponeDate, formData.originalDueDate]);

  const postponeDateMinValue = useMemo(() => {
    const orig = parseDateFlexible(formData.originalDueDate);
    if (!orig || isNaN(orig.getTime())) return undefined;
    const next = new Date(orig);
    next.setDate(next.getDate() + 1);
    return next.toISOString().split("T")[0];
  }, [formData.originalDueDate]);

  // Detect resubmit mode — cap is removed for resubmissions
  const isResubmitMode =
    workOrder?.status === 'Awaiting Office Approval' ||
    workOrder?.computedStatus === 'Awaiting Office Approval' ||
    workOrder?.status === 'Postponement Rejected' ||
    workOrder?.computedStatus === 'Postponement Rejected';

  // RH-based WOs use an hours cap instead of a date cap
  const isRHBased =
    workOrder?.maintenanceBasis === 'Running Hours' ||
    workOrder?.maintenanceBasis === 'Dual Frequency';

  // Max allowed date for Calendar/Critical WOs (originalDueDate + 90 days)
  const postponeDateMaxValue = useMemo(() => {
    if (isResubmitMode) return undefined;
    if (isRHBased) return undefined;
    const orig = parseDateFlexible(formData.originalDueDate);
    if (!orig || isNaN(orig.getTime())) return undefined;
    const max = new Date(orig);
    max.setDate(max.getDate() + 90);
    return max.toISOString().split("T")[0];
  }, [formData.originalDueDate, isResubmitMode, isRHBased]);

  // Human-readable version for display in helper text and error messages
  const maxDateFormatted = useMemo(() => {
    if (!postponeDateMaxValue) return null;
    const d = new Date(postponeDateMaxValue + "T00:00:00");
    return isNaN(d.getTime()) ? null : formatDDMMMYYYY(d);
  }, [postponeDateMaxValue]);

  // Max allowed RH for Running Hours / Dual Frequency WOs (dueRH + 2160 hrs = 90 days)
  const maxAllowedRH = useMemo(() => {
    if (!isRHBased || isResubmitMode) return null;
    if (workOrder?.dueRH == null) return null;
    return workOrder.dueRH + 2160;
  }, [isRHBased, isResubmitMode, workOrder?.dueRH]);

  useEffect(() => {
    if (workOrder) {
      // Detect resubmit mode: WO is already pending or was rejected by office
      const isResubmit =
        workOrder.status === 'Awaiting Office Approval' ||
        workOrder.computedStatus === 'Awaiting Office Approval' ||
        workOrder.status === 'Postponement Rejected' ||
        workOrder.computedStatus === 'Postponement Rejected';

      // Pre-fill with previous request data when resubmitting
      const prefillPostponeDate = isResubmit ? (workOrder.postponeRequestedDate || "") : "";
      const prefillReason = isResubmit ? (workOrder.postponementReason || "") : "";
      const prefillRemarks = isResubmit ? (workOrder.postponementRemarks || "") : "";

      setFormData({
        workOrderId: workOrder.templateCode || workOrder.workOrderNo || "",
        component: workOrder.component || "",
        jobTitle: workOrder.jobTitle,
        originalDueDate: workOrder.dueDate || "",
        postponeDate: prefillPostponeDate,
        newDueRH: "",
        reasonForPostponement: prefillReason,
        postponementRemarks: prefillRemarks,
        approver: "Office",
      });
      setErrors({});
    }
  }, [workOrder]);

  useEffect(() => {
    let cancelled = false;
    const loadDocs = async () => {
      if (!isOpen || !workOrder?.id) {
        setPostponementDocs([]);
        setRiskAssessmentDoc(null);
        return;
      }
      try {
        const res = await fetch(`/technical/api/work-orders/${workOrder.id}/documents`);
        if (!res.ok) throw new Error(`Failed to load documents: ${res.status}`);
        const json = await res.json();
        const list: PostponementDoc[] = Array.isArray(json) ? json : [];
        if (!cancelled) {
          setPostponementDocs(list.filter((d) => d.documentType === DOC_TYPE));
          const raDocs = list
            .filter((d) => d.documentType === RA_DOC_TYPE)
            .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
          setRiskAssessmentDoc(raDocs[0] || null);
        }
      } catch (err) {
        console.error("Failed to load postponement docs:", err);
        if (!cancelled) {
          setPostponementDocs([]);
          setRiskAssessmentDoc(null);
        }
      }
    };
    loadDocs();
    return () => { cancelled = true; };
  }, [isOpen, workOrder?.id]);

  const handleUploadClick = () => {
    if (isUploading) return;
    if (postponementDocs.length >= MAX_FILES) {
      toast({
        title: "Limit reached",
        description: `Maximum ${MAX_FILES} documents. Delete an existing document first.`,
        variant: "destructive",
      });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!workOrder?.id) {
      toast({ title: "Upload failed", description: "Work order is not available.", variant: "destructive" });
      event.target.value = "";
      return;
    }
    if (!vesselId) {
      toast({ title: "Upload failed", description: "No vessel context available.", variant: "destructive" });
      event.target.value = "";
      return;
    }

    const slotsAvailable = MAX_FILES - postponementDocs.length;
    if (slotsAvailable <= 0) {
      toast({
        title: "Limit reached",
        description: `Maximum ${MAX_FILES} documents. Delete an existing document first.`,
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
      if (!ALLOWED_MIME.includes(file.type) && !ALLOWED_EXT.includes(ext)) {
        toast({
          title: "Invalid file type",
          description: `${file.name}: Only allowed file types are accepted.`,
          variant: "destructive",
        });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `${file.name} is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum is 5MB.`,
          variant: "destructive",
        });
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) { event.target.value = ""; return; }

    const filesToUpload = validFiles.slice(0, slotsAvailable);
    if (validFiles.length > slotsAvailable) {
      toast({
        title: "Partial upload",
        description: `Only ${slotsAvailable} slot(s) remaining. Uploading first ${slotsAvailable} of ${validFiles.length} files.`,
        variant: "destructive",
      });
    }

    setIsUploading(true);
    let uploadedCount = 0;
    try {
      for (const file of filesToUpload) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("documentType", DOC_TYPE);
        fd.append("vesselId", vesselId);
        const response = await fetch(`/technical/api/work-orders/${workOrder.id}/documents`, {
          method: "POST",
          body: fd,
        });
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.message || errBody.error || `Failed to upload ${file.name}`);
        }
        const result: PostponementDoc = await response.json();
        setPostponementDocs((prev) => [...prev, result]);
        uploadedCount++;
      }
      toast({
        title: "Documents uploaded",
        description:
          uploadedCount === 1
            ? `${filesToUpload[0].name} has been uploaded successfully.`
            : `${uploadedCount} files have been uploaded successfully.`,
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleRAUploadClick = () => {
    if (isRAUploading) return;
    if (!workOrder?.id) {
      toast({ title: "Upload failed", description: "Work order is not available.", variant: "destructive" });
      return;
    }
    raFileInputRef.current?.click();
  };

  const handleRAFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!workOrder?.id) {
      toast({ title: "Upload failed", description: "Work order is not available.", variant: "destructive" });
      event.target.value = "";
      return;
    }
    if (!vesselId) {
      toast({ title: "Upload failed", description: "No vessel context available.", variant: "destructive" });
      event.target.value = "";
      return;
    }
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
    if (!ALLOWED_MIME.includes(file.type) && !ALLOWED_EXT.includes(ext)) {
      toast({
        title: "Invalid file type",
        description: `${file.name}: Only PDF, image, Word, or Excel files are accepted.`,
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: `${file.name} is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum is 5MB.`,
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }
    setIsRAUploading(true);
    const previousDoc = riskAssessmentDoc;
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("documentType", RA_DOC_TYPE);
      fd.append("vesselId", vesselId);
      const response = await fetch(`/technical/api/work-orders/${workOrder.id}/documents`, {
        method: "POST",
        body: fd,
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message || errBody.error || `Failed to upload ${file.name}`);
      }
      const result: PostponementDoc = await response.json();
      setRiskAssessmentDoc(result);
      if (previousDoc?.id) {
        try {
          await fetch(`/technical/api/work-order-documents/${previousDoc.id}`, { method: "DELETE" });
        } catch (delErr) {
          console.error("Failed to remove previous Risk Assessment doc:", delErr);
        }
      }
      toast({ title: "Risk Assessment uploaded", description: `${file.name} has been attached.` });
    } catch (error: any) {
      console.error("Risk Assessment upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload Risk Assessment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRAUploading(false);
      event.target.value = "";
    }
  };

  const handleRAViewClick = async () => {
    if (!riskAssessmentDoc) {
      toast({
        title: "No Risk Assessment attached",
        description: "Upload a Risk Assessment document first using the UPLOAD button.",
      });
      return;
    }
    try {
      await viewAuthedDocument(
        `/technical/api/work-order-documents/${riskAssessmentDoc.id}/download`,
      );
    } catch (error) {
      toast({
        title: "View failed",
        description: "Failed to open the Risk Assessment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      const response = await fetch(`/technical/api/work-order-documents/${docId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete document");
      setPostponementDocs((prev) => prev.filter((d) => d.id !== docId));
      toast({ title: "Document deleted", description: "The document has been removed." });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Delete failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = () => {
    const newErrors: typeof errors = {};

    if (!formData.postponeDate) {
      newErrors.postponeDate = "Please select a postpone date.";
    } else {
      const orig = parseDateFlexible(formData.originalDueDate);
      const postpone = new Date(formData.postponeDate + "T00:00:00");
      if (orig && !isNaN(orig.getTime())) {
        orig.setHours(0, 0, 0, 0);
        postpone.setHours(0, 0, 0, 0);
        if (postpone <= orig) {
          newErrors.postponeDate = "Postpone date must be after the original due date.";
        } else if (!isResubmitMode && !isRHBased && postponeDateMaxValue) {
          // 90-day cap for Calendar / Critical WOs — guard against keyboard bypass of the max attribute
          const max = new Date(postponeDateMaxValue + "T00:00:00");
          max.setHours(0, 0, 0, 0);
          if (postpone > max) {
            newErrors.postponeDate = `Postpone date cannot exceed 90 days from the original due date (max: ${maxDateFormatted}).`;
          }
        }
      }
    }

    // Running Hours / Dual Frequency WOs: validate the newDueRH field
    if (isRHBased) {
      if (!formData.newDueRH) {
        newErrors.newDueRH = "Please enter the new due running hours.";
      } else {
        const enteredRH = parseFloat(formData.newDueRH);
        if (isNaN(enteredRH) || enteredRH <= 0) {
          newErrors.newDueRH = "Please enter a valid running hours value.";
        } else if (workOrder?.dueRH != null && enteredRH <= workOrder.dueRH) {
          newErrors.newDueRH = `New due RH must be greater than the current due RH of ${workOrder.dueRH.toLocaleString()} hrs.`;
        } else if (!isResubmitMode && maxAllowedRH != null && enteredRH > maxAllowedRH) {
          newErrors.newDueRH = `New due RH cannot exceed ${maxAllowedRH.toLocaleString()} hrs — 90-day limit from original due RH of ${workOrder?.dueRH?.toLocaleString()} hrs.`;
        }
      }
    }

    if (!formData.reasonForPostponement) {
      newErrors.reason = "Please select a reason for postponement.";
    }

    if (isOtherReason && !formData.postponementRemarks.trim()) {
      newErrors.remarks = "Please enter the custom postponement reason.";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    if (onConfirm && workOrder) {
      onConfirm(workOrder.id || "", {
        postponeDate: formData.postponeDate,
        nextDueDate: computedNextDueDate,
        newDueRH: isRHBased && formData.newDueRH ? parseFloat(formData.newDueRH) : undefined,
        reason: formData.reasonForPostponement,
        postponementRemarks: formData.postponementRemarks,
        approver: formData.approver,
        duration: computedDuration,
        approvalRemarks: null,
      });
    }
    onClose();
  };

  if (!workOrder) return null;

  const isApproved =
    workOrder.status === 'Postponement Approved' ||
    workOrder.computedStatus === 'Postponement Approved';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Postpone Work Order</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-3 py-4">

            {/* Row 1: Work Order ID / Component */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="workOrderId" className="text-sm">Work Order ID</Label>
                <Input
                  id="workOrderId"
                  value={formData.workOrderId}
                  className="bg-gray-50 h-9"
                  readOnly
                  data-testid="input-postpone-wo-id"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="component" className="text-sm">Component</Label>
                <Input
                  id="component"
                  value={formData.component}
                  className="bg-gray-50 h-9"
                  readOnly
                  data-testid="input-postpone-component"
                />
              </div>
            </div>

            {/* Row 2: Job Title — full width */}
            <div className="space-y-1">
              <Label htmlFor="jobTitle" className="text-sm">Job Title</Label>
              <Input
                id="jobTitle"
                value={formData.jobTitle}
                className="bg-gray-50 h-9"
                readOnly
                data-testid="input-postpone-job-title"
              />
            </div>

            {/* Row 3: Original Due Date / Risk Assessment */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="originalDueDate" className="text-sm">Original Due Date</Label>
                <Input
                  id="originalDueDate"
                  value={formData.originalDueDate}
                  className="bg-gray-50 h-9"
                  readOnly
                  data-testid="input-postpone-original-due-date"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Attach or Link Risk Assessment</Label>
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-gray-500" />
                  <div className="inline-flex items-center h-9 rounded-md border border-gray-200 bg-gray-50 overflow-hidden">
                    <button
                      type="button"
                      onClick={handleRAUploadClick}
                      disabled={isRAUploading}
                      data-testid="button-risk-assessment-upload"
                      className="px-3 h-full text-xs font-semibold text-[#52baf3] hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      {isRAUploading && <Loader2 className="h-3 w-3 animate-spin" />}
                      UPLOAD
                    </button>
                    <div className="h-5 w-px bg-gray-300" />
                    <button
                      type="button"
                      onClick={handleRAViewClick}
                      data-testid="button-risk-assessment-view"
                      className={`px-3 h-full text-xs font-semibold hover:bg-gray-100 ${
                        riskAssessmentDoc ? "text-[#52baf3]" : "text-gray-400"
                      }`}
                    >
                      VIEW
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {}}
                    disabled
                    title="Coming soon — will link to the Risk Assessment module"
                    data-testid="button-risk-assessment-link"
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-gray-200 bg-white text-xs font-semibold text-[#52baf3] opacity-60 cursor-not-allowed"
                  >
                    LINK
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                  <input
                    ref={raFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleRAFileSelected}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
                    data-testid="input-file-risk-assessment"
                  />
                </div>
                <p className="text-xs text-gray-500 truncate" data-testid="text-risk-assessment-filename">
                  {riskAssessmentDoc ? (
                    <span title={riskAssessmentDoc.fileName}>Attached: {riskAssessmentDoc.fileName}</span>
                  ) : (
                    "No file attached"
                  )}
                </p>
              </div>
            </div>

            {isApproved ? (
              /* ── Approved read-only summary ── */
              <div className="space-y-3" data-testid="section-approved-postponement">
                <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800 font-medium">
                  Postponement Approved — this work order has been postponed.
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Postpone Date</Label>
                    <p className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2" data-testid="display-approved-postpone-date">
                      {(() => {
                        const raw = workOrder.postponeDate ?? workOrder.postponeRequestedDate;
                        if (!raw) return "—";
                        const d = parseDateFlexible(raw);
                        return d ? formatDDMMMYYYY(d) : raw;
                      })()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Next Due Date</Label>
                    <p className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2" data-testid="display-approved-next-due-date">
                      {workOrder.postponementEndDate ? (() => {
                        const d = parseDateFlexible(workOrder.postponementEndDate);
                        return d ? formatDDMMMYYYY(d) : workOrder.postponementEndDate;
                      })() : "—"}
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Selected Reason</Label>
                  <p className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2" data-testid="display-approved-reason">
                    {workOrder.postponementReason || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Remarks / Additional Details</Label>
                  <p className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2 min-h-[60px]" data-testid="display-approved-remarks">
                    {workOrder.postponementRemarks || "—"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Approver</Label>
                    <p className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2" data-testid="display-approved-approver">
                      {workOrder.postponementAuthorizedBy || "Office"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Approver Remarks</Label>
                    <p className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2" data-testid="display-approved-approver-remarks">
                      {workOrder.postponementApprovalRemarks || "—"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
            {/* Row 4: Postpone Date — mandatory primary input */}
            <div className="space-y-1">
              <Label htmlFor="postponeDate" className="text-sm">
                Postpone Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="postponeDate"
                type="date"
                value={formData.postponeDate}
                min={postponeDateMinValue}
                max={postponeDateMaxValue}
                onChange={(e) => {
                  setFormData({ ...formData, postponeDate: e.target.value });
                  if (e.target.value) setErrors((prev) => ({ ...prev, postponeDate: undefined }));
                }}
                className={`h-9 max-w-xs${errors.postponeDate ? " border-red-500" : ""}`}
                data-testid="input-postpone-date"
              />
              {errors.postponeDate && (
                <p className="text-sm text-red-500" data-testid="error-postpone-date">{errors.postponeDate}</p>
              )}
              {!isResubmitMode && !isRHBased && maxDateFormatted && (
                <p className="text-xs text-muted-foreground mt-0.5" data-testid="helper-postpone-max-date">
                  Maximum postponement: 90 days from original due date — by {maxDateFormatted}
                </p>
              )}
            </div>

            {/* Row 4b: New Due RH — additional required field for RH/Dual Frequency WOs */}
            {isRHBased && (
              <div className="space-y-1">
                <Label htmlFor="newDueRH" className="text-sm">
                  New Due Running Hours <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="newDueRH"
                  type="number"
                  min={workOrder?.dueRH != null ? workOrder.dueRH + 1 : 1}
                  max={maxAllowedRH ?? undefined}
                  value={formData.newDueRH}
                  onChange={(e) => {
                    setFormData({ ...formData, newDueRH: e.target.value });
                    if (e.target.value) setErrors((prev) => ({ ...prev, newDueRH: undefined }));
                  }}
                  placeholder={workOrder?.dueRH != null ? `> ${workOrder.dueRH.toLocaleString()} hrs` : "Enter new due RH"}
                  className={`h-9 max-w-xs${errors.newDueRH ? " border-red-500" : ""}`}
                  data-testid="input-new-due-rh"
                />
                {errors.newDueRH && (
                  <p className="text-sm text-red-500" data-testid="error-new-due-rh">{errors.newDueRH}</p>
                )}
                {!isResubmitMode && maxAllowedRH != null && (
                  <p className="text-xs text-muted-foreground mt-0.5" data-testid="helper-postpone-max-rh">
                    Maximum: {maxAllowedRH.toLocaleString()} hrs — 90-day equivalent from original due RH of {workOrder?.dueRH?.toLocaleString()} hrs
                  </p>
                )}
              </div>
            )}

            {/* Row 5: Reason for Postponement */}
            <div className="space-y-1">
              <Label htmlFor="reasonForPostponement" className="text-sm">
                Reason for Postponement <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.reasonForPostponement}
                onValueChange={(value) => {
                  setFormData({ ...formData, reasonForPostponement: value, postponementRemarks: "" });
                  setErrors((prev) => ({ ...prev, reason: undefined, remarks: undefined }));
                }}
              >
                <SelectTrigger
                  id="reasonForPostponement"
                  data-testid="select-postponement-reason"
                  className={errors.reason ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Select a reason for postponement..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {reasonsLoading ? (
                    <div className="flex items-center justify-center py-3 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading reasons...
                    </div>
                  ) : (
                    allReasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.reason && (
                <p className="text-sm text-red-500" data-testid="postponement-reason-error">{errors.reason}</p>
              )}
            </div>

            {/* Row 6: Remarks — optional unless Other Reason */}
            <div className="space-y-1">
              <Label htmlFor="postponementRemarks" className="text-sm">
                {isOtherReason ? (
                  <>Custom Postponement Reason <span className="text-red-500">*</span></>
                ) : (
                  "Remarks / Additional Details (Optional)"
                )}
              </Label>
              <Textarea
                id="postponementRemarks"
                data-testid="textarea-postponement-remarks"
                value={formData.postponementRemarks}
                onChange={(e) => {
                  setFormData({ ...formData, postponementRemarks: e.target.value });
                  if (e.target.value.trim()) setErrors((prev) => ({ ...prev, remarks: undefined }));
                }}
                className={`min-h-[60px] resize-none${errors.remarks ? " border-red-500" : ""}`}
                placeholder={
                  isOtherReason
                    ? "Enter custom postponement reason..."
                    : "Enter additional remarks or details..."
                }
              />
              {errors.remarks && (
                <p className="text-sm text-red-500" data-testid="postponement-remarks-error">{errors.remarks}</p>
              )}
            </div>

            {/* Row 7: Next Due Date (display-only) / Postponement Duration (display-only) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-sm">Next Due Date</Label>
                <div
                  className="flex items-center h-9 px-3 rounded-md border border-gray-200 bg-gray-50 text-sm text-gray-700"
                  data-testid="display-next-due-date"
                >
                  {computedNextDueDate || <span className="text-gray-400">—</span>}
                </div>
                <p className="text-xs text-gray-400">Auto-calculated from Postpone Date</p>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Postponement Duration</Label>
                <div
                  className="flex items-center h-9 px-3 rounded-md border border-gray-200 bg-gray-50 text-sm text-gray-700"
                  data-testid="display-postponement-duration"
                >
                  {computedDuration || <span className="text-gray-400">—</span>}
                </div>
                <p className="text-xs text-gray-400">Postpone Date − Original Due Date</p>
              </div>
            </div>

            {/* Row 8: Approver — mandatory, single "Office" option */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="approver" className="text-sm">
                  Approver <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.approver}
                  onValueChange={(value) => setFormData({ ...formData, approver: value })}
                >
                  <SelectTrigger id="approver" className="h-9" data-testid="select-approver">
                    <SelectValue placeholder="Select approver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Office">Office</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div />
            </div>

            {/* Row 9: Attach Document */}
            <div className="space-y-1">
              <Label className="text-sm">Attach Document (Optional)</Label>
              <div className="flex flex-col items-start gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUploadClick}
                  disabled={isUploading || postponementDocs.length >= MAX_FILES}
                  className="h-8 px-3 text-xs font-medium border-gray-300 text-gray-600 hover:bg-gray-50"
                  data-testid="button-upload-postponement"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  Upload
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={handleFileSelected}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
                  data-testid="input-file-postponement"
                />
                <span className="text-xs text-gray-400" data-testid="text-postponement-count">
                  {postponementDocs.length}/{MAX_FILES}
                </span>
              </div>
              {postponementDocs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2" data-testid="list-postponement-docs">
                  {postponementDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="inline-flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-700"
                      data-testid={`chip-postponement-doc-${doc.id}`}
                    >
                      <span className="text-gray-500">{getFileIcon(doc.fileName)}</span>
                      <span className="max-w-[180px] truncate" title={doc.fileName}>{doc.fileName}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="ml-1 p-0.5 rounded hover:bg-gray-200 text-gray-500 hover:text-red-600"
                        aria-label={`Remove ${doc.fileName}`}
                        data-testid={`button-delete-postponement-doc-${doc.id}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
              </>
            )}

          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t flex-shrink-0">
          {isApproved ? (
            <Button
              variant="outline"
              onClick={onClose}
              data-testid="button-postpone-close"
            >
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={onClose}
                data-testid="button-postpone-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
                data-testid="button-postpone-confirm"
              >
                Confirm Postpone
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostponeWorkOrderDialog;
