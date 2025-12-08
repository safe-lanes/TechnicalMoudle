import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, Plus, Edit } from "lucide-react";

interface MasterDataResponse {
  items: MasterDataEntry[];
  total: number;
  limit: number;
  offset: number;
}

interface MasterDataEntry {
  id: number;
  slNo?: number;
  makerName: string;
  makerCode: string;
  countMaker?: number;
  model: string;
  modelCode: string;
  countSfiCode?: number;
  fleetEquipmentCode: string;
  sfiCode: string;
  assignedSubCode?: string;
  vesselName?: string;
  vesselCode?: string;
  equipmentName: string;
  isActive: boolean;
}

export default function MasterDataTableView() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: masterDataResponse, isLoading } = useQuery<MasterDataResponse>({
    queryKey: ['/api/fleet-admin/master-data', 'table-view'],
  });

  const masterDataItems = masterDataResponse?.items || [];

  const filteredData = masterDataItems.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.makerName?.toLowerCase().includes(query) ||
      item.makerCode?.toLowerCase().includes(query) ||
      item.model?.toLowerCase().includes(query) ||
      item.modelCode?.toLowerCase().includes(query) ||
      item.fleetEquipmentCode?.toLowerCase().includes(query) ||
      item.sfiCode?.toLowerCase().includes(query) ||
      item.vesselName?.toLowerCase().includes(query) ||
      item.equipmentName?.toLowerCase().includes(query)
    );
  });

  const handleExport = () => {
    if (!filteredData.length) return;
    
    const headers = [
      'Maker Name', 'Maker Code', 'Count_Maker', 'Model', 'Model Code', 
      'Count_SFI', 'Fleet Equipment Code', 'SFI Code', 'Assigned Sub Code', 
      'Vessel Name', 'Equipment Name'
    ];
    
    const csvContent = [
      headers.join(','),
      ...filteredData.map(item => [
        `"${item.makerName || ''}"`,
        `"${item.makerCode || ''}"`,
        item.countMaker || 0,
        `"${item.model || ''}"`,
        `"${item.modelCode || ''}"`,
        item.countSfiCode || 0,
        `"${item.fleetEquipmentCode || ''}"`,
        `"${item.sfiCode || ''}"`,
        `"${item.assignedSubCode || ''}"`,
        `"${item.vesselName || ''}"`,
        `"${item.equipmentName || ''}"`
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
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-xl font-semibold">Master Data</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {}}
                data-testid="button-edit-master-data"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                size="sm"
                onClick={() => {}}
                data-testid="button-add-new-master-data"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New
              </Button>
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
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">Maker Name</TableHead>
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">Maker Code</TableHead>
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">Count_Maker</TableHead>
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">Model</TableHead>
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">Model Code</TableHead>
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">Count_SFI</TableHead>
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">Fleet Equipment Code</TableHead>
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">SFI Code</TableHead>
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">Assigned Sub Code</TableHead>
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">Vessel Name</TableHead>
                    <TableHead className="text-white font-semibold text-xs whitespace-nowrap">Equipment Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                        No master data found. Click "Add New" to create the first entry.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((item, index) => (
                      <TableRow key={item.id || index} className="hover:bg-gray-50" data-testid={`row-master-data-${item.id || index}`}>
                        <TableCell className="text-sm">{item.makerName || '-'}</TableCell>
                        <TableCell className="text-sm">{item.makerCode || '-'}</TableCell>
                        <TableCell className="text-sm">{item.countMaker || 0}</TableCell>
                        <TableCell className="text-sm">{item.model || '-'}</TableCell>
                        <TableCell className="text-sm">{item.modelCode || '-'}</TableCell>
                        <TableCell className="text-sm">{item.countSfiCode || 0}</TableCell>
                        <TableCell className="text-sm">{item.fleetEquipmentCode || '-'}</TableCell>
                        <TableCell className="text-sm">{item.sfiCode || '-'}</TableCell>
                        <TableCell className="text-sm">{item.assignedSubCode || '-'}</TableCell>
                        <TableCell className="text-sm">{item.vesselName || '-'}</TableCell>
                        <TableCell className="text-sm">{item.equipmentName || '-'}</TableCell>
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
