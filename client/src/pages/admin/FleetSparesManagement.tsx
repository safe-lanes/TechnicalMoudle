import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Spare, type Component } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Upload, Download } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import FleetSpareForm from "./FleetSpareForm";

export default function FleetSparesManagement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSpare, setSelectedSpare] = useState<Spare | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [spareToDelete, setSpareToDelete] = useState<Spare | null>(null);

  // Fetch fleet spares
  const { data: spares, isLoading, error } = useQuery<Spare[]>({
    queryKey: ['/api/fleet/spares'],
  });

  // Fetch fleet components for equipment filter
  const { data: components } = useQuery<Component[]>({
    queryKey: ['/api/fleet/components'],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/fleet/spares/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fleet/spares'], exact: false });
      toast({
        title: "Success",
        description: "Fleet spare deleted successfully",
      });
      setDeleteDialogOpen(false);
      setSpareToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete spare",
        variant: "destructive",
      });
    },
  });

  // Filter spares based on search query and selected equipment
  const filteredSpares = spares?.filter((spare) => {
    // Equipment filter
    if (selectedEquipment !== "all" && spare.fleetEquipmentCode !== selectedEquipment) {
      return false;
    }

    // Search filter
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      spare.partName?.toLowerCase().includes(query) ||
      spare.fleetPartCode?.toLowerCase().includes(query) ||
      spare.maker?.toLowerCase().includes(query) ||
      spare.fleetEquipmentCode?.toLowerCase().includes(query)
    );
  }) || [];

  const handleAddNew = () => {
    setSelectedSpare(null);
    setIsFormOpen(true);
  };

  const handleEdit = (spare: Spare) => {
    setSelectedSpare(spare);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (spare: Spare) => {
    setSpareToDelete(spare);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (spareToDelete) {
      deleteMutation.mutate(spareToDelete.id);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/fleet/spares/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fleet-spares-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Success",
        description: "Spares exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export spares",
        variant: "destructive",
      });
    }
  };

  // Get unique equipment codes for filter
  const equipmentOptions = components?.filter(c => c.fleetEquipmentCode) || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Fleet Spares Management</h1>
          <p className="text-gray-600 mt-2">Manage fleet-level spare parts inventory</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle>All Fleet Spares</CardTitle>
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Equipment Filter */}
                <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                  <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-equipment-filter">
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

                {/* Search Bar */}
                <div className="relative flex-1 sm:min-w-[250px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search spares..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-spares"
                  />
                </div>

                {/* Action Buttons */}
                <Button
                  variant="outline"
                  onClick={handleExport}
                  data-testid="button-export-spares"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
                <Button
                  onClick={handleAddNew}
                  className="whitespace-nowrap"
                  data-testid="button-add-spare"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Spare
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
                <p className="text-red-700">Failed to load spares</p>
              </div>
            ) : filteredSpares.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {searchQuery || selectedEquipment !== "all"
                    ? "No spares found matching your filters"
                    : "No spares yet. Add your first spare to get started."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part Code</TableHead>
                      <TableHead>Part Name</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Maker Reference</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSpares.map((spare) => {
                      const equipment = components?.find(c => c.fleetEquipmentCode === spare.fleetEquipmentCode);
                      return (
                        <TableRow key={spare.id} data-testid={`row-spare-${spare.id}`}>
                          <TableCell className="font-mono text-sm">{spare.fleetPartCode}</TableCell>
                          <TableCell className="font-medium">{spare.partName}</TableCell>
                          <TableCell className="text-sm">
                            {equipment ? `${equipment.fleetEquipmentCode} - ${equipment.fleetEquipmentName}` : spare.fleetEquipmentCode || "-"}
                          </TableCell>
                          <TableCell className="text-sm">{spare.maker || "-"}</TableCell>
                          <TableCell>{spare.uom || "-"}</TableCell>
                          <TableCell>{spare.location || "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(spare)}
                                data-testid={`button-edit-${spare.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(spare)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                data-testid={`button-delete-${spare.id}`}
                              >
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
          </CardContent>
        </Card>
      </div>

      {/* Spare Form Dialog */}
      <FleetSpareForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        spare={selectedSpare}
      />

      {/* Delete Confirmation Dialog */}
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
