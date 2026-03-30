import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { TablePagination, usePagination } from "@/components/reports/TablePagination";
import type { ReportPreviewData, ReportColumn } from "@/components/reports/ReportPreviewModal";

interface InlineReportPreviewProps {
  reportData: ReportPreviewData | null;
  onClose?: () => void;
}

const InlineReportPreview: React.FC<InlineReportPreviewProps> = ({ reportData, onClose }) => {
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, resetPage, paginateItems } = usePagination(50);

  useEffect(() => {
    resetPage();
  }, [reportData]);

  if (!reportData) return null;

  const { title, subtitle, vessel, columns, data, summary } = reportData;
  const paginatedData = paginateItems(data);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-background" data-testid="inline-report-preview">
      <div className="p-4 pb-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-foreground">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500 dark:text-muted-foreground mt-0.5">{subtitle}</p>}
            {vessel && <p className="text-xs text-gray-400 dark:text-muted-foreground mt-0.5">Vessel: {vessel}</p>}
            {reportData.dateRange && <p className="text-xs text-gray-400 dark:text-muted-foreground mt-0.5">Period: {reportData.dateRange}</p>}
          </div>
          <Badge variant="secondary" className="flex-shrink-0">
            {data.length} {data.length === 1 ? 'record' : 'records'}
          </Badge>
        </div>
      </div>

      {summary && summary.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
          {summary.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-background border text-sm">
              <span className="text-gray-500 dark:text-muted-foreground">{item.label}:</span>
              <span className={`font-semibold ${item.color === 'highlight' ? 'text-red-600' : 'text-gray-900 dark:text-foreground'}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-auto max-h-[60vh]">
        {data.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-muted-foreground">
            <p className="text-base font-medium mb-1">No data available</p>
            <p className="text-sm">No records match the current filters.</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse" data-testid="inline-preview-table">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
                {columns.map((col: ReportColumn, idx: number) => (
                  <th key={idx} className="text-left py-2 px-3 font-semibold text-xs text-gray-500 dark:text-muted-foreground uppercase tracking-wider border-b whitespace-nowrap">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row: Record<string, unknown>, rowIdx: number) => {
                const globalIdx = (currentPage - 1) * pageSize + rowIdx;
                return (
                  <tr key={globalIdx} className="border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-900/30" data-testid={`inline-preview-row-${globalIdx}`}>
                    {columns.map((col: ReportColumn, colIdx: number) => {
                      const value = row[col.field];
                      const displayValue = col.field === 'sNo'
                        ? String(globalIdx + 1)
                        : (value === null || value === undefined ? '-' : String(value));
                      return (
                        <td key={colIdx} className="py-2 px-3 text-gray-900 dark:text-foreground whitespace-nowrap">
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
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 bg-gray-50/50 dark:bg-gray-900/20">
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
    </div>
  );
};

export default InlineReportPreview;
