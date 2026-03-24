import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Fuel } from "lucide-react";
import BunkerEntryForm from "./BunkerEntryForm";
import BunkerCostSummary from "./BunkerCostSummary";
import type { NrBunkerRecord } from "@shared/schema";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: string | number | null | undefined, decimals = 2): string {
  const n = Number(value);
  if (isNaN(n) || value === null || value === undefined) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

const FUEL_COLORS: Record<string, string> = {
  HFO:   "bg-blue-100 text-blue-800",
  VLSFO: "bg-indigo-100 text-indigo-800",
  LSMGO: "bg-cyan-100 text-cyan-800",
  MGO:   "bg-teal-100 text-teal-800",
  LPG:   "bg-purple-100 text-purple-800",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function BunkerManagement() {
  const { vesselId } = useVessel();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<NrBunkerRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NrBunkerRecord | null>(null);

  // Fetch latest submitted report to get current active voyage number
  const { data: latestReports } = useQuery<Array<{ voyageNo: string | null }>>({
    queryKey: ["/api/nr-reports-latest", vesselId],
    queryFn: () =>
      fetch(`/technical/api/nr-reports?vesselId=${vesselId}&status=submitted`)
        .then(r => r.json()),
    enabled: !!vesselId,
    select: (data) => data.slice(0, 1),
    refetchOnWindowFocus: false,
  });
  const activeVoyageNo = latestReports?.[0]?.voyageNo ?? undefined;

  // Fetch bunker records
  const { data: records, isLoading } = useQuery<NrBunkerRecord[]>({
    queryKey: ["/api/nr-bunker", vesselId],
    queryFn: () =>
      fetch(`/technical/api/nr-bunker?vesselId=${vesselId}`).then(r => r.json()),
    enabled: !!vesselId,
    refetchOnWindowFocus: false,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/technical/api/nr-bunker/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nr-bunker"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nr-bunker-cost"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nr-fuel-rob"] });
      toast({ title: "Record deleted", description: "Bunker record and ROB adjustment removed." });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({
        title: "Delete failed",
        description: err?.message ?? "An error occurred",
        variant: "destructive",
      });
      setDeleteTarget(null);
    },
  });

  function handleNewRecord() {
    setEditRecord(null);
    setFormOpen(true);
  }

  function handleEdit(record: NrBunkerRecord) {
    setEditRecord(record);
    setFormOpen(true);
  }

  function handleCloseForm() {
    setFormOpen(false);
    setEditRecord(null);
  }

  if (!vesselId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>Select a vessel to view bunker records.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Bunker Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            BDN records — bunkering events update ROB automatically.
          </p>
        </div>
        <Button onClick={handleNewRecord} data-testid="btn-new-bunker-record">
          <Plus className="h-4 w-4 mr-2" />
          New Bunker Record
        </Button>
      </div>

      {/* Cost Summary */}
      <BunkerCostSummary vesselId={vesselId} voyageNo={activeVoyageNo} />

      {/* Records Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Fuel className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">BDN Records</span>
          {records && (
            <span className="ml-auto text-xs text-gray-400">
              {records.length} record{records.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !records || records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Fuel className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No bunker records yet</p>
            <p className="text-xs mt-1">Click "New Bunker Record" to add the first BDN entry.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Fuel</TableHead>
                  <TableHead className="text-right">Qty (MT)</TableHead>
                  <TableHead className="text-right">Sulphur %</TableHead>
                  <TableHead className="text-right">Price/MT</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>BDN No.</TableHead>
                  <TableHead>Seal No.</TableHead>
                  <TableHead className="text-right w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(record => (
                  <TableRow key={record.id} data-testid={`bunker-row-${record.id}`}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {fmtDate(record.bunkeredDate)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {record.port}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs font-semibold ${FUEL_COLORS[record.fuelType] ?? "bg-gray-100 text-gray-700"}`}
                        data-testid={`badge-fuel-${record.id}`}
                      >
                        {record.fuelType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums" data-testid={`qty-${record.id}`}>
                      {fmt(record.quantityMt, 3)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {record.sulphurPct ? `${fmt(record.sulphurPct, 2)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {record.pricePmt ? `$${fmt(record.pricePmt, 2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums" data-testid={`total-cost-${record.id}`}>
                      {record.totalCost ? `$${fmt(record.totalCost, 0)}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {record.supplier || "—"}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-gray-600">
                      {record.bdnNumber || "—"}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-gray-600">
                      {record.sampleSealNumber || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-blue-600"
                          onClick={() => handleEdit(record)}
                          data-testid={`btn-edit-bunker-${record.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-red-600"
                          onClick={() => setDeleteTarget(record)}
                          data-testid={`btn-delete-bunker-${record.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Entry Form Dialog */}
      {formOpen && (
        <BunkerEntryForm
          open={formOpen}
          onClose={handleCloseForm}
          vesselId={vesselId}
          record={editRecord}
          activeVoyageNo={activeVoyageNo}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bunker Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the{" "}
              <strong>{deleteTarget?.fuelType}</strong> bunkering record from{" "}
              <strong>{deleteTarget?.port}</strong> ({fmtDate(deleteTarget?.bunkeredDate)}) and
              reverse the ROB adjustment of{" "}
              <strong>{fmt(deleteTarget?.quantityMt, 3)} MT</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              data-testid="btn-delete-confirm"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
