import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Download, Upload, CheckCircle, AlertTriangle, AlertCircle, FileWarning, Eye, Info } from "lucide-react";

interface DryRunResult {
  fileToken: string;
  columns: string[];
  summary: {
    ok: number;
    warnings: number;
    errors: number;
  };
  rows: Array<{
    row: number;
    status: 'ok' | 'warning' | 'error';
    errors: string[];
    normalized: Record<string, any>;
  }>;
  errorReportUrl?: string;
}

interface ImportHistory {
  id: string;
  type: string;
  mode: string;
  created: number;
  updated: number;
  skipped: number;
  archived: number;
  startedAt: string;
  status: string;
  userId: string;
}

const FIELD_MAPPINGS = [
  { field: "Fleet Equipment Name", required: false, description: "Fleet reference name" },
  { field: "Vessel Code", required: true, description: "Vessel identifier (e.g., V001)" },
  { field: "Component Code", required: true, description: "Must exist in system" },
  { field: "Component Name", required: false, description: "Auto-filled from component" },
  { field: "Part Code", required: false, description: "Auto-generated PT-XXXXXX if not provided" },
  { field: "Part Name", required: true, description: "Spare part description" },
  { field: "Part Number", required: false, description: "Manufacturer part number" },
  { field: "Unit Of Measurement", required: false, description: "PCS, KG, LTR, etc." },
  { field: "Stocking Number", required: false, description: "Internal stock reference" },
  { field: "Maker", required: false, description: "Manufacturer name" },
  { field: "Maker Code", required: false, description: "Manufacturer code" },
  { field: "Specification", required: false, description: "Technical specifications" },
  { field: "Drawing No", required: false, description: "Drawing reference" },
  { field: "Location", required: false, description: "Storage location" },
  { field: "ROB", required: false, description: "Remaining on board quantity" },
  { field: "Min Stock", required: false, description: "Minimum stock level" },
  { field: "Max Stock", required: false, description: "Maximum stock level" },
  { field: "Unit Cost", required: false, description: "Cost per unit" },
  { field: "Criticality (Yes/No)", required: false, description: "Critical spare flag" },
  { field: "Lead Time", required: false, description: "Procurement lead time" },
  { field: "Supplier", required: false, description: "Supplier name" },
  { field: "Last Order Date", required: false, description: "DD-MMM-YYYY format" },
  { field: "Remarks", required: false, description: "Additional notes" },
];

interface SparesUploadProps {
  vesselId: string;
}

export default function SparesUpload({ vesselId }: SparesUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'add' | 'update' | 'upsert'>('upsert');
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [partialImportDialogOpen, setPartialImportDialogOpen] = useState(false);
  const [undoDialogOpen, setUndoDialogOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [selectedHistoryType, setSelectedHistoryType] = useState<string>('spares');
  const [isUndoing, setIsUndoing] = useState(false);

  const { toast } = useToast();

  // Fetch import history
  const { data: historyData } = useQuery<{items: ImportHistory[], total: number}>({
    queryKey: ['/api/bulk/history'],
    queryFn: async () => {
      const response = await fetch('/api/bulk/history');
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    }
  });

  const sparesHistory = historyData?.items?.filter(h => h.type === 'spares') || [];

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`/api/bulk/template?type=spares&vesselId=${vesselId}`);
      if (!response.ok) throw new Error('Failed to download template');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'spares_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Template Downloaded',
        description: 'Excel template with component codes and all spare fields has been downloaded.'
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download template.',
        variant: 'destructive'
      });
    }
  };

  // Load sheet names from Excel file
  const loadSheets = async (file: File) => {
    setIsLoadingSheets(true);
    setAvailableSheets([]);
    setSelectedSheet('');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/bulk/sheets', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to load sheets');
      }

      const result = await response.json();
      setAvailableSheets(result.sheets || []);
      
      // Auto-select first sheet AND run dry-run
      if (result.sheets && result.sheets.length > 0) {
        setSelectedSheet(result.sheets[0]);
        await handleDryRun(file, result.sheets[0]);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to read file sheets.',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingSheets(false);
    }
  };

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['.csv', '.xls', '.xlsx'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
    
    if (!validTypes.includes(fileExtension)) {
      toast({
        title: 'Invalid File',
        description: 'Please upload a .xlsx, .xls, or .csv file',
        variant: 'destructive'
      });
      return;
    }

    setSelectedFile(file);
    setDryRunResult(null);
    
    // Load sheets if Excel file
    if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      await loadSheets(file);
    } else {
      // CSV files don't have sheets - run dry-run immediately
      await handleDryRun(file, '');
    }
  };

  // Dry run validation
  const handleDryRun = async (file: File, sheetName?: string) => {
    setIsUploading(true);
    setDryRunResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'spares');
    formData.append('mode', importMode);
    formData.append('vesselId', vesselId);
    formData.append('archiveMissing', 'false');
    
    // Add sheet name if provided
    if (sheetName) {
      formData.append('sheetName', sheetName);
    }

    try {
      const response = await fetch('/api/bulk/dry-run', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Validation failed');
      }

      const result = await response.json();
      setDryRunResult(result);

      if (result.summary.errors > 0) {
        toast({
          title: 'Validation Complete',
          description: `Found ${result.summary.errors} error(s). Please fix them before importing.`,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Validation Complete',
          description: 'File is valid and ready to import.'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Validation Failed',
        description: error.message || 'Failed to validate file',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Perform import (all valid rows or partial)
  const handleImport = async (skipErrors: boolean = false) => {
    if (!dryRunResult) return;

    setIsImporting(true);

    // Calculate which row indices to import (1-based)
    const rowIndices = skipErrors
      ? dryRunResult.rows
          .filter(row => row.status === 'ok' || row.status === 'warning')
          .map(row => row.row)
      : undefined;

    try {
      const response = await fetch('/api/bulk/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileToken: dryRunResult.fileToken,
          type: 'spares',
          mode: importMode,
          vesselId: vesselId,
          archiveMissing: false,
          rowIndices
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const result = await response.json();

      toast({
        title: 'Import Successful',
        description: `Created: ${result.created}, Updated: ${result.updated}, Skipped: ${result.skipped}`
      });

      // Clear state and refresh
      setSelectedFile(null);
      setDryRunResult(null);
      setPartialImportDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/bulk/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/spares', vesselId] });
    } catch (error: any) {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import data',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Get error rows for dialog display
  const getErrorRows = () => {
    if (!dryRunResult) return [];
    return dryRunResult.rows.filter(row => row.status === 'error');
  };

  // Get valid rows count (ok + warning, excluding only errors)
  const getValidRowsCount = () => {
    if (!dryRunResult) return 0;
    return dryRunResult.rows.filter(row => row.status === 'ok' || row.status === 'warning').length;
  };

  // Handle undo click
  const handleUndoClick = (historyId: string, type: string) => {
    setSelectedHistoryId(historyId);
    setSelectedHistoryType(type);
    setUndoDialogOpen(true);
  };

  // Handle undo
  const handleUndo = async () => {
    if (!selectedHistoryId) return;
    
    setIsUndoing(true);
    
    try {
      const response = await fetch(`/api/bulk/undo/${selectedHistoryId}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to undo import');
      }
      
      const result = await response.json();
      
      toast({
        title: 'Import Undone Successfully',
        description: `Deleted: ${result.deleted}, Restored: ${result.restored}, Unarchived: ${result.unarchived}`
      });
      
      // Refresh history and data
      queryClient.invalidateQueries({ queryKey: ['/api/bulk/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/spares', vesselId] });
      
      setUndoDialogOpen(false);
      setSelectedHistoryId(null);
      
    } catch (error: any) {
      toast({
        title: 'Undo Failed',
        description: error.message || 'Failed to undo import',
        variant: 'destructive'
      });
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Spares Bulk Upload</h1>
          <p className="text-gray-600 mt-2">Upload spares via Excel. Template includes Component Codes + Names. Part Codes auto-generated as PT-XXXXXX.</p>
        </div>
        <Button onClick={handleDownloadTemplate} data-testid="button-download-template">
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="mapping">Field Mapping</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Import Mode</CardTitle>
                <CardDescription>Choose how to handle existing spares</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={importMode} onValueChange={(value) => setImportMode(value as any)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="add" id="add" />
                    <Label htmlFor="add" className="font-normal">
                      <div className="font-medium">Add</div>
                      <div className="text-sm text-gray-500">Only create new spares, skip duplicates</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="update" id="update" />
                    <Label htmlFor="update" className="font-normal">
                      <div className="font-medium">Update</div>
                      <div className="text-sm text-gray-500">Only update existing spares, skip new ones</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="upsert" id="upsert" />
                    <Label htmlFor="upsert" className="font-normal">
                      <div className="font-medium">Upsert (Recommended)</div>
                      <div className="text-sm text-gray-500">Create new and update existing spares</div>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upload File</CardTitle>
                <CardDescription>Select your Excel or CSV file containing spare parts data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="file">File</Label>
                  <div className="flex gap-2">
                    <Input
                      id="file"
                      type="file"
                      accept=".csv,.xls,.xlsx"
                      onChange={handleFileSelect}
                      disabled={isUploading || isLoadingSheets}
                      data-testid="input-file-upload"
                    />
                    <Button
                      variant="outline"
                      onClick={() => selectedFile && handleDryRun(selectedFile, selectedSheet)}
                      disabled={!selectedFile || isUploading}
                      data-testid="button-validate"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {isUploading ? 'Validating...' : 'Validate'}
                    </Button>
                  </div>
                  {selectedFile && (
                    <p className="text-sm text-gray-500">Selected: {selectedFile.name}</p>
                  )}
                </div>

                {availableSheets.length > 0 && (
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="sheet">Select Sheet</Label>
                    <select
                      id="sheet"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={selectedSheet}
                      onChange={(e) => {
                        setSelectedSheet(e.target.value);
                        if (selectedFile) {
                          handleDryRun(selectedFile, e.target.value);
                        }
                      }}
                    >
                      {availableSheets.map((sheet) => (
                        <option key={sheet} value={sheet}>
                          {sheet}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {dryRunResult && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Validation Results</h3>
                      {dryRunResult.summary.errors > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setErrorDialogOpen(true)}
                          data-testid="button-view-errors"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View All Errors
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex gap-4 flex-wrap">
                      <Badge variant="outline" className="px-3 py-1">
                        <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                        Valid: {dryRunResult.summary.ok}
                      </Badge>
                      <Badge variant="outline" className="px-3 py-1">
                        <AlertTriangle className="h-4 w-4 mr-1 text-yellow-600" />
                        Warnings: {dryRunResult.summary.warnings}
                      </Badge>
                      <Badge variant="outline" className="px-3 py-1">
                        <AlertCircle className="h-4 w-4 mr-1 text-red-600" />
                        Errors: {dryRunResult.summary.errors}
                      </Badge>
                      <Badge variant="outline" className="px-3 py-1">
                        Total Rows: {dryRunResult.rows.length}
                      </Badge>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Row</TableHead>
                            <TableHead className="w-24">Status</TableHead>
                            <TableHead>Part Code</TableHead>
                            <TableHead>Part Name</TableHead>
                            <TableHead>Component</TableHead>
                            <TableHead>Errors</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dryRunResult.rows.slice(0, 20).map((row) => (
                            <TableRow key={row.row}>
                              <TableCell>{row.row}</TableCell>
                              <TableCell>
                                <Badge variant={row.status === 'ok' ? 'default' : row.status === 'warning' ? 'secondary' : 'destructive'}>
                                  {row.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{row.normalized['Part Code']}</TableCell>
                              <TableCell>{row.normalized['Part Name']}</TableCell>
                              <TableCell>{row.normalized['Component Code']}</TableCell>
                              <TableCell>
                                {row.errors.length > 0 && (
                                  <div className="text-sm text-red-600">
                                    {row.errors.join(', ')}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {dryRunResult.summary.errors === 0 ? (
                      <Button 
                        onClick={() => handleImport(false)} 
                        disabled={isImporting}
                        className="w-full"
                        data-testid="button-import"
                      >
                        {isImporting ? 'Importing...' : `Import ${dryRunResult.summary.ok} Spares`}
                      </Button>
                    ) : (
                      <div className="flex gap-3">
                        <Button 
                          onClick={() => setPartialImportDialogOpen(true)}
                          disabled={isImporting || getValidRowsCount() === 0}
                          className="flex-1"
                          data-testid="button-import-valid"
                        >
                          <FileWarning className="h-4 w-4 mr-2" />
                          {isImporting ? 'Importing...' : `Ignore Errors & Import ${getValidRowsCount()} Valid Rows`}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mapping">
          <Card>
            <CardHeader>
              <CardTitle>Field Mapping Guide</CardTitle>
              <CardDescription>
                Required and optional fields for spare parts import
              </CardDescription>
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
                  {FIELD_MAPPINGS.map((field) => (
                    <TableRow key={field.field}>
                      <TableCell className="font-medium">{field.field}</TableCell>
                      <TableCell>
                        {field.required ? (
                          <Badge variant="destructive">Required</Badge>
                        ) : (
                          <Badge variant="secondary">Optional</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{field.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex gap-2">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm space-y-2">
                    <p className="font-medium text-blue-900 dark:text-blue-100">Important Notes:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                      <li><strong>Part Code:</strong> Auto-generated as PT-XXXXXX if not provided</li>
                      <li><strong>Component Code:</strong> Must exist in the system - validation will fail for invalid codes</li>
                      <li><strong>Component Name:</strong> Auto-filled from component if left blank</li>
                      <li><strong>Template:</strong> Download includes all valid Component Codes + Names from the system</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>View past spare parts imports and undo if needed</CardDescription>
            </CardHeader>
            <CardContent>
              {sparesHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No import history yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Skipped</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sparesHistory.map((history) => (
                      <TableRow key={history.id}>
                        <TableCell>{new Date(history.startedAt).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{history.mode}</Badge>
                        </TableCell>
                        <TableCell>{history.created}</TableCell>
                        <TableCell>{history.updated}</TableCell>
                        <TableCell>{history.skipped}</TableCell>
                        <TableCell>
                          <Badge variant={history.status === 'completed' ? 'default' : 'secondary'}>
                            {history.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUndoClick(history.id, history.type)}
                          >
                            Undo
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Error Dialog */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Validation Errors</DialogTitle>
            <DialogDescription>
              Fix these errors in your file before importing
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4">
              {getErrorRows().map((row) => (
                <div key={row.row} className="border rounded-lg p-4">
                  <div className="font-medium mb-2">
                    Row {row.row}: {row.normalized['Part Name'] || 'Unknown'}
                  </div>
                  <div className="text-sm space-y-1">
                    {row.errors.map((error, idx) => (
                      <div key={idx} className="text-red-600">• {error}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Partial Import Confirmation Dialog */}
      <AlertDialog open={partialImportDialogOpen} onOpenChange={setPartialImportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Valid Rows Only?</AlertDialogTitle>
            <AlertDialogDescription>
              This will import {getValidRowsCount()} valid rows and skip {getErrorRows().length} rows with errors.
              The skipped rows will not be imported.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleImport(true)}>
              Import Valid Rows
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Undo Confirmation Dialog */}
      <AlertDialog open={undoDialogOpen} onOpenChange={setUndoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo Import?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reverse the import by deleting created records and restoring any updated records to their previous state.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUndoing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUndo} disabled={isUndoing}>
              {isUndoing ? 'Undoing...' : 'Undo Import'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
