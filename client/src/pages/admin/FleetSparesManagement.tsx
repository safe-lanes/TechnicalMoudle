import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type FleetSpares, type FleetComponents } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Download, Wrench, Package, ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import FleetSpareForm from "./FleetSpareForm";
import { Marker } from "@/components/Marker";

export default function FleetSparesManagement({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSpare, setSelectedSpare] = useState<FleetSpares | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [spareToDelete, setSpareToDelete] = useState<FleetSpares | null>(null);

  // Fetch fleet spares
  const { data: spares, isLoading, error } = useQuery<FleetSpares[]>({
    queryKey: ['/technical/api/fleet/spares'],
  });

  // Fetch fleet components for equipment filter
  const { data: components } = useQuery<FleetComponents[]>({
    queryKey: ['/technical/api/fleet/components'],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/technical/api/fleet/spares/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/spares'], exact: false });
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
      spare.partCode?.toLowerCase().includes(query) ||
      spare.maker?.toLowerCase().includes(query) ||
      spare.fleetEquipmentCode?.toLowerCase().includes(query)
    );
  }) || [];

  const handleAddNew = () => {
    setSelectedSpare(null);
    setIsFormOpen(true);
  };

  const handleEdit = (spare: FleetSpares) => {
    setSelectedSpare(spare);
    setIsFormOpen(true);
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

  const equipmentOptions = components?.filter(c => c.fleetEquipmentCode) || [];
  const totalSpares = spares?.length || 0;

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
                      <TableRow key={spare.id} data-testid={`row-spare-${spare.id}`}>
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
                              onClick={() => handleEdit(spare)}
                              data-testid={isFirstRow ? "I4.QL5.5.28" : `button-edit-${spare.id}`}
                            >
                              {isFirstRow && <Marker id="I4.QL5.5.28" />}
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(spare)}
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
