import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type MakerList } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Download, ArrowLeft, Building2 } from "lucide-react";
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

  // Fetch makers
  const { data: makers, isLoading, error } = useQuery<MakerList[]>({
    queryKey: ['/technical/api/fleet/makers'],
  });

  // Delete mutation
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex flex-col">
      <div className="flex-1 flex flex-col">
        <Card className="flex-1 flex flex-col overflow-hidden">
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
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle data-testid="I4.QL.1.10"><Marker id="I4.QL.1.10" />All Makers</CardTitle>
              <div className="flex flex-col sm:flex-row gap-3">
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
                <Button
                  variant="outline"
                  onClick={handleExport}
                  className="whitespace-nowrap"
                  data-testid="button-export-makers"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
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

          <CardContent className="flex-1 overflow-auto">
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
              <div className="overflow-x-auto border border-gray-300">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#52BAF3]">
                      <th className="border border-gray-300 px-3 py-2 text-left text-white font-medium whitespace-nowrap" data-testid="I4.QL.1.13"><Marker id="I4.QL.1.13" />S.No</th>
                      <th className="border border-gray-300 px-3 py-2 text-left text-white font-medium whitespace-nowrap" data-testid="I4.QL.1.14"><Marker id="I4.QL.1.14" />Maker Code</th>
                      <th className="border border-gray-300 px-3 py-2 text-left text-white font-medium whitespace-nowrap" data-testid="I4.QL.1.15"><Marker id="I4.QL.1.15" />Maker Name</th>
                      <th className="border border-gray-300 px-3 py-2 text-left text-white font-medium whitespace-nowrap" data-testid="I4.QL.1.16"><Marker id="I4.QL.1.16" />Address</th>
                      <th className="border border-gray-300 px-3 py-2 text-left text-white font-medium whitespace-nowrap" data-testid="I4.QL.1.17"><Marker id="I4.QL.1.17" />Address ID</th>
                      <th className="border border-gray-300 px-3 py-2 text-left text-white font-medium whitespace-nowrap">Status</th>
                      <th className="border border-gray-300 px-3 py-2 text-right text-white font-medium whitespace-nowrap" data-testid="I4.QL.1.18"><Marker id="I4.QL.1.18" />Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMakers.map((maker, index) => (
                      <tr key={maker.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} data-testid={`row-maker-${maker.id}`}>
                        <td className="border border-gray-300 px-3 py-2 font-medium" data-testid={index === 0 ? "I4.QL.1.19" : undefined}>
                          {index === 0 && <Marker id="I4.QL.1.19" />}
                          {index + 1}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 font-mono text-sm" data-testid={index === 0 ? "I4.QL.1.20" : undefined}>
                          {index === 0 && <Marker id="I4.QL.1.20" />}
                          {maker.makerCode}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 font-medium" data-testid={index === 0 ? "I4.QL.1.21" : undefined}>
                          {index === 0 && <Marker id="I4.QL.1.21" />}
                          {maker.makerName}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 max-w-xs truncate" data-testid={index === 0 ? "I4.QL.1.22" : undefined}>
                          {index === 0 && <Marker id="I4.QL.1.22" />}
                          {maker.address || "-"}
                        </td>
                        <td className="border border-gray-300 px-3 py-2" data-testid={index === 0 ? "I4.QL.1.23" : undefined}>
                          {index === 0 && <Marker id="I4.QL.1.23" />}
                          {maker.addressId || "-"}
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            maker.isActive !== false
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {maker.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right">
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
                              className="text-red-600"
                              data-testid={index === 0 ? "I4.QL.1.25" : `button-delete-${maker.id}`}
                            >
                              {index === 0 && <Marker id="I4.QL.1.25" />}
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
