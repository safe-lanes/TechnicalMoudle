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
import { Search, ArrowLeft, Stamp, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useVessels } from "@/hooks/useVessels";

// Rotation Item Master List (Task #366) — pure master registry of physical rotational
// parts identified by Stamp No. Components can only SELECT stamps that exist here
// (strict master-first); the Installed On column is derived server-side via the
// components.current_stamp join.
interface MasterItem {
  riuuid: string;
  vesselId: string;
  stamp: string;
  stampName: string | null;
  status: string; // Installed | Spare | In Store | Retired
  currentRh: string | null;
  rhLastUpdated: string | null;
  installedOnCuuid: string | null;
  installedOnCode: string | null;
  installedOnName: string | null;
}

const CREATABLE_STATUSES = ["Spare", "In Store"];
const EDIT_STATUSES = ["Spare", "In Store", "Retired"];

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    Installed: "bg-green-100 text-green-800 border-green-300",
    Spare: "bg-blue-100 text-blue-800 border-blue-300",
    "In Store": "bg-amber-100 text-amber-800 border-amber-300",
    Retired: "bg-gray-200 text-gray-600 border-gray-300",
  };
  return (
    <Badge variant="outline" className={styles[status] || ""}>
      {status}
    </Badge>
  );
}

export default function RotationItemMasterList({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const { data: vessels = [] } = useVessels();
  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<MasterItem | null>(null);
  // form state (shared by add/edit dialogs)
  const [formStamp, setFormStamp] = useState("");
  const [formStampName, setFormStampName] = useState("");
  const [formStatus, setFormStatus] = useState("Spare");
  const [formRh, setFormRh] = useState("0");
  const [formRhDate, setFormRhDate] = useState("");

  const listUrl = `/technical/api/rotational-items?vesselId=${encodeURIComponent(selectedVesselId)}&withHolder=true`;

  const { data: items = [], isLoading } = useQuery<MasterItem[]>({
    queryKey: [listUrl],
    queryFn: () => fetch(listUrl).then((r) => {
      if (!r.ok) throw new Error("Failed to load rotation items");
      return r.json();
    }),
    enabled: !!selectedVesselId,
  });

  const filtered = useMemo(() => {
    let rows = items;
    if (statusFilter !== "all") rows = rows.filter((i) => i.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(
        (i) =>
          i.stamp?.toLowerCase().includes(q) ||
          i.stampName?.toLowerCase().includes(q) ||
          i.installedOnName?.toLowerCase().includes(q) ||
          i.installedOnCode?.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [items, searchQuery, statusFilter]);

  const invalidate = () =>
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0] || "").startsWith("/technical/api/rotational-items"),
    });

  const parseError = async (error: any) => error?.message || "Request failed";

  const addMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/technical/api/rotational-items", {
        vesselId: selectedVesselId,
        stamp: formStamp.trim(),
        stampName: formStampName.trim() || null,
        status: formStatus,
        currentRh: formRh !== "" ? String(parseFloat(formRh)) : "0",
        rhLastUpdated: formRhDate || null,
      });
    },
    onSuccess: () => {
      invalidate();
      setIsAddDialogOpen(false);
      toast({ title: "Rotation Item Added", description: `Stamp "${formStamp.trim()}" created.` });
    },
    onError: async (error: any) =>
      toast({ title: "Error", description: await parseError(error), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem) return;
      const body: Record<string, any> = {
        stampName: formStampName.trim() || null,
      };
      if (editingItem.status !== "Installed") {
        body.stamp = formStamp.trim();
        body.status = formStatus;
        if (formRh !== "") body.currentRh = String(parseFloat(formRh));
        if (formRhDate) body.rhLastUpdated = formRhDate;
      }
      return apiRequest("PUT", `/technical/api/rotational-items/${editingItem.riuuid}`, body);
    },
    onSuccess: () => {
      invalidate();
      setEditingItem(null);
      toast({ title: "Rotation Item Updated", description: "Changes saved." });
    },
    onError: async (error: any) =>
      toast({ title: "Error", description: await parseError(error), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (riuuid: string) =>
      apiRequest("DELETE", `/technical/api/rotational-items/${riuuid}`),
    onSuccess: () => {
      invalidate();
      setDeleteItem(null);
      toast({ title: "Rotation Item Deleted", description: "The stamp has been removed." });
    },
    onError: async (error: any) =>
      toast({ title: "Error", description: await parseError(error), variant: "destructive" }),
  });

  const handleOpenAdd = () => {
    setFormStamp("");
    setFormStampName("");
    setFormStatus("Spare");
    setFormRh("0");
    setFormRhDate("");
    setIsAddDialogOpen(true);
  };

  const handleOpenEdit = (item: MasterItem) => {
    setFormStamp(item.stamp);
    setFormStampName(item.stampName || "");
    setFormStatus(item.status === "Installed" ? "Installed" : item.status);
    setFormRh(item.currentRh != null ? String(parseFloat(item.currentRh)) : "0");
    setFormRhDate(item.rhLastUpdated ? item.rhLastUpdated.slice(0, 10) : "");
    setEditingItem(item);
  };

  const validateForm = (requireStamp: boolean) => {
    if (requireStamp && !formStamp.trim()) {
      toast({ title: "Validation Error", description: "Stamp No. is required.", variant: "destructive" });
      return false;
    }
    if (formRh !== "" && (isNaN(parseFloat(formRh)) || parseFloat(formRh) < 0)) {
      toast({ title: "Validation Error", description: "Running Hours must be a non-negative number.", variant: "destructive" });
      return false;
    }
    if (formRhDate && new Date(formRhDate) > new Date()) {
      toast({ title: "Validation Error", description: "RH date cannot be in the future.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const getVesselName = (vesselId: string) => {
    const vessel = vessels.find((v: any) => v.id === vesselId || v.vesselId === vesselId || v.vuid === vesselId);
    return (vessel as any)?.name || (vessel as any)?.vesselName || (vessel as any)?.vessel || vesselId;
  };

  const fmtRh = (rh: string | null) => (rh != null && rh !== "" ? parseFloat(rh).toFixed(1) : "-");
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "-");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-rotation-items">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Stamp className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-bold" data-testid="text-rotation-items-header">Rotation Item Master List</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
            <SelectTrigger className="w-[240px]" data-testid="select-rotation-vessel">
              <SelectValue placeholder="Select vessel..." />
            </SelectTrigger>
            <SelectContent>
              {vessels.map((vessel: any) => {
                const id = vessel.id || vessel.vesselId || vessel.vuid;
                const name = vessel.name || vessel.vesselName || vessel.vessel || id;
                return (
                  <SelectItem key={id} value={id} data-testid={`rotation-vessel-option-${id}`}>
                    {name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {selectedVesselId && (
            <Button className="bg-[#5dc86f] hover:bg-[#4db85f] text-white" onClick={handleOpenAdd} data-testid="button-add-rotation-item">
              <Plus className="h-4 w-4 mr-2" />
              Add Rotation Item
            </Button>
          )}
        </div>
      </div>

      {!selectedVesselId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Stamp className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 text-center">Select a vessel to view and manage its rotation item masters</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                Rotation Items for {getVesselName(selectedVesselId)}
                <Badge variant="secondary">{filtered.length}</Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-rotation-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="Installed">Installed</SelectItem>
                    <SelectItem value="Spare">Spare</SelectItem>
                    <SelectItem value="In Store">In Store</SelectItem>
                    <SelectItem value="Retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search stamp, name, component..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-rotation-items"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-gray-500">Loading rotation items...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Stamp className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-gray-500">
                  {searchQuery || statusFilter !== "all" ? "No rotation items match your filters" : "No rotation items yet for this vessel"}
                </p>
                {!searchQuery && statusFilter === "all" && (
                  <p className="text-sm text-gray-400 mt-1">
                    Add items manually or import them from the Bulk Data Import page
                  </p>
                )}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#52baf3]">
                      <th className="text-white font-semibold text-xs whitespace-nowrap px-3 py-2 text-center w-12">#</th>
                      <th className="text-white font-semibold text-xs whitespace-nowrap px-3 py-2 text-left">Stamp No.</th>
                      <th className="text-white font-semibold text-xs whitespace-nowrap px-3 py-2 text-left">Stamp Name</th>
                      <th className="text-white font-semibold text-xs whitespace-nowrap px-3 py-2 text-left">Status</th>
                      <th className="text-white font-semibold text-xs whitespace-nowrap px-3 py-2 text-left">Installed On</th>
                      <th className="text-white font-semibold text-xs whitespace-nowrap px-3 py-2 text-right">Running Hours</th>
                      <th className="text-white font-semibold text-xs whitespace-nowrap px-3 py-2 text-left">RH Last Updated</th>
                      <th className="text-white font-semibold text-xs whitespace-nowrap px-3 py-2 text-center w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, index) => (
                      <tr key={item.riuuid} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"} data-testid={`row-rotation-item-${item.stamp}`}>
                        <td className="text-center text-gray-500 text-sm px-3 py-2">{index + 1}</td>
                        <td className="font-medium px-3 py-2">{item.stamp}</td>
                        <td className="px-3 py-2">{item.stampName || <span className="text-gray-400">-</span>}</td>
                        <td className="px-3 py-2">{statusBadge(item.status)}</td>
                        <td className="px-3 py-2">
                          {item.installedOnCode || item.installedOnName ? (
                            <span>
                              {item.installedOnCode && <span className="text-gray-500 mr-1">{item.installedOnCode}</span>}
                              {item.installedOnName}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtRh(item.currentRh)}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{fmtDate(item.rhLastUpdated)}</td>
                        <td className="text-center px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              className="p-1 rounded hover:bg-gray-200 transition-colors"
                              onClick={() => handleOpenEdit(item)}
                              title="Edit"
                              data-testid={`button-edit-rotation-item-${item.stamp}`}
                            >
                              <Pencil className="h-3.5 w-3.5 text-gray-600" />
                            </button>
                            <button
                              className={`p-1 rounded transition-colors ${item.status === "Installed" ? "opacity-30 cursor-not-allowed" : "hover:bg-gray-200"}`}
                              onClick={() => item.status !== "Installed" && setDeleteItem(item)}
                              title={item.status === "Installed" ? "Installed stamps cannot be deleted" : "Delete"}
                              data-testid={`button-delete-rotation-item-${item.stamp}`}
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

      {/* Add dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Rotation Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-stamp">Stamp No. *</Label>
              <Input id="add-stamp" value={formStamp} onChange={(e) => setFormStamp(e.target.value)} placeholder="e.g., LINER-00004" data-testid="input-add-stamp" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-stamp-name">Stamp Name</Label>
              <Input id="add-stamp-name" value={formStampName} onChange={(e) => setFormStampName(e.target.value)} placeholder="e.g., ME Cylinder Liner" data-testid="input-add-stamp-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-rh">Starting Running Hours</Label>
                <Input id="add-rh" type="number" min="0" step="0.1" value={formRh} onChange={(e) => setFormRh(e.target.value)} data-testid="input-add-rh" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-rh-date">RH Reading Date</Label>
                <Input id="add-rh-date" type="date" value={formRhDate} onChange={(e) => setFormRhDate(e.target.value)} data-testid="input-add-rh-date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger data-testid="select-add-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREATABLE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">New items start as Spare or In Store. "Installed" is set by fitting the stamp to a component.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="bg-white text-[#0f172a] border-gray-300" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
              onClick={() => validateForm(true) && addMutation.mutate()}
              disabled={addMutation.isPending}
              data-testid="button-save-add-rotation-item"
            >
              {addMutation.isPending ? "Saving..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) setEditingItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Rotation Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editingItem?.status === "Installed" && (
              <p className="text-xs rounded bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">
                This stamp is installed on {editingItem.installedOnName || editingItem.installedOnCode || "a component"}.
                Only the Stamp Name can be edited; status and running hours follow the component.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-stamp">Stamp No. *</Label>
              <Input id="edit-stamp" value={formStamp} onChange={(e) => setFormStamp(e.target.value)} disabled={editingItem?.status === "Installed"} data-testid="input-edit-stamp" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-stamp-name">Stamp Name</Label>
              <Input id="edit-stamp-name" value={formStampName} onChange={(e) => setFormStampName(e.target.value)} data-testid="input-edit-stamp-name" />
            </div>
            {editingItem?.status !== "Installed" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-rh">Running Hours</Label>
                    <Input id="edit-rh" type="number" min="0" step="0.1" value={formRh} onChange={(e) => setFormRh(e.target.value)} data-testid="input-edit-rh" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-rh-date">RH Reading Date</Label>
                    <Input id="edit-rh-date" type="date" value={formRhDate} onChange={(e) => setFormRhDate(e.target.value)} data-testid="input-edit-rh-date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formStatus} onValueChange={setFormStatus}>
                    <SelectTrigger data-testid="select-edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EDIT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="bg-white text-[#0f172a] border-gray-300" onClick={() => setEditingItem(null)}>Cancel</Button>
            <Button
              className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
              onClick={() => validateForm(editingItem?.status !== "Installed") && updateMutation.mutate()}
              disabled={updateMutation.isPending}
              data-testid="button-save-edit-rotation-item"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => { if (!open) setDeleteItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rotation Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete stamp "{deleteItem?.stamp}"
              {deleteItem?.stampName ? ` (${deleteItem.stampName})` : ""}? Its rotation history is kept, but the
              stamp will no longer be selectable on components.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.riuuid)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-rotation-item"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
