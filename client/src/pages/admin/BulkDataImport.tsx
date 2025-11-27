import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Ship, History } from "lucide-react";
import MachineryComponentUpload from "./MachineryComponentUpload";
import JobUpload from "./JobUpload";
import SparesUpload from "./bulk/SparesUpload";
import StoresUpload from "./bulk/StoresUpload";
import MakerListUpload from "./bulk/MakerListUpload";
import MasterDataUpload from "./bulk/MasterDataUpload";
import FleetComponentUpload from "./bulk/FleetComponentUpload";
import FleetJobsUpload from "./bulk/FleetJobsUpload";
import FleetSparesUpload from "./bulk/FleetSparesUpload";
import MasterListsUpload from "./bulk/MasterListsUpload";
import BulkImportHistory from "./bulk/BulkImportHistory";
import { useVessels } from "@/hooks/useVessels";

type VesselTemplateType = 'machinery' | 'stores' | 'spares' | 'jobs';
type FleetTemplateType = 'maker-list' | 'master-data' | 'fleet-component' | 'fleet-jobs' | 'fleet-spares' | 'master-list';
type ViewMode = 'upload' | 'history';

export default function BulkDataImport() {
  const { data: vessels = [] } = useVessels();
  const [isFleetMode, setIsFleetMode] = useState(false);
  const [selectedVesselTemplate, setSelectedVesselTemplate] = useState<VesselTemplateType>('machinery');
  const [selectedFleetTemplate, setSelectedFleetTemplate] = useState<FleetTemplateType>('maker-list');
  const [selectedVessel, setSelectedVessel] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('upload');

  const vesselTemplates = [
    { id: 'machinery' as VesselTemplateType, number: 1, name: 'Machinery Components' },
    { id: 'jobs' as VesselTemplateType, number: 2, name: 'Jobs' },
    { id: 'spares' as VesselTemplateType, number: 3, name: 'Spares' },
    { id: 'stores' as VesselTemplateType, number: 4, name: 'Stores' },
  ];

  const fleetTemplates = [
    { id: 'maker-list' as FleetTemplateType, number: 1, name: 'Maker List' },
    { id: 'master-data' as FleetTemplateType, number: 2, name: 'Master Data' },
    { id: 'fleet-component' as FleetTemplateType, number: 3, name: 'Fleet Component' },
    { id: 'fleet-jobs' as FleetTemplateType, number: 4, name: 'Fleet Jobs' },
    { id: 'fleet-spares' as FleetTemplateType, number: 5, name: 'Fleet Spares' },
    { id: 'master-list' as FleetTemplateType, number: 6, name: 'Master List' },
  ];

  const currentTemplates = isFleetMode ? fleetTemplates : vesselTemplates;

  return (
    <div className="flex h-[calc(100vh-140px)]">
      {/* Left Sidebar - Templates */}
      <div className="w-72 bg-sky-500 p-4">
        <Card className="bg-sky-500 border-none shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg">TEMPLATES</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {currentTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => isFleetMode 
                  ? setSelectedFleetTemplate(template.id as FleetTemplateType) 
                  : setSelectedVesselTemplate(template.id as VesselTemplateType)
                }
                className={`w-full text-left px-4 py-3 rounded transition-colors ${
                  (isFleetMode ? selectedFleetTemplate : selectedVesselTemplate) === template.id
                    ? 'bg-white text-sky-600 font-medium'
                    : 'text-white hover:bg-sky-400'
                }`}
                data-testid={`template-${template.id}`}
              >
                {template.number}. {template.name}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Template Content */}
      <div className="flex-1 bg-gray-50 overflow-auto">
        {/* Vessel Selector Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center gap-4">
            {/* Vessel Selector - Hidden when Fleet Data Import is ON */}
            {!isFleetMode && (
              <>
                <Ship className="h-5 w-5 text-sky-600" />
                <div className="flex items-center gap-3">
                  <Label htmlFor="vessel-select" className="text-sm font-medium text-gray-700">
                    Select Vessel:
                  </Label>
                  <Select value={selectedVessel} onValueChange={(value) => setSelectedVessel(value)}>
                    <SelectTrigger id="vessel-select" className="w-64" data-testid="select-vessel">
                      <SelectValue placeholder="Choose vessel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vessels.map((vessel) => (
                        <SelectItem key={vessel.id} value={vessel.id} data-testid={`vessel-${vessel.id}`}>
                          {vessel.id} - {vessel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            {/* Fleet Data Import Toggle */}
            <div className="flex items-center gap-2 px-4 py-2 border rounded-full bg-gray-50">
              <Label htmlFor="fleet-toggle" className="text-sm font-medium text-gray-700 cursor-pointer">
                Fleet Data Import
              </Label>
              <Switch
                id="fleet-toggle"
                checked={isFleetMode}
                onCheckedChange={setIsFleetMode}
                data-testid="toggle-fleet-mode"
              />
            </div>
            
            <div className="ml-auto flex items-center gap-3">
              <p className="text-sm text-gray-500">
                {viewMode === 'history' 
                  ? "View import history and error logs"
                  : isFleetMode 
                    ? "Fleet imports apply across all vessels" 
                    : "All imports will be associated with the selected vessel"}
              </p>
              <Button
                variant={viewMode === 'history' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode(viewMode === 'history' ? 'upload' : 'history')}
                data-testid="button-toggle-history"
              >
                <History className="h-4 w-4 mr-2" />
                {viewMode === 'history' ? 'Back to Upload' : 'Import History'}
              </Button>
            </div>
          </div>
        </div>

        {/* Template Content */}
        <div className="p-6">
          {viewMode === 'history' ? (
            <BulkImportHistory vesselId={selectedVessel} />
          ) : isFleetMode ? (
            selectedFleetTemplate === 'maker-list' ? (
              <MakerListUpload />
            ) : selectedFleetTemplate === 'master-data' ? (
              <MasterDataUpload />
            ) : selectedFleetTemplate === 'fleet-component' ? (
              <FleetComponentUpload />
            ) : selectedFleetTemplate === 'fleet-jobs' ? (
              <FleetJobsUpload />
            ) : selectedFleetTemplate === 'fleet-spares' ? (
              <FleetSparesUpload />
            ) : selectedFleetTemplate === 'master-list' ? (
              <MasterListsUpload />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileSpreadsheet className="h-16 w-16 text-gray-300 mb-4" />
                  <p className="text-gray-500 text-center">
                    Select a template from the left to begin
                  </p>
                </CardContent>
              </Card>
            )
          ) : (
            selectedVesselTemplate === 'machinery' ? (
              <MachineryComponentUpload vesselId={selectedVessel} />
            ) : selectedVesselTemplate === 'jobs' ? (
              <JobUpload vesselId={selectedVessel} />
            ) : selectedVesselTemplate === 'spares' ? (
              <SparesUpload vesselId={selectedVessel} />
            ) : selectedVesselTemplate === 'stores' ? (
              <StoresUpload vesselId={selectedVessel} />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileSpreadsheet className="h-16 w-16 text-gray-300 mb-4" />
                  <p className="text-gray-500 text-center">
                    Select a template from the left to begin
                  </p>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  );
}
