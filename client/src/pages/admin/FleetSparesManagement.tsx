import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type FleetSpares, type FleetComponents } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Download, Wrench, Package, ArrowLeft, Info, Save, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Marker } from "@/components/Marker";
import { SectionBlock } from "@/components/SectionBlock";

export default function FleetSparesManagement({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [spareToDelete, setSpareToDelete] = useState<FleetSpares | null>(null);

  const [detailSpare, setDetailSpare] = useState<FleetSpares | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [spareFormData, setSpareFormData] = useState<Partial<FleetSpares>>({});

  const { data: spares, isLoading, error } = useQuery<FleetSpares[]>({
    queryKey: ['/technical/api/fleet/spares'],
  });

  const { data: components } = useQuery<FleetComponents[]>({
    queryKey: ['/technical/api/fleet/components'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/technical/api/fleet/spares/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/spares'], exact: false });
      toast({ title: "Success", description: "Fleet spare deleted successfully" });
      setDeleteDialogOpen(false);
      setSpareToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete spare", variant: "destructive" });
    },
  });

  const updateSpareMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<FleetSpares> }) => {
      const res = await apiRequest('PATCH', `/technical/api/fleet/spares/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/spares'], exact: false });
      toast({ title: "Success", description: "Spare updated successfully" });
      setIsEditMode(false);
      setDetailSpare(null);
      setSpareFormData({});
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update spare", variant: "destructive" });
    },
  });

  const createSpareMutation = useMutation({
    mutationFn: async (data: Partial<FleetSpares>) => {
      const res = await apiRequest('POST', '/technical/api/fleet/spares', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/spares'], exact: false });
      toast({ title: "Success", description: "Fleet spare created successfully" });
      setIsAddMode(false);
      setSpareFormData({});
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create spare", variant: "destructive" });
    },
  });

  const filteredSpares = spares?.filter((spare) => {
    if (selectedEquipment !== "all" && spare.fleetEquipmentCode !== selectedEquipment) {
      return false;
    }
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      spare.partName?.toLowerCase().includes(query) ||
      spare.partCode?.toLowerCase().includes(query) ||
      spare.maker?.toLowerCase().includes(query) ||
      spare.fleetEquipmentCode?.toLowerCase().includes(query)
    );
  }) || [];

  const handleAddNew = () => {
    setSpareFormData({ isActive: true });
    setIsAddMode(true);
    setDetailSpare(null);
    setIsEditMode(false);
  };

  const handleEdit = (spare: FleetSpares) => {
    setDetailSpare(spare);
    setSpareFormData({ ...spare });
    setIsEditMode(true);
  };

  const handleRowDoubleClick = (spare: FleetSpares) => {
    setDetailSpare(spare);
    setIsEditMode(false);
    setIsAddMode(false);
  };

  const handleDeleteClick = (spare: FleetSpares) => {
    setSpareToDelete(spare);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (spareToDelete) {
      deleteMutation.mutate(spareToDelete.id);
    }
  };

  const handleSaveEdit = () => {
    if (!detailSpare) return;
    const EDITABLE_FIELDS: (keyof FleetSpares)[] = [
      'partCode', 'partName', 'partNumber', 'unitOfMeasurement',
      'fleetEquipmentCode', 'fleetEquipmentName', 'drawingNumber',
      'positionNumber', 'specification', 'maker', 'makerCode',
      'manualName', 'pageNumber', 'note', 'criticality', 'isActive',
      'ihm', 'evidenceType',
    ];
    const changedFields: Record<string, any> = {};
    for (const field of EDITABLE_FIELDS) {
      const oldVal = detailSpare[field];
      const newVal = spareFormData[field];
      if (newVal !== oldVal) {
        changedFields[field] = newVal;
      }
    }
    if (Object.keys(changedFields).length === 0) {
      toast({ title: "No Changes", description: "No changes were made" });
      return;
    }
    updateSpareMutation.mutate({ id: detailSpare.id, data: changedFields });
  };

  const handleSaveAdd = () => {
    if (!spareFormData.partCode?.trim()) {
      toast({ title: "Validation Error", description: "Part Code is required", variant: "destructive" });
      return;
    }
    if (!spareFormData.partName?.trim()) {
      toast({ title: "Validation Error", description: "Part Name is required", variant: "destructive" });
      return;
    }
    if (!spareFormData.fleetEquipmentCode?.trim()) {
      toast({ title: "Validation Error", description: "Fleet Equipment Code is required", variant: "destructive" });
      return;
    }
    if (!spareFormData.unitOfMeasurement?.trim()) {
      toast({ title: "Validation Error", description: "Unit of Measurement is required", variant: "destructive" });
      return;
    }
    const payload: Record<string, any> = {};
    Object.entries(spareFormData).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        payload[key] = value;
      }
    });
    createSpareMutation.mutate(payload as Partial<FleetSpares>);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setSpareFormData({});
  };

  const handleCancelAdd = () => {
    setIsAddMode(false);
    setSpareFormData({});
  };

  const handleBackToList = () => {
    setDetailSpare(null);
    setIsEditMode(false);
    setSpareFormData({});
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/technical/api/fleet/spares/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fleet-spares-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Success", description: "Spares exported successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to export spares", variant: "destructive" });
    }
  };

  const equipmentOptions = components?.filter(c => c.fleetEquipmentCode) || [];
  const totalSpares = spares?.length || 0;

  const renderSpareFormSections = (formData: Partial<FleetSpares>, setFormData: (fn: (prev: Partial<FleetSpares>) => Partial<FleetSpares>) => void) => (
    <div className="max-w-5xl mx-auto space-y-6">
      <SectionBlock id="spare-basic-info" number="A1" title="Basic Information" description="Core identification and classification details">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-sm text-[#8798ad]">Part Code *</Label>
              <Input
                placeholder="Enter part code"
                value={formData.partCode || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, partCode: e.target.value }))}
                data-testid="input-spare-part-code"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-[#8798ad]">Part Name *</Label>
              <Input
                placeholder="Enter part name"
                value={formData.partName || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, partName: e.target.value }))}
                data-testid="input-spare-part-name"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-[#8798ad]">Part Number</Label>
              <Input
                placeholder="Enter part number"
                value={formData.partNumber || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, partNumber: e.target.value }))}
                data-testid="input-spare-part-number"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-[#8798ad]">UOM *</Label>
              <Input
                placeholder="Enter unit of measurement"
                value={formData.unitOfMeasurement || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, unitOfMeasurement: e.target.value }))}
                data-testid="input-spare-uom"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-[#8798ad]">Equipment *</Label>
              <Select
                value={formData.fleetEquipmentCode || ""}
                onValueChange={(val) => {
                  const comp = components?.find(c => c.fleetEquipmentCode === val);
                  setFormData(prev => ({
                    ...prev,
                    fleetEquipmentCode: val,
                    fleetEquipmentName: comp?.fleetEquipmentName || "",
                  }));
                }}
              >
                <SelectTrigger data-testid="input-spare-equipment">
                  <SelectValue placeholder="Select equipment" />
                </SelectTrigger>
                <SelectContent>
                  {components?.map((comp) => (
                    <SelectItem key={comp.id} value={comp.fleetEquipmentCode || ""}>
                      {comp.fleetEquipmentCode} - {comp.fleetEquipmentName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-[#8798ad]">Equipment Code</Label>
              <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 min-h-[38px] flex items-center" data-testid="field-spare-equipment-code">
                {formData.fleetEquipmentCode || '-'}
              </div>
            </div>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock id="spare-status" number="A2" title="Status & Classification" description="Status flags and classification details">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-sm text-[#8798ad]">Criticality</Label>
            <Select
              value={formData.criticality || ""}
              onValueChange={(val) => setFormData(prev => ({ ...prev, criticality: val }))}
            >
              <SelectTrigger data-testid="input-spare-criticality">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-sm text-[#8798ad]">Is Active</Label>
            <Select
              value={formData.isActive === true ? "Yes" : formData.isActive === false ? "No" : ""}
              onValueChange={(val) => setFormData(prev => ({ ...prev, isActive: val === "Yes" }))}
            >
              <SelectTrigger data-testid="input-spare-is-active">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-sm text-[#8798ad]">IHM</Label>
            <Select
              value={formData.ihm || ""}
              onValueChange={(val) => setFormData(prev => ({ ...prev, ihm: val }))}
            >
              <SelectTrigger data-testid="input-spare-ihm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-sm text-[#8798ad]">Evidence Type</Label>
            <Input
              placeholder="Enter evidence type"
              value={formData.evidenceType || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, evidenceType: e.target.value }))}
              data-testid="input-spare-evidence-type"
            />
          </div>
        </div>
      </SectionBlock>

      <SectionBlock id="spare-technical" number="A3" title="Technical Details" description="Maker and technical specifications">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-sm text-[#8798ad]">Maker</Label>
            <Input
              placeholder="Enter maker"
              value={formData.maker || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, maker: e.target.value }))}
              data-testid="input-spare-maker"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm text-[#8798ad]">Maker Code</Label>
            <Input
              placeholder="Enter maker code"
              value={formData.makerCode || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, makerCode: e.target.value }))}
              data-testid="input-spare-maker-code"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm text-[#8798ad]">Drawing Number</Label>
            <Input
              placeholder="Enter drawing number"
              value={formData.drawingNumber || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, drawingNumber: e.target.value }))}
              data-testid="input-spare-drawing-number"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm text-[#8798ad]">Position Number</Label>
            <Input
              placeholder="Enter position number"
              value={formData.positionNumber || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, positionNumber: e.target.value }))}
              data-testid="input-spare-position-number"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-sm text-[#8798ad]">Specification</Label>
            <Input
              placeholder="Enter specification"
              value={formData.specification || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, specification: e.target.value }))}
              data-testid="input-spare-specification"
            />
          </div>
        </div>
      </SectionBlock>

      <SectionBlock id="spare-manual" number="A4" title="Manual Reference" description="Manual and documentation references">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-sm text-[#8798ad]">Manual Name</Label>
            <Input
              placeholder="Enter manual name"
              value={formData.manualName || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, manualName: e.target.value }))}
              data-testid="input-spare-manual-name"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm text-[#8798ad]">Page Number</Label>
            <Input
              placeholder="Enter page number"
              value={formData.pageNumber || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, pageNumber: e.target.value }))}
              data-testid="input-spare-page-number"
            />
          </div>
        </div>
        <div className="mt-4 space-y-1">
          <Label className="text-sm text-[#8798ad]">Note</Label>
          <Input
            placeholder="Enter notes"
            value={formData.note || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
            data-testid="input-spare-note"
          />
        </div>
      </SectionBlock>
    </div>
  );

  if (isAddMode) {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Plus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white" data-testid="title-add-spare">Add New Spare</h1>
              <p className="text-cyan-100 text-sm mt-0.5">
                {spareFormData.partName || "Create a new fleet spare part"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="bg-white/20 text-white border-white/30"
              variant="outline"
              onClick={handleCancelAdd}
              data-testid="btn-cancel-add-spare"
            >
              Cancel
            </Button>
            <Button
              className="bg-white text-blue-600"
              onClick={handleSaveAdd}
              disabled={createSpareMutation.isPending}
              data-testid="btn-save-add-spare"
            >
              {createSpareMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          {renderSpareFormSections(spareFormData, setSpareFormData)}
        </div>
      </div>
    );
  }

  if (detailSpare && isEditMode) {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Pencil className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white" data-testid="title-edit-spare">Edit Spare Details</h1>
              <p className="text-cyan-100 text-sm mt-0.5">
                {spareFormData.partName || detailSpare.partName || "Edit spare information"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="bg-white/20 text-white border-white/30"
              variant="outline"
              onClick={handleCancelEdit}
              data-testid="btn-cancel-edit-spare"
            >
              Cancel
            </Button>
            <Button
              className="bg-white text-blue-600"
              onClick={handleSaveEdit}
              disabled={updateSpareMutation.isPending}
              data-testid="btn-save-edit-spare"
            >
              {updateSpareMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          {renderSpareFormSections(spareFormData, setSpareFormData)}
        </div>
      </div>
    );
  }

  if (detailSpare) {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Info className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white" data-testid="title-spare-details">Spare Details</h1>
              <p className="text-cyan-100 text-sm mt-0.5">{detailSpare.partName || "View spare information"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="bg-white/20 text-white border-white/30"
              variant="outline"
              onClick={handleBackToList}
              data-testid="btn-back-spare-list"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              className="bg-white text-blue-600"
              onClick={() => handleEdit(detailSpare)}
              data-testid="btn-edit-spare"
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <SectionBlock id="detail-basic-info" number="A1" title="Basic Information" description="Core identification and classification details">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Part Code</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-part-code">{detailSpare.partCode || '-'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Part Name</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-part-name">{detailSpare.partName || '-'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Part Number</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-part-number">{detailSpare.partNumber || '-'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">UOM</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-uom">{detailSpare.unitOfMeasurement || '-'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Equipment</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-equipment">{detailSpare.fleetEquipmentName || '-'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Equipment Code</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-equipment-code">{detailSpare.fleetEquipmentCode || '-'}</div>
                </div>
              </div>
            </SectionBlock>

            <SectionBlock id="detail-status" number="A2" title="Status & Classification" description="Status flags and classification details">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Criticality</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-criticality">
                    {detailSpare.criticality ? (
                      <Badge variant="secondary" className={`no-default-hover-elevate no-default-active-elevate ${detailSpare.criticality === 'Yes' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{detailSpare.criticality}</Badge>
                    ) : '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Is Active</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-is-active">
                    <Badge variant="secondary" className={`no-default-hover-elevate no-default-active-elevate ${detailSpare.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {detailSpare.isActive ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">IHM</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-ihm">
                    {detailSpare.ihm ? (
                      <Badge variant="secondary" className={`no-default-hover-elevate no-default-active-elevate ${detailSpare.ihm === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{detailSpare.ihm}</Badge>
                    ) : '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Evidence Type</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-evidence-type">{detailSpare.evidenceType || '-'}</div>
                </div>
              </div>
            </SectionBlock>

            <SectionBlock id="detail-technical" number="A3" title="Technical Details" description="Maker and technical specifications">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Maker</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-maker">{detailSpare.maker || '-'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Maker Code</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-maker-code">{detailSpare.makerCode || '-'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Drawing Number</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-drawing-number">{detailSpare.drawingNumber || '-'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Position Number</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-position-number">{detailSpare.positionNumber || '-'}</div>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-sm text-[#8798ad]">Specification</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-specification">{detailSpare.specification || '-'}</div>
                </div>
              </div>
            </SectionBlock>

            <SectionBlock id="detail-manual" number="A4" title="Manual Reference" description="Manual and documentation references">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Manual Name</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-manual-name">{detailSpare.manualName || '-'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Page Number</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-page-number">{detailSpare.pageNumber || '-'}</div>
                </div>
              </div>
              <div className="mt-4 space-y-1">
                <Label className="text-sm text-[#8798ad]">Note</Label>
                <div className="text-sm font-medium text-gray-900" data-testid="detail-note">{detailSpare.note || '-'}</div>
              </div>
            </SectionBlock>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Wrench className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white" data-testid="I4.QL5.5.8"><Marker id="I4.QL5.5.8" />Fleet Spares Management</h1>
                <p className="text-cyan-100 text-sm mt-0.5" data-testid="I4.QL5.5.9"><Marker id="I4.QL5.5.9" />Manage fleet-level spare parts inventory</p>
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

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-semibold text-gray-800" data-testid="I4.QL5.5.10"><Marker id="I4.QL5.5.10" />All Fleet Spares</h2>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-total-spares">
                  <Package className="h-3 w-3 mr-1" />
                  {totalSpares} Total
                </Badge>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-filtered-spares">
                  {filteredSpares.length} Shown
                </Badge>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                <SelectTrigger className="w-full sm:w-[200px]" data-testid="I4.QL5.5.11">
                  <Marker id="I4.QL5.5.11" />
                  <SelectValue placeholder="All Equipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Equipment</SelectItem>
                  {equipmentOptions.map((comp) => (
                    <SelectItem key={comp.id} value={comp.fleetEquipmentCode || ""}>
                      {comp.fleetEquipmentCode} - {comp.fleetEquipmentName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative flex-1 sm:min-w-[250px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search spares..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="I4.QL5.5.12"
                />
                <Marker id="I4.QL5.5.12" />
              </div>

              <Button
                variant="outline"
                onClick={handleExport}
                className="border-gray-300 text-gray-700"
                data-testid="I4.QL5.5.13"
              >
                <Marker id="I4.QL5.5.13" />
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button
                onClick={handleAddNew}
                className="bg-cyan-600 whitespace-nowrap"
                data-testid="I4.QL5.5.14"
              >
                <Marker id="I4.QL5.5.14" />
                <Plus className="mr-2 h-4 w-4" />
                Add New Spare
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-md"></div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <Wrench className="h-10 w-10 text-red-300 mx-auto mb-2" />
              <p className="text-red-700 font-medium">Failed to load spares</p>
              <p className="text-red-500 text-sm mt-1">Please try refreshing the page</p>
            </div>
          ) : filteredSpares.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {searchQuery || selectedEquipment !== "all"
                  ? "No spares found matching your filters"
                  : "No spares yet"}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {searchQuery ? "Try adjusting your search terms" : "Add your first spare to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-200">
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL5.5.15"><Marker id="I4.QL5.5.15" />Part Code</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL5.5.16"><Marker id="I4.QL5.5.16" />Part Name</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL5.5.17"><Marker id="I4.QL5.5.17" />Fleet Equipment Code</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL5.5.fleet-eq-name">Fleet Equipment Name</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL5.5.18"><Marker id="I4.QL5.5.18" />Maker Reference</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL5.5.19"><Marker id="I4.QL5.5.19" />Unit</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL5.5.20"><Marker id="I4.QL5.5.20" />Location</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL5.5.21"><Marker id="I4.QL5.5.21" />Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSpares.map((spare, index) => {
                    const equipment = components?.find(c => c.fleetEquipmentCode === spare.fleetEquipmentCode);
                    const isFirstRow = index === 0;
                    return (
                      <TableRow
                        key={spare.id}
                        data-testid={`row-spare-${spare.id}`}
                        className="cursor-pointer"
                        onDoubleClick={() => handleRowDoubleClick(spare)}
                      >
                        <TableCell className="font-mono text-sm" data-testid={isFirstRow ? "I4.QL5.5.22" : undefined}>
                          {isFirstRow && <Marker id="I4.QL5.5.22" />}
                          {spare.partCode}
                        </TableCell>
                        <TableCell className="font-medium" data-testid={isFirstRow ? "I4.QL5.5.23" : undefined}>
                          {isFirstRow && <Marker id="I4.QL5.5.23" />}
                          {spare.partName}
                        </TableCell>
                        <TableCell className="font-mono text-sm" data-testid={isFirstRow ? "I4.QL5.5.24" : undefined}>
                          {isFirstRow && <Marker id="I4.QL5.5.24" />}
                          {spare.fleetEquipmentCode || "-"}
                        </TableCell>
                        <TableCell className="text-sm" data-testid={isFirstRow ? "I4.QL5.5.fleet-eq-name-val" : undefined}>
                          {equipment?.fleetEquipmentName || "-"}
                        </TableCell>
                        <TableCell className="text-sm" data-testid={isFirstRow ? "I4.QL5.5.25" : undefined}>
                          {isFirstRow && <Marker id="I4.QL5.5.25" />}
                          {spare.maker || "-"}
                        </TableCell>
                        <TableCell data-testid={isFirstRow ? "I4.QL5.5.26" : undefined}>
                          {isFirstRow && <Marker id="I4.QL5.5.26" />}
                          {spare.unitOfMeasurement || "-"}
                        </TableCell>
                        <TableCell data-testid={isFirstRow ? "I4.QL5.5.27" : undefined}>
                          {isFirstRow && <Marker id="I4.QL5.5.27" />}
                          -
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleEdit(spare); }}
                              data-testid={isFirstRow ? "I4.QL5.5.28" : `button-edit-${spare.id}`}
                            >
                              {isFirstRow && <Marker id="I4.QL5.5.28" />}
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleDeleteClick(spare); }}
                              className="text-red-600"
                              data-testid={isFirstRow ? "I4.QL5.5.29" : `button-delete-${spare.id}`}
                            >
                              {isFirstRow && <Marker id="I4.QL5.5.29" />}
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-spare">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fleet Spare</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{spareToDelete?.partName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
