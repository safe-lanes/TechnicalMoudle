import { useMemo } from "react";
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
import { Download } from "lucide-react";
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {spares.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
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
  );
}
