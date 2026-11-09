import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormMasterCategory, FormMasterGroup } from "@shared/pmsFormsMasterContracts";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";

const base = "/technical/api/admin/forms-master";
interface Props {
  open: boolean;
  groups: FormMasterGroup[];
  categories: FormMasterCategory[];
  capabilities: { create: boolean; edit: boolean; delete: boolean };
  onClose: () => void;
}
type LabelRow = { uuid: string; key: string; name: string; deleted: boolean; kind: "group" | "category" };

export default function FormsMasterLabelsDialog({ open, groups, categories, capabilities, onClose }: Props) {
  const [groupUuid, setGroupUuid] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LabelRow | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: [base] });
    await qc.invalidateQueries({ predicate: q => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith(`${base}/`) });
  };
  const mutate = useMutation({
    mutationFn: async ({ method, path, body }: { method: string; path: string; body?: unknown }) => {
      const response = await apiRequest(method, `${base}${path}`, body);
      return response.status === 204 ? null : response.json();
    },
    onSuccess: async () => { setError(""); setNewName(""); await refresh(); toast({ title: "Label saved" }); },
    onError: (e: Error) => setError(e.message || "Could not save label. Your input has been kept."),
  });

  const rows: LabelRow[] = useMemo(() => [
    ...groups.map(g => ({ uuid: g.fguuid, key: g.groupCode, name: g.groupName, deleted: g.isDeleted, kind: "group" as const })),
    ...categories.filter(c => c.groupUuid === groupUuid).map(c => ({ uuid: c.fcuuid, key: String(c.categoryNo).padStart(2, "0"), name: c.categoryName, deleted: c.isDeleted, kind: "category" as const })),
  ], [groups, categories, groupUuid]);
  const saveName = (row: LabelRow, value: string) => {
    if (!value.trim()) { setError("Label name is required."); return; }
    const path = row.kind === "group" ? `/groups/${row.uuid}` : `/categories/${row.uuid}`;
    mutate.mutate({ method: "PUT", path, body: { [row.kind === "group" ? "groupName" : "categoryName"]: value.trim() } });
  };
  const reorder = (row: LabelRow, delta: number) => {
    const active = rows.filter(r => !r.deleted && r.kind === row.kind);
    const from = active.findIndex(r => r.uuid === row.uuid);
    const to = from + delta;
    if (to < 0 || to >= active.length) return;
    const ordered = [...active]; [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
    mutate.mutate({ method: "PUT", path: row.kind === "group" ? "/groups/order" : "/categories/order", body: row.kind === "group"
      ? { uuids: ordered.map(r => r.uuid) } : { groupUuid, uuids: ordered.map(r => r.uuid) } });
  };
  const action = (row: LabelRow, restore: boolean) => {
    const path = row.kind === "group" ? `/groups/${row.uuid}` : `/categories/${row.uuid}`;
    mutate.mutate({ method: restore ? "POST" : "DELETE", path: restore ? `${path}/restore` : path });
  };
  const add = () => {
    if (!newName.trim()) { setError("Enter a label name."); return; }
    if (groupUuid) mutate.mutate({ method: "POST", path: "/categories", body: { groupUuid, categoryName: newName.trim() } });
    else mutate.mutate({ method: "POST", path: "/groups", body: { groupName: newName.trim() } });
  };

  return <Dialog open={open} onOpenChange={v => !v && onClose()}>
    <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Forms Master · Label Configuration</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Group and Category keys are system-assigned. Each change saves independently.</p>
      <label className="text-sm font-medium">Category group
        <select value={groupUuid} onChange={e => { setGroupUuid(e.target.value); setError(""); }} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">Groups</option>{groups.filter(g => !g.isDeleted).map(g => <option key={g.fguuid} value={g.fguuid}>{g.groupCode}. {g.groupName}</option>)}
        </select>
      </label>
      {capabilities.create && <div className="flex gap-2"><Input value={newName} maxLength={200} onChange={e => { setNewName(e.target.value); setError(""); }} placeholder={groupUuid ? "New category label" : "New group label"} /><Button onClick={add} disabled={mutate.isPending}><Plus className="mr-1 h-4 w-4" />Add</Button></div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[540px] text-sm">
          <thead className="bg-muted text-left"><tr><th className="p-3 w-24">Key</th><th className="p-3">Label</th><th className="p-3 w-44">Actions</th></tr></thead>
          <tbody>{rows.map(row => <LabelEditor key={row.uuid} row={row} busy={mutate.isPending} canEdit={capabilities.edit} canDelete={capabilities.delete} onSave={v => saveName(row, v)} onAction={restore => restore ? action(row, true) : setDeleteTarget(row)} onMove={delta => reorder(row, delta)} />)}
            {rows.length === 0 && <tr><td className="p-6 text-center text-muted-foreground" colSpan={3}>No labels in this view.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end"><Button variant="outline" onClick={onClose}>Done</Button></div>
    </DialogContent>
    <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this {deleteTarget?.kind}?</AlertDialogTitle>
          <AlertDialogDescription>“{deleteTarget?.name}” will be soft-deleted. You can restore it later.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => { if (deleteTarget) action(deleteTarget, false); setDeleteTarget(null); }}>Delete label</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Dialog>;
}

function LabelEditor({ row, busy, canEdit, canDelete, onSave, onAction, onMove }: { row: LabelRow; busy: boolean; canEdit: boolean; canDelete: boolean; onSave: (value: string) => void; onAction: (restore: boolean) => void; onMove: (delta: number) => void }) {
  const [value, setValue] = useState(row.name);
  return <tr className={row.deleted ? "bg-muted/40 text-muted-foreground" : "border-t"}>
    <td className="p-3 font-mono">{row.key}</td>
    <td className="p-2"><Input value={value} disabled={row.deleted || !canEdit} maxLength={200} onChange={e => setValue(e.target.value)} aria-label={`${row.kind} label`} /></td>
    <td className="p-2"><div className="flex gap-1">
      {!row.deleted && <>{canEdit && <><Button size="sm" variant="outline" onClick={() => onSave(value)} disabled={busy || value.trim() === row.name}>Save</Button><Button size="icon" variant="ghost" aria-label="Move up" onClick={() => onMove(-1)} disabled={busy}><ArrowUp className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Move down" onClick={() => onMove(1)} disabled={busy}><ArrowDown className="h-4 w-4" /></Button></>}{canDelete && <Button size="icon" variant="ghost" aria-label="Delete label" onClick={() => onAction(false)}><Trash2 className="h-4 w-4" /></Button>}</>}
      {row.deleted && canEdit && <Button size="sm" variant="outline" onClick={() => onAction(true)}><RotateCcw className="mr-1 h-4 w-4" />Restore</Button>}
    </div></td>
  </tr>;
}
