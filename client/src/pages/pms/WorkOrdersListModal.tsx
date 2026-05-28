import { useMemo } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pen, Download } from "lucide-react";
import { pdfReportGenerator } from "@/lib/pdfReportGenerator";
import type { TableColumn } from "@/lib/pdfReportGenerator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { WorkOrder } from "@shared/schema";
import WOAgGridTable from "@/components/WOAgGridTable";
import type { ColDef } from 'ag-grid-community';

type EnrichedWorkOrder = WorkOrder & { computedStatus?: string };

interface WorkOrdersListModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  workOrders: EnrichedWorkOrder[];
  vessels?: { id: string; name: string }[];
}

export function WorkOrdersListModal({ open, onClose, title, workOrders, vessels = [] }: WorkOrdersListModalProps) {
  const [, setLocation] = useLocation();
  const vesselMap = useMemo(() => {
    const map = new Map<string, string>();
    vessels.forEach(v => map.set(v.id, v.name));
    return map;
  }, [vessels]);

  const handleEditClick = (wo: EnrichedWorkOrder) => {
    if (!wo?.id) return;
    onClose();
    setLocation(`/pms/work-order/${wo.id}`);
  };

  const handleExportPdf = () => {
    const columns: TableColumn[] = [
      { header: 'Vessel', field: 'vessel', width: 20 },
      { header: 'Component', field: 'component', width: 30 },
      { header: 'Work Order No', field: 'workOrderNo', width: 30 },
      { header: 'Job Title', field: 'jobTitle', width: 40 },
      { header: 'Assigned To', field: 'assignedTo', width: 20 },
      { header: 'Due Date', field: 'dueDate', width: 18 },
      { header: 'Status', field: 'status', width: 15 },
      { header: 'Criticality', field: 'criticality', width: 15 },
    ];

    const data = workOrders.map((wo) => ({
      vessel: (wo.vesselId ? vesselMap.get(wo.vesselId) : undefined) || '-',
      component: wo.component || '-',
      workOrderNo: wo.workOrderNo || '-',
      jobTitle: wo.jobTitle || '-',
      assignedTo: wo.assignedTo || '-',
      dueDate: formatDate(wo.dueDate),
      status: wo.computedStatus || wo.status || '-',
      criticality: wo.jobPriority || '-',
    }));

    pdfReportGenerator.generateReport(
      {
        title,
        subtitle: `Total: ${workOrders.length} work order${workOrders.length !== 1 ? 's' : ''}`,
        orientation: 'landscape',
      },
      columns,
      data
    );
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateStr;
    }
    return dateStr;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Overdue': return 'bg-red-500';
      case 'Due': case 'Due (Grace P)': return 'bg-orange-500';
      case 'Pending Approval': return 'bg-blue-600';
      case 'Completed': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getCriticalityBadgeColor = (criticality: string) => {
    switch (criticality) {
      case 'Critical': return 'bg-red-500';
      case 'High': return 'bg-orange-500';
      case 'Medium': return 'bg-yellow-500';
      case 'Low': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Vessel',
      field: 'vesselId',
      width: 120,
      flex: 0,
      valueFormatter: (params: any) => {
        return params.value ? vesselMap.get(params.value) || params.value : '-';
      },
    },
    {
      headerName: 'Component',
      field: 'component',
      minWidth: 160,
      flex: 1,
      cellRenderer: (params: any) => (
        <span className="font-medium text-blue-600">{params.value || '-'}</span>
      ),
    },
    {
      headerName: 'Work Order No',
      field: 'workOrderNo',
      minWidth: 160,
      flex: 1,
      valueFormatter: (params: any) => params.value || '-',
    },
    {
      headerName: 'Job Title',
      field: 'jobTitle',
      minWidth: 200,
      flex: 2,
      valueFormatter: (params: any) => params.value || '-',
      tooltipField: 'jobTitle',
    },
    {
      headerName: 'Assigned To',
      field: 'assignedTo',
      width: 120,
      flex: 0,
      valueFormatter: (params: any) => params.value || '-',
    },
    {
      headerName: 'Due Date',
      field: 'dueDate',
      width: 100,
      flex: 0,
      valueFormatter: (params: any) => formatDate(params.value),
    },
    {
      headerName: 'Status',
      field: 'status',
      width: 120,
      flex: 0,
      cellRenderer: (params: any) => {
        const effectiveStatus = params.data?.computedStatus || params.value || 'Active';
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${getStatusBadgeColor(effectiveStatus)}`}>
            {effectiveStatus}
          </span>
        );
      },
    },
    {
      headerName: 'Criticality',
      field: 'jobPriority',
      width: 100,
      flex: 0,
      cellRenderer: (params: any) => {
        if (params.value) {
          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${getCriticalityBadgeColor(params.value)}`}>
              {params.value}
            </span>
          );
        }
        return <span className="text-gray-400 text-xs">-</span>;
      },
    },
    {
      headerName: 'Actions',
      field: 'id',
      width: 80,
      flex: 0,
      sortable: false,
      resizable: false,
      cellRenderer: (params: any) => (
        <div className="flex gap-1 justify-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditClick(params.data);
                  }}
                  data-testid={`modal-edit-wo-${params.data?.id}`}
                >
                  <Pen className="h-4 w-4 text-gray-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
    },
  ], [vesselMap]);

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-[90vw] h-[calc(100vh-10vw)] max-h-[90vh] overflow-hidden flex flex-col [&>button.absolute]:top-6 [&>button.absolute]:translate-y-1">
          <DialogHeader className="pb-4 flex flex-row items-center justify-between gap-4">
            <DialogTitle className="text-xl font-semibold text-[#0f4c81]">
              {title}
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-[#8798ad] border-[#e1e8ed] mr-8"
              onClick={handleExportPdf}
              data-testid="button-export-wo-pdf"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </Button>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <WOAgGridTable
              columnDefs={columnDefs}
              rowData={workOrders}
              height="100%"
              noRowsMessage="No work orders found"
              testId="wo-list-modal-grid"
            />
          </div>

          <div className="border-t pt-3 flex justify-between items-center text-sm text-gray-600">
            <span>Total: {workOrders.length} work order{workOrders.length !== 1 ? "s" : ""}</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
