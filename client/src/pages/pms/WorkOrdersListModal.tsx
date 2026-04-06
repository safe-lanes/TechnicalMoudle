import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Download } from "lucide-react";
import { pdfReportGenerator } from "@/lib/pdfReportGenerator";
import type { TableColumn } from "@/lib/pdfReportGenerator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import WorkOrderForm from "@/components/WorkOrderForm";
import type { WorkOrder } from "@shared/schema";

interface WorkOrdersListModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  workOrders: WorkOrder[];
}

export function WorkOrdersListModal({ open, onClose, title, workOrders }: WorkOrdersListModalProps) {
  const [viewModal, setViewModal] = useState<{ open: boolean; workOrder: WorkOrder | null }>({
    open: false,
    workOrder: null,
  });

  const handleViewClick = (wo: WorkOrder) => {
    setViewModal({ open: true, workOrder: wo });
  };

  const handleExportPdf = () => {
    const columns: TableColumn[] = [
      { header: 'Component', field: 'component', width: 30 },
      { header: 'Work Order No', field: 'workOrderNo', width: 30 },
      { header: 'Job Title', field: 'jobTitle', width: 40 },
      { header: 'Assigned To', field: 'assignedTo', width: 20 },
      { header: 'Due Date', field: 'dueDate', width: 18 },
      { header: 'Status', field: 'status', width: 15 },
      { header: 'Criticality', field: 'criticality', width: 15 },
    ];

    const data = workOrders.map((wo) => ({
      component: wo.component || '-',
      workOrderNo: wo.workOrderNo || '-',
      jobTitle: wo.jobTitle || '-',
      assignedTo: wo.assignedTo || '-',
      dueDate: formatDate(wo.dueDate),
      status: (wo as any).computedStatus || wo.status || '-',
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

          <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-[#eff6ff] z-10">
                <TableRow>
                  <TableHead className="font-medium w-[160px] bg-[#eff6ff] text-[#0e4c81]">Component</TableHead>
                  <TableHead className="font-medium w-[160px] bg-[#eff6ff] text-[#0e4c81]">Work Order No</TableHead>
                  <TableHead className="font-medium min-w-[200px] bg-[#eff6ff] text-[#0e4c81]">Job Title</TableHead>
                  <TableHead className="font-medium w-[120px] bg-[#eff6ff] text-[#0e4c81]">Assigned To</TableHead>
                  <TableHead className="font-medium w-[100px] bg-[#eff6ff] text-[#0e4c81]">Due Date</TableHead>
                  <TableHead className="font-medium w-[100px] bg-[#eff6ff] text-[#0e4c81]">Status</TableHead>
                  <TableHead className="font-medium w-[100px] bg-[#eff6ff] text-[#0e4c81]">Criticality</TableHead>
                  <TableHead className="font-medium w-[80px] text-center bg-[#eff6ff] text-[#0e4c81]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No work orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  workOrders.map((wo) => {
                    const effectiveStatus = (wo as any).computedStatus || wo.status || 'Active';
                    return (
                      <TableRow key={wo.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium text-blue-600">
                          {wo.component || '-'}
                        </TableCell>
                        <TableCell>{wo.workOrderNo || '-'}</TableCell>
                        <TableCell className="whitespace-normal break-words max-w-[300px]">
                          {wo.jobTitle || '-'}
                        </TableCell>
                        <TableCell>{wo.assignedTo || '-'}</TableCell>
                        <TableCell>{formatDate(wo.dueDate)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${getStatusBadgeColor(effectiveStatus)}`}>
                            {effectiveStatus}
                          </span>
                        </TableCell>
                        <TableCell>
                          {wo.jobPriority ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${getCriticalityBadgeColor(wo.jobPriority)}`}>
                              {wo.jobPriority}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-center">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => handleViewClick(wo)}
                                    data-testid={`modal-view-wo-${wo.id}`}
                                  >
                                    <Eye className="h-4 w-4 text-gray-500" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="border-t pt-3 flex justify-between items-center text-sm text-gray-600">
            <span>Total: {workOrders.length} work order{workOrders.length !== 1 ? "s" : ""}</span>
          </div>
        </DialogContent>
      </Dialog>

      {viewModal.workOrder && (
        <WorkOrderForm
          isOpen={viewModal.open}
          onClose={() => setViewModal({ open: false, workOrder: null })}
          workOrder={viewModal.workOrder}
          mode="template"
        />
      )}
    </>
  );
}
