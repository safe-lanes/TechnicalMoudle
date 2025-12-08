import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Download, Plus, Edit } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

interface NewMasterDataForm {
  makerName: string;
  makerCode: string;
  countMaker: string;
  model: string;
  modelCode: string;
  countSfiCode: string;
  fleetEquipmentCode: string;
  sfiCode: string;
  assignedSubCode: string;
  vesselName: string;
  equipmentName: string;
}

const initialFormState: NewMasterDataForm = {
  makerName: "",
  makerCode: "",
  countMaker: "",
  model: "",
  modelCode: "",
  countSfiCode: "",
  fleetEquipmentCode: "",
  sfiCode: "",
  assignedSubCode: "",
  vesselName: "",
  equipmentName: "",
};

export default function MasterDataTableView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState<NewMasterDataForm>(initialFormState);
  const { toast } = useToast();

  const addMasterDataMutation = useMutation({
    mutationFn: async (data: NewMasterDataForm) => {
      const payload = {
        makerName: data.makerName,
        makerCode: data.makerCode,
        countMaker: data.countMaker ? parseInt(data.countMaker, 10) : 0,
        model: data.model,
        modelCode: data.modelCode,
        countSfiCode: data.countSfiCode ? parseInt(data.countSfiCode, 10) : 0,
        fleetEquipmentCode: data.fleetEquipmentCode,
        sfiCode: data.sfiCode,
        assignedSubCode: data.assignedSubCode,
        vesselName: data.vesselName,
        equipmentName: data.equipmentName,
        isActive: true,
      };
      return apiRequest('POST', '/api/fleet-admin/master-data', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fleet-admin/master-data'] });
      setIsAddDialogOpen(false);
      setFormData(initialFormState);
      toast({
        title: "Success",
        description: "Master equipment added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add master equipment.",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof NewMasterDataForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!formData.makerName || !formData.makerCode || !formData.fleetEquipmentCode || !formData.sfiCode || !formData.equipmentName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Maker Name, Maker Code, Fleet Equipment Code, SFI Code, Equipment Name).",
        variant: "destructive",
      });
      return;
    }
    addMasterDataMutation.mutate(formData);
  };

  const handleCancel = () => {
    setIsAddDialogOpen(false);
    setFormData(initialFormState);
  };

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
                onClick={() => setIsAddDialogOpen(true)}
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

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden" data-testid="dialog-add-master-equipment">
          <DialogHeader className="bg-gray-700 text-white px-6 py-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-medium">Add New Master Equipment</DialogTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="bg-white text-gray-700 hover:bg-gray-100"
                  data-testid="button-cancel-add"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={addMasterDataMutation.isPending}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                  data-testid="button-save-master-equipment"
                >
                  {addMasterDataMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="p-6 bg-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-blue-600 font-medium text-sm">Maker Name</Label>
                <Input
                  placeholder="Eg: Type Maker Name"
                  value={formData.makerName}
                  onChange={(e) => handleInputChange('makerName', e.target.value)}
                  className="bg-white"
                  data-testid="input-maker-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-blue-600 font-medium text-sm">Maker Code</Label>
                <Input
                  placeholder="Eg: Type Maker Code"
                  value={formData.makerCode}
                  onChange={(e) => handleInputChange('makerCode', e.target.value)}
                  className="bg-white"
                  data-testid="input-maker-code"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-blue-600 font-medium text-sm">Count_Maker</Label>
                <Input
                  placeholder="Eg: Type Maker_Count"
                  value={formData.countMaker}
                  onChange={(e) => handleInputChange('countMaker', e.target.value)}
                  className="bg-white"
                  type="number"
                  data-testid="input-count-maker"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-blue-600 font-medium text-sm">Model</Label>
                <Input
                  placeholder="Eg: Type Model"
                  value={formData.model}
                  onChange={(e) => handleInputChange('model', e.target.value)}
                  className="bg-white"
                  data-testid="input-model"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-blue-600 font-medium text-sm">Model Code</Label>
                <Input
                  placeholder="Eg: Type Model Code"
                  value={formData.modelCode}
                  onChange={(e) => handleInputChange('modelCode', e.target.value)}
                  className="bg-white"
                  data-testid="input-model-code"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-blue-600 font-medium text-sm">Count_SFI</Label>
                <Input
                  placeholder="Eg: Type SFI Count"
                  value={formData.countSfiCode}
                  onChange={(e) => handleInputChange('countSfiCode', e.target.value)}
                  className="bg-white"
                  type="number"
                  data-testid="input-count-sfi"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-blue-600 font-medium text-sm">Fleet Equipment Code</Label>
                <Input
                  placeholder="Eg: Type FEC"
                  value={formData.fleetEquipmentCode}
                  onChange={(e) => handleInputChange('fleetEquipmentCode', e.target.value)}
                  className="bg-white"
                  data-testid="input-fleet-equipment-code"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-blue-600 font-medium text-sm">SFI Code</Label>
                <Input
                  placeholder="Eg: Type SFI Code"
                  value={formData.sfiCode}
                  onChange={(e) => handleInputChange('sfiCode', e.target.value)}
                  className="bg-white"
                  data-testid="input-sfi-code"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-blue-600 font-medium text-sm">Sub Code</Label>
                <Input
                  placeholder="Eg: Type Sub Code"
                  value={formData.assignedSubCode}
                  onChange={(e) => handleInputChange('assignedSubCode', e.target.value)}
                  className="bg-white"
                  data-testid="input-sub-code"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-blue-600 font-medium text-sm">Vessel Name</Label>
                <Input
                  placeholder="Eg: Name of Vessel"
                  value={formData.vesselName}
                  onChange={(e) => handleInputChange('vesselName', e.target.value)}
                  className="bg-white"
                  data-testid="input-vessel-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-blue-600 font-medium text-sm">Equipment Name</Label>
                <Input
                  placeholder="Eg: Type Name"
                  value={formData.equipmentName}
                  onChange={(e) => handleInputChange('equipmentName', e.target.value)}
                  className="bg-white"
                  data-testid="input-equipment-name"
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
