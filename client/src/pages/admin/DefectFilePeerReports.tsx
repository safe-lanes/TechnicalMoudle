import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, CircleHelp, RefreshCw, ShieldCheck } from "lucide-react";
import { defectFileHeaders } from "@/pages/defects/DefectAttachmentDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PeerReport {
  vesselUuid: string;
  vesselName: string;
  instanceId: string;
  softwareVersion: string;
  capabilities: string[];
  migration191: boolean | null;
  receivedAt: string | null;
  expiresAt: string | null;
  state: "ready" | "unknown" | "stale" | "offline" | "lost";
  ready: boolean;
  reason: string;
  pending: number;
  failed: number;
  held: number;
}

interface FilePeerReportsResponse {
  readOnly: boolean;
  protocolImplemented: boolean;
  local: {
    instanceId: string;
    softwareVersion: string;
    migration191: boolean;
    capability: boolean;
    backend: string;
  };
  reports: PeerReport[];
}

interface Props {
  currentUser: { userUuid?: string | null } | null;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Not reported";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function stateBadge(state: PeerReport["state"]) {
  switch (state) {
    case "ready":
      return <Badge className="border-green-200 bg-green-100 text-green-800 hover:bg-green-100">Reported: ready</Badge>;
    case "stale":
      return <Badge className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100">Reported: stale</Badge>;
    case "offline":
      return <Badge variant="secondary">Reported: offline</Badge>;
    case "lost":
      return <Badge variant="destructive">Reported: lost</Badge>;
    default:
      return <Badge variant="outline">Reported: unknown</Badge>;
  }
}

function booleanLabel(value: boolean | null): string {
  if (value === null) return "Not reported";
  return value ? "Yes" : "No";
}

export default function DefectFilePeerReports({ currentUser }: Props) {
  const reportsQuery = useQuery<FilePeerReportsResponse>({
    queryKey: ["/technical/api/defects/file-peer-reports", currentUser?.userUuid ?? null],
    queryFn: async () => {
      const response = await fetch("/technical/api/defects/file-peer-reports", {
        headers: defectFileHeaders(currentUser ?? undefined),
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Could not load file compatibility status (${response.status}).`);
      }
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  return (
    <Card data-testid="defect-file-peer-reports">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-slate-600" />
              Defect file compatibility
            </CardTitle>
            <CardDescription className="mt-1">
              Read-only compatibility reports for defect file exchange. A report describes its
              reported state and does not indicate a live connection.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void reportsQuery.refetch()}
            disabled={reportsQuery.isFetching}
            aria-label="Refresh defect file compatibility reports"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${reportsQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {reportsQuery.isPending ? (
          <div className="space-y-3" aria-label="Loading defect file compatibility reports" aria-busy="true">
            <div className="h-16 animate-pulse rounded-md bg-muted/70" />
            <div className="h-24 animate-pulse rounded-md bg-muted/70" />
          </div>
        ) : reportsQuery.isError ? (
          <div className="flex flex-col items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{reportsQuery.error instanceof Error ? reportsQuery.error.message : "Compatibility reports are unavailable."}</span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void reportsQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : reportsQuery.data ? (
          <>
            <section aria-labelledby="local-file-capability-heading" className="rounded-md border bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-slate-600" />
                <h3 id="local-file-capability-heading" className="text-sm font-semibold">This instance</h3>
                <Badge variant={reportsQuery.data.readOnly ? "outline" : "destructive"}>
                  {reportsQuery.data.readOnly ? "Read only" : "Read-only mode unavailable"}
                </Badge>
                <Badge variant={reportsQuery.data.protocolImplemented ? "secondary" : "outline"}>
                  Protocol {reportsQuery.data.protocolImplemented ? "implemented" : "not implemented"}
                </Badge>
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div><dt className="text-muted-foreground">Instance ID</dt><dd className="break-all font-medium">{reportsQuery.data.local.instanceId || "Not reported"}</dd></div>
                <div><dt className="text-muted-foreground">Software version</dt><dd className="font-medium">{reportsQuery.data.local.softwareVersion || "Not reported"}</dd></div>
                <div><dt className="text-muted-foreground">Migration 191</dt><dd className="font-medium">{booleanLabel(reportsQuery.data.local.migration191)}</dd></div>
                <div><dt className="text-muted-foreground">File capability</dt><dd className="font-medium">{booleanLabel(reportsQuery.data.local.capability)}</dd></div>
                <div><dt className="text-muted-foreground">Backend</dt><dd className="break-words font-medium">{reportsQuery.data.local.backend || "Not reported"}</dd></div>
              </dl>
            </section>

            {reportsQuery.data.reports.length === 0 ? (
              <div className="rounded-md border border-dashed px-4 py-8 text-center" role="status">
                <CircleHelp className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                <p className="font-medium">No vessel reports available</p>
                <p className="mt-1 text-sm text-muted-foreground">There are no vessels in this response to report on.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Vessel reports <span className="font-normal text-muted-foreground">({reportsQuery.data.reports.length})</span></h3>
                {reportsQuery.data.reports.map((report, index) => (
                  <article
                    key={`${report.vesselUuid}-${report.instanceId}-${index}`}
                    className="rounded-md border p-4"
                    aria-label={`Compatibility report for ${report.vesselName || report.vesselUuid}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="break-words font-semibold">{report.vesselName || "Unnamed vessel"}</h4>
                        <p className="mt-1 break-all text-xs text-muted-foreground">Vessel UUID: {report.vesselUuid || "Not reported"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {stateBadge(report.state)}
                        <Badge variant={report.ready ? "secondary" : "outline"}>{report.ready ? "Ready flag: yes" : "Ready flag: no"}</Badge>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      <div><dt className="text-muted-foreground">Instance ID</dt><dd className="break-all font-medium">{report.instanceId || "Not reported"}</dd></div>
                      <div><dt className="text-muted-foreground">Software version</dt><dd className="font-medium">{report.softwareVersion || "Not reported"}</dd></div>
                      <div><dt className="text-muted-foreground">Migration 191</dt><dd className="font-medium">{booleanLabel(report.migration191)}</dd></div>
                      <div><dt className="text-muted-foreground">Capabilities</dt><dd className="break-words font-medium">{report.capabilities.length ? report.capabilities.join(", ") : "None reported"}</dd></div>
                      <div><dt className="text-muted-foreground">Report received</dt><dd className="font-medium">{formatTimestamp(report.receivedAt)}</dd></div>
                      <div><dt className="text-muted-foreground">Report expires</dt><dd className="font-medium">{formatTimestamp(report.expiresAt)}</dd></div>
                      <div><dt className="text-muted-foreground">Pending / failed / held</dt><dd className="font-mono font-medium">{report.pending} / {report.failed} / {report.held}</dd></div>
                      <div className="sm:col-span-2 lg:col-span-3"><dt className="text-muted-foreground">Reported reason</dt><dd className="break-words font-medium">{report.reason || "No reason reported"}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
