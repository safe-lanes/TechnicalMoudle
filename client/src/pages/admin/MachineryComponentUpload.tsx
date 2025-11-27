import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Upload, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  Undo2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { queryClient } from "@/lib/queryClient";
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
  date: string;
  status: string;
  userId: string;
}

const FIELD_MAPPINGS = [
  { field: "Component Code", required: true, description: "Unique identifier (e.g., 1.1.1)" },
  { field: "Component Name", required: true, description: "Component name" },
  { field: "Component Category", required: true, description: "One of the 8 main categories" },
  { field: "Vessel Code", required: true, description: "Vessel identification code (critical for tracking components)" },
  { field: "Parent Component Code", required: false, description: "Parent component code" },
  { field: "Maker", required: false, description: "Manufacturer name" },
  { field: "Model", required: false, description: "Model number" },
  { field: "Serial No", required: false, description: "Serial number" },
  { field: "Location", required: false, description: "Physical location" },
  { field: "Critical (Yes/No)", required: false, description: "Yes or No" },
  { field: "Condition Based (Yes/No)", required: false, description: "Yes or No" },
  { field: "Running Hours", required: false, description: "Numeric value" },
  { field: "Commissioned Date", required: false, description: "Date component was commissioned" },
  { field: "Class Item", required: false, description: "Yes or No" },
];

interface MachineryComponentUploadProps {
  vesselId: string;
}

export default function AdminMachineryUpload({ vesselId }: MachineryComponentUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'add' | 'update' | 'upsert'>('upsert');
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [undoDialogOpen, setUndoDialogOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [selectedHistoryType, setSelectedHistoryType] = useState<string>('');
  const [isUndoing, setIsUndoing] = useState(false);
  const { toast } = useToast();

  // Fetch import history
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['/api/bulk/history', 'components'],
    queryFn: async () => {
      const response = await fetch('/api/bulk/history?type=components&limit=50');
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    }
  });

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`/api/bulk/template?type=components&vesselId=${vesselId}`);
      if (!response.ok) throw new Error('Failed to download template');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'components_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Template Downloaded',
        description: 'Excel template has been downloaded.'
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
      
      // Auto-select first sheet
      if (result.sheets && result.sheets.length > 0) {
        setSelectedSheet(result.sheets[0]);
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
    formData.append('type', 'components');
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

  // Perform import
  const handleImport = async () => {
    if (!dryRunResult) return;

    setIsImporting(true);

    try {
      // Only pass rowIndices if there are errors (partial import)
      // If all rows are valid, omit rowIndices to use full-import validation
      const hasErrors = dryRunResult.summary.errors > 0;
      const validRowIndices = hasErrors 
        ? dryRunResult.rows
            .filter(row => row.status === 'ok')
            .map(row => row.row)
        : undefined;

      const response = await fetch('/api/bulk/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileToken: dryRunResult.fileToken,
          type: 'components',
          mode: importMode,
          archiveMissing: false,
          vesselId: vesselId,
          ...(validRowIndices && { rowIndices: validRowIndices })
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
      queryClient.invalidateQueries({ queryKey: ['/api/bulk/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/components', vesselId] });
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
      
      // For components: refresh components list
      if (selectedHistoryType === 'components') {
        queryClient.invalidateQueries({ queryKey: ['/api/components'] });
      }
      // For jobs: refresh jobs list
      if (selectedHistoryType === 'jobs') {
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      }
      
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
          <h1 className="text-3xl font-bold">Machinery Component Upload</h1>
          <p className="text-gray-600 mt-2">Bulk import machinery components via CSV or Excel files</p>
        </div>
        <Button variant="outline" onClick={handleDownloadTemplate} data-testid="button-download-template">
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="mapping">Field Mapping Guide</TabsTrigger>
          <TabsTrigger value="history">Upload History</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>File Upload</CardTitle>
                <CardDescription>
                  Upload CSV, XLS, or XLSX files containing machinery component data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label>Import Mode</Label>
                    <Select value={importMode} onValueChange={(v: any) => setImportMode(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="add">Create Only (Skip Existing)</SelectItem>
                        <SelectItem value="update">Update Only (Skip New)</SelectItem>
                        <SelectItem value="upsert">Create & Update (Recommended)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                    disabled={isUploading || isImporting}
                    data-testid="input-file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="h-12 w-12 text-gray-400 mb-3" />
                    <span className="text-sm font-medium text-gray-700">
                      Click to upload or drag and drop
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      CSV, XLS, or XLSX (max 20MB)
                    </span>
                  </label>
                  {selectedFile && (
                    <p className="mt-4 text-sm font-medium" data-testid="text-selected-file">
                      {selectedFile.name}
                    </p>
                  )}
                </div>

                {/* Sheet Selection for Excel files */}
                {availableSheets.length > 0 && selectedFile && (
                  <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="sheet-select" className="text-sm font-medium">
                          Select Sheet to Import
                        </Label>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          This Excel file contains multiple sheets. Choose which one to import.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Select 
                          value={selectedSheet} 
                          onValueChange={setSelectedSheet}
                          disabled={isLoadingSheets || isUploading}
                        >
                          <SelectTrigger id="sheet-select" data-testid="select-sheet">
                            <SelectValue placeholder="Select a sheet" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSheets.map((sheet) => (
                              <SelectItem key={sheet} value={sheet}>
                                {sheet}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Button 
                          onClick={() => selectedFile && handleDryRun(selectedFile, selectedSheet)} 
                          disabled={!selectedSheet || isUploading || isLoadingSheets}
                          className="w-full"
                          data-testid="button-validate-sheet"
                        >
                          {isUploading ? 'Validating...' : 'Validate Selected Sheet'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {isLoadingSheets && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600 dark:text-gray-400">Reading file sheets...</p>
                  </div>
                )}

                {isUploading && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Validating file...</p>
                  </div>
                )}

                {dryRunResult && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Validation Results</h3>
                    
                    <div className="flex gap-4">
                      <Badge variant="outline" className="px-3 py-1">
                        <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                        OK: {dryRunResult.summary.ok}
                      </Badge>
                      <Badge variant="outline" className="px-3 py-1">
                        <AlertTriangle className="h-4 w-4 mr-1 text-yellow-600" />
                        Warnings: {dryRunResult.summary.warnings}
                      </Badge>
                      <Badge variant="outline" className="px-3 py-1">
                        <AlertCircle className="h-4 w-4 mr-1 text-red-600" />
                        Errors: {dryRunResult.summary.errors}
                      </Badge>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Row</TableHead>
                            <TableHead className="w-24">Status</TableHead>
                            {dryRunResult.columns.slice(0, 3).map(col => (
                              <TableHead key={col}>{col}</TableHead>
                            ))}
                            <TableHead>Errors</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dryRunResult.rows.slice(0, 20).map((row) => (
                            <TableRow key={row.row}>
                              <TableCell>{row.row}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={row.status === 'ok' ? 'default' : 'destructive'}
                                  className={row.status === 'ok' ? 'bg-green-100 text-green-800' : ''}
                                >
                                  {row.status.toUpperCase()}
                                </Badge>
                              </TableCell>
                              {dryRunResult.columns.slice(0, 3).map(col => (
                                <TableCell key={col} className="max-w-xs truncate">
                                  {row.normalized[col] || '-'}
                                </TableCell>
                              ))}
                              <TableCell className="text-sm text-red-600">
                                {row.errors.join('; ')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={handleImport}
                        disabled={dryRunResult.summary.ok === 0 || isImporting}
                        className="bg-blue-600 hover:bg-blue-700"
                        data-testid="button-import"
                      >
                        {isImporting ? 'Importing...' : `Import ${dryRunResult.summary.ok} Components`}
                      </Button>
                    </div>
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
                Required and optional fields for component import
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
                          <Badge variant="outline">Optional</Badge>
                        )}
                      </TableCell>
                      <TableCell>{field.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Component Categories (8 Main Categories)</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Ship General</li>
                  <li>• Hull</li>
                  <li>• Equipment for Cargo</li>
                  <li>• Ship's Equipment</li>
                  <li>• Equipment for Crew & Passengers</li>
                  <li>• Machinery Main Components</li>
                  <li>• Systems for Machinery Main Components</li>
                  <li>• Ship Common Systems</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Upload History</CardTitle>
              <CardDescription>
                Previous component import operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : history?.items?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Skipped</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.items.map((item: ImportHistory) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            {new Date(item.date).toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.mode.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>{item.created}</TableCell>
                        <TableCell>{item.updated}</TableCell>
                        <TableCell>{item.skipped}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={item.status === 'success' ? 'default' : 'destructive'}
                            className={item.status === 'success' ? 'bg-green-100 text-green-800' : ''}
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={item.status !== 'complete'}
                            onClick={() => handleUndoClick(item.id, item.type)}
                            data-testid={`button-undo-${item.id}`}
                          >
                            <Undo2 className="h-4 w-4 mr-1" />
                            Undo
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No upload history yet</p>
                  <p className="text-sm mt-1">Upload your first file to see it here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={undoDialogOpen} onOpenChange={setUndoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo Import?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reverse all changes from this import. Created records will be deleted, 
              updated records will be restored to their previous state, and archived records 
              will be unarchived.
              {'\n\n'}
              This action cannot be undone. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUndoing} data-testid="button-undo-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleUndo}
              disabled={isUndoing}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-undo-confirm"
            >
              {isUndoing ? 'Undoing...' : 'Yes, Undo Import'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
