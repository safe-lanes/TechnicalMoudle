import { useEffect, useState } from "react";
import { formMasterInput, FormMasterInput, FormMasterRecord, FormsMasterOptions } from "@shared/pmsFormsMasterContracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  record?: FormMasterRecord | null;
  options: FormsMasterOptions;
  busy?: boolean;
  saveError?: string;
  readOnly?: boolean;
  onClose: () => void;
  onSave: (value: FormMasterInput) => void;
}

export default function FormsMasterRecordDialog({ open, record, options, busy, saveError, readOnly = false, onClose, onSave }: Props) {
  const [scope, setScope] = useState<"fleet" | "vessel">("fleet");
  const [vesselId, setVesselId] = useState("");
  const [groupUuid, setGroupUuid] = useState("");
  const [categoryUuid, setCategoryUuid] = useState("");
  const [formName, setFormName] = useState("");
  const [companyFormName, setCompanyFormName] = useState("");
  const [pre, setPre] = useState(false);
  const [post, setPost] = useState(false);
  const [role, setRole] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setScope(record?.scope ?? "fleet");
    setVesselId(record?.vesselId ?? "");
    setGroupUuid(record?.groupUuid ?? "");
    setCategoryUuid(record?.categoryUuid ?? "");
    setFormName(record?.formName ?? "");
    setCompanyFormName(record?.companyFormName ?? "");
    setPre(record?.woPreApproval ?? false);
    setPost(record?.woPostApproval ?? false);
    setRole(record?.approverRoleRuid ?? "");
    setError("");
  }, [open, record]);

  const categories = options.categories.filter(c => c.groupUuid === groupUuid && !c.isDeleted);
  const submit = () => {
    const parsed = formMasterInput.safeParse({
      scope, vesselId: scope === "vessel" ? vesselId : null, groupUuid, categoryUuid,
      formName, companyFormName,
      woPreApproval: pre, woPostApproval: post, approverRoleRuid: role || null,
    });
    if (!parsed.success) {
      setError("Complete the required fields using valid Group, Category and Vessel values. Names must contain 1–200 characters.");
      return;
    }
    setError("");
    onSave(parsed.data);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{readOnly ? "View form" : record ? "Edit form" : "Add form to catalogue"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Form ID
            <Input readOnly value={record?.formId ?? "Generated on save"} className="mt-1 bg-muted" />
          </label>
          <label className="text-sm font-medium">Scope
            <select value={scope} disabled={!!record || readOnly} onChange={e => { setScope(e.target.value as "fleet" | "vessel"); setVesselId(""); }} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-70">
              <option value="fleet">Fleet</option><option value="vessel">Vessel</option>
            </select>
          </label>
          {scope === "vessel" && <label className="text-sm font-medium">Vessel <span className="text-destructive">*</span>
            <select value={vesselId} disabled={readOnly} onChange={e => setVesselId(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-70">
              <option value="">Select vessel</option>{vesselId && !options.vessels.some(v => v.vuuid === vesselId) && <option value={vesselId}>{record?.vesselName || "Previously assigned vessel"}</option>}{options.vessels.map(v => <option key={v.vuuid} value={v.vuuid}>{v.name}</option>)}
            </select>
          </label>}
          <label className="text-sm font-medium">Group <span className="text-destructive">*</span>
            <select value={groupUuid} disabled={readOnly} onChange={e => { setGroupUuid(e.target.value); setCategoryUuid(""); }} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-70">
              <option value="">Select group</option>{groupUuid && !options.groups.some(g => g.fguuid === groupUuid && !g.isDeleted) && <option value={groupUuid}>{record?.groupCode}. {record?.groupName}</option>}{options.groups.filter(g => !g.isDeleted).map(g => <option key={g.fguuid} value={g.fguuid}>{g.groupCode}. {g.groupName}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Category <span className="text-destructive">*</span>
            <select value={categoryUuid} onChange={e => setCategoryUuid(e.target.value)} disabled={!groupUuid || readOnly} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-60">
              <option value="">Select category</option>{categoryUuid && !categories.some(c => c.fcuuid === categoryUuid) && <option value={categoryUuid}>{String(record?.categoryNo ?? "").padStart(2, "0")}. {record?.categoryName}</option>}{categories.map(c => <option key={c.fcuuid} value={c.fcuuid}>{String(c.categoryNo).padStart(2, "0")}. {c.categoryName}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Form Name <span className="text-destructive">*</span>
            <Input maxLength={200} value={formName} readOnly={readOnly} onChange={e => setFormName(e.target.value)} className="mt-1" />
          </label>
          <label className="text-sm font-medium">Company Form Name <span className="text-destructive">*</span>
            <Input maxLength={200} value={companyFormName} readOnly={readOnly} onChange={e => setCompanyFormName(e.target.value)} className="mt-1" />
          </label>
          <label className="text-sm font-medium">WO Pre Approval
            <select value={String(pre)} disabled={readOnly} onChange={e => setPre(e.target.value === "true")} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-70"><option value="false">No</option><option value="true">Yes</option></select>
          </label>
          <label className="text-sm font-medium">WO Post Approval
            <select value={String(post)} disabled={readOnly} onChange={e => setPost(e.target.value === "true")} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-70"><option value="false">No</option><option value="true">Yes</option></select>
          </label>
          <label className="text-sm font-medium sm:col-span-2">Approver role
            <select value={role} disabled={readOnly} onChange={e => setRole(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-70"><option value="">No approver</option>{role && !options.roles.some(r => r.ruid === role) && <option value={role} disabled>{record?.approverRoleLabel || "Previously assigned role"}</option>}{options.roles.map(r => <option key={r.ruid} value={r.ruid}>{r.assignedRole}</option>)}</select>
          </label>
        </div>
        {record && <section className="rounded-md border bg-muted/40 p-4">
          <h3 className="mb-2 text-sm font-semibold">Guidance · read only</h3>
          <div className="grid gap-3 text-sm sm:grid-cols-2">{[
            ["When to use", record.whenToUse], ["Responsible", record.responsible],
            ["Typical jobs", record.typicalJobs], ["Suggested approver", record.suggestedApprover],
          ].map(([label, value]) => <div key={label}><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 whitespace-pre-wrap">{value || "—"}</div></div>)}</div>
        </section>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {saveError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{saveError}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose}>{readOnly ? "Close" : "Cancel"}</Button>{!readOnly && <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save form"}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
