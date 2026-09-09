/**
 * Sync Provisioning Admin Page
 *
 * Allows Offline Admin / Sail Admin to:
 * 1. Select a vessel from dropdown
 * 2. Preview what will be provisioned (manifest with table counts)
 * 3. Generate and download the provisioning bundle as JSON
 * 4. Import a bundle on the ship side
 * 5. Verify provisioning integrity
 *
 * Route: /admin/sync-provisioning
 */

import { useState, useContext, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { VesselContext } from "@/contexts/VesselContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HardDrive,
  Download,
  Upload,
  Eye,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FileJson,
  Ship,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

interface ManifestTable {
  tableName: string;
  rowCount: number;
  category: string;
}

interface Manifest {
  vesselId: string;
  vesselName: string;
  vesselCode: string;
  generatedAt: string;
  generatedBy: string;
  instanceId: string;
  tables: ManifestTable[];
  totalRows: number;
  version: string;
}

interface ImportResult {
  success: boolean;
  tablesImported: number;
  rowsImported: number;
  errors: string[];
}

interface VerifyResult {
  valid: boolean;
  mismatches: { tableName: string; expected: number; actual: number }[];
}

function getCategoryColor(category: string): string {
  if (category.includes("ONE_WAY")) return "text-blue-700 bg-blue-50 border-blue-200";
  if (category.includes("BOTH_EDITABLE")) return "text-amber-700 bg-amber-50 border-amber-200";
  if (category.includes("SHIP_ONLY")) return "text-green-700 bg-green-50 border-green-200";
  if (category.includes("IDENTITY")) return "text-purple-700 bg-purple-50 border-purple-200";
  return "text-gray-700 bg-gray-50 border-gray-200";
}

export default function SyncProvisioning() {
  const { toast } = useToast();
  const { canEdit } = usePermissions();
  const canProvision = canEdit("admin-sync-provisioning");
  const vesselCtx = useContext(VesselContext);
  const vessels = vesselCtx?.vessels ?? [];

  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedVessel = vessels.find((v) => v.id === selectedVesselId);

  // ── Manifest Preview ──
  const manifestQuery = useQuery<Manifest>({
    queryKey: ["/technical/api/sync/provision/manifest", selectedVesselId],
    queryFn: async () => {
      const res = await fetch(`/technical/api/sync/provision/manifest/${selectedVesselId}`);
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: false, // manual trigger only
  });

  const handlePreview = () => {
    if (!selectedVesselId) return;
    manifestQuery.refetch();
  };

  // ── Download Bundle ──
  const handleDownload = async () => {
    if (!selectedVesselId) return;
    setIsDownloading(true);
    setDownloadProgress(10);

    try {
      setDownloadProgress(30);
      const res = await fetch(`/technical/api/sync/provision/download/${selectedVesselId}`);
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);

      setDownloadProgress(70);
      const blob = await res.blob();
      setDownloadProgress(90);

      const disposition = res.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `provision_${selectedVesselId}.json`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadProgress(100);
      toast({
        title: "Bundle Downloaded",
        description: `${filename} (${(blob.size / 1024 / 1024).toFixed(1)} MB)`,
      });
    } catch (err: any) {
      toast({ title: "Download Failed", description: err.message, variant: "destructive" });
    } finally {
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
      }, 1500);
    }
  };

  // ── Import Bundle ──
  const importMutation = useMutation({
    mutationFn: async (bundle: any) => {
      const res = await apiRequest("POST", "/technical/api/sync/provision/import", bundle);
      return res.json();
    },
    onSuccess: (data: ImportResult) => {
      setImportResult(data);
      toast({
        title: data.success ? "Import Successful" : "Import Completed with Errors",
        description: `${data.tablesImported} tables, ${data.rowsImported} rows`,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (err: any) => {
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const bundle = JSON.parse(text);
      if (!bundle?.manifest?.vesselId || !bundle?.data) {
        toast({ title: "Invalid Bundle", description: "File must contain manifest and data.", variant: "destructive" });
        return;
      }
      importMutation.mutate(bundle);
    } catch {
      toast({ title: "Parse Error", description: "Could not parse JSON file.", variant: "destructive" });
    }

    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Verify ──
  const verifyMutation = useMutation({
    mutationFn: async (manifest: Manifest) => {
      const res = await apiRequest("POST", "/technical/api/sync/provision/verify", manifest);
      return res.json();
    },
    onSuccess: (data: VerifyResult) => {
      setVerifyResult(data);
      toast({
        title: data.valid ? "Verification Passed" : "Verification Failed",
        description: data.valid
          ? "All table counts match."
          : `${data.mismatches.length} table(s) have mismatched counts.`,
        variant: data.valid ? "default" : "destructive",
      });
    },
    onError: (err: any) => {
      toast({ title: "Verify Failed", description: err.message, variant: "destructive" });
    },
  });

  const manifest = manifestQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black" data-testid="page-title-sync-provisioning">
            Ship Provisioning
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate and manage vessel data bundles for initial ship server deployment
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <ShieldCheck className="h-3 w-3" />
          Admin Only
        </Badge>
      </div>

      {/* ── Section A: Vessel Selection ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Ship className="h-5 w-5 text-blue-500" />
            Select Vessel
          </CardTitle>
          <CardDescription>Choose a vessel to preview or generate a provisioning bundle</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
              <SelectTrigger className="w-[320px]" data-testid="select-vessel">
                <SelectValue placeholder="Select a vessel..." />
              </SelectTrigger>
              <SelectContent>
                {vessels
                  .filter((v) => v.id !== "all")
                  .map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name || v.code || v.id}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {selectedVessel && (
              <div className="text-sm text-muted-foreground">
                Code: <span className="font-mono">{selectedVessel.code}</span> | UUID:{" "}
                <span className="font-mono text-xs">{selectedVessel.id}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Section B: Manifest Preview ── */}
      {selectedVesselId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5 text-indigo-500" />
                Manifest Preview
              </CardTitle>
              <Button
                onClick={handlePreview}
                disabled={manifestQuery.isFetching}
                variant="outline"
                size="sm"
                data-testid="btn-preview-manifest"
              >
                {manifestQuery.isFetching ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                Preview
              </Button>
            </div>
            <CardDescription>
              See what tables and rows will be included in the provisioning bundle
            </CardDescription>
          </CardHeader>
          {manifest && (
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
                  <div className="text-2xl font-bold text-blue-700">{manifest.tables.length}</div>
                  <div className="text-xs text-blue-600">Tables</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-center">
                  <div className="text-2xl font-bold text-green-700">{manifest.totalRows.toLocaleString()}</div>
                  <div className="text-xs text-green-600">Total Rows</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-center">
                  <div className="text-2xl font-bold text-gray-700">{manifest.vesselName}</div>
                  <div className="text-xs text-gray-600">Vessel</div>
                </div>
              </div>

              <ScrollArea className="h-[400px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Row Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manifest.tables
                      .sort((a, b) => b.rowCount - a.rowCount)
                      .map((t) => (
                        <TableRow key={t.tableName}>
                          <TableCell className="font-mono text-sm">{t.tableName}</TableCell>
                          <TableCell>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full border ${getCategoryColor(t.category)}`}
                            >
                              {t.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {t.rowCount.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Section C: Generate & Download ── */}
      {selectedVesselId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="h-5 w-5 text-green-500" />
              Generate & Download Bundle
            </CardTitle>
            <CardDescription>
              Generate a complete provisioning bundle and download as a JSON file for ship deployment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                className="bg-green-600 hover:bg-green-700"
                data-testid="btn-download-bundle"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {isDownloading ? "Generating..." : "Generate & Download Bundle"}
              </Button>
              {isDownloading && (
                <div className="space-y-1">
                  <Progress value={downloadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {downloadProgress < 30
                      ? "Initiating bundle generation..."
                      : downloadProgress < 70
                        ? "Exporting tables..."
                        : downloadProgress < 90
                          ? "Preparing download..."
                          : "Download complete!"}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Section E: Import Bundle (Ship-side) ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5 text-orange-500" />
            Import Bundle
          </CardTitle>
          <CardDescription>
            Upload a provisioning bundle JSON file to import vessel data (used on ship server)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-import-file"
              />
              {canProvision && (
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importMutation.isPending}
                  data-testid="btn-import-bundle"
                >
                  {importMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileJson className="h-4 w-4 mr-2" />
                  )}
                  {importMutation.isPending ? "Importing..." : "Select & Import Bundle"}
                </Button>
              )}
              {manifest && (
                <Button
                  variant="outline"
                  onClick={() => verifyMutation.mutate(manifest)}
                  disabled={verifyMutation.isPending}
                  data-testid="btn-verify"
                >
                  {verifyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 mr-2" />
                  )}
                  Verify
                </Button>
              )}
            </div>

            {/* Import Results */}
            {importResult && (
              <div
                className={`rounded-lg border p-4 ${importResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {importResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-medium">
                    {importResult.success ? "Import Successful" : "Import Completed with Errors"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tables:</span>{" "}
                    <span className="font-mono">{importResult.tablesImported}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rows:</span>{" "}
                    <span className="font-mono">{importResult.rowsImported.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Errors:</span>{" "}
                    <span className="font-mono">{importResult.errors.length}</span>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <ScrollArea className="mt-3 h-[120px] rounded border bg-white p-2">
                    {importResult.errors.map((e, i) => (
                      <div key={i} className="text-xs text-red-700 font-mono mb-1">
                        {e}
                      </div>
                    ))}
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Verify Results */}
            {verifyResult && (
              <div
                className={`rounded-lg border p-4 ${verifyResult.valid ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {verifyResult.valid ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-medium">
                    {verifyResult.valid ? "All Counts Match" : "Mismatches Found"}
                  </span>
                </div>
                {verifyResult.mismatches.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Table</TableHead>
                        <TableHead className="text-right">Expected</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {verifyResult.mismatches.map((m) => (
                        <TableRow key={m.tableName}>
                          <TableCell className="font-mono text-sm">{m.tableName}</TableCell>
                          <TableCell className="text-right">{m.expected}</TableCell>
                          <TableCell className="text-right text-red-600">{m.actual}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
