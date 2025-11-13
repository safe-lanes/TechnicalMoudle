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
      // Include vesselId to populate Components sheet with all system components
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
    await handleDryRun(file);
  };

  // Dry run validation
  const handleDryRun = async (file: File) => {
    setIsUploading(true);
    setDryRunResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'jobs');
    formData.append('mode', importMode);
    formData.append('vesselId', vesselId);
    formData.append('archiveMissing', 'false');

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

      // Reset state
      setSelectedFile(null);
      setDryRunResult(null);
      
      // Refresh history
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
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Jobs Bulk Upload</CardTitle>
          <CardDescription>
            Upload jobs via Excel. Download template to get dropdown of all system components. Job codes auto-generated as JOB-XXXXXXX.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Template Download */}
          <div>
            <Button 
              onClick={handleDownloadTemplate} 
              variant="outline" 
              className="w-full"
              data-testid="button-download-template"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Excel Template
            </Button>
          </div>

          {/* Import Mode Selection */}
          <div className="space-y-2">
            <Label>Import Mode</Label>
            <Select value={importMode} onValueChange={(val) => setImportMode(val as any)}>
              <SelectTrigger data-testid="select-import-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Create Only (Skip if exists)</SelectItem>
                <SelectItem value="update">Update Only (Skip if not exists)</SelectItem>
                <SelectItem value="upsert">Create & Update (Upsert)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload File</Label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="flex-1"
                data-testid="input-file-upload"
              />
              {isUploading && <span className="text-sm text-gray-500">Validating...</span>}
            </div>
          </div>

          {/* Validation Results */}
          {dryRunResult && (
            <Tabs defaultValue="summary">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="preview">Data Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="text-2xl font-bold">{dryRunResult.summary.ok}</p>
                          <p className="text-sm text-gray-500">Valid</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                        <div>
                          <p className="text-2xl font-bold">{dryRunResult.summary.warnings}</p>
                          <p className="text-sm text-gray-500">Warnings</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <div>
                          <p className="text-2xl font-bold">{dryRunResult.summary.errors}</p>
                          <p className="text-sm text-gray-500">Errors</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Button 
                  onClick={handleImport} 
                  disabled={dryRunResult.summary.errors > 0 || isImporting}
                  className="w-full"
                  data-testid="button-import"
                >
                  {isImporting ? 'Importing...' : 'Import Jobs'}
                </Button>
              </TabsContent>

              <TabsContent value="preview">
                <Card>
                  <CardContent className="pt-6">
                    <div className="max-h-96 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">Row</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Vessel Code</TableHead>
                            <TableHead>Component Code</TableHead>
                            <TableHead>Maintenance Task</TableHead>
                            <TableHead>Issues</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dryRunResult.rows.map((row) => (
                            <TableRow key={row.row}>
                              <TableCell>{row.row}</TableCell>
                              <TableCell>
                                {row.status === 'ok' && <Badge variant="default">OK</Badge>}
                                {row.status === 'warning' && <Badge variant="secondary">Warning</Badge>}
                                {row.status === 'error' && <Badge variant="destructive">Error</Badge>}
                              </TableCell>
                              <TableCell>{row.normalized['Vessel Code']}</TableCell>
                              <TableCell>{row.normalized['Component Code']}</TableCell>
                              <TableCell>{row.normalized['Maintenance Task']}</TableCell>
                              <TableCell>
                                {row.errors.map((err, i) => (
                                  <div key={i} className="text-sm text-red-600">{err}</div>
                                ))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Field Mapping Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Field Mapping Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
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
        </CardContent>
      </Card>

      {/* Import History */}
      <Card>
        <CardHeader>
          <CardTitle>Import History</CardTitle>
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
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
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
                    <TableCell>{new Date(item.date).toLocaleString()}</TableCell>
                    <TableCell>{item.user}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.mode}</Badge>
                    </TableCell>
                    <TableCell>{item.created}</TableCell>
                    <TableCell>{item.updated}</TableCell>
                    <TableCell>{item.skipped}</TableCell>
                    <TableCell>
                      <Badge>{item.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <FileSpreadsheet className="w-12 h-12 mb-2" />
              <p>No import history yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
