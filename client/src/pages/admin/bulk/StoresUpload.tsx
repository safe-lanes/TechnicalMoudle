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
  Package
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

const FIELD_MAPPINGS = [
  { field: "Item Code", required: true, description: "Unique identifier for the stores item" },
  { field: "Item Name", required: true, description: "Name of the item" },
  { field: "Type", required: true, description: "Stores, Lubes, Chemicals, Others" },
  { field: "Stores Category", required: false, description: "Category (General Stores, Electrical, etc.)" },
  { field: "UOM", required: false, description: "Unit of measurement" },
  { field: "ROB", required: false, description: "Remaining on Board (total)" },
  { field: "Min", required: false, description: "Minimum stock level" },
  { field: "Location A", required: false, description: "Primary storage location" },
  { field: "Location B", required: false, description: "Secondary storage location" },
  { field: "ROB Location A", required: false, description: "ROB at Location A" },
  { field: "ROB Location B", required: false, description: "ROB at Location B" },
  { field: "IMPA Code", required: false, description: "International Maritime Parts Association code" },
];

interface StoresUploadProps {
  vesselId: string;
}

const STORE_TYPES = [
  { value: 'stores', label: 'Stores' },
  { value: 'lubricants', label: 'Lubes' },
  { value: 'chemicals', label: 'Chemicals' },
  { value: 'others', label: 'Others' }
];

export default function StoresUpload({ vesselId }: StoresUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'add' | 'update' | 'upsert'>('upsert');
  const [selectedStoreType, setSelectedStoreType] = useState<string>('');
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const { toast } = useToast();

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['/api/bulk/history', 'stores'],
    queryFn: async () => {
      const response = await fetch('/api/bulk/history?type=stores&limit=50');
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    }
  });

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`/api/bulk/template?type=stores&vesselId=${vesselId}`);
      if (!response.ok) throw new Error('Failed to download template');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stores_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Template Downloaded',
        description: 'Stores template has been downloaded.'
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download template.',
        variant: 'destructive'
      });
    }
  };

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
    
    if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      await loadSheets(file);
    } else {
      await handleDryRun(file, '');
    }
  };

  const handleDryRun = async (file: File, sheetName?: string) => {
    setIsUploading(true);
    setDryRunResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'stores');
    formData.append('mode', importMode);
    formData.append('vesselId', vesselId);
    formData.append('archiveMissing', 'false');
    formData.append('storeType', selectedStoreType);
    
    if (sheetName) {
      formData.append('sheetName', sheetName);
    }

    try {
      const response = await fetch('/api/bulk/dry-run', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Dry run failed');
      }

      const result = await response.json();
      setDryRunResult(result);
      
      if (result.summary.errors > 0) {
        toast({
          title: 'Validation Complete',
          description: `Found ${result.summary.errors} errors. Review and fix before importing.`,
          variant: 'destructive'
        });
      } else if (result.summary.warnings > 0) {
        toast({
          title: 'Validation Complete',
          description: `${result.summary.ok} rows valid, ${result.summary.warnings} warnings.`
        });
      } else {
        toast({
          title: 'Validation Complete',
          description: `All ${result.summary.ok} rows are valid. Ready to import.`
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

  const handleImport = async () => {
    if (!dryRunResult?.fileToken) return;
    
    setIsImporting(true);

    try {
      const response = await fetch('/api/bulk/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileToken: dryRunResult.fileToken,
          type: 'stores',
          mode: importMode,
          vesselId,
          archiveMissing: false,
          storeType: selectedStoreType
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Import failed');
      }

      const result = await response.json();
      
      toast({
        title: 'Import Complete',
        description: `Created: ${result.created}, Updated: ${result.updated}, Skipped: ${result.skipped}`
      });

      setSelectedFile(null);
      setDryRunResult(null);
      setAvailableSheets([]);
      setSelectedSheet('');
      setSelectedStoreType('');
      
      queryClient.invalidateQueries({ queryKey: ['/api/stores'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bulk/history'] });
    } catch (error: any) {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import stores',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-sky-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-sky-600" />
            <div>
              <CardTitle>Stores Bulk Import</CardTitle>
              <CardDescription>
                Upload stores inventory data for {vesselId}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload" data-testid="tab-upload">Upload</TabsTrigger>
              <TabsTrigger value="template" data-testid="tab-template">Template</TabsTrigger>
              <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-6 pt-4">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <Label className="text-sm font-medium">Import Mode</Label>
                  <Select value={importMode} onValueChange={(v) => setImportMode(v as any)}>
                    <SelectTrigger className="mt-2" data-testid="select-import-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">Add Only (skip existing)</SelectItem>
                      <SelectItem value="update">Update Only (skip new)</SelectItem>
                      <SelectItem value="upsert">Add + Update</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    {importMode === 'add' && 'Only new stores items will be added'}
                    {importMode === 'update' && 'Only existing stores items will be updated'}
                    {importMode === 'upsert' && 'New items added, existing items updated'}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Store Type <span className="text-red-500">*</span></Label>
                  <Select value={selectedStoreType} onValueChange={setSelectedStoreType}>
                    <SelectTrigger className="mt-2" data-testid="select-store-type">
                      <SelectValue placeholder="Select store type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {STORE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select which tab this data belongs to
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Select File</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept=".csv,.xls,.xlsx"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="stores-file-input"
                      data-testid="input-file"
                      disabled={!selectedStoreType}
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('stores-file-input')?.click()}
                      className="w-full"
                      disabled={!selectedStoreType}
                      data-testid="button-select-file"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {selectedFile ? selectedFile.name : 'Choose File'}
                    </Button>
                    {!selectedStoreType && (
                      <p className="text-xs text-amber-600 mt-1">
                        Please select a store type first
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {availableSheets.length > 1 && (
                <div>
                  <Label className="text-sm font-medium">Select Sheet</Label>
                  <div className="flex gap-2 mt-2">
                    <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                      <SelectTrigger data-testid="select-sheet">
                        <SelectValue placeholder="Select sheet..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSheets.map((sheet) => (
                          <SelectItem key={sheet} value={sheet}>{sheet}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => selectedFile && handleDryRun(selectedFile, selectedSheet)}
                      disabled={!selectedSheet || isUploading}
                      data-testid="button-validate"
                    >
                      {isUploading ? 'Validating...' : 'Validate'}
                    </Button>
                  </div>
                </div>
              )}

              {dryRunResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-green-700 font-medium">{dryRunResult.summary.ok} Valid</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      <span className="text-amber-700 font-medium">{dryRunResult.summary.warnings} Warnings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <span className="text-red-700 font-medium">{dryRunResult.summary.errors} Errors</span>
                    </div>
                  </div>

                  {dryRunResult.rows.filter(r => r.status !== 'ok').length > 0 && (
                    <div className="rounded-lg border overflow-hidden max-h-64 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="w-16">Row</TableHead>
                            <TableHead className="w-24">Status</TableHead>
                            <TableHead>Issues</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dryRunResult.rows.filter(r => r.status !== 'ok').map((row) => (
                            <TableRow key={row.row}>
                              <TableCell className="font-mono">{row.row}</TableCell>
                              <TableCell>
                                <Badge variant={row.status === 'error' ? 'destructive' : 'secondary'}>
                                  {row.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {row.errors.join('; ')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <Button
                    onClick={handleImport}
                    disabled={isImporting || dryRunResult.summary.errors > 0}
                    className="w-full"
                    data-testid="button-import"
                  >
                    {isImporting ? 'Importing...' : `Import ${dryRunResult.summary.ok} Valid Rows`}
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="template" className="pt-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium">Template Download</h3>
                    <p className="text-sm text-gray-600">
                      Download the Excel template with correct column headers
                    </p>
                  </div>
                  <Button onClick={handleDownloadTemplate} data-testid="button-download-template">
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                </div>

                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Field Name</TableHead>
                        <TableHead className="w-24 text-center">Required</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {FIELD_MAPPINGS.map((field) => (
                        <TableRow key={field.field}>
                          <TableCell className="font-medium">{field.field}</TableCell>
                          <TableCell className="text-center">
                            {field.required ? (
                              <Badge variant="destructive">Required</Badge>
                            ) : (
                              <Badge variant="outline">Optional</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-600">{field.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="pt-4">
              {historyLoading ? (
                <div className="text-center py-8 text-gray-500">Loading history...</div>
              ) : (history?.length || 0) === 0 ? (
                <div className="text-center py-8">
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No import history yet</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Date</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead className="text-right">Created</TableHead>
                        <TableHead className="text-right">Updated</TableHead>
                        <TableHead className="text-right">Skipped</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history?.map((h: any) => (
                        <TableRow key={h.id}>
                          <TableCell>{h.date}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{h.mode}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-green-600">{h.created}</TableCell>
                          <TableCell className="text-right text-blue-600">{h.updated}</TableCell>
                          <TableCell className="text-right text-gray-500">{h.skipped}</TableCell>
                          <TableCell>
                            <Badge variant={h.status === 'complete' ? 'default' : 'secondary'}>
                              {h.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
