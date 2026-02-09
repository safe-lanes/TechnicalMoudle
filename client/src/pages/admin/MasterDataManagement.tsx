import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type MasterData } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Download, RefreshCw, FileCode2, Package, ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const masterDataFormSchema = z.object({
  makerName: z.string().min(1, "Maker name is required"),
  makerCode: z.string().min(1, "Maker code is required"),
  model: z.string().min(1, "Model is required"),
  modelCode: z.string().optional(),
  sfiCode: z.string().min(1, "Component code is required"),
  equipmentName: z.string().min(1, "Equipment name is required"),
  vesselName: z.string().optional(),
  vesselCode: z.string().optional(),
  assignedSubCode: z.string().optional(),
});

type MasterDataFormData = z.infer<typeof masterDataFormSchema>;

type SfiDetails = {
  id: number;
  componentCode: string;
  componentName: string;
};

export default function MasterDataManagement({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MasterData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MasterData | null>(null);

  type MasterDataResponse = { items: MasterData[]; total: number; limit: number; offset: number };
  
  const { data: masterDataResponse, isLoading, error, refetch } = useQuery<MasterDataResponse>({
    queryKey: ['/technical/api/fleet-admin/master-data', { limit: 10000 }],
    queryFn: async () => {
      const response = await fetch('/technical/api/fleet-admin/master-data?limit=10000');
      if (!response.ok) throw new Error('Failed to fetch master data');
      return response.json();
    }
  });
  
  const masterDataList = masterDataResponse?.items ?? [];

  const { data: sfiDetails } = useQuery<SfiDetails[]>({
    queryKey: ['/technical/api/fleet-admin/sfi-details'],
  });

  const form = useForm<MasterDataFormData>({
    resolver: zodResolver(masterDataFormSchema),
    defaultValues: {
      makerName: "",
      makerCode: "",
      model: "",
      modelCode: "",
      sfiCode: "",
      equipmentName: "",
      vesselName: "",
      vesselCode: "",
      assignedSubCode: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: MasterDataFormData) => {
      return apiRequest('POST', '/technical/api/fleet-admin/master-data', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet-admin/master-data'], exact: false });
      toast({
        title: "Success",
        description: "Master data entry created successfully. Fleet Equipment Code was auto-generated.",
      });
      setIsFormOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create master data entry",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: MasterDataFormData & { id: number }) => {
      const { id, ...updateData } = data;
      return apiRequest('PATCH', `/technical/api/fleet-admin/master-data/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet-admin/master-data'], exact: false });
      toast({
        title: "Success",
        description: "Master data entry updated successfully",
      });
      setIsFormOpen(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update master data entry",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/technical/api/fleet-admin/master-data/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet-admin/master-data'], exact: false });
      toast({
        title: "Success",
        description: "Master data entry deleted successfully",
      });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete master data entry",
        variant: "destructive",
      });
    },
  });

  const filteredItems = masterDataList?.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.fleetEquipmentCode?.toLowerCase().includes(query) ||
      item.sfiCode?.toLowerCase().includes(query) ||
      item.equipmentName?.toLowerCase().includes(query) ||
      item.vesselName?.toLowerCase().includes(query) ||
      item.modelCode?.toLowerCase().includes(query)
    );
  }) || [];

  const handleAddNew = () => {
    setSelectedItem(null);
    form.reset({
      makerName: "",
      makerCode: "",
      model: "",
      modelCode: "",
      sfiCode: "",
      equipmentName: "",
      vesselName: "",
      vesselCode: "",
      assignedSubCode: "",
    });
    setIsFormOpen(true);
  };

  const handleEdit = (item: MasterData) => {
    setSelectedItem(item);
    form.reset({
      makerName: item.makerName || "",
      makerCode: item.makerCode || "",
      model: item.model || "",
      modelCode: item.modelCode || "",
      sfiCode: item.sfiCode || "",
      equipmentName: item.equipmentName || "",
      vesselName: item.vesselName || "",
      vesselCode: item.vesselCode || "",
      assignedSubCode: item.assignedSubCode || "",
    });
    setIsFormOpen(true);
  };

  const handleDeleteClick = (item: MasterData) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (itemToDelete) {
      deleteMutation.mutate(itemToDelete.id);
    }
  };

  const onSubmit = (data: MasterDataFormData) => {
    if (selectedItem) {
      updateMutation.mutate({ ...data, id: selectedItem.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSfiChange = (sfiCode: string) => {
    form.setValue("sfiCode", sfiCode);
    const selectedSfi = sfiDetails?.find(s => s.componentCode === sfiCode);
    if (selectedSfi) {
      form.setValue("equipmentName", selectedSfi.componentName);
    }
  };

  const handleExport = () => {
    if (!masterDataList || masterDataList.length === 0) {
      toast({
        title: "No Data",
        description: "No master data to export",
        variant: "destructive",
      });
      return;
    }

    const csvContent = [
      ["Model Code", "Component Code", "Fleet Equipment Code", "Count Component Code", "Assigned Sub Code", "Vessel Name", "Equipment Name"].join(","),
      ...masterDataList.map(item => [
        item.modelCode || "",
        item.sfiCode || "",
        item.fleetEquipmentCode || "",
        item.countSfiCode || 0,
        item.assignedSubCode || "",
        item.vesselName || "",
        item.equipmentName || ""
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `master_data_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({
      title: "Export Complete",
      description: `Exported ${masterDataList.length} records to CSV`,
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const totalRecords = masterDataResponse?.total || 0;
  const shownRecords = filteredItems.length;

  return (
    <div className="p-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-5">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-cyan-100 hover:text-white text-sm mb-2 transition-colors"
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
          )}
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-white/20 rounded-lg">
              <FileCode2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Fleet Equipment Code Master Data</h1>
              <p className="text-cyan-100 text-sm mt-0.5">Manage Fleet Equipment Codes that link fleet-level components to vessels</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-semibold text-gray-800">All Equipment Codes</h2>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-total-records">
                  <Package className="h-3 w-3 mr-1" />
                  {totalRecords} Total
                </Badge>
                <Badge variant="secondary" className="bg-green-100 text-green-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-shown-records">
                  {shownRecords} Shown
                </Badge>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 sm:min-w-[250px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search equipment codes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-gray-300"
                  data-testid="input-search-master-data"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="border-gray-300"
                  onClick={handleExport}
                  data-testid="button-export"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button
                  onClick={handleAddNew}
                  className="whitespace-nowrap bg-cyan-600"
                  data-testid="button-add-master-data"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Entry
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 animate-pulse rounded"></div>
                ))}
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-700">Failed to load master data</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <FileCode2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">
                  {searchQuery 
                    ? "No entries found matching your search" 
                    : "No master data entries yet. Add your first entry to get started."}
                </p>
                <Button onClick={handleAddNew} className="mt-4" data-testid="button-add-first">
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Entry
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-gray-600">Fleet Equipment Code</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-gray-600">Component Code</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-gray-600">Equipment Name</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-gray-600">Model Code</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-gray-600">Vessel Name</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-gray-600">Count Component Code</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-gray-600 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id} data-testid={`row-master-data-${item.id}`}>
                        <TableCell className="font-mono text-sm font-bold text-blue-600">
                          {item.fleetEquipmentCode}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.sfiCode}</TableCell>
                        <TableCell className="font-medium max-w-xs truncate">{item.equipmentName}</TableCell>
                        <TableCell>{item.modelCode || "-"}</TableCell>
                        <TableCell>{item.vesselName || "-"}</TableCell>
                        <TableCell className="text-center">{item.countSfiCode || 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(item)}
                              data-testid={`button-edit-${item.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(item)}
                              className="text-red-500"
                              data-testid={`button-delete-${item.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
        </div>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[600px]" data-testid="dialog-master-data-form">
          <DialogHeader>
            <DialogTitle>
              {selectedItem ? "Edit Master Data Entry" : "Add New Master Data Entry"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto">
            {selectedItem && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <Label className="text-blue-700 text-sm">Fleet Equipment Code (Read-Only)</Label>
                <div className="font-mono text-lg font-bold text-blue-800 mt-1">
                  {selectedItem.fleetEquipmentCode}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="makerName">
                  Maker Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="makerName"
                  {...form.register("makerName")}
                  placeholder="e.g., Caterpillar"
                  data-testid="input-maker-name"
                />
                {form.formState.errors.makerName && (
                  <p className="text-sm text-red-500">{form.formState.errors.makerName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="makerCode">
                  Maker Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="makerCode"
                  {...form.register("makerCode")}
                  placeholder="e.g., CAT"
                  data-testid="input-maker-code"
                />
                {form.formState.errors.makerCode && (
                  <p className="text-sm text-red-500">{form.formState.errors.makerCode.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model">
                  Model <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="model"
                  {...form.register("model")}
                  placeholder="e.g., 3516"
                  data-testid="input-model"
                />
                {form.formState.errors.model && (
                  <p className="text-sm text-red-500">{form.formState.errors.model.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="modelCode">Model Code (Auto)</Label>
                <Input
                  id="modelCode"
                  {...form.register("modelCode")}
                  placeholder="e.g., CAT-3516"
                  data-testid="input-model-code"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sfiCode">
                  Component Code <span className="text-red-500">*</span>
                </Label>
                {sfiDetails && sfiDetails.length > 0 ? (
                  <Select
                    value={form.watch("sfiCode")}
                    onValueChange={handleSfiChange}
                  >
                    <SelectTrigger data-testid="select-component-code">
                      <SelectValue placeholder="Select Component Code" />
                    </SelectTrigger>
                    <SelectContent>
                      {sfiDetails.map((sfi) => (
                        <SelectItem key={sfi.id} value={sfi.componentCode}>
                          {sfi.componentCode} - {sfi.componentName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="sfiCode"
                    {...form.register("sfiCode")}
                    placeholder="e.g., 722"
                    data-testid="input-component-code"
                  />
                )}
                {form.formState.errors.sfiCode && (
                  <p className="text-sm text-red-500">{form.formState.errors.sfiCode.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignedSubCode">Assigned Sub Code</Label>
                <Input
                  id="assignedSubCode"
                  {...form.register("assignedSubCode")}
                  placeholder="e.g., AA"
                  data-testid="input-assigned-sub-code"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="equipmentName">
                Equipment Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="equipmentName"
                {...form.register("equipmentName")}
                placeholder="e.g., Main Engine"
                data-testid="input-equipment-name"
              />
              {form.formState.errors.equipmentName && (
                <p className="text-sm text-red-500">{form.formState.errors.equipmentName.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vesselName">Vessel Name</Label>
                <Input
                  id="vesselName"
                  {...form.register("vesselName")}
                  placeholder="e.g., MV Pacific Star"
                  data-testid="input-vessel-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vesselCode">Vessel Code</Label>
                <Input
                  id="vesselCode"
                  {...form.register("vesselCode")}
                  placeholder="e.g., PACSTAR"
                  data-testid="input-vessel-code"
                />
              </div>
            </div>

            {!selectedItem && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <strong>Note:</strong> The Fleet Equipment Code will be automatically generated 
                based on the Component Code. Format: XXX.XXX.XX (e.g., 722.001.AA)
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                disabled={isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-save-master-data"
              >
                {isPending ? "Saving..." : selectedItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-master-data">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Master Data Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the entry with Fleet Equipment Code 
              "{itemToDelete?.fleetEquipmentCode}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
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
