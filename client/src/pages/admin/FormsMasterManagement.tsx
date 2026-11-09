import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormMasterInput, FormMasterRecord, FormsMasterList, FormsMasterOptions } from "@shared/pmsFormsMasterContracts";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Eye, FileText, Plus, Search, Settings2, Trash2, RotateCcw, Pencil } from "lucide-react";
import FormsMasterRecordDialog from "@/components/admin/FormsMasterRecordDialog";
import FormsMasterLabelsDialog from "@/components/admin/FormsMasterLabelsDialog";

const base = "/technical/api/admin/forms-master";
type Sort = "formId" | "scope" | "group" | "category" | "formName" | "companyFormName" | "woPreApproval" | "woPostApproval" | "approver" | "actions";
const columns: { key: Sort; label: string }[] = [
  { key: "formId", label: "Form ID" }, { key: "scope", label: "Scope" }, { key: "group", label: "Group" },
  { key: "category", label: "Category" }, { key: "formName", label: "Form Name" }, { key: "companyFormName", label: "Company Form Name" },
  { key: "woPreApproval", label: "WO Pre Approval" }, { key: "woPostApproval", label: "WO Post Approval" }, { key: "approver", label: "Approver" }, { key: "actions", label: "Actions" },
];
function queryUrl(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") search.set(key, String(value)); });
  return `${base}/${path}?${search.toString()}`;
}
function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return <div className="m-6 rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm"><p className="font-semibold">Couldn’t load Forms Master</p><p className="mt-1 text-muted-foreground">{message}</p><Button className="mt-3" variant="outline" onClick={retry}>Try again</Button></div>;
}

function formsMasterLoadErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const response = raw.match(/^(\d{3}):\s*([\s\S]*)$/);
  const status = response ? Number(response[1]) : null;
  let detail = response?.[2] ?? raw;
  try {
    const parsed = JSON.parse(detail);
    if (typeof parsed?.error === "string") detail = parsed.error;
  } catch {
    // The response may already be a plain-text message.
  }

  if (status === 401) {
    return "Your signed-in identity could not be verified. In Replit, refresh the preview to use its AuthContext default user; elsewhere, sign in through the integrated application and retry.";
  }
  if (/replit default user.*(not registered|matching role)/i.test(detail)) {
    return "The Replit default user is not mapped to an active user with a valid Office/Ship type in this installation. Ask an administrator to verify its user-directory record, then retry.";
  }
  if (/replit forms master identity|configured default user/i.test(detail)) {
    return "The Replit default identity did not match AuthContext. Refresh the preview and try again.";
  }
  if (status === 403 && /admin-masters|only be edited from the office/i.test(detail)) {
    return "Your account is signed in but does not have the required Forms Master permission. Ask an administrator to grant the appropriate admin-masters access.";
  }
  return detail || "Check your access and connection, then try again.";
}

export default function FormsMasterManagement({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState("");
  const [groupUuid, setGroupUuid] = useState("");
  const [categoryUuid, setCategoryUuid] = useState("");
  const [scope, setScope] = useState("");
  const [vesselId, setVesselId] = useState("");
  const [pre, setPre] = useState("");
  const [post, setPost] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<Sort>("formId");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [editing, setEditing] = useState<FormMasterRecord | null | undefined>(undefined);
  const [viewingUuid, setViewingUuid] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FormMasterRecord | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const optionsQuery = useQuery<FormsMasterOptions>({
    queryKey: [`${base}/options`],
    queryFn: async () => (await apiRequest("GET", `${base}/options`)).json(),
  });
  const opts = optionsQuery.data;
  const detailQuery = useQuery<FormMasterRecord>({
    queryKey: [`${base}/records/${viewingUuid}`],
    enabled: !!viewingUuid,
    queryFn: async () => (await apiRequest("GET", `${base}/records/${viewingUuid}`)).json(),
  });
  const categoriesQuery = useQuery({
    queryKey: [base, "categories", groupUuid],
    enabled: !!groupUuid,
    queryFn: async () => (await apiRequest("GET", queryUrl("categories", { groupUuid, showDeleted: "true" }))).json(),
  });
  const listUrl = queryUrl("records", {
    page, pageSize: 20, search, groupUuid, categoryUuid, scope, vesselId,
    pre: pre || undefined, post: post || undefined, showDeleted: String(showDeleted), sort, direction,
  });
  const listQuery = useQuery<FormsMasterList>({ queryKey: [listUrl] });
  const refresh = async () => {
    await qc.invalidateQueries({ predicate: q => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith(base) });
  };
  const saveMutation = useMutation({
    mutationFn: async ({ record, value }: { record?: FormMasterRecord | null; value: FormMasterInput }) => {
      const response = await apiRequest(record ? "PUT" : "POST", record ? `${base}/records/${record.fmuuid}` : `${base}/records`, value);
      return response.json();
    },
    onSuccess: async () => { setEditing(undefined); await refresh(); toast({ title: "Form saved" }); },
    onError: (error: Error) => toast({ title: "Save failed", description: error.message, variant: "destructive" }),
  });
  const actionMutation = useMutation({
    mutationFn: async ({ record, restore }: { record: FormMasterRecord; restore: boolean }) => apiRequest(restore ? "POST" : "DELETE", `${base}/records/${record.fmuuid}${restore ? "/restore" : ""}`),
    onSuccess: async (_, variables) => { await refresh(); toast({ title: variables.restore ? "Form restored" : "Form deleted" }); },
    onError: (error: Error) => toast({ title: "Action failed", description: error.message, variant: "destructive" }),
  });
  const records = listQuery.data?.records ?? [];
  const loadError = optionsQuery.error ?? listQuery.error;
  const retryLoad = () => {
    void optionsQuery.refetch();
    void listQuery.refetch();
  };
  const total = listQuery.data?.total ?? 0;
  const pageSize = listQuery.data?.pageSize ?? 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (listQuery.data && !listQuery.isFetching && page > pageCount) setPage(pageCount);
  }, [listQuery.data, listQuery.isFetching, page, pageCount]);
  const groups = useMemo(() => (opts?.groups ?? []).filter(g => showDeleted || !g.isDeleted), [opts, showDeleted]);
  const categories = (categoriesQuery.data as FormsMasterOptions["categories"] | undefined) ?? opts?.categories ?? [];

  const changeSort = (key: Sort) => {
    if (key === sort) setDirection(d => d === "asc" ? "desc" : "asc");
    else { setSort(key); setDirection("asc"); }
    setPage(1);
  };
  return <main className="space-y-5 pb-8">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><button onClick={onBack} className="mb-2 text-sm text-muted-foreground hover:text-foreground">‹ Fleet Master Data</button>
        <h1 className="text-2xl font-semibold tracking-tight">Forms Master</h1><p className="mt-1 text-sm text-muted-foreground">Office-managed catalogue · read-only on vessels</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => toast({ title: "Form Builder – Feature coming soon" })}><FileText className="mr-2 h-4 w-4" />Create Form</Button>
        {opts && (opts.capabilities.create || opts.capabilities.edit || opts.capabilities.delete) && <Button variant="outline" onClick={() => setLabelsOpen(true)}><Settings2 className="mr-2 h-4 w-4" />Label Configuration</Button>}
        {opts?.capabilities.create && <Button onClick={() => setEditing(null)}><Plus className="mr-2 h-4 w-4" />Add form</Button>}
      </div>
    </div>
    {opts && !opts.capabilities.edit && <div className="rounded-md border border-amber-300/70 bg-amber-50 px-4 py-2 text-sm text-amber-900">Editable from the office only.</div>}
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" placeholder="Search form ID, names, group or category" /></div>
        <select aria-label="Group filter" value={groupUuid} onChange={e => { setGroupUuid(e.target.value); setCategoryUuid(""); setPage(1); }} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">All groups</option>{groups.map(g => <option key={g.fguuid} value={g.fguuid}>{g.groupCode}. {g.groupName}</option>)}</select>
        <select aria-label="Category filter" disabled={!groupUuid} value={categoryUuid} onChange={e => { setCategoryUuid(e.target.value); setPage(1); }} className="h-10 rounded-md border bg-background px-3 text-sm disabled:opacity-50"><option value="">All categories</option>{categories.filter(c => c.groupUuid === groupUuid && (showDeleted || !c.isDeleted)).map(c => <option key={c.fcuuid} value={c.fcuuid}>{String(c.categoryNo).padStart(2, "0")}. {c.categoryName}</option>)}</select>
        <select aria-label="Scope filter" value={scope} onChange={e => { setScope(e.target.value); if (e.target.value !== "vessel") setVesselId(""); setPage(1); }} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">All scopes</option><option value="fleet">Fleet</option><option value="vessel">Vessel</option></select>
        {scope === "vessel" && <select aria-label="Vessel filter" value={vesselId} onChange={e => { setVesselId(e.target.value); setPage(1); }} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">All vessels</option>{opts?.vessels.map(v => <option key={v.vuuid} value={v.vuuid}>{v.name}</option>)}</select>}
        <select aria-label="Pre approval filter" value={pre} onChange={e => { setPre(e.target.value); setPage(1); }} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">Pre approval: any</option><option value="true">Pre approval: Yes</option><option value="false">Pre approval: No</option></select>
        <select aria-label="Post approval filter" value={post} onChange={e => { setPost(e.target.value); setPage(1); }} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">Post approval: any</option><option value="true">Post approval: Yes</option><option value="false">Post approval: No</option></select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showDeleted} onChange={e => { setShowDeleted(e.target.checked); setPage(1); }} />Show deleted</label>
      </div>
      {loadError ? <ErrorPanel message={formsMasterLoadErrorMessage(loadError)} retry={retryLoad} />
      : listQuery.isLoading || optionsQuery.isLoading ? <div className="space-y-3 p-5" aria-label="Loading forms">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}</div>
      : <><div className="overflow-x-auto">
        <table className="w-full min-w-[1250px] text-left text-sm">
          <thead className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground"><tr>{columns.map(col => <th key={col.key} className="px-3 py-3"><button onClick={() => changeSort(col.key)} className="inline-flex items-center gap-1 hover:text-foreground">{col.label}{sort === col.key && (direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</button></th>)}</tr></thead>
          <tbody className="divide-y">{records.map(record => <tr key={record.fmuuid} className={record.isDeleted ? "bg-muted/30 text-muted-foreground" : "hover:bg-muted/30"}>
            <td className="px-3 py-3 font-mono text-xs">{record.formId}{record.isDefault && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-sans text-[10px]">DEFAULT</span>}</td>
            <td className="px-3 py-3">{record.scope === "fleet" ? "Fleet" : record.vesselName || "Vessel"}</td>
            <td className="px-3 py-3">{record.groupCode}. {record.groupName}</td><td className="px-3 py-3">{String(record.categoryNo).padStart(2, "0")}. {record.categoryName}</td>
            <td className="max-w-64 px-3 py-3">{record.formName}</td><td className="max-w-64 px-3 py-3">{record.companyFormName}</td>
            <td className="px-3 py-3">{record.woPreApproval ? "Yes" : "No"}</td><td className="px-3 py-3">{record.woPostApproval ? "Yes" : "No"}</td><td className="px-3 py-3">{record.approverRoleLabel || "—"}</td>
            <td className="px-3 py-2"><div className="flex gap-1">
              <Button size="icon" variant="ghost" aria-label={`View ${record.formId}`} onClick={() => setViewingUuid(record.fmuuid)}><Eye className="h-4 w-4" /></Button>
              {!record.isDeleted && opts?.capabilities.edit && <Button size="icon" variant="ghost" aria-label={`Edit ${record.formId}`} onClick={() => setEditing(record)}><Pencil className="h-4 w-4" /></Button>}
              {!record.isDeleted && opts?.capabilities.delete && <Button size="icon" variant="ghost" aria-label={`Delete ${record.formId}`} onClick={() => setDeleteTarget(record)} disabled={actionMutation.isPending}><Trash2 className="h-4 w-4" /></Button>}
              {record.isDeleted && opts?.capabilities.edit && <Button size="sm" variant="outline" onClick={() => actionMutation.mutate({ record, restore: true })}><RotateCcw className="mr-1 h-4 w-4" />Restore</Button>}
            </div></td>
          </tr>)}
          {!records.length && <tr><td colSpan={10} className="p-12 text-center"><div className="mx-auto max-w-sm"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted"><FileText className="h-5 w-5 text-muted-foreground" /></div><p className="font-medium">No forms match these filters</p><p className="mt-1 text-sm text-muted-foreground">Try a different search or clear a filter.</p></div></td></tr>}
          </tbody>
        </table>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
        <span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}` : "0 records"}</span>
        <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><span>Page {page} of {pageCount}</span><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div>
      </footer></>}
    </section>
    {opts && <FormsMasterRecordDialog open={editing !== undefined} record={editing} options={opts} busy={saveMutation.isPending} saveError={saveMutation.error?.message} onClose={() => { setEditing(undefined); saveMutation.reset(); }} onSave={value => saveMutation.mutate({ record: editing, value })} />}
    {opts && <FormsMasterLabelsDialog open={labelsOpen} groups={opts.groups} categories={opts.categories} capabilities={opts.capabilities} onClose={() => setLabelsOpen(false)} />}
    {opts && <FormsMasterRecordDialog open={!!viewingUuid && !!detailQuery.data} record={detailQuery.data} options={opts} readOnly onClose={() => setViewingUuid(null)} onSave={() => undefined} />}
    {viewingUuid && detailQuery.isLoading && <div role="status" className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"><div className="rounded-lg bg-background p-5 text-sm shadow-lg">Loading form details…</div></div>}
    {viewingUuid && detailQuery.error && <AlertDialog open onOpenChange={open => !open && setViewingUuid(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Couldn’t load form details</AlertDialogTitle><AlertDialogDescription>{(detailQuery.error as Error).message}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setViewingUuid(null)}>Close</AlertDialogCancel><Button onClick={() => { void detailQuery.refetch(); }}>Try again</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>}
    <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Delete this form?</AlertDialogTitle><AlertDialogDescription>Move {deleteTarget?.formId} · {deleteTarget?.formName} to deleted forms? You can restore it later.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteTarget) actionMutation.mutate({ record: deleteTarget, restore: false }); setDeleteTarget(null); }}>Delete form</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </main>;
}
