import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TablePagination, usePagination } from "@/components/reports/TablePagination";
import { X } from "lucide-react";

export interface ReportColumn {
  header: string;
  field: string;
  width?: number;
}

export interface ReportSummaryItem {
  label: string;
  value: string | number;
  color?: string;
}

export interface ReportPreviewData {
  title: string;
  subtitle?: string;
  vessel?: string;
  dateRange?: string;
  columns: ReportColumn[];
  data: Record<string, any>[];
  summary?: ReportSummaryItem[];
}

interface ReportPreviewModalProps {
  open: boolean;
  onClose: () => void;
  reportData: ReportPreviewData | null;
}

const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({ open, onClose, reportData }) => {
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, resetPage, paginateItems } = usePagination(50);

  useEffect(() => {
    resetPage();
  }, [reportData]);

  if (!reportData) return null;

  const { title, subtitle, vessel, columns, data, summary } = reportData;
  const paginatedData = paginateItems(data);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2 flex-shrink-0 border-b">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
              {subtitle && (
                <DialogDescription className="text-sm mt-1">{subtitle}</DialogDescription>
              )}
              {vessel && (
                <p className="text-xs text-muted-foreground mt-1">Vessel: {vessel}</p>
              )}
              {reportData.dateRange && (
                <p className="text-xs text-muted-foreground mt-1" data-testid="text-report-date-range">Report Period: {reportData.dateRange}</p>
              )}
            </div>
            <Badge variant="secondary" className="flex-shrink-0">
              {data.length} {data.length === 1 ? 'record' : 'records'}
            </Badge>
          </div>
        </DialogHeader>

        {summary && summary.length > 0 && (
          <div className="flex flex-wrap gap-3 p-4 pb-2 flex-shrink-0 border-b bg-muted/30">
            {summary.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border text-sm"
              >
                <span className="text-muted-foreground">{item.label}:</span>
                <span className={`font-semibold ${item.color === 'highlight' ? 'text-red-600' : ''}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 pt-2">
          {data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium mb-1">No data available</p>
              <p className="text-sm">No records match the current filters.</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse" data-testid="report-preview-table">
              <thead>
                <tr className="bg-muted/50 sticky top-0 z-10">
                  {columns.map((col, idx) => (
                    <th
                      key={idx}
                      className="text-left py-2 px-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider border-b whitespace-nowrap"
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row, rowIdx) => {
                  const globalIdx = (currentPage - 1) * pageSize + rowIdx;
                  return (
                    <tr
                      key={globalIdx}
                      className="border-b last:border-b-0 hover:bg-muted/30"
                      data-testid={`report-preview-row-${globalIdx}`}
                    >
                      {columns.map((col, colIdx) => {
                        const value = row[col.field];
                        let displayValue: string;
                        if (col.field === 'sNo') {
                          displayValue = String(globalIdx + 1);
                        } else {
                          displayValue = value === null || value === undefined ? '-' : String(value);
                        }
                        return (
                          <td
                            key={colIdx}
                            className="py-2 px-3 text-foreground whitespace-nowrap"
                          >
                            {displayValue}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {data.length > 0 && (
          <div className="flex-shrink-0 border-t px-4 py-2 bg-muted/20">
            <TablePagination
              totalItems={data.length}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              pageSizeOptions={[25, 50, 100, 200]}
            />
          </div>
        )}

        <div className="flex-shrink-0 border-t p-3 flex justify-end">
          <Button variant="outline" onClick={onClose} data-testid="button-close-preview">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportPreviewModal;
