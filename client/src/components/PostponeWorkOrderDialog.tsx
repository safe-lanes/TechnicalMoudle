import React, { useState, useRef, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
    reasonForPostponement: "",
    postponementRemarks: "",
    authorizedBy: "",
    approvalRemarks: "",
    nextDueDate: "",
    durationOfPostponement: "5 Days",
    informOfficer: false,
  });

  const [validationError, setValidationError] = useState("");
  const [remarksError, setRemarksError] = useState("");

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

  useEffect(() => {
    if (workOrder) {
      setFormData({
        workOrderId: workOrder.templateCode || workOrder.workOrderNo || "",
        component: workOrder.component || "",
        jobTitle: workOrder.jobTitle,
        originalDueDate: workOrder.dueDate || "",
        reasonForPostponement: "",
        postponementRemarks: "",
        authorizedBy: "superintendent",
        approvalRemarks: "",
        nextDueDate: "",
        durationOfPostponement: "5 Days",
        informOfficer: false,
      });
      setValidationError("");
      setRemarksError("");
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
    return () => {
      cancelled = true;
    };
  }, [isOpen, workOrder?.id]);

  const calculatePostponementEndDate = (duration: string): string => {
    const today = new Date();
    let endDate = new Date(today);

    switch (duration) {
      case '1 Day':
        endDate.setDate(today.getDate() + 1);
        break;
      case '3 Days':
        endDate.setDate(today.getDate() + 3);
        break;
      case '5 Days':
        endDate.setDate(today.getDate() + 5);
        break;
      case '1 Week':
        endDate.setDate(today.getDate() + 7);
        break;
      case '2 Weeks':
        endDate.setDate(today.getDate() + 14);
        break;
      case '1 Month':
        endDate.setMonth(today.getMonth() + 1);
        break;
      default:
        endDate.setDate(today.getDate() + 5);
    }

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${String(endDate.getDate()).padStart(2, '0')}-${months[endDate.getMonth()]}-${endDate.getFullYear()}`;
  };

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

    if (validFiles.length === 0) {
      event.target.value = "";
      return;
    }

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

      toast({
        title: "Risk Assessment uploaded",
        description: `${file.name} has been attached.`,
      });
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

  const handleRAViewClick = () => {
    if (!riskAssessmentDoc) {
      toast({
        title: "No Risk Assessment attached",
        description: "Upload a Risk Assessment document first using the UPLOAD button.",
      });
      return;
    }
    window.open(
      `/technical/api/work-order-documents/${riskAssessmentDoc.id}/download`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      const response = await fetch(`/technical/api/work-order-documents/${docId}`, {
        method: "DELETE",
      });
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
    let hasError = false;

    if (!formData.reasonForPostponement) {
      setValidationError("Please select a reason for postponement.");
      hasError = true;
    } else {
      setValidationError("");
    }

    if (isOtherReason && !formData.postponementRemarks.trim()) {
      setRemarksError("Please enter the custom postponement reason.");
      hasError = true;
    } else {
      setRemarksError("");
    }

    if (hasError) return;

    if (onConfirm && workOrder) {
      const postponementEndDate = calculatePostponementEndDate(formData.durationOfPostponement);

      onConfirm(workOrder.id || "", {
        nextDueDate: formData.nextDueDate,
        reason: formData.reasonForPostponement,
        postponementRemarks: formData.postponementRemarks,
        authorizedBy: formData.authorizedBy,
        duration: formData.durationOfPostponement,
        approvalRemarks: formData.approvalRemarks,
        postponementEndDate: postponementEndDate,
      });
    }
    onClose();
  };

  if (!workOrder) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Postpone Work Order</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-3 py-4">
            {/* Row 1: Work Order ID and Component */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="workOrderId" className="text-sm">Work Order ID</Label>
                <Input
                  id="workOrderId"
                  value={formData.workOrderId}
                  onChange={(e) => setFormData({ ...formData, workOrderId: e.target.value })}
                  className="bg-gray-50 h-9"
                  readOnly
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="component" className="text-sm">Component</Label>
                <Input
                  id="component"
                  value={formData.component}
                  onChange={(e) => setFormData({ ...formData, component: e.target.value })}
                  className="bg-gray-50 h-9"
                  readOnly
                />
              </div>
            </div>

            {/* Row 2: Job Title and Inform Officer */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="jobTitle" className="text-sm">Job Title</Label>
                <Input
                  id="jobTitle"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  className="bg-gray-50 h-9"
                  readOnly
                />
              </div>
              <div className="flex items-end">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="informOfficer"
                    checked={formData.informOfficer}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, informOfficer: checked as boolean })
                    }
                  />
                  <Label htmlFor="informOfficer" className="text-sm">Inform Office</Label>
                </div>
              </div>
            </div>

            {/* Row 3: Original Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="originalDueDate" className="text-sm">Original Due Date</Label>
                <Input
                  id="originalDueDate"
                  value={formData.originalDueDate}
                  onChange={(e) => setFormData({ ...formData, originalDueDate: e.target.value })}
                  className="bg-gray-50 h-9"
                  readOnly
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

            {/* Row 4: Reason for Postponement — mandatory dropdown */}
            <div className="space-y-1">
              <Label htmlFor="reasonForPostponement" className="text-sm">
                Reason for Postponement <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.reasonForPostponement}
                onValueChange={(value) => {
                  setFormData({ ...formData, reasonForPostponement: value, postponementRemarks: "" });
                  if (value) setValidationError("");
                  setRemarksError("");
                }}
              >
                <SelectTrigger
                  id="reasonForPostponement"
                  data-testid="select-postponement-reason"
                  className={validationError ? "border-red-500" : ""}
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
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {validationError && (
                <p className="text-sm text-red-500" data-testid="postponement-reason-error">{validationError}</p>
              )}
            </div>

            {/* Row 4b: Remarks / Additional Details — optional for standard, mandatory for Other Reason */}
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
                  if (e.target.value.trim()) setRemarksError("");
                }}
                className={`min-h-[60px] resize-none${remarksError ? " border-red-500" : ""}`}
                placeholder={
                  isOtherReason
                    ? "Enter custom postponement reason..."
                    : "Enter additional remarks or details..."
                }
              />
              {remarksError && (
                <p className="text-sm text-red-500" data-testid="postponement-remarks-error">{remarksError}</p>
              )}
            </div>

            {/* Row 5: Authorized By */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="authorizedBy" className="text-sm">Authorized By</Label>
                <Select
                  value={formData.authorizedBy}
                  onValueChange={(value) => setFormData({ ...formData, authorizedBy: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select authorizer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superintendent">Superintendent</SelectItem>
                    <SelectItem value="technical-manager">Technical Manager</SelectItem>
                    <SelectItem value="dpa">DPA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div></div>
            </div>

            {/* Row 6: Approval Remarks */}
            <div className="space-y-1">
              <Label htmlFor="approvalRemarks" className="text-sm">Approval Remarks (Optional)</Label>
              <Textarea
                id="approvalRemarks"
                value={formData.approvalRemarks}
                onChange={(e) => setFormData({ ...formData, approvalRemarks: e.target.value })}
                className="min-h-[50px] resize-none"
                placeholder="Enter approval remarks..."
              />
            </div>

            {/* Row 7: Next Due Date and Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="nextDueDate" className="text-sm">Next Due Date</Label>
                <Input
                  id="nextDueDate"
                  type="date"
                  value={formData.nextDueDate}
                  onChange={(e) => setFormData({ ...formData, nextDueDate: e.target.value })}
                  placeholder="dd-mm-yyyy"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="durationOfPostponement" className="text-sm">Duration of Postponement</Label>
                <Select
                  value={formData.durationOfPostponement}
                  onValueChange={(value) => setFormData({ ...formData, durationOfPostponement: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1 Day">1 Day</SelectItem>
                    <SelectItem value="3 Days">3 Days</SelectItem>
                    <SelectItem value="5 Days">5 Days</SelectItem>
                    <SelectItem value="1 Week">1 Week</SelectItem>
                    <SelectItem value="2 Weeks">2 Weeks</SelectItem>
                    <SelectItem value="1 Month">1 Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 8: Attach Document (Upload) */}
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
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t flex-shrink-0">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostponeWorkOrderDialog;
