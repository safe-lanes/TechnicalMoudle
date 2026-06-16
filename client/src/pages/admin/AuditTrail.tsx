import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ScrollText, Loader2, Download, Search, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuditViewRow {
  id: string;
  when: string;
  who: string;
  whoType: string | null;
  action: string;
  entityType: string;
  entityRef: string;
  oldValue: string | null;
  newValue: string | null;
  changes: string | null;
  logType: string;
  remarks: string | null;
  source: string | null;
}
interface AuditResponse { rows: AuditViewRow[]; total: number; limit: number; offset: number; }

const LOG_TYPES = [
  { value: "all", label: "All" },
  { value: "work_orders", label: "Work Orders" },
  { value: "components", label: "Components" },
  { value: "running_hours", label: "Running Hours" },
  { value: "permissions", label: "Permissions / Access" },
  { value: "postponements", label: "Postponements" },
];
const LOG_TYPE_LABEL: Record<string, string> = Object.fromEntries(LOG_TYPES.map((l) => [l.value, l.label]));
const PAGE_SIZE = 50;

const emptyFilters = { logType: "all", startDate: "", endDate: "", actor: "", entityCode: "", actionType: "" };
type Filters = typeof emptyFilters;

function buildQuery(f: Filters, limit: number, offset: number): string {
  const p = new URLSearchParams();
  p.set("logType", f.logType);
  if (f.startDate) p.set("startDate", f.startDate);
  if (f.endDate) p.set("endDate", f.endDate);
  if (f.actor) p.set("actor", f.actor);
  if (f.entityCode) p.set("entityCode", f.entityCode);
  if (f.actionType) p.set("actionType", f.actionType);
  p.set("limit", String(limit));
  p.set("offset", String(offset));
  return p.toString();
}

function fmtUtc(iso: string): string {
  if (!iso) return "";
  return iso.replace("T", " ").slice(0, 19) + " UTC";
}

export default function AuditTrail() {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const query = useQuery<AuditResponse>({
    queryKey: ["/technical/api/admin/audit-trail", applied, offset],
    queryFn: async () => {
      const res = await fetch(`/technical/api/admin/audit-trail?${buildQuery(applied, PAGE_SIZE, offset)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load audit trail");
      return res.json();
    },
  });

  const runSearch = useCallback(() => { setOffset(0); setApplied(draft); }, [draft]);
  const reset = useCallback(() => { setDraft(emptyFilters); setApplied(emptyFilters); setOffset(0); }, []);

  const exportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch(`/technical/api/admin/audit-trail/excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(applied),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Export started", description: "Audit trail Excel downloaded." });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }, [applied, toast]);

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);
  const capped = total > 10000;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 120px)" }} data-testid="audit-trail-page">
      {/* Header */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center gap-3">
          <ScrollText className="h-7 w-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Searchable business audit log — who did what to what, old → new, when. All times shown in UTC.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex-shrink-0 bg-white rounded-lg border border-gray-200 p-3 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Log type</label>
            <Select value={draft.logType} onValueChange={(v) => setDraft({ ...draft, logType: v })}>
              <SelectTrigger className="h-9" data-testid="select-log-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOG_TYPES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">From (UTC)</label>
            <Input type="date" className="h-9" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} data-testid="input-start-date" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">To (UTC)</label>
            <Input type="date" className="h-9" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} data-testid="input-end-date" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Actor</label>
            <Input placeholder="name / rank" className="h-9" value={draft.actor} onChange={(e) => setDraft({ ...draft, actor: e.target.value })} data-testid="input-actor" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Entity / equipment code</label>
            <Input placeholder="WO no, component, role" className="h-9" value={draft.entityCode} onChange={(e) => setDraft({ ...draft, entityCode: e.target.value })} data-testid="input-entity-code" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Action</label>
            <Input placeholder="e.g. create, approve" className="h-9" value={draft.actionType} onChange={(e) => setDraft({ ...draft, actionType: e.target.value })} data-testid="input-action" />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Button onClick={runSearch} className="h-9 bg-blue-600 hover:bg-blue-700" data-testid="btn-search">
            <Search className="h-4 w-4 mr-1.5" /> Search
          </Button>
          <Button onClick={reset} variant="outline" className="h-9" data-testid="btn-reset">
            <RotateCcw className="h-4 w-4 mr-1.5" /> Reset
          </Button>
          <div className="flex-1" />
          <Button onClick={exportExcel} variant="outline" className="h-9" disabled={exporting || total === 0} data-testid="btn-export">
            {exporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />} Export Excel
          </Button>
        </div>
        {capped && (
          <p className="text-xs text-amber-600 mt-2">Showing the most recent records — over 10,000 match. Refine filters for a complete export.</p>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col min-h-0">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-gray-50 z-10">
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead className="text-xs uppercase text-gray-500">When (UTC)</TableHead>
                <TableHead className="text-xs uppercase text-gray-500">Who</TableHead>
                <TableHead className="text-xs uppercase text-gray-500">Action</TableHead>
                <TableHead className="text-xs uppercase text-gray-500">Entity</TableHead>
                <TableHead className="text-xs uppercase text-gray-500">Old → New</TableHead>
                <TableHead className="text-xs uppercase text-gray-500">Log type</TableHead>
                <TableHead className="text-xs uppercase text-gray-500">Remarks / status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-gray-400">No audit records match the current filters.</TableCell></TableRow>
              ) : (
                rows.map((r) => {
                  const isOpen = expanded === r.id;
                  return (
                    <>
                      <TableRow key={r.id} className="hover:bg-gray-50 cursor-pointer align-top" onClick={() => setExpanded(isOpen ? null : r.id)} data-testid={`audit-row`}>
                        <TableCell className="text-gray-400">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap text-gray-700">{fmtUtc(r.when)}</TableCell>
                        <TableCell className="text-sm">
                          <span className="font-medium text-gray-900">{r.who}</span>
                          {r.whoType && <span className="text-xs text-gray-400 ml-1">({r.whoType})</span>}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">{r.action}</TableCell>
                        <TableCell className="text-sm"><span className="text-gray-500">{r.entityType}</span> <span className="font-medium text-gray-900">{r.entityRef}</span></TableCell>
                        <TableCell className="text-xs text-gray-600 max-w-[320px] truncate">{r.changes || (r.oldValue || r.newValue ? `${r.oldValue ?? "∅"} → ${r.newValue ?? "∅"}` : "—")}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] font-normal text-blue-700 border-blue-200 bg-blue-50">{LOG_TYPE_LABEL[r.logType] ?? r.logType}</Badge></TableCell>
                        <TableCell className="text-xs text-gray-500 max-w-[220px] truncate">{r.remarks || "—"}</TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow className="bg-gray-50/60">
                          <TableCell></TableCell>
                          <TableCell colSpan={7} className="text-xs text-gray-600 py-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                              <div><span className="text-gray-400">Old value:</span> <span className="font-mono">{r.oldValue ?? "∅"}</span></div>
                              <div><span className="text-gray-400">New value:</span> <span className="font-mono">{r.newValue ?? "∅"}</span></div>
                              {r.changes && <div className="md:col-span-2"><span className="text-gray-400">Changes:</span> <span className="font-mono">{r.changes}</span></div>}
                              <div><span className="text-gray-400">Source:</span> {r.source ?? "—"}</div>
                              <div><span className="text-gray-400">Record:</span> <span className="font-mono text-gray-400">{r.id}</span></div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination footer */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-gray-200 text-sm text-gray-500">
          <span data-testid="text-pagination">{total === 0 ? "0 records" : `${pageStart}–${pageEnd} of ${total.toLocaleString()}`}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0 || query.isLoading} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} data-testid="btn-prev">Previous</Button>
            <Button variant="outline" size="sm" disabled={pageEnd >= total || query.isLoading} onClick={() => setOffset(offset + PAGE_SIZE)} data-testid="btn-next">Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
