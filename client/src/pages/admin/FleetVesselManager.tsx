import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Plus, Pencil, Trash2, Ship, Anchor, Building2, ArrowLeft } from "lucide-react";
import type { Fleet, Vessel } from "@shared/schema";

interface VesselWithFleet extends Vessel {
  fleetName?: string;
  fleetCode?: string;
}

const fleetFormSchema = z.object({
  code: z.string().min(1, "Fleet code is required").max(20, "Fleet code must be 20 characters or less"),
  name: z.string().min(1, "Fleet name is required").max(100, "Fleet name must be 100 characters or less"),
  description: z.string().optional(),
});

type FleetFormData = z.infer<typeof fleetFormSchema>;

const vesselFormSchema = z.object({
  id: z.string().min(1, "Vessel ID is required"),
  name: z.string().min(1, "Vessel name is required"),
  code: z.string().optional(),
  fleetId: z.string().optional(),
  imoNumber: z.string().optional(),
  vesselType: z.string().optional(),
  flag: z.string().optional(),
});

type VesselFormData = z.infer<typeof vesselFormSchema>;

const vesselAssignmentSchema = z.object({
  fleetId: z.string().optional(),
});

type VesselAssignmentData = z.infer<typeof vesselAssignmentSchema>;

export default function FleetVesselManager({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const [isFleetDialogOpen, setIsFleetDialogOpen] = useState(false);
  const [isVesselDialogOpen, setIsVesselDialogOpen] = useState(false);
  const [editingFleet, setEditingFleet] = useState<Fleet | null>(null);
  const [editingVessel, setEditingVessel] = useState<Vessel | null>(null);

  const fleetForm = useForm<FleetFormData>({
    resolver: zodResolver(fleetFormSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
    },
  });

  const vesselForm = useForm<VesselFormData>({
    resolver: zodResolver(vesselFormSchema),
    defaultValues: {
      id: "",
      name: "",
      code: "",
      fleetId: "",
      imoNumber: "",
      vesselType: "",
      flag: "",
    },
  });

  const vesselAssignmentForm = useForm<VesselAssignmentData>({
    resolver: zodResolver(vesselAssignmentSchema),
    defaultValues: {
      fleetId: "",
    },
  });

  const { data: fleets = [], isLoading: isFleetsLoading } = useQuery<Fleet[]>({
    queryKey: ["/technical/api/fleets"],
  });

  const { data: vessels = [], isLoading: isVesselsLoading } = useQuery<VesselWithFleet[]>({
    queryKey: ["/technical/api/vessels-with-fleets"],
  });

  const createFleetMutation = useMutation({
    mutationFn: async (data: FleetFormData) => {
      return await apiRequest("POST", "/technical/api/fleets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleets"] });
      toast({ title: "Fleet created successfully" });
      setIsFleetDialogOpen(false);
      fleetForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error creating fleet", description: error.message, variant: "destructive" });
    },
  });

  const updateFleetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FleetFormData }) => {
      return await apiRequest("PUT", `/technical/api/fleets/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleets"] });
      queryClient.invalidateQueries({ queryKey: ["/technical/api/vessels-with-fleets"] });
      toast({ title: "Fleet updated successfully" });
      setIsFleetDialogOpen(false);
      setEditingFleet(null);
      fleetForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error updating fleet", description: error.message, variant: "destructive" });
    },
  });

  const deleteFleetMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/technical/api/fleets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleets"] });
      toast({ title: "Fleet deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error deleting fleet", description: error.message, variant: "destructive" });
    },
  });

  const createVesselMutation = useMutation({
    mutationFn: async (data: VesselFormData) => {
      return await apiRequest("POST", "/technical/api/vessels", {
        ...data,
        code: data.code || data.id,
        fleetId: data.fleetId || null,
        imoNumber: data.imoNumber || null,
        vesselType: data.vesselType || null,
        flag: data.flag || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/vessels"] });
      queryClient.invalidateQueries({ queryKey: ["/technical/api/vessels-with-fleets"] });
      toast({ title: "Vessel created successfully" });
      setIsVesselDialogOpen(false);
      vesselForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error creating vessel", description: error.message, variant: "destructive" });
    },
  });

  const updateVesselFleetMutation = useMutation({
    mutationFn: async ({ id, fleetId }: { id: string; fleetId: string | null }) => {
      return await apiRequest("PUT", `/technical/api/vessels/${id}/fleet`, { fleetId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/vessels"] });
      queryClient.invalidateQueries({ queryKey: ["/technical/api/vessels-with-fleets"] });
      toast({ title: "Vessel assignment updated successfully" });
      setIsVesselDialogOpen(false);
      setEditingVessel(null);
      vesselAssignmentForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error updating vessel", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateFleet = () => {
    setEditingFleet(null);
    fleetForm.reset({ code: "", name: "", description: "" });
    setIsFleetDialogOpen(true);
  };

  const handleEditFleet = (fleet: Fleet) => {
    setEditingFleet(fleet);
    fleetForm.reset({
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

  const handleFleetSubmit = (data: FleetFormData) => {
    if (editingFleet) {
      updateFleetMutation.mutate({ id: editingFleet.id, data });
    } else {
      createFleetMutation.mutate(data);
    }
  };

  const handleCreateVessel = (fleetId?: string) => {
    setEditingVessel(null);
    vesselForm.reset({ id: "", name: "", code: "", fleetId: fleetId || "", imoNumber: "", vesselType: "", flag: "" });
    setIsVesselDialogOpen(true);
  };

  const handleEditVessel = (vessel: Vessel) => {
    setEditingVessel(vessel);
    vesselAssignmentForm.reset({
      fleetId: vessel.fleetId || "",
    });
    setIsVesselDialogOpen(true);
  };

  const handleVesselSubmit = (data: VesselFormData) => {
    createVesselMutation.mutate(data);
  };

  const handleVesselAssignmentSubmit = (data: VesselAssignmentData) => {
    if (editingVessel) {
      updateVesselFleetMutation.mutate({
        id: editingVessel.id,
        fleetId: data.fleetId || null,
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
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-5 rounded-lg">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-cyan-100 hover:text-white text-sm mb-2 transition-colors"
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
        )}
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-white/20 rounded-lg">
            <Ship className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Fleet & Vessel Manager</h1>
            <p className="text-cyan-100 text-sm mt-0.5">Manage fleets and vessel assignments</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end">
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
          <Form {...fleetForm}>
            <form onSubmit={fleetForm.handleSubmit(handleFleetSubmit)} className="space-y-4 py-4">
              <FormField
                control={fleetForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fleet Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., FLT001"
                        data-testid="input-fleet-code"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={fleetForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fleet Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Pacific Fleet"
                        data-testid="input-fleet-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={fleetForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter fleet description..."
                        data-testid="input-fleet-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsFleetDialogOpen(false)} data-testid="button-cancel-fleet">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createFleetMutation.isPending || updateFleetMutation.isPending}
                  data-testid="button-submit-fleet"
                >
                  {createFleetMutation.isPending || updateFleetMutation.isPending ? "Saving..." : (editingFleet ? "Update Fleet" : "Create Fleet")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isVesselDialogOpen} onOpenChange={setIsVesselDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVessel ? "Edit Vessel Fleet Assignment" : "Create New Vessel"}
            </DialogTitle>
          </DialogHeader>
          {editingVessel ? (
            <Form {...vesselAssignmentForm}>
              <form onSubmit={vesselAssignmentForm.handleSubmit(handleVesselAssignmentSubmit)} className="space-y-4 py-4">
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <p className="font-medium">{editingVessel.name}</p>
                  <p className="text-sm text-gray-500">Code: {editingVessel.code}</p>
                </div>
                <FormField
                  control={vesselAssignmentForm.control}
                  name="fleetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to Fleet</FormLabel>
                      <Select
                        value={field.value || "none"}
                        onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-vessel-fleet">
                            <SelectValue placeholder="Select a fleet (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Fleet (Unassigned)</SelectItem>
                          {fleets.map((fleet) => (
                            <SelectItem key={fleet.id} value={fleet.id}>
                              {fleet.name} ({fleet.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsVesselDialogOpen(false)} data-testid="button-cancel-vessel-assignment">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateVesselFleetMutation.isPending}
                    data-testid="button-submit-vessel-assignment"
                  >
                    {updateVesselFleetMutation.isPending ? "Saving..." : "Update Assignment"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          ) : (
            <Form {...vesselForm}>
              <form onSubmit={vesselForm.handleSubmit(handleVesselSubmit)} className="space-y-4 py-4">
                <FormField
                  control={vesselForm.control}
                  name="id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vessel ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., V001"
                          data-testid="input-vessel-id"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={vesselForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vessel Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., MV Pacific Star"
                          data-testid="input-vessel-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={vesselForm.control}
                    name="imoNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IMO Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="IMO1234567"
                            data-testid="input-vessel-imo"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={vesselForm.control}
                    name="vesselType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vessel Type</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Tanker"
                            data-testid="input-vessel-type"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={vesselForm.control}
                  name="flag"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Flag</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Panama"
                          data-testid="input-vessel-flag"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={vesselForm.control}
                  name="fleetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to Fleet</FormLabel>
                      <Select
                        value={field.value || "none"}
                        onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-vessel-fleet">
                            <SelectValue placeholder="Select a fleet (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Fleet (Unassigned)</SelectItem>
                          {fleets.map((fleet) => (
                            <SelectItem key={fleet.id} value={fleet.id}>
                              {fleet.name} ({fleet.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsVesselDialogOpen(false)} data-testid="button-cancel-vessel">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createVesselMutation.isPending}
                    data-testid="button-submit-vessel"
                  >
                    {createVesselMutation.isPending ? "Creating..." : "Create Vessel"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
