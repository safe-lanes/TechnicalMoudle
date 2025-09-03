import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Upload, 
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  FileDown,
  FileText
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import Alerts from './Alerts';
import Forms from '@/components/admin/Forms';
import { FEATURES } from '@/config/features';

interface Template {
  id: string;
  name: string;
  type: 'components' | 'spares' | 'stores';
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
  date: string;
  user: string;
  mode: string;
  created: number;
  updated: number;
  skipped: number;
  archived?: number;
}

export default function BulkImport() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'add' | 'update' | 'upsert'>('add');
  const [archiveMissing, setArchiveMissing] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const templates: Template[] = [
    { id: '1', name: 'Machinery Components', type: 'components' },
    { id: '2', name: 'Stores', type: 'spares' },
    { id: '3', name: 'Spares', type: 'stores' },
    { id: '4', name: 'Template 4', type: 'components' },
    { id: '5', name: 'Template 5', type: 'components' },
    { id: '6', name: 'Template 6', type: 'components' },
  ];

  // Fetch import history
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['/api/bulk/history', selectedTemplate?.type],
    queryFn: async () => {
      if (!selectedTemplate) return { items: [], total: 0 };
      const response = await fetch(`/api/bulk/history?type=${selectedTemplate.type}`);
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    },
    enabled: !!selectedTemplate
  });

  // Download template
  const handleDownloadTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      const response = await fetch(`/api/bulk/template?type=${selectedTemplate.type}`);
      if (!response.ok) throw new Error('Failed to download template');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTemplate.type}_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Template Downloaded',
        description: `${selectedTemplate.name} template has been downloaded.`
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download template. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Handle file drop
  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && isValidFile(file)) {
      setSelectedFile(file);
      handleDryRun(file);
    } else {
      toast({
        title: 'Invalid File',
        description: 'Please upload a .xlsx, .xls, or .csv file',
        variant: 'destructive'
      });
    }
  }, [selectedTemplate, importMode, archiveMissing]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isValidFile(file)) {
      setSelectedFile(file);
      handleDryRun(file);
    } else {
      toast({
        title: 'Invalid File',
        description: 'Please upload a .xlsx, .xls, or .csv file',
        variant: 'destructive'
      });
    }
  };

  const isValidFile = (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = file.name.toLowerCase();
    return validExtensions.some(ext => fileName.endsWith(ext));
  };

  // Dry run validation
  const handleDryRun = async (file: File) => {
    if (!selectedTemplate) return;

    setIsUploading(true);
    setDryRunResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', selectedTemplate.type);
    formData.append('mode', importMode);
    formData.append('archiveMissing', archiveMissing.toString());

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
      } else if (result.summary.warnings > 0) {
        toast({
          title: 'Validation Complete',
          description: `File is valid with ${result.summary.warnings} warning(s).`
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
    if (!dryRunResult || !selectedTemplate) return;

    setIsImporting(true);

    try {
      const response = await apiRequest('POST', '/api/bulk/import', {
        fileToken: dryRunResult.fileToken,
        type: selectedTemplate.type,
        mode: importMode,
        archiveMissing,
        vesselId: 'vessel-001' // TODO: Get from context
      });

      const result = await response.json();

      toast({
        title: 'Import Successful',
        description: `Created: ${result.created}, Updated: ${result.updated}, Skipped: ${result.skipped}${result.archived ? `, Archived: ${result.archived}` : ''}`
      });

      // Clear state and refresh history
      setSelectedFile(null);
      setDryRunResult(null);
      queryClient.invalidateQueries({ queryKey: ['/api/bulk/history'] });
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

  // Download history file
  const handleDownloadHistoryFile = async (historyId: string, fileType: 'file' | 'errors' | 'result-map') => {
    try {
      const response = await fetch(`/api/bulk/history/${historyId}/${fileType}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileType}.${fileType === 'file' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download file',
        variant: 'destructive'
      });
    }
  };

  const [activeTab, setActiveTab] = useState<'bulk-import' | 'alerts' | 'forms' | 'admin4'>('bulk-import');

  // Get the display title based on the active tab
  const getTabTitle = () => {
    switch (activeTab) {
      case 'bulk-import':
        return 'Bulk Data Import';
      case 'alerts':
        return 'Alerts';
      case 'forms':
        return 'Forms';
      case 'admin4':
        return 'Admin 4';
      default:
        return 'Bulk Data Import';
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{getTabTitle()}</h1>
        <div className="mt-4 flex gap-2">
          <Button 
            variant={activeTab === 'bulk-import' ? "default" : "outline"}
            className={activeTab === 'bulk-import' ? "bg-blue-600 hover:bg-blue-700" : ""}
            onClick={() => setActiveTab('bulk-import')}
          >
            Bulk Data Imp
          </Button>
          <Button 
            variant={activeTab === 'alerts' ? "default" : "outline"}
            className={activeTab === 'alerts' ? "bg-blue-600 hover:bg-blue-700" : ""}
            onClick={() => setActiveTab('alerts')}
          >
            Alerts
          </Button>
          <Button 
            variant={activeTab === 'forms' ? "default" : "outline"}
            className={activeTab === 'forms' ? "bg-blue-600 hover:bg-blue-700" : ""}
            onClick={() => setActiveTab('forms')}
          >
            Forms
          </Button>
          <Button 
            variant={activeTab === 'admin4' ? "default" : "outline"} 
            className={activeTab === 'admin4' ? "bg-blue-600 hover:bg-blue-700" : ""}
            onClick={() => setActiveTab('admin4')}
          >
            Admin 4
          </Button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'bulk-import' ? (
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Templates */}
          <div className="col-span-3">
            <div className="bg-[#52baf3] text-white p-0 rounded-lg overflow-hidden">
              <div className="bg-[#40a6e0] px-4 py-3">
                <h2 className="text-lg font-semibold text-white">TEMPLATES</h2>
              </div>
              <div className="p-4 space-y-2">
                {templates.map((template, index) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplate(template);
                      setSelectedFile(null);
                      setDryRunResult(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                      selectedTemplate?.id === template.id
                        ? 'bg-white bg-opacity-20 text-white font-medium'
                        : 'hover:bg-white hover:bg-opacity-10 text-white'
                    }`}
                  >
                    {index + 1}. {template.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

        {/* Right Column - Detail */}
        <div className="col-span-9">
          {selectedTemplate ? (
            <Card className="p-6">
              {/* Template Header */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">
                  {templates.findIndex(t => t.id === selectedTemplate.id) + 1}. {selectedTemplate.name}
                </h2>
                <Button onClick={handleDownloadTemplate} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              {/* File Upload */}
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6"
                onDrop={handleFileDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-2">
                  Drag and drop your completed template file here, or click to browse
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Supported formats: .csv, .xls, .xlsx
                </p>
                <label htmlFor="file-upload">
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button variant="outline" asChild>
                    <span>Choose Files</span>
                  </Button>
                </label>
                {selectedFile && (
                  <p className="mt-4 text-sm font-medium">{selectedFile.name}</p>
                )}
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <Label>Import Mode</Label>
                  <Select value={importMode} onValueChange={(v: any) => setImportMode(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">Add New</SelectItem>
                      <SelectItem value="update">Update Existing</SelectItem>
                      <SelectItem value="upsert">Upsert (Add or Update)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(importMode === 'update' || importMode === 'upsert') && (
                  <div>
                    <Label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={archiveMissing}
                        onChange={(e) => setArchiveMissing(e.target.checked)}
                        className="rounded"
                      />
                      Archive Missing Records
                    </Label>
                    <p className="text-sm text-gray-500 mt-1">
                      Archive records not present in the file
                    </p>
                  </div>
                )}
              </div>

              <p className="text-sm text-gray-500 mb-6">
                Date format: Accepted DD-MMM-YYYY, DD-MM-YYYY, or ISO (YYYY-MM-DD)
                {FEATURES.IHM && selectedTemplate?.type === 'spares' && (
                  <span className="block mt-1">
                    IHM fields: Presence (Unknown/Present/Not Present), Material Type (Asbestos/PCB/PFOS/etc.), 
                    Evidence Type (MD/SDoC/Test/None)
                  </span>
                )}
              </p>

              {/* Dry Run Preview */}
              {isUploading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Validating file...</p>
                </div>
              )}

              {dryRunResult && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-4">Dry-Run Preview</h3>
                  
                  {/* IHM Column Notice for Spares */}
                  {FEATURES.IHM && selectedTemplate?.type === 'spares' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-blue-800">
                        <strong>IHM Columns Available:</strong> This template includes IHM (Inventory of Hazardous Materials) columns
                        for tracking hazardous materials presence and evidence. Columns: IHM Presence, IHM Material Type, 
                        IHM Evidence Type, IHM Evidence URL.
                      </p>
                    </div>
                  )}
                  
                  {/* Summary Pills */}
                  <div className="flex gap-4 mb-4">
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

                  {/* Preview Table */}
                  <div className="border rounded-lg overflow-hidden mb-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Row</TableHead>
                          <TableHead className="w-24">Status</TableHead>
                          {/* Show more columns if IHM is enabled and it's a spares template */}
                          {dryRunResult.columns.slice(0, FEATURES.IHM && selectedTemplate?.type === 'spares' ? 5 : 3).map(col => (
                            <TableHead key={col} className={col.toLowerCase().includes('ihm') ? 'text-blue-600' : ''}>
                              {col}
                            </TableHead>
                          ))}
                          <TableHead>Error(s)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dryRunResult.rows.slice(0, 20).map((row) => (
                          <TableRow key={row.row}>
                            <TableCell>{row.row}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  row.status === 'ok' ? 'default' :
                                  row.status === 'warning' ? 'secondary' :
                                  'destructive'
                                }
                                className={
                                  row.status === 'ok' ? 'bg-green-100 text-green-800' :
                                  row.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }
                              >
                                {row.status.toUpperCase()}
                              </Badge>
                            </TableCell>
                            {/* Show more columns if IHM is enabled and it's a spares template */}
                            {dryRunResult.columns.slice(0, FEATURES.IHM && selectedTemplate?.type === 'spares' ? 5 : 3).map(col => (
                              <TableCell key={col} className={`max-w-xs truncate ${col.toLowerCase().includes('ihm') ? 'text-blue-600' : ''}`}>
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

                  {/* Action Buttons */}
                  <div className="flex justify-between">
                    {dryRunResult.errorReportUrl && (
                      <Button variant="outline" asChild>
                        <a href={dryRunResult.errorReportUrl} download>
                          <FileDown className="h-4 w-4 mr-2" />
                          Download Error Report
                        </a>
                      </Button>
                    )}
                    <Button
                      onClick={handleImport}
                      disabled={dryRunResult.summary.errors > 0 || isImporting}
                      className="ml-auto bg-blue-600 hover:bg-blue-700"
                    >
                      {isImporting ? 'Importing...' : 'Import'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Update History */}
              <div>
                <h3 className="font-semibold mb-4">Update History</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead>Skipped</TableHead>
                        {importMode !== 'add' && <TableHead>Archived</TableHead>}
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history?.items?.map((item: ImportHistory) => (
                        <TableRow key={item.id}>
                          <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                          <TableCell>{item.user}</TableCell>
                          <TableCell>{item.mode}</TableCell>
                          <TableCell>{item.created}</TableCell>
                          <TableCell>{item.updated}</TableCell>
                          <TableCell>{item.skipped}</TableCell>
                          {importMode !== 'add' && <TableCell>{item.archived || 0}</TableCell>}
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDownloadHistoryFile(item.id, 'file')}
                              >
                                <FileDown className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!history?.items || history.items.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-gray-500">
                            No import history available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <FileSpreadsheet className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">Select a template from the left to begin</p>
            </Card>
          )}
        </div>
      </div>
      ) : activeTab === 'alerts' ? (
        <Alerts />
      ) : activeTab === 'forms' ? (
        <Forms />
      ) : activeTab === 'admin4' ? (
        <div className="p-6">
          <Card className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Admin 4</h2>
            <p className="text-gray-600">Admin 4 functionality will be implemented here.</p>
          </Card>
        </div>
      ) : null}
    </div>
  );
}