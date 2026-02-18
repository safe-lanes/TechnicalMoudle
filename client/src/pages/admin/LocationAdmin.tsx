import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  Download,
  Search,
  MapPin,
  Loader2,
} from "lucide-react";

interface Location {
  id: number;
  vesselId: string;
  locationName: string;
  locationType: string | null;
  createdAt: string;
  createdBy: string;
}

const LOCATION_TYPES = ["STORE", "LOCKER", "BOX", "TANK", "OTHER"];

export default function LocationAdmin() {
  const { toast } = useToast();
  const { data: vessels = [], isLoading: isLoadingVessels } = useVessels();

  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<Location | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const locationsQuery = useQuery<Location[]>({
    queryKey: ["/technical/api/inventory/locations", selectedVesselId],
    queryFn: async () => {
      const res = await fetch(`/technical/api/inventory/locations/${selectedVesselId}`);
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!selectedVesselId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { locationName: string; locationType: string; createdBy: string }) => {
      const res = await apiRequest("POST", `/technical/api/inventory/locations/${selectedVesselId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/inventory/locations", selectedVesselId] });
      toast({ title: "Location created successfully" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed to create location", description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; locationName: string; locationType: string }) => {
      const res = await apiRequest("PUT", `/technical/api/inventory/locations/${selectedVesselId}/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/inventory/locations", selectedVesselId] });
      toast({ title: "Location updated successfully" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed to update location", description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/technical/api/inventory/locations/${selectedVesselId}/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/inventory/locations", selectedVesselId] });
      toast({ title: "Location deleted successfully" });
      setIsDeleteOpen(false);
      setDeletingLocation(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed to delete location", description: error.message });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/technical/api/bulk/import-locations/${selectedVesselId}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/inventory/locations", selectedVesselId] });
      const d = result.data || result;
      toast({
        title: "Import completed",
        description: `Created: ${d.created || 0}, Skipped: ${d.skipped || 0}, Errors: ${d.errors || 0} (Total: ${d.total || 0})`,
      });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Import failed", description: error.message });
    },
  });

  const filteredLocations = useMemo(() => {
    const locations = locationsQuery.data || [];
    if (!searchTerm) return locations;
    const lower = searchTerm.toLowerCase();
    return locations.filter(
      (loc) =>
        loc.locationName?.toLowerCase().includes(lower) ||
        loc.locationType?.toLowerCase().includes(lower)
    );
  }, [locationsQuery.data, searchTerm]);

  function closeDialog() {
    setIsAddEditOpen(false);
    setEditingLocation(null);
    setFormName("");
    setFormType("");
  }

  function openAddDialog() {
    setEditingLocation(null);
    setFormName("");
    setFormType("");
    setIsAddEditOpen(true);
  }

  function openEditDialog(location: Location) {
    setEditingLocation(location);
    setFormName(location.locationName);
    setFormType(location.locationType || "");
    setIsAddEditOpen(true);
  }

  function handleSubmit() {
    if (!formName.trim()) {
      toast({ variant: "destructive", title: "Location name is required" });
      return;
    }
    if (editingLocation) {
      updateMutation.mutate({
        id: editingLocation.id,
        locationName: formName.trim(),
        locationType: formType || "",
      });
    } else {
      createMutation.mutate({
        locationName: formName.trim(),
        locationType: formType || "",
        createdBy: "Admin",
      });
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      importMutation.mutate(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleDownloadTemplate() {
    window.open("/technical/api/bulk/template?type=locations", "_blank");
  }

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Location Administration
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            data-testid="btn-download-template"
          >
            <Download className="mr-2 h-4 w-4" />
            Template
          </Button>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={!selectedVesselId || importMutation.isPending}
            data-testid="btn-bulk-import"
          >
            {importMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Bulk Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileUpload}
            data-testid="input-file-upload"
          />
          <Button
            onClick={openAddDialog}
            disabled={!selectedVesselId}
            data-testid="btn-add-location"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Location
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-64">
          <Select
            value={selectedVesselId}
            onValueChange={(val) => {
              setSelectedVesselId(val);
              setSearchTerm("");
            }}
          >
            <SelectTrigger data-testid="select-vessel">
              <SelectValue placeholder={isLoadingVessels ? "Loading vessels..." : "Select a vessel"} />
            </SelectTrigger>
            <SelectContent>
              {vessels.map((v) => (
                <SelectItem key={v.id} value={v.id} data-testid={`option-vessel-${v.id}`}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-locations"
          />
        </div>
        {selectedVesselId && locationsQuery.data && (
          <Badge variant="secondary" data-testid="badge-location-count">
            {filteredLocations.length} location{filteredLocations.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {!selectedVesselId ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MapPin className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">Select a vessel to manage locations</p>
              <p className="text-sm">Choose a vessel from the dropdown above to view and manage its locations.</p>
            </div>
          ) : locationsQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MapPin className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">
                {searchTerm ? "No locations match your search" : "No locations found"}
              </p>
              <p className="text-sm">
                {searchTerm
                  ? "Try adjusting your search term."
                  : "Add a location or use bulk import to get started."}
              </p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-320px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location Name</TableHead>
                    <TableHead>Location Type</TableHead>
                    <TableHead>Created Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocations.map((location) => (
                    <TableRow key={location.id} data-testid={`row-location-${location.id}`}>
                      <TableCell className="font-medium" data-testid={`text-location-name-${location.id}`}>
                        {location.locationName}
                      </TableCell>
                      <TableCell data-testid={`text-location-type-${location.id}`}>
                        {location.locationType ? (
                          <Badge variant="outline">{location.locationType}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-location-date-${location.id}`}>
                        {location.createdAt
                          ? new Date(location.createdAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditDialog(location)}
                            data-testid={`btn-edit-location-${location.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setDeletingLocation(location);
                              setIsDeleteOpen(true);
                            }}
                            data-testid={`btn-delete-location-${location.id}`}
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
        </CardContent>
      </Card>

      <Dialog open={isAddEditOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingLocation ? "Edit Location" : "Add Location"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Location Name *</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Enter location name"
                data-testid="input-location-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Location Type</label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger data-testid="select-location-type">
                  <SelectValue placeholder="Select type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type} data-testid={`option-type-${type}`}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="btn-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isMutating}
              data-testid="btn-save-location"
            >
              {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingLocation ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={(open) => { if (!open) { setIsDeleteOpen(false); setDeletingLocation(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-delete-dialog-title">Delete Location</DialogTitle>
          </DialogHeader>
          <p className="py-4" data-testid="text-delete-confirmation">
            Are you sure you want to delete <strong>{deletingLocation?.locationName}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setIsDeleteOpen(false); setDeletingLocation(null); }}
              data-testid="btn-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingLocation && deleteMutation.mutate(deletingLocation.id)}
              disabled={deleteMutation.isPending}
              data-testid="btn-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
