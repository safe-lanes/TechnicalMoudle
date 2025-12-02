import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Upload, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  AlertTriangle,
  FileSpreadsheet,
  Undo2,
  Eye,
  FileWarning,
  Clock,
  File,
  FileDown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { invalidateAfterBulkImport } from "@/lib/cacheInvalidation";
import { LucideIcon } from "lucide-react";

interface FieldMapping {
  field: string;
  required: boolean;
  description: string;
}

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
  user: string;
  fileName?: string;
  originalName?: string;
  storedFilePath?: string | null;
}

interface StoreTypeOption {
  value: string;
  label: string;
}

interface UniformBulkUploadProps {
  title: string;
  description: string;
  icon: LucideIcon;
  templateType: 'components' | 'jobs' | 'spares' | 'stores';
  templateFileName: string;
  fieldMappings: FieldMapping[];
  vesselId: string;
  previewColumns?: string[];
  storeTypes?: StoreTypeOption[];
  onRefreshData?: () => void;
}

export default function UniformBulkUpload({
  title,
  description,
  icon: Icon,
  templateType,
  templateFileName,
  fieldMappings,
  vesselId,
  previewColumns,
  storeTypes,
  onRefreshData
}: UniformBulkUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'add' | 'update' | 'upsert'>('upsert');
  const [selectedStoreType, setSelectedStoreType] = useState<string>('');
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
  const [isUndoing, setIsUndoing] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const { toast } = useToast();

  const { data: historyData, isLoading: historyLoading } = useQuery<{items: ImportHistory[], total: number}>({
    queryKey: ['/api/bulk/history', templateType],
    queryFn: async () => {
      const response = await fetch(`/api/bulk/history?type=${templateType}&limit=50`);
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    }
  });

  const history = historyData?.items || [];

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`/api/bulk/template?type=${templateType}&vesselId=${vesselId}`);
      if (!response.ok) throw new Error('Failed to download template');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = templateFileName;
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

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDryRun = async (file: File, sheetName?: string) => {
    setIsUploading(true);
    setDryRunResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', templateType);
    formData.append('mode', importMode);
    formData.append('vesselId', vesselId);
    formData.append('archiveMissing', 'false');
    
    if (sheetName) {
      formData.append('sheetName', sheetName);
    }
    
    if (templateType === 'stores' && selectedStoreType) {
      formData.append('storeType', selectedStoreType);
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
          description: `Found ${result.summary.errors} error(s). Review before importing.`,
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

  const handleImport = async (skipErrors: boolean = false) => {
    if (!dryRunResult) return;

    setIsImporting(true);

    const rowIndices = skipErrors
      ? dryRunResult.rows
          .filter(row => row.status === 'ok' || row.status === 'warning')
          .map(row => row.row)
      : undefined;

    try {
      const requestBody: any = {
        fileToken: dryRunResult.fileToken,
        type: templateType,
        mode: importMode,
        vesselId: vesselId,
        archiveMissing: false,
        rowIndices
      };
      
      if (templateType === 'stores' && selectedStoreType) {
        requestBody.storeType = selectedStoreType;
      }

      const response = await fetch('/api/bulk/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
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

      setSelectedFile(null);
      setDryRunResult(null);
      setAvailableSheets([]);
      setSelectedSheet('');
      setPartialImportDialogOpen(false);
      
      if (templateType === 'stores') {
        setSelectedStoreType('');
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/bulk/history', templateType] });
      
      // Invalidate domain-specific caches to ensure fresh data displays
      invalidateAfterBulkImport(templateType, vesselId);
      
      if (onRefreshData) {
        onRefreshData();
      }
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

  const getErrorRows = () => {
    if (!dryRunResult) return [];
    return dryRunResult.rows.filter(row => row.status === 'error');
  };

  const getValidRowsCount = () => {
    if (!dryRunResult) return 0;
    return dryRunResult.rows.filter(row => row.status === 'ok' || row.status === 'warning').length;
  };

  const handleUndoClick = (historyId: string) => {
    setSelectedHistoryId(historyId);
    setUndoDialogOpen(true);
  };

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
      
      queryClient.invalidateQueries({ queryKey: ['/api/bulk/history', templateType] });
      
      // Invalidate domain-specific caches after undo
      invalidateAfterBulkImport(templateType, vesselId);
      
      if (onRefreshData) {
        onRefreshData();
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

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const handleDownloadOriginalFile = async (historyId: string, fileName?: string) => {
    try {
      const response = await fetch(`/api/bulk/history/${historyId}/download-original`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'File not available');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'import_file';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'File Downloaded',
        description: 'Original uploaded file has been downloaded.'
      });
    } catch (error: any) {
      toast({
        title: 'Download Failed',
        description: error.message || 'Failed to download file. File may not be available for older imports.',
        variant: 'destructive'
      });
    }
  };

  const isStoresAndNoType = templateType === 'stores' && !selectedStoreType;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-100 rounded-lg">
            <Icon className="h-6 w-6 text-sky-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-gray-600">{description}</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleDownloadTemplate} data-testid="button-download-template">
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" data-testid="tab-upload">Upload</TabsTrigger>
          <TabsTrigger value="mapping" data-testid="tab-mapping">Field Mapping Guide</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6 pt-4">
          {storeTypes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Store Type <span className="text-red-500">*</span></CardTitle>
                <CardDescription>Select which tab this data belongs to (required)</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedStoreType} onValueChange={setSelectedStoreType}>
                  <SelectTrigger className="w-64" data-testid="select-store-type">
                    <SelectValue placeholder="Select store type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {storeTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          <Card className={isStoresAndNoType ? 'opacity-50 pointer-events-none' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Import Mode</CardTitle>
              <CardDescription>Choose how to handle existing records</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={importMode} 
                onValueChange={(value) => setImportMode(value as any)}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="add" id="mode-add" className="mt-1" />
                  <Label htmlFor="mode-add" className="font-normal cursor-pointer">
                    <div className="font-medium">Add Only</div>
                    <div className="text-sm text-gray-500">Only create new records, skip existing ones</div>
                  </Label>
                </div>
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="update" id="mode-update" className="mt-1" />
                  <Label htmlFor="mode-update" className="font-normal cursor-pointer">
                    <div className="font-medium">Update Only</div>
                    <div className="text-sm text-gray-500">Only update existing records, skip new ones</div>
                  </Label>
                </div>
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="upsert" id="mode-upsert" className="mt-1" />
                  <Label htmlFor="mode-upsert" className="font-normal cursor-pointer">
                    <div className="font-medium">Add + Update (Recommended)</div>
                    <div className="text-sm text-gray-500">Create new records and update existing ones</div>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <Card className={isStoresAndNoType ? 'opacity-50 pointer-events-none' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upload File</CardTitle>
              <CardDescription>
                Upload CSV, XLS, or XLSX files containing {templateType} data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-sky-400 transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => document.getElementById(`file-upload-${templateType}`)?.click()}
              >
                <input
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                  id={`file-upload-${templateType}`}
                  disabled={isUploading || isImporting || isStoresAndNoType}
                  data-testid="input-file-upload"
                />
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <span className="text-sm font-medium text-gray-700">
                  Click to upload or drag and drop
                </span>
                <span className="block text-xs text-gray-500 mt-1">
                  CSV, XLS, or XLSX (max 20MB)
                </span>
                {selectedFile && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-sky-600">
                    <File className="h-4 w-4" />
                    {selectedFile.name}
                  </div>
                )}
              </div>

              {availableSheets.length > 1 && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <Label className="text-sm font-medium">Select Sheet</Label>
                  <div className="flex gap-2 mt-2">
                    <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                      <SelectTrigger className="flex-1" data-testid="select-sheet">
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
                      data-testid="button-revalidate"
                    >
                      {isUploading ? 'Validating...' : 'Re-validate'}
                    </Button>
                  </div>
                </div>
              )}

              {(isUploading || isLoadingSheets) && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600 mx-auto mb-2"></div>
                  <p className="text-gray-600">{isLoadingSheets ? 'Reading file...' : 'Validating file...'}</p>
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

                  <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="w-16">Row</TableHead>
                          <TableHead className="w-24">Status</TableHead>
                          {(previewColumns || dryRunResult.columns.slice(0, 3)).map(col => (
                            <TableHead key={col}>{col}</TableHead>
                          ))}
                          <TableHead>Issues</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dryRunResult.rows.slice(0, 20).map((row) => (
                          <TableRow key={row.row}>
                            <TableCell className="font-mono">{row.row}</TableCell>
                            <TableCell>
                              <Badge variant={row.status === 'ok' ? 'default' : row.status === 'warning' ? 'secondary' : 'destructive'}>
                                {row.status}
                              </Badge>
                            </TableCell>
                            {(previewColumns || dryRunResult.columns.slice(0, 3)).map(col => (
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

                  {dryRunResult.summary.errors === 0 ? (
                    <Button 
                      onClick={() => handleImport(false)} 
                      disabled={isImporting || dryRunResult.summary.ok === 0}
                      className="w-full bg-sky-600 hover:bg-sky-700"
                      data-testid="button-import"
                    >
                      {isImporting ? 'Importing...' : `Import ${dryRunResult.summary.ok} Records`}
                    </Button>
                  ) : (
                    <div className="flex gap-3">
                      <Button 
                        onClick={() => setPartialImportDialogOpen(true)}
                        disabled={isImporting || getValidRowsCount() === 0}
                        className="flex-1 bg-amber-600 hover:bg-amber-700"
                        data-testid="button-import-valid"
                      >
                        <FileWarning className="h-4 w-4 mr-2" />
                        {isImporting ? 'Importing...' : `Skip Errors & Import ${getValidRowsCount()} Valid Rows`}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Field Mapping Guide</CardTitle>
              <CardDescription>
                Required and optional fields for {templateType} import
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                    {fieldMappings.map((field) => (
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>
                View past imports and undo if needed
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="text-center py-8 text-gray-500">Loading history...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-12">
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No import history yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Import records will appear here after your first upload
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Date & Time</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead className="text-right">Created</TableHead>
                        <TableHead className="text-right">Updated</TableHead>
                        <TableHead className="text-right">Skipped</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-400" />
                              {formatDate(h.date)}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {h.originalName || h.fileName || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{h.mode}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">{h.created}</TableCell>
                          <TableCell className="text-right text-blue-600 font-medium">{h.updated}</TableCell>
                          <TableCell className="text-right text-gray-500">{h.skipped}</TableCell>
                          <TableCell>
                            <Badge variant={h.status === 'complete' ? 'default' : h.status === 'undone' ? 'secondary' : 'destructive'}>
                              {h.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {h.status === 'complete' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUndoClick(h.id)}
                                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  data-testid={`button-undo-${h.id}`}
                                >
                                  <Undo2 className="h-4 w-4 mr-1" />
                                  Undo
                                </Button>
                              )}
                              {h.storedFilePath && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownloadOriginalFile(h.id, h.originalName)}
                                  className="text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                                  title="Download original file"
                                  data-testid={`button-download-file-${h.id}`}
                                >
                                  <FileDown className="h-4 w-4" />
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Error Details ({getErrorRows().length} rows)
            </DialogTitle>
            <DialogDescription>
              These rows have validation errors and will not be imported
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-red-50">
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Data Preview</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getErrorRows().map((row) => (
                    <TableRow key={row.row}>
                      <TableCell className="font-mono">{row.row}</TableCell>
                      <TableCell className="text-sm">
                        {Object.entries(row.normalized).slice(0, 3).map(([key, value]) => (
                          <span key={key} className="mr-2">{key}: {String(value)}</span>
                        ))}
                      </TableCell>
                      <TableCell className="text-sm text-red-600">
                        {row.errors.map((err, i) => (
                          <div key={i}>{err}</div>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={partialImportDialogOpen} onOpenChange={setPartialImportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Partial Import Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to import {getValidRowsCount()} valid rows while skipping {dryRunResult?.summary.errors || 0} rows with errors.
              <br /><br />
              The skipped rows will not be imported. You can fix them in your file and re-upload later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleImport(true)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isImporting ? 'Importing...' : 'Proceed with Partial Import'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={undoDialogOpen} onOpenChange={setUndoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo Import</AlertDialogTitle>
            <AlertDialogDescription>
              This will reverse the import operation:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Records created by this import will be deleted</li>
                <li>Records updated by this import will be restored to their previous state</li>
                <li>Records archived by this import will be unarchived</li>
              </ul>
              <br />
              This action cannot be undone. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUndoing}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleUndo}
              disabled={isUndoing}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isUndoing ? 'Undoing...' : 'Yes, Undo Import'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
