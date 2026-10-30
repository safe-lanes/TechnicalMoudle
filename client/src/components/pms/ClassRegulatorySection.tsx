import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { sectionHRequest } from "@/lib/sectionHRequest";
import { isReplit } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ComponentDateInput } from "@/components/pms/ComponentDateInput";
import ClassRegulatoryAttachments from "@/components/pms/ClassRegulatoryAttachments";
import { formatComponentDate } from "@/lib/componentDatePresentation";
import { classSurveyDay, validateClassRegulatoryDates } from "@shared/classRegulatory";
import type { ClassRegulatoryEntry } from "@shared/classRegulatory";
import { Plus, Pencil, Trash2, RotateCcw, X, Save, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";

type RegulatoryEntry = ClassRegulatoryEntry;
type Master = { listKey: string; listValue: string; isActive?: boolean; isDeleted?: boolean; category?: string | null; country?: string | null; description?: string | null };
type Draft = {
  classificationSocietyKey: string;
  surveyTypeKey: string;
  certificateNumber: string;
  lastClassSurvey: string;
  nextSurveyDue: string;
  classRequirements: string;
  information: string;
};
type Confirmation =
  | { kind: "remove"; componentId: string; securityScope: string; principalScope: string; expectedEditingId: number | "new" | null; targetId: number; opener: HTMLElement | null; fallbackSelector: string }
  | { kind: "discard"; componentId: string; securityScope: string; principalScope: string; expectedEditingId: number | "new"; nextAction: "begin" | "cancel"; target?: RegulatoryEntry; opener: HTMLElement | null; fallbackSelector: string };
const blankDraft = (): Draft => ({ classificationSocietyKey: "", surveyTypeKey: "", certificateNumber: "", lastClassSurvey: "", nextSurveyDue: "", classRequirements: "", information: "" });
const apiRoot = "/technical/api";
const inputClass = "h-8 rounded-sm border-[#52baf3] text-sm focus-visible:ring-[#52baf3]";
type Access = { canView: boolean; canEdit: boolean; canViewRemoved?: boolean; identityMode: string; reasonCode?: string; reason?: string };
const sessionEpochs = new WeakMap<object, number>();
let nextSessionEpoch = 0;
function sessionEpoch(user: object | null) {
  if (!user) return 0;
  if (!sessionEpochs.has(user)) sessionEpochs.set(user, ++nextSessionEpoch);
  return sessionEpochs.get(user)!;
}
function errorDetails(error: unknown): { message: string; fields: Record<string, string> } {
  const raw = error instanceof Error ? error.message : "The entry could not be saved.";
  try {
    const start = raw.indexOf("{");
    const parsed = JSON.parse(start >= 0 ? raw.slice(start) : raw);
    return { message: parsed.message || parsed.error || "Please check the entry and try again.", fields: parsed.fieldErrors || {} };
  } catch {
    return { message: raw.replace(/^\d+:\s*/, "") || "The entry could not be saved.", fields: {} };
  }
}

function toDraft(entry?: RegulatoryEntry): Draft {
  return {
    classificationSocietyKey: entry?.classificationSocietyKey || "",
    surveyTypeKey: entry?.surveyTypeKey || "",
    certificateNumber: entry?.certificateNumber || "",
    lastClassSurvey: entry?.lastClassSurvey || "",
    nextSurveyDue: entry?.nextSurveyDue || "",
    classRequirements: entry?.classRequirements || "",
    information: entry?.information || "",
  };
}

export interface ClassRegulatorySectionProps {
  componentId?: string | number | null;
  readOnly?: boolean;
  classItem?: boolean;
  compact?: boolean;
}

/** Multi-entry, independently saved register for component Section H. */
export default function ClassRegulatorySection({ componentId, readOnly = false, classItem = true }: ClassRegulatorySectionProps) {
  const { sectionHUser: currentUser, domain } = useAuth();
  const apiRequest = (method: string, url: string, data?: unknown) => sectionHRequest(currentUser, method, url, data);
  const [storageEpoch, setStorageEpoch] = useState(0);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === null || ["credentials", "profile", "userProfile", "domain"].includes(event.key)) setStorageEpoch(value => value + 1);
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  const securityScope = JSON.stringify([domain, currentUser?.userUuid, currentUser?.role, currentUser?.userType,
    currentUser?.vesselId, sessionEpoch(currentUser), storageEpoch]);
  const principalScope = JSON.stringify([domain, currentUser?.userUuid, currentUser?.role, currentUser?.userType, currentUser?.vesselId]);
  const id = componentId == null ? "" : String(componentId);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const [switchNotice, setSwitchNotice] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const confirmationRef = useRef<Confirmation | null>(confirmation);
  const cancelConfirmationRef = useRef<HTMLButtonElement>(null);
  const confirmationFocus = useRef<{ opener: HTMLElement | null; fallbackSelector: string } | null>(null);
  const latestContext = useRef({
    id, securityScope, principalScope, readOnly, canEdit: false,
    editingId: null as number | "new" | null, entries: [] as RegulatoryEntry[],
  });
  const confirmationActionInFlight = useRef(false);
  const previousConfirmationContext = useRef({ id, securityScope, principalScope });
  const inFlight = useRef(false);
  const originalDates = useRef({ lastClassSurvey: "", nextSurveyDue: "" });
  const originalReferences = useRef({ classificationSocietyKey: "", surveyTypeKey: "", classificationSociety: "", surveyType: "" });
  const previousComponentId = useRef(id);
  const previousPrincipal = useRef(principalScope);
  useEffect(() => {
    if (previousPrincipal.current === principalScope) return;
    previousPrincipal.current = principalScope;
    setEditingId(null); setDraft(blankDraft()); setIncludeDeleted(false); setFieldErrors({}); setSaveError("");
    setSwitchNotice("Section H was reset because the signed-in user or vessel access changed.");
  }, [principalScope]);
  useEffect(() => {
    if (previousComponentId.current === id) return;
    const discardedDraft = editingId !== null;
    previousComponentId.current = id;
    setEditingId(null);
    setDraft(blankDraft());
    setFieldErrors({});
    setSaveError("");
    setSwitchNotice(discardedDraft ? "The unsaved Section H draft was discarded because the selected component changed." : "");
  }, [id, editingId]);
  useEffect(() => {
    if (editingId === null || typeof window === "undefined") return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [editingId]);
  const accessUrl = `${apiRoot}/component-class-regulatory/${encodeURIComponent(id)}/access`;
  const accessQuery = useQuery<Access>({
    queryKey: [accessUrl, securityScope],
    queryFn: async () => (await apiRequest("GET", accessUrl)).json(),
    enabled: !!id && !!currentUser,
    staleTime: 0, gcTime: 0, refetchOnMount: "always",
  });
  const managedIdentity = !!currentUser && (accessQuery.data?.identityMode === "verified" ||
    (isReplit() && accessQuery.data?.identityMode === "replit-default"));
  const canEdit = !readOnly && accessQuery.isSuccess && !accessQuery.isFetching &&
    !accessQuery.isError && accessQuery.data?.canEdit === true && managedIdentity;
  const canViewRemoved = !readOnly && accessQuery.isSuccess && !accessQuery.isFetching &&
    !accessQuery.isError && accessQuery.data?.canViewRemoved === true && managedIdentity;
  const effectiveIncludeDeleted = canViewRemoved && includeDeleted;
  const listUrl = `${apiRoot}/component-class-regulatory/${encodeURIComponent(id)}${effectiveIncludeDeleted ? "?includeDeleted=true" : ""}`;
  const rowsQuery = useQuery<RegulatoryEntry[]>({
    queryKey: [`${apiRoot}/component-class-regulatory/${encodeURIComponent(id)}`, securityScope, effectiveIncludeDeleted],
    queryFn: async () => (await apiRequest("GET", listUrl)).json(),
    enabled: !!id && !!currentUser,
    staleTime: 0, gcTime: 0,
  });
  const societyQuery = useQuery<Master[]>({
    queryKey: [`${apiRoot}/fleet/master-lists?listType=classificationSociety`, securityScope],
    queryFn: async () => (await apiRequest("GET", `${apiRoot}/fleet/master-lists?listType=classificationSociety`)).json(),
    enabled: !!id && canEdit,
    staleTime: 0, gcTime: 0,
  });
  const surveyQuery = useQuery<Master[]>({
    queryKey: [`${apiRoot}/fleet/master-lists?listType=surveyType`, securityScope],
    queryFn: async () => (await apiRequest("GET", `${apiRoot}/fleet/master-lists?listType=surveyType`)).json(),
    enabled: !!id && canEdit,
    staleTime: 0, gcTime: 0,
  });
  useEffect(() => {
    // Erase inactive caches belonging to an old session/role/tenant, including removed records.
    queryClient.removeQueries({ predicate: query => typeof query.queryKey[0] === "string" &&
      query.queryKey[0].startsWith(`${apiRoot}/component-class-regulatory/`) &&
      query.queryKey[1] !== securityScope });
  }, [securityScope]);
  const entries = useMemo(() => rowsQuery.data || [], [rowsQuery.data]);
  latestContext.current = { id, securityScope, principalScope, readOnly, canEdit, editingId, entries };
  confirmationRef.current = confirmation;
  useEffect(() => {
    const previous = previousConfirmationContext.current;
    previousConfirmationContext.current = { id, securityScope, principalScope };
    if (previous.id !== id || previous.securityScope !== securityScope || previous.principalScope !== principalScope ||
      (!canEdit && !(confirmationBusy && confirmation?.kind === "remove"))) {
      confirmationRef.current = null;
      setConfirmation(null);
      setConfirmationBusy(false);
      confirmationActionInFlight.current = false;
    }
  }, [id, securityScope, principalScope, canEdit, confirmationBusy, confirmation]);
  useEffect(() => {
    if (!confirmation) return;
    const current = latestContext.current;
    if (confirmation.componentId !== current.id || confirmation.securityScope !== current.securityScope ||
      confirmation.principalScope !== current.principalScope ||
      (!current.canEdit && !(confirmationBusy && confirmation.kind === "remove")) ||
      confirmation.expectedEditingId !== current.editingId ||
      (confirmation.kind === "remove" && !current.entries.some(entry => entry.id === confirmation.targetId && !entry.isDeleted)) ||
      (confirmation.kind === "discard" && confirmation.target && !current.entries.some(entry => entry.id === confirmation.target?.id && !entry.isDeleted))) {
      setConfirmation(null);
    }
  }, [confirmation, id, securityScope, principalScope, canEdit, editingId, entries, confirmationBusy]);
  const closeConfirmation = () => {
    confirmationRef.current = null;
    setConfirmation(null);
    setConfirmationBusy(false);
    confirmationActionInFlight.current = false;
  };
  useEffect(() => {
    if (confirmation) return;
    const last = confirmationFocus.current;
    if (!last) return;
    confirmationFocus.current = null;
    requestAnimationFrame(() => {
      if (last.opener?.isConnected) last.opener.focus();
      else document.querySelector<HTMLElement>(last.fallbackSelector)?.focus();
    });
  }, [confirmation]);
  const societies = useMemo(() => (societyQuery.data || []).filter((x) => x.isActive !== false && x.isDeleted !== true), [societyQuery.data]);
  const surveys = useMemo(() => (surveyQuery.data || []).filter((x) => x.isActive !== false && x.isDeleted !== true), [surveyQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!canEdit) throw new Error("Edit access could not be confirmed. Your draft has not been saved.");
      if (!id || inFlight.current) throw new Error("A save is already in progress.");
      inFlight.current = true;
      const payload = {
        certificateNumber: draft.certificateNumber,
        lastClassSurvey: draft.lastClassSurvey,
        nextSurveyDue: draft.nextSurveyDue,
        classRequirements: draft.classRequirements,
        information: draft.information,
      };
      const isNew = editingId === "new";
      const societyUnchangedLegacyNull = !isNew && !originalReferences.current.classificationSocietyKey && !draft.classificationSocietyKey;
      const surveyUnchangedLegacyNull = !isNew && !originalReferences.current.surveyTypeKey && !draft.surveyTypeKey;
      if (!societyUnchangedLegacyNull) Object.assign(payload, { classificationSocietyKey: draft.classificationSocietyKey });
      if (!surveyUnchangedLegacyNull) Object.assign(payload, { surveyTypeKey: draft.surveyTypeKey });
      const response = editingId === "new"
        ? await apiRequest("POST", `${apiRoot}/component-class-regulatory`, { componentId: id, ...payload })
        : await apiRequest("PUT", `${apiRoot}/component-class-regulatory/${editingId}`, payload);
      return response.json();
    },
    onSuccess: async () => {
      setEditingId(null); setDraft(blankDraft()); setFieldErrors({}); setSaveError("");
      await queryClient.invalidateQueries({ queryKey: [`${apiRoot}/component-class-regulatory/${encodeURIComponent(id)}`] });
    },
    onError: (error) => {
      const details = errorDetails(error);
      setSaveError(details.message); setFieldErrors(details.fields);
    },
    onSettled: () => { inFlight.current = false; },
  });
  const lifecycleMutation = useMutation({
    mutationFn: async ({ entry, restore }: { entry: RegulatoryEntry; restore: boolean }) => {
      // A confirmation can refetch access before React commits the next render.
      // Use the current query state, not the previous render's isFetching snapshot.
      const accessState = queryClient.getQueryState<Access>([accessUrl, securityScope]);
      const access = accessState?.data;
      const context = latestContext.current;
      const canManageNow = !readOnly && !!currentUser &&
        context.id === id && context.securityScope === securityScope && context.principalScope === principalScope &&
        accessState?.status === "success" && accessState.fetchStatus === "idle" && access?.canEdit === true &&
        (access.identityMode === "verified" || (isReplit() && access.identityMode === "replit-default"));
      if (!canManageNow) throw new Error("Edit access could not be confirmed. No record was changed.");
      if (inFlight.current) throw new Error("An action is already in progress.");
      inFlight.current = true;
      return apiRequest(restore ? "POST" : "DELETE", `${apiRoot}/component-class-regulatory/${entry.id}${restore ? "/restore" : ""}`);
    },
    onSuccess: async () => {
      setSaveError("");
      await queryClient.invalidateQueries({ queryKey: [`${apiRoot}/component-class-regulatory/${encodeURIComponent(id)}`] });
    },
    onError: (error) => setSaveError(errorDetails(error).message),
    onSettled: () => { inFlight.current = false; confirmationActionInFlight.current = false; },
  });
  const setValue = (key: keyof Draft, value: string) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((previous) => ({ ...previous, [key]: "" }));
    setSaveError("");
  };
  const applyBegin = (entry?: RegulatoryEntry) => {
    setEditingId(entry?.id ?? "new");
    setDraft(toDraft(entry));
    originalDates.current = { lastClassSurvey: entry?.lastClassSurvey || "", nextSurveyDue: entry?.nextSurveyDue || "" };
    originalReferences.current = {
      classificationSocietyKey: entry?.classificationSocietyKey || "",
      surveyTypeKey: entry?.surveyTypeKey || "",
      classificationSociety: entry?.classificationSociety || "",
      surveyType: entry?.surveyType || "",
    };
    setFieldErrors({});
    setSaveError("");
    setSwitchNotice("");
  };
  const begin = (entry?: RegulatoryEntry, opener?: HTMLElement | null) => {
    if (editingId !== null) {
      const fallbackSelector = entry ? `[data-section-h-entry-edit="${entry.id}"]` : "[data-section-h-add]";
      confirmationFocus.current = { opener: opener || null, fallbackSelector };
      setConfirmation({
        kind: "discard", componentId: id, securityScope, principalScope, expectedEditingId: editingId,
        nextAction: "begin", target: entry, opener: opener || null, fallbackSelector,
      });
      return;
    }
    applyBegin(entry);
  };
  const cancel = () => {
    if (editingId === null) return;
    const fallbackSelector = typeof editingId === "number" ? `[data-section-h-entry-edit="${editingId}"]` : "[data-section-h-add]";
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmationFocus.current = { opener, fallbackSelector };
    setConfirmation({
      kind: "discard", componentId: id, securityScope, principalScope, expectedEditingId: editingId,
      nextAction: "cancel", opener, fallbackSelector,
    });
  };
  const requestRemove = (entry: RegulatoryEntry, opener: HTMLElement) => {
    const fallbackSelector = `[data-section-h-entry-edit="${entry.id}"]`;
    confirmationFocus.current = { opener, fallbackSelector };
    setConfirmation({
      kind: "remove", componentId: id, securityScope, principalScope, expectedEditingId: editingId,
      targetId: entry.id, opener, fallbackSelector,
    });
  };
  const confirmPendingAction = async () => {
    if (confirmationActionInFlight.current) return;
    const pending = confirmation;
    const current = latestContext.current;
    if (!pending || confirmationRef.current !== pending || pending.componentId !== current.id ||
      pending.securityScope !== current.securityScope || pending.principalScope !== current.principalScope ||
      pending.expectedEditingId !== current.editingId || !current.canEdit) {
      setConfirmation(null);
      return;
    }
    if (pending.kind === "remove") {
      const visibleEntry = current.entries.find(row => row.id === pending.targetId && !row.isDeleted);
      if (!visibleEntry || inFlight.current || lifecycleMutation.isPending) { closeConfirmation(); return; }
      confirmationActionInFlight.current = true;
      setConfirmationBusy(true);
      try {
        const [freshRows, freshAccess] = await Promise.all([rowsQuery.refetch(), accessQuery.refetch()]);
        const latest = latestContext.current;
        if (confirmationRef.current !== pending || pending.componentId !== latest.id ||
          pending.securityScope !== latest.securityScope || pending.principalScope !== latest.principalScope ||
          pending.expectedEditingId !== latest.editingId || latest.readOnly) {
          confirmationActionInFlight.current = false;
          setConfirmationBusy(false);
          return;
        }
        const access = freshAccess.data;
        const accessStillAllowsEdit = freshAccess.isSuccess && access?.canEdit === true &&
          (access.identityMode === "verified" || (isReplit() && access.identityMode === "replit-default"));
        const freshEntry = freshRows.data?.find(row => row.id === pending.targetId && !row.isDeleted);
        if (!freshRows.isSuccess || !freshEntry || !accessStillAllowsEdit) {
          setSaveError(!accessStillAllowsEdit
            ? "Edit access could not be confirmed. No record was changed."
            : "This record is no longer available to remove.");
          confirmationActionInFlight.current = false;
          setConfirmationBusy(false);
          return;
        }
        confirmationFocus.current = { opener: null, fallbackSelector: "[data-section-h-add]" };
        confirmationRef.current = null;
        setConfirmation(null);
        setConfirmationBusy(false);
        lifecycleMutation.mutate({ entry: freshEntry, restore: false });
      } catch (error) {
        setSaveError(errorDetails(error).message);
        confirmationActionInFlight.current = false;
        setConfirmationBusy(false);
      }
      return;
    }
    const currentTarget = pending.target
      ? current.entries.find(row => row.id === pending.target?.id && !row.isDeleted)
      : undefined;
    if (pending.target && !currentTarget) {
      setConfirmation(null);
      return;
    }
    confirmationRef.current = null;
    setConfirmation(null);
    if (pending.nextAction === "begin") applyBegin(currentTarget);
    else {
      setEditingId(null); setDraft(blankDraft()); setFieldErrors({}); setSaveError("");
    }
  };
  const dateWarning = (value: string | null) => {
    if (!value) return "";
    return classSurveyDay(value) ? "" : "Stored date is not a valid calendar date. It is shown unchanged.";
  };
  const societyLabel = (entry: RegulatoryEntry) => entry.classificationSociety || societies.find((x) => x.listKey === entry.classificationSocietyKey)?.listValue || entry.classificationSocietyKey || "—";
  const surveyLabel = (entry: RegulatoryEntry) => {
    const master = surveys.find((x) => x.listKey === entry.surveyTypeKey);
    return [entry.surveyType || master?.listValue || entry.surveyTypeKey || "—", master?.category, master?.listKey].filter(Boolean).join(" · ");
  };
  const saveEntry = () => {
    const errors = validateClassRegulatoryDates(draft, originalDates.current);
    const isNew = editingId === "new";
    if (isNew || draft.classificationSocietyKey !== originalReferences.current.classificationSocietyKey) {
      if (!draft.classificationSocietyKey) errors.classificationSocietyKey = "Select a classification society.";
    }
    if (isNew || draft.surveyTypeKey !== originalReferences.current.surveyTypeKey) {
      if (!draft.surveyTypeKey) errors.surveyTypeKey = "Select a survey type.";
    }
    if (Object.keys(errors).length) {
      setFieldErrors((previous) => ({ ...previous, ...errors }));
      setSaveError("Please correct the highlighted fields.");
      return;
    }
    saveMutation.mutate();
  };
  const control = (name: keyof Draft, label: string, required = false) => (
    <div className="min-w-0">
      <label htmlFor={`h-${name}`} className="mb-1 block text-xs font-medium text-gray-600">{label}{required && <span className="text-red-600"> *</span>}</label>
      <select id={`h-${name}`} value={draft[name]} onChange={(e) => setValue(name, e.target.value)} className={`w-full ${inputClass} bg-white`} aria-invalid={!!fieldErrors[name]} aria-describedby={fieldErrors[name] ? `h-${name}-error` : undefined}>
        <option value="">Select {label.toLowerCase()}</option>
        {name === "classificationSocietyKey" && originalReferences.current.classificationSocietyKey && !societies.some((item) => item.listKey === originalReferences.current.classificationSocietyKey) && (
          <option value={originalReferences.current.classificationSocietyKey}>
            {originalReferences.current.classificationSociety || originalReferences.current.classificationSocietyKey} · saved reference (inactive/unavailable)
          </option>
        )}
        {name === "surveyTypeKey" && originalReferences.current.surveyTypeKey && !surveys.some((item) => item.listKey === originalReferences.current.surveyTypeKey) && (
          <option value={originalReferences.current.surveyTypeKey}>
            {originalReferences.current.surveyType || originalReferences.current.surveyTypeKey} · saved reference (inactive/unavailable)
          </option>
        )}
        {(name === "classificationSocietyKey" ? societies : surveys).map((item) => (
          <option key={item.listKey} value={item.listKey}>{item.listValue}{name === "surveyTypeKey" ? [item.category, item.listKey].filter(Boolean).map((part) => ` · ${part}`).join("") : item.country ? ` · ${item.country}` : ""}</option>
        ))}
      </select>
      {fieldErrors[name] && <p id={`h-${name}-error`} role="alert" className="mt-1 text-xs text-red-700">{fieldErrors[name]}</p>}
    </div>
  );
  const textField = (name: keyof Draft, label: string, maxLength: number, multiline = false) => (
    <div className="min-w-0">
      <label htmlFor={`h-${name}`} className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {multiline ? <textarea id={`h-${name}`} value={draft[name]} maxLength={maxLength} rows={3} onChange={(e) => setValue(name, e.target.value)} className="w-full rounded-sm border border-[#52baf3] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#52baf3]" aria-invalid={!!fieldErrors[name]} /> : <Input id={`h-${name}`} value={draft[name]} maxLength={maxLength} onChange={(e) => setValue(name, e.target.value)} className={inputClass} aria-invalid={!!fieldErrors[name]} />}
      <div className="mt-1 flex justify-between gap-2"><span role="alert" className="text-xs text-red-700">{fieldErrors[name]}</span><span className="text-[10px] text-gray-400">{draft[name].length}/{maxLength}</span></div>
    </div>
  );

  const confirmationDialog = (
    <AlertDialog open={!!confirmation} onOpenChange={(open) => { if (!open) closeConfirmation(); }}>
        <AlertDialogContent
          className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto sm:w-full"
          onOpenAutoFocus={(event) => { event.preventDefault(); cancelConfirmationRef.current?.focus(); }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.kind === "remove" ? "Remove classification record?" : "Discard changes?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.kind === "remove"
                ? "This record will be removed from the active register. An authorized user can restore it later."
                : confirmation?.kind === "discard" && confirmation.nextAction === "begin"
                  ? "Your current unsaved entry will be discarded and the requested entry will open."
                  : "Your unsaved Section H entry and its validation messages will be discarded."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel ref={cancelConfirmationRef} onClick={closeConfirmation}>
              {confirmation?.kind === "remove" ? "Cancel" : "Keep editing"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); confirmPendingAction(); }}
              disabled={confirmationBusy}
              className={confirmation?.kind === "remove" ? "bg-red-700 text-white hover:bg-red-800" : ""}
            >
              {confirmation?.kind === "remove" ? "Remove entry" : "Discard changes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
  );
  if (!currentUser) return <>{confirmationDialog}<div role="alert" className="text-sm text-amber-900">Please sign in to access Classification &amp; Regulatory Data.</div></>;
  if (!id) return <>{confirmationDialog}<div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Save the component first to add or view classification records.</div></>;
  if (rowsQuery.isLoading) return <>{confirmationDialog}<div className="space-y-2" aria-label="Loading classification records">{[1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-sm bg-slate-100" />)}</div></>;
  if (rowsQuery.isError) return <>{confirmationDialog}<div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span className="min-w-0 flex-1">{errorDetails(rowsQuery.error).message}</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => rowsQuery.refetch()}><RefreshCw className="mr-1 h-3.5 w-3.5" />Retry records</Button><Button size="sm" variant="outline" onClick={() => accessQuery.refetch()}>Retry access</Button></div></div></>;

  return (
    <section className="space-y-3" aria-label="Classification and regulatory data">
      {confirmationDialog}
      {!classItem && <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">This component is marked “Class Item: No”. Records remain visible and are not removed.</div>}
      {switchNotice && <p role="status" className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{switchNotice}</p>}
      {!readOnly && accessQuery.isLoading && <div className="h-8 animate-pulse rounded-sm bg-slate-100" />}
      {accessQuery.isError && <div role="alert" className="rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorDetails(accessQuery.error).message} This register is read-only until access can be confirmed. <Button size="sm" variant="outline" className="ml-2 h-7" onClick={() => accessQuery.refetch()}>Retry access</Button></div>}
      {accessQuery.isSuccess && !canEdit && <div className="flex items-start gap-2 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{accessQuery.data.reason || "You have read-only access to classification records."}</span></div>}
      {(canEdit || canViewRemoved) && <div className="flex flex-wrap items-center justify-between gap-2">
        {canEdit && <div className="flex items-center gap-2 text-xs text-slate-600"><ShieldCheck className="h-4 w-4 text-emerald-700" />{accessQuery.data?.identityMode === "replit-default" ? "Replit default-user access. " : ""}Changes save per entry, independently of the component.</div>}
        <div className="flex flex-wrap gap-2">
          {canViewRemoved && <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />Show removed</label>}
          {canEdit && <Button data-section-h-add size="sm" className="h-8 bg-[#16569e] text-white hover:bg-[#12477f]" onClick={(event) => begin(undefined, event.currentTarget)} disabled={editingId !== null || saveMutation.isPending}><Plus className="mr-1 h-3.5 w-3.5" />Add entry</Button>}
        </div>
      </div>}
      {saveError && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{saveError}</p>}
      {editingId !== null && <div className="space-y-3 rounded-sm border border-sky-200 bg-sky-50/40 p-3">
        {editingId !== "new" && (!originalReferences.current.classificationSocietyKey || !originalReferences.current.surveyTypeKey) && <p className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">This legacy entry has a missing stable master reference. You may leave it unchanged while editing other fields; its saved snapshot will be preserved.</p>}
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {control("classificationSocietyKey", "Classification Society", editingId === "new" || !!originalReferences.current.classificationSocietyKey)}
          {textField("certificateNumber", "Certificate Number", 100)}
          <div><label className="mb-1 block text-xs font-medium text-gray-600">Last Class Survey</label><ComponentDateInput value={draft.lastClassSurvey} onChange={(v) => setValue("lastClassSurvey", v)} className={inputClass} data-testid="input-last-class-survey" />{fieldErrors.lastClassSurvey && <p role="alert" className="mt-1 text-xs text-red-700">{fieldErrors.lastClassSurvey}</p>}</div>
          <div><label className="mb-1 block text-xs font-medium text-gray-600">Next Class Survey</label><ComponentDateInput value={draft.nextSurveyDue} onChange={(v) => setValue("nextSurveyDue", v)} className={inputClass} data-testid="input-next-survey-due" />{fieldErrors.nextSurveyDue && <p role="alert" className="mt-1 text-xs text-red-700">{fieldErrors.nextSurveyDue}</p>}</div>
          {control("surveyTypeKey", "Survey Type", editingId === "new" || !!originalReferences.current.surveyTypeKey)}
          {textField("classRequirements", "Class Requirements", 2000, true)}
          <div className="rounded-sm border border-slate-200 bg-slate-50 px-2.5 py-2"><span className="block text-xs font-medium text-gray-600">Class Code</span><span className="text-sm text-slate-700">Assigned from classification society</span></div>
          {textField("information", "Information", 2000, true)}
        </div>
        {(societyQuery.isError || surveyQuery.isError) && <p role="alert" className="text-xs text-red-700">Master selections could not be loaded. <button className="underline" onClick={() => { societyQuery.refetch(); surveyQuery.refetch(); }}>Retry</button></p>}
        {!canEdit && <p role="status" className="text-sm text-amber-800">Edit access is not currently confirmed. Your draft has been retained.</p>}
        <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={cancel} disabled={saveMutation.isPending}><X className="mr-1 h-3.5 w-3.5" />Cancel</Button><Button size="sm" onClick={saveEntry} disabled={!canEdit || saveMutation.isPending || (editingId === "new" && (!draft.classificationSocietyKey || !draft.surveyTypeKey))}><Save className="mr-1 h-3.5 w-3.5" />{saveMutation.isPending ? "Saving…" : "Save entry"}</Button></div>
      </div>}
      {rowsQuery.isSuccess && entries.length === 0 && editingId === null ? <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center"><p className="text-sm font-medium text-slate-700">No classification records have been added for this component.</p>{canEdit && <p className="mt-1 text-xs text-slate-500">Add a record for each certificate or survey.</p>}</div> : (
        <div className="space-y-2">
          {entries.map((entry) => <article key={entry.id} className={`rounded-sm border ${entry.isDeleted ? "border-slate-200 bg-slate-50 opacity-80" : "border-slate-200 bg-white"} p-3`}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              {entry.isDeleted && <span className="w-fit rounded-sm bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">Removed</span>}
              {canEdit && <div className="ml-auto flex shrink-0 gap-1">
                {entry.isDeleted ? <Button size="sm" variant="outline" className="h-8" aria-label="Restore entry" disabled={lifecycleMutation.isPending} onClick={() => lifecycleMutation.mutate({ entry, restore: true })}><RotateCcw className="mr-1 h-3.5 w-3.5" />Restore</Button> : <><Button data-section-h-entry-edit={entry.id} size="icon" variant="outline" className="h-8 w-8" aria-label="Edit entry" disabled={editingId !== null} onClick={(event) => begin(entry, event.currentTarget)}><Pencil className="h-3.5 w-3.5" /></Button><Button size="icon" variant="outline" className="h-8 w-8 text-red-700 hover:bg-red-50" aria-label="Remove entry" disabled={lifecycleMutation.isPending || editingId !== null} onClick={(event) => requestRemove(entry, event.currentTarget)}><Trash2 className="h-3.5 w-3.5" /></Button></>}
              </div>}
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Classification Society</span><span className="block break-words [overflow-wrap:anywhere] text-sm text-slate-900">{societyLabel(entry)}</span></div>
              <div className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Certificate Number</span><span className="block break-words [overflow-wrap:anywhere] text-sm text-slate-900">{entry.certificateNumber || "—"}</span></div>
              <div className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Last Class Survey</span><span className="block break-words text-sm text-slate-900">{formatComponentDate(entry.lastClassSurvey)}</span>{dateWarning(entry.lastClassSurvey) && <span className="block break-words text-[10px] text-amber-800">{dateWarning(entry.lastClassSurvey)}</span>}</div>
              <div className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Next Class Survey</span><span className="block break-words text-sm text-slate-900">{formatComponentDate(entry.nextSurveyDue)}</span>{dateWarning(entry.nextSurveyDue) && <span className="block break-words text-[10px] text-amber-800">{dateWarning(entry.nextSurveyDue)}</span>}</div>
              <div className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Survey Type</span><span className="block break-words [overflow-wrap:anywhere] text-sm text-slate-900">{surveyLabel(entry)}</span></div>
              <div className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Class Requirements</span><span className="block whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm text-slate-700">{entry.classRequirements || "—"}</span></div>
              <div className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Class Code</span><span className="block break-words [overflow-wrap:anywhere] text-sm text-slate-900">{entry.classCode || "—"}</span></div>
              <div className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Information</span><span className="block whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm text-slate-700">{entry.information || "—"}</span></div>
            </div>
            <ClassRegulatoryAttachments
              key={`${securityScope}:${entry.ccruuid || `missing-${entry.id}`}`}
              entryUuid={entry.ccruuid}
              parentDeleted={entry.isDeleted === true}
              componentId={id}
              securityScope={securityScope}
              canEdit={canEdit}
              canViewRemoved={canViewRemoved}
              currentUser={currentUser}
            />
          </article>)}
        </div>
      )}
    </section>
  );
}
