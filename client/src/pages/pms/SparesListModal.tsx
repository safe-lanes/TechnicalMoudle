import { useState, useMemo } from "react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { pdfReportGenerator } from "@/lib/pdfReportGenerator";
import type { TableColumn } from "@/lib/pdfReportGenerator";

interface SpareItem {
  id: number;
  partNumber: string;
  partName: string;
  partCode?: string;
  rob: number;
  min: number;
  critical: string;
  componentName?: string;
  vesselId?: string;
}

interface SparesListModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  spares: SpareItem[];
  vessels?: { id: string; name: string }[];
  getStockStatus: (rob: number, min: number) => { label: string; isLow: boolean };
}

export function SparesListModal({ open, onClose, title, spares, vessels = [], getStockStatus }: SparesListModalProps) {
  const [detailSpare, setDetailSpare] = useState<SpareItem | null>(null);

  const vesselMap = useMemo(() => {
    const map = new Map<string, string>();
    vessels.forEach(v => map.set(v.id, v.name));
    return map;
  }, [vessels]);

  const getStockBadgeColor = (label: string) => {
    switch (label) {
      case 'Low': return 'bg-red-500';
      case 'At Min': return 'bg-orange-500';
      case 'OK': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getCriticalityBadgeColor = (critical: string | null | undefined) => {
    const val = String(critical ?? '').toLowerCase();
    if (val === 'critical' || val === 'yes') return 'bg-red-500';
    return 'bg-gray-400';
  };

  const handleExportPdf = () => {
    const columns: TableColumn[] = [
      { header: 'Vessel', field: 'vessel', width: 20 },
      { header: 'Part Code', field: 'partCode', width: 20 },
      { header: 'Part Name', field: 'partName', width: 40 },
      { header: 'Component', field: 'component', width: 30 },
      { header: 'ROB', field: 'rob', width: 12 },
      { header: 'Min', field: 'min', width: 12 },
      { header: 'Stock Status', field: 'stockStatus', width: 15 },
      { header: 'Criticality', field: 'criticality', width: 15 },
    ];

    const data = spares.map((spare) => ({
      vessel: (spare.vesselId ? vesselMap.get(spare.vesselId) : undefined) || '-',
      partCode: spare.partCode || spare.partNumber || '-',
      partName: spare.partName || '-',
      component: spare.componentName || '-',
      rob: spare.rob?.toString() || '0',
      min: spare.min?.toString() || '0',
      stockStatus: getStockStatus(spare.rob, spare.min).label,
      criticality: String(spare.critical ?? '-'),
    }));

    pdfReportGenerator.generateReport(
      {
        title,
        subtitle: `Total: ${spares.length} spare${spares.length !== 1 ? 's' : ''}`,
        orientation: 'landscape',
      },
      columns,
      data
    );
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
              data-testid="button-export-spares-pdf"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </Button>
          </DialogHeader>

          <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-[#eff6ff] z-10">
                <TableRow>
                  <TableHead className="font-medium w-[120px] bg-[#eff6ff] text-[#0e4c81]">Vessel</TableHead>
                  <TableHead className="font-medium w-[120px] bg-[#eff6ff] text-[#0e4c81]">Part Code</TableHead>
                  <TableHead className="font-medium min-w-[200px] bg-[#eff6ff] text-[#0e4c81]">Part Name</TableHead>
                  <TableHead className="font-medium w-[160px] bg-[#eff6ff] text-[#0e4c81]">Component</TableHead>
                  <TableHead className="font-medium w-[80px] bg-[#eff6ff] text-[#0e4c81]">ROB</TableHead>
                  <TableHead className="font-medium w-[80px] bg-[#eff6ff] text-[#0e4c81]">Min</TableHead>
                  <TableHead className="font-medium w-[100px] bg-[#eff6ff] text-[#0e4c81]">Stock Status</TableHead>
                  <TableHead className="font-medium w-[100px] bg-[#eff6ff] text-[#0e4c81]">Criticality</TableHead>
                  <TableHead className="font-medium w-[80px] text-center bg-[#eff6ff] text-[#0e4c81]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spares.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      No spares found
                    </TableCell>
                  </TableRow>
                ) : (
                  spares.map((spare) => {
                    const stockStatus = getStockStatus(spare.rob, spare.min);
                    return (
                      <TableRow key={`${spare.vesselId || 'v'}-${spare.id}`} className="hover:bg-gray-50" data-testid={`row-spare-${spare.vesselId || 'v'}-${spare.id}`}>
                        <TableCell>{spare.vesselId ? vesselMap.get(spare.vesselId) || spare.vesselId : '-'}</TableCell>
                        <TableCell>{spare.partCode || spare.partNumber || '-'}</TableCell>
                        <TableCell className="whitespace-normal break-words max-w-[300px] font-medium text-blue-600">
                          {spare.partName || '-'}
                        </TableCell>
                        <TableCell>{spare.componentName || '-'}</TableCell>
                        <TableCell>{spare.rob}</TableCell>
                        <TableCell>{spare.min}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${getStockBadgeColor(stockStatus.label)}`}>
                            {stockStatus.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${getCriticalityBadgeColor(spare.critical)}`}>
                            {spare.critical}
                          </span>
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
                                    onClick={() => setDetailSpare(spare)}
                                    data-testid={`modal-view-spare-${spare.vesselId || 'v'}-${spare.id}`}
                                  >
                                    <Eye className="h-4 w-4 text-gray-500" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View Details</TooltipContent>
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
            <span>Total: {spares.length} spare{spares.length !== 1 ? "s" : ""}</span>
          </div>
        </DialogContent>
      </Dialog>

      {detailSpare && (
        <Dialog open={!!detailSpare} onOpenChange={(isOpen) => !isOpen && setDetailSpare(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-[#0f4c81]">
                Spare Part Details
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mt-2">
              <div>
                <span className="text-gray-500 text-xs">Vessel</span>
                <p className="font-medium" data-testid="text-detail-vessel">
                  {detailSpare.vesselId ? vesselMap.get(detailSpare.vesselId) || detailSpare.vesselId : '-'}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Part Code</span>
                <p className="font-medium" data-testid="text-detail-part-code">
                  {detailSpare.partCode || detailSpare.partNumber || '-'}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 text-xs">Part Name</span>
                <p className="font-medium" data-testid="text-detail-part-name">{detailSpare.partName || '-'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 text-xs">Component</span>
                <p className="font-medium" data-testid="text-detail-component">{detailSpare.componentName || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">ROB</span>
                <p className="font-medium" data-testid="text-detail-rob">{detailSpare.rob}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Min</span>
                <p className="font-medium" data-testid="text-detail-min">{detailSpare.min}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Stock Status</span>
                <p data-testid="text-detail-stock-status">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${getStockBadgeColor(getStockStatus(detailSpare.rob, detailSpare.min).label)}`}>
                    {getStockStatus(detailSpare.rob, detailSpare.min).label}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Criticality</span>
                <p data-testid="text-detail-criticality">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${getCriticalityBadgeColor(detailSpare.critical)}`}>
                    {detailSpare.critical || '-'}
                  </span>
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
