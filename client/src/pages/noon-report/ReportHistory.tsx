import { useContext, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { VesselContext } from "@/contexts/VesselContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle,
  Clock,
  Edit3,
  Trash2,
  Plus,
  Search,
  Loader2,
  FileText,
} from "lucide-react";

interface NoonReport {
  id: number;
  vessel_id: string;
  status: string;
  report_date: string;
  report_time: string | null;
  voyage_no: string | null;
  port_from: string | null;
  port_to: string | null;
  speed: string | null;
  distance_sailed: string | null;
  hfo_consumption: string | null;
  lsmgo_consumption: string | null;
  mgo_consumption: string | null;
  hfo_rob: string | null;
  cii_rating: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  draft_saved_at: string | null;
  condition: string | null;
}

export default function ReportHistory() {
  const vesselCtx = useContext(VesselContext);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const vesselId = vesselCtx?.vesselId || "";

  const { data: reports = [], isLoading } = useQuery<NoonReport[]>({
    queryKey: ["/technical/api/nr-reports", vesselId],
    queryFn: async () => {
      if (!vesselId) return [];
      const res = await fetch(`/technical/api/nr-reports?vesselId=${vesselId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
    enabled: !!vesselId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/technical/api/nr-reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/nr-reports"] });
      toast({ title: "Report deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Cannot delete", description: err.message, variant: "destructive" });
    },
  });

  const filtered = reports.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.report_date?.toLowerCase().includes(q) ||
      r.voyage_no?.toLowerCase().includes(q) ||
      r.port_from?.toLowerCase().includes(q) ||
      r.port_to?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q)
    );
  });

  const totalConsumption = (r: NoonReport) => {
    return (
      (parseFloat(r.hfo_consumption || "0") || 0) +
      (parseFloat(r.lsmgo_consumption || "0") || 0) +
      (parseFloat(r.mgo_consumption || "0") || 0)
    ).toFixed(1);
  };

  const ciiColor = (rating: string | null) => {
    if (!rating) return "text-gray-400";
    return { A: "text-green-600", B: "text-green-500", C: "text-yellow-600", D: "text-orange-500", E: "text-red-600" }[rating] || "text-gray-600";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-800">Report History</h1>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => setLocation("/noon-report/entry")}
          data-testid="button-new-report"
        >
          <Plus className="h-4 w-4 mr-1" /> New Report
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reports…"
          className="pl-9 h-9 text-sm"
          data-testid="input-search"
        />
      </div>

      {/* Summary Chips */}
      {!isLoading && reports.length > 0 && (
        <div className="flex gap-3 flex-wrap text-sm">
          <span className="px-3 py-1 bg-gray-100 rounded-full text-gray-600">
            {reports.length} total
          </span>
          <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full">
            {reports.filter(r => r.status === "submitted").length} submitted
          </span>
          <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full">
            {reports.filter(r => r.status === "draft").length} drafts
          </span>
        </div>
      )}

      {/* Table */}
      {!vesselId ? (
        <Card><CardContent className="py-10 text-center text-gray-400 text-sm">Please select a vessel to view reports.</CardContent></Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No reports found.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setLocation("/noon-report/entry")}
              data-testid="button-create-first"
            >
              Create first report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs font-semibold text-gray-600">Date</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">Voyage</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">Route</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 text-right">Speed (kts)</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 text-right">Distance (NM)</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 text-right">Total Cons. (MT)</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 text-center">CII</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">Status</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="hover:bg-gray-50" data-testid={`row-report-${r.id}`}>
                  <TableCell className="text-sm font-medium text-gray-800">
                    {r.report_date}
                    {r.report_time && <span className="text-xs text-gray-400 ml-1">{r.report_time}</span>}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{r.voyage_no || "—"}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {r.port_from && r.port_to ? `${r.port_from} → ${r.port_to}` : (r.port_from || r.port_to || "—")}
                  </TableCell>
                  <TableCell className="text-sm text-gray-700 text-right">
                    {r.speed ? Number(r.speed).toFixed(1) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-700 text-right">
                    {r.distance_sailed ? Number(r.distance_sailed).toFixed(0) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-700 text-right">
                    {totalConsumption(r)}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-sm font-bold ${ciiColor(r.cii_rating)}`}>
                      {r.cii_rating || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {r.status === "submitted" ? (
                      <Badge className="bg-green-100 text-green-700 border border-green-200 gap-1 text-xs" data-testid={`status-submitted-${r.id}`}>
                        <CheckCircle className="h-3 w-3" /> Submitted
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 border border-amber-200 gap-1 text-xs" data-testid={`status-draft-${r.id}`}>
                        <Clock className="h-3 w-3" /> Draft
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-500 hover:text-blue-600"
                        onClick={() => setLocation(`/noon-report/entry/${r.id}`)}
                        data-testid={`button-edit-${r.id}`}
                        title={r.status === "submitted" ? "View" : "Edit"}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      {r.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-red-600"
                          onClick={() => deleteMutation.mutate(r.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${r.id}`}
                          title="Delete draft"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
