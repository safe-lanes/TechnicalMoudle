import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Download, ArrowLeft, Table2, Ship, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FleetComponent {
  id: number;
  fleetEquipmentCode: string;
  fleetEquipmentName: string;
  makerName?: string | null;
  makerCode?: string | null;
  model?: string | null;
  modelCode?: string | null;
}

interface VesselMapping {
  id: number;
  fleetEquipmentCode: string;
  vesselCode: string;
  vesselName?: string | null;
  mappedBy: string;
  mappedAt: string;
  isActive: boolean;
}

export default function MasterDataTableView({ onBack }: { onBack?: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedComponent, setSelectedComponent] = useState<FleetComponent | null>(null);

  const { data: fleetComponents = [], isLoading } = useQuery<FleetComponent[]>({
    queryKey: ['/technical/api/fleet-admin/fleet-components'],
  });

  const { data: vesselMappings = [], isLoading: isMappingsLoading } = useQuery<VesselMapping[]>({
    queryKey: [`/technical/api/fleet-admin/fleet-vessel-mappings/by-equipment/${encodeURIComponent(selectedComponent?.fleetEquipmentCode ?? '')}`, selectedComponent?.fleetEquipmentCode],
    enabled: !!selectedComponent?.fleetEquipmentCode,
  });

  const leafComponents = useMemo(() => {
    return fleetComponents.filter((item) =>
      item.fleetEquipmentCode && item.fleetEquipmentCode.length === 10
    );
  }, [fleetComponents]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return leafComponents;
    const query = searchQuery.toLowerCase();
    return leafComponents.filter((item) =>
      item.fleetEquipmentCode?.toLowerCase().includes(query) ||
      item.fleetEquipmentName?.toLowerCase().includes(query) ||
      item.makerName?.toLowerCase().includes(query) ||
      item.makerCode?.toLowerCase().includes(query) ||
      item.model?.toLowerCase().includes(query) ||
      item.modelCode?.toLowerCase().includes(query)
    );
  }, [leafComponents, searchQuery]);

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
        `"${item.makerName || ''}"`,
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

  const handleRowDoubleClick = (item: FleetComponent) => {
    setSelectedComponent(item);
  };

  const handleBackToList = () => {
    setSelectedComponent(null);
  };

  if (selectedComponent) {
    return (
      <div className="p-6">
        <Card className="overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-bold text-gray-900" data-testid="text-detail-title">Equipment Detail</h1>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 bg-white text-[#0f172a] border-gray-300"
                onClick={handleBackToList}
                data-testid="button-back-to-list"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to List
              </Button>
            </div>
          </div>

          <CardContent className="pt-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4" data-testid="text-component-details-heading">Component Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-md p-3">
                    <p className="text-xs text-gray-500 mb-1">Fleet Equipment Code</p>
                    <p className="text-sm font-mono font-medium text-gray-900" data-testid="text-detail-equipment-code">{selectedComponent.fleetEquipmentCode}</p>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3">
                    <p className="text-xs text-gray-500 mb-1">Fleet Equipment Name</p>
                    <p className="text-sm font-medium text-gray-900" data-testid="text-detail-equipment-name">{selectedComponent.fleetEquipmentName}</p>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3">
                    <p className="text-xs text-gray-500 mb-1">Maker</p>
                    <p className="text-sm font-medium text-gray-900" data-testid="text-detail-maker">{selectedComponent.makerName || '-'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3">
                    <p className="text-xs text-gray-500 mb-1">Maker Code</p>
                    <p className="text-sm font-medium text-gray-900" data-testid="text-detail-maker-code">{selectedComponent.makerCode || '-'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3">
                    <p className="text-xs text-gray-500 mb-1">Model</p>
                    <p className="text-sm font-medium text-gray-900" data-testid="text-detail-model">{selectedComponent.model || '-'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3">
                    <p className="text-xs text-gray-500 mb-1">Model Code</p>
                    <p className="text-sm font-medium text-gray-900" data-testid="text-detail-model-code">{selectedComponent.modelCode || '-'}</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Ship className="h-5 w-5 text-cyan-600" />
                  <h2 className="text-lg font-semibold text-gray-900" data-testid="text-linked-vessels-heading">Linked Vessels</h2>
                  <Badge variant="secondary" data-testid="badge-vessel-count">
                    {vesselMappings.length} {vesselMappings.length === 1 ? 'Vessel' : 'Vessels'}
                  </Badge>
                </div>

                {isMappingsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#52baf3] hover:bg-[#52baf3]">
                          <th className="text-white font-semibold text-xs whitespace-nowrap w-16">Sl No</th>
                          <th className="text-white font-semibold text-xs whitespace-nowrap">Vessel Name</th>
                          <th className="text-white font-semibold text-xs whitespace-nowrap">Vessel Code</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vesselMappings.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-center py-8 text-gray-500" data-testid="text-no-vessels">
                              No vessels linked to this equipment code.
                            </td>
                          </tr>
                        ) : (
                          vesselMappings.map((mapping, index) => (
                            <tr
                              key={mapping.id}
                              className="hover:bg-gray-50"
                              data-testid={`row-vessel-mapping-${mapping.id}`}
                            >
                              <td className="text-sm text-gray-500">{index + 1}</td>
                              <td className="text-sm font-medium">{mapping.vesselName || '-'}</td>
                              <td className="text-sm font-mono">{mapping.vesselCode}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="text-master-data-title">Master Data Table View</h1>
        <div className="flex gap-2 items-center">
          {onBack && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 bg-white text-[#0f172a] border-gray-300"
              onClick={onBack}
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 bg-white text-[#0f172a] border-gray-300"
            onClick={handleExport}
            disabled={!filteredData.length}
            data-testid="button-export-master-data"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search master data..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-master-data"
          />
        </div>
        <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-total-count">
          {filteredData.length} Records
        </Badge>
      </div>

      <div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto bg-white rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#52baf3] hover:bg-[#52baf3]">
                  <th className="text-left text-white py-3 px-4 font-medium w-16">Sl No</th>
                  <th className="text-left text-white py-3 px-4 font-medium">Fleet Equipment Code</th>
                  <th className="text-left text-white py-3 px-4 font-medium">Fleet Equipment Name</th>
                  <th className="text-left text-white py-3 px-4 font-medium">Maker</th>
                  <th className="text-left text-white py-3 px-4 font-medium">Maker Code</th>
                  <th className="text-left text-white py-3 px-4 font-medium">Model</th>
                  <th className="text-left text-white py-3 px-4 font-medium">Model Code</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500" data-testid="text-no-data">
                      No fleet component master data found.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, index) => (
                    <tr
                      key={item.id}
                      className={`${index % 2 === 0 ? "bg-gray-50" : "bg-white"} cursor-pointer hover:bg-gray-100`}
                      onDoubleClick={() => handleRowDoubleClick(item)}
                      data-testid={`row-master-data-${item.id}`}
                    >
                      <td className="py-3 px-4 text-sm text-gray-500">{index + 1}</td>
                      <td className="py-3 px-4 text-sm font-mono">{item.fleetEquipmentCode || '-'}</td>
                      <td className="py-3 px-4 text-sm">{item.fleetEquipmentName || '-'}</td>
                      <td className="py-3 px-4 text-sm">{item.makerName || '-'}</td>
                      <td className="py-3 px-4 text-sm">{item.makerCode || '-'}</td>
                      <td className="py-3 px-4 text-sm">{item.model || '-'}</td>
                      <td className="py-3 px-4 text-sm">{item.modelCode || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
