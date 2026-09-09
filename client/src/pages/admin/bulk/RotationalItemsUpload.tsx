import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, CheckCircle, AlertTriangle, AlertCircle, FileSpreadsheet, Stamp } from "lucide-react";
import ImportProgressOverlay, { useImportStream, type ImportProgressData, type ImportCompleteData } from "@/components/admin/ImportProgressOverlay";

// Rotation Item Master bulk import (Task #366) — strict master-first workflow:
// masters are imported here FIRST, then component imports can reference the stamps.
const FIELD_MAPPINGS = [
  { field: "Stamp No.", required: true, description: "Unique stamp number of the physical item (e.g., LINER-00005). Must not already exist for the vessel." },
  { field: "Stamp Name", required: false, description: "Descriptive part name (e.g., ME Cylinder Liner)." },
  { field: "Starting RH", required: false, description: "Accumulated running hours of the item at import. Defaults to 0." },
  { field: "Date", required: false, description: "RH reading date in DD-MM-YYYY (when the Starting RH was observed). Cannot be in the future." },
  { field: "Status", required: false, description: "Spare or In Store. Defaults to Spare. \"Installed\" is set by fitting the stamp to a component." },
];

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export default function RotationalItemsUpload({ vesselId }: { vesselId: string }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [sseOverlayVisible, setSseOverlayVisible] = useState(false);
  const [sseProgress, setSseProgress] = useState<ImportProgressData | null>(null);
  const [sseComplete, setSseComplete] = useState<ImportCompleteData | null>(null);
  const [sseError, setSseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { consumeStream } = useImportStream();

  const handleCloseOverlay = useCallback(() => {
    setSseOverlayVisible(false);
    setSseProgress(null);
    setSseComplete(null);
    setSseError(null);
  }, []);

  const acceptFile = (file: File | undefined) => {
    if (!file) return;
    const validTypes = [".csv", ".xls", ".xlsx"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validTypes.includes(ext)) {
      toast({ title: "Invalid File", description: "Please upload a .xlsx, .xls, or .csv file", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    setImportResult(null);
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch("/technical/api/bulk/rotational-items/template");
      if (!response.ok) throw new Error("Failed to download template");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Rotation_Items_Import_Template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Template Downloaded", description: "Rotation items import template has been downloaded." });
    } catch {
      toast({ title: "Download Failed", description: "Failed to download the template file.", variant: "destructive" });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (!vesselId) {
      toast({ title: "No Vessel Selected", description: "Please select a vessel before importing rotation items.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    setImportResult(null);
    setSseProgress(null);
    setSseComplete(null);
    setSseError(null);
    setSseOverlayVisible(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      await consumeStream(
        `/technical/api/bulk/rotational-items/import-stream?vesselId=${encodeURIComponent(vesselId)}`,
        { method: "POST", body: formData },
        {
          onProgress: (data) => setSseProgress(data),
          onComplete: (result) => {
            setSseComplete(result);
            const r: ImportResult = {
              created: result.created || 0,
              updated: result.updated || 0,
              skipped: result.skipped || 0,
              errors: (result.errors as string[]) || [],
            };
            setImportResult(r);
            if (r.errors.length === 0) {
              toast({ title: "Import Successful", description: `${r.created} rotation item(s) created.` });
            } else {
              toast({
                title: "Import Completed with Issues",
                description: `${r.created} created. ${r.errors.length} error(s).`,
                variant: "destructive",
              });
            }
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            setIsUploading(false);
          },
          onError: (message) => {
            setSseError(message);
            toast({ title: "Import Failed", description: message || "An error occurred during import.", variant: "destructive" });
            setIsUploading(false);
          },
        }
      );
    } catch (error: any) {
      setSseError(error.message || "An error occurred during import.");
      toast({ title: "Import Failed", description: error.message || "An error occurred during import.", variant: "destructive" });
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Stamp className="h-5 w-5 text-indigo-600" />
            <h1 className="text-2xl font-bold" data-testid="rotation-items-upload-header">Rotation Item Import</h1>
          </div>
          <p className="text-gray-600 mt-1" data-testid="rotation-items-upload-description">
            Import rotational item masters (stamps) via CSV or Excel — import masters before referencing them in component imports
          </p>
        </div>
        <Button onClick={handleDownloadTemplate} variant="outline" data-testid="button-download-rotation-items-template">
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList>
          <TabsTrigger value="upload" data-testid="tab-rotation-items-upload">Upload</TabsTrigger>
          <TabsTrigger value="mapping" data-testid="tab-rotation-items-mapping">Field Mapping Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>File Upload</CardTitle>
              <CardDescription>Upload CSV, XLS, or XLSX files containing rotation item master data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  selectedFile ? "border-indigo-400 bg-indigo-50" : "border-gray-300 hover:border-gray-400"
                }`}
                onDrop={(e) => { e.preventDefault(); acceptFile(e.dataTransfer.files[0]); }}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                data-testid="rotation-items-drop-zone"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => acceptFile(e.target.files?.[0])}
                  accept=".csv,.xls,.xlsx"
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className="h-12 w-12 text-indigo-500" />
                    <p className="font-medium text-indigo-700">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-12 w-12 text-gray-400" />
                    <p className="font-medium text-gray-600">Drop your file here or click to browse</p>
                    <p className="text-sm text-gray-400">Supports .xlsx, .xls, and .csv files</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading || !vesselId}
                  data-testid="button-upload-rotation-items"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? "Importing..." : "Import Rotation Items"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {importResult && (
            <Card data-testid="rotation-items-import-result">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {importResult.errors.length === 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}
                  Import Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {importResult.created} Created
                  </Badge>
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                    {importResult.skipped} Skipped
                  </Badge>
                  {importResult.errors.length > 0 && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      {importResult.errors.length} Error(s)
                    </Badge>
                  )}
                </div>

                {importResult.errors.length > 0 && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Errors:
                    </p>
                    <ul className="text-sm text-red-600 space-y-1">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mapping">
          <Card>
            <CardHeader>
              <CardTitle>Field Mapping Guide</CardTitle>
              <CardDescription>Required and optional fields for rotation item import</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field Name</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FIELD_MAPPINGS.map((mapping) => (
                    <TableRow key={mapping.field}>
                      <TableCell className="font-medium">{mapping.field}</TableCell>
                      <TableCell>
                        {mapping.required ? (
                          <Badge variant="destructive">Required</Badge>
                        ) : (
                          <Badge variant="secondary">Optional</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600">{mapping.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-700 mb-2">Notes:</p>
                <ul className="text-sm text-blue-600 space-y-1 list-disc list-inside">
                  <li>Import rotation item masters BEFORE importing components that reference their stamps</li>
                  <li>Stamp No. must be unique per vessel — rows for stamps that already exist are rejected</li>
                  <li>Status can only be Spare or In Store; items become Installed when fitted to a component</li>
                  <li>Date is the reading date of the Starting RH, not the entry date</li>
                  <li>The vessel is determined by the vessel selected in the header</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ImportProgressOverlay
        visible={sseOverlayVisible}
        progress={sseProgress}
        complete={sseComplete}
        error={sseError}
        onClose={handleCloseOverlay}
        entityLabel="rotation items"
      />
    </div>
  );
}
