import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Paperclip, Calendar, Download } from 'lucide-react';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams, CellEditingStoppedEvent } from 'ag-grid-community';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import AgGridTableActions from '@/components/AgGrid/AgGridTableActions';
import DateCellEditor from '@/components/AgGrid/DateCellEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FiltersToggle } from '@/components/filters/VesselFilter';
import { VesselFleetGroupFilter, VesselFleetGroupFilterValue, VesselFleetGroupFilterResult, createDefaultFilterValue } from '@/components/filters/VesselFleetGroupFilter';
import { useUIRole } from "@/contexts/UIRoleContext";
import { usePermissions } from '@/contexts/PermissionsContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { FileAttachmentDialog, FileAttachment } from '@/components/FileAttachmentDialog';
import { pdfReportGenerator } from '@/lib/pdfReportGenerator';
import type { TableColumn } from '@/lib/pdfReportGenerator';

type DueInFilter = 'all' | '3months' | '2months' | '1month' | 'overdue';

const parseDisplayDate = (displayDate: string): string => {
  if (!displayDate) return '';
  const months: Record<string, string> = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  const match = displayDate.match(/(\d{1,2})\s([A-Za-z]{3})\s(\d{4})/);
  if (match) {
    const [, day, monthStr, year] = match;
    const month = months[monthStr] || '01';
    return `${year}-${month}-${day.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(displayDate)) return displayDate;
  return '';
};


