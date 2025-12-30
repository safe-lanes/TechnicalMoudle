import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Maker } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MakerForm from "./MakerForm";
import { Marker } from "@/components/Marker";

export default function MakerManagement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedMaker, setSelectedMaker] = useState<Maker | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [makerToDelete, setMakerToDelete] = useState<Maker | null>(null);

  // Fetch makers
  const { data: makers, isLoading, error } = useQuery<Maker[]>({
    queryKey: ['/api/fleet/makers'],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/fleet/makers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fleet/makers'], exact: false });
      toast({
        title: "Success",
        description: "Maker deleted successfully",
      });
      setDeleteDialogOpen(false);
      setMakerToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete maker",
        variant: "destructive",
      });
    },
  });

  // Filter makers based on search query (debounced in UI)
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
    setSelectedMaker(null);
    setIsFormOpen(true);
  };

  const handleEdit = (maker: Maker) => {
    setSelectedMaker(maker);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (maker: Maker) => {
    setMakerToDelete(maker);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (makerToDelete) {
      deleteMutation.mutate(makerToDelete.id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900" data-testid="I4.QL.1.7"><Marker id="I4.QL.1.7" />Makers Management</h1>
          <p className="text-gray-600 mt-2" data-testid="I4.QL.1.9"><Marker id="I4.QL.1.9" />Manage equipment manufacturers and suppliers</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle data-testid="I4.QL.1.10"><Marker id="I4.QL.1.10" />All Makers</CardTitle>
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 sm:min-w-[300px]">
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
                {/* Add New Button */}
                <Button
                  onClick={handleAddNew}
                  className="whitespace-nowrap"
                  data-testid="I4.QL.1.12"
                >
                  <Marker id="I4.QL.1.12" />
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Maker
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
                <p className="text-red-700">Failed to load makers</p>
              </div>
            ) : filteredMakers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {searchQuery ? "No makers found matching your search" : "No makers yet. Add your first maker to get started."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#52BAF3] hover:bg-[#52BAF3]">
                      <TableHead className="text-white font-medium" data-testid="I4.QL.1.13"><Marker id="I4.QL.1.13" />S.No</TableHead>
                      <TableHead className="text-white font-medium" data-testid="I4.QL.1.14"><Marker id="I4.QL.1.14" />Maker Code</TableHead>
                      <TableHead className="text-white font-medium" data-testid="I4.QL.1.15"><Marker id="I4.QL.1.15" />Maker Name</TableHead>
                      <TableHead className="text-white font-medium" data-testid="I4.QL.1.16"><Marker id="I4.QL.1.16" />Address</TableHead>
                      <TableHead className="text-white font-medium" data-testid="I4.QL.1.17"><Marker id="I4.QL.1.17" />Address ID</TableHead>
                      <TableHead className="text-white font-medium text-right" data-testid="I4.QL.1.18"><Marker id="I4.QL.1.18" />Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMakers.map((maker, index) => (
                      <TableRow key={maker.id} data-testid={`row-maker-${maker.id}`}>
                        <TableCell className="font-medium" data-testid={index === 0 ? "I4.QL.1.19" : undefined}>
                          {index === 0 && <Marker id="I4.QL.1.19" />}
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-mono text-sm" data-testid={index === 0 ? "I4.QL.1.20" : undefined}>
                          {index === 0 && <Marker id="I4.QL.1.20" />}
                          {maker.makerCode}
                        </TableCell>
                        <TableCell className="font-medium" data-testid={index === 0 ? "I4.QL.1.21" : undefined}>
                          {index === 0 && <Marker id="I4.QL.1.21" />}
                          {maker.makerName}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" data-testid={index === 0 ? "I4.QL.1.22" : undefined}>
                          {index === 0 && <Marker id="I4.QL.1.22" />}
                          {maker.address || "-"}
                        </TableCell>
                        <TableCell data-testid={index === 0 ? "I4.QL.1.23" : undefined}>
                          {index === 0 && <Marker id="I4.QL.1.23" />}
                          {maker.addressId || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(maker)}
                              data-testid={index === 0 ? "I4.QL.1.24" : `button-edit-${maker.id}`}
                            >
                              {index === 0 && <Marker id="I4.QL.1.24" />}
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(maker)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              data-testid={index === 0 ? "I4.QL.1.25" : `button-delete-${maker.id}`}
                            >
                              {index === 0 && <Marker id="I4.QL.1.25" />}
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

      {/* Maker Form Dialog */}
      <MakerForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        maker={selectedMaker}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-maker">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Maker</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{makerToDelete?.makerName}"? This action cannot be undone.
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
