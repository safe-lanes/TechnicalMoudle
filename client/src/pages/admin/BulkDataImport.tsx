import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { FileSpreadsheet, Ship, History, Plus } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

// Complete marker configurations per template tab
// Each tab has its own marker prefix for ALL elements on the page
export interface PageMarkers {
  // Sidebar (Templates section)
  templatesHeader: string;
  templateMachinery: string;
  templateJobs: string;
  templateSpares: string;
  templateStores: string;
  // Vessel controls (top header bar)
  vesselLabel: string;
  vesselDropdown: string;
  newVesselButton: string;
  fleetToggle: string;
  infoText: string;
  historyButton: string;
  // Upload component markers
  uploadHeader: string;
  uploadDescription: string;
  downloadTemplate: string;
  tabUpload: string;
  tabMapping: string;
  tabHistory: string;
  importModeSection: string;
  importModeLabel: string;
  radioAddOnly: string;
  radioUpdateOnly: string;
  radioUpsert: string;
  uploadSection: string;
  uploadDescription2: string;
  dropZone: string;
  // Stores-specific
  storeTypeSection?: string;
  storeTypeLabel?: string;
  storeTypeDropdown?: string;
}

// Machinery tab markers (I1.A*)
const MACHINERY_PAGE_MARKERS: PageMarkers = {
  templatesHeader: "I1.6",
  templateMachinery: "I1.6A",
  templateJobs: "I1.6B",
  templateSpares: "I1.6C",
  templateStores: "I1.6D",
  vesselLabel: "I1.A6",
  vesselDropdown: "I1.A7",
  newVesselButton: "I1.A8",
  fleetToggle: "I1.A9",
  infoText: "I1.A10",
  historyButton: "I1.A11",
  uploadHeader: "I1.A12",
  uploadDescription: "I1.A13",
  downloadTemplate: "I1.A14",
  tabUpload: "I1.A15",
  tabMapping: "I1.A16",
  tabHistory: "I1.A17",
  importModeSection: "I1.A18",
  importModeLabel: "I1.A19",
  radioAddOnly: "I1.A20",
  radioUpdateOnly: "I1.A21",
  radioUpsert: "I1.A22",
  uploadSection: "I1.A23",
  uploadDescription2: "I1.A24",
  dropZone: "I1.A25",
};

// Jobs tab markers (I1.6B.*)
const JOBS_PAGE_MARKERS: PageMarkers = {
  templatesHeader: "I1.6B.6",
  templateMachinery: "I1.6B.6A",
  templateJobs: "I1.6B.6B",
  templateSpares: "I1.6B.6C",
  templateStores: "I1.6B.6D",
  vesselLabel: "I1.6B.7",
  vesselDropdown: "I1.6B.8",
  newVesselButton: "I1.6B.9",
  fleetToggle: "I1.6B.10",
  infoText: "I1.6B.11",
  historyButton: "I1.6B.12",
  uploadHeader: "I1.6B.13",
  uploadDescription: "I1.6B.14",
  downloadTemplate: "I1.6B.15",
  tabUpload: "I1.6B.16",
  tabMapping: "I1.6B.17",
  tabHistory: "I1.6B.18",
  importModeSection: "I1.6B.19",
  importModeLabel: "I1.6B.20",
  radioAddOnly: "I1.6B.21",
  radioUpdateOnly: "I1.6B.22",
  radioUpsert: "I1.6B.23",
  uploadSection: "I1.6B.24",
  uploadDescription2: "I1.6B.25",
  dropZone: "I1.6B.26",
};

// Spares tab markers (I1.6C.*)
const SPARES_PAGE_MARKERS: PageMarkers = {
  templatesHeader: "I1.6C.6",
  templateMachinery: "I1.6C.6A",
  templateJobs: "I1.6C.6B",
  templateSpares: "I1.6C.6C",
  templateStores: "I1.6C.6D",
  vesselLabel: "I1.6C.7",
  vesselDropdown: "I1.6C.8",
  newVesselButton: "I1.6C.9",
  fleetToggle: "I1.6C.10",
  infoText: "I1.6C.11",
  historyButton: "I1.6C.12",
  uploadHeader: "I1.6C.13",
  uploadDescription: "I1.6C.14",
  downloadTemplate: "I1.6C.15",
  tabUpload: "I1.6C.16",
  tabMapping: "I1.6C.17",
  tabHistory: "I1.6C.18",
  importModeSection: "I1.6C.19",
  importModeLabel: "I1.6C.20",
  radioAddOnly: "I1.6C.21",
  radioUpdateOnly: "I1.6C.22",
  radioUpsert: "I1.6C.23",
  uploadSection: "I1.6C.24",
  uploadDescription2: "I1.6C.25",
  dropZone: "I1.6C.26",
};

// Stores tab markers (I1.6D.*)
const STORES_PAGE_MARKERS: PageMarkers = {
  templatesHeader: "I1.6D.6",
  templateMachinery: "I1.6D.6A",
  templateJobs: "I1.6D.6B",
  templateSpares: "I1.6D.6C",
  templateStores: "I1.6D.6D",
  vesselLabel: "I1.6D.7",
  vesselDropdown: "I1.6D.8",
  newVesselButton: "I1.6D.9",
  fleetToggle: "I1.6D.10",
  infoText: "I1.6D.11",
  historyButton: "I1.6D.12",
  uploadHeader: "I1.6D.13",
  uploadDescription: "I1.6D.14",
  downloadTemplate: "I1.6D.15",
  tabUpload: "I1.6D.16",
  tabMapping: "I1.6D.17",
  tabHistory: "I1.6D.18",
  storeTypeSection: "I1.6D.1A",
  storeTypeLabel: "I1.6D.19",
  storeTypeDropdown: "I1.6D.20",
  importModeSection: "I1.6D.21",
  importModeLabel: "I1.6D.22",
  radioAddOnly: "I1.6D.23",
  radioUpdateOnly: "I1.6D.24",
  radioUpsert: "I1.6D.25",
  uploadSection: "I1.6D.26",
  uploadDescription2: "I1.6D.27",
  dropZone: "I1.6D.28",
};

// Map template type to page markers
const PAGE_MARKERS_BY_TEMPLATE: Record<VesselTemplateType, PageMarkers> = {
  machinery: MACHINERY_PAGE_MARKERS,
  jobs: JOBS_PAGE_MARKERS,
  spares: SPARES_PAGE_MARKERS,
  stores: STORES_PAGE_MARKERS,
};

export default function BulkDataImport() {
  const { data: vessels = [] } = useVessels();
  const { toast } = useToast();
  const [isFleetMode, setIsFleetMode] = useState(false);
  const [selectedVesselTemplate, setSelectedVesselTemplate] = useState<VesselTemplateType>('machinery');
  const [selectedFleetTemplate, setSelectedFleetTemplate] = useState<FleetTemplateType>('maker-list');
  const [selectedVessel, setSelectedVessel] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  
  const [isCreateVesselOpen, setIsCreateVesselOpen] = useState(false);
  const [newVesselId, setNewVesselId] = useState('');
  const [newVesselName, setNewVesselName] = useState('');

  const createVesselMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; code: string }) => {
      const response = await apiRequest('POST', '/technical/api/vessels', data);
      return response.json();
    },
    onSuccess: (vessel) => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/vessels'] });
      setSelectedVessel(vessel.id);
      setNewVesselId('');
      setNewVesselName('');
      setIsCreateVesselOpen(false);
      toast({
        title: "Vessel Created",
        description: `${vessel.name} (${vessel.id}) has been created successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Creating Vessel",
        description: error.message || "Failed to create vessel",
        variant: "destructive",
      });
    },
  });

  const handleCreateVessel = () => {
    if (!newVesselId.trim() || !newVesselName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both vessel code and name.",
        variant: "destructive",
      });
      return;
    }
    createVesselMutation.mutate({
      id: newVesselId.trim().toUpperCase(),
      name: newVesselName.trim(),
      code: newVesselId.trim().toUpperCase(),
    });
  };

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
  
  // Get current page markers based on selected template
  const currentMarkers = PAGE_MARKERS_BY_TEMPLATE[selectedVesselTemplate];

  return (
    <div className="flex h-[calc(100vh-140px)]">
      {/* Left Sidebar - Templates */}
      <div className="w-72 bg-sky-500 p-4">
        <Card className="bg-sky-500 border-none shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg" data-testid={currentMarkers.templatesHeader}>TEMPLATES</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {currentTemplates.map((template) => {
              // Dynamic markers based on selected template tab
              const templateMarkerMap: Record<VesselTemplateType, string> = {
                'machinery': currentMarkers.templateMachinery,
                'jobs': currentMarkers.templateJobs,
                'spares': currentMarkers.templateSpares,
                'stores': currentMarkers.templateStores,
              };
              const markerId = !isFleetMode ? templateMarkerMap[template.id as VesselTemplateType] : undefined;
              return (
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
                  data-testid={markerId || `template-${template.id}`}
                >
                  {template.number}. {template.name}
                </button>
              );
            })}
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
                  <Label htmlFor="vessel-select" className="text-sm font-medium text-gray-700" data-testid={currentMarkers.vesselLabel}>
                    Select Vessel:
                  </Label>
                  <Select value={selectedVessel} onValueChange={(value) => setSelectedVessel(value)}>
                    <SelectTrigger id="vessel-select" className="w-64" data-testid={currentMarkers.vesselDropdown}>
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
                  
                  {/* Create Vessel Dialog */}
                  <Dialog open={isCreateVesselOpen} onOpenChange={setIsCreateVesselOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1"
                        data-testid={currentMarkers.newVesselButton}
                      >
                        <Plus className="h-4 w-4" />
                        New Vessel
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Create New Vessel</DialogTitle>
                        <DialogDescription>
                          Enter the vessel code and name to create a new vessel.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="vessel-code">Vessel Code</Label>
                          <Input
                            id="vessel-code"
                            placeholder="e.g., V001"
                            value={newVesselId}
                            onChange={(e) => setNewVesselId(e.target.value)}
                            data-testid="input-vessel-code"
                            autoComplete="off"
                          />
                          <p className="text-xs text-gray-500">
                            Unique identifier for the vessel (e.g., V001, V002)
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="vessel-name">Vessel Name</Label>
                          <Input
                            id="vessel-name"
                            placeholder="e.g., MV Pacific Star"
                            value={newVesselName}
                            onChange={(e) => setNewVesselName(e.target.value)}
                            data-testid="input-vessel-name"
                            autoComplete="off"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          variant="outline" 
                          onClick={() => setIsCreateVesselOpen(false)}
                          data-testid="button-cancel-create-vessel"
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleCreateVessel}
                          disabled={createVesselMutation.isPending}
                          data-testid="button-confirm-create-vessel"
                        >
                          {createVesselMutation.isPending ? 'Creating...' : 'Create Vessel'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </>
            )}
            
            {/* Fleet Data Import Toggle */}
            <div className="flex items-center gap-2 px-4 py-2 border rounded-full bg-gray-50" data-testid={currentMarkers.fleetToggle}>
              <Label htmlFor="fleet-toggle" className="text-sm font-medium text-gray-700 cursor-pointer">
                Fleet Data Import
              </Label>
              <Switch
                id="fleet-toggle"
                checked={isFleetMode}
                onCheckedChange={setIsFleetMode}
              />
            </div>
            
            <div className="ml-auto flex items-center gap-3">
              <p className="text-sm text-gray-500" data-testid={currentMarkers.infoText}>
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
                data-testid={currentMarkers.historyButton}
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
              <MachineryComponentUpload vesselId={selectedVessel} markers={currentMarkers} />
            ) : selectedVesselTemplate === 'jobs' ? (
              <JobUpload vesselId={selectedVessel} markers={currentMarkers} />
            ) : selectedVesselTemplate === 'spares' ? (
              <SparesUpload vesselId={selectedVessel} markers={currentMarkers} />
            ) : selectedVesselTemplate === 'stores' ? (
              <StoresUpload vesselId={selectedVessel} markers={currentMarkers} />
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
