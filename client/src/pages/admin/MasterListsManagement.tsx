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
import { Plus, Pencil, Trash2 } from "lucide-react";
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
];

export default function MasterListsManagement() {
  const { toast } = useToast();
  const [selectedListType, setSelectedListType] = useState<string>("department");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MasterList | null>(null);
  const [selectedRowItem, setSelectedRowItem] = useState<MasterList | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MasterList | null>(null);

  // Fetch master lists based on selected type
  const { data: masterLists, isLoading, error } = useQuery<MasterList[]>({
    queryKey: ['/api/fleet/master-lists', selectedListType],
    queryFn: async () => {
      const response = await fetch(`/api/fleet/master-lists?listType=${selectedListType}`);
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
      return apiRequest('POST', '/api/fleet/master-lists', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fleet/master-lists'], exact: false });
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
      return apiRequest('PUT', `/api/fleet/master-lists/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fleet/master-lists'], exact: false });
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
      return apiRequest('DELETE', `/api/fleet/master-lists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fleet/master-lists'], exact: false });
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900" data-testid="I4.QL.2.7"><Marker id="I4.QL.2.7" />Master Lists Management</h1>
          <p className="text-gray-600 mt-2" data-testid="I4.QL.2.9"><Marker id="I4.QL.2.9" />Configure dropdown options and system classifications</p>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle className="text-lg font-semibold" data-testid="I4.QL.2.8"><Marker id="I4.QL.2.8" />Master List Items</CardTitle>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* List Type Selector */}
                <Select value={selectedListType} onValueChange={(value) => {
                  setSelectedListType(value);
                  setSelectedRowItem(null);
                }}>
                  <SelectTrigger className="w-full sm:w-[200px] bg-white" data-testid="I4.QL.2.10">
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
                {/* Edit Button - for selected row */}
                <Button
                  onClick={() => selectedRowItem && handleEdit(selectedRowItem)}
                  disabled={!selectedRowItem}
                  className="whitespace-nowrap bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
                  data-testid="I4.QL.2.11"
                >
                  <Marker id="I4.QL.2.11" />
                  Edit
                </Button>
                {/* Add New Button */}
                <Button
                  onClick={handleAddNew}
                  className="whitespace-nowrap bg-green-500 hover:bg-green-600 text-white"
                  data-testid="I4.QL.2.12"
                >
                  <Marker id="I4.QL.2.12" />
                  <Plus className="mr-2 h-4 w-4" />
                  Add New
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead data-testid="I4.QL.2.13"><Marker id="I4.QL.2.13" />Key</TableHead>
                      <TableHead data-testid="I4.QL.2.14"><Marker id="I4.QL.2.14" />Value</TableHead>
                      <TableHead data-testid="I4.QL.2.15"><Marker id="I4.QL.2.15" />Display Order</TableHead>
                      <TableHead data-testid="I4.QL.2.16"><Marker id="I4.QL.2.16" />Active</TableHead>
                      <TableHead className="text-right" data-testid="I4.QL.2.17"><Marker id="I4.QL.2.17" />Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {masterLists.map((item, index) => (
                      <TableRow 
                        key={item.id} 
                        data-testid={`row-master-list-${item.id}`}
                        onClick={() => setSelectedRowItem(selectedRowItem?.id === item.id ? null : item)}
                        className={`cursor-pointer hover:bg-gray-50 ${
                          selectedRowItem?.id === item.id 
                            ? 'bg-blue-50 hover:bg-blue-100' 
                            : ''
                        }`}
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
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(item);
                              }}
                              className="text-gray-500 hover:text-gray-700"
                              data-testid={index === 0 ? "I4.QL.2.22" : `button-edit-${item.id}`}
                            >
                              {index === 0 && <Marker id="I4.QL.2.22" />}
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(item);
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              data-testid={index === 0 ? "I4.QL.2.23" : `button-delete-${item.id}`}
                            >
                              {index === 0 && <Marker id="I4.QL.2.23" />}
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
          </CardContent>
        </Card>
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
