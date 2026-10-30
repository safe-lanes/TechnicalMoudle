import { useAdminUrlState } from "@/hooks/useAdminUrlState";
import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useUIRole } from "@/contexts/UIRoleContext";
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
  FileDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  Info,
  History
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { invalidateAfterBulkImport } from "@/lib/cacheInvalidation";
import ImportProgressOverlay, { useImportStream, type ImportProgressData, type ImportCompleteData } from "@/components/admin/ImportProgressOverlay";
import { LucideIcon } from "lucide-react";
import ImportSummaryModal, { ImportSummaryRow } from "./ImportSummaryModal";
import { isGlobalBulkImportType } from "@shared/bulkImportHistoryScope";
import { useAuth } from "@/contexts/AuthContext";
import { sectionHRequest } from "@/lib/sectionHRequest";
import { classRegulatoryImportFeedback } from "@/lib/classRegulatoryImportFeedback";

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
  totalRows: number;
  errorReportUrl?: string;
}

type StatusFilter = 'all' | 'ok' | 'warning' | 'error';

interface ImportHistory {
  id: string;
  type: string;
  mode: string;
  created: number;
  updated: number;
  skipped: number;
  failed?: number;
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

interface MarkerConfig {
  header: string;
  description: string;
  downloadTemplate: string;
  tabUpload: string;
  tabMapping: string;
  tabHistory: string;
  storeTypeSection?: string;
  storeTypeLabel?: string;
  storeTypeDropdown?: string;
  importModeSection: string;
  importModeLabel: string;
  radioAddOnly: string;
  radioUpdateOnly: string;
  radioUpsert: string;
  uploadSection: string;
  uploadDescription: string;
  dropZone: string;
}

interface UniformBulkUploadProps {
  title: string;
  description: string;
  icon: LucideIcon;
  templateType: 'components' | 'jobs' | 'spares' | 'stores' | 'makers' | 'fleet-components' | 'fleet-jobs' | 'fleet-spares' | 'wo-history' | 'class-regulatory';
  templateFileName: string;
  fieldMappings: FieldMapping[];
  vesselId?: string;
  previewColumns?: string[];
  storeTypes?: StoreTypeOption[];
  historySubTypes?: StoreTypeOption[];
  selectedHistorySubType?: string;
  onHistorySubTypeChange?: (value: string) => void;
  onRefreshData?: () => void;
  markers?: MarkerConfig;
  classRegulatoryReferences?: { societies?: unknown; surveyTypes?: unknown };
  referenceLoading?: boolean;
  referenceError?: boolean;
  onRetryReferences?: () => void;
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
  historySubTypes,
  selectedHistorySubType: selectedHistorySubTypeProp,
  onHistorySubTypeChange,
  onRefreshData,
  markers,
  classRegulatoryReferences,
  referenceLoading,
  referenceError,
  onRetryReferences
}: UniformBulkUploadProps) {
  const { isSailAdmin, isExternal } = useUIRole();
  const { sectionHUser } = useAuth();
  const isClassRegulatory = templateType === "class-regulatory";
  const needsSectionHVessel = isClassRegulatory && !vesselId?.trim();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useAdminUrlState<'add' | 'update' | 'upsert'>(`bulk.${templateType}.mode`, "upsert", ["add", "update", "upsert"]);
  const [selectedStoreType, setSelectedStoreType] = useAdminUrlState<string>(`bulk.${templateType}.storeType`, "", ["", ...(storeTypes || []).map(type => type.value)]);
  const [internalHistorySubType, setInternalHistorySubType] = useState<string>(selectedHistorySubTypeProp ?? 'work-order');
  const selectedHistorySubType = selectedHistorySubTypeProp ?? internalHistorySubType;
  const setSelectedHistorySubType = (value: string) => {
    setInternalHistorySubType(value);
    onHistorySubTypeChange?.(value);
  };

  // Derive the effective import type from templateType + selectedHistorySubType.
  // When the user picks a history sub-type other than 'work-order', the effective type
  // changes so template downloads, dry-runs, imports, and cache keys all target the
  // correct backend handler instead of the default wo-history handler.
  const effectiveType: string = (() => {
    if (templateType === 'wo-history' && selectedHistorySubType === 'spares') return 'spare-history';
    if (templateType === 'wo-history' && selectedHistorySubType === 'stores') return 'store-history';
    return templateType;
  })();

  // Effective template filename matching the effective type
  const effectiveTemplateFileName: string = (() => {
    if (effectiveType === 'spare-history') return 'spare_history_template.xlsx';
    if (effectiveType === 'store-history') return 'store_history_template.xlsx';
    return templateFileName;
  })();
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
  const [activeTab, setActiveTab] = useAdminUrlState<string>(`bulk.${templateType}.tab`, "upload", ["upload", ...((isSailAdmin || isExternal || isClassRegulatory) ? ["mapping"] : []), "history"]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [importSummaryOpen, setImportSummaryOpen] = useState(false);
  const [importSummaryData, setImportSummaryData] = useState<ImportSummaryRow[]>([]);
  const [importCounts, setImportCounts] = useState<{ created: number; updated: number; skipped: number; archived: number }>({ created: 0, updated: 0, skipped: 0, archived: 0 });
  const [importFileName, setImportFileName] = useState<string>('');
  const [sseOverlayVisible, setSseOverlayVisible] = useState(false);
  const [sseProgress, setSseProgress] = useState<ImportProgressData | null>(null);
  const [sseComplete, setSseComplete] = useState<ImportCompleteData | null>(null);
  const [sseError, setSseError] = useState<string | null>(null);
  const { toast } = useToast();
  const { consumeStream } = useImportStream();
  const requestSequence = useRef(0);
  const modeRef = useRef(importMode);
  useEffect(() => () => { requestSequence.current += 1; }, []);
  useEffect(() => {
    if (isClassRegulatory && modeRef.current !== importMode) {
      requestSequence.current += 1;
      setDryRunResult(null);
      setIsUploading(false);
      setIsLoadingSheets(false);
      setExpandedRows(new Set());
      setErrorDialogOpen(false);
      setPartialImportDialogOpen(false);
    }
    modeRef.current = importMode;
  }, [importMode, isClassRegulatory]);
  const changeImportMode = (value: 'add' | 'update' | 'upsert') => {
    if (isClassRegulatory) {
      requestSequence.current += 1;
      setDryRunResult(null);
      setIsUploading(false);
      setIsLoadingSheets(false);
      setExpandedRows(new Set());
      setErrorDialogOpen(false);
      setPartialImportDialogOpen(false);
    }
    setImportMode(value);
  };

  const isGlobalHistory = isGlobalBulkImportType(effectiveType);
  const historyVesselId = isGlobalHistory ? undefined : vesselId?.trim();
  const canLoadHistory = isGlobalHistory || !!historyVesselId;

  const { data: historyData, isLoading: historyLoading, isError: historyError } = useQuery<{items: ImportHistory[], total: number}>({
    queryKey: ['/technical/api/bulk/history', effectiveType, historyVesselId ?? null],
    enabled: canLoadHistory,
    placeholderData: undefined,
    queryFn: async ({ signal }) => {
      if (isClassRegulatory) {
        if (!historyVesselId) return { items: [], total: 0 };
        const params = new URLSearchParams({ type: "class-regulatory", vesselId: historyVesselId });
        const response = await sectionHRequest(sectionHUser, "GET", `/technical/api/bulk/class-regulatory/history?${params}`);
        return response.json();
      }
      const params = new URLSearchParams({ type: effectiveType, limit: '50' });
      if (historyVesselId) params.set('vesselId', historyVesselId);
      const response = await fetch(`/technical/api/bulk/history?${params}`, { signal });
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    }
  });

  const history = canLoadHistory ? historyData?.items || [] : [];

  const handleDownloadTemplate = async () => {
    try {
      const templateUrl = isClassRegulatory
        ? `/technical/api/bulk/class-regulatory/template?vesselId=${encodeURIComponent(vesselId || "")}`
        : vesselId
        ? `/technical/api/bulk/template?type=${effectiveType}&vesselId=${vesselId}`
        : `/technical/api/bulk/template?type=${effectiveType}`;
      const response = isClassRegulatory
        ? await sectionHRequest(sectionHUser, "GET", templateUrl)
        : await fetch(templateUrl);
      if (!response.ok) throw new Error('Failed to download template');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = effectiveTemplateFileName;
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

  const loadSheets = async (file: File, sequence: number) => {
    if (needsSectionHVessel) return;
    setIsLoadingSheets(true);
    setAvailableSheets([]);
    setSelectedSheet('');
    
    const formData = new FormData();
    formData.append('file', file);
    if (isClassRegulatory) {
      formData.append("vesselId", vesselId || "");
      formData.append("type", "class-regulatory");
    }

    try {
      const response = isClassRegulatory
        ? await sectionHRequest(sectionHUser, "POST", "/technical/api/bulk/class-regulatory/sheets", formData)
        : await fetch('/technical/api/bulk/sheets', { method: 'POST', body: formData });

      if (!response.ok) {
        throw new Error('Failed to load sheets');
      }

      const result = await response.json();
      if (isClassRegulatory && sequence !== requestSequence.current) return;
      setAvailableSheets(result.sheets || []);
      
      if (result.sheets && result.sheets.length > 0) {
        setSelectedSheet(result.sheets[0]);
        await handleDryRun(file, result.sheets[0], sequence);
      }
    } catch (error) {
      if (!isClassRegulatory || sequence === requestSequence.current) toast({
        title: 'Error',
        description: isClassRegulatory
          ? classRegulatoryImportFeedback(error, 'The workbook could not be read. Upload a valid, unencrypted Excel file.')
          : 'Failed to read file sheets.',
        variant: 'destructive'
      });
    } finally {
      if (!isClassRegulatory || sequence === requestSequence.current) setIsLoadingSheets(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (needsSectionHVessel) return;
    const file = e.target.files?.[0];
    if (!file) return;
    if (isClassRegulatory) {
      requestSequence.current += 1;
      setDryRunResult(null);
      setSelectedFile(null);
      setAvailableSheets([]);
      setSelectedSheet('');
      setIsUploading(false);
      setIsLoadingSheets(false);
      setErrorDialogOpen(false);
      setPartialImportDialogOpen(false);
    }

    const validTypes = isClassRegulatory ? ['.xls', '.xlsx'] : ['.csv', '.xls', '.xlsx'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      toast({
        title: 'Invalid File',
        description: isClassRegulatory ? 'Please upload an .xls or .xlsx workbook.' : 'Please upload a .xlsx, .xls, or .csv file',
        variant: 'destructive'
      });
      return;
    }

    const sequence = ++requestSequence.current;
    setSelectedFile(file);
    setDryRunResult(null);
    setIsUploading(false);
    setAvailableSheets([]);
    setSelectedSheet('');
    
    if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      await loadSheets(file, sequence);
    } else {
      await handleDryRun(file, '', sequence);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (needsSectionHVessel) return;
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (isClassRegulatory) {
      requestSequence.current += 1;
      setDryRunResult(null);
      setSelectedFile(null);
      setAvailableSheets([]);
      setSelectedSheet('');
      setIsUploading(false);
      setIsLoadingSheets(false);
      setErrorDialogOpen(false);
      setPartialImportDialogOpen(false);
    }

    const validTypes = isClassRegulatory ? ['.xls', '.xlsx'] : ['.csv', '.xls', '.xlsx'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      toast({
        title: 'Invalid File',
        description: isClassRegulatory ? 'Please upload an .xls or .xlsx workbook.' : 'Please upload a .xlsx, .xls, or .csv file',
        variant: 'destructive'
      });
      return;
    }

    const sequence = ++requestSequence.current;
    setSelectedFile(file);
    setDryRunResult(null);
    setIsUploading(false);
    setAvailableSheets([]);
    setSelectedSheet('');
    
    if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      await loadSheets(file, sequence);
    } else {
      await handleDryRun(file, '', sequence);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDryRun = async (file: File, sheetName?: string, sequence = requestSequence.current) => {
    if (needsSectionHVessel) return;
    setIsUploading(true);
    setDryRunResult(null);
    if (isClassRegulatory) {
      setErrorDialogOpen(false);
      setPartialImportDialogOpen(false);
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', effectiveType);
    formData.append('mode', importMode);
    if (isClassRegulatory) formData.append("vesselId", vesselId || "");
    if (vesselId && !isClassRegulatory) {
      formData.append('vesselId', vesselId);
    }
    if (!isClassRegulatory) formData.append('archiveMissing', 'false');
    
    if (sheetName) {
      formData.append('sheetName', sheetName);
    }
    
    if (templateType === 'stores' && selectedStoreType) {
      formData.append('storeType', selectedStoreType);
    }
    if (historySubTypes && selectedHistorySubType) {
      formData.append('historySubType', selectedHistorySubType);
    }

    try {
      const response = isClassRegulatory
        ? await sectionHRequest(sectionHUser, "POST", "/technical/api/bulk/class-regulatory/dry-run", formData)
        : await fetch('/technical/api/bulk/dry-run', { method: 'POST', body: formData });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Validation failed');
      }

      const result = await response.json();
      if (isClassRegulatory && sequence !== requestSequence.current) return;
      setDryRunResult(result);
      setCurrentPage(1);
      setStatusFilter('all');
      setExpandedRows(new Set());

      if (result.summary.errors > 0) {
        if (isClassRegulatory && sequence !== requestSequence.current) return;
        toast({
          title: 'Validation Complete',
          description: `Found ${result.summary.errors} error(s). Review before importing.`,
          variant: 'destructive'
        });
      } else {
        if (isClassRegulatory && sequence !== requestSequence.current) return;
        toast({
          title: 'Validation Complete',
          description: 'File is valid and ready to import.'
        });
      }
    } catch (error: any) {
      if (!isClassRegulatory || sequence === requestSequence.current) toast({
        title: 'Validation Failed',
        description: isClassRegulatory
          ? classRegulatoryImportFeedback(error, 'Failed to validate file')
          : error.message || 'Failed to validate file',
        variant: 'destructive'
      });
    } finally {
      if (!isClassRegulatory || sequence === requestSequence.current) setIsUploading(false);
    }
  };

  const handleCloseOverlay = useCallback(() => {
    setSseOverlayVisible(false);
    setSseProgress(null);
    setSseComplete(null);
    setSseError(null);
  }, []);

  const handleImport = async (skipErrors: boolean = false) => {
    if (!dryRunResult || needsSectionHVessel) return;

    setIsImporting(true);

    const rowIndices = skipErrors
      ? dryRunResult.rows
          .filter(row => row.status === 'ok' || row.status === 'warning')
          .map(row => row.row)
      : undefined;

    const requestBody: any = {
      fileToken: dryRunResult.fileToken,
      type: effectiveType,
      mode: importMode,
      vesselId: vesselId,
      archiveMissing: false,
      rowIndices
    };

    if (templateType === 'stores' && selectedStoreType) {
      requestBody.storeType = selectedStoreType;
    }
    if (historySubTypes && selectedHistorySubType) {
      requestBody.historySubType = selectedHistorySubType;
    }

    setSseProgress(null);
    setSseComplete(null);
    setSseError(null);
    setSseOverlayVisible(true);

    try {
      const streamUrl = isClassRegulatory
        ? "/technical/api/bulk/class-regulatory/import-stream"
        : "/technical/api/bulk/import-stream";
      await consumeStream(
        streamUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        },
        {
          onProgress: (data) => setSseProgress(data),
          onComplete: (result) => {
            setSseComplete(result);

            toast({
              title: isClassRegulatory && (result.failed ?? 0) > 0 ? 'Import completed with errors' : 'Import Successful',
              description: `Created: ${result.created}, Updated: ${result.updated}, Skipped: ${result.skipped}${isClassRegulatory ? `, Failed: ${result.failed || 0}` : ''}`,
              variant: isClassRegulatory && (result.failed ?? 0) > 0 ? 'destructive' : 'default',
            });

            const summaryRows: ImportSummaryRow[] = buildImportSummary(result, dryRunResult, skipErrors);
            setImportCounts({
              created: result.created || 0,
              updated: result.updated || 0,
              skipped: result.skipped || 0,
              archived: result.archived || 0,
            });
            setImportSummaryData(summaryRows);
            setImportFileName(selectedFile?.name || 'import');

            setPartialImportDialogOpen(false);

            queryClient.invalidateQueries({ queryKey: ['/technical/api/bulk/history', effectiveType] });
            if (isClassRegulatory) {
              queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet-admin/import-history'] });
            }
            invalidateAfterBulkImport(effectiveType, vesselId);

            if (onRefreshData) {
              onRefreshData();
            }

            setIsImporting(false);
          },
          onError: (message) => {
            setSseError(message);
            toast({
              title: 'Import Failed',
              description: message || 'Failed to import data',
              variant: 'destructive'
            });
            setIsImporting(false);
          },
          ...(isClassRegulatory ? {
            fetcher: (url: string, options?: RequestInit) => {
              const method = options?.method || "GET";
              let data: unknown;
              if (typeof options?.body === "string") {
                try { data = JSON.parse(options.body); } catch { data = options.body; }
              } else {
                data = options?.body;
              }
              return sectionHRequest(sectionHUser, method, url, data);
            },
            statusUrl: (historyId: string) => `/technical/api/bulk/class-regulatory/import-status/${encodeURIComponent(historyId)}`,
          } : {}),
        }
      );
    } catch (error: any) {
      setSseError(error.message || 'Failed to import data');
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import data',
        variant: 'destructive'
      });
      setIsImporting(false);
    }
  };

  const buildImportSummary = (
    importResult: any,
    dryRun: DryRunResult | null,
    wasPartial: boolean
  ): ImportSummaryRow[] => {
    const rows: ImportSummaryRow[] = [];
    const primaryCol = (previewColumns && previewColumns[0]) || (dryRun?.columns?.[0] ?? '');

    if (importResult.rowResults && Array.isArray(importResult.rowResults) && importResult.rowResults.length > 0) {
      for (const rr of importResult.rowResults) {
        const dryRunRow = dryRun?.rows.find(r => r.row === rr.rowNumber);
        rows.push({
          rowNumber: rr.rowNumber,
          primaryIdentifier: rr.primaryIdentifier || '',
          status: rr.action === 'created' || rr.action === 'updated' || rr.action === 'linked' ? 'success'
            : rr.action === 'failed' ? 'failed'
            : 'skipped',
          error: rr.error || rr.info || undefined,
          data: dryRunRow?.normalized,
        });
      }
    } else if (dryRun) {
      const failedRows = new Map<number, string>(isClassRegulatory && Array.isArray(importResult.errors)
        ? importResult.errors.filter((error: any) => typeof error?.row === "number")
            .map((error: any) => [error.row, error.message] as [number, string]) : []);
      for (const dr of dryRun.rows) {
        if (dr.status === 'ok' || dr.status === 'warning') {
          rows.push({
            rowNumber: dr.row,
            primaryIdentifier: dr.normalized?.[primaryCol] || '',
            status: failedRows.has(dr.row) ? 'failed' : isClassRegulatory && dr.normalized?.action === "skip" ? 'skipped' : 'success',
            error: failedRows.get(dr.row) || (dr.status === 'warning' ? dr.errors.join('; ') : undefined),
            data: dr.normalized,
          });
        }
      }
    }

    if (wasPartial && dryRun) {
      const processedRowNums = new Set(rows.map(r => r.rowNumber));
      for (const dr of dryRun.rows) {
        if (dr.status === 'error' && !processedRowNums.has(dr.row)) {
          rows.push({
            rowNumber: dr.row,
            primaryIdentifier: dr.normalized?.[primaryCol] || '',
            status: 'failed',
            error: dr.errors.join('; '),
            data: dr.normalized,
          });
        }
      }
    }

    rows.sort((a, b) => a.rowNumber - b.rowNumber);
    return rows;
  };

  const handleSummaryClose = () => {
    setImportSummaryOpen(false);
    setImportSummaryData([]);
    setImportCounts({ created: 0, updated: 0, skipped: 0, archived: 0 });
    setImportFileName('');
    setSelectedFile(null);
    setDryRunResult(null);
    setAvailableSheets([]);
    setSelectedSheet('');
    if (templateType === 'stores') {
      setSelectedStoreType('');
    }
  };

  const getErrorRows = () => {
    if (!dryRunResult) return [];
    return dryRunResult.rows.filter(row => row.status === 'error');
  };

  const getValidRowsCount = () => {
    if (!dryRunResult) return 0;
    // summary.ok already includes rows with warnings (they're importable)
    // Don't add summary.warnings again - that would double-count
    return dryRunResult.summary.ok;
  };

  const getFilteredRows = () => {
    if (!dryRunResult) return [];
    if (statusFilter === 'all') return dryRunResult.rows;
    return dryRunResult.rows.filter(row => row.status === statusFilter);
  };

  const getPaginatedRows = () => {
    const filtered = getFilteredRows();
    const startIndex = (currentPage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  };

  const getTotalPages = () => {
    const filtered = getFilteredRows();
    return Math.ceil(filtered.length / pageSize);
  };

  const handleStatusFilterClick = (filter: StatusFilter) => {
    setStatusFilter(prev => prev === filter ? 'all' : filter);
    setCurrentPage(1);
  };

  const toggleRowExpansion = (rowNumber: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  };

  const handlePageSizeChange = (newSize: string) => {
    setPageSize(Number(newSize));
    setCurrentPage(1);
  };

  const handleUndoClick = (historyId: string) => {
    setSelectedHistoryId(historyId);
    setUndoDialogOpen(true);
  };

  const handleUndo = async () => {
    if (!selectedHistoryId) return;
    
    setIsUndoing(true);
    
    try {
      const response = await fetch(`/technical/api/bulk/undo/${selectedHistoryId}`, {
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
      
      queryClient.invalidateQueries({ queryKey: ['/technical/api/bulk/history', effectiveType] });
      
      // Invalidate domain-specific caches after undo
      invalidateAfterBulkImport(effectiveType, vesselId);
      
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

  const downloadSectionHReport = async (url: string, filename: string) => {
    try {
      const response = await sectionHRequest(sectionHUser, "GET", url);
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(await response.blob());
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error: any) {
      toast({ title: "Report download failed", description: error.message, variant: "destructive" });
    }
  };

  const handleDownloadOriginalFile = async (historyId: string, fileName?: string) => {
    try {
      const response = isClassRegulatory
        ? await sectionHRequest(sectionHUser, "GET", `/technical/api/bulk/class-regulatory/history/${encodeURIComponent(historyId)}/download-original`)
        : await fetch(`/technical/api/bulk/history/${historyId}/download-original`);
      
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
  const isHistoryComingSoon = historySubTypes !== undefined && selectedHistorySubType !== 'work-order' && selectedHistorySubType !== 'spares' && selectedHistorySubType !== 'stores';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-100 rounded-lg">
            <Icon className="h-6 w-6 text-sky-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid={markers?.header || "bulk-upload-header"}>
              {title}
            </h1>
            {(isSailAdmin || isExternal) && (
              <p className="text-gray-600" data-testid={markers?.description || "bulk-upload-description"}>
                {description}
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={handleDownloadTemplate} data-testid={markers?.downloadTemplate || "button-download-template"}>
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${(isSailAdmin || isExternal || isClassRegulatory) ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="upload" data-testid={markers?.tabUpload || "tab-upload"}>
            Upload
          </TabsTrigger>
          {(isSailAdmin || isExternal || isClassRegulatory) && (
            <TabsTrigger value="mapping" data-testid={markers?.tabMapping || "tab-mapping"}>
              Field Mapping Guide
            </TabsTrigger>
          )}
          <TabsTrigger value="history" data-testid={markers?.tabHistory || "tab-history"}>
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6 pt-4">
          {isClassRegulatory && (
            <Card className="border-sky-200 bg-sky-50/70">
              <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-sky-950">Vessel-scoped Section H workbook</p>
                  <p className="text-sm text-sky-800">Use the selected vessel’s actual Vessel Code. Blank optional update cells preserve existing values. No attachment files are accepted.</p>
                  <p className="text-xs text-sky-700 mt-1">
                    {referenceLoading
                      ? "Loading Classification Society and Survey Type reference lists…"
                      : referenceError
                        ? "Reference list preview is unavailable; validation still checks active master values."
                        : classRegulatoryReferences
                          ? "Master reference data is available for this import."
                          : "Master values are validated against active Section H reference lists."}
                  </p>
                </div>
                {referenceError && onRetryReferences && (
                  <Button variant="outline" size="sm" onClick={onRetryReferences}>Retry reference lists</Button>
                )}
              </CardContent>
            </Card>
          )}
          {storeTypes && (
            <Card data-testid={markers?.storeTypeSection || "store-type-section"}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base" data-testid={markers?.storeTypeLabel || "store-type-label"}>
                  Store Type <span className="text-red-500">*</span>
                </CardTitle>
                <CardDescription>Select which tab this data belongs to (required)</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedStoreType} onValueChange={setSelectedStoreType}>
                  <SelectTrigger className="w-64" data-testid={markers?.storeTypeDropdown || "select-store-type"}>
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
          {historySubTypes && (
            <Card data-testid="history-type-section">
              <CardHeader className="pb-3">
                <CardTitle className="text-base" data-testid="history-type-label">
                  History Type <span className="text-red-500">*</span>
                </CardTitle>
                <CardDescription>Select the type of historical data to import</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedHistorySubType} onValueChange={setSelectedHistorySubType}>
                  <SelectTrigger className="w-64" data-testid="select-history-type">
                    <SelectValue placeholder="Select history type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {historySubTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {isHistoryComingSoon && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <History className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-500 mb-2">Coming Soon</h3>
                <p className="text-sm text-gray-400 text-center max-w-sm">
                  Historical import for this type is not yet available. Please select <strong>Work Order</strong> to import WO history.
                </p>
              </CardContent>
            </Card>
          )}

          <Card className={`${isStoresAndNoType ? 'opacity-50 pointer-events-none' : ''} ${isHistoryComingSoon ? 'hidden' : ''}`} data-testid={markers?.importModeSection || "import-mode-section"}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Import Mode</CardTitle>
              <CardDescription data-testid={markers?.importModeLabel || "import-mode-label"}>
                Choose how to handle existing records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={importMode} 
                onValueChange={(value) => changeImportMode(value as 'add' | 'update' | 'upsert')}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3" data-testid={markers?.radioAddOnly || "radio-add-only"}>
                  <RadioGroupItem value="add" id="mode-add" className="mt-1" disabled={isImporting} />
                  <Label htmlFor="mode-add" className="font-normal cursor-pointer">
                    <div className="font-medium">Add Only</div>
                    <div className="text-sm text-gray-500">Only create new records, skip existing ones</div>
                  </Label>
                </div>
                <div className="flex items-start space-x-3" data-testid={markers?.radioUpdateOnly || "radio-update-only"}>
                  <RadioGroupItem value="update" id="mode-update" className="mt-1" disabled={isImporting} />
                  <Label htmlFor="mode-update" className="font-normal cursor-pointer">
                    <div className="font-medium">Update Only</div>
                    <div className="text-sm text-gray-500">Only update existing records, skip new ones</div>
                  </Label>
                </div>
                <div className="flex items-start space-x-3" data-testid={markers?.radioUpsert || "radio-upsert"}>
                  <RadioGroupItem value="upsert" id="mode-upsert" className="mt-1" disabled={isImporting} />
                  <Label htmlFor="mode-upsert" className="font-normal cursor-pointer">
                    <div className="font-medium">Add + Update (Recommended)</div>
                    <div className="text-sm text-gray-500">Create new records and update existing ones</div>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <Card className={`${isStoresAndNoType ? 'opacity-50 pointer-events-none' : ''} ${isHistoryComingSoon ? 'hidden' : ''}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base" data-testid={markers?.uploadSection || "upload-section"}>
                Upload File
              </CardTitle>
              <CardDescription data-testid={markers?.uploadDescription || "upload-description"}>
                {isClassRegulatory ? "Upload Excel (.xls or .xlsx) files containing Classification & Regulatory Data" : `Upload CSV, XLS, or XLSX files containing ${templateType} data`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {needsSectionHVessel && (
                <div role="status" className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900" data-testid="class-regulatory-vessel-required">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Choose a vessel above before uploading, validating or importing data. You can download the template and review the Field Mapping Guide now.</span>
                </div>
              )}
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-sky-400 transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => document.getElementById(`file-upload-${templateType}`)?.click()}
                data-testid={markers?.dropZone || "drop-zone"}
              >
                <input
                  type="file"
                  accept={isClassRegulatory ? ".xls,.xlsx" : ".csv,.xls,.xlsx"}
                  onChange={handleFileSelect}
                  className="hidden"
                  id={`file-upload-${templateType}`}
                  disabled={isUploading || isImporting || isStoresAndNoType || needsSectionHVessel}
                  data-testid="input-file-upload"
                />
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <span className="text-sm font-medium text-gray-700">
                  Click to upload or drag and drop
                </span>
                <span className="block text-xs text-gray-500 mt-1">
                  {isClassRegulatory ? "Excel workbook only: XLS or XLSX (max 20MB)" : "CSV, XLS, or XLSX (max 20MB)"}
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
                    <Select value={selectedSheet} onValueChange={(sheet) => {
                      if (isClassRegulatory) {
                        requestSequence.current += 1;
                        setDryRunResult(null);
                        setIsUploading(false);
                        setErrorDialogOpen(false);
                        setPartialImportDialogOpen(false);
                      }
                      setSelectedSheet(sheet);
                    }}>
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
                      disabled={!selectedSheet || isUploading || needsSectionHVessel}
                      data-testid="button-revalidate"
                    >
                      {isUploading ? 'Validating...' : 'Re-validate'}
                    </Button>
                  </div>
                </div>
              )}

              {isClassRegulatory && selectedFile && availableSheets.length <= 1 && !isLoadingSheets && !isUploading && !dryRunResult && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleDryRun(selectedFile, selectedSheet || undefined, requestSequence.current)}
                  disabled={needsSectionHVessel}
                  data-testid="button-validate-class-regulatory"
                >
                  Validate workbook
                </Button>
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
                  
                  <div className="flex gap-3 flex-wrap items-center">
                    <span className="text-sm text-gray-500">Filter by:</span>
                    <Badge 
                      variant="outline" 
                      className={`px-3 py-1.5 cursor-pointer transition-all hover:shadow-md ${
                        statusFilter === 'ok' 
                          ? 'ring-2 ring-green-500 bg-green-50' 
                          : 'hover:bg-green-50'
                      }`}
                      onClick={() => handleStatusFilterClick('ok')}
                      data-testid="filter-valid"
                    >
                      <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                      Valid: {dryRunResult.summary.ok}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`px-3 py-1.5 cursor-pointer transition-all hover:shadow-md ${
                        statusFilter === 'warning' 
                          ? 'ring-2 ring-yellow-500 bg-yellow-50' 
                          : 'hover:bg-yellow-50'
                      }`}
                      onClick={() => handleStatusFilterClick('warning')}
                      data-testid="filter-warnings"
                    >
                      <AlertTriangle className="h-4 w-4 mr-1 text-yellow-600" />
                      Warnings: {dryRunResult.summary.warnings}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`px-3 py-1.5 cursor-pointer transition-all hover:shadow-md ${
                        statusFilter === 'error' 
                          ? 'ring-2 ring-red-500 bg-red-50' 
                          : 'hover:bg-red-50'
                      }`}
                      onClick={() => handleStatusFilterClick('error')}
                      data-testid="filter-errors"
                    >
                      <AlertCircle className="h-4 w-4 mr-1 text-red-600" />
                      Errors: {dryRunResult.summary.errors}
                    </Badge>
                    <Badge variant="outline" className="px-3 py-1.5">
                      Total Rows: {dryRunResult.totalRows || dryRunResult.rows.length}
                    </Badge>
                    {statusFilter !== 'all' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStatusFilter('all')}
                        className="text-xs"
                        data-testid="button-clear-filter"
                      >
                        Clear Filter
                      </Button>
                    )}
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-gray-50 z-10">
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead className="w-16">Row</TableHead>
                            <TableHead className="w-24">Status</TableHead>
                            {(previewColumns || dryRunResult.columns.slice(0, 3)).map(col => (
                              <TableHead key={col}>{col}</TableHead>
                            ))}
                            <TableHead>Issues</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getPaginatedRows().map((row) => (
                            <>
                              <TableRow 
                                key={row.row} 
                                className={`${row.errors.length > 0 ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                                onClick={() => row.errors.length > 0 && toggleRowExpansion(row.row)}
                              >
                                <TableCell className="w-12">
                                  {row.errors.length > 0 && (
                                    <button className="p-1 hover:bg-gray-200 rounded" data-testid={`expand-row-${row.row}`}>
                                      {expandedRows.has(row.row) ? (
                                        <ChevronUp className="h-4 w-4 text-gray-500" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 text-gray-500" />
                                      )}
                                    </button>
                                  )}
                                </TableCell>
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
                                <TableCell>
                                  {row.errors.length > 0 ? (
                                    <div className="flex items-center gap-1 text-sm">
                                      <Info className={`h-4 w-4 ${row.status === 'error' ? 'text-red-500' : 'text-yellow-500'}`} />
                                      <span className={row.status === 'error' ? 'text-red-600' : 'text-yellow-600'}>
                                        {row.errors.length} issue{row.errors.length > 1 ? 's' : ''} - click to expand
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-green-600 text-sm">No issues</span>
                                  )}
                                </TableCell>
                              </TableRow>
                              {expandedRows.has(row.row) && row.errors.length > 0 && (
                                <TableRow key={`${row.row}-details`} className="bg-gray-50">
                                  <TableCell colSpan={5 + (previewColumns || dryRunResult.columns.slice(0, 3)).length} className="py-3">
                                    <div className="px-4">
                                      <div className="text-sm font-medium text-gray-700 mb-2">Row {row.row} Issues:</div>
                                      <ul className="space-y-1">
                                        {row.errors.map((error, idx) => (
                                          <li key={idx} className={`text-sm flex items-start gap-2 ${row.status === 'error' ? 'text-red-600' : 'text-yellow-600'}`}>
                                            {row.status === 'error' ? (
                                              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                            ) : (
                                              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                            )}
                                            {error}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Rows per page:</span>
                        <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                          <SelectTrigger className="w-20 h-8" data-testid="select-page-size">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-gray-500 ml-2">
                          Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, getFilteredRows().length)} of {getFilteredRows().length}
                          {statusFilter !== 'all' && ` (filtered from ${dryRunResult.rows.length})`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          data-testid="button-first-page"
                        >
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="px-3 py-1 text-sm">
                          Page {currentPage} of {getTotalPages() || 1}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(getTotalPages(), p + 1))}
                          disabled={currentPage >= getTotalPages()}
                          data-testid="button-next-page"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(getTotalPages())}
                          disabled={currentPage >= getTotalPages()}
                          data-testid="button-last-page"
                        >
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {dryRunResult.summary.errors === 0 ? (
                    <Button 
                      onClick={() => handleImport(false)} 
                      disabled={isImporting || dryRunResult.summary.ok === 0 || needsSectionHVessel}
                      className="w-full bg-sky-600 hover:bg-sky-700"
                      data-testid="button-import"
                    >
                      {isImporting ? 'Importing...' : `Import ${dryRunResult.summary.ok} Records`}
                    </Button>
                  ) : (
                    <div className="flex gap-3">
                      <Button 
                        onClick={() => setPartialImportDialogOpen(true)}
                        disabled={isImporting || getValidRowsCount() === 0 || needsSectionHVessel}
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

        {(isSailAdmin || isExternal || isClassRegulatory) && (
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
                {isClassRegulatory && (
                  <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                    <p className="font-semibold">Workbook notes</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li>Use the exact A–J headers. Component Code and Vessel Code must resolve to the selected vessel.</li>
                      <li>Dates accept DD-MM-YYYY text or actual Excel date cells; alternate date strings are not accepted.</li>
                      <li>Certificate Number is trimmed at the ends only; case and internal characters are preserved.</li>
                      <li>Blank optional cells on updates preserve existing values, including master references and the derived Class Code.</li>
                      <li>Classification Society and Survey Type must match active master entries; missing master data is never created by this import.</li>
                      <li>The workbook contains data only. Supporting document attachments are neither uploaded nor changed.</li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="history" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Import History</CardTitle>
                  <CardDescription>
                  {isClassRegulatory ? "View past vessel-specific imports. Undo is not available for this import type." : "View past imports and undo if needed"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!canLoadHistory ? (
                <div className="text-center py-8 text-gray-500">
                  Select a vessel to view import history.
                </div>
              ) : historyError ? (
                <div role="alert" className="text-center py-8 text-red-600">
                  Unable to load import history. Please try again.
                </div>
              ) : historyLoading ? (
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
                        {isClassRegulatory && <TableHead className="text-right">Failed</TableHead>}
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
                          {isClassRegulatory && <TableCell className="text-right text-red-600">{h.failed || 0}</TableCell>}
                          <TableCell>
                            <Badge variant={h.status === 'complete' ? 'default' : h.status === 'undone' ? 'secondary' : 'destructive'}>
                              {h.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {isClassRegulatory && (
                                <Button variant="ghost" size="sm" title="Download error report"
                                  onClick={() => downloadSectionHReport(`/technical/api/bulk/class-regulatory/history/${encodeURIComponent(h.id)}/error-report`, "class_regulatory_errors.xlsx")}>
                                  <FileWarning className="h-4 w-4" />
                                </Button>
                              )}
                              {h.status === 'complete' && !isClassRegulatory && (
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
                              {(h.storedFilePath || isClassRegulatory) && (
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
                              {isClassRegulatory && (
                                <span className="px-2 text-xs text-muted-foreground">Undo unavailable</span>
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
            {isClassRegulatory && dryRunResult?.errorReportUrl && (
              <Button variant="outline" size="sm"
                onClick={() => downloadSectionHReport(dryRunResult.errorReportUrl!, "class_regulatory_validation_errors.xlsx")}>
                <Download className="h-4 w-4 mr-2" />Download error report
              </Button>
            )}
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

      <ImportSummaryModal
        open={importSummaryOpen}
        onClose={handleSummaryClose}
        summaryData={importSummaryData}
        importCounts={importCounts}
        templateType={templateType}
        previewColumns={previewColumns}
        fileName={importFileName}
      />

      <ImportProgressOverlay
        visible={sseOverlayVisible}
        progress={sseProgress}
        complete={sseComplete}
        error={sseError}
        onClose={() => {
          handleCloseOverlay();
          if (sseComplete) {
            setImportSummaryOpen(true);
          }
        }}
        entityLabel={templateType.replace(/-/g, ' ')}
      />
    </div>
  );
}
