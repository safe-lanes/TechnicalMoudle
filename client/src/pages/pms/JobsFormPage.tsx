import { useState, useEffect, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, ArrowLeft, Menu, AlertTriangle, Save, X, Pencil, Trash2, Loader2, FileSpreadsheet, ChevronDown, Clock } from "lucide-react";
import { normalizeDateToDDMMMYYYY, formatRelativeTime, formatRHWithSeparators } from "@shared/dateUtils";
import { PeriodPicker } from "@/components/filters/PeriodPicker";
import type { PeriodValue } from "@/components/filters/PeriodPicker";
import { Marker } from "@/components/Marker";
import sailLogo from "@assets/SAIL logo Transparent_1753957135582.png";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import WorkInstructionsDialog from "@/components/WorkInstructionsDialog";
import { SectionBlock } from "@/components/SectionBlock";
import { PartHeader } from "@/components/PartHeader";
import { StatusPill } from "@/components/StatusPill";
import { useToast } from "@/hooks/use-toast";
import { useRanks, ensureRankInOptions, getRankLabel } from "@/hooks/useRanks";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useVessel } from "@/contexts/VesselContext";
import { useAuth } from "@/contexts/AuthContext";
import { useResolvedUserName } from "@/hooks/useResolvedUserName";
import { useSyncInstanceInfo } from "@/hooks/useSyncInstanceInfo";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useVessels } from "@/hooks/useVessels";

const ReadOnlyField: React.FC<{ label: string; value: string | undefined; labelMarker?: string; valueMarker?: string; type?: "text" | "textarea"; displayValue?: string }> = ({ label, value, labelMarker, valueMarker, type = "text", displayValue }) => (
  <div className="space-y-2">
    <Label className="text-sm text-[#8798ad]" data-testid={labelMarker}>
      {labelMarker && <Marker id={labelMarker} />}
      {label}
    </Label>
    {type === "textarea" ? (
      <div className="relative" data-testid={valueMarker}>
        {valueMarker && <Marker id={valueMarker} />}
        <Textarea disabled value={displayValue ?? value ?? '-'} className="text-sm font-medium text-gray-900 bg-gray-50 disabled:opacity-100 disabled:cursor-default min-h-[80px]" rows={3} />
      </div>
    ) : (
      <div className="relative" data-testid={valueMarker}>
        {valueMarker && <Marker id={valueMarker} />}
        <Input disabled value={displayValue ?? value ?? '-'} className="text-sm font-medium text-gray-900 bg-gray-50 disabled:opacity-100 disabled:cursor-default" />
      </div>
    )}
  </div>
);

interface EditableFieldProps {
  label: string;
  field: string;
  value: string | undefined;
  originalValue: string | undefined;
  onChange: (field: string, value: string) => void;
  isModifyMode: boolean;
  isEditMode?: boolean;
  type?: "text" | "select" | "textarea";
  options?: Array<string | { value: string; label: string }>;
  labelMarker?: string;
  valueMarker?: string;
  displayValue?: string;
}

const EditableField: React.FC<EditableFieldProps> = ({ 
  label, 
  field,
  value, 
  originalValue,
  onChange, 
  isModifyMode,
  isEditMode = false,
  type = "text",
  options = [],
  labelMarker,
  valueMarker,
  displayValue
}) => {
  const isChanged = value !== originalValue;
  const canEdit = isModifyMode || isEditMode;
  
  if (!canEdit) {
    return <ReadOnlyField label={label} value={value} labelMarker={labelMarker} valueMarker={valueMarker} type={type} displayValue={displayValue} />;
  }
  
  return (
    <div className="space-y-2">
      <Label className={`text-sm ${isChanged && isModifyMode ? 'text-red-600 font-semibold' : 'text-[#8798ad]'}`} data-testid={labelMarker}>
        {labelMarker && <Marker id={labelMarker} />}
        {label} {isChanged && isModifyMode && '(Modified)'}
      </Label>
      {type === "select" ? (
        <Select value={value || ''} onValueChange={(val) => onChange(field, val)}>
          <SelectTrigger className={`text-sm ${isChanged && isModifyMode ? 'border-red-500 bg-red-50' : ''}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(opt => {
              const o = typeof opt === 'string' ? { value: opt, label: opt } : opt;
              return <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      ) : type === "textarea" ? (
        <Textarea
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className={`text-sm ${isChanged && isModifyMode ? 'border-red-500 bg-red-50 text-red-700' : ''}`}
          rows={3}
        />
      ) : (
        <Input
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className={`text-sm ${isChanged && isModifyMode ? 'border-red-500 bg-red-50 text-red-700' : ''}`}
        />
      )}
      {isChanged && isModifyMode && (
        <p className="text-xs text-gray-500">Original: {originalValue || '-'}</p>
      )}
    </div>
  );
};

const JobsFormPage: React.FC = () => {
  const [location, navigate] = useLocation();
  const [, params] = useRoute("/pms/job/:id");
  const jobId = params?.id;
  const { toast } = useToast();
  const { vesselId } = useVessel();
  const { isVessel, isHeadOfDept, isSailAdmin, isClientAdmin } = useUIRole();
  const { vessels } = useVessels();
  
  const { ranks: rankOptions } = useRanks();
  const [isWorkInstructionsOpen, setIsWorkInstructionsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRebaselineConfirm, setShowRebaselineConfirm] = useState(false);
  // Rebaseline is a SHORE-admin escape hatch: it authorizes this job's office-side
  // cycle values (last done / next due) to overwrite the ship's protected tracking
  // columns on the next sync. Shore instance + Sail Admin/Super Admin only.
  const { hasRole } = useAuth();
  const { resolvedUserName } = useResolvedUserName();
  const { isShore } = useSyncInstanceInfo();
  const canRebaseline = isShore && hasRole(["Sail Admin", "Super Admin"] as any);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const navSteps = [{ id: 'part-a', label: 'A', title: 'Job Details' }];
  const [activeStep, setActiveStep] = useState('part-a');

  const urlParams = new URLSearchParams(window.location.search);
  const isModifyMode = urlParams.get('modify') === '1';
  // activeComponentCode from URL allows the job to be viewed in context of a specific component
  // This is crucial for multi-linked jobs where the same job can be accessed from different components
  const activeComponentCode = urlParams.get('activeComponentCode') || '';

  const { data: jobContext, isLoading, isError } = useQuery({
    queryKey: [`/technical/api/jobs/${jobId}/context`],
    enabled: !!jobId
  });

  // D3 validation: read rhCounterType directly from jobContext (no second HTTP fetch needed)
  const componentRhCounterType = ((jobContext as any)?.component?.rhCounterType || '').toUpperCase();

  const [, setLocation] = useLocation();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/technical/api/jobs/${jobId}`);
    },
    onSuccess: () => {
      toast({ title: "Job Deleted", description: "The Job has been removed from normal Job views." });
      queryClient.invalidateQueries({ predicate: (query) =>
        typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/technical/api/jobs')
      });
      setShowDeleteConfirm(false);
      setLocation('/pms/components');
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete job", variant: "destructive" });
      setShowDeleteConfirm(false);
    }
  });
  
  const rebaselineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/technical/api/jobs/${jobId}/rebaseline-tracking`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rebaseline authorized",
        description: "This job's office cycle values will overwrite the ship's tracking on the next sync.",
      });
      queryClient.invalidateQueries({ predicate: (query) =>
        typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/technical/api/jobs')
      });
      setShowRebaselineConfirm(false);
    },
    onError: (error: any) => {
      toast({ title: "Rebaseline failed", description: error.message || "Could not rebaseline job tracking", variant: "destructive" });
      setShowRebaselineConfirm(false);
    }
  });

  const [originalData, setOriginalData] = useState<Record<string, any>>({});

  const [templateData, setTemplateData] = useState({
    woTitle: "",
    component: "",
    componentName: "",
    componentCode: "",
    woTemplateCode: "",
    maintenanceBasis: "Calendar",
    frequencyValue: "",
    frequencyUnit: "Months",
    intervalRunningHour: "",
    taskType: "Inspection",
    assignedTo: "",
    approver: "",
    level2ReviewerRankId: "",
    jobPriority: "Medium",
    classRelated: "No",
    department: "",
    criticality: "",
    isActive: "Yes",
    briefWorkDescription: "",
    nextDueDate: "",
    nextDueReading: "",
    requiredSpareParts: [] as Array<{partNo: string, description: string, quantityRequired: string, remarks: string}>,
    requiredTools: [] as Array<{toolName: string, quantity: string, remarks: string}>,
    safetyRequirements: {
      ppeRequirements: [] as string[],
      permitRequirements: [] as string[],
      otherRequirements: [] as string[]
    },
    workHistory: [] as Array<{woNo: string, assignedTo: string, performedBy: string, workDate: string, runDate: string, completionDate: string, status: string, description: string, remarks: string}>
  });

  useEffect(() => {
    if (jobContext) {
      const context = jobContext as any;
      if (context.templateData) {
        const basis = context.templateData.maintenanceBasis;
        const isRunningHours = basis === 'Running Hours';
        const isDualFrequency = basis === 'Dual Frequency';
        let normalizedFrequencyUnit = context.templateData.frequencyUnit;

        if (isRunningHours) {
          normalizedFrequencyUnit = 'Hours';
        } else if (!normalizedFrequencyUnit || normalizedFrequencyUnit === 'Hours') {
          normalizedFrequencyUnit = 'Months';
        }

        // Keep the calendar and RH legs in their canonical fields.
        // The frequencyValue fallback supports legacy RH jobs that predate intervalRunningHour.
        const frequencyValue = context.templateData.frequencyValue || '';
        const intervalRunningHour = (isRunningHours || isDualFrequency)
          ? (context.templateData.intervalRunningHour || (isRunningHours ? context.templateData.frequencyValue : '') || '')
          : '';
        
        // IMPORTANT: Use activeComponentCode from URL if provided (for multi-linked jobs),
        // otherwise fall back to the job's stored componentCode
        // This ensures clicking a job from component X always binds to component X
        const effectiveComponentCode = activeComponentCode || context.templateData.componentCode || context.templateData.sfiCode || '';
        
        const newTemplateData = {
          ...context.templateData,
          woTitle: context.templateData.woTitle || context.templateData.jobTitle || '',
          woTemplateCode: context.templateData.jobNo || context.templateData.woTemplateCode || '',
          componentName: context.templateData.componentName || '',
          componentCode: effectiveComponentCode,
          frequencyValue: String(frequencyValue),
          frequencyUnit: normalizedFrequencyUnit,
          intervalRunningHour: String(intervalRunningHour),
          taskType: context.templateData.maintenanceType || context.templateData.taskType || 'Inspection',
          nextDueReading: context.templateData.nextDueRH || '',
          briefWorkDescription: context.templateData.briefWorkDescription || context.templateData.jobDescription || '',
          level2ReviewerRankId: context.templateData.level2ReviewerRankId || ''
        };
        
        setTemplateData(prev => ({
          ...prev,
          ...newTemplateData
        }));
        
        setOriginalData(newTemplateData);
      }
    }
  }, [jobContext, activeComponentCode]);

  const handleFieldChange = (field: string, value: string) => {
    setTemplateData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getChangedFields = (): string[] => {
    const changedFields: string[] = [];
    const fieldsToCheck = ['woTitle', 'woTemplateCode', 'assignedTo', 'approver', 'level2ReviewerRankId', 'jobPriority', 'classRelated', 'briefWorkDescription', 'frequencyValue', 'frequencyUnit', 'intervalRunningHour', 'maintenanceBasis', 'taskType', 'isActive', 'department', 'criticality'];
    
    for (const field of fieldsToCheck) {
      if (templateData[field as keyof typeof templateData] !== originalData[field]) {
        changedFields.push(field);
      }
    }
    return changedFields;
  };

  const handleSaveForApproval = async () => {
    if (templateData.maintenanceBasis === 'Running Hours') {
      const intervalRH = Number(templateData.intervalRunningHour);
      if (!Number.isInteger(intervalRH) || intervalRH <= 0) {
        toast({
          title: "Validation Error",
          description: "Frequency (Hours) must be a whole number greater than 0.",
          variant: "destructive"
        });
        return;
      }
    }

    const changedFields = getChangedFields();
    
    if (changedFields.length === 0) {
      toast({
        title: "No changes detected",
        description: "Please make some changes before submitting for approval.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Build the proposed changes array
      const proposedChanges = changedFields.map(field => ({
        field,
        oldValue: originalData[field],
        newValue: templateData[field as keyof typeof templateData]
      }));
      
      // Create change request via backend API
      await apiRequest('POST', '/technical/api/change-requests', {
        vesselId: vesselId,
        category: 'jobs',
        title: `Job Change: ${templateData.woTemplateCode || templateData.woTitle || 'Unknown'}`,
        reason: `Modification request for job ${templateData.woTemplateCode}`,
        targetType: 'job',
        targetId: jobId,
        snapshotBeforeJson: originalData,
        proposedChangesJson: proposedChanges,
        status: 'submitted',
        requestedByUserId: resolvedUserName
      });
      
      // Invalidate change requests cache so ModifyPMS shows the new request
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
      
      toast({
        title: "Change request submitted",
        description: "Your modification request has been submitted for approval."
      });
      
      navigate("/pms/modify-pms");
    } catch (error) {
      console.error('Error submitting change request:', error);
      toast({
        title: "Error",
        description: "Failed to submit change request. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  const handleCancelModify = () => {
    navigate("/pms/modify-pms");
  };

  const handleEditClick = () => {
    setOriginalData({ ...templateData });
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setTemplateData(prev => ({
      ...prev,
      ...originalData
    }));
    setIsEditMode(false);
  };

  const handleSaveChanges = async () => {
    if (!jobId) return;

    // Loading guard: block save while job context is still loading (prevents false D3 rejections)
    if (templateData.maintenanceBasis === 'Dual Frequency' && isLoading) {
      toast({ title: "Please wait", description: "Loading component data — please try again in a moment.", variant: "default" });
      return;
    }

    // D3 form-level block: prevent saving Dual Frequency on incompatible component
    // componentRhCounterType is already normalized to UPPERCASE at derivation
    if (templateData.maintenanceBasis === 'Dual Frequency') {
      if (componentRhCounterType !== 'MASTER' && componentRhCounterType !== 'INHERITED') {
        toast({
          title: "Dual Frequency not allowed",
          description: "Dual Frequency requires the component to have an RH Counter Type of Master or Inherited. Set up the component's RH Counter first.",
          variant: "destructive"
        });
        return;
      }
      // Both legs required for Dual
      if (!templateData.frequencyValue || !templateData.frequencyUnit) {
        toast({ title: "Validation Error", description: "Dual Frequency requires a calendar frequency (value and unit).", variant: "destructive" });
        return;
      }
      if (!templateData.intervalRunningHour || parseInt(templateData.intervalRunningHour, 10) <= 0) {
        toast({ title: "Validation Error", description: "Dual Frequency requires a Running Hours interval greater than 0.", variant: "destructive" });
        return;
      }
    }

    if (templateData.maintenanceBasis === 'Running Hours') {
      const intervalRH = Number(templateData.intervalRunningHour);
      if (!Number.isInteger(intervalRH) || intervalRH <= 0) {
        toast({
          title: "Validation Error",
          description: "Frequency (Hours) must be a whole number greater than 0.",
          variant: "destructive"
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const updatePayload: Record<string, any> = {};
      
      if (templateData.woTitle !== originalData.woTitle) {
        updatePayload.jobTitle = templateData.woTitle;
      }
      if (templateData.assignedTo !== originalData.assignedTo) {
        updatePayload.assignedTo = templateData.assignedTo;
      }
      if (templateData.approver !== originalData.approver) {
        updatePayload.approver = templateData.approver;
      }
      if (templateData.level2ReviewerRankId !== originalData.level2ReviewerRankId) {
        updatePayload.level2ReviewerRankId = templateData.level2ReviewerRankId || null;
      }
      if (templateData.jobPriority !== originalData.jobPriority) {
        updatePayload.jobPriority = templateData.jobPriority;
      }
      if (templateData.classRelated !== originalData.classRelated) {
        updatePayload.classRelated = templateData.classRelated;
      }
      if (templateData.isActive !== originalData.isActive) {
        updatePayload.isActive = templateData.isActive;
      }
      if (templateData.briefWorkDescription !== originalData.briefWorkDescription) {
        updatePayload.briefWorkDescription = templateData.briefWorkDescription;
      }
      if (templateData.frequencyValue !== originalData.frequencyValue) {
        updatePayload.frequencyValue = templateData.frequencyValue;
      }
      if (templateData.frequencyUnit !== originalData.frequencyUnit) {
        updatePayload.frequencyUnit = templateData.frequencyUnit;
      }
      if (templateData.maintenanceBasis !== originalData.maintenanceBasis) {
        updatePayload.maintenanceBasis = templateData.maintenanceBasis;
      }
      if (templateData.intervalRunningHour !== originalData.intervalRunningHour) {
        updatePayload.intervalRunningHour = templateData.intervalRunningHour ? parseInt(templateData.intervalRunningHour, 10) : null;
      }
      if (templateData.taskType !== originalData.taskType) {
        updatePayload.maintenanceType = templateData.taskType;
      }
      if (templateData.department !== originalData.department) {
        updatePayload.department = templateData.department || null;
      }
      if (templateData.criticality !== originalData.criticality) {
        updatePayload.criticality = templateData.criticality || null;
      }
      if (templateData.woTemplateCode !== originalData.woTemplateCode) {
        updatePayload.jobNo = templateData.woTemplateCode;
      }
      
      if (Object.keys(updatePayload).length === 0) {
        toast({
          title: "No changes",
          description: "No changes were made to save.",
        });
        setIsEditMode(false);
        setIsSaving(false);
        return;
      }

      // Component-scoped duplicate check: if job code changed, ensure no other job
      // on the same component already uses the new code.
      if (updatePayload.jobNo) {
        const componentCuuid = (jobContext as any)?.component?.id;
        if (componentCuuid) {
          const dupCheckRes = await apiRequest('GET', `/technical/api/jobs?vesselId=${encodeURIComponent(vesselId || '')}&componentId=${encodeURIComponent(componentCuuid)}`);
          const componentJobs: any[] = await dupCheckRes.json();
          const duplicate = componentJobs.find(
            (j: any) => j.jobNo === updatePayload.jobNo && j.juuid !== jobId && j.id !== jobId
          );
          if (duplicate) {
            toast({
              title: "Job Code already in use",
              description: `Job code "${updatePayload.jobNo}" is already used by another job on this component (${duplicate.jobTitle || duplicate.juuid}). Please choose a different code.`,
              variant: "destructive",
            });
            setIsSaving(false);
            return;
          }
        }
      }
      
      await apiRequest('PATCH', `/technical/api/jobs/${jobId}`, updatePayload);

      // Wait for the active job context to reload so the form reflects persisted values,
      // including the recalculated nextDueRH, rather than a local display alias.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/technical/api/jobs/${jobId}/context`] }),
        queryClient.invalidateQueries({ queryKey: ['/technical/api/jobs'] })
      ]);
      
      toast({
        title: "Changes saved",
        description: "Job details have been updated successfully.",
      });
      
      setIsEditMode(false);
    } catch (error) {
      console.error('Error saving job changes:', error);
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatFrequency = () => {
    const value = templateData.maintenanceBasis === 'Running Hours'
      ? templateData.intervalRunningHour
      : templateData.frequencyValue;
    if (!value) return '-';
    const unit = templateData.maintenanceBasis === 'Running Hours' ? 'Hours' : templateData.frequencyUnit;
    return `${value} ${unit}`;
  };

  const [isExportingHistoryExcel, setIsExportingHistoryExcel] = useState(false);
  const [isExportingHistoryPDF, setIsExportingHistoryPDF] = useState(false);
  const WORK_HISTORY_PAGE_SIZE = 5;
  const [workHistoryExpanded, setWorkHistoryExpanded] = useState(false);
  const [workHistoryPage, setWorkHistoryPage] = useState(0);
  const [historyComponentFilter] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyPeriod, setHistoryPeriod] = useState<PeriodValue | null>(null);
  const [expandedHistoryIndex, setExpandedHistoryIndex] = useState<number | null>(null);

  const handleHistoryPeriodChange = (val: PeriodValue | null) => {
    setHistoryPeriod(val);
    setWorkHistoryPage(0);
    setExpandedHistoryIndex(null);
    if (!val) {
      setHistoryDateFrom('');
      setHistoryDateTo('');
      return;
    }
    if (val.mode === 'yearQuarterMonth') {
      const year = val.year || new Date().getFullYear();
      let startMonth = 0;
      let endMonth = 11;
      if (val.month !== undefined) {
        startMonth = val.month;
        endMonth = val.month;
      } else if (val.quarter !== undefined) {
        startMonth = (val.quarter - 1) * 3;
        endMonth = startMonth + 2;
      }
      const from = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, endMonth + 1, 0).getDate();
      const to = `${year}-${String(endMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setHistoryDateFrom(from);
      setHistoryDateTo(to);
    } else if (val.mode === 'dateRange') {
      if (val.dateFrom) {
        const d = val.dateFrom;
        setHistoryDateFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      } else {
        setHistoryDateFrom('');
      }
      if (val.dateTo) {
        const d = val.dateTo;
        setHistoryDateTo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      } else {
        setHistoryDateTo('');
      }
    }
  };

  const calcDaysLate = (originalDueDate: string | null | undefined, completionDate: string | null | undefined): number => {
    if (!originalDueDate || !completionDate) return 0;
    // Normalize to date-only (YYYY-MM-DD) to avoid timezone/time-of-day skew
    const dueStr = originalDueDate.slice(0, 10);
    const compStr = completionDate.slice(0, 10);
    const due = new Date(dueStr + 'T00:00:00Z');
    const completed = new Date(compStr + 'T00:00:00Z');
    if (isNaN(due.getTime()) || isNaN(completed.getTime())) return 0;
    return Math.max(0, Math.floor((completed.getTime() - due.getTime()) / 86400000));
  };

  const buildWorkHistoryForExport = () => {
    const raw = templateData.workHistory || [];
    return raw
      .filter((h: any) => {
        const dateStr = (h.isSkipped ? (h.skippedCycleDate || h.completionDate || h.workDate) : (h.completionDate || h.workDate))?.slice(0, 10) || '';
        if (historyComponentFilter && (h.componentCode || '') !== historyComponentFilter) return false;
        if (historyDateFrom && dateStr < historyDateFrom) return false;
        if (historyDateTo && dateStr > historyDateTo) return false;
        return true;
      })
      .map((h: any) => {
        if (h.isSkipped) {
          return {
            date: h.skippedCycleDate || h.completionDate || h.workDate,
            workOrder: '—',
            description: 'Cycle not performed',
            performedBy: '—',
            runDate: '—',
            status: 'SKIPPED',
            daysLate: 0,
            remarks: `Automatically recorded. See WO: ${h.sourceWorkOrderId ? h.sourceWorkOrderId.slice(-8) : '—'}`,
            missedCycles: 0,
            isSkipped: true,
          };
        }
        const daysLate = calcDaysLate(h.originalDueDate, h.completionDate || h.workDate);
        return {
          date: h.completionDate || h.workDate,
          workOrder: h.woNo || '—',
          description: h.description || '-',
          performedBy: h.performedBy || '-',
          runDate: h.runDate || '—',
          status: h.status?.toLowerCase() === 'completed' ? 'Completed' : 'Postponed',
          daysLate,
          remarks: h.remarks || '-',
          missedCycles: h.missedCycles || 0,
          isSkipped: false,
        };
      });
  };

  const handleExportWorkHistoryExcel = async () => {
    setIsExportingHistoryExcel(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = 'SAIL PMS';
      wb.created = new Date();
      const ws = wb.addWorksheet('Work History');

      const cols = [
        { key: 'date', header: 'Date', width: 16 },
        { key: 'workOrder', header: 'Work Order No', width: 24 },
        { key: 'description', header: 'Description', width: 40 },
        { key: 'performedBy', header: 'Performed By', width: 22 },
        { key: 'runDate', header: 'Running Hours', width: 16 },
        { key: 'status', header: 'Status', width: 14 },
        { key: 'daysLate', header: 'Backdating', width: 14 },
        { key: 'remarks', header: 'Remarks', width: 30 },
        { key: 'missedCycles', header: 'Missed Cycles', width: 15 },
      ];
      const totalCols = cols.length;
      const lastColLetter = String.fromCharCode('A'.charCodeAt(0) + totalCols - 1);
      ws.columns = cols.map(c => ({ key: c.key, width: c.width }));

      ws.mergeCells(`A1:${lastColLetter}1`);
      const t = ws.getCell('A1');
      t.value = 'SEAFARER TECHNICAL MANAGEMENT SYSTEM';
      t.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
      t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5A8E' } };
      t.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 30;

      ws.mergeCells(`A2:${lastColLetter}2`);
      const s = ws.getCell('A2');
      const exportVesselName = vessels.find((v: any) => v.id === vesselId)?.name || 'Vessel';
      const exportJobTitle = templateData.woTitle || templateData.jobTitle || '';
      s.value = `Work History — ${exportJobTitle || templateData.componentName || templateData.componentCode || 'Component'} — Job: ${templateData.woTemplateCode || '-'}`;
      s.font = { size: 12, bold: true, color: { argb: 'FF2C3E50' }, name: 'Arial' };
      s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };
      s.alignment = { horizontal: 'center', vertical: 'middle' };
      s.border = { bottom: { style: 'medium', color: { argb: 'FF1E5A8E' } } };
      ws.getRow(2).height = 25;

      ws.getRow(3).height = 8;
      const exportData = buildWorkHistoryForExport();
      ws.getCell('A4').value = `Vessel: ${exportVesselName}  |  Component: ${templateData.componentName || templateData.componentCode || '-'}`;
      ws.getCell('A4').font = { bold: true, size: 10, color: { argb: 'FF2C3E50' }, name: 'Arial' };
      ws.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };

      const dtCol = String.fromCharCode(lastColLetter.charCodeAt(0) - 1);
      ws.mergeCells(`${dtCol}4:${lastColLetter}4`);
      ws.getCell(`${dtCol}4`).value = `Report Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      ws.getCell(`${dtCol}4`).font = { size: 10, color: { argb: 'FF5A6C7D' }, name: 'Arial' };
      ws.getCell(`${dtCol}4`).alignment = { horizontal: 'right' };
      ws.getRow(4).height = 18;

      ws.getCell('A5').value = `Job Code: ${templateData.woTemplateCode || '-'}  |  Total Records: ${exportData.length}`;
      ws.getCell('A5').font = { size: 9, color: { argb: 'FF2C3E50' }, name: 'Arial' };
      ws.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };
      ws.getRow(5).height = 16;
      ws.getRow(6).height = 6;

      const hdrRow = ws.getRow(7);
      cols.forEach((col, idx) => {
        const cell = hdrRow.getCell(idx + 1);
        cell.value = col.header;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5DADE2' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Arial' };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { top: { style: 'thin', color: { argb: 'FFFFFFFF' } }, left: { style: 'thin', color: { argb: 'FFFFFFFF' } }, bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } }, right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
      });
      hdrRow.height = 25;

      exportData.forEach((record, idx) => {
        const row = ws.getRow(8 + idx);
        const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        const daysLateVal = record.isSkipped ? '—' : (record.daysLate > 0 ? `${record.daysLate}d late` : '—');
        [fmtDate(record.date), record.workOrder, record.description, record.performedBy, record.runDate, record.status, daysLateVal, record.remarks, record.missedCycles > 0 ? record.missedCycles : '-']
          .forEach((v, ci) => { row.getCell(ci + 1).value = v; });

        const isEven = idx % 2 === 1;
        let bg = isEven ? 'FFF7F9FC' : 'FFFFFFFF';
        let fc = 'FF2C3E50';
        let bold = false;
        if (record.isSkipped) { bg = 'FFFEE2E2'; fc = 'FF991B1B'; bold = true; }
        else if (record.missedCycles > 0) { bg = 'FFFEF3C7'; fc = 'FF92400E'; bold = true; }

        row.eachCell((cell, cn) => {
          if (cn > totalCols) return;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.font = { color: { argb: fc }, size: 9, name: 'Arial', bold };
          cell.border = { top: { style: 'thin', color: { argb: 'FFE1E8ED' } }, left: { style: 'thin', color: { argb: 'FFE1E8ED' } }, bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } }, right: { style: 'thin', color: { argb: 'FFE1E8ED' } } };
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        });
        row.height = 20;
      });

      ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `work-history-job-${(templateData.woTemplateCode || 'JOB').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel export failed:', err);
      toast({ variant: 'destructive', title: 'Export failed', description: 'Could not generate the Excel file. Please try again.' });
    } finally {
      setIsExportingHistoryExcel(false);
    }
  };

  const handleExportWorkHistoryPDF = async () => {
    setIsExportingHistoryPDF(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const exportData = buildWorkHistoryForExport();
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;

      const pdfVesselName = vessels.find((v: any) => v.id === vesselId)?.name || 'Vessel';
      const pdfJobTitle = templateData.woTitle || templateData.jobTitle || templateData.componentName || templateData.componentCode || '';
      doc.setFillColor(30, 90, 142);
      doc.rect(0, 0, pageWidth, 38, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('WORK HISTORY REPORT', margin, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(pdfJobTitle, margin, 20);
      doc.setFontSize(8);
      doc.text(`Component: ${templateData.componentName || templateData.componentCode || '-'}  |  Vessel: ${pdfVesselName}`, margin, 27);
      doc.text(`Job Code: ${templateData.woTemplateCode || '-'}`, margin, 33);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, pageWidth - margin, 20, { align: 'right' });
      doc.text(`Records: ${exportData.length}`, pageWidth - margin, 27, { align: 'right' });

      const headers = ['Date', 'Work Order No', 'Description', 'Performed By', 'Run. Hours', 'Status', 'Backdating', 'Remarks', 'Missed Cycles'];
      const body = exportData.map(r => {
        const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        const daysLateCell = r.isSkipped ? '—' : (r.daysLate > 0 ? `${r.daysLate}d late` : '—');
        return [fmtDate(r.date), r.workOrder, r.description, r.performedBy, r.runDate, r.status, daysLateCell, r.remarks, r.missedCycles > 0 ? `⚠ ${r.missedCycles}` : '—'];
      });

      autoTable(doc, {
        head: [headers],
        body,
        startY: 44,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak', lineColor: [225, 232, 237], lineWidth: 0.1 },
        headStyles: { fillColor: [93, 173, 226], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
        alternateRowStyles: { fillColor: [247, 249, 252] },
        columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 28 }, 2: { cellWidth: 50 }, 3: { cellWidth: 24 }, 4: { cellWidth: 16 }, 5: { cellWidth: 18 }, 6: { cellWidth: 16 }, 7: { cellWidth: 44 }, 8: { cellWidth: 16 } },
        didParseCell: (hookData) => {
          if (hookData.section !== 'body') return;
          const record = exportData[hookData.row.index];
          if (!record) return;
          if (record.isSkipped) {
            hookData.cell.styles.fillColor = [254, 226, 226];
            hookData.cell.styles.textColor = [153, 27, 27];
          } else if (record.missedCycles > 0) {
            hookData.cell.styles.fillColor = [254, 243, 199];
            hookData.cell.styles.textColor = [146, 64, 14];
          }
        },
        didDrawPage: (hookData) => {
          const pageCount = (doc as any).internal.getNumberOfPages();
          const currentPage = hookData.pageNumber;
          doc.setFontSize(7);
          doc.setTextColor(90, 108, 125);
          doc.text(`Work History — ${templateData.woTemplateCode || ''}  |  Page ${currentPage} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
        },
      });

      doc.save(`work-history-job-${(templateData.woTemplateCode || 'JOB').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      toast({ variant: 'destructive', title: 'Export failed', description: 'Could not generate the PDF file. Please try again.' });
    } finally {
      setIsExportingHistoryPDF(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      let normalizedDate = dateStr;
      
      // Handle non-standard formats like "2025-11-28T1200" (missing colon in time)
      if (/^\d{4}-\d{2}-\d{2}T\d{4}$/.test(dateStr)) {
        normalizedDate = dateStr.replace(/T(\d{2})(\d{2})$/, 'T$1:$2:00');
      }
      
      // Handle DD-MMM-YYYY format (e.g., "28-Nov-2025")
      const ddMmmYyyyMatch = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
      if (ddMmmYyyyMatch) {
        const [, day, month, year] = ddMmmYyyyMatch;
        const monthMap: Record<string, string> = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
          'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        const monthNum = monthMap[month];
        if (monthNum) {
          normalizedDate = `${year}-${monthNum}-${day.padStart(2, '0')}`;
        }
      }
      
      const date = new Date(normalizedDate);
      if (isNaN(date.getTime())) return dateStr;
      
      return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading job details...</div>
      </div>
    );
  }

  if (isError || !jobContext) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm" data-testid="job-unavailable">
          <h1 className="text-xl font-semibold text-gray-900">Job unavailable</h1>
          <p className="mt-3 text-sm text-gray-600">
            This Job does not exist, has been deleted, or is not available in the current view.
          </p>
          <Button className="mt-6" onClick={() => setLocation('/pms/components')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Component Register
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modification Mode Banner */}
      {isModifyMode && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="text-amber-800 font-medium">
              Modification Mode: Changes will be submitted for approval. Modified fields appear in red.
            </span>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <div className={`bg-white border-b shadow-sm ${isModifyMode ? 'border-amber-300' : 'border-gray-200'}`}>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-6">
              <img src={sailLogo} alt="SAIL Logo" className="h-10 w-auto" data-testid="img-logo" />
              <div className="hidden md:block h-8 w-px bg-gray-300" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="text-gray-600 hover:text-gray-900"
                data-testid="JF3"
              >
                <Marker id="JF3" />
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              {/* Mobile Navigation Button */}
              <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="lg:hidden"
                    data-testid="button-mobile-nav"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[200px]">
                  <SheetHeader>
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>
                  <nav className="mt-6 space-y-4">
                    {navSteps.map((step) => (
                      <a
                        key={step.id}
                        href={`#${step.id}`}
                        onClick={() => {
                          setActiveStep(step.id);
                          setIsMobileNavOpen(false);
                        }}
                        className="flex items-center gap-3"
                        data-testid={`mobile-nav-step-${step.id}`}
                      >
                        <div className={`
                          w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                          ${activeStep === step.id 
                            ? 'bg-[hsl(var(--primary))] text-white' 
                            : 'bg-gray-200 text-gray-600'
                          }
                        `}>
                          {step.label}
                        </div>
                        <span className="text-sm text-gray-700">
                          {step.title}
                        </span>
                      </a>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
              <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate" data-testid="JF1">
                <Marker id="JF1" />
                {isModifyMode ? 'Modify Job' : 'Jobs Form'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {isModifyMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelModify}
                  className="text-gray-600 hover:text-gray-900"
                  data-testid="button-cancel-modify"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
              {!isModifyMode && !isEditMode && canRebaseline && templateData.isActive !== 'No' && (templateData.isActive as any) !== false && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => setShowRebaselineConfirm(true)}
                  data-testid="button-rebaseline-job"
                >
                  <Clock className="h-4 w-4 mr-1" />
                  Rebaseline &amp; Push to Ship
                </Button>
              )}
              {!isModifyMode && !isEditMode && (isSailAdmin || isClientAdmin) && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-red-300 text-red-500 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setShowDeleteConfirm(true)}
                  data-testid="button-delete-job"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {!isModifyMode && !isEditMode && !isVessel && !isHeadOfDept && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditClick}
                  data-testid="button-edit-job"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              )}
              {isEditMode && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    data-testid="button-cancel-edit"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    data-testid="button-save-job"
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsWorkInstructionsOpen(true)}
                className="border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-blue-50 font-medium px-4 h-9"
                data-testid="JF2"
              >
                <Marker id="JF2" />
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Work Instructions
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex">
        {/* Left Navigation Sidebar */}
        <aside className="hidden lg:block w-20 flex-shrink-0">
          <div className="sticky top-6 px-4 py-6">
            <nav className="space-y-6">
              {navSteps.map((step, index) => (
                <a
                  key={step.id}
                  href={`#${step.id}`}
                  onClick={() => setActiveStep(step.id)}
                  className="flex flex-col items-center gap-2 group"
                  data-testid={index === 0 ? "JF4" : `nav-step-${step.id}`}
                >
                  {index === 0 && <Marker id="JF4" />}
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors
                    ${activeStep === step.id 
                      ? 'bg-[hsl(var(--primary))] text-white' 
                      : 'bg-gray-200 text-gray-600 group-hover:bg-blue-100'
                    }
                  `}>
                    {step.label}
                  </div>
                  <span className="text-xs text-center text-gray-500 max-w-[60px] leading-tight">
                    {step.title}
                  </span>
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 px-6 py-6">
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* Part A - Job Details */}
            <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 space-y-8">
            <PartHeader
              id="part-a"
              label="Part A"
              title="Job Details"
              description="Job template details and configuration"
              headerMarker="JF5"
              descriptionMarker="JF6"
            />
            
            {/* A1. Job Information */}
            <SectionBlock 
              id="job-info"
              number="A1"
              title="Job Information" 
              description="Basic details and configuration for this job"
              headerMarker="JF.A1.1"
              descriptionMarker="JF.A1.2"
              variant="inline"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <EditableField 
                    label="Job Title" 
                    field="woTitle"
                    value={templateData.woTitle} 
                    originalValue={originalData.woTitle}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    labelMarker="JF.A1.3"
                    valueMarker="JF.A1.4"
                  />
                  <ReadOnlyField label="Component Name" value={templateData.componentName || templateData.component} labelMarker="JF.A1.5" valueMarker="JF.A1.6" />
                  <ReadOnlyField label="Component Code" value={templateData.componentCode} labelMarker="JF.A1.7" valueMarker="JF.A1.8" />
                  <EditableField
                    label="Job Code"
                    field="woTemplateCode"
                    value={templateData.woTemplateCode}
                    originalValue={originalData.woTemplateCode}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    labelMarker="JF.A1.9"
                    valueMarker="JF.A1.10"
                  />
                  {/* Maintenance Basis — editable in edit mode, read-only otherwise */}
                  {(() => {
                    const basisChanged = isModifyMode && templateData.maintenanceBasis !== originalData.maintenanceBasis;
                    const isDualBlocked = templateData.maintenanceBasis === 'Dual Frequency' &&
                      componentRhCounterType !== 'MASTER' && componentRhCounterType !== 'INHERITED';
                    return (
                      <div className="space-y-2">
                        <Label className={`text-sm ${basisChanged ? 'text-red-600 font-semibold' : 'text-[#8798ad]'}`} data-testid="JF.A1.11">
                          <Marker id="JF.A1.11" />Maintenance Basis {basisChanged && '(Modified)'}
                        </Label>
                        {isEditMode ? (
                          <Select
                            value={templateData.maintenanceBasis}
                            onValueChange={(val) => handleFieldChange('maintenanceBasis', val)}
                          >
                            <SelectTrigger className="text-sm" data-testid="JF.A1.12">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Calendar">Calendar</SelectItem>
                              <SelectItem value="Running Hours">Running Hours</SelectItem>
                              <SelectItem value="Dual Frequency">Dual Frequency</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="relative" data-testid="JF.A1.12">
                            <Marker id="JF.A1.12" />
                            <Input disabled value={templateData.maintenanceBasis || '-'} className="text-sm font-medium text-gray-900 bg-gray-50 disabled:opacity-100 disabled:cursor-default" />
                          </div>
                        )}
                        {isDualBlocked && isEditMode && (
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Dual Frequency requires the component to have an RH Counter Type of Master or Inherited. Set up the component's RH Counter first.
                          </p>
                        )}
                        {basisChanged && (
                          <p className="text-xs text-gray-500">Original: {originalData.maintenanceBasis || '-'}</p>
                        )}
                      </div>
                    );
                  })()}
                  {/* Calendar frequency fields — shown for Calendar and Dual Frequency */}
                  {(() => {
                    const showCalendarFields = templateData.maintenanceBasis === 'Calendar' || templateData.maintenanceBasis === 'Dual Frequency';
                    const showRhOnlyField = templateData.maintenanceBasis === 'Running Hours';
                    const frequencyField = showRhOnlyField ? 'intervalRunningHour' : 'frequencyValue';
                    const displayedFrequencyValue = showRhOnlyField ? templateData.intervalRunningHour : templateData.frequencyValue;
                    const originalFrequencyValue = showRhOnlyField ? originalData.intervalRunningHour : originalData.frequencyValue;
                    const freqValueChanged = isModifyMode && displayedFrequencyValue !== originalFrequencyValue;
                    const freqUnitChanged = !showRhOnlyField && isModifyMode && templateData.frequencyUnit !== originalData.frequencyUnit;
                    const isFreqModified = freqValueChanged || freqUnitChanged;
                    if (!showCalendarFields && !showRhOnlyField) return null;
                    return (
                      <div className="space-y-2">
                        <Label className={`text-sm ${isFreqModified ? 'text-red-600 font-semibold' : 'text-[#8798ad]'}`} data-testid="JF.A1.13">
                          <Marker id="JF.A1.13" />
                          {showRhOnlyField ? 'Frequency (Hours)' : templateData.maintenanceBasis === 'Dual Frequency' ? 'Calendar Frequency' : 'Frequency'}
                          {isFreqModified && ' (Modified)'}
                        </Label>
                        <div className="flex gap-2">
                          {(isModifyMode || isEditMode) ? (
                            <Input
                              type={showRhOnlyField ? "number" : "text"}
                              min={showRhOnlyField ? 1 : undefined}
                              step={showRhOnlyField ? 1 : undefined}
                              value={displayedFrequencyValue || ''}
                              onChange={(e) => handleFieldChange(frequencyField, e.target.value)}
                              className={`text-sm flex-1 ${freqValueChanged ? 'border-red-500 bg-red-50 text-red-700' : ''}`}
                              data-testid="JF.A1.14"
                            />
                          ) : (
                            <Input disabled value={displayedFrequencyValue || '-'} className="text-sm font-medium text-gray-900 bg-gray-50 disabled:opacity-100 disabled:cursor-default flex-1" data-testid="JF.A1.14" />
                          )}
                          {showRhOnlyField ? (
                            <Input disabled value="Hours" className="text-sm font-medium text-gray-900 bg-gray-50 disabled:opacity-100 disabled:cursor-default w-24" />
                          ) : (isModifyMode || isEditMode) ? (
                            <Select value={templateData.frequencyUnit || 'Months'} onValueChange={(val) => handleFieldChange('frequencyUnit', val)}>
                              <SelectTrigger className={`text-sm w-28 ${freqUnitChanged ? 'border-red-500 bg-red-50' : ''}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {['Days', 'Weeks', 'Months', 'Years'].map(u => (
                                  <SelectItem key={u} value={u}>{u}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input disabled value={templateData.frequencyUnit || 'Months'} className="text-sm font-medium text-gray-900 bg-gray-50 disabled:opacity-100 disabled:cursor-default w-24" />
                          )}
                        </div>
                        {isFreqModified && (
                          <p className="text-xs text-gray-500">
                            Original: {originalFrequencyValue || '-'} {showRhOnlyField ? 'Hours' : (originalData.frequencyUnit || 'Months')}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  {/* RH interval field — shown for Dual Frequency only (RH-only uses the main frequency field above) */}
                  {templateData.maintenanceBasis === 'Dual Frequency' && (() => {
                    const rhChanged = isModifyMode && templateData.intervalRunningHour !== originalData.intervalRunningHour;
                    return (
                      <div className="space-y-2">
                        <Label className={`text-sm ${rhChanged ? 'text-red-600 font-semibold' : 'text-[#8798ad]'}`}>
                          Running Hours Interval {rhChanged && '(Modified)'}
                        </Label>
                        <div className="flex gap-2">
                          {(isModifyMode || isEditMode) ? (
                            <Input
                              type="number"
                              value={templateData.intervalRunningHour || ''}
                              onChange={(e) => handleFieldChange('intervalRunningHour', e.target.value)}
                              placeholder="e.g., 1000"
                              className={`text-sm flex-1 ${rhChanged ? 'border-red-500 bg-red-50 text-red-700' : ''}`}
                            />
                          ) : (
                            <Input disabled value={templateData.intervalRunningHour || '-'} className="text-sm font-medium text-gray-900 bg-gray-50 disabled:opacity-100 disabled:cursor-default flex-1" />
                          )}
                          <Input disabled value="Hours" className="text-sm font-medium text-gray-900 bg-gray-50 disabled:opacity-100 disabled:cursor-default w-24" />
                        </div>
                        {rhChanged && (
                          <p className="text-xs text-gray-500">Original: {originalData.intervalRunningHour || '-'} Hours</p>
                        )}
                      </div>
                    );
                  })()}
                  <EditableField 
                    label="Task Type" 
                    field="taskType"
                    value={templateData.taskType} 
                    originalValue={originalData.taskType}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    type="select"
                    options={['Inspection', 'Overhaul', 'Service', 'Test', 'Renew/Replace', 'Measurement/Calibration', 'Megger Test', 'Cleaning', 'Lubrication', 'Survey', 'Analysis', 'Checks']}
                    labelMarker="JF.A1.15"
                    valueMarker="JF.A1.16"
                  />
                  <EditableField 
                    label="Assigned To (Rank)" 
                    field="assignedTo"
                    value={templateData.assignedTo} 
                    originalValue={originalData.assignedTo}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    type="select"
                    options={ensureRankInOptions(rankOptions, templateData.assignedTo)}
                    displayValue={getRankLabel(rankOptions, templateData.assignedTo)}
                    labelMarker="JF.A1.17"
                    valueMarker="JF.A1.18"
                  />
                  <EditableField 
                    label="Approver (Rank)" 
                    field="approver"
                    value={templateData.approver} 
                    originalValue={originalData.approver}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    type="select"
                    options={ensureRankInOptions(rankOptions, templateData.approver)}
                    displayValue={getRankLabel(rankOptions, templateData.approver)}
                    labelMarker="JF.A1.19"
                    valueMarker="JF.A1.20"
                  />
                  <EditableField 
                    label="Level 2 Reviewer (Rank)" 
                    field="level2ReviewerRankId"
                    value={templateData.level2ReviewerRankId} 
                    originalValue={originalData.level2ReviewerRankId}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    type="select"
                    options={ensureRankInOptions([{ value: 'Office', label: 'Office' }], templateData.level2ReviewerRankId)}
                    displayValue={getRankLabel([{ value: 'Office', label: 'Office' }], templateData.level2ReviewerRankId) || templateData.level2ReviewerRankId || '— None —'}
                    labelMarker="JF.A1.L2R.1"
                    valueMarker="JF.A1.L2R.2"
                  />
                  <EditableField 
                    label="Job Priority" 
                    field="jobPriority"
                    value={templateData.jobPriority} 
                    originalValue={originalData.jobPriority}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    type="select"
                    options={['Low', 'Medium', 'High']}
                    labelMarker="JF.A1.21"
                    valueMarker="JF.A1.22"
                  />
                  <EditableField 
                    label="Class Related" 
                    field="classRelated"
                    value={templateData.classRelated} 
                    originalValue={originalData.classRelated}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    type="select"
                    options={['Yes', 'No']}
                    labelMarker="JF.A1.23"
                    valueMarker="JF.A1.24"
                  />
                  {templateData.maintenanceBasis === 'Running Hours' ? (
                    <ReadOnlyField
                      label="Next Due RH"
                      value={templateData.nextDueReading ? `${templateData.nextDueReading} Hours` : '-'}
                      labelMarker="JF.A1.25"
                      valueMarker="JF.A1.26"
                    />
                  ) : templateData.maintenanceBasis === 'Dual Frequency' ? (
                    <>
                      <ReadOnlyField label="Next Due Date (Calendar)" value={formatDate(templateData.nextDueDate)} labelMarker="JF.A1.25" valueMarker="JF.A1.26" />
                      <ReadOnlyField
                        label="Next Due RH"
                        value={templateData.nextDueReading ? `${templateData.nextDueReading} Hours` : '-'}
                      />
                    </>
                  ) : (
                    <ReadOnlyField label="Next Due Date" value={formatDate(templateData.nextDueDate)} labelMarker="JF.A1.25" valueMarker="JF.A1.26" />
                  )}
                  {(templateData.maintenanceBasis === 'Running Hours' || templateData.maintenanceBasis === 'Dual Frequency') && (() => {
                    const td = (jobContext as Record<string, Record<string, unknown>> | undefined)?.templateData;
                    const lastRH = (td?.lastCompletedRH ?? td?.lastDoneRH) as number | undefined;
                    return (
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad] flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Last Completed At
                        </Label>
                        <div className="text-xs p-2 bg-gray-100 rounded border border-gray-200 text-gray-700" data-testid="text-last-completed-rh">
                          {lastRH != null ? <>{formatRHWithSeparators(lastRH)} Hours</> : <span className="italic text-gray-400">First maintenance cycle</span>}
                        </div>
                      </div>
                    );
                  })()}
                  {(() => {
                    const td = (jobContext as Record<string, Record<string, unknown>> | undefined)?.templateData;
                    const lastDate = (td?.lastCompletedDate ?? td?.lastDoneDate) as string | undefined;
                    return (
                      <div className="space-y-2">
                        <Label className="text-sm text-[#8798ad] flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Last Completed On
                        </Label>
                        <div className="text-xs p-2 bg-gray-100 rounded border border-gray-200 text-gray-700" data-testid="text-last-completed-date">
                          {lastDate ? (
                            <>{normalizeDateToDDMMMYYYY(lastDate)}{(() => { const r = formatRelativeTime(lastDate); return r ? ` (${r})` : ''; })()}</>
                          ) : (
                            <span className="italic text-gray-400">First maintenance cycle</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <EditableField
                    label="Department"
                    field="department"
                    value={templateData.department}
                    originalValue={originalData.department}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    type="text"
                    labelMarker="JF.A1.27"
                    valueMarker="JF.A1.28"
                  />
                  <EditableField
                    label="Criticality"
                    field="criticality"
                    value={templateData.criticality}
                    originalValue={originalData.criticality}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    type="select"
                    options={['Yes', 'No']}
                    labelMarker="JF.A1.29"
                    valueMarker="JF.A1.30"
                  />
                  <EditableField 
                    label="Is Active" 
                    field="isActive"
                    value={templateData.isActive} 
                    originalValue={originalData.isActive}
                    onChange={handleFieldChange}
                    isModifyMode={isModifyMode}
                    isEditMode={isEditMode}
                    type="select"
                    options={['Yes', 'No']}
                    labelMarker="JF.A1.31"
                    valueMarker="JF.A1.32"
                  />
                </div>

                <EditableField 
                  label="Brief Work Description" 
                  field="briefWorkDescription"
                  value={templateData.briefWorkDescription} 
                  originalValue={originalData.briefWorkDescription}
                  onChange={handleFieldChange}
                  isModifyMode={isModifyMode}
                  isEditMode={isEditMode}
                  type="textarea"
                  labelMarker="JF.A1.33"
                  valueMarker="JF.A1.34"
                />
              </div>
            </SectionBlock>

            {/* A2. Required Spare Parts */}
            <SectionBlock
              id="spare-parts"
              number="A2"
              title="Required Spare Parts"
              description="Spare parts needed for this job"
              headerMarker="JF.A2.1"
              descriptionMarker="JF.A2.2"
              variant="inline"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-medium text-gray-700 w-[20%]" data-testid="JF.A2.3"><Marker id="JF.A2.3" />PART NO.</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[40%]" data-testid="JF.A2.4"><Marker id="JF.A2.4" />DESCRIPTION</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]" data-testid="JF.A2.5"><Marker id="JF.A2.5" />QTY REQUIRED</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[10%]" data-testid="JF.A2.6"><Marker id="JF.A2.6" />ROB</th>
                      <th className="text-left p-2 font-medium text-gray-700 w-[15%]" data-testid="JF.A2.7"><Marker id="JF.A2.7" />STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(templateData.requiredSpareParts || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center p-4 text-gray-500 italic">
                          No spare parts added yet
                        </td>
                      </tr>
                    ) : (
                      (templateData.requiredSpareParts || []).map((part: any, index) => {
                        const robValue = part.rob !== null && part.rob !== undefined ? part.rob : null;
                        const qtyRequired = parseInt(part.quantityRequired) || 0;
                        const isAvailable = robValue !== null && robValue >= qtyRequired;
                        const isLowStock = robValue !== null && robValue > 0 && robValue < qtyRequired;
                        const isOutOfStock = robValue === 0;
                        const stockStatus = robValue === null ? 'unknown' : isAvailable ? 'available' : isLowStock ? 'low' : 'unavailable';
                        
                        return (
                          <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="p-2" data-testid={index === 0 ? "JF.A2.8" : `text-spare-part-no-${index}`}>{index === 0 && <Marker id="JF.A2.8" />}{part.partNo || '-'}</td>
                            <td className="p-2" data-testid={index === 0 ? "JF.A2.9" : `text-spare-description-${index}`}>{index === 0 && <Marker id="JF.A2.9" />}{part.description || '-'}</td>
                            <td className="p-2" data-testid={index === 0 ? "JF.A2.10" : `text-spare-quantity-${index}`}>{index === 0 && <Marker id="JF.A2.10" />}{part.quantityRequired || '-'}</td>
                            <td className="p-2 text-center" data-testid={index === 0 ? "JF.A2.11" : `text-spare-rob-${index}`}>{index === 0 && <Marker id="JF.A2.11" />}{robValue !== null ? robValue : '-'}</td>
                            <td className="p-2" data-testid={index === 0 ? "JF.A2.12" : `status-spare-${index}`}>
                              {index === 0 && <Marker id="JF.A2.12" />}
                              <StatusPill status={stockStatus} />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </SectionBlock>

            {/* A3. Safety Requirements */}
            <SectionBlock
              id="safety"
              number="A3"
              title="Safety Requirements"
              description="Safety requirements and permits for this job"
              headerMarker="JF.A4.1"
              descriptionMarker="JF.A4.2"
              variant="inline"
            >
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1.5" data-testid="JF.A4.3"><Marker id="JF.A4.3" />Personal Protective Equipment (PPE):</h3>
                  {(templateData.safetyRequirements?.ppeRequirements || []).length > 0 ? (
                    <ul className="space-y-0.5 text-sm text-gray-700 ml-4" data-testid="JF.A4.4">
                      <Marker id="JF.A4.4" />
                      {templateData.safetyRequirements.ppeRequirements.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-[hsl(var(--primary))] mt-1.5">&bull;</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 italic ml-4" data-testid="JF.A4.4"><Marker id="JF.A4.4" />No PPE requirements specified</p>
                  )}
                </div>
                
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1.5" data-testid="JF.A4.5"><Marker id="JF.A4.5" />Permits Required:</h3>
                  {(templateData.safetyRequirements?.permitRequirements || []).length > 0 ? (
                    <ul className="space-y-0.5 text-sm text-gray-700 ml-4" data-testid="JF.A4.6">
                      <Marker id="JF.A4.6" />
                      {templateData.safetyRequirements.permitRequirements.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-[hsl(var(--primary))] mt-1.5">&bull;</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 italic ml-4" data-testid="JF.A4.6"><Marker id="JF.A4.6" />No permits required</p>
                  )}
                </div>
                
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1.5" data-testid="JF.A4.7"><Marker id="JF.A4.7" />Other Safety Requirements:</h3>
                  {(templateData.safetyRequirements?.otherRequirements || []).length > 0 ? (
                    <ul className="space-y-0.5 text-sm text-gray-700 ml-4" data-testid="JF.A4.8">
                      <Marker id="JF.A4.8" />
                      {templateData.safetyRequirements.otherRequirements.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-[hsl(var(--primary))] mt-1.5">&bull;</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 italic ml-4" data-testid="JF.A4.8"><Marker id="JF.A4.8" />No other safety requirements specified</p>
                  )}
                </div>
              </div>
            </SectionBlock>

            {/* A4. Work History */}
            <SectionBlock
              id="work-history"
              number="A4"
              title="Work History"
              description="Previous executions and completion history for this job"
              headerMarker="JF.A5.1"
              descriptionMarker="JF.A5.2"
              variant="inline"
              headerActions={
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportWorkHistoryExcel}
                    disabled={isExportingHistoryExcel || (templateData.workHistory || []).length === 0}
                    data-testid="button-export-history-excel"
                    className="h-7 text-xs border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-40"
                  >
                    {isExportingHistoryExcel
                      ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Exporting…</>
                      : <><FileSpreadsheet className="h-3 w-3 mr-1" />Export Excel</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportWorkHistoryPDF}
                    disabled={isExportingHistoryPDF || (templateData.workHistory || []).length === 0}
                    data-testid="button-export-history-pdf"
                    className="h-7 text-xs border-red-500 text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    {isExportingHistoryPDF
                      ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Exporting…</>
                      : <><FileText className="h-3 w-3 mr-1" />Export PDF</>}
                  </Button>
                </>
              }
            >
              {(() => {
                const rawHistory = templateData.workHistory || [];

                const filteredHistory = rawHistory.filter((h: any) => {
                  const dateStr = (h.isSkipped ? (h.skippedCycleDate || h.completionDate || h.workDate) : (h.completionDate || h.workDate))?.slice(0, 10) || '';
                  if (historyComponentFilter && (h.componentCode || '') !== historyComponentFilter) return false;
                  if (historyDateFrom && dateStr < historyDateFrom) return false;
                  if (historyDateTo && dateStr > historyDateTo) return false;
                  return true;
                });

                const hasFilters = !!historyPeriod;
                const totalCount = filteredHistory.length;
                const displayHistory = workHistoryExpanded
                  ? filteredHistory.slice(workHistoryPage * WORK_HISTORY_PAGE_SIZE, (workHistoryPage + 1) * WORK_HISTORY_PAGE_SIZE)
                  : filteredHistory.slice(0, 2);
                const totalPages = Math.ceil(totalCount / WORK_HISTORY_PAGE_SIZE);

                return (
                  <>
                    {/* Filter bar */}
                    <div className="flex flex-wrap gap-2 items-center mb-3 p-2 bg-gray-50 rounded border border-gray-200" data-testid="history-filter-bar">
                      <PeriodPicker value={historyPeriod} onChange={handleHistoryPeriodChange} className="min-w-[160px]" />
                      <input type="hidden" value={historyComponentFilter} data-testid="select-history-component" />
                      <input type="hidden" value={historyDateFrom} data-testid="input-history-date-from" />
                      <input type="hidden" value={historyDateTo} data-testid="input-history-date-to" />
                      {hasFilters && (
                        <button
                          type="button"
                          onClick={() => handleHistoryPeriodChange(null)}
                          data-testid="button-clear-history-filters"
                          className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-100"
                        >
                          Clear
                        </button>
                      )}
                      <span className="ml-auto text-xs text-gray-500" data-testid="text-history-filter-count">
                        {hasFilters ? `${totalCount} of ${rawHistory.length}` : `${rawHistory.length}`} entries
                      </span>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border border-gray-200">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left p-2 font-medium text-gray-700" data-testid="JF.A5.3"><Marker id="JF.A5.3" />DATE</th>
                            <th className="text-left p-2 font-medium text-gray-700" data-testid="JF.A5.4"><Marker id="JF.A5.4" />WORK ORDER</th>
                            <th className="text-left p-2 font-medium text-gray-700" data-testid="JF.A5.5"><Marker id="JF.A5.5" />DESCRIPTION</th>
                            <th className="text-left p-2 font-medium text-gray-700" data-testid="JF.A5.6"><Marker id="JF.A5.6" />PERFORMED BY</th>
                            <th className="text-left p-2 font-medium text-gray-700" data-testid="JF.A5.7"><Marker id="JF.A5.7" />RUN. HOURS</th>
                            <th className="text-left p-2 font-medium text-gray-700" data-testid="JF.A5.8"><Marker id="JF.A5.8" />STATUS</th>
                            <th className="text-left p-2 font-medium text-gray-700">BACKDATING</th>
                            <th className="text-left p-2 font-medium text-gray-700">REMARKS</th>
                            <th className="w-8 p-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayHistory.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="text-center p-4 text-gray-500 italic">
                                {hasFilters ? 'No matching history entries' : 'No data available'}
                              </td>
                            </tr>
                          ) : displayHistory.map((record: any, index: number) => {
                            const daysLate = calcDaysLate(record.originalDueDate, record.completionDate || record.workDate);
                            const isExpanded = expandedHistoryIndex === index;
                            return (
                              <Fragment key={index}>
                                <tr
                                  onClick={() => setExpandedHistoryIndex(isExpanded ? null : index)}
                                  className={`border-b border-gray-200 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                  data-testid={`row-history-${index}`}
                                >
                                  <td className="p-2" data-testid={index === 0 ? "JF.A5.9" : `text-history-date-${index}`}>{index === 0 && <Marker id="JF.A5.9" />}{formatDate(record.isSkipped ? (record.skippedCycleDate || record.completionDate || record.workDate) : (record.completionDate || record.workDate))}</td>
                                  <td className="p-2" data-testid={index === 0 ? "JF.A5.10" : `text-history-wo-${index}`}>{index === 0 && <Marker id="JF.A5.10" />}{record.isSkipped ? '—' : (record.woNo || '-')}</td>
                                  <td className="p-2 max-w-[180px] truncate" data-testid={index === 0 ? "JF.A5.11" : `text-history-description-${index}`} title={record.description || '-'}>{index === 0 && <Marker id="JF.A5.11" />}{record.isSkipped ? 'Cycle not performed' : (record.description || '-')}</td>
                                  <td className="p-2" data-testid={index === 0 ? "JF.A5.12" : `text-history-performed-by-${index}`}>{index === 0 && <Marker id="JF.A5.12" />}{record.isSkipped ? '—' : (record.performedBy || '-')}</td>
                                  <td className="p-2 text-gray-600" data-testid={`text-history-rh-${index}`}>{record.isSkipped ? '—' : (record.runDate || '—')}</td>
                                  <td className="p-2" data-testid={index === 0 ? "JF.A5.13" : `text-history-status-${index}`}>
                                    {index === 0 && <Marker id="JF.A5.13" />}
                                    <div className="flex flex-col gap-1">
                                      {record.isSkipped ? (
                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white whitespace-nowrap" style={{ backgroundColor: '#EF4444' }} data-testid={`badge-status-skipped-${index}`}>
                                          SKIPPED
                                        </span>
                                      ) : (
                                        <>
                                          <StatusPill status={record.status?.toLowerCase() === 'completed' ? 'completed' : 'postponed'} />
                                          {(record.missedCycles || 0) >= 1 && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500 text-white whitespace-nowrap" data-testid={`badge-history-skipped-${record.woNo || index}`}>
                                              ⚠ {record.missedCycles} Skipped
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-2" data-testid={`text-history-days-late-${index}`}>
                                    {record.isSkipped || !daysLate ? (
                                      <span className="text-gray-400">—</span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 whitespace-nowrap" data-testid={`badge-days-late-${record.woNo || index}`}>
                                        ⚠ {daysLate}d late
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2 max-w-[120px] truncate text-gray-600" data-testid={index === 0 ? "JF.A5.14" : `text-history-remarks-${index}`}>{index === 0 && <Marker id="JF.A5.14" />}{record.isSkipped ? `Auto-recorded. See WO: ${record.sourceWorkOrderId ? record.sourceWorkOrderId.slice(-8) : '—'}` : (record.remarks || '-')}</td>
                                  <td className="p-2 text-gray-400">
                                    <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${isExpanded ? 'rotate-180 text-blue-500' : ''}`} />
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr key={`detail-${index}`}>
                                    <td colSpan={9} className="bg-blue-50 border-b border-blue-100 p-0">
                                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 px-6 py-4 text-sm" data-testid={`panel-history-detail-${index}`}>
                                        {record.isSkipped ? (
                                          <>
                                            <div>
                                              <span className="font-medium text-gray-600">Skipped Cycle Date:</span>{' '}
                                              <span className="text-gray-800">{formatDate(record.skippedCycleDate) || '—'}</span>
                                            </div>
                                            <div>
                                              <span className="font-medium text-gray-600">Source Work Order:</span>{' '}
                                              <span className="text-gray-800">{record.sourceWorkOrderId ? record.sourceWorkOrderId.slice(-8) : '—'}</span>
                                            </div>
                                            <div className="col-span-2">
                                              <span className="font-medium text-gray-600">Note:</span>{' '}
                                              <span className="text-gray-500 italic">This cycle was automatically recorded as skipped.</span>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div>
                                              <span className="font-medium text-gray-600">Completion Date:</span>{' '}
                                              <span className="text-gray-800">{record.completionDate || record.workDate || '—'}</span>
                                            </div>
                                            <div>
                                              <span className="font-medium text-gray-600">Running Hours:</span>{' '}
                                              <span className="text-gray-800">{record.runDate || '—'}</span>
                                            </div>
                                            {daysLate > 0 && (
                                              <div>
                                                <span className="font-medium text-gray-600">Backdating:</span>{' '}
                                                <span className="text-amber-700 font-medium">{daysLate} day{daysLate !== 1 ? 's' : ''} late</span>
                                              </div>
                                            )}
                                            {(record.missedCycles || 0) > 0 && (
                                              <div>
                                                <span className="font-medium text-gray-600">Missed Cycles:</span>{' '}
                                                <span className="text-amber-700 font-medium">{record.missedCycles}</span>
                                              </div>
                                            )}
                                            <div>
                                              <span className="font-medium text-gray-600">Performed By:</span>{' '}
                                              <span className="text-gray-800">{record.performedBy || '—'}</span>
                                            </div>
                                            <div>
                                              <span className="font-medium text-gray-600">Approved By:</span>{' '}
                                              <span className="text-gray-800">{record.approvedBy || '—'}</span>
                                            </div>
                                            {record.componentCode && (
                                              <div>
                                                <span className="font-medium text-gray-600">Component:</span>{' '}
                                                <span className="text-gray-800">{record.componentCode}</span>
                                              </div>
                                            )}
                                            <div className="col-span-2">
                                              <span className="font-medium text-gray-600">Full Description:</span>{' '}
                                              <span className="text-gray-800">{record.description || '—'}</span>
                                            </div>
                                            <div className="col-span-2">
                                              <span className="font-medium text-gray-600">Remarks:</span>{' '}
                                              <span className="text-gray-800">{record.remarks || '—'}</span>
                                            </div>
                                            {((record.sparesUsed || []) as Array<{ partName?: string; partCode?: string; quantity?: number | null }>).length > 0 && (
                                              <div className="col-span-2">
                                                <span className="font-medium text-gray-600">Spare Parts Used:</span>
                                                <ul className="mt-1 space-y-0.5">
                                                  {(record.sparesUsed as Array<{ partName?: string; partCode?: string; quantity?: number | null }>).map((sp, si) => (
                                                    <li key={si} className="text-gray-800">
                                                      {sp.partName || sp.partCode || 'Unknown'}{sp.quantity != null ? ` — qty: ${sp.quantity}` : ''}
                                                    </li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Show All / Pagination */}
                    {!workHistoryExpanded && totalCount > 2 && (
                      <div className="flex justify-center mt-3">
                        <button
                          type="button"
                          data-testid="button-show-all-history"
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium px-4 py-1.5 rounded border border-blue-200 hover:bg-blue-50 transition-colors"
                          onClick={() => { setWorkHistoryExpanded(true); setWorkHistoryPage(0); setExpandedHistoryIndex(null); }}
                        >
                          Show All History ({totalCount} entries)
                        </button>
                      </div>
                    )}
                    {workHistoryExpanded && (
                      <div className="flex items-center justify-between mt-3">
                        <button
                          type="button"
                          data-testid="button-show-less-history"
                          className="text-sm text-gray-600 hover:text-gray-800 font-medium px-4 py-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                          onClick={() => { setWorkHistoryExpanded(false); setWorkHistoryPage(0); setExpandedHistoryIndex(null); }}
                        >
                          Show Less
                        </button>
                        {totalPages > 1 && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <button
                              type="button"
                              data-testid="button-history-prev-page"
                              className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                              disabled={workHistoryPage === 0}
                              onClick={() => { setWorkHistoryPage(p => Math.max(0, p - 1)); setExpandedHistoryIndex(null); }}
                            >
                              &laquo; Prev
                            </button>
                            <span data-testid="text-history-page-info">Page {workHistoryPage + 1} of {totalPages}</span>
                            <button
                              type="button"
                              data-testid="button-history-next-page"
                              className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                              disabled={workHistoryPage >= totalPages - 1}
                              onClick={() => { setWorkHistoryPage(p => Math.min(totalPages - 1, p + 1)); setExpandedHistoryIndex(null); }}
                            >
                              Next &raquo;
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </SectionBlock>
            </div>

            {/* Save for Approval Button (only in modify mode) */}
            {isModifyMode && (
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Submit Changes for Approval</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Review your changes above, then submit for approval. Modified fields are highlighted in red.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={handleCancelModify}
                      data-testid="button-cancel-changes"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveForApproval}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      data-testid="button-save-for-approval"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save for Approval
                    </Button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Work Instructions Dialog */}
      <WorkInstructionsDialog
        isOpen={isWorkInstructionsOpen}
        onClose={() => setIsWorkInstructionsOpen(false)}
      />

      <Dialog open={showRebaselineConfirm} onOpenChange={setShowRebaselineConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rebaseline job cycle &amp; push to ship?</DialogTitle>
            <DialogDescription>
              This authorizes the office's current cycle values for this job (last done and next due dates/running hours)
              to <strong>overwrite the ship's tracking</strong> on the next sync. Normally the ship's own completion history
              is protected from office changes — only use this after correcting the cycle in the office (e.g. after a survey
              or data fix). This action is recorded with your username.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRebaselineConfirm(false)} disabled={rebaselineMutation.isPending} data-testid="button-cancel-rebaseline">
              Cancel
            </Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => rebaselineMutation.mutate()} disabled={rebaselineMutation.isPending} data-testid="button-confirm-rebaseline">
              {rebaselineMutation.isPending ? 'Authorizing…' : 'Rebaseline & Push'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this job? It will be hidden from normal Office and Vessel Job views and cannot be restored through normal editing. Existing work orders and maintenance history will be retained.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleteMutation.isPending} data-testid="button-cancel-delete-job">
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} data-testid="button-confirm-delete-job">
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JobsFormPage;
