import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVessel } from "@/contexts/VesselContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileDown,
  FileSpreadsheet,
  FileText,
  Mail,
  Download,
  CheckCircle,
  Clock,
  Search,
  Loader2,
  Info,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NoonReport {
  id: number;
  vesselId: string;
  status: string;
  reportDate: string;
  reportTime: string | null;
  voyageNo: string | null;
  portFrom: string | null;
  portTo: string | null;
  speed: string | null;
  distanceSailed: string | null;
  course: string | null;
  hfoConsumption: string | null;
  lsmgoConsumption: string | null;
  mgoConsumption: string | null;
  vlsfoConsumption: string | null;
  lpgConsumption: string | null;
  hfoRob: string | null;
  lsmgoRob: string | null;
  mgoRob: string | null;
  vlsfoRob: string | null;
  lpgRob: string | null;
  co2Total: string | null;
  eeoi: string | null;
  ciiRating: string | null;
  condition: string | null;
  cargoQuantity: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  draftSavedAt: string | null;
  meLoad: string | null;
  meRpm: string | null;
  windDirection: string | null;
  windForce: number | null;
  seaState: number | null;
  visibility: string | null;
  airTemperature: string | null;
  seaTemperature: string | null;
  draftForward: string | null;
  draftAft: string | null;
  generalRemarks: string | null;
  nextPort: string | null;
  distanceToGo: string | null;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const fmt = (v: string | number | null | undefined, dp = 2) => {
  const n = Number(v);
  return isNaN(n) || v === null || v === undefined ? "—" : n.toFixed(dp);
};

const str = (v: unknown) => (v !== null && v !== undefined ? String(v) : "—");

const totalCons = (r: NoonReport) =>
  (Number(r.hfoConsumption || 0) +
    Number(r.lsmgoConsumption || 0) +
    Number(r.mgoConsumption || 0) +
    Number(r.vlsfoConsumption || 0) +
    Number(r.lpgConsumption || 0)
  ).toFixed(1);

const ciiColor = (rating: string | null) =>
  ({
    A: "bg-green-100 text-green-700",
    B: "bg-emerald-100 text-emerald-700",
    C: "bg-yellow-100 text-yellow-700",
    D: "bg-orange-100 text-orange-700",
    E: "bg-red-100 text-red-700",
  }[rating ?? ""] ?? "bg-gray-100 text-gray-600");

// ── PDF Export ────────────────────────────────────────────────────────────────

function exportSingleReportToPdf(report: NoonReport, vesselName: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const blue = [30, 58, 95] as [number, number, number];
  const gray = [100, 100, 100] as [number, number, number];

  doc.setFillColor(...blue);
  doc.rect(0, 0, 210, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("NOON REPORT", 14, 11);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${vesselName} | ${report.reportDate} ${report.reportTime ?? ""} UTC`, 14, 16);

  let y = 24;
  const col1 = 14, col2 = 65, col3 = 115, col4 = 165;

  const section = (title: string) => {
    y += 2;
    doc.setFillColor(240, 244, 250);
    doc.rect(14, y, 182, 6, "F");
    doc.setTextColor(...blue);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(title, 16, y + 4);
    y += 8;
  };

  const row = (pairs: [string, string][]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const cols = [col1, col2, col3, col4];
    pairs.forEach(([label, val], i) => {
      doc.setTextColor(...gray);
      doc.text(label, cols[i], y);
      doc.setTextColor(30, 30, 30);
      doc.text(val, cols[i], y + 4);
    });
    y += 9;
  };

  // Voyage info
  section("VOYAGE INFORMATION");
  row([["Status", report.status.toUpperCase()], ["Voyage No.", str(report.voyageNo)], ["Condition", str(report.condition)], [""]]);
  row([["From", str(report.portFrom)], ["To", str(report.portTo)], ["Next Port", str(report.nextPort)], ["ETA / DTG", `${fmt(report.distanceToGo, 0)} NM`]]);

  section("NAVIGATION");
  row([["Speed (kts)", fmt(report.speed, 1)], ["Distance (NM)", fmt(report.distanceSailed, 0)], ["Course (°)", fmt(report.course, 0)], [""]]);

  section("WEATHER");
  row([["Wind Dir", str(report.windDirection)], ["Wind Force (Bft)", str(report.windForce)], ["Sea State", str(report.seaState)], ["Visibility", str(report.visibility)]]);
  row([["Air Temp (°C)", fmt(report.airTemperature, 1)], ["Sea Temp (°C)", fmt(report.seaTemperature, 1)], [""], [""]]);

  section("FUEL CONSUMPTION (MT)");
  row([["HFO", fmt(report.hfoConsumption, 3)], ["LSMGO", fmt(report.lsmgoConsumption, 3)], ["MGO", fmt(report.mgoConsumption, 3)], ["VLSFO", fmt(report.vlsfoConsumption, 3)]]);
  row([["LPG", fmt(report.lpgConsumption, 3)], ["Total", totalCons(report)], [""], [""]]);

  section("ROB AT NOON (MT)");
  row([["HFO", fmt(report.hfoRob, 3)], ["LSMGO", fmt(report.lsmgoRob, 3)], ["MGO", fmt(report.mgoRob, 3)], ["VLSFO", fmt(report.vlsfoRob, 3)]]);

  section("MACHINERY");
  row([["ME Load (%MCR)", fmt(report.meLoad, 1)], ["ME RPM", fmt(report.meRpm, 0)], [""], [""]]);

  section("EMISSIONS");
  row([["CO₂ Total (t)", fmt(report.co2Total, 2)], ["EEOI", fmt(report.eeoi, 4)], ["CII Rating", str(report.ciiRating)], [""]]);

  section("CARGO & REMARKS");
  row([["Draft Fwd (m)", fmt(report.draftForward, 2)], ["Draft Aft (m)", fmt(report.draftAft, 2)], ["Cargo (MT)", fmt(report.cargoQuantity, 0)], [""]]);

  if (report.generalRemarks) {
    doc.setTextColor(...gray);
    doc.setFontSize(7.5);
    doc.text("Remarks:", col1, y);
    y += 4;
    doc.setTextColor(30, 30, 30);
    const lines = doc.splitTextToSize(report.generalRemarks, 182);
    doc.text(lines, col1, y);
    y += lines.length * 4.5 + 4;
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Submitted by: ${str(report.submittedBy)} | Generated: ${new Date().toISOString().slice(0, 16)} UTC`,
    14,
    290,
  );

  doc.save(`noon-report-${report.reportDate}-${report.id}.pdf`);
}

function exportHistoryToExcel(reports: NoonReport[], vesselName: string) {
  const rows = reports.map((r) => ({
    Date: r.reportDate,
    Time: r.reportTime ?? "",
    Status: r.status,
    Voyage: r.voyageNo ?? "",
    From: r.portFrom ?? "",
    To: r.portTo ?? "",
    "Speed (kts)": r.speed ? Number(r.speed).toFixed(1) : "",
    "Distance (NM)": r.distanceSailed ? Number(r.distanceSailed).toFixed(0) : "",
    "HFO Cons (MT)": r.hfoConsumption ? Number(r.hfoConsumption).toFixed(3) : "",
    "LSMGO Cons (MT)": r.lsmgoConsumption ? Number(r.lsmgoConsumption).toFixed(3) : "",
    "MGO Cons (MT)": r.mgoConsumption ? Number(r.mgoConsumption).toFixed(3) : "",
    "VLSFO Cons (MT)": r.vlsfoConsumption ? Number(r.vlsfoConsumption).toFixed(3) : "",
    "Total Cons (MT)": totalCons(r),
    "HFO ROB (MT)": r.hfoRob ? Number(r.hfoRob).toFixed(3) : "",
    "LSMGO ROB (MT)": r.lsmgoRob ? Number(r.lsmgoRob).toFixed(3) : "",
    "MGO ROB (MT)": r.mgoRob ? Number(r.mgoRob).toFixed(3) : "",
    "VLSFO ROB (MT)": r.vlsfoRob ? Number(r.vlsfoRob).toFixed(3) : "",
    "CO₂ Total (t)": r.co2Total ? Number(r.co2Total).toFixed(2) : "",
    EEOI: r.eeoi ? Number(r.eeoi).toFixed(4) : "",
    "CII Rating": r.ciiRating ?? "",
    Condition: r.condition ?? "",
    "Cargo (MT)": r.cargoQuantity ? Number(r.cargoQuantity).toFixed(0) : "",
    "ME Load (%MCR)": r.meLoad ? Number(r.meLoad).toFixed(1) : "",
    "Wind Dir": r.windDirection ?? "",
    "Wind Force (Bft)": r.windForce ?? "",
    Visibility: r.visibility ?? "",
    Remarks: r.generalRemarks ?? "",
    "Submitted By": r.submittedBy ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Noon Reports");
  XLSX.writeFile(wb, `noon-reports-${vesselName.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportHistoryToPdf(reports: NoonReport[], vesselName: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const blue = [30, 58, 95] as [number, number, number];

  doc.setFillColor(...blue);
  doc.rect(0, 0, 297, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Noon Report History — ${vesselName}`, 14, 10);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toISOString().slice(0, 16)} UTC`, 14, 15);

  autoTable(doc, {
    startY: 20,
    head: [["Date", "Voyage", "Route", "Speed\n(kts)", "Dist\n(NM)", "HFO\n(MT)", "LSMGO\n(MT)", "MGO\n(MT)", "Total Cons\n(MT)", "HFO ROB\n(MT)", "CO₂\n(t)", "CII", "Status"]],
    body: reports.map((r) => [
      r.reportDate,
      r.voyageNo ?? "—",
      `${r.portFrom ?? ""}→${r.portTo ?? ""}`,
      r.speed ? Number(r.speed).toFixed(1) : "—",
      r.distanceSailed ? Number(r.distanceSailed).toFixed(0) : "—",
      r.hfoConsumption ? Number(r.hfoConsumption).toFixed(2) : "—",
      r.lsmgoConsumption ? Number(r.lsmgoConsumption).toFixed(2) : "—",
      r.mgoConsumption ? Number(r.mgoConsumption).toFixed(2) : "—",
      totalCons(r),
      r.hfoRob ? Number(r.hfoRob).toFixed(2) : "—",
      r.co2Total ? Number(r.co2Total).toFixed(1) : "—",
      r.ciiRating ?? "—",
      r.status.toUpperCase(),
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: blue, textColor: 255, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    margin: { left: 10, right: 10 },
  });

  doc.save(`noon-reports-history-${vesselName.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Email Dialog ──────────────────────────────────────────────────────────────

interface EmailDialogProps {
  report: NoonReport;
  vesselName: string;
  smtpConfigured: boolean;
  onClose: () => void;
}

function EmailDialog({ report, vesselName, smtpConfigured, onClose }: EmailDialogProps) {
  const { toast } = useToast();
  const [to, setTo] = useState(process.env.NR_EMAIL_TO_DEFAULT ?? "");
  const [cc, setCc] = useState("");

  const emailMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/technical/api/nr-reports/${report.id}/email`, { to, cc, vesselName }),
    onSuccess: (data: { success?: boolean; message?: string; previewUrl?: string }) => {
      toast({
        title: "Email sent",
        description: data?.message ?? `Report dispatched to ${to}`,
      });
      if (data?.previewUrl) {
        window.open(data.previewUrl, "_blank");
      }
      onClose();
    },
    onError: (err: any) => {
      toast({
        title: "Email failed",
        description: err?.message ?? "Could not send email. Check SMTP settings.",
        variant: "destructive",
      });
    },
  });

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-600" />
          Email Noon Report
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
          <p className="font-medium">{vesselName} — {report.reportDate}</p>
          <p className="text-xs mt-0.5">Voyage: {report.voyageNo ?? "—"} | {report.portFrom ?? "—"} → {report.portTo ?? "—"}</p>
        </div>

        {!smtpConfigured && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2">
            <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-700">
              SMTP is not configured. Set <code className="bg-amber-100 px-1 rounded text-xs">NR_SMTP_HOST</code>,{" "}
              <code className="bg-amber-100 px-1 rounded text-xs">NR_SMTP_USER</code>, and{" "}
              <code className="bg-amber-100 px-1 rounded text-xs">NR_SMTP_PASS</code> environment variables to enable email dispatch.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email-to">To <span className="text-red-500">*</span></Label>
          <Input
            id="email-to"
            type="email"
            placeholder="office@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            data-testid="input-email-to"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email-cc">CC (optional)</Label>
          <Input
            id="email-cc"
            type="email"
            placeholder="superintendent@example.com"
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            data-testid="input-email-cc"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} data-testid="btn-email-cancel">
          Cancel
        </Button>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => emailMutation.mutate()}
          disabled={!to || emailMutation.isPending}
          data-testid="btn-email-send"
        >
          {emailMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Sending…</>
          ) : (
            <><Mail className="h-4 w-4 mr-1" /> Send Report</>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ReportsExport() {
  const { vesselId, vessels } = useVessel();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  type StatusFilter = "all" | "submitted" | "draft";
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [selectedReport, setSelectedReport] = useState<NoonReport | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  const vesselName = vessels?.find((v) => v.id === vesselId)?.name
    ?? vesselId ?? "Unknown Vessel";

  const { data: reports = [], isLoading } = useQuery<NoonReport[]>({
    queryKey: ["/technical/api/nr-reports", vesselId],
    queryFn: () =>
      fetch(`/technical/api/nr-reports?vesselId=${vesselId}`).then(r => r.json()),
    enabled: !!vesselId,
    refetchOnWindowFocus: false,
  });

  const { data: smtpStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/technical/api/nr-smtp-status"],
    queryFn: () => fetch("/technical/api/nr-smtp-status").then(r => r.json()),
    refetchOnWindowFocus: false,
  });

  const filtered = reports.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      r.reportDate?.toLowerCase().includes(q) ||
      (r.voyageNo ?? "").toLowerCase().includes(q) ||
      (r.portFrom ?? "").toLowerCase().includes(q) ||
      (r.portTo ?? "").toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const submitted = reports.filter(r => r.status === "submitted");

  function handleExportPdf(report: NoonReport) {
    try {
      exportSingleReportToPdf(report, vesselName);
      toast({ title: "PDF downloaded", description: `noon-report-${report.reportDate}.pdf` });
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  }

  function handleExportAllPdf() {
    if (filtered.length === 0) {
      toast({ title: "No reports to export", variant: "destructive" });
      return;
    }
    try {
      exportHistoryToPdf(filtered, vesselName);
      toast({ title: "PDF downloaded", description: `${filtered.length} reports exported` });
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  }

  function handleExportExcel() {
    if (filtered.length === 0) {
      toast({ title: "No reports to export", variant: "destructive" });
      return;
    }
    try {
      exportHistoryToExcel(filtered, vesselName);
      toast({ title: "Excel downloaded", description: `${filtered.length} reports exported` });
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  }

  function openEmail(report: NoonReport) {
    setSelectedReport(report);
    setEmailOpen(true);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Reports & Export</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Download individual PDF reports, export history to Excel, or dispatch via email
          </p>
        </div>

        {/* Bulk export buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={filtered.length === 0}
            data-testid="btn-export-excel"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5 text-green-600" />
            Export Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAllPdf}
            disabled={filtered.length === 0}
            data-testid="btn-export-pdf-all"
          >
            <FileText className="h-4 w-4 mr-1.5 text-red-600" />
            Export PDF (All)
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {!isLoading && reports.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Reports", value: reports.length, color: "text-gray-700" },
            { label: "Submitted", value: submitted.length, color: "text-green-700" },
            { label: "Drafts", value: reports.length - submitted.length, color: "text-amber-700" },
            {
              label: "SMTP Email",
              value: smtpStatus?.configured ? "Ready" : "Not Set",
              color: smtpStatus?.configured ? "text-green-700" : "text-amber-700",
            },
          ].map((stat) => (
            <Card key={stat.label} className="border border-gray-200 shadow-none">
              <CardContent className="py-3 px-4">
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className={`text-lg font-semibold ${stat.color}`}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* SMTP notice */}
      {smtpStatus && !smtpStatus.configured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Email dispatch is inactive. Configure <strong>NR_SMTP_HOST</strong>, <strong>NR_SMTP_USER</strong>,
            and <strong>NR_SMTP_PASS</strong> environment variables to enable sending noon reports by email.
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search date, voyage, port…"
            className="pl-9 h-9 text-sm"
            data-testid="input-search"
          />
        </div>

        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as StatusFilter)}>
          <SelectTrigger className="h-9 w-36 text-sm" data-testid="select-status-filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>

        {(search || filterStatus !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(""); setFilterStatus("all"); }}
            className="text-gray-500 h-9"
            data-testid="btn-clear-filters"
          >
            Clear filters
          </Button>
        )}

        <span className="ml-auto text-sm text-gray-400">
          {filtered.length} of {reports.length} reports
        </span>
      </div>

      {/* Table */}
      {!vesselId ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-400">
            Select a vessel to view reports.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <FileDown className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No reports match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-gray-200 shadow-none overflow-hidden">
          <CardHeader className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <FileDown className="h-4 w-4 text-blue-600" />
              Report History — {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs font-semibold text-gray-600">Date / Time</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600">Voyage</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600">Route</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 text-right">Speed</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 text-right">Dist (NM)</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 text-right">Total Cons (MT)</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 text-right">HFO ROB (MT)</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 text-center">CII</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className="hover:bg-gray-50" data-testid={`row-export-${r.id}`}>
                    <TableCell className="text-sm font-medium text-gray-800">
                      {r.reportDate}
                      {r.reportTime && <span className="text-xs text-gray-400 ml-1">{r.reportTime}</span>}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{r.voyageNo ?? "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {r.portFrom && r.portTo
                        ? `${r.portFrom} → ${r.portTo}`
                        : r.portFrom ?? r.portTo ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-right text-gray-700">
                      {r.speed ? `${Number(r.speed).toFixed(1)} kts` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-right text-gray-700">
                      {r.distanceSailed ? Number(r.distanceSailed).toFixed(0) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-right text-gray-700 font-medium">
                      {totalCons(r)}
                    </TableCell>
                    <TableCell className="text-sm text-right text-gray-700">
                      {r.hfoRob ? Number(r.hfoRob).toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.ciiRating ? (
                        <Badge className={`text-xs font-bold px-2 py-0 ${ciiColor(r.ciiRating)}`}>
                          {r.ciiRating}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {r.status === "submitted" ? (
                        <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs gap-1" data-testid={`badge-submitted-${r.id}`}>
                          <CheckCircle className="h-3 w-3" /> Submitted
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs gap-1" data-testid={`badge-draft-${r.id}`}>
                          <Clock className="h-3 w-3" /> Draft
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-red-600"
                          onClick={() => handleExportPdf(r)}
                          title="Download PDF"
                          data-testid={`btn-pdf-${r.id}`}
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-blue-600"
                          onClick={() => openEmail(r)}
                          title="Send by email"
                          data-testid={`btn-email-${r.id}`}
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Email Dialog */}
      <Dialog open={emailOpen} onOpenChange={(v) => { if (!v) { setEmailOpen(false); setSelectedReport(null); } }}>
        {selectedReport && (
          <EmailDialog
            report={selectedReport}
            vesselName={vesselName}
            smtpConfigured={smtpStatus?.configured ?? false}
            onClose={() => { setEmailOpen(false); setSelectedReport(null); }}
          />
        )}
      </Dialog>
    </div>
  );
}
