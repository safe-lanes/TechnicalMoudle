import { Badge } from "@/components/ui/badge";
import ReportAgGridTable from "@/components/reports/ReportAgGridTable";
import type { ReportPreviewData } from "@/components/reports/ReportPreviewModal";

interface InlineReportPreviewProps {
  reportData: ReportPreviewData | null;
  onClose?: () => void;
  embedded?: boolean;
}

const InlineReportPreview: React.FC<InlineReportPreviewProps> = ({ reportData, onClose, embedded }) => {
  if (!reportData) return null;

  const { title, subtitle, vessel, columns, data, summary } = reportData;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-background" data-testid="inline-report-preview">
      {!embedded && (
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
      )}

      {!embedded && summary && summary.length > 0 && (
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

      <ReportAgGridTable columns={columns} data={data} height="60vh" reportId={reportData.reportId} />
    </div>
  );
};

export default InlineReportPreview;
