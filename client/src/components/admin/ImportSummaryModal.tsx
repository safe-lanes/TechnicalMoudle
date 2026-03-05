import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  XCircle,
  MinusCircle,
  FileDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface ImportSummaryRow {
  rowNumber: number;
  primaryIdentifier: string;
  status: "success" | "failed" | "skipped";
  error?: string;
  data?: Record<string, any>;
}

interface ImportCounts {
  created: number;
  updated: number;
  skipped: number;
  archived: number;
}

interface ImportSummaryModalProps {
  open: boolean;
  onClose: () => void;
  summaryData: ImportSummaryRow[];
  importCounts: ImportCounts;
  templateType: string;
  previewColumns?: string[];
  fileName?: string;
}

type StatusFilterType = "all" | "success" | "failed" | "skipped";

const PRIMARY_IDENTIFIER_LABELS: Record<string, string> = {
  components: "Component Code",
  jobs: "Job Code",
  spares: "Part Code",
  stores: "Item Code",
  makers: "Maker Code",
  "fleet-components": "Equipment Code",
  "fleet-jobs": "Job Code",
  "fleet-spares": "Part Code",
  "work-orders": "Work Order Code",
};

export default function ImportSummaryModal({
  open,
  onClose,
  summaryData,
  importCounts,
  templateType,
  previewColumns,
  fileName,
}: ImportSummaryModalProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const totalRecords = summaryData.length;
  const successCount = summaryData.filter((r) => r.status === "success").length;
  const failedCount = summaryData.filter((r) => r.status === "failed").length;
  const skippedCount = summaryData.filter((r) => r.status === "skipped").length;

  const filteredRows =
    statusFilter === "all"
      ? summaryData
      : summaryData.filter((r) => r.status === statusFilter);

  const totalPages = Math.ceil(filteredRows.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + pageSize);

  const primaryIdLabel =
    PRIMARY_IDENTIFIER_LABELS[templateType] || "Identifier";

  const handleFilterClick = (filter: StatusFilterType) => {
    setStatusFilter((prev) => (prev === filter ? "all" : filter));
    setCurrentPage(1);
  };

  const handlePageSizeChange = (newSize: string) => {
    setPageSize(Number(newSize));
    setCurrentPage(1);
  };

  const handleExportSummary = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/technical/api/bulk/export-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: summaryData,
          templateType,
          previewColumns: previewColumns || [],
          fileName: fileName || "import",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to export summary");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `import_summary_${templateType}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Summary Exported",
        description: "Import summary has been downloaded as Excel.",
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export summary.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const displayColumns = (previewColumns || []).filter(
    (col) =>
      col.toLowerCase() !== "row" &&
      col.toLowerCase() !== "status" &&
      col.toLowerCase() !== "error"
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="max-w-5xl max-h-[85vh] flex flex-col overflow-hidden"
        data-testid="import-summary-modal"
      >
        <DialogHeader>
          <DialogTitle data-testid="text-summary-title">
            Import Summary
            {fileName && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                — {fileName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3" data-testid="summary-statistics">
          <Card data-testid="stat-total">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold" data-testid="text-total-count">
                {totalRecords}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Records Processed
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-success">
            <CardContent className="p-4 text-center">
              <div
                className="text-2xl font-bold text-green-600"
                data-testid="text-success-count"
              >
                {successCount}
              </div>
              <div className="text-sm text-muted-foreground">
                Successfully Imported
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Created: {importCounts.created} | Updated:{" "}
                {importCounts.updated}
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-failed">
            <CardContent className="p-4 text-center">
              <div
                className="text-2xl font-bold text-red-600"
                data-testid="text-failed-count"
              >
                {failedCount}
              </div>
              <div className="text-sm text-muted-foreground">
                Failed Records
              </div>
              {skippedCount > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Skipped: {skippedCount}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div
          className="flex items-center justify-between gap-2 flex-wrap"
          data-testid="summary-filters"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={statusFilter === "all" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => handleFilterClick("all")}
              data-testid="filter-all"
            >
              All ({totalRecords})
            </Badge>
            <Badge
              variant={statusFilter === "success" ? "default" : "outline"}
              className={`cursor-pointer ${statusFilter === "success" ? "bg-green-600" : ""}`}
              onClick={() => handleFilterClick("success")}
              data-testid="filter-success"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Success ({successCount})
            </Badge>
            <Badge
              variant={statusFilter === "failed" ? "default" : "outline"}
              className={`cursor-pointer ${statusFilter === "failed" ? "bg-red-600" : ""}`}
              onClick={() => handleFilterClick("failed")}
              data-testid="filter-failed"
            >
              <XCircle className="h-3 w-3 mr-1" />
              Failed ({failedCount})
            </Badge>
            {skippedCount > 0 && (
              <Badge
                variant={statusFilter === "skipped" ? "default" : "outline"}
                className={`cursor-pointer ${statusFilter === "skipped" ? "bg-gray-600" : ""}`}
                onClick={() => handleFilterClick("skipped")}
                data-testid="filter-skipped"
              >
                <MinusCircle className="h-3 w-3 mr-1" />
                Skipped ({skippedCount})
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            onClick={handleExportSummary}
            disabled={isExporting}
            data-testid="button-export-summary"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Export Summary to Excel
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <Table data-testid="summary-table">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Row</TableHead>
                <TableHead>{primaryIdLabel}</TableHead>
                {displayColumns.slice(0, 3).map((col) => (
                  <TableHead key={col}>{col}</TableHead>
                ))}
                <TableHead className="w-24">Status</TableHead>
                <TableHead>Error / Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4 + displayColumns.slice(0, 3).length}
                    className="text-center text-muted-foreground py-8"
                    data-testid="text-no-rows"
                  >
                    No records to display
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row) => (
                  <TableRow
                    key={row.rowNumber}
                    className={
                      row.status === "failed"
                        ? "bg-red-50 dark:bg-red-950/20"
                        : ""
                    }
                    data-testid={`row-summary-${row.rowNumber}`}
                  >
                    <TableCell className="font-mono text-sm">
                      {row.rowNumber}
                    </TableCell>
                    <TableCell
                      className="font-medium"
                      data-testid={`text-identifier-${row.rowNumber}`}
                    >
                      {row.primaryIdentifier || "—"}
                    </TableCell>
                    {displayColumns.slice(0, 3).map((col) => (
                      <TableCell key={col} className="text-sm">
                        {row.data?.[col] ?? "—"}
                      </TableCell>
                    ))}
                    <TableCell>
                      {row.status === "success" && (
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800 no-default-hover-elevate no-default-active-elevate"
                          data-testid={`badge-status-${row.rowNumber}`}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Success
                        </Badge>
                      )}
                      {row.status === "failed" && (
                        <Badge
                          variant="outline"
                          className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800 no-default-hover-elevate no-default-active-elevate"
                          data-testid={`badge-status-${row.rowNumber}`}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                      {row.status === "skipped" && (
                        <Badge
                          variant="outline"
                          className="bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/30 dark:text-gray-400 dark:border-gray-800 no-default-hover-elevate no-default-active-elevate"
                          data-testid={`badge-status-${row.rowNumber}`}
                        >
                          <MinusCircle className="h-3 w-3 mr-1" />
                          Skipped
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-sm max-w-xs truncate"
                      title={row.error || ""}
                      data-testid={`text-error-${row.rowNumber}`}
                    >
                      {row.error || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {totalPages > 0 && (
          <div
            className="flex items-center justify-between gap-2 pt-2 border-t flex-wrap"
            data-testid="summary-pagination"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={handlePageSizeChange}
              >
                <SelectTrigger
                  className="w-20"
                  data-testid="select-page-size"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {startIndex + 1}–{Math.min(startIndex + pageSize, filteredRows.length)} of{" "}
                {filteredRows.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                data-testid="button-first-page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm px-2" data-testid="text-page-info">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages}
                data-testid="button-next-page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                data-testid="button-last-page"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
