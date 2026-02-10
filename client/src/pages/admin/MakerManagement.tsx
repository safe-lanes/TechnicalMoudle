import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type MakerList } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Download, ArrowLeft, Building2, Package } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MakerForm from "./MakerForm";
import { Marker } from "@/components/Marker";

export default function MakerManagement({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedMaker, setSelectedMaker] = useState<MakerList | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [makerToDelete, setMakerToDelete] = useState<MakerList | null>(null);

  const { data: makers, isLoading, error } = useQuery<MakerList[]>({
    queryKey: ['/technical/api/fleet/makers'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/technical/api/fleet/makers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/makers'], exact: false });
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

  const handleEdit = (maker: MakerList) => {
    setSelectedMaker(maker);
    setIsFormOpen(true);
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

  const handleExport = async () => {
    try {
      const response = await fetch('/technical/api/fleet/makers/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `maker-list-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Success",
        description: "Maker list exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export maker list",
        variant: "destructive",
      });
    }
  };

  const totalMakers = makers?.length || 0;

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
                      <TableRow key={maker.id} data-testid={`row-maker-${maker.id}`}>
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
                              onClick={() => handleEdit(maker)}
                              data-testid={isFirstRow ? "I4.QL.1.24" : `button-edit-${maker.id}`}
                            >
                              {isFirstRow && <Marker id="I4.QL.1.24" />}
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(maker)}
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

      <MakerForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        maker={selectedMaker}
      />

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
