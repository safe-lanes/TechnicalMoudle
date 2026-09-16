import { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Plus, Edit, Trash2, Eye, X, Paperclip, Download } from "lucide-react";
import { pdfReportGenerator, DefectReportPdfData, formatDate } from "@/lib/pdfReportGenerator";
import { insertDefectSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ImmediateCauseModal from "@/components/ImmediateCauseModal";
import RootCauseModal from "@/components/RootCauseModal";
import AddActionModal from "@/components/AddActionModal";
import { FileAttachmentDialog, FileAttachment } from "@/components/FileAttachmentDialog";
import { useVessels } from "@/hooks/useVessels";
import { sireHardwareClasses, findHardwareClassById } from "@/data/sireHardwareClasses";
import { defectSources, findSourceById } from "@/data/defectSources";
import { getSireReferencesByVersion } from "@/data/sireReferences";
import { SireHardwareClassCombobox } from "@/components/SireHardwareClassCombobox";
import { VesselComponentCombobox, type VesselComponentSelection } from "@/components/VesselComponentCombobox";
import { getActiveRank } from "@/lib/activeRank";
import { usePermissions } from "@/contexts/PermissionsContext";
import {
  ApprovalChainProgress,
  defectApprovalChainQueryKey,
  useDefectApprovalChain,
  type DefectApprovalChain,
} from "@/components/approvals/ApprovalChainProgress";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  approvalDecisionApplyError,
  approvalPreviewMessage,
  hasPersistedApprovalRequest,
  isC1CloseoutComplete,
  resolveDefectExtensionUi,
  resolveEffectiveExtensionRequestStatus,
  resolveDefectApprovalPresentation,
  resolveVerificationDisplay,
  hasPendingExtensionForEntries,
  isOrphanedRequestedExtensionAt,
  extensionEntryPermissions,
  projectExtensionHistory,
  type ApprovalPreviewStep,
  type DefectApprovalRoutingPreview,
} from "./defectApprovalPresentation";

type ExtensionHistoryRecord = {
  id: string;
  existingTargetDate: string;
  newTargetDate: string;
  reasonForExtension: string;
  status: "Requested" | "Approved" | "Rejected";
  requestedAt: string;
  submitForApprovalToName?: string;
  electronicConfirmation?: string;
  approverComments?: string;
  approved?: boolean;
  approvalDate?: string;
};

function ExtensionHistoryCard({
  entry,
  index,
  total,
  chain,
}: {
  entry: ExtensionHistoryRecord;
  index: number;
  total: number;
  chain?: DefectApprovalChain | null;
}) {
  const permissions = extensionEntryPermissions(entry, index, total, false);
  const status = String(entry.status || "Requested").toUpperCase();
  return (
    <details open={permissions.current && !permissions.terminal} className="rounded border border-slate-200 bg-white" data-testid={`extension-history-${entry.id}`}>
      <summary className="cursor-pointer list-none px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-slate-800">Extension {index + 1} of {total} — {status}</span>
          <span className="text-xs text-slate-500">{permissions.current ? "Current" : "Historical"}</span>
        </div>
      </summary>
      <div className="grid gap-3 border-t border-slate-100 p-4 text-sm md:grid-cols-2">
        <div><span className="text-slate-500">Existing target date</span><div className="font-medium">{entry.existingTargetDate || "Not recorded"}</div></div>
        <div><span className="text-slate-500">New target date</span><div className="font-medium">{entry.newTargetDate || "Not recorded"}</div></div>
        <div className="md:col-span-2"><span className="text-slate-500">Reason</span><div className="whitespace-pre-wrap">{entry.reasonForExtension || "Not recorded"}</div></div>
        <div><span className="text-slate-500">Requested</span><div>{entry.requestedAt ? new Date(entry.requestedAt).toLocaleString() : "Not recorded"}</div></div>
        <div>
          <span className="text-slate-500">Decision attribution / local confirmation</span>
          <div className="space-y-0.5">
            {entry.submitForApprovalToName && <div>Intended approver: {entry.submitForApprovalToName}</div>}
            {entry.approvalDate && <div>Approval date: {entry.approvalDate}</div>}
            {entry.electronicConfirmation && <div>Electronic confirmation: {entry.electronicConfirmation}</div>}
            {entry.approverComments && <div>Approver comments: {entry.approverComments}</div>}
            {!entry.submitForApprovalToName && !entry.approvalDate && !entry.electronicConfirmation && !entry.approverComments && <div>Not recorded</div>}
          </div>
        </div>
        <div className="md:col-span-2">
          {chain ? <ApprovalChainProgress screenId="" subjectRef={null} chain={chain} /> : (
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600" data-testid={`extension-chain-unmatched-${entry.id}`}>
              No approval chain is associated with this entry. Historical approval data was not inferred.
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

const defectFormSchema = insertDefectSchema.extend({
  critical: z.boolean().optional(),
  is_coc: z.boolean().optional(),
  // Mandatory field validations
  vesselId: z.string().min(1, "Vessel is required"),
  issueDate: z.string().min(1, "Date Observed is required"),
  description: z.string().min(1, "Description is required"),
});

type DefectFormData = z.infer<typeof defectFormSchema>;

type DefectSaveResult =
  | { kind: "save-in-progress"; saved: false; success: false }
  | { kind: "missing-required-fields"; saved: false; success: false; fields: string[] }
  | { kind: "validation-failure"; saved: false; success: false }
  | { kind: "server-rejection"; saved: false; success: false; message: string }
  | { kind: "network-failure"; saved: false; success: false; message: string }
  | { kind: "saved-success"; saved: true; success: true; approvalSubmission: "submitted" | "not-required" }
  | { kind: "saved-approval-failed"; saved: true; success: false; approvalSubmission: "failed"; message: string };

const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"], { required_error: "Choose Approve or Reject." }),
  remarks: z.string().optional(),
}).superRefine((value, context) => {
  if (value.decision === "reject" && !value.remarks?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["remarks"], message: "A rejection comment is required." });
  }
});
type DecisionFormData = z.infer<typeof decisionSchema>;

type ApprovalWorkflowPreviewData = {
  routing: DefectApprovalRoutingPreview;
  steps: ApprovalPreviewStep[];
};

function ApprovalWorkflowPreview({
  routing,
  steps,
  action,
}: ApprovalWorkflowPreviewData & { action: "extension" | "verification" }) {
  return (
    <div className="rounded border border-blue-200 bg-blue-50/40 p-3 text-sm text-blue-900" data-testid={`approval-preview-${action}`}>
      <div className="font-medium mb-1">Approval workflow</div>
      <div>{approvalPreviewMessage(routing, steps)}</div>
    </div>
  );
}

function ApprovalDecisionPanel({
  chain,
  defectId,
  action,
  canEdit,
  onDecided,
}: {
  chain: DefectApprovalChain;
  defectId: string | number;
  action: "extension" | "verification";
  canEdit: boolean;
  onDecided: () => void;
}) {
  const decisionForm = useForm<DecisionFormData>({
    resolver: zodResolver(decisionSchema),
    defaultValues: { decision: undefined, remarks: "" },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const submitDecision = async (values: DecisionFormData) => {
    if (!chain.requestUuid) return;
    setIsSubmitting(true);
    try {
      const response = await apiRequest("POST", `/technical/api/approval-engine/requests/${encodeURIComponent(chain.requestUuid)}/decide`, {
        decision: values.decision,
        remarks: values.remarks?.trim() || undefined,
      });
      const result = await response.json().catch(() => ({}));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: defectApprovalChainQueryKey(defectId, action) }),
        queryClient.invalidateQueries({ queryKey: ["defects"] }),
        queryClient.invalidateQueries({ queryKey: ["/technical/api/defects"] }),
      ]);
      onDecided();
      const applyError = approvalDecisionApplyError(result);
      if (applyError) {
        toast({
          title: "Approval recorded, but the defect was not updated",
          description: `${applyError} Retry the defect update or contact your administrator.`,
          variant: "destructive",
        });
        return;
      }
      toast({ title: values.decision === "approve" ? "Approval recorded" : "Request rejected" });
    } catch (error) {
      toast({ title: "Could not record approval decision", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canEdit || !chain.currentUserCanDecide || !chain.requestUuid || String(chain.requestStatus).toLowerCase() !== "pending") return null;
  return (
    <Form {...decisionForm}>
      <form className="mt-3 space-y-3 rounded border border-blue-200 bg-blue-50/40 p-3" data-testid={`approval-decision-${action}`} onSubmit={(event) => event.preventDefault()}>
        <FormField
          control={decisionForm.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remarks {decisionForm.watch("decision") === "reject" ? "(required for rejection)" : "(optional)"}</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Add remarks for this decision..." className="min-h-[64px] bg-white" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="destructive"
            disabled={isSubmitting}
            onClick={() => {
              decisionForm.setValue("decision", "reject", { shouldValidate: true });
              void decisionForm.handleSubmit(submitDecision)();
            }}
            data-testid={`button-reject-${action}`}
          >
            Reject
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              decisionForm.setValue("decision", "approve", { shouldValidate: true });
              void decisionForm.handleSubmit(submitDecision)();
            }}
            data-testid={`button-approve-${action}`}
          >
            Approve
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function DefectApprovalStatus({
  action,
  defectId,
  approval,
  canEdit,
  previewWhenNoRequest = false,
}: {
  action: "extension" | "verification";
  defectId: string | number | null;
  approval: ReturnType<typeof useDefectApprovalChain>;
  canEdit: boolean;
  previewWhenNoRequest?: boolean;
}) {
  const actionLabel = action === "extension" ? "Defect Target Date Extension" : "Defect Verification";
  const presentation = resolveDefectApprovalPresentation(approval, canEdit);
  if (presentation.state === "idle") return null;
  if (presentation.state === "loading") {
    return <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600" data-testid={`approval-status-loading-${action}`}>Loading approval status...</div>;
  }
  if (presentation.state === "error") {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid={`approval-status-error-${action}`}>
        <div>{presentation.message}</div>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void approval.refetch()} data-testid={`button-retry-approval-${action}`}>Retry</Button>
      </div>
    );
  }
  if (presentation.state === "ship-unavailable") {
    return (
      <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800" data-testid={`approval-status-ship-unavailable-${action}`}>
        {presentation.message}
      </div>
    );
  }
  const chain = approval.data;
  if (presentation.state === "no-workflow") {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" data-testid={`approval-status-no-workflow-${action}`}>
        No approval workflow is configured for {actionLabel}{chain?.classification ? ` (${chain.classification})` : ""}. Contact your administrator.
      </div>
    );
  }
  if (!chain) return null;
  if (previewWhenNoRequest && !hasPersistedApprovalRequest(chain)) {
    return (
      <ApprovalWorkflowPreview
        action={action}
        routing={{
          scope: chain.scope ?? "",
          classification: chain.classification ?? "this request",
          activeWorkflowExists: chain.hasActiveWorkflow,
          fellBackFromRepeatScope: false,
        }}
        steps={(chain.steps ?? []).map((step, index) => ({
          label: step.label || step.name || `Step ${index + 1}`,
          roles: (step.slots ?? []).map((slot) => slot.roleLabel || "Approver"),
        }))}
      />
    );
  }
  return (
    <>
      <ApprovalChainProgress screenId="" subjectRef={null} chain={chain} />
      {presentation.showDecisionControls && defectId !== null && <ApprovalDecisionPanel chain={chain} defectId={defectId} action={action} canEdit={canEdit} onDecided={() => void approval.refetch()} />}
    </>
  );
}

interface Action {
  id: string;
  actionType: string;
  actionDescription: string;
  proposedBy: string;
  responsibility: string;
  dueDate: string;
  dateCompleted?: string;
  status: string;
}

interface DefectFormWizardProps {
  defect?: any;
  mode?: 'view' | 'edit' | 'new';
  initialStep?: 1 | 2 | 3;
  onCompleted?: () => void;
  onBack?: () => void;
  isCoc?: boolean; // Pre-select CoC checkbox when opened from CoC section
}

export default function DefectFormWizard({ 
  defect, 
  mode = 'new', 
  initialStep = 1,
  onCompleted,
  onBack,
  isCoc = false
}: DefectFormWizardProps = {}) {
  console.log('[DefectFormWizard] Rendering with mode:', mode, 'defect:', defect?.id);
  const { toast } = useToast();
  const { canEdit } = usePermissions();
  const isMasterRank = (getActiveRank() || '').trim() === 'Master';
  const { data: vessels = [] } = useVessels();
  
  // Fetch equipment categories from database
  const { data: equipmentCategories = [] } = useQuery<{ id: number; name: string; sortOrder: number }[]>({
    queryKey: ['/technical/api/equipment-categories'],
  });
  
  // Fetch defect categories from database
  const { data: defectCategoriesData = [] } = useQuery<{ id: number; name: string; sortOrder: number }[]>({
    queryKey: ['/technical/api/defect-categories'],
  });
  
  // Fetch defect types from database
  const { data: defectTypesData = [] } = useQuery<{ id: number; name: string; sortOrder: number }[]>({
    queryKey: ['/technical/api/defect-types'],
  });
  const [, setLocation] = useLocation();
  const params = useParams();
  const [activeSection, setActiveSection] = useState<'A' | 'B' | 'C'>('A');
  const [actions, setActions] = useState<Action[]>([]);
  const [isImmediateCauseModalOpen, setIsImmediateCauseModalOpen] = useState(false);
  const [isRootCauseModalOpen, setIsRootCauseModalOpen] = useState(false);
  const [isAddActionModalOpen, setIsAddActionModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(mode === 'view');
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  const [isAttachmentDialogOpen, setIsAttachmentDialogOpen] = useState(false);
  const [partAAttachments, setPartAAttachments] = useState<FileAttachment[]>([]);
  const [isPartAAttachmentDialogOpen, setIsPartAAttachmentDialogOpen] = useState(false);
  
  // Track created defect ID to prevent duplicate creation
  const [createdDefectId, setCreatedDefectId] = useState<number | null>(null);
  // Prevent duplicate saves from rapid clicks
  const [isSaving, setIsSaving] = useState(false);
  
  // B5 Target Date Extension state
  const [showExtensionForm, setShowExtensionForm] = useState(false);
  const [targetDateExtensions, setTargetDateExtensions] = useState<Array<{
    id: string;
    existingTargetDate: string;
    newTargetDate: string;
    reasonForExtension: string;
    submitForApprovalTo?: string;
    submitForApprovalToName?: string;
    status: 'Requested' | 'Approved' | 'Rejected';
    approved?: boolean;
    approvalDate?: string;
    approverComments?: string;
    electronicConfirmation?: string;
    requestedAt: string;
  }>>([]);
  const [currentExtension, setCurrentExtension] = useState({
    newTargetDate: '',
    reasonForExtension: '',
  });
  const [debouncedExtensionDate, setDebouncedExtensionDate] = useState('');
  const [isSubmittingExtension, setIsSubmittingExtension] = useState(false);
  
  // Section refs for scroll tracking
  const partARef = useRef<HTMLDivElement>(null);
  const partBRef = useRef<HTMLDivElement>(null);
  const partCRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const generateReference = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `DN/007/${year}/${random}/V`;
  };

  const [defectId] = useState(generateReference());
  
  const { data: fetchedDefect, isLoading: isLoadingDefect, error: fetchError } = useQuery({
    queryKey: ['defects', params.id],
    enabled: !!params.id && !defect,
    queryFn: async () => {
      const response = await fetch(`/technical/api/defects/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch defect');
      return response.json();
    }
  });
  
  const currentDefect = defect || fetchedDefect;
  const approvalDefectId = currentDefect?.id ?? params.id ?? createdDefectId ?? null;
  const extensionApproval = useDefectApprovalChain(approvalDefectId, "extension");
  const verificationApproval = useDefectApprovalChain(approvalDefectId, "verification");
  const canEditDefect = canEdit("defects-active");
  const verificationDisplay = resolveVerificationDisplay(
    verificationApproval.data,
    currentDefect,
  );
  
  // Compute the correct is_coc default: use existing defect value if available, otherwise use isCoc prop for new defects
  const defaultIsCoc = currentDefect?.is_coc ?? isCoc;
  
  const form = useForm<DefectFormData>({
    resolver: zodResolver(defectFormSchema),
    defaultValues: {
      vesselId: "",
      vesselName: "",
      issueDate: new Date().toISOString().split('T')[0],
      category: "Defect",
      equipmentCategory: "",
      status: "Open",
      priority: "Medium",
      critical: false,
      is_coc: defaultIsCoc, // Use defect's value if editing, or isCoc prop for new defects
      severity: 1,
      reportedBy: "MASTER",
      description: "",
      immediateCause: "",
      immediateCauseExplanation: "",
      rootCause: "",
      rootCauseExplanation: "",
      riskLevel: "",
      vesselLocationType: "atPort",
      dateRegisteredInSystem: new Date().toISOString().split('T')[0],
      viqVersion: "SIRE 2.0",
    },
  });

  const dateCompletedValue = form.watch("dateCompleted");
  const confirmCompletedValue = form.watch("confirmCompleted");
  const closedByNameValue = form.watch("closedByName");
  const closedByRankValue = form.watch("closedByRank");
  const liveTargetDate = form.watch("targetCloseDate") || "";
  const vesselLocationType = form.watch("vesselLocationType");
  const dateRegisteredInSystemValue = form.watch("dateRegisteredInSystem");
  const viqVersionValue = form.watch("viqVersion");
  
  const sireReferenceOptions = getSireReferencesByVersion(viqVersionValue || "");

  const rawExtensionChains = (extensionApproval.data as (DefectApprovalChain & {
    extensionChains?: Record<string, DefectApprovalChain>;
  }) | undefined)?.extensionChains;
  const hasExtensionChainsProjection = Boolean(
    extensionApproval.data &&
    Object.prototype.hasOwnProperty.call(extensionApproval.data, "extensionChains"),
  );
  const extensionHistory = projectExtensionHistory(
    targetDateExtensions as ExtensionHistoryRecord[],
    rawExtensionChains,
    canEditDefect && !isViewMode,
  );
  const orderedExtensions = extensionHistory.map((row) => row.entry);
  const latestExtension = orderedExtensions[orderedExtensions.length - 1] ?? null;
  const currentExtensionChain = latestExtension
    ? (hasExtensionChainsProjection ? rawExtensionChains?.[latestExtension.id] : extensionApproval.data)
    : extensionApproval.data;
  const currentExtensionApproval = currentExtensionChain && extensionApproval.data
    ? { ...extensionApproval, data: currentExtensionChain }
    : extensionApproval;
  const hasSavedExtension = latestExtension !== null;
  const effectiveExtensionStatus = resolveEffectiveExtensionRequestStatus(
    latestExtension?.status,
    currentExtensionChain?.requestStatus,
  );
  const extensionUi = resolveDefectExtensionUi({
    formOpen: showExtensionForm,
    hasStoredExtension: hasSavedExtension,
    requestStatus: effectiveExtensionStatus,
    currentUserCanDecide: currentExtensionChain?.currentUserCanDecide,
    canEdit: canEditDefect && !isViewMode,
  });
  const isDraftingExtension = extensionUi.state === "draft-preview";
  const displayedExtension = isDraftingExtension ? null : latestExtension;
  const displayedExtensionStatus = effectiveExtensionStatus === "approved"
    ? "Approved"
    : effectiveExtensionStatus === "rejected" || effectiveExtensionStatus === "returned"
      ? "Rejected"
      : displayedExtension?.status;
  const hasPendingExtension = extensionUi.state === "requester-pending" || extensionUi.state === "approver-pending";
  const hasPendingExtensionRequest = hasPendingExtensionForEntries(targetDateExtensions, currentExtensionChain);
  const latestExtensionIndex = latestExtension
    ? targetDateExtensions.findIndex((entry) => entry.id === latestExtension.id)
    : -1;
  const orphanedRequestedExtension = isOrphanedRequestedExtensionAt(
    targetDateExtensions, latestExtensionIndex, currentExtensionChain,
  );
  const validDraftExtensionDate = Boolean(
    /^\d{4}-\d{2}-\d{2}$/.test(currentExtension.newTargetDate) &&
    liveTargetDate &&
    currentExtension.newTargetDate > liveTargetDate,
  );
  const c1CloseoutComplete = isC1CloseoutComplete({
    confirmCompleted: confirmCompletedValue,
    dateCompleted: dateCompletedValue,
    closedByName: closedByNameValue,
    closedByRank: closedByRankValue,
  });
  const isExtensionDateSettled = debouncedExtensionDate === currentExtension.newTargetDate;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedExtensionDate(validDraftExtensionDate ? currentExtension.newTargetDate : "");
    }, 350);
    return () => window.clearTimeout(timer);
  }, [currentExtension.newTargetDate, validDraftExtensionDate]);

  const extensionPreview = useQuery<ApprovalWorkflowPreviewData>({
    queryKey: ["defect-approval-preview", approvalDefectId, debouncedExtensionDate],
    enabled: isDraftingExtension && Boolean(approvalDefectId) && Boolean(debouncedExtensionDate) && isExtensionDateSettled,
    retry: false,
    queryFn: async () => {
      const defectId = encodeURIComponent(String(approvalDefectId));
      const routingResponse = await fetch(
        `/technical/api/defects/${defectId}/approval-routing?action=extension&newTargetDate=${encodeURIComponent(debouncedExtensionDate)}`,
      );
      if (!routingResponse.ok) throw new Error("Could not determine the approval chain.");
      const routing = await routingResponse.json() as DefectApprovalRoutingPreview;
      if (!routing.activeWorkflowExists) return { routing, steps: [] };

      const scopeQuery = new URLSearchParams({
        moduleId: "defects",
        screenId: routing.scope,
        actionId: "",
      });
      const workflowListResponse = await fetch(`/technical/api/approval-engine/workflows?${scopeQuery}`);
      if (!workflowListResponse.ok) throw new Error("Could not determine the approval chain.");
      const workflows = await workflowListResponse.json() as Array<{
        wfuuid: string;
        classification: string;
        status: string;
        version: number;
      }>;
      const workflow = workflows
        .filter((item) => item.classification === routing.classification && item.status === "active")
        .sort((a, b) => b.version - a.version)[0];
      if (!workflow) throw new Error("Could not determine the approval chain.");

      const workflowResponse = await fetch(
        `/technical/api/approval-engine/workflows/${encodeURIComponent(workflow.wfuuid)}`,
      );
      if (!workflowResponse.ok) throw new Error("Could not determine the approval chain.");
      const workflowDetails = await workflowResponse.json() as {
        nodes?: Array<{
          type?: string;
          label?: string;
          key?: string;
          ordinal?: number;
          slots?: Array<{ roleLabel?: string }>;
        }>;
      };
      const steps = (workflowDetails.nodes ?? [])
        .filter((node) => node.type === "approval-step")
        .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
        .map((node, index) => ({
          label: node.label || node.key || `Step ${index + 1}`,
          roles: (node.slots ?? []).map((slot) => slot.roleLabel || "Approver"),
        }));
      return { routing, steps };
    },
  });
  
  useEffect(() => {
    if (vesselLocationType === 'atPort') {
      form.setValue('latitude', '');
      form.setValue('longitude', '');
    } else if (vesselLocationType === 'atSea') {
      form.setValue('portName', '');
    }
  }, [vesselLocationType, form]);

  useEffect(() => {
    if (viqVersionValue && mode !== 'edit') {
      form.setValue('viqRef', '');
    }
  }, [viqVersionValue, form, mode]);

  useEffect(() => {
    if (currentDefect) {
      form.reset({
        ...currentDefect,
        issueDate: currentDefect.issueDate || new Date().toISOString().split('T')[0],
        dateCompleted: currentDefect.dateCompleted || '',
        targetCloseDate: currentDefect.targetCloseDate || '',
        verifiedDate: currentDefect.verifiedDate || '',
        // Explicitly preserve the defect's is_coc value, don't fall back to isCoc prop for existing defects
        is_coc: currentDefect.is_coc ?? false,
      });
      
      if (currentDefect.actions && Array.isArray(currentDefect.actions)) {
        setActions(currentDefect.actions);
      }
      
      if (currentDefect.partAAttachments && Array.isArray(currentDefect.partAAttachments)) {
        setPartAAttachments(currentDefect.partAAttachments);
      }
      
      if (currentDefect.attachments && Array.isArray(currentDefect.attachments)) {
        setFileAttachments(currentDefect.attachments);
      }
      
      if (currentDefect.targetDateExtensions && Array.isArray(currentDefect.targetDateExtensions)) {
        setTargetDateExtensions(currentDefect.targetDateExtensions);
        
        // Restore only the editable request fields; approver/decision fields are
        // owned by the approval workflow and are never manually edited here.
        if (currentDefect.targetDateExtensions.length > 0) {
          const lastExt = currentDefect.targetDateExtensions[currentDefect.targetDateExtensions.length - 1];
          setCurrentExtension({
            newTargetDate: lastExt.newTargetDate || '',
            reasonForExtension: lastExt.reasonForExtension || '',
          });
        }
      }
    }
  }, [currentDefect]);

  const buildImmediateCauseText = (ic: { unsafeAct: string[]; unsafeCondition: string[] }): string => {
    const sections: string[] = [];
    if (ic?.unsafeAct?.length) {
      sections.push("UNSAFE ACT", ...ic.unsafeAct.map(item => `• ${item}`));
    }
    if (ic?.unsafeCondition?.length) {
      if (sections.length) sections.push("");
      sections.push("UNSAFE CONDITION", ...ic.unsafeCondition.map(item => `• ${item}`));
    }
    return sections.join("\n");
  };

  const buildRootCauseText = (rc: { individualFactor: string[]; systemFactor: string[] }): string => {
    const sections: string[] = [];
    if (rc?.individualFactor?.length) {
      sections.push("INDIVIDUAL FACTOR", ...rc.individualFactor.map(item => `• ${item}`));
    }
    if (rc?.systemFactor?.length) {
      if (sections.length) sections.push("");
      sections.push("SYSTEM FACTOR", ...rc.systemFactor.map(item => `• ${item}`));
    }
    return sections.join("\n");
  };

  const handleImmediateCauseSelect = () => {
    setIsImmediateCauseModalOpen(true);
  };

  const handleImmediateCauseSubmit = (causeData: { unsafeAct: string[], unsafeCondition: string[] }) => {
    form.setValue('immediateCause', causeData as any);
    setIsImmediateCauseModalOpen(false);
  };

  const handleRootCauseSelect = () => {
    setIsRootCauseModalOpen(true);
  };

  const handleRootCauseSubmit = (causeData: { individualFactor: string[], systemFactor: string[] }) => {
    form.setValue('rootCause', causeData as any);
    setIsRootCauseModalOpen(false);
  };

  const saveDefect = async (data: DefectFormData, showToast = true, navigate = false, extensionsOverride?: typeof targetDateExtensions): Promise<DefectSaveResult> => {
    // Prevent duplicate saves from rapid clicks
    if (isSaving) {
      return { kind: "save-in-progress", saved: false, success: false };
    }
    
    // Validate mandatory fields: Vessel, Date Observed (issueDate), and Description
    const vesselId = data.vesselId?.trim() || '';
    const issueDate = data.issueDate?.trim() || '';
    const description = data.description?.trim() || '';
    const componentId = data.componentId?.trim() || '';

    if (!vesselId || !issueDate || !description || !componentId) {
      const missingFields: string[] = [];
      if (!vesselId) missingFields.push('Vessel');
      if (!issueDate) missingFields.push('Date Observed');
      if (!description) missingFields.push('Description');
      if (!componentId) missingFields.push('Component');
      
      toast({ 
        title: "Required fields missing", 
        description: `Please fill in: ${missingFields.join(', ')}`,
        variant: "destructive" 
      });
      return { kind: "missing-required-fields", saved: false, success: false, fields: missingFields };
    }

    const effectiveExtensions = extensionsOverride ?? targetDateExtensions;
    const lastExt = effectiveExtensions[effectiveExtensions.length - 1];
    const b5Touched = !!(currentExtension.newTargetDate || currentExtension.reasonForExtension?.trim() || (showExtensionForm && effectiveExtensions.length === 0));
    const matchesLast = !!lastExt &&
      (lastExt.newTargetDate || '') === (currentExtension.newTargetDate || '') &&
      (lastExt.reasonForExtension || '') === (currentExtension.reasonForExtension || '');
    if (b5Touched && !matchesLast) {
      const missingB5: string[] = [];
      if (!currentExtension.newTargetDate) missingB5.push('New Target Date');
      if (!currentExtension.reasonForExtension?.trim()) missingB5.push('Reason for Extension');
      if (missingB5.length > 0) {
        toast({
          title: 'Part B5 incomplete',
          description: `Please fill in: ${missingB5.join(', ')}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Part B5 has an unsaved extension',
          description: 'Click the Submit button inside the B5 section to save the extension, or clear the fields before submitting.',
          variant: 'destructive',
        });
      }
      return { kind: "validation-failure", saved: false, success: false };
    }

    // Part C (C1. Closeout) validation: if any field is filled, all must be filled
    const partCFields = {
      confirmCompleted: data.confirmCompleted || false,
      dateCompleted: data.dateCompleted?.trim() || '',
      closedByName: data.closedByName?.trim() || '',
      closedByRank: data.closedByRank?.trim() || '',
    };
    
    const partCFilled = Object.values(partCFields).some(val => 
      typeof val === 'boolean' ? val : val !== ''
    );
    const partCComplete = partCFields.confirmCompleted && 
      partCFields.dateCompleted !== '' && 
      partCFields.closedByName !== '' && 
      partCFields.closedByRank !== '';
    
    if (partCFilled && !partCComplete) {
      const missingPartC: string[] = [];
      if (!partCFields.confirmCompleted) missingPartC.push('Confirm Completed');
      if (!partCFields.dateCompleted) missingPartC.push('Date Completed');
      if (!partCFields.closedByName) missingPartC.push('Closed By (Name)');
      if (!partCFields.closedByRank) missingPartC.push('Closed By (Rank)');
      
      toast({
        title: "Part C incomplete",
        description: `Once started, all Part C fields are required: ${missingPartC.join(', ')}`,
        variant: "destructive"
      });
      return { kind: "validation-failure", saved: false, success: false };
    }
    
    setIsSaving(true);
    
    try {
      const submitData: any = {
        ...data,
        actions: actions,
        reference: defectId,
        partAAttachments: partAAttachments,
        attachments: fileAttachments,
        targetDateExtensions: extensionsOverride ?? targetDateExtensions,
      };
      
      // Use createdDefectId if we already created this defect in this session
      const existingId = currentDefect?.id || createdDefectId;
      let approvalSubmission: "submitted" | "not-required" = "not-required";
      
        if (existingId) {
          const response = await apiRequest('PATCH', `/technical/api/defects/${existingId}`, submitData);
          // Newer servers return a structured outcome. A persisted defect must remain
          // usable when the post-save engine submission failed.
          let outcome: any = null;
          try { outcome = await response.clone().json(); } catch { /* legacy empty response */ }
          const submission = outcome?.approvalSubmission ?? outcome?.approval ?? null;
          if (submission?.status === "succeeded" || submission?.status === "started") {
            approvalSubmission = "submitted";
          } else if (submission?.status === "not_required") {
            approvalSubmission = "not-required";
          }
          if (submission?.status === "failed" || submission?.status === "error") {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['defects'] }),
              queryClient.invalidateQueries({ queryKey: ['/technical/api/defects'] }),
            ]);
            return {
              kind: "saved-approval-failed", saved: true, success: false, approvalSubmission: "failed",
              message: submission.message || submission.error || "Defect saved, but approval submission failed. Please contact your administrator.",
            };
          }
        queryClient.invalidateQueries({ queryKey: ['defects'] });
        queryClient.invalidateQueries({ queryKey: ['/technical/api/defects'] });
        if (showToast) {
          toast({ title: "Defect updated successfully" });
        }
      } else {
        const response = await apiRequest('POST', '/technical/api/defects', submitData);
        try {
          const createdDefect = await response.clone().json();
          const submission = createdDefect?.approvalSubmission ?? createdDefect?.approval ?? null;
          if (submission?.status === "succeeded" || submission?.status === "started") approvalSubmission = "submitted";
          if (submission?.status === "failed" || submission?.status === "error") {
            return {
              kind: "saved-approval-failed", saved: true, success: false, approvalSubmission: "failed",
              message: submission.message || submission.error || "Defect saved, but approval submission failed. Please contact your administrator.",
            };
          }
          if (createdDefect && createdDefect.id) {
            setCreatedDefectId(createdDefect.id);
          }
        } catch (e) {
        }
        queryClient.invalidateQueries({ queryKey: ['defects'] });
        queryClient.invalidateQueries({ queryKey: ['/technical/api/defects'] });
        if (showToast) {
          toast({ title: "Defect created successfully" });
        }
      }
      
      if (navigate && onCompleted) {
        onCompleted();
      } else if (navigate) {
        setLocation("/defects/active");
      }
      return { kind: "saved-success", saved: true, success: true, approvalSubmission };
    } catch (error) {
      // Approval-gate refusals (403 Master-only, 409 pending approval) carry the reason —
      // surface it instead of a blind generic message.
      const rawMessage = error instanceof Error ? error.message : "Could not save defect.";
      let message = rawMessage;
      const jsonStart = rawMessage.indexOf("{");
      if (jsonStart >= 0) {
        try {
          const payload = JSON.parse(rawMessage.slice(jsonStart));
          message = payload.message || payload.error || rawMessage;
        } catch { /* retain the transport message */ }
      }
      toast({ title: "Error saving defect", description: message, variant: "destructive" });
      const kind = /^(403|409|400|422)\b/.test(rawMessage) ? "server-rejection" as const : "network-failure" as const;
      return { kind, saved: false, success: false, message };
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = async (data: DefectFormData) => {
    await saveDefect(data, true, false);
  };

  const handleStepSubmit = async (stepNumber: number): Promise<boolean> => {
    const data = form.getValues();
    const result = await saveDefect(data, true, false);
    if (result.saved && result.success) {
      if (stepNumber === 3 && approvalDefectId !== null) {
        await queryClient.invalidateQueries({
          queryKey: defectApprovalChainQueryKey(approvalDefectId, "verification"),
        });
      }
      const partLabel = stepNumber === 1 ? 'A' : stepNumber === 2 ? 'B' : 'C';
      toast({ title: `Part ${partLabel} submitted successfully.` });
    }
    return result.saved && result.success;
  };

  const openAddActionModal = () => {
    setEditingAction(null);
    setIsAddActionModalOpen(true);
  };

  const openEditActionModal = (action: Action) => {
    setEditingAction(action);
    setIsAddActionModalOpen(true);
  };

  const handleSaveAction = (actionData: any) => {
    let updatedActions;
    if (editingAction) {
      updatedActions = actions.map(a => a.id === editingAction.id ? { ...editingAction, ...actionData } : a);
      setActions(updatedActions);
      toast({ title: "Action updated successfully" });
    } else {
      const newAction: Action = {
        id: Date.now().toString(),
        ...actionData,
      };
      updatedActions = [...actions, newAction];
      setActions(updatedActions);
      toast({ title: "Action added successfully" });
    }
    form.setValue('actions', updatedActions as any);
    setEditingAction(null);
  };

  const deleteAction = (id: string) => {
    const updatedActions = actions.filter(a => a.id !== id);
    setActions(updatedActions);
    form.setValue('actions', updatedActions as any);
    toast({ title: "Action deleted" });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      const updatedAttachments = [...attachments, ...newFiles];
      setAttachments(updatedAttachments);
      
      const attachmentMetadata = updatedAttachments.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
      }));
      form.setValue('attachments', attachmentMetadata as any);
      
      toast({ title: `${newFiles.length} file(s) selected` });
    }
  };

  const toggleViewMode = () => {
    setIsViewMode(!isViewMode);
  };

  const handleClose = async () => {
    // Auto-save before closing only if form has been modified by the user
    if (form.formState.isDirty) {
      const data = form.getValues();
      const result = await saveDefect(data, false, false);
      if (result.saved) toast({ title: "Defect saved automatically" });
    }
    
    if (onBack) {
      onBack();
    } else {
      setLocation("/defects/active");
    }
  };

  // IntersectionObserver for scroll-based section highlighting
  // IMPORTANT: This useEffect MUST be before any conditional returns to follow React's Rules of Hooks
  useEffect(() => {
    const observerOptions = {
      root: scrollContainerRef.current,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section');
          if (sectionId === 'A' || sectionId === 'B' || sectionId === 'C') {
            setActiveSection(sectionId);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    if (partARef.current) observer.observe(partARef.current);
    if (partBRef.current) observer.observe(partBRef.current);
    if (partCRef.current) observer.observe(partCRef.current);

    return () => observer.disconnect();
  }, []);
  
  if (isLoadingDefect) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading defect...</p>
        </div>
      </div>
    );
  }
  
  if (fetchError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="mb-4 text-red-500">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-800 font-medium mb-2">Failed to load defect</p>
          <p className="text-gray-600 mb-4">The defect could not be found or an error occurred.</p>
          <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700">
            Back to Defects
          </Button>
        </div>
      </div>
    );
  }
  
  const getTitle = () => {
    if (!currentDefect) return 'New Defect Report';
    return isViewMode ? 'View Defect Report' : 'Edit Defect Report';
  };

  const steps = [
    { id: 1, label: 'A', name: 'Reporting', ref: partARef },
    { id: 2, label: 'B', name: 'Analysis & Actions', ref: partBRef },
    { id: 3, label: 'C', name: 'Closeout', ref: partCRef },
  ];

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleExportPdf = () => {
    const data = form.getValues();
    const vesselName = vessels.find((v: any) => v.id === data.vesselId)?.name || data.vesselName || '';
    const sourceName = findSourceById(data.source || '')?.name || data.source || '';
    const componentDisplay = data.componentHardwareLevel3 || '';
    const sireHardwareDisplay = data.sireHardwareLevel3 || '';

    const immediateCauseVal = data.immediateCause;
    const immediateCauseText = typeof immediateCauseVal === 'object' && immediateCauseVal
      ? buildImmediateCauseText(immediateCauseVal as { unsafeAct: string[]; unsafeCondition: string[] })
      : String(immediateCauseVal || '');

    const rootCauseVal = data.rootCause;
    const rootCauseText = typeof rootCauseVal === 'object' && rootCauseVal
      ? buildRootCauseText(rootCauseVal as { individualFactor: string[]; systemFactor: string[] })
      : String(rootCauseVal || '');

    const lastExt = targetDateExtensions.length > 0 ? targetDateExtensions[targetDateExtensions.length - 1] : null;

    const pdfData: DefectReportPdfData = {
      reportId: currentDefect?.defectId || defectId,
      vessel: vesselName,
      category: data.equipmentCategory || '',
      dateObserved: formatDate(data.issueDate),
      source: sourceName,
      component: componentDisplay,
      dateReportedToOffice: formatDate(data.dateReportedToOffice),
      defectCategory: data.defectCategory || '',
      make: data.equipmentMake || '',
      dateRegisteredInSystem: formatDate(data.dateRegisteredInSystem),
      defectType: data.defectType || '',
      model: data.equipmentModel || '',
      targetDate: formatDate(data.targetCloseDate),
      raisedBy: data.reportedBy || '',
      isCoc: data.is_coc || false,
      isCritical: data.critical || false,
      dateClosed: formatDate(data.dateCompleted),
      description: data.description || '',

      immediateCause: immediateCauseText,
      immediateCauseExplanation: data.immediateCauseExplanation || '',
      rootCause: rootCauseText,
      rootCauseExplanation: data.rootCauseExplanation || '',
      sireVersion: data.viqVersion || '',
      sireReference: data.viqRef || '',
      sireHardwareClass: sireHardwareDisplay,
      riskLevel: data.riskLevel || '',
      priority: data.priority || '',
      actions: actions.map(a => ({
        actionType: a.actionType || '',
        description: a.actionDescription || '',
        proposedBy: a.proposedBy || '',
        responsibility: a.responsibility || '',
        dueDate: formatDate(a.dueDate),
        status: a.status || '',
      })),
      targetDateExtension: lastExt ? {
        existingTargetDate: formatDate(lastExt.existingTargetDate),
        newTargetDate: formatDate(lastExt.newTargetDate),
        reasonForExtension: lastExt.reasonForExtension || '',
        approved: lastExt.status || '',
        approvalDate: formatDate(lastExt.approvalDate),
        approverComments: lastExt.approverComments || '',
      } : undefined,

      confirmCompleted: data.confirmCompleted || false,
      dateCompleted: formatDate(data.dateCompleted),
      closedByName: data.closedByName || '',
      closedByRank: data.closedByRank || '',
      verified: data.verified || false,
      dateVerified: formatDate(data.dateVerified || (data as any).verifiedDate),
      verifiedByName: data.verifiedByName || '',
      verifiedByOfficePosition: data.verifiedByOfficePosition || '',
    };

    pdfReportGenerator.generateDefectReportPdf(pdfData);
  };

  return (
    <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold text-gray-900">{getTitle()}</h1>
        <div className="flex items-center gap-2">
          {currentDefect && (
            <Button
              variant="outline"
              onClick={handleExportPdf}
              className="text-gray-700 border-gray-300 h-9"
              data-testid="button-export-pdf"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
          {currentDefect && isViewMode && (
            <Button
              variant="outline"
              onClick={toggleViewMode}
              className="text-gray-700 border-gray-300 h-9"
              data-testid="button-toggle-mode"
            >
              <Eye className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {!isViewMode && (
            <Button
              onClick={async () => {
                const data = form.getValues();
                await saveDefect(data, true, false);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-6 font-medium"
              data-testid="button-save"
            >
              SAVE
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 h-9 w-9"
            data-testid="button-close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main layout with sidebar and content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Steps */}
        <div className="w-48 bg-gray-50 flex flex-col pt-6 shrink-0">
          {steps.map((step) => (
            <div 
              key={step.id}
              onClick={() => scrollToSection(step.ref)} 
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                activeSection === step.label 
                  ? 'bg-blue-600 text-white' 
                  : 'border-2 border-gray-300 text-gray-500 bg-white'
              }`}>
                {step.label}
              </div>
              <span className={`text-sm font-medium ${activeSection === step.label ? 'text-blue-600' : 'text-gray-600'}`}>
                {step.name}
              </span>
            </div>
          ))}
        </div>

        {/* Main Content Area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* Part A: Reporting */}
            <div ref={partARef} data-section="A" className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 scroll-mt-6">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-xl font-semibold text-[#1e3a5f]">Part A: Reporting</h2>
                  <div className="text-sm text-gray-600">
                    <span className="font-normal">Report ID: </span>
                    <span className="font-semibold text-gray-800" data-testid="text-report-id">
                      {currentDefect?.id || (mode === 'new' ? 'Auto-generated on save' : '')}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-1">Describe what happened</p>
                <div className="h-0.5 bg-blue-500 mt-3 mb-6" />
                
                <div className="space-y-6">
                  {/* Column Headers */}
                  <div className="grid grid-cols-3 gap-x-6">
                    <div className="text-sm font-semibold" style={{ color: '#1e3a5f' }}>Basic</div>
                    <div className="text-sm font-semibold" style={{ color: '#1e3a5f' }}>Equipment / Hardware</div>
                    <div className="text-sm font-semibold" style={{ color: '#1e3a5f' }}>Timeline</div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                    {/* Row 1: Vessel, Category, Date Observed */}
                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Vessel<span className="text-red-500">*</span></label>
                      <Controller
                        name="vesselId"
                        control={form.control}
                        render={({ field }) => (
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              const selectedVessel = vessels.find((v: any) => v.id === value);
                              if (selectedVessel) {
                                form.setValue('vesselName', selectedVessel.name);
                              }
                              form.setValue('componentId', '');
                              form.setValue('componentHardwareId', '');
                              form.setValue('componentHardwareLevel1', '');
                              form.setValue('componentHardwareLevel2', '');
                              form.setValue('componentHardwareLevel3', '');
                              form.setValue('equipmentMake', '');
                              form.setValue('equipmentModel', '');
                            }} 
                            value={field.value || ""} 
                            disabled={isViewMode}
                          >
                            <SelectTrigger data-testid="select-vessel" className="h-10 text-sm border-gray-300">
                              <SelectValue placeholder="Select vessel">
                                {field.value && vessels.length > 0 
                                  ? (vessels.find((v: any) => v.id === field.value)?.name || field.value)
                                  : (field.value || "Select vessel")}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {vessels.map((vessel: any) => (
                                <SelectItem key={vessel.id} value={vessel.id}>{vessel.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Category</label>
                      <Controller
                        name="equipmentCategory"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-equipment-category" className="h-10 text-sm border-gray-300">
                              <SelectValue placeholder="Select category">
                                {field.value || "Select category"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {equipmentCategories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Date Observed<span className="text-red-500">*</span></label>
                      <Input 
                        {...form.register("issueDate")} 
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        data-testid="input-date-observed"
                        className="h-10 text-sm border-gray-300"
                        disabled={isViewMode}
                      />
                    </div>

                    {/* Row 2: Source, Type, Date Reported to Office */}
                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Source</label>
                      <Controller
                        name="source"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-source" className="h-10 text-sm border-gray-300">
                              <SelectValue placeholder="Select source">
                                {field.value 
                                  ? (defectSources.find(s => s.id === field.value)?.name || field.value)
                                  : "Select source"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {defectSources.map((source) => (
                                <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Component<span className="text-red-500">*</span></label>
                      <VesselComponentCombobox
                        vesselId={form.watch('vesselId') || ""}
                        selectedId={form.watch('componentHardwareId') || ""}
                        displayValue={form.watch('componentHardwareLevel3') || ""}
                        onSelect={(selection: VesselComponentSelection) => {
                          form.setValue('componentId', selection.id);
                          form.setValue('componentHardwareId', selection.id);
                          form.setValue('componentHardwareLevel1', selection.breadcrumb);
                          form.setValue('componentHardwareLevel2', selection.code);
                          form.setValue('componentHardwareLevel3', selection.name);
                          form.setValue('equipmentMake', selection.maker || '');
                          form.setValue('equipmentModel', selection.model || '');
                        }}
                        disabled={isViewMode}
                        placeholder="Select component"
                        testId="combobox-component"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Date Reported to Office</label>
                      <Input 
                        {...form.register("dateReportedToOffice")} 
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        data-testid="input-date-reported-office"
                        className="h-10 text-sm border-gray-300"
                        disabled={isViewMode}
                      />
                    </div>

                    {/* Row 3: Defect Category, Make, Date Registered in System (SAIL) */}
                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Defect Category</label>
                      <Controller
                        name="defectCategory"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-defect-category" className="h-10 text-sm border-gray-300">
                              <SelectValue placeholder="Select defect category">
                                {field.value || "Select defect category"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {defectCategoriesData.map((cat) => (
                                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Make</label>
                      <Input
                        value={form.watch('equipmentMake') || ''}
                        readOnly
                        data-testid="input-make"
                        className="h-10 text-sm border-gray-300 bg-gray-50"
                        placeholder="Auto-filled from component"
                        tabIndex={-1}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Date Registered in System</label>
                      <Input 
                        {...form.register("dateRegisteredInSystem")} 
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        data-testid="input-date-registered-system"
                        className="h-10 text-sm border-gray-300"
                        disabled={isViewMode}
                      />
                    </div>

                    {/* Row 4: Defect Type, Model, Target Date */}
                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Defect Type</label>
                      <Controller
                        name="defectType"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                            <SelectTrigger data-testid="select-defect-type" className="h-10 text-sm border-gray-300">
                              <SelectValue placeholder="Select defect type">
                                {field.value || "Select defect type"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {defectTypesData.map((type) => (
                                <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Model</label>
                      <Input
                        value={form.watch('equipmentModel') || ''}
                        readOnly
                        data-testid="input-model"
                        className="h-10 text-sm border-gray-300 bg-gray-50"
                        placeholder="Auto-filled from component"
                        tabIndex={-1}
                      />
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1.5">
                        <label className="text-sm text-gray-600">Target Date</label>
                        {targetDateExtensions.some(ext => ext.status === 'Approved') && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800" data-testid="badge-extended">
                            Extended
                          </span>
                        )}
                      </div>
                      <Input 
                        {...form.register("targetCloseDate")} 
                        type="date"
                        min={dateRegisteredInSystemValue || ""}
                        data-testid="input-target-date"
                        className="h-10 text-sm border-gray-300"
                        disabled={isViewMode}
                      />
                    </div>

                    {/* Row 5: Raised By, CoC Checkbox, Date Closed */}
                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Raised By</label>
                      <Controller
                        name="raisedByName"
                        control={form.control}
                        render={({ field }) => (
                          <Select 
                            onValueChange={(value) => {
                              const [rank, ...nameParts] = value.split(" - ");
                              const name = nameParts.join(" - ");
                              field.onChange(name);
                              form.setValue("raisedByRank", rank);
                              form.setValue("raisedById", value);
                            }} 
                            value={form.watch("raisedByRank") && field.value ? `${form.watch("raisedByRank")} - ${field.value}` : ""}
                            disabled={isViewMode}
                          >
                            <SelectTrigger data-testid="select-raised-by" className="h-10 text-sm border-gray-300">
                              <SelectValue placeholder="Select person">
                                {form.watch("raisedByRank") && field.value 
                                  ? `${form.watch("raisedByRank")} - ${field.value}`
                                  : "Select person"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Master - System User">Master - System User</SelectItem>
                              <SelectItem value="Chief Engineer - John Mathews">Chief Engineer - John Mathews</SelectItem>
                              <SelectItem value="2nd Officer - Rahul Verma">2nd Officer - Rahul Verma</SelectItem>
                              <SelectItem value="AB - Suresh Kumar">AB - Suresh Kumar</SelectItem>
                              <SelectItem value="Chief Officer - Mike Anderson">Chief Officer - Mike Anderson</SelectItem>
                              <SelectItem value="2E - David Smith">2E - David Smith</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="flex flex-col justify-end">
                      <div className="flex items-center gap-6 h-10">
                        <Controller
                          name="is_coc"
                          control={form.control}
                          render={({ field }) => (
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="coc"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-coc"
                                disabled={isViewMode}
                              />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Label htmlFor="coc" className="text-sm font-normal cursor-pointer text-gray-700">
                                    CoC
                                  </Label>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Condition of Class</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                        />
                        <Controller
                          name="critical"
                          control={form.control}
                          render={({ field }) => (
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="critical"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-critical-eqpt"
                                disabled={isViewMode}
                              />
                              <Label htmlFor="critical" className="text-sm font-normal cursor-pointer text-gray-700">
                                Critical Eqpt.
                              </Label>
                            </div>
                          )}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Date Closed</label>
                      <Input 
                        value={dateCompletedValue || ""}
                        type="date"
                        data-testid="input-date-closed"
                        className="h-10 text-sm border-gray-300 bg-gray-50"
                        disabled
                        readOnly
                      />
                    </div>
                  </div>

                  {/* Vessel Location Section - Hidden for now */}
                  {false && <div className="space-y-4 bg-gray-50 p-4 rounded-md border border-gray-200 mt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700">Vessel Location</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Select vessel location type</p>
                      </div>
                      <Controller
                        name="vesselLocationType"
                        control={form.control}
                        render={({ field }) => (
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-medium ${field.value === 'atPort' ? 'text-blue-600' : 'text-gray-500'}`}>
                              At Port
                            </span>
                            <Switch
                              checked={field.value === 'atSea'}
                              onCheckedChange={(checked) => field.onChange(checked ? 'atSea' : 'atPort')}
                              data-testid="switch-vessel-location"
                              disabled={isViewMode}
                              className="data-[state=checked]:bg-blue-600"
                            />
                            <span className={`text-sm font-medium ${field.value === 'atSea' ? 'text-blue-600' : 'text-gray-500'}`}>
                              At Sea
                            </span>
                          </div>
                        )}
                      />
                    </div>

                    {form.watch('vesselLocationType') === 'atPort' ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Port Name</label>
                          <Controller
                            name="portName"
                            control={form.control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                value={field.value || ""}
                                placeholder="Enter port name"
                                className="h-10 text-sm border-gray-300"
                                data-testid="input-port-name"
                                disabled={isViewMode}
                              />
                            )}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Vessel Location</label>
                          <Controller
                            name="vesselLocationDetail"
                            control={form.control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                                <SelectTrigger data-testid="select-vessel-location" className="h-10 text-sm border-gray-300">
                                  <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Alongside">Alongside</SelectItem>
                                  <SelectItem value="Anchorage">Anchorage</SelectItem>
                                  <SelectItem value="Berth">Berth</SelectItem>
                                  <SelectItem value="Dry Dock">Dry Dock</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Latitude</label>
                          <Controller
                            name="latitude"
                            control={form.control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                value={field.value || ""}
                                placeholder="e.g., 12.9716° N"
                                className="h-10 text-sm border-gray-300"
                                data-testid="input-latitude"
                                disabled={isViewMode}
                              />
                            )}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Longitude</label>
                          <Controller
                            name="longitude"
                            control={form.control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                value={field.value || ""}
                                placeholder="e.g., 77.5946° E"
                                className="h-10 text-sm border-gray-300"
                                data-testid="input-longitude"
                                disabled={isViewMode}
                              />
                            )}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Vessel Location</label>
                          <Controller
                            name="vesselLocationDetail"
                            control={form.control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                                <SelectTrigger data-testid="select-vessel-location" className="h-10 text-sm border-gray-300">
                                  <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Open Sea">Open Sea</SelectItem>
                                  <SelectItem value="Coastal Waters">Coastal Waters</SelectItem>
                                  <SelectItem value="Territorial Waters">Territorial Waters</SelectItem>
                                  <SelectItem value="International Waters">International Waters</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>}

                  {/* Description */}
                  <div className="space-y-2 mt-6">
                    <label className="text-sm text-gray-600">Description<span className="text-red-500">*</span></label>
                    <Controller
                      name="description"
                      control={form.control}
                      render={({ field }) => (
                        <Textarea
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="bg-white min-h-[120px]"
                          placeholder="Enter defect description..."
                          disabled={isViewMode}
                        />
                      )}
                    />
                  </div>

                  {/* Attachments Button and Submit Button for Part A */}
                  {!isViewMode && (
                    <div className="flex justify-end items-center gap-3 pt-6 mt-6 border-t border-gray-200">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsPartAAttachmentDialogOpen(true)}
                        disabled={isViewMode}
                        data-testid="button-part-a-attachments"
                        className="border-gray-300"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Attachment(s)
                        {partAAttachments.length > 0 && (
                          <span className="ml-2 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                            {partAAttachments.length}
                          </span>
                        )}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleStepSubmit(1)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                        data-testid="button-submit-part-a"
                      >
                        Submit
                      </Button>
                    </div>
                  )}
                </div>
              </div>

            {/* Part B: Analysis & Actions */}
            <div ref={partBRef} data-section="B" className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 scroll-mt-6">
                <h2 className="text-xl font-semibold text-[#1e3a5f]">Part B: Analysis & Actions</h2>
                <p className="text-sm text-gray-500 mt-1">Cause analysis and corrective actions</p>
                <div className="h-0.5 bg-blue-500 mt-3 mb-6" />
                
                <div className="space-y-8">
                  {/* B1. Cause Analysis */}
                  <div className="space-y-6">
                    <h3 className="text-sm font-semibold" style={{ color: '#16569e' }}>B1. Cause Analysis</h3>
                    
                    {/* Immediate Cause */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-end">
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm" 
                          className="text-gray-600 border-gray-300 hover:bg-gray-50" 
                          data-testid="button-select-immediate"
                          onClick={handleImmediateCauseSelect}
                          disabled={isViewMode}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Select
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Immediate Cause</label>
                          <Controller
                            name="immediateCause"
                            control={form.control}
                            render={({ field }) => (
                              <Textarea 
                                {...field}
                                value={typeof field.value === 'string' ? field.value : 
                                       field.value && typeof field.value === 'object' ? 
                                       buildImmediateCauseText(field.value as { unsafeAct: string[], unsafeCondition: string[] }) : ""}
                                rows={3}
                                placeholder="IMMEDIATE CAUSE"
                                className="bg-white text-sm border-gray-300"
                                data-testid="textarea-immediate-cause"
                                readOnly
                              />
                            )}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Further Explanation</label>
                          <Textarea 
                            {...form.register("immediateCauseExplanation")}
                            rows={3}
                            placeholder="FURTHER EXPLANATION"
                            className="bg-white text-sm border-gray-300"
                            data-testid="textarea-immediate-explanation"
                            disabled={isViewMode}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Root Cause */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-end">
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm" 
                          className="text-gray-600 border-gray-300 hover:bg-gray-50" 
                          data-testid="button-select-root"
                          onClick={handleRootCauseSelect}
                          disabled={isViewMode}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Select
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Root Cause</label>
                          <Controller
                            name="rootCause"
                            control={form.control}
                            render={({ field }) => (
                              <Textarea 
                                {...field}
                                value={typeof field.value === 'object' && field.value ? 
                                  buildRootCauseText(field.value as { individualFactor: string[], systemFactor: string[] }) : 
                                  String(field.value || "")}
                                rows={3}
                                placeholder="ROOT CAUSE"
                                className="bg-white text-sm border-gray-300"
                                data-testid="textarea-root-cause"
                                readOnly
                              />
                            )}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">Further Explanation</label>
                          <Textarea 
                            {...form.register("rootCauseExplanation")}
                            rows={3}
                            placeholder="FURTHER EXPLANATION"
                            className="bg-white text-sm border-gray-300"
                            data-testid="textarea-root-explanation"
                            disabled={isViewMode}
                          />
                        </div>
                      </div>
                    </div>

                    {/* B2. SIRE Reference */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold" style={{ color: '#16569e' }}>B2. SIRE Reference</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">SIRE Version</label>
                          <Controller
                            name="viqVersion"
                            control={form.control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                                <SelectTrigger data-testid="select-viq-version" className="h-10 text-sm border-gray-300">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="VIQ 7">VIQ 7</SelectItem>
                                  <SelectItem value="SIRE 2.0">SIRE 2.0</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">SIRE Reference</label>
                          <Controller
                            name="viqRef"
                            control={form.control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                                <SelectTrigger data-testid="select-viq-ref" className="h-10 text-sm border-gray-300">
                                  <SelectValue placeholder="Select SIRE Reference" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                  {sireReferenceOptions.map((ref) => (
                                    <SelectItem key={ref.value} value={ref.value}>
                                      {ref.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-gray-600 mb-1.5">SIRE Hardware Class</label>
                          <Controller
                            name="sireHardwareId"
                            control={form.control}
                            render={({ field }) => (
                              <SireHardwareClassCombobox
                                selectedId={field.value || ""}
                                displayValue={form.watch('sireHardwareLevel3') || ""}
                                onSelect={(id, level1, level2, level3) => {
                                  form.setValue('sireHardwareId', id);
                                  form.setValue('sireHardwareLevel1', level1);
                                  form.setValue('sireHardwareLevel2', level2);
                                  form.setValue('sireHardwareLevel3', level3);
                                }}
                                disabled={isViewMode}
                                placeholder="Select hardware class"
                                testId="combobox-sire-hardware-class"
                              />
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* B3. Risk & Priority */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold" style={{ color: '#16569e' }}>B3. Risk & Priority</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1.5">Risk Level</label>
                        <Controller
                          name="riskLevel"
                          control={form.control}
                          render={({ field }) => {
                            const getRiskColor = (value: string) => {
                              switch (value) {
                                case 'Low': return 'bg-green-500 text-white border-green-500';
                                case 'Medium': return 'bg-orange-500 text-white border-orange-500';
                                case 'High': return 'bg-red-500 text-white border-red-500';
                                default: return 'bg-white text-gray-900 border-gray-300';
                              }
                            };
                            return (
                              <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                                <SelectTrigger 
                                  data-testid="select-risk-level" 
                                  className={`h-10 text-sm ${getRiskColor(field.value || '')}`}
                                >
                                  <SelectValue placeholder="Select risk" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Low">Low</SelectItem>
                                  <SelectItem value="Medium">Medium</SelectItem>
                                  <SelectItem value="High">High</SelectItem>
                                </SelectContent>
                              </Select>
                            );
                          }}
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1.5">Priority</label>
                        <Controller
                          name="priority"
                          control={form.control}
                          render={({ field }) => {
                            const getPriorityColor = (value: string) => {
                              switch (value) {
                                case 'Low': return 'bg-green-500 text-white border-green-500';
                                case 'Medium': return 'bg-orange-500 text-white border-orange-500';
                                case 'High': return 'bg-red-500 text-white border-red-500';
                                default: return 'bg-white text-gray-900 border-gray-300';
                              }
                            };
                            return (
                              <Select onValueChange={field.onChange} value={field.value || ""} disabled={isViewMode}>
                                <SelectTrigger 
                                  data-testid="select-priority" 
                                  className={`h-10 text-sm ${getPriorityColor(field.value || '')}`}
                                >
                                  <SelectValue placeholder="Select Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Low">Low</SelectItem>
                                  <SelectItem value="Medium">Medium</SelectItem>
                                  <SelectItem value="High">High</SelectItem>
                                </SelectContent>
                              </Select>
                            );
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* B4. Actions Table */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold" style={{ color: '#16569e' }}>B4. Actions</h3>
                      {!isViewMode && (
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm" 
                          className="text-gray-600 border-gray-300 hover:bg-gray-50"
                          onClick={openAddActionModal}
                          data-testid="button-add-action"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Action
                        </Button>
                      )}
                    </div>

                    {actions.length > 0 ? (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-xs font-medium text-gray-600">Action Type</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600">Description</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600">Proposed By</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600">Responsibility</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600">Due Date</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600">Status</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {actions.map((action) => (
                              <TableRow key={action.id}>
                                <TableCell className="text-sm">{action.actionType}</TableCell>
                                <TableCell className="text-sm">{action.actionDescription || "N/A"}</TableCell>
                                <TableCell className="text-sm">{action.proposedBy}</TableCell>
                                <TableCell className="text-sm">{action.responsibility}</TableCell>
                                <TableCell className="text-sm">{action.dueDate}</TableCell>
                                <TableCell>
                                  <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                                    {action.status}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="h-7 w-7 p-0"
                                      onClick={() => openEditActionModal(action)}
                                      data-testid={`button-edit-action-${action.id}`}
                                      disabled={isViewMode}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="h-7 w-7 p-0"
                                      onClick={() => deleteAction(action.id)}
                                      data-testid={`button-delete-action-${action.id}`}
                                      disabled={isViewMode}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <p className="text-gray-500 text-sm">No actions added yet</p>
                      </div>
                    )}
                  </div>

                  {/* B5. Target Date Extension */}
                  <div className="space-y-4 pt-6">
                    <div className="flex items-center justify-center">
                      {!showExtensionForm && !hasPendingExtension && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCurrentExtension({ newTargetDate: "", reasonForExtension: "" });
                            setShowExtensionForm(true);
                          }}
                          disabled={isViewMode}
                          data-testid="button-extend-target-date"
                          className="border-gray-300"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Extend Target Date
                        </Button>
                      )}
                    </div>
                    {extensionUi.showContainer && (
                      <div className="border border-amber-300 rounded-lg p-6 bg-amber-50/30 space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold" style={{ color: '#16569e' }}>B5. Target Date Extension</h3>
                          {displayedExtension && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">Status:</span>
                              <span className={`text-sm font-medium ${
                                displayedExtensionStatus === 'Approved'
                                  ? 'text-green-600' 
                                  : displayedExtensionStatus === 'Rejected'
                                    ? 'text-red-600'
                                    : 'text-amber-600'
                              }`}>
                                {displayedExtensionStatus?.toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        {displayedExtension && (
                          <div className="rounded border border-blue-200 bg-blue-50/50 px-4 py-3" data-testid={`extension-current-${displayedExtension.id}`}>
                            <div className="font-medium text-slate-800">Extension {orderedExtensions.length} of {orderedExtensions.length} — {String(displayedExtensionStatus ?? displayedExtension.status).toUpperCase()}</div>
                            <div className="mt-1 text-xs text-slate-600">Current entry · editable only while non-terminal; decisions are available only for a current Requested entry.</div>
                            <div className="mt-2 grid gap-1 text-sm text-slate-700 md:grid-cols-2">
                              {displayedExtension.approvalDate && <div>Approval date: {displayedExtension.approvalDate}</div>}
                              {displayedExtension.electronicConfirmation && <div>Electronic confirmation: {displayedExtension.electronicConfirmation}</div>}
                              {displayedExtension.submitForApprovalToName && <div>Intended approver: {displayedExtension.submitForApprovalToName}</div>}
                              {displayedExtension.approverComments && <div>Approver comments: {displayedExtension.approverComments}</div>}
                            </div>
                          </div>
                        )}
                        {orphanedRequestedExtension && (
                          <div
                            className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
                            data-testid="extension-orphan-warning"
                          >
                            This extension is marked Requested, but no pending approval request was found. It does not block closeout; please contact your administrator to reconcile it.
                          </div>
                        )}

                        {extensionHistory.slice(0, -1).map((row, index) => (
                          <ExtensionHistoryCard
                            key={row.entry.id}
                            entry={row.entry}
                            index={index}
                            total={orderedExtensions.length}
                            chain={(row.chain as DefectApprovalChain | undefined) ?? null}
                          />
                        ))}

                        <div className="grid grid-cols-2 gap-6">
                          <div className="flex flex-col">
                            <label className="text-sm text-gray-600 mb-1.5">Existing Target Date (Auto filled)</label>
                            <Input 
                              type="date"
                              value={displayedExtension ? displayedExtension.existingTargetDate : liveTargetDate}
                              disabled
                              data-testid="input-existing-target-date"
                              className="h-10 text-sm border-gray-300 bg-gray-100"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="text-sm text-gray-600 mb-1.5">New Target Date<span className="text-red-500">*</span></label>
                            <Input 
                              type="date"
                              value={displayedExtension ? displayedExtension.newTargetDate : currentExtension.newTargetDate}
                              min={(() => {
                                const existingDate = liveTargetDate;
                                if (!existingDate) return undefined;
                                const [year, month, day] = existingDate.split('-').map(Number);
                                const nextDay = new Date(year, month - 1, day + 1);
                                return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
                              })()}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                const existingDate = liveTargetDate;
                                if (newDate && existingDate && newDate <= existingDate) {
                                  toast({ title: "New Target Date must be later than the existing Target Date", variant: "destructive" });
                                  return;
                                }
                                setCurrentExtension(prev => ({ ...prev, newTargetDate: newDate }));
                              }}
                              disabled={extensionUi.fieldsReadOnly}
                              data-testid="input-new-target-date"
                              className="h-10 text-sm border-gray-300"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="flex flex-col">
                            <label className="text-sm text-gray-600 mb-1.5">Reason for Extension<span className="text-red-500">*</span></label>
                            <Textarea 
                              value={displayedExtension ? displayedExtension.reasonForExtension : currentExtension.reasonForExtension}
                              onChange={(e) => setCurrentExtension(prev => ({ ...prev, reasonForExtension: e.target.value }))}
                              disabled={extensionUi.fieldsReadOnly}
                              data-testid="input-reason-for-extension"
                              className="text-sm border-gray-300 min-h-[80px]"
                              placeholder="Enter reason for extension..."
                            />
                          </div>
                        </div>

                        {displayedExtension?.submitForApprovalToName && (
                          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="legacy-approver-warning">
                            This entry recorded {displayedExtension.submitForApprovalToName} as the intended approver before an approval workflow was configured. It does not determine who approves this request. The configured workflow below is authoritative.
                          </div>
                        )}

                        {displayedExtension?.electronicConfirmation && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>Electronic Confirmation (System Generated):</span>
                            <span className="italic text-gray-800">
                              {displayedExtension.electronicConfirmation}
                            </span>
                          </div>
                        )}

                        {displayedExtension && hasExtensionChainsProjection && !currentExtensionChain ? (
                          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600" data-testid={`extension-chain-unmatched-${displayedExtension.id}`}>
                            No approval chain is associated with this entry. Historical approval data was not inferred.
                          </div>
                        ) : displayedExtension ? (
                          <DefectApprovalStatus
                            action="extension"
                            defectId={approvalDefectId}
                            approval={currentExtensionApproval}
                            canEdit={canEditDefect && !isViewMode && String(displayedExtensionStatus ?? "").toLowerCase() === "requested"}
                          />
                        ) : (
                          <div data-testid="extension-approval-preview-container">
                            {!validDraftExtensionDate ? (
                              <div className="rounded border border-blue-200 bg-blue-50/40 p-3 text-sm text-blue-900" data-testid="approval-preview-extension-date-required">
                                The approval chain will depend on the requested date.
                              </div>
                            ) : !isExtensionDateSettled || extensionPreview.isLoading || extensionPreview.isFetching ? (
                              <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600" data-testid="approval-preview-extension-loading">
                                Determining approval workflow...
                              </div>
                            ) : extensionPreview.error ? (
                              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="approval-preview-extension-error">
                                Could not determine the approval chain.
                              </div>
                            ) : extensionPreview.data ? (
                              <ApprovalWorkflowPreview action="extension" {...extensionPreview.data} />
                            ) : null}
                          </div>
                        )}

                        {extensionUi.showSubmit && (
                          <div className="flex justify-end pt-2">
                            <Button
                              type="button"
                              onClick={async () => {
                                // Prevent duplicate submissions
                                if (isSubmittingExtension) return;

                                // Validate B5 mandatory fields up front and show
                                // a clear message rather than relying on a silently
                                // disabled button.
                                const missingB5: string[] = [];
                                if (!currentExtension.newTargetDate) missingB5.push('New Target Date');
                                if (!currentExtension.reasonForExtension?.trim()) missingB5.push('Reason for Extension');
                                if (missingB5.length > 0) {
                                  toast({
                                    title: 'Part B5 incomplete',
                                    description: `Please fill in: ${missingB5.join(', ')}`,
                                    variant: 'destructive',
                                  });
                                  return;
                                }

                                setIsSubmittingExtension(true);

                                try {
                                  // Validate form before saving
                                  const isValid = await form.trigger();
                                  if (!isValid) {
                                    toast({ title: "Please fix form errors before submitting extension", variant: "destructive" });
                                    return;
                                  }
                                  
                                  const existingTargetDate = form.getValues('targetCloseDate') || '';
                                  
                                  // Validate New Target Date must be strictly later than existing Target Date
                                  if (currentExtension.newTargetDate && existingTargetDate && currentExtension.newTargetDate <= existingTargetDate) {
                                    toast({ title: "New Target Date must be later than the existing Target Date", variant: "destructive" });
                                    return;
                                  }
                                  
                                  const newExtension = {
                                    id: `EXT-${Date.now()}`,
                                    existingTargetDate,
                                    newTargetDate: currentExtension.newTargetDate,
                                    reasonForExtension: currentExtension.reasonForExtension,
                                    status: 'Requested' as const,
                                    requestedAt: new Date().toISOString(),
                                  };
                                  
                                  const updatedExtensions = [...targetDateExtensions, newExtension];
                                  
                                  // Auto-save using the existing saveDefect function with the updated extensions
                                  const formData = form.getValues();
                                   const result = await saveDefect(formData, false, false, updatedExtensions);
                                  
                                   if (result.saved) {
                                    setTargetDateExtensions(updatedExtensions);
                                    setShowExtensionForm(false);
                                    if (approvalDefectId !== null) {
                                      await queryClient.invalidateQueries({ queryKey: defectApprovalChainQueryKey(approvalDefectId, "extension") });
                                    }
                                     if (result.kind === "saved-approval-failed") {
                                       toast({
                                         title: result.message,
                                         description: "The extension was saved.",
                                         variant: "destructive",
                                       });
                                     } else {
                                       toast({ title: "Extension request submitted and saved" });
                                     }
                                  } else {
                                    toast({ title: "Extension added but save failed. Please click SAVE.", variant: "destructive" });
                                  }
                                } finally {
                                  setIsSubmittingExtension(false);
                                }
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                              data-testid="button-submit-extension"
                              disabled={isSubmittingExtension}
                            >
                              {isSubmittingExtension ? 'Saving...' : 'Submit'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Attachments Button and Submit Button for Part B */}
                  {!isViewMode && (
                    <div className="flex justify-end items-center gap-3 pt-6 mt-6 border-t border-gray-200">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAttachmentDialogOpen(true)}
                        disabled={isViewMode}
                        data-testid="button-attachments"
                        className="border-gray-300"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Attachment(s)
                        {fileAttachments.length > 0 && (
                          <span className="ml-2 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                            {fileAttachments.length}
                          </span>
                        )}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleStepSubmit(2)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                        data-testid="button-submit-part-b"
                      >
                        Submit
                      </Button>
                    </div>
                  )}
                </div>
              </div>

            {/* Part C: Closeout */}
            <div ref={partCRef} data-section="C" className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 scroll-mt-6">
                <h2 className="text-xl font-semibold text-[#1e3a5f]">Part C: Closeout</h2>
                <p className="text-sm text-gray-500 mt-1">Completion and Verification</p>
                <div className="h-0.5 bg-blue-500 mt-3 mb-6" />
                
                <div className="space-y-8">
                  {/* C1. Closeout Section */}
                  <div className="space-y-6">
                    <h3 className="text-base font-semibold text-[#1e3a5f]">C1. Closeout</h3>
                    {hasPendingExtensionRequest && isMasterRank && (
                      <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="c1-extension-pending-warning">
                        Closeout is blocked while the extension approval is pending.
                      </p>
                    )}
                    {!isMasterRank && !isViewMode && (
                      <p className="text-sm text-amber-600" data-testid="note-closeout-master-only">
                        Only the Master may complete Part C1 Closeout.
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex items-center gap-3">
                        <Controller
                          name="confirmCompleted"
                          control={form.control}
                          render={({ field }) => (
                            <Checkbox
                              id="confirm-completed"
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                              disabled={isViewMode || !isMasterRank || hasPendingExtensionRequest}
                              data-testid="checkbox-confirm-completed"
                            />
                          )}
                        />
                        <Label htmlFor="confirm-completed" className="text-sm text-gray-700">Confirm Completed</Label>
                      </div>
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1.5">Date Completed</label>
                        <Input 
                          {...form.register("dateCompleted")} 
                          type="date"
                          data-testid="input-date-completed"
                          className="h-10 text-sm border-gray-300"
                          disabled={isViewMode || !isMasterRank}
                          min={dateRegisteredInSystemValue || ""}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1.5">Closed By (Name)</label>
                        <Input 
                          {...form.register("closedByName")} 
                          data-testid="input-closed-by-name"
                          className="h-10 text-sm border-gray-300"
                          placeholder="Enter name"
                          disabled={isViewMode || !isMasterRank}
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1.5">Closed By (Rank)</label>
                        <Input 
                          {...form.register("closedByRank")} 
                          data-testid="input-closed-by-rank"
                          className="h-10 text-sm border-gray-300"
                          placeholder="Enter rank"
                          disabled={isViewMode || !isMasterRank}
                        />
                      </div>
                    </div>

                    {/* Submit Button for C1 */}
                    {!isViewMode && isMasterRank && (
                      <div className="flex justify-end pt-4">
                        <Button
                          type="button"
                          onClick={() => handleStepSubmit(3)}
                          disabled={hasPendingExtensionRequest}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                          data-testid="button-submit-c1"
                        >
                          Submit
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* C2. Verification Section */}
                  <div className="space-y-6 pt-4">
                    <h3 className="text-base font-semibold text-[#1e3a5f]">C2. Verification</h3>
                    {hasPendingExtensionRequest && (
                      <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="c2-extension-pending-warning">
                        Verification is blocked while the extension approval is pending.
                      </p>
                    )}
                    {"isLegacyVerification" in verificationDisplay && verificationDisplay.isLegacyVerification && (
                      <p className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700" data-testid="legacy-verification-note">
                        Verified before an approval workflow was configured.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1.5">Date Verified</label>
                        <Input value={verificationDisplay.date ? String(verificationDisplay.date).slice(0, 10) : ""} readOnly data-testid="input-date-verified" className="h-10 text-sm border-gray-300 bg-gray-100" />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-600 mb-1.5">Verified By (Name)</label>
                        <Input value={verificationDisplay.name} readOnly data-testid="input-verified-by-name" className="h-10 text-sm border-gray-300 bg-gray-100" />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-sm text-gray-600 mb-1.5">Verified By (Office Position)</label>
                      <Input value={verificationDisplay.position} readOnly data-testid="input-verified-by-office-position" className="h-10 text-sm border-gray-300 bg-gray-100" />
                    </div>
                    {!hasPendingExtensionRequest && (c1CloseoutComplete || hasPersistedApprovalRequest(verificationApproval.data)) && (
                      verificationApproval.data &&
                      !verificationApproval.data.hasActiveWorkflow &&
                      !hasPersistedApprovalRequest(verificationApproval.data) ? (
                        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="verification-workflow-missing">
                          No verification workflow is configured for scope <strong>{verificationApproval.data.scope || "defects-verification"}</strong>
                          {verificationApproval.data.classification ? ` and classification ${verificationApproval.data.classification}` : ""}. Contact your administrator.
                        </div>
                      ) : (
                        <DefectApprovalStatus
                          action="verification"
                          defectId={approvalDefectId}
                          approval={verificationApproval}
                          canEdit={canEditDefect && !isViewMode}
                          previewWhenNoRequest
                        />
                      )
                    )}
                  </div>
                </div>
              </div>

          </div>
        </div>
      </div>

      {/* Modals */}
      <ImmediateCauseModal
        isOpen={isImmediateCauseModalOpen}
        onClose={() => setIsImmediateCauseModalOpen(false)}
        onSubmit={handleImmediateCauseSubmit}
        initialData={typeof form.getValues('immediateCause') === 'object' ? form.getValues('immediateCause') as any : undefined}
      />

      <RootCauseModal
        isOpen={isRootCauseModalOpen}
        onClose={() => setIsRootCauseModalOpen(false)}
        onSubmit={handleRootCauseSubmit}
        initialData={typeof form.getValues('rootCause') === 'object' ? form.getValues('rootCause') as any : undefined}
      />

      <AddActionModal
        open={isAddActionModalOpen}
        onOpenChange={setIsAddActionModalOpen}
        onSave={handleSaveAction}
        initialData={editingAction}
      />

      <FileAttachmentDialog
        open={isAttachmentDialogOpen}
        onOpenChange={setIsAttachmentDialogOpen}
        attachments={fileAttachments}
        onAttachmentsChange={setFileAttachments}
        title="C1 Attachments - Rectification Documentation"
        itemName="Rectification"
      />

      <FileAttachmentDialog
        open={isPartAAttachmentDialogOpen}
        onOpenChange={setIsPartAAttachmentDialogOpen}
        attachments={partAAttachments}
        onAttachmentsChange={setPartAAttachments}
        title="Part A Attachments - Defect Photos"
        itemName="Defect Photo"
      />
    </div>
  );
}
