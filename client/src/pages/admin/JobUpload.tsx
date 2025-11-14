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
  Clock
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
  { field: "Vessel Code", required: true, description: "Vessel code (e.g., V001)" },
  { field: "Component Code", required: true, description: "Must match existing component SFI code" },
  { field: "Component Name", required: false, description: "Component name (auto-populated from component code)" },
  { field: "Job Code", required: false, description: "Auto-generated as JOB-XXXXXXX" },
  { field: "Job Category", required: false, description: "Category of the job" },
  { field: "Maintenance Task", required: true, description: "Job title/maintenance task description" },
  { field: "Maintenance Basis", required: true, description: "Calendar, Running Hours, or Condition Based" },
  { field: "Frequency Value", required: false, description: "Required for Calendar/Running Hours (e.g., 6, 500)" },
  { field: "Frequency Unit", required: false, description: "Required for Calendar only (Days, Weeks, Months, Years)" },
  { field: "Task Type", required: true, description: "Inspection, Overhaul, Service, Testing, etc." },
  { field: "Brief Job Description", required: false, description: "Detailed description of work to be done" },
  { field: "Required Spare Parts", required: false, description: "Comma-separated list of spare part codes" },
  { field: "Required Tools", required: false, description: "Comma-separated list of tool names" },
  { field: "Required Safety Items", required: false, description: "Comma-separated list of safety requirements" },
  { field: "Job Priority", required: false, description: "Low, Medium, High, or Critical" },
  { field: "Planned Duration", required: false, description: "Estimated duration in hours" },
  { field: "Last Done Date", required: false, description: "Date last completed (DD/MM/YYYY)" },
  { field: "Initial Next Due", required: false, description: "Next due date (DD/MM/YYYY)" },
  { field: "Person In Charge", required: false, description: "Person responsible for the job" },
  { field: "Responsible Department", required: false, description: "Department responsible" },
  { field: "Dept Code", required: false, description: "Department code" },
  { field: "Class Related", required: false, description: "Yes or No" },
  { field: "Critical", required: false, description: "Yes or No" },
];

interface JobUploadProps {
  vesselId: string;
}

export default function JobUpload({ vesselId }: JobUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'add' | 'update' | 'upsert'>('upsert');
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const { toast } = useToast();

  // Fetch import history
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['/api/bulk/history', 'jobs'],
    queryFn: async () => {
      const response = await fetch('/api/bulk/history?type=jobs&limit=50');
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    }
  });

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`/api/bulk/template?type=jobs&vesselId=${vesselId}`);
      if (!response.ok) throw new Error('Failed to download template');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'jobs_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Template Downloaded',
        description: 'Excel template with all job fields has been downloaded.'
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
        // Immediately validate the first sheet
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
    formData.append('type', 'jobs');
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
      const response = await fetch('/api/bulk/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileToken: dryRunResult.fileToken,
          type: 'jobs',
          mode: importMode,
          archiveMissing: false,
          vesselId: vesselId
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
      queryClient.invalidateQueries({ queryKey: ['/api/bulk/history', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Jobs Bulk Upload</h1>
          <p className="text-gray-600 mt-2">Upload jobs via Excel. Download template to get dropdown of all system components. Job codes auto-generated as JOB-XXXXXXX.</p>
        </div>
        <Button variant="outline" onClick={handleDownloadTemplate} data-testid="button-download-template">
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload" data-testid="tab-upload">Upload</TabsTrigger>
          <TabsTrigger value="mapping" data-testid="tab-mapping">Field Mapping Guide</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Upload History</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>File Upload</CardTitle>
                <CardDescription>
                  Upload CSV, XLS, or XLSX files containing job data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label>Import Mode</Label>
                    <Select value={importMode} onValueChange={(v: any) => setImportMode(v)}>
                      <SelectTrigger data-testid="select-import-mode">
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
                            <TableHead>Vessel Code</TableHead>
                            <TableHead>Component Code</TableHead>
                            <TableHead>Maintenance Task</TableHead>
                            <TableHead>Errors</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dryRunResult.rows.slice(0, 20).map((row) => (
                            <TableRow key={row.row}>
                              <TableCell>{row.row}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={row.status === 'ok' ? 'default' : row.status === 'warning' ? 'secondary' : 'destructive'}
                                >
                                  {row.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{row.normalized['Vessel Code']}</TableCell>
                              <TableCell>{row.normalized['Component Code']}</TableCell>
                              <TableCell>{row.normalized['Maintenance Task']}</TableCell>
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

                    <Button 
                      onClick={handleImport} 
                      disabled={dryRunResult.summary.errors > 0 || isImporting}
                      className="w-full"
                      data-testid="button-import"
                    >
                      {isImporting ? 'Importing...' : `Import ${dryRunResult.summary.ok} Jobs`}
                    </Button>
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
                Required and optional fields for job import
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field Name</TableHead>
                    <TableHead className="w-32">Required</TableHead>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Upload History</CardTitle>
              <CardDescription>
                View past job import operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Clock className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : history?.items?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Date
                        </div>
                      </TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Skipped</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            {new Date(item.startedAt).toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.mode}</Badge>
                        </TableCell>
                        <TableCell>{item.created}</TableCell>
                        <TableCell>{item.updated}</TableCell>
                        <TableCell>{item.skipped}</TableCell>
                        <TableCell>
                          <Badge variant={item.status === 'completed' ? 'default' : 'secondary'}>
                            {item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <FileSpreadsheet className="w-16 h-16 mb-3" />
                  <p className="text-lg font-medium">No upload history</p>
                  <p className="text-sm">Import history will appear here after your first upload</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
