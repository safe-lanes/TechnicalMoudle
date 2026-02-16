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
import { Plus, Pencil, Trash2, Ship, Anchor, Building2, ArrowLeft, Copy, CheckCircle2, AlertTriangle, ChevronsUpDown, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
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
  const [isCopyVesselDialogOpen, setIsCopyVesselDialogOpen] = useState(false);
  const [editingFleet, setEditingFleet] = useState<Fleet | null>(null);
  const [editingVessel, setEditingVessel] = useState<Vessel | null>(null);
  const [copySourceVessel, setCopySourceVessel] = useState("");
  const [copyTargetVessel, setCopyTargetVessel] = useState("");
  const [sourcePopoverOpen, setSourcePopoverOpen] = useState(false);
  const [targetPopoverOpen, setTargetPopoverOpen] = useState(false);
  const [copyModules, setCopyModules] = useState({ components: true, jobs: true, spares: true });
  const [copyStep, setCopyStep] = useState<"select" | "confirm" | "result">("select");
  const [copyResult, setCopyResult] = useState<{ components: number; jobs: number; spares: number } | null>(null);

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

  const copyVesselMutation = useMutation({
    mutationFn: async (data: {
      sourceVesselCode: string;
      targetVesselCode: string;
      targetVesselName?: string;
      copyComponents: boolean;
      copyJobs: boolean;
      copySpares: boolean;
    }) => {
      return await apiRequest("POST", "/technical/api/fleet-admin/copy-vessel", data);
    },
    onSuccess: async (response: any) => {
      const result = await response.json();
      setCopyResult(result.results);
      setCopyStep("result");
      queryClient.invalidateQueries({ queryKey: ["/technical/api/fleet-admin"] });
      queryClient.invalidateQueries({ queryKey: ["/technical/api/vessels-with-fleets"] });
      toast({ title: "Vessel data successfully replicated" });
    },
    onError: (error: any) => {
      toast({ title: "Error copying vessel data", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenCopyDialog = () => {
    setCopySourceVessel("");
    setCopyTargetVessel("");
    setCopyModules({ components: true, jobs: true, spares: true });
    setCopyStep("select");
    setCopyResult(null);
    setIsCopyVesselDialogOpen(true);
  };

  const handleConfirmCopy = () => {
    const targetVessel = allVessels.find((v) => (v.code || v.id) === copyTargetVessel);
    copyVesselMutation.mutate({
      sourceVesselCode: copySourceVessel,
      targetVesselCode: copyTargetVessel,
      targetVesselName: targetVessel?.name,
      copyComponents: copyModules.components,
      copyJobs: copyModules.jobs,
      copySpares: copyModules.spares,
    });
  };

  const allVessels = vessels;
  const sourceVesselName = allVessels.find((v) => (v.code || v.id) === copySourceVessel)?.name || "";
  const targetVesselName = allVessels.find((v) => (v.code || v.id) === copyTargetVessel)?.name || "";
  const canProceedToConfirm = copySourceVessel && copyTargetVessel && copySourceVessel !== copyTargetVessel && (copyModules.components || copyModules.jobs || copyModules.spares);

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
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 rounded-lg">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Ship className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Fleet & Vessel Manager</h1>
              <p className="text-cyan-100 text-sm mt-0.5">Manage fleets and vessel assignments</p>
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
      <div className="flex items-center justify-end">
        <div className="flex gap-2">
          <Button
            onClick={handleOpenCopyDialog}
            variant="outline"
            data-testid="button-copy-vessel"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Vessel
          </Button>
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

      <Dialog open={isCopyVesselDialogOpen} onOpenChange={(open) => { if (!open) { setIsCopyVesselDialogOpen(false); } }}>
        <DialogContent className="p-0 gap-0" style={{ width: "480px", maxWidth: "90vw" }}>
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-3 rounded-t-lg">
            <div className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-white" />
              <h3 className="text-white font-semibold text-sm">Copy Vessel Configuration</h3>
            </div>
            <p className="text-cyan-100 text-xs mt-0.5">Replicate mapping data from one vessel to another</p>
          </div>

          <div className="p-5 space-y-5">
            {copyStep === "select" && (
              <>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">Source Vessel</Label>
                    <Popover open={sourcePopoverOpen} onOpenChange={setSourcePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={sourcePopoverOpen}
                          className="w-full justify-between font-normal"
                          data-testid="select-copy-source-vessel"
                        >
                          {copySourceVessel
                            ? (() => { const v = allVessels.find((v) => (v.code || v.id) === copySourceVessel); return v ? `${v.name}${v.code ? ` (${v.code})` : ""}` : copySourceVessel; })()
                            : "Search source vessel..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Type vessel name or code..." data-testid="input-search-source-vessel" />
                          <CommandList>
                            <CommandEmpty>No vessel found.</CommandEmpty>
                            <CommandGroup>
                              {allVessels.map((v) => (
                                <CommandItem
                                  key={v.id}
                                  value={`${v.name} ${v.code || v.id}`}
                                  onSelect={() => {
                                    const val = v.code || v.id;
                                    setCopySourceVessel(val);
                                    if (val === copyTargetVessel) setCopyTargetVessel("");
                                    setSourcePopoverOpen(false);
                                  }}
                                  data-testid={`option-source-vessel-${v.id}`}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", copySourceVessel === (v.code || v.id) ? "opacity-100" : "opacity-0")} />
                                  {v.name} {v.code ? `(${v.code})` : ""}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">Target Vessel</Label>
                    <Popover open={targetPopoverOpen} onOpenChange={setTargetPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={targetPopoverOpen}
                          className="w-full justify-between font-normal"
                          data-testid="select-copy-target-vessel"
                        >
                          {copyTargetVessel
                            ? (() => { const v = allVessels.find((v) => (v.code || v.id) === copyTargetVessel); return v ? `${v.name}${v.code ? ` (${v.code})` : ""}` : copyTargetVessel; })()
                            : "Search target vessel..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Type vessel name or code..." data-testid="input-search-target-vessel" />
                          <CommandList>
                            <CommandEmpty>No vessel found.</CommandEmpty>
                            <CommandGroup>
                              {allVessels.filter((v) => (v.code || v.id) !== copySourceVessel).map((v) => (
                                <CommandItem
                                  key={v.id}
                                  value={`${v.name} ${v.code || v.id}`}
                                  onSelect={() => {
                                    setCopyTargetVessel(v.code || v.id);
                                    setTargetPopoverOpen(false);
                                  }}
                                  data-testid={`option-target-vessel-${v.id}`}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", copyTargetVessel === (v.code || v.id) ? "opacity-100" : "opacity-0")} />
                                  {v.name} {v.code ? `(${v.code})` : ""}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {copySourceVessel && copyTargetVessel && copySourceVessel === copyTargetVessel && (
                      <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Source and target cannot be the same</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600">Data Scope</Label>
                  <div className="space-y-2 pl-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="copy-components"
                        checked={copyModules.components}
                        onCheckedChange={(c) => setCopyModules((p) => ({ ...p, components: !!c }))}
                        data-testid="checkbox-copy-components"
                      />
                      <Label htmlFor="copy-components" className="text-sm cursor-pointer">Components Mapping</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="copy-jobs"
                        checked={copyModules.jobs}
                        onCheckedChange={(c) => setCopyModules((p) => ({ ...p, jobs: !!c }))}
                        data-testid="checkbox-copy-jobs"
                      />
                      <Label htmlFor="copy-jobs" className="text-sm cursor-pointer">Jobs Mapping</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="copy-spares"
                        checked={copyModules.spares}
                        onCheckedChange={(c) => setCopyModules((p) => ({ ...p, spares: !!c }))}
                        data-testid="checkbox-copy-spares"
                      />
                      <Label htmlFor="copy-spares" className="text-sm cursor-pointer">Spares Mapping</Label>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCopyVesselDialogOpen(false)} data-testid="button-cancel-copy">Cancel</Button>
                  <Button
                    disabled={!canProceedToConfirm}
                    onClick={() => setCopyStep("confirm")}
                    data-testid="button-proceed-copy"
                  >
                    Next
                  </Button>
                </DialogFooter>
              </>
            )}

            {copyStep === "confirm" && (
              <>
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    Confirm Copy
                  </div>
                  <p className="text-sm text-gray-700">
                    You are about to copy data from <span className="font-semibold">{sourceVesselName}</span> to <span className="font-semibold">{targetVesselName}</span>.
                  </p>
                  <p className="text-xs text-gray-500">This action may overwrite existing data. Existing duplicate mappings will be skipped.</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {copyModules.components && <Badge variant="secondary">Components</Badge>}
                    {copyModules.jobs && <Badge variant="secondary">Jobs</Badge>}
                    {copyModules.spares && <Badge variant="secondary">Spares</Badge>}
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setCopyStep("select")} data-testid="button-back-copy">Back</Button>
                  <Button
                    onClick={handleConfirmCopy}
                    disabled={copyVesselMutation.isPending}
                    data-testid="button-confirm-copy"
                  >
                    {copyVesselMutation.isPending ? "Copying..." : "Confirm Copy"}
                  </Button>
                </DialogFooter>
              </>
            )}

            {copyStep === "result" && copyResult && (
              <>
                <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-3" data-testid="copy-result-summary">
                  <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Copy Completed Successfully
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {copyModules.components && (
                      <div className="text-center p-2 bg-white rounded border" data-testid="copy-result-components">
                        <div className="text-lg font-bold text-gray-800" data-testid="text-copy-count-components">{copyResult.components}</div>
                        <div className="text-xs text-gray-500">Components</div>
                      </div>
                    )}
                    {copyModules.jobs && (
                      <div className="text-center p-2 bg-white rounded border" data-testid="copy-result-jobs">
                        <div className="text-lg font-bold text-gray-800" data-testid="text-copy-count-jobs">{copyResult.jobs}</div>
                        <div className="text-xs text-gray-500">Jobs</div>
                      </div>
                    )}
                    {copyModules.spares && (
                      <div className="text-center p-2 bg-white rounded border" data-testid="copy-result-spares">
                        <div className="text-lg font-bold text-gray-800" data-testid="text-copy-count-spares">{copyResult.spares}</div>
                        <div className="text-xs text-gray-500">Spares</div>
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <Button onClick={() => setIsCopyVesselDialogOpen(false)} data-testid="button-close-copy">Done</Button>
                </DialogFooter>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
