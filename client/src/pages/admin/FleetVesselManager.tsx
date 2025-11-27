import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Ship, Anchor, Building2 } from "lucide-react";
import type { Fleet, Vessel } from "@shared/schema";

interface VesselWithFleet extends Vessel {
  fleetName?: string;
  fleetCode?: string;
}

export default function FleetVesselManager() {
  const { toast } = useToast();
  const [isFleetDialogOpen, setIsFleetDialogOpen] = useState(false);
  const [isVesselDialogOpen, setIsVesselDialogOpen] = useState(false);
  const [editingFleet, setEditingFleet] = useState<Fleet | null>(null);
  const [editingVessel, setEditingVessel] = useState<Vessel | null>(null);
  const [fleetFormData, setFleetFormData] = useState({
    code: "",
    name: "",
    description: "",
  });
  const [vesselFormData, setVesselFormData] = useState({
    id: "",
    name: "",
    code: "",
    fleetId: "",
    imoNumber: "",
    vesselType: "",
    flag: "",
  });

  const { data: fleets = [], isLoading: isFleetsLoading } = useQuery<Fleet[]>({
    queryKey: ["/api/fleets"],
  });

  const { data: vessels = [], isLoading: isVesselsLoading } = useQuery<VesselWithFleet[]>({
    queryKey: ["/api/vessels-with-fleets"],
  });

  const createFleetMutation = useMutation({
    mutationFn: async (data: { code: string; name: string; description?: string }) => {
      return await apiRequest("POST", "/api/fleets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleets"] });
      toast({ title: "Fleet created successfully" });
      setIsFleetDialogOpen(false);
      resetFleetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error creating fleet", description: error.message, variant: "destructive" });
    },
  });

  const updateFleetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Fleet> }) => {
      return await apiRequest("PUT", `/api/fleets/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vessels-with-fleets"] });
      toast({ title: "Fleet updated successfully" });
      setIsFleetDialogOpen(false);
      setEditingFleet(null);
      resetFleetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error updating fleet", description: error.message, variant: "destructive" });
    },
  });

  const deleteFleetMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/fleets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleets"] });
      toast({ title: "Fleet deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error deleting fleet", description: error.message, variant: "destructive" });
    },
  });

  const createVesselMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/vessels", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vessels-with-fleets"] });
      toast({ title: "Vessel created successfully" });
      setIsVesselDialogOpen(false);
      resetVesselForm();
    },
    onError: (error: any) => {
      toast({ title: "Error creating vessel", description: error.message, variant: "destructive" });
    },
  });

  const updateVesselMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PUT", `/api/vessels/${id}/fleet`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vessels-with-fleets"] });
      toast({ title: "Vessel updated successfully" });
      setIsVesselDialogOpen(false);
      setEditingVessel(null);
      resetVesselForm();
    },
    onError: (error: any) => {
      toast({ title: "Error updating vessel", description: error.message, variant: "destructive" });
    },
  });

  const resetFleetForm = () => {
    setFleetFormData({ code: "", name: "", description: "" });
  };

  const resetVesselForm = () => {
    setVesselFormData({ id: "", name: "", code: "", fleetId: "", imoNumber: "", vesselType: "", flag: "" });
  };

  const handleCreateFleet = () => {
    setEditingFleet(null);
    resetFleetForm();
    setIsFleetDialogOpen(true);
  };

  const handleEditFleet = (fleet: Fleet) => {
    setEditingFleet(fleet);
    setFleetFormData({
      code: fleet.code,
      name: fleet.name,
      description: fleet.description || "",
    });
    setIsFleetDialogOpen(true);
  };

  const handleDeleteFleet = (fleet: Fleet) => {
    if (window.confirm(`Are you sure you want to delete fleet "${fleet.name}"?`)) {
      deleteFleetMutation.mutate(fleet.id);
    }
  };

  const handleFleetSubmit = () => {
    if (editingFleet) {
      updateFleetMutation.mutate({ id: editingFleet.id, data: fleetFormData });
    } else {
      createFleetMutation.mutate(fleetFormData);
    }
  };

  const handleCreateVessel = (fleetId?: string) => {
    setEditingVessel(null);
    resetVesselForm();
    if (fleetId) {
      setVesselFormData(prev => ({ ...prev, fleetId }));
    }
    setIsVesselDialogOpen(true);
  };

  const handleEditVessel = (vessel: Vessel) => {
    setEditingVessel(vessel);
    setVesselFormData({
      id: vessel.id,
      name: vessel.name,
      code: vessel.code,
      fleetId: vessel.fleetId || "",
      imoNumber: vessel.imoNumber || "",
      vesselType: vessel.vesselType || "",
      flag: vessel.flag || "",
    });
    setIsVesselDialogOpen(true);
  };

  const handleVesselSubmit = () => {
    if (editingVessel) {
      updateVesselMutation.mutate({ 
        id: editingVessel.id, 
        data: { fleetId: vesselFormData.fleetId || null } 
      });
    } else {
      createVesselMutation.mutate({
        id: vesselFormData.id,
        name: vesselFormData.name,
        code: vesselFormData.code || vesselFormData.id,
        fleetId: vesselFormData.fleetId || null,
        imoNumber: vesselFormData.imoNumber || null,
        vesselType: vesselFormData.vesselType || null,
        flag: vesselFormData.flag || null,
      });
    }
  };

  const getVesselsForFleet = (fleetId: string) => {
    return vessels.filter(v => v.fleetId === fleetId);
  };

  const getUnassignedVessels = () => {
    return vessels.filter(v => !v.fleetId);
  };

  if (isFleetsLoading || isVesselsLoading) {
    return (
      <div className="p-6">
        <div className="h-10 w-48 bg-gray-200 animate-pulse rounded mb-4" />
        <div className="h-64 bg-gray-200 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Fleet & Vessel Manager</h2>
          <p className="text-gray-600 mt-1">Organize your vessels into fleets for easier management</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleCreateVessel()}
            variant="outline"
            data-testid="button-create-vessel"
          >
            <Ship className="h-4 w-4 mr-2" />
            Add Vessel
          </Button>
          <Button
            onClick={handleCreateFleet}
            data-testid="button-create-fleet"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Fleet
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Anchor className="h-5 w-5 text-rose-600" />
                Fleets ({fleets.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fleets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Anchor className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No fleets created yet</p>
                  <p className="text-sm">Create a fleet to organize your vessels</p>
                </div>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {fleets.map((fleet) => {
                    const fleetVessels = getVesselsForFleet(fleet.id);
                    return (
                      <AccordionItem key={fleet.id} value={fleet.id}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-3">
                              <Building2 className="h-4 w-4 text-rose-600" />
                              <div className="text-left">
                                <div className="font-medium">{fleet.name}</div>
                                <div className="text-sm text-gray-500">Code: {fleet.code}</div>
                              </div>
                            </div>
                            <Badge variant="secondary" className="mr-2">
                              {fleetVessels.length} vessel{fleetVessels.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pt-2 space-y-3">
                            {fleet.description && (
                              <p className="text-sm text-gray-600 px-4">{fleet.description}</p>
                            )}
                            <div className="flex gap-2 px-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditFleet(fleet)}
                                data-testid={`button-edit-fleet-${fleet.id}`}
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                Edit Fleet
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCreateVessel(fleet.id)}
                                data-testid={`button-add-vessel-to-fleet-${fleet.id}`}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Vessel
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteFleet(fleet)}
                                className="text-red-600 hover:text-red-700"
                                data-testid={`button-delete-fleet-${fleet.id}`}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                            {fleetVessels.length > 0 ? (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Vessel Code</TableHead>
                                    <TableHead>Vessel Name</TableHead>
                                    <TableHead>IMO Number</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="w-24">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {fleetVessels.map((vessel) => (
                                    <TableRow key={vessel.id}>
                                      <TableCell className="font-mono">{vessel.code}</TableCell>
                                      <TableCell>{vessel.name}</TableCell>
                                      <TableCell>{vessel.imoNumber || "-"}</TableCell>
                                      <TableCell>{vessel.vesselType || "-"}</TableCell>
                                      <TableCell>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditVessel(vessel)}
                                          data-testid={`button-edit-vessel-${vessel.id}`}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <div className="text-center py-4 text-gray-500 text-sm">
                                No vessels assigned to this fleet
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ship className="h-5 w-5 text-blue-600" />
                Unassigned Vessels ({getUnassignedVessels().length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getUnassignedVessels().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Ship className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">All vessels are assigned to fleets</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {getUnassignedVessels().map((vessel) => (
                    <div
                      key={vessel.id}
                      className="p-3 border rounded-lg flex items-center justify-between hover:bg-gray-50"
                    >
                      <div>
                        <div className="font-medium">{vessel.name}</div>
                        <div className="text-sm text-gray-500">Code: {vessel.code}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditVessel(vessel)}
                        data-testid={`button-assign-vessel-${vessel.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isFleetDialogOpen} onOpenChange={setIsFleetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFleet ? "Edit Fleet" : "Create New Fleet"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fleetCode">Fleet Code</Label>
              <Input
                id="fleetCode"
                value={fleetFormData.code}
                onChange={(e) => setFleetFormData(prev => ({ ...prev, code: e.target.value }))}
                placeholder="e.g., FLT001"
                data-testid="input-fleet-code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fleetName">Fleet Name</Label>
              <Input
                id="fleetName"
                value={fleetFormData.name}
                onChange={(e) => setFleetFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Pacific Fleet"
                data-testid="input-fleet-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fleetDescription">Description (Optional)</Label>
              <Textarea
                id="fleetDescription"
                value={fleetFormData.description}
                onChange={(e) => setFleetFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter fleet description..."
                data-testid="input-fleet-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFleetDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleFleetSubmit}
              disabled={!fleetFormData.code || !fleetFormData.name}
              data-testid="button-submit-fleet"
            >
              {editingFleet ? "Update Fleet" : "Create Fleet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isVesselDialogOpen} onOpenChange={setIsVesselDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVessel ? "Edit Vessel Fleet Assignment" : "Create New Vessel"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!editingVessel && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="vesselId">Vessel ID</Label>
                  <Input
                    id="vesselId"
                    value={vesselFormData.id}
                    onChange={(e) => setVesselFormData(prev => ({ ...prev, id: e.target.value }))}
                    placeholder="e.g., V001"
                    data-testid="input-vessel-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vesselName">Vessel Name</Label>
                  <Input
                    id="vesselName"
                    value={vesselFormData.name}
                    onChange={(e) => setVesselFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., MV Pacific Star"
                    data-testid="input-vessel-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vesselImo">IMO Number</Label>
                    <Input
                      id="vesselImo"
                      value={vesselFormData.imoNumber}
                      onChange={(e) => setVesselFormData(prev => ({ ...prev, imoNumber: e.target.value }))}
                      placeholder="IMO1234567"
                      data-testid="input-vessel-imo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vesselType">Vessel Type</Label>
                    <Input
                      id="vesselType"
                      value={vesselFormData.vesselType}
                      onChange={(e) => setVesselFormData(prev => ({ ...prev, vesselType: e.target.value }))}
                      placeholder="e.g., Tanker"
                      data-testid="input-vessel-type"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vesselFlag">Flag</Label>
                  <Input
                    id="vesselFlag"
                    value={vesselFormData.flag}
                    onChange={(e) => setVesselFormData(prev => ({ ...prev, flag: e.target.value }))}
                    placeholder="e.g., Panama"
                    data-testid="input-vessel-flag"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="vesselFleet">Assign to Fleet</Label>
              <Select
                value={vesselFormData.fleetId}
                onValueChange={(value) => setVesselFormData(prev => ({ ...prev, fleetId: value === "none" ? "" : value }))}
              >
                <SelectTrigger data-testid="select-vessel-fleet">
                  <SelectValue placeholder="Select a fleet (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Fleet (Unassigned)</SelectItem>
                  {fleets.map((fleet) => (
                    <SelectItem key={fleet.id} value={fleet.id}>
                      {fleet.name} ({fleet.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVesselDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleVesselSubmit}
              disabled={!editingVessel && (!vesselFormData.id || !vesselFormData.name)}
              data-testid="button-submit-vessel"
            >
              {editingVessel ? "Update Assignment" : "Create Vessel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
