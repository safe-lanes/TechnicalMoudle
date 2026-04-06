import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type MasterList, insertMasterListSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, List, Package, ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Marker } from "@/components/Marker";

const masterListFormSchema = insertMasterListSchema;
type MasterListFormData = z.infer<typeof masterListFormSchema>;

const LIST_TYPES = [
  { value: "department", label: "Department" },
  { value: "rank", label: "Rank" },
  { value: "intervalUnit", label: "Interval Unit" },
  { value: "componentCategory", label: "Component Category" },
  { value: "location", label: "Location" },
  { value: "postponementReason", label: "Postponement Reason" },
  { value: "overdueReason", label: "Overdue Reason" },
];

export default function MasterListsManagement({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const [selectedListType, setSelectedListType] = useState<string>("department");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MasterList | null>(null);
  const [selectedRowItem, setSelectedRowItem] = useState<MasterList | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MasterList | null>(null);

  // Fetch master lists based on selected type
  const { data: masterLists, isLoading, error } = useQuery<MasterList[]>({
    queryKey: ['/technical/api/fleet/master-lists', selectedListType],
    queryFn: async () => {
      const response = await fetch(`/technical/api/fleet/master-lists?listType=${selectedListType}`);
      if (!response.ok) throw new Error('Failed to fetch master lists');
      return response.json();
    },
  });

  const form = useForm<MasterListFormData>({
    resolver: zodResolver(masterListFormSchema),
    defaultValues: {
      listType: selectedListType,
      listKey: "",
      listValue: "",
      displayOrder: 0,
      isActive: true,
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: MasterListFormData) => {
      return apiRequest('POST', '/technical/api/fleet/master-lists', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/master-lists'], exact: false });
      toast({
        title: "Success",
        description: "Master list item created successfully",
      });
      setIsFormOpen(false);
      form.reset({
        listType: selectedListType,
        listKey: "",
        listValue: "",
        displayOrder: 0,
        isActive: true,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create master list item",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: MasterListFormData & { id: number }) => {
      const { id, ...updateData } = data;
      return apiRequest('PUT', `/technical/api/fleet/master-lists/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/master-lists'], exact: false });
      toast({
        title: "Success",
        description: "Master list item updated successfully",
      });
      setIsFormOpen(false);
      setSelectedItem(null);
      setSelectedRowItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update master list item",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/technical/api/fleet/master-lists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/master-lists'], exact: false });
      toast({
        title: "Success",
        description: "Master list item deleted successfully",
      });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      setSelectedRowItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete master list item",
        variant: "destructive",
      });
    },
  });

  const handleAddNew = () => {
    setSelectedItem(null);
    form.reset({
      listType: selectedListType,
      listKey: "",
      listValue: "",
      displayOrder: 0,
      isActive: true,
    });
    setIsFormOpen(true);
  };

  const handleEdit = (item: MasterList) => {
    setSelectedItem(item);
    form.reset({
      listType: item.listType,
      listKey: item.listKey,
      listValue: item.listValue,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
    });
    setIsFormOpen(true);
  };

  const handleDeleteClick = (item: MasterList) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (itemToDelete) {
      deleteMutation.mutate(itemToDelete.id);
    }
  };

  const onSubmit = (data: MasterListFormData) => {
    if (selectedItem) {
      updateMutation.mutate({ ...data, id: selectedItem.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const totalItems = masterLists?.length || 0;

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="I4.QL.2.7"><Marker id="I4.QL.2.7" />Master Lists Management</h1>
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
            onClick={() => selectedRowItem && handleEdit(selectedRowItem)}
            disabled={!selectedRowItem}
            variant="outline"
            size="sm"
            className="h-8 gap-2 bg-white text-[#0f172a] border-gray-300 disabled:opacity-50"
            data-testid="I4.QL.2.11"
          >
            <Marker id="I4.QL.2.11" />
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            size="sm"
            className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
            onClick={handleAddNew}
            data-testid="I4.QL.2.12"
          >
            <Marker id="I4.QL.2.12" />
            <Plus className="h-4 w-4 mr-1" />
            Add New
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedListType} onValueChange={(value) => {
          setSelectedListType(value);
          setSelectedRowItem(null);
        }}>
          <SelectTrigger className="w-[200px] bg-white border-gray-300" data-testid="I4.QL.2.10">
            <Marker id="I4.QL.2.10" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIST_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-total-items">
          <Package className="h-3 w-3 mr-1" />
          {totalItems} Total
        </Badge>
      </div>

      <div>
          {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 animate-pulse rounded"></div>
                ))}
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-700">Failed to load master lists</p>
              </div>
            ) : !masterLists || masterLists.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  No items in this list. Add your first item to get started.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto bg-white rounded-lg border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                      <TableHead className="text-left text-white py-3 px-4 font-medium" data-testid="I4.QL.2.13"><Marker id="I4.QL.2.13" />Key</TableHead>
                      <TableHead className="text-left text-white py-3 px-4 font-medium" data-testid="I4.QL.2.14"><Marker id="I4.QL.2.14" />Value</TableHead>
                      <TableHead className="text-left text-white py-3 px-4 font-medium" data-testid="I4.QL.2.15"><Marker id="I4.QL.2.15" />Display Order</TableHead>
                      <TableHead className="text-left text-white py-3 px-4 font-medium" data-testid="I4.QL.2.16"><Marker id="I4.QL.2.16" />Active</TableHead>
                      <TableHead className="text-right text-white py-3 px-4 font-medium" data-testid="I4.QL.2.17"><Marker id="I4.QL.2.17" />Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {masterLists.map((item, index) => (
                      <TableRow 
                        key={item.id} 
                        data-testid={`row-master-list-${item.id}`}
                        onClick={() => setSelectedRowItem(selectedRowItem?.id === item.id ? null : item)}
                        className={`cursor-pointer ${
                          selectedRowItem?.id === item.id 
                            ? 'bg-blue-50' 
                            : index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                        } hover:bg-gray-100`}
                      >
                        <TableCell className="font-mono text-sm text-blue-600" data-testid={index === 0 ? "I4.QL.2.18" : undefined}>
                          {index === 0 && <Marker id="I4.QL.2.18" />}
                          {item.listKey}
                        </TableCell>
                        <TableCell className="font-medium" data-testid={index === 0 ? "I4.QL.2.19" : undefined}>
                          {index === 0 && <Marker id="I4.QL.2.19" />}
                          {item.listValue}
                        </TableCell>
                        <TableCell data-testid={index === 0 ? "I4.QL.2.20" : undefined}>
                          {index === 0 && <Marker id="I4.QL.2.20" />}
                          {item.displayOrder}
                        </TableCell>
                        <TableCell data-testid={index === 0 ? "I4.QL.2.21" : undefined}>
                          {index === 0 && <Marker id="I4.QL.2.21" />}
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              item.isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {item.isActive ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(item);
                              }}
                              className="p-1 hover:bg-gray-200 rounded"
                              data-testid={index === 0 ? "I4.QL.2.22" : `button-edit-${item.id}`}
                            >
                              {index === 0 && <Marker id="I4.QL.2.22" />}
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(item);
                              }}
                              className="p-1 hover:bg-gray-200 rounded text-red-500"
                              data-testid={index === 0 ? "I4.QL.2.23" : `button-delete-${item.id}`}
                            >
                              {index === 0 && <Marker id="I4.QL.2.23" />}
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
        </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-master-list-form">
          <DialogHeader>
            <DialogTitle>
              {selectedItem ? "Edit Master List Item" : "Add New Master List Item"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* List Type - Read only in edit mode */}
            <div className="space-y-2">
              <Label htmlFor="listType">List Type</Label>
              <Select
                value={form.watch("listType")}
                onValueChange={(value) => form.setValue("listType", value)}
                disabled={!!selectedItem}
              >
                <SelectTrigger data-testid="input-list-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIST_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Key */}
            <div className="space-y-2">
              <Label htmlFor="listKey">
                Key <span className="text-red-500">*</span>
              </Label>
              <Input
                id="listKey"
                {...form.register("listKey")}
                placeholder="Unique identifier (e.g., DECK, ENGINE)"
                data-testid="input-list-key"
              />
              {form.formState.errors.listKey && (
                <p className="text-sm text-red-500">{form.formState.errors.listKey.message}</p>
              )}
            </div>

            {/* Value */}
            <div className="space-y-2">
              <Label htmlFor="listValue">
                Value <span className="text-red-500">*</span>
              </Label>
              <Input
                id="listValue"
                {...form.register("listValue")}
                placeholder="Display value (e.g., Deck Department)"
                data-testid="input-list-value"
              />
              {form.formState.errors.listValue && (
                <p className="text-sm text-red-500">{form.formState.errors.listValue.message}</p>
              )}
            </div>

            {/* Display Order */}
            <div className="space-y-2">
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                type="number"
                {...form.register("displayOrder", { valueAsNumber: true })}
                placeholder="0"
                data-testid="input-display-order"
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={form.watch("isActive")}
                onCheckedChange={(checked) => form.setValue("isActive", checked)}
                data-testid="switch-is-active"
              />
              <Label htmlFor="isActive">Active</Label>
            </div>

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
                data-testid="button-save-master-list"
              >
                {isPending ? "Saving..." : selectedItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-master-list">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Master List Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.listValue}"? This action cannot be undone.
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
