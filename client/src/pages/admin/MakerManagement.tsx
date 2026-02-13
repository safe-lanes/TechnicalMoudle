import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type MakerList } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Download, ArrowLeft, Building2, Package, Info } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Marker } from "@/components/Marker";
import { SectionBlock } from "@/components/SectionBlock";

export default function MakerManagement({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [makerToDelete, setMakerToDelete] = useState<MakerList | null>(null);

  const [detailMaker, setDetailMaker] = useState<MakerList | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [makerFormData, setMakerFormData] = useState<Partial<MakerList>>({});

  const { data: makers, isLoading, error } = useQuery<MakerList[]>({
    queryKey: ['/technical/api/fleet/makers'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/technical/api/fleet/makers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/makers'], exact: false });
      toast({ title: "Success", description: "Maker deleted successfully" });
      setDeleteDialogOpen(false);
      setMakerToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete maker", variant: "destructive" });
    },
  });

  const updateMakerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<MakerList> }) => {
      const res = await apiRequest('PUT', `/technical/api/fleet/makers/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/makers'], exact: false });
      toast({ title: "Success", description: "Maker updated successfully" });
      setIsEditMode(false);
      setDetailMaker(null);
      setMakerFormData({});
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update maker", variant: "destructive" });
    },
  });

  const createMakerMutation = useMutation({
    mutationFn: async (data: Partial<MakerList>) => {
      const res = await apiRequest('POST', '/technical/api/fleet/makers', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/makers'], exact: false });
      toast({ title: "Success", description: "Maker created successfully" });
      setIsAddMode(false);
      setMakerFormData({});
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create maker", variant: "destructive" });
    },
  });

  const filteredMakers = makers?.filter((maker) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      maker.makerName?.toLowerCase().includes(query) ||
      maker.makerCode?.toLowerCase().includes(query) ||
      maker.address?.toLowerCase().includes(query)
    );
  }) || [];

  const handleAddNew = () => {
    setMakerFormData({ isActive: true });
    setIsAddMode(true);
    setDetailMaker(null);
    setIsEditMode(false);
  };

  const handleEdit = (maker: MakerList) => {
    setDetailMaker(maker);
    setMakerFormData({ ...maker });
    setIsEditMode(true);
  };

  const handleRowDoubleClick = (maker: MakerList) => {
    setDetailMaker(maker);
    setIsEditMode(false);
    setIsAddMode(false);
  };

  const handleDeleteClick = (maker: MakerList) => {
    setMakerToDelete(maker);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (makerToDelete) {
      deleteMutation.mutate(makerToDelete.id);
    }
  };

  const handleSaveEdit = () => {
    if (!detailMaker) return;
    const EDITABLE_FIELDS: (keyof MakerList)[] = [
      'makerCode', 'makerName', 'address', 'addressId',
      'contactPerson', 'email', 'phone', 'isActive',
    ];
    const changedFields: Record<string, any> = {};
    for (const field of EDITABLE_FIELDS) {
      const oldVal = detailMaker[field];
      const newVal = makerFormData[field];
      if (newVal !== oldVal) {
        changedFields[field] = newVal;
      }
    }
    if (Object.keys(changedFields).length === 0) {
      toast({ title: "No Changes", description: "No changes were made" });
      return;
    }
    updateMakerMutation.mutate({ id: detailMaker.id, data: changedFields });
  };

  const handleSaveAdd = () => {
    if (!makerFormData.makerName?.trim()) {
      toast({ title: "Validation Error", description: "Maker Name is required", variant: "destructive" });
      return;
    }
    const payload: Record<string, any> = {};
    Object.entries(makerFormData).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        payload[key] = value;
      }
    });
    if (!payload.makerCode) {
      payload.makerCode = '';
    }
    createMakerMutation.mutate(payload as Partial<MakerList>);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setMakerFormData({});
  };

  const handleCancelAdd = () => {
    setIsAddMode(false);
    setMakerFormData({});
  };

  const handleBackToList = () => {
    setDetailMaker(null);
    setIsEditMode(false);
    setMakerFormData({});
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/technical/api/bulk/makers/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `maker-list-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Success", description: "Maker list exported successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to export maker list", variant: "destructive" });
    }
  };

  const totalMakers = makers?.length || 0;

  const renderMakerFormSections = (formData: Partial<MakerList>, setFormData: (fn: (prev: Partial<MakerList>) => Partial<MakerList>) => void) => (
    <div className="max-w-5xl mx-auto space-y-6">
      <SectionBlock id="maker-info" number="A1" title="Maker Information" description="Core identification details for the manufacturer">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-sm text-[#8798ad]">Maker Code</Label>
            <Input
              placeholder="Auto-generated if empty"
              value={formData.makerCode || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, makerCode: e.target.value }))}
              data-testid="input-maker-code"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-sm text-[#8798ad]">Maker Name *</Label>
            <Input
              placeholder="Enter maker name"
              value={formData.makerName || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, makerName: e.target.value }))}
              data-testid="input-maker-name"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-sm text-[#8798ad]">Address</Label>
            <Input
              placeholder="Enter address"
              value={formData.address || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              data-testid="input-maker-address"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm text-[#8798ad]">Address ID</Label>
            <Input
              placeholder="Enter address ID"
              value={formData.addressId || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, addressId: e.target.value }))}
              data-testid="input-maker-address-id"
            />
          </div>
        </div>
      </SectionBlock>

      <SectionBlock id="maker-contact" number="A2" title="Contact & Status" description="Contact information and active status">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-sm text-[#8798ad]">Contact Person</Label>
            <Input
              placeholder="Enter contact person"
              value={formData.contactPerson || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
              data-testid="input-maker-contact-person"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm text-[#8798ad]">Email</Label>
            <Input
              placeholder="Enter email"
              value={formData.email || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              data-testid="input-maker-email"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm text-[#8798ad]">Phone</Label>
            <Input
              placeholder="Enter phone number"
              value={formData.phone || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              data-testid="input-maker-phone"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm text-[#8798ad]">Status</Label>
            <Select
              value={formData.isActive === true ? "Active" : formData.isActive === false ? "Inactive" : ""}
              onValueChange={(val) => setFormData(prev => ({ ...prev, isActive: val === "Active" }))}
            >
              <SelectTrigger data-testid="input-maker-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
              <h1 className="text-xl font-bold text-white" data-testid="title-add-maker">Add New Maker</h1>
              <p className="text-cyan-100 text-sm mt-0.5">
                {makerFormData.makerName || "Create a new manufacturer"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="bg-white/20 text-white border-white/30"
              variant="outline"
              onClick={handleCancelAdd}
              data-testid="btn-cancel-add-maker"
            >
              Cancel
            </Button>
            <Button
              className="bg-white text-blue-600"
              onClick={handleSaveAdd}
              disabled={createMakerMutation.isPending}
              data-testid="btn-save-add-maker"
            >
              {createMakerMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          {renderMakerFormSections(makerFormData, setMakerFormData)}
        </div>
      </div>
    );
  }

  if (detailMaker && isEditMode) {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Pencil className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white" data-testid="title-edit-maker">Edit Maker Details</h1>
              <p className="text-cyan-100 text-sm mt-0.5">
                {makerFormData.makerName || detailMaker.makerName || "Edit manufacturer information"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="bg-white/20 text-white border-white/30"
              variant="outline"
              onClick={handleCancelEdit}
              data-testid="btn-cancel-edit-maker"
            >
              Cancel
            </Button>
            <Button
              className="bg-white text-blue-600"
              onClick={handleSaveEdit}
              disabled={updateMakerMutation.isPending}
              data-testid="btn-save-edit-maker"
            >
              {updateMakerMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          {renderMakerFormSections(makerFormData, setMakerFormData)}
        </div>
      </div>
    );
  }

  if (detailMaker) {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Info className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white" data-testid="title-maker-details">Maker Details</h1>
              <p className="text-cyan-100 text-sm mt-0.5">{detailMaker.makerName || "View manufacturer information"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="bg-white/20 text-white border-white/30"
              variant="outline"
              onClick={handleBackToList}
              data-testid="btn-back-maker-list"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              className="bg-white text-blue-600"
              onClick={() => handleEdit(detailMaker)}
              data-testid="btn-edit-maker"
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <SectionBlock id="detail-maker-info" number="A1" title="Maker Information" description="Core identification details for the manufacturer">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Maker Code</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-maker-code">{detailMaker.makerCode || '-'}</div>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-sm text-[#8798ad]">Maker Name</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-maker-name">{detailMaker.makerName || '-'}</div>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-sm text-[#8798ad]">Address</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-maker-address">{detailMaker.address || '-'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Address ID</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-maker-address-id">{detailMaker.addressId || '-'}</div>
                </div>
              </div>
            </SectionBlock>

            <SectionBlock id="detail-maker-contact" number="A2" title="Contact & Status" description="Contact information and active status">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Contact Person</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-contact-person">{detailMaker.contactPerson || '-'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Email</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-email">{detailMaker.email || '-'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Phone</Label>
                  <div className="text-sm font-medium text-gray-900" data-testid="detail-phone">{detailMaker.phone || '-'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-[#8798ad]">Status</Label>
                  <div data-testid="detail-status">
                    <Badge
                      variant="outline"
                      className={`no-default-hover-elevate no-default-active-elevate ${
                        detailMaker.isActive !== false
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      {detailMaker.isActive !== false ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
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
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Maker Management</h1>
                <p className="text-cyan-100 text-sm mt-0.5">Manage equipment manufacturers and suppliers</p>
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
              <h2 className="text-base font-semibold text-gray-800" data-testid="I4.QL.1.10"><Marker id="I4.QL.1.10" />All Makers</h2>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-total-makers">
                  <Package className="h-3 w-3 mr-1" />
                  {totalMakers} Total
                </Badge>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-filtered-makers">
                  {filteredMakers.length} Shown
                </Badge>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="relative flex-1 sm:min-w-[250px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="I4.QL.1.11"
                />
                <Marker id="I4.QL.1.11" />
              </div>

              <Button
                variant="outline"
                onClick={handleExport}
                className="border-gray-300 text-gray-700"
                data-testid="button-export-makers"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button
                onClick={handleAddNew}
                className="bg-cyan-600 whitespace-nowrap"
                data-testid="I4.QL.1.12"
              >
                <Marker id="I4.QL.1.12" />
                <Plus className="mr-2 h-4 w-4" />
                Add New Maker
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
              <Building2 className="h-10 w-10 text-red-300 mx-auto mb-2" />
              <p className="text-red-700 font-medium">Failed to load makers</p>
              <p className="text-red-500 text-sm mt-1">Please try refreshing the page</p>
            </div>
          ) : filteredMakers.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {searchQuery ? "No makers found matching your search" : "No makers yet"}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {searchQuery ? "Try adjusting your search terms" : "Add your first maker to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-200">
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.1.13"><Marker id="I4.QL.1.13" />S.No</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.1.14"><Marker id="I4.QL.1.14" />Maker Code</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.1.15"><Marker id="I4.QL.1.15" />Maker Name</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.1.16"><Marker id="I4.QL.1.16" />Address</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.1.17"><Marker id="I4.QL.1.17" />Address ID</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3">Status</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.1.18"><Marker id="I4.QL.1.18" />Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMakers.map((maker, index) => {
                    const isFirstRow = index === 0;
                    return (
                      <TableRow
                        key={maker.id}
                        data-testid={`row-maker-${maker.id}`}
                        className="cursor-pointer"
                        onDoubleClick={() => handleRowDoubleClick(maker)}
                      >
                        <TableCell className="font-medium" data-testid={isFirstRow ? "I4.QL.1.19" : undefined}>
                          {isFirstRow && <Marker id="I4.QL.1.19" />}
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-mono text-sm" data-testid={isFirstRow ? "I4.QL.1.20" : undefined}>
                          {isFirstRow && <Marker id="I4.QL.1.20" />}
                          {maker.makerCode}
                        </TableCell>
                        <TableCell className="font-medium max-w-xs truncate" data-testid={isFirstRow ? "I4.QL.1.21" : undefined}>
                          {isFirstRow && <Marker id="I4.QL.1.21" />}
                          {maker.makerName}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" data-testid={isFirstRow ? "I4.QL.1.22" : undefined}>
                          {isFirstRow && <Marker id="I4.QL.1.22" />}
                          {maker.address || "-"}
                        </TableCell>
                        <TableCell data-testid={isFirstRow ? "I4.QL.1.23" : undefined}>
                          {isFirstRow && <Marker id="I4.QL.1.23" />}
                          {maker.addressId || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`no-default-hover-elevate no-default-active-elevate ${
                              maker.isActive !== false
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}
                          >
                            {maker.isActive !== false ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); handleEdit(maker); }}
                              data-testid={isFirstRow ? "I4.QL.1.24" : `button-edit-${maker.id}`}
                            >
                              {isFirstRow && <Marker id="I4.QL.1.24" />}
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); handleDeleteClick(maker); }}
                              className="text-red-600"
                              data-testid={isFirstRow ? "I4.QL.1.25" : `button-delete-${maker.id}`}
                            >
                              {isFirstRow && <Marker id="I4.QL.1.25" />}
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
        <AlertDialogContent data-testid="dialog-delete-maker">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Delete Maker</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Are you sure you want to delete "<span className="font-medium text-gray-800">{makerToDelete?.makerName}</span>"? This action cannot be undone.
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
