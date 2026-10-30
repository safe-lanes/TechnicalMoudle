import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { sectionHRequest } from "@/lib/sectionHRequest";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, FileText, Loader2, RotateCcw, Trash2, Upload, RefreshCw } from "lucide-react";
import type { PublicUser } from "@shared/schema";

const API_ROOT = "/technical/api/section-h-entries";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ACTIVE_FILES = 5;
const MAX_ACTIVE_BYTES = 25 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

type Attachment = {
  ccrauuid: string;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  uploadedByUuid: string;
  uploadedBy?: string | null;
  uploadedAt: string;
  isDeleted: boolean;
  deletedAt?: string | null;
  deletedByUuid?: string | null;
  availability: "available" | "pending";
};
type AttachmentList = { files: Attachment[]; activeCount: number; activeBytes: number };
type Props = {
  entryUuid?: string | null;
  parentDeleted: boolean;
  componentId: string;
  securityScope: string;
  canEdit: boolean;
  canViewRemoved: boolean;
  currentUser: PublicUser | null;
};

function prettySize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dayMonthYear(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return [date.getDate(), date.getMonth() + 1, date.getFullYear()]
    .map((part, index) => index < 2 ? String(part).padStart(2, "0") : String(part))
    .join("-");
}

function messageFor(error: unknown) {
  const message = error instanceof Error ? error.message : "The attachment request could not be completed.";
  return message.replace(/^\d+:\s*/, "") || "The attachment request could not be completed.";
}

export default function ClassRegulatoryAttachments({
  entryUuid, parentDeleted, componentId, securityScope, canEdit, canViewRemoved, currentUser,
}: Props) {
  const [selected, setSelected] = useState<File | null>(null);
  const [uploadUuid, setUploadUuid] = useState("");
  const [localError, setLocalError] = useState("");
  const [removeTarget, setRemoveTarget] = useState<Attachment | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const latestContext = useRef({ entryUuid, componentId, securityScope, canEdit, parentDeleted });
  latestContext.current = { entryUuid, componentId, securityScope, canEdit, parentDeleted };
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    queryClient.removeQueries({
      predicate: (query) => typeof query.queryKey[0] === "string" &&
        query.queryKey[0].startsWith(`${API_ROOT}/`) && query.queryKey[1] !== securityScope,
    });
  }, [securityScope]);
  const url = entryUuid ? `${API_ROOT}/${encodeURIComponent(entryUuid)}/attachments` : "";
  const queryKey = useMemo(() => [url, securityScope, canViewRemoved] as const, [url, securityScope, canViewRemoved]);
  const enabled = !!entryUuid && !!currentUser;
  const query = useQuery<AttachmentList>({
    queryKey,
    queryFn: async () => (await sectionHRequest(currentUser, "GET", `${url}${canViewRemoved ? "?includeDeleted=true" : ""}`)).json(),
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
  const accessUrl = `/technical/api/component-class-regulatory/${encodeURIComponent(componentId)}/access`;
  const accessKey = [accessUrl, securityScope];

  const verifyManageAccess = async () => {
    const operationContext = { entryUuid, componentId, securityScope };
    if (!canEdit || parentDeleted || !currentUser) throw new Error(parentDeleted
      ? "Attachments cannot be changed while this entry is removed."
      : "Edit access could not be confirmed.");
    await queryClient.refetchQueries({ queryKey: accessKey, exact: true, type: "active" });
    const latest = latestContext.current;
    if (!mounted.current || latest.entryUuid !== operationContext.entryUuid ||
        latest.componentId !== operationContext.componentId || latest.securityScope !== operationContext.securityScope ||
        latest.parentDeleted) {
      throw new Error("The selected entry or access context changed. No attachment was changed.");
    }
    const accessState = queryClient.getQueryState<{ canEdit?: boolean; identityMode?: string }>(accessKey);
    // Refetch temporarily disables the parent's rendered canEdit flag. The settled
    // scoped cache below is authoritative after await; a stale render is not a denial.
    const access = accessState?.data;
    const identityOkay = access?.identityMode === "verified" || access?.identityMode === "replit-default";
    if (accessState?.status !== "success" || accessState.fetchStatus !== "idle" || access?.canEdit !== true || !identityOkay) {
      throw new Error("Edit access could not be confirmed. No attachment was changed.");
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      await verifyManageAccess();
      if (!selected || !entryUuid || !uploadUuid) throw new Error("Choose a document before uploading.");
      const formData = new FormData();
      formData.append("file", selected);
      formData.append("attachmentUuid", uploadUuid);
      const response = await sectionHRequest(currentUser, "POST", url, formData);
      return response.json();
    },
    onSuccess: async () => {
      if (!mounted.current || latestContext.current.entryUuid !== entryUuid ||
          latestContext.current.securityScope !== securityScope) return;
      setSelected(null);
      setUploadUuid("");
      setLocalError("");
      if (fileInput.current) fileInput.current.value = "";
      await queryClient.invalidateQueries({ queryKey: [url, securityScope] });
    },
    onError: (error) => setLocalError(messageFor(error)),
  });

  const removeMutation = useMutation({
    mutationFn: async (attachment: Attachment) => {
      await verifyManageAccess();
      return sectionHRequest(currentUser, "DELETE", `${url}/${encodeURIComponent(attachment.ccrauuid)}`);
    },
    onSuccess: async () => {
      setRemoveTarget(null);
      await queryClient.invalidateQueries({ queryKey: [url, securityScope] });
    },
    onError: (error) => setLocalError(messageFor(error)),
  });

  const restoreMutation = useMutation({
    mutationFn: async (attachment: Attachment) => {
      await verifyManageAccess();
      return sectionHRequest(currentUser, "POST", `${url}/${encodeURIComponent(attachment.ccrauuid)}/restore`);
    },
    onSuccess: async () => {
      setLocalError("");
      await queryClient.invalidateQueries({ queryKey: [url, securityScope] });
    },
    onError: (error) => setLocalError(messageFor(error)),
  });

  const onFileSelected = (file?: File) => {
    setLocalError("");
    setSelected(file || null);
    setUploadUuid(file ? crypto.randomUUID() : "");
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!Object.hasOwn(ALLOWED, extension) || file.type !== ALLOWED[extension]) {
      setLocalError("Choose a PDF, DOC, or DOCX file with a matching document type.");
      setSelected(null);
      setUploadUuid("");
      return;
    }
    if (!file.size) {
      setLocalError("Empty documents cannot be uploaded.");
      setSelected(null);
      setUploadUuid("");
    } else if (file.size > MAX_FILE_BYTES) {
      setLocalError("Each attachment must be 10 MB or smaller.");
      setSelected(null);
      setUploadUuid("");
    }
  };

  const uploadLimitError = (() => {
    const data = query.data;
    if (!selected || !data) return "";
    if (data.activeCount >= MAX_ACTIVE_FILES) return "This entry already has five active attachments. Remove one before adding another.";
    if (data.activeBytes + selected.size > MAX_ACTIVE_BYTES) return "This upload would exceed the 25 MB active attachment limit.";
    return "";
  })();

  const download = async (attachment: Attachment) => {
    setLocalError("");
    const operationContext = { entryUuid, componentId, securityScope };
    try {
      const response = await sectionHRequest(currentUser, "GET", `${url}/${encodeURIComponent(attachment.ccrauuid)}/download`);
      const blob = await response.blob();
      const latest = latestContext.current;
      if (!mounted.current || latest.entryUuid !== operationContext.entryUuid ||
          latest.componentId !== operationContext.componentId || latest.securityScope !== operationContext.securityScope) return;
      const objectUrl = URL.createObjectURL(blob);
      if (attachment.contentType === ALLOWED.pdf) {
        const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
        if (!opened) {
          const link = document.createElement("a");
          link.href = objectUrl;
          link.download = attachment.originalFilename;
          link.click();
        }
      } else {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = attachment.originalFilename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      setLocalError(messageFor(error));
    }
  };

  const files = query.data?.files || [];
  const activeCount = query.data?.activeCount || 0;
  const activeBytes = query.data?.activeBytes || 0;

  return (
    <section className="mt-3 border-t border-slate-200 pt-3" aria-label="Entry attachments">
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => { if (!open && !removeMutation.isPending) setRemoveTarget(null); }}>
        <AlertDialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              “{removeTarget?.originalFilename}” will be removed from the active list. An authorized Office user can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Keep attachment</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeMutation.isPending || !canEdit || parentDeleted}
              className="bg-red-700 text-white hover:bg-red-800"
              onClick={(event) => {
                event.preventDefault();
                if (removeTarget && !removeMutation.isPending) removeMutation.mutate(removeTarget);
              }}
            >{removeMutation.isPending ? "Removing…" : "Remove attachment"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-sky-800" />
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Entry attachments</h4>
        </div>
        {query.data && <span className="text-xs tabular-nums text-slate-600">
          {activeCount}/{MAX_ACTIVE_FILES} active · {prettySize(activeBytes)} / 25 MB
        </span>}
      </div>

      {!entryUuid && <p role="alert" className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Attachments require a saved entry with a canonical identity. This historical entry needs identity repair before files can be attached.
      </p>}
      {parentDeleted && <p className="mb-2 text-xs text-slate-600">This entry is removed. Its files remain retained; uploads and restores are disabled.</p>}

      {query.isLoading && <div className="space-y-2" aria-label="Loading attachments">
        <div className="h-9 animate-pulse rounded-sm bg-slate-100" />
        <div className="h-9 w-4/5 animate-pulse rounded-sm bg-slate-100" />
      </div>}
      {query.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
        <span>{messageFor(query.error)}</span>
        <Button size="sm" variant="outline" onClick={() => query.refetch()}><RefreshCw className="mr-1 h-3.5 w-3.5" />Retry files</Button>
      </div>}

      {query.isSuccess && files.length === 0 && <p className="rounded-sm border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-600">
        No attachments have been added to this entry.
      </p>}
      {query.isSuccess && files.length > 0 && <ul className="divide-y divide-slate-100 rounded-sm border border-slate-200">
        {files.map((attachment) => <li key={attachment.ccrauuid} className={`flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 ${attachment.isDeleted ? "bg-slate-50" : "bg-white"}`}>
          <FileText className="h-4 w-4 shrink-0 text-slate-500" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2">
              <span className="break-all text-sm font-medium text-slate-800">{attachment.originalFilename}</span>
              {attachment.isDeleted && <span className="rounded-sm bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">Removed</span>}
              {attachment.availability === "pending" && <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">Transfer pending</span>}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {prettySize(attachment.fileSize)} · {attachment.uploadedBy || "Unknown uploader"} · {dayMonthYear(attachment.uploadedAt)}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 gap-1">
            {!attachment.isDeleted && <Button size="sm" variant="outline" className="h-7" disabled={parentDeleted || attachment.availability !== "available"} onClick={() => download(attachment)}>
              <Download className="mr-1 h-3.5 w-3.5" />{attachment.contentType === ALLOWED.pdf ? "Open / download" : "Download"}
            </Button>}
            {!attachment.isDeleted && attachment.availability === "pending" && <Button size="sm" variant="ghost" className="h-7" onClick={() => query.refetch()}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" />Retry status
            </Button>}
            {canEdit && !parentDeleted && !attachment.isDeleted && <Button size="icon" variant="outline" className="h-7 w-7 text-red-700" aria-label={`Remove ${attachment.originalFilename}`} disabled={removeMutation.isPending} onClick={() => setRemoveTarget(attachment)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>}
            {canViewRemoved && attachment.isDeleted && <Button size="sm" variant="outline" className="h-7" disabled={!canEdit || parentDeleted || restoreMutation.isPending} onClick={() => restoreMutation.mutate(attachment)}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />Restore
            </Button>}
          </div>
        </li>)}
      </ul>}

      {canEdit && !parentDeleted && entryUuid && <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          ref={fileInput}
          aria-label="Choose PDF, DOC, or DOCX attachment"
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={uploadMutation.isPending}
          onChange={(event) => onFileSelected(event.currentTarget.files?.[0])}
          className="min-w-0 flex-1 text-xs file:mr-2 file:rounded-sm file:border file:border-slate-300 file:bg-slate-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-700"
        />
        <Button type="button" size="sm" className="h-8 shrink-0" disabled={!selected || !!uploadLimitError || uploadMutation.isPending || query.isLoading} onClick={() => uploadMutation.mutate()}>
          {uploadMutation.isPending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Uploading…</> : <><Upload className="mr-1 h-3.5 w-3.5" />{localError && selected ? "Retry upload" : "Upload file"}</>}
        </Button>
        <p className="text-[11px] text-slate-500 sm:max-w-[16rem]">PDF, DOC, or DOCX · 10 MB maximum per file</p>
      </div>}
      {uploadLimitError && <p role="alert" className="mt-1 text-xs text-amber-800">{uploadLimitError}</p>}
      {localError && <p role="alert" className="mt-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{localError}</p>}
      {(uploadMutation.isPending || removeMutation.isPending || restoreMutation.isPending) && <p role="status" className="sr-only">Attachment operation in progress</p>}
    </section>
  );
}
