import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Archive, Loader2, AlertTriangle, ShieldCheck, Save, RotateCcw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Setting {
  category: string; label: string; retentionValue: number; retentionUnit: string;
  enabled: boolean; isProtected: boolean; minValue: number; minUnit: string; description: string | null;
}
interface Eligibility { eligible: number; disposed: number; }
interface RetentionResponse { settings: Setting[]; eligibility: Record<string, Eligibility>; }

const UNITS = ["days", "months", "years", "forever"];
const KEY = "/technical/api/admin/retention-settings";

export default function RetentionSettings() {
  const { toast } = useToast();
  const [edits, setEdits] = useState<Record<string, { retentionValue: number; retentionUnit: string }>>({});
  const [disposeTarget, setDisposeTarget] = useState<{ category: string; label: string; eligible: number } | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const query = useQuery<RetentionResponse>({ queryKey: [KEY] });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [KEY] });

  const saveMut = useMutation({
    mutationFn: async (s: Setting) => {
      const e = edits[s.category] ?? { retentionValue: s.retentionValue, retentionUnit: s.retentionUnit };
      return apiRequest("PUT", `${KEY}/${s.category}`, { retentionValue: e.retentionValue, retentionUnit: e.retentionUnit });
    },
    onSuccess: (_d, s) => { toast({ title: "Saved", description: `${s.label} retention updated.` }); setEdits((p) => { const n = { ...p }; delete n[s.category]; return n; }); invalidate(); },
    onError: (err: any) => toast({ title: "Cannot save", description: String(err.message).replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });

  const actionMut = useMutation({
    mutationFn: async ({ category, action }: { category: string; action: "dispose" | "retain" | "revert" }) =>
      (await apiRequest("POST", `${KEY}/${category}/${action}`, {})).json(),
    onSuccess: (d: any, v) => {
      const verb = v.action === "dispose" ? `Marked ${d.count ?? 0} record(s) disposed (recoverable via Revert)` : v.action === "revert" ? `Restored ${d.count ?? 0} record(s)` : "Retain decision logged";
      toast({ title: "Done", description: verb });
      invalidate();
    },
    onError: (err: any) => toast({ title: "Action failed", description: String(err.message).replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });

  const settings = query.data?.settings ?? [];
  const eligibility = query.data?.eligibility ?? {};
  const totalEligible = Object.values(eligibility).reduce((a, e) => a + (e?.eligible ?? 0), 0);

  const periodLabel = (s: Setting) => s.retentionUnit === "forever" ? "Forever / no disposal" : `${s.retentionValue} ${s.retentionUnit}`;
  const confirmDispose = useCallback(() => {
    if (!disposeTarget) return;
    actionMut.mutate({ category: disposeTarget.category, action: "dispose" });
    setDisposeTarget(null); setConfirmText("");
  }, [disposeTarget, actionMut]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 120px)" }} data-testid="retention-settings-page">
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center gap-3">
          <Archive className="h-7 w-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Retention Settings</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Configured periods are a <span className="font-medium">minimum keep-time</span>, not an auto-delete timer. Business records are never auto-deleted — disposal is a logged, reversible decision.
        </p>
      </div>

      {/* Eligibility banner */}
      {totalEligible > 0 && (
        <div className="flex-shrink-0 mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3" data-testid="eligibility-banner">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-semibold">{totalEligible} record(s)</span> have passed their retention minimum and are eligible for disposal review:
            <span className="ml-1">
              {settings.filter((s) => (eligibility[s.category]?.eligible ?? 0) > 0).map((s) => `${eligibility[s.category].eligible} in ${s.label} (past ${periodLabel(s)})`).join("; ")}.
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-gray-50 z-10">
            <TableRow>
              <TableHead className="text-xs uppercase text-gray-500">Record category</TableHead>
              <TableHead className="text-xs uppercase text-gray-500">Retention (minimum keep-time)</TableHead>
              <TableHead className="text-xs uppercase text-gray-500">Eligible</TableHead>
              <TableHead className="text-xs uppercase text-gray-500">Disposed</TableHead>
              <TableHead className="text-xs uppercase text-gray-500 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" /></TableCell></TableRow>
            ) : settings.map((s) => {
              const e = edits[s.category] ?? { retentionValue: s.retentionValue, retentionUnit: s.retentionUnit };
              const dirty = e.retentionValue !== s.retentionValue || e.retentionUnit !== s.retentionUnit;
              const elig = eligibility[s.category]?.eligible ?? 0;
              const disp = eligibility[s.category]?.disposed ?? 0;
              const hasFlow = ["maintenance", "approval", "audit_general", "user_access"].includes(s.category);
              return (
                <TableRow key={s.category} className="align-top" data-testid={`retention-row-${s.category}`}>
                  <TableCell>
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                      {s.label}
                      {s.isProtected
                        ? <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-200 bg-blue-50"><ShieldCheck className="h-3 w-3 mr-0.5" />Protected</Badge>
                        : <Badge variant="outline" className="text-[10px] text-gray-500">Sync-scratch</Badge>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 max-w-[360px]">{s.description}</div>
                    {s.isProtected && s.minUnit !== "forever" && <div className="text-[11px] text-gray-400 mt-0.5">Floor: {s.minValue} {s.minUnit} (cannot go lower)</div>}
                  </TableCell>
                  <TableCell>
                    {s.retentionUnit === "forever" ? (
                      <span className="text-sm text-gray-600">Forever / no disposal</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Input type="number" min={s.isProtected ? s.minValue : 0} className="h-8 w-20"
                          value={e.retentionValue}
                          onChange={(ev) => setEdits((p) => ({ ...p, [s.category]: { ...e, retentionValue: parseInt(ev.target.value || "0", 10) } }))}
                          data-testid={`input-value-${s.category}`} />
                        <Select value={e.retentionUnit} onValueChange={(v) => setEdits((p) => ({ ...p, [s.category]: { ...e, retentionUnit: v } }))}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>{UNITS.filter((u) => u !== "forever" || !s.isProtected || s.category === "running_hours_history").map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                        {dirty && <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={() => saveMut.mutate(s)} disabled={saveMut.isPending} data-testid={`btn-save-${s.category}`}><Save className="h-3.5 w-3.5" /></Button>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell><span className={elig > 0 ? "text-amber-700 font-medium" : "text-gray-400"}>{hasFlow ? elig : "—"}</span></TableCell>
                  <TableCell><span className={disp > 0 ? "text-gray-700" : "text-gray-400"}>{hasFlow ? disp : "—"}</span></TableCell>
                  <TableCell className="text-right">
                    {hasFlow && (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={actionMut.isPending} onClick={() => actionMut.mutate({ category: s.category, action: "retain" })} data-testid={`btn-retain-${s.category}`}>Retain</Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50" disabled={elig === 0 || actionMut.isPending} onClick={() => { setDisposeTarget({ category: s.category, label: s.label, eligible: elig }); setConfirmText(""); }} data-testid={`btn-dispose-${s.category}`}><Trash2 className="h-3.5 w-3.5 mr-1" />Dispose</Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={disp === 0 || actionMut.isPending} onClick={() => actionMut.mutate({ category: s.category, action: "revert" })} data-testid={`btn-revert-${s.category}`}><RotateCcw className="h-3.5 w-3.5 mr-1" />Revert</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Double-confirm dispose dialog (Cancel = default/safe; Dispose requires type-to-confirm) */}
      <Dialog open={!!disposeTarget} onOpenChange={(o) => { if (!o) { setDisposeTarget(null); setConfirmText(""); } }}>
        <DialogContent data-testid="dispose-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" />Confirm disposal review</DialogTitle>
            <DialogDescription className="pt-2 text-gray-600">
              This will <span className="font-semibold">mark {disposeTarget?.eligible} record(s)</span> in <span className="font-semibold">{disposeTarget?.label}</span> as <span className="font-semibold">disposed</span>.
              <br /><br />
              Records are <span className="font-semibold">marked disposed and removed from active views — they are NOT permanently erased</span> and can be restored with <span className="font-semibold">Revert</span>. Only records past their retention minimum are affected.
              <br /><br />
              Type <span className="font-mono font-semibold">DISPOSE</span> to confirm:
            </DialogDescription>
          </DialogHeader>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DISPOSE" className="h-9" data-testid="dispose-confirm-input" autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDisposeTarget(null); setConfirmText(""); }} data-testid="dispose-cancel">Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" disabled={confirmText !== "DISPOSE" || actionMut.isPending} onClick={confirmDispose} data-testid="dispose-confirm">
              {actionMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dispose"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
