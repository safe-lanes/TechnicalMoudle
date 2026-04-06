import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ArrowLeft, MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useVessels } from "@/hooks/useVessels";

interface Location {
  id: number;
  vesselId: string;
  locationName: string;
  locationType: string | null;
  createdAt: string;
  createdBy: string;
}

export default function LocationManagement({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteLocation, setDeleteLocation] = useState<Location | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("");

  const { data: locationsData, isLoading } = useQuery<{ success: boolean; data: Location[] }>({
    queryKey: ['/technical/api/inventory/locations', selectedVesselId],
    queryFn: () => fetch(`/technical/api/inventory/locations/${encodeURIComponent(selectedVesselId)}`).then(r => r.json()),
    enabled: !!selectedVesselId,
  });

  const locations = locationsData?.data || [];

  const filteredLocations = useMemo(() => {
    if (!searchQuery) return locations;
    const query = searchQuery.toLowerCase();
    return locations.filter(loc =>
      loc.locationName?.toLowerCase().includes(query) ||
      loc.locationType?.toLowerCase().includes(query)
    );
  }, [locations, searchQuery]);

  const addMutation = useMutation({
    mutationFn: async (data: { locationName: string; locationType?: string }) => {
      return apiRequest('POST', `/technical/api/inventory/locations/${encodeURIComponent(selectedVesselId)}`, {
        locationName: data.locationName,
        locationType: data.locationType || null,
        createdBy: 'admin',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/locations', selectedVesselId] });
      setIsAddDialogOpen(false);
      setFormName("");
      setFormType("");
      toast({ title: "Location Added", description: "New location has been created successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add location.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; locationName: string; locationType?: string }) => {
      return apiRequest('PUT', `/technical/api/bulk/locations/${data.id}`, {
        locationName: data.locationName,
        locationType: data.locationType || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/locations', selectedVesselId] });
      setEditingLocation(null);
      setFormName("");
      setFormType("");
      toast({ title: "Location Updated", description: "Location has been updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update location.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/technical/api/bulk/locations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/locations', selectedVesselId] });
      setDeleteLocation(null);
      toast({ title: "Location Deleted", description: "Location has been removed successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete location.", variant: "destructive" });
    },
  });

  const handleOpenAdd = () => {
    setFormName("");
    setFormType("");
    setIsAddDialogOpen(true);
  };

  const handleOpenEdit = (location: Location) => {
    setFormName(location.locationName);
    setFormType(location.locationType || "");
    setEditingLocation(location);
  };

  const handleSaveAdd = () => {
    if (!formName.trim()) {
      toast({ title: "Validation Error", description: "Location Name is required.", variant: "destructive" });
      return;
    }
    addMutation.mutate({ locationName: formName.trim(), locationType: formType.trim() || undefined });
  };

  const handleSaveEdit = () => {
    if (!editingLocation || !formName.trim()) {
      toast({ title: "Validation Error", description: "Location Name is required.", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: editingLocation.id, locationName: formName.trim(), locationType: formType.trim() || undefined });
  };

  const getVesselName = (vesselId: string) => {
    const vessel = vessels.find((v: any) => v.id === vesselId || v.vesselId === vesselId || v.vuid === vesselId);
    return (vessel as any)?.name || (vessel as any)?.vesselName || (vessel as any)?.vessel || vesselId;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-locations">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-emerald-600" />
            <h2 className="text-xl font-bold" data-testid="text-locations-header">Location Management</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
            <SelectTrigger className="w-[240px]" data-testid="select-location-vessel">
              <SelectValue placeholder="Select vessel..." />
            </SelectTrigger>
            <SelectContent>
              {vessels.map((vessel: any) => {
                const id = vessel.id || vessel.vesselId || vessel.vuid;
                const name = vessel.name || vessel.vesselName || vessel.vessel || id;
                return (
                  <SelectItem key={id} value={id} data-testid={`vessel-option-${id}`}>
                    {name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {selectedVesselId && (
            <Button className="bg-[#5dc86f] hover:bg-[#4db85f] text-white" onClick={handleOpenAdd} data-testid="button-add-location">
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          )}
        </div>
      </div>

      {!selectedVesselId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 text-center">Select a vessel to view and manage its locations</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                Locations for {getVesselName(selectedVesselId)}
                <Badge variant="secondary">{filteredLocations.length}</Badge>
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search locations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-locations"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-gray-500">Loading locations...</p>
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <MapPin className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-gray-500">
                  {searchQuery ? "No locations match your search" : "No locations imported yet for this vessel"}
                </p>
                {!searchQuery && (
                  <p className="text-sm text-gray-400 mt-1">
                    Import locations from the Bulk Data Import page or add them manually
                  </p>
                )}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#52baf3]">
                      <th className="text-white font-semibold text-xs whitespace-nowrap px-3 py-2 text-center w-12">#</th>
                      <th className="text-white font-semibold text-xs whitespace-nowrap px-3 py-2 text-left">Location Name</th>
                      <th className="text-white font-semibold text-xs whitespace-nowrap px-3 py-2 text-left">Location Type</th>
                      <th className="text-white font-semibold text-xs whitespace-nowrap px-3 py-2 text-left">Created</th>
                      <th className="text-white font-semibold text-xs whitespace-nowrap px-3 py-2 text-center w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLocations.map((location, index) => (
                      <tr key={location.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"} data-testid={`row-location-${location.id}`}>
                        <td className="text-center text-gray-500 text-sm px-3 py-2">{index + 1}</td>
                        <td className="font-medium px-3 py-2">{location.locationName}</td>
                        <td className="px-3 py-2">
                          {location.locationType ? (
                            <Badge variant="outline">{location.locationType}</Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="text-sm text-gray-500 px-3 py-2">
                          {location.createdAt ? new Date(location.createdAt).toLocaleDateString() : '-'}
                        </td>
                        <td className="text-center px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              className="p-1 rounded hover:bg-gray-200 transition-colors"
                              onClick={() => handleOpenEdit(location)}
                              data-testid={`button-edit-location-${location.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5 text-gray-600" />
                            </button>
                            <button
                              className="p-1 rounded hover:bg-gray-200 transition-colors"
                              onClick={() => setDeleteLocation(location)}
                              data-testid={`button-delete-location-${location.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </button>
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
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-name">Location Name *</Label>
              <Input
                id="add-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Engine Room Store"
                data-testid="input-add-location-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-type">Location Type</Label>
              <Input
                id="add-type"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                placeholder="e.g., STORE, LOCKER, BOX"
                data-testid="input-add-location-type"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="bg-white text-[#0f172a] border-gray-300" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button className="bg-[#5dc86f] hover:bg-[#4db85f] text-white" onClick={handleSaveAdd} disabled={addMutation.isPending} data-testid="button-save-add-location">
              {addMutation.isPending ? "Saving..." : "Add Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingLocation} onOpenChange={(open) => { if (!open) setEditingLocation(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Location Name *</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Engine Room Store"
                data-testid="input-edit-location-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Location Type</Label>
              <Input
                id="edit-type"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                placeholder="e.g., STORE, LOCKER, BOX"
                data-testid="input-edit-location-type"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="bg-white text-[#0f172a] border-gray-300" onClick={() => setEditingLocation(null)}>Cancel</Button>
            <Button className="bg-[#5dc86f] hover:bg-[#4db85f] text-white" onClick={handleSaveEdit} disabled={updateMutation.isPending} data-testid="button-save-edit-location">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteLocation} onOpenChange={(open) => { if (!open) setDeleteLocation(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteLocation?.locationName}"? This action cannot be undone.
              Any spare stock linked to this location may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteLocation && deleteMutation.mutate(deleteLocation.id)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-location"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
