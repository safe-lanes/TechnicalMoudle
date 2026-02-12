import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, ArrowLeft, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FleetComponent {
  id: number;
  fleetEquipmentCode: string;
  fleetEquipmentName: string;
  maker?: string | null;
  makerCode?: string | null;
  model?: string | null;
  modelCode?: string | null;
}

export default function MasterDataTableView({ onBack }: { onBack?: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: fleetComponents = [], isLoading } = useQuery<FleetComponent[]>({
    queryKey: ['/technical/api/fleet-admin/fleet-components'],
  });

  const filteredData = useMemo(() => {
    if (!searchQuery) return fleetComponents;
    const query = searchQuery.toLowerCase();
    return fleetComponents.filter((item) =>
      item.fleetEquipmentCode?.toLowerCase().includes(query) ||
      item.fleetEquipmentName?.toLowerCase().includes(query) ||
      item.maker?.toLowerCase().includes(query) ||
      item.makerCode?.toLowerCase().includes(query) ||
      item.model?.toLowerCase().includes(query) ||
      item.modelCode?.toLowerCase().includes(query)
    );
  }, [fleetComponents, searchQuery]);

  const handleExport = () => {
    if (!filteredData.length) return;

    const headers = [
      'Sl No', 'Fleet Equipment Code', 'Fleet Equipment Name',
      'Maker', 'Maker Code', 'Model', 'Model Code'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredData.map((item, index) => [
        index + 1,
        `"${item.fleetEquipmentCode || ''}"`,
        `"${item.fleetEquipmentName || ''}"`,
        `"${item.maker || ''}"`,
        `"${item.makerCode || ''}"`,
        `"${item.model || ''}"`,
        `"${item.modelCode || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'master-data-export.csv';
    link.click();
  };

  return (
    <div className="p-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Table2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white" data-testid="text-master-data-title">Master Data Table View</h1>
                <p className="text-cyan-100 text-sm mt-0.5">Fleet component master data (Read-Only)</p>
              </div>
            </div>
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-cyan-100 hover:text-white text-sm transition-colors"
                data-testid="button-back-to-dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </button>
            )}
          </div>
        </div>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl font-semibold">Master Data</CardTitle>
              <Badge variant="secondary" data-testid="badge-total-count">
                {filteredData.length} Records
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={!filteredData.length}
                data-testid="button-export-master-data"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search master data..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-master-data"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap w-16">Sl No</TableHead>
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">Fleet Equipment Code</TableHead>
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">Fleet Equipment Name</TableHead>
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">Maker</TableHead>
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">Maker Code</TableHead>
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">Model</TableHead>
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">Model Code</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500" data-testid="text-no-data">
                        No fleet component master data found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((item, index) => (
                      <TableRow
                        key={item.id}
                        className="hover:bg-gray-50"
                        data-testid={`row-master-data-${item.id}`}
                      >
                        <TableCell className="text-sm text-gray-500">{index + 1}</TableCell>
                        <TableCell className="text-sm font-mono">{item.fleetEquipmentCode || '-'}</TableCell>
                        <TableCell className="text-sm">{item.fleetEquipmentName || '-'}</TableCell>
                        <TableCell className="text-sm">{item.maker || '-'}</TableCell>
                        <TableCell className="text-sm">{item.makerCode || '-'}</TableCell>
                        <TableCell className="text-sm">{item.model || '-'}</TableCell>
                        <TableCell className="text-sm">{item.modelCode || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
