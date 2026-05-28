import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import ReportAgGridTable from "@/components/reports/ReportAgGridTable";

export interface ReportColumn {
  header: string;
  field: string;
  width?: number;
  flex?: number;
  minWidth?: number;
  sortable?: boolean;
  filter?: boolean;
  wrapText?: boolean;
  autoHeight?: boolean;
  cellStyle?: Record<string, any>;
  cellRenderer?: (params: any) => React.ReactNode;
  headerComponent?: () => React.ReactNode;
  headerClass?: string;
  cellClass?: string | ((params: any) => string | string[] | undefined);
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
  reportId?: string | null;
}

interface ReportPreviewModalProps {
  open: boolean;
  onClose: () => void;
  reportData: ReportPreviewData | null;
}

const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({ open, onClose, reportData }) => {
  if (!reportData) return null;

  const { title, subtitle, vessel, columns, data, summary } = reportData;

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

        <div className="flex-1 overflow-hidden p-4 pt-2">
          <ReportAgGridTable columns={columns} data={data} height="calc(90vh - 280px)" reportId={reportData.reportId} />
        </div>

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
