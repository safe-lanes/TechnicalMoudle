import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type MasterList, type MasterListType, insertMasterListSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Package, ArrowLeft, Settings2, Lock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Marker } from "@/components/Marker";
import { useAuth } from "@/contexts/AuthContext";
import { useRanks } from "@/hooks/useRanks";

// ──────────────────────────────────────────────────────────────────────────
// Master Lists Management
//
// The list_type registry is now DB-backed (master_list_types table, seeded
// by migration 085). This page:
//   - Groups list types by Section (Components / Jobs/WO / Spares)
//   - Lets Sail Admins create new list types inline from the Add Item popup
//   - Lets Sail Admins manage (rename/activate/soft-delete) list types
//   - Non-Sail-Admins see a read-only / standard-user view
//
// Server enforces Sail-Admin-only mutations on /fleet/master-list-types
// regardless of client UI state (403 on POST/PUT/DELETE).
// ──────────────────────────────────────────────────────────────────────────

const SECTIONS = ["Components", "Jobs/WO", "Spares"] as const;
type Section = typeof SECTIONS[number];

const CREATE_NEW_TYPE_SENTINEL = "__create_new_list_type__";

const masterListFormSchema = insertMasterListSchema;
type MasterListFormData = z.infer<typeof masterListFormSchema>;

// Convert a human label into a camelCase key (same convention as the
// 7 seeded system types: "Interval Unit" -> "intervalUnit").
//
// Edge cases:
//   - Leading digits are prefixed with an underscore to keep the key a
//     valid JS-identifier-shaped string ("2nd Engineer" -> "_2ndEngineer").
//   - Punctuation is stripped. Multiple spaces collapse.
//   - Already-camelCase labels stay unchanged ("fuelType" -> "fuelType").
function labelToKey(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "";
  // If the input is already a single word starting with a lowercase letter
  // (e.g. "fuelType"), leave the casing alone — the user clearly typed a key.
  if (!/\s/.test(trimmed) && /^[a-z]/.test(trimmed)) {
    return trimmed.replace(/[^a-zA-Z0-9]/g, "");
  }
  const cleaned = trimmed.replace(/[^a-zA-Z0-9\s]/g, "");
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  // First part: fully lowercase if it starts with a letter ("INTERVAL" ->
  // "interval"), otherwise leave untouched (digits can't be lowercased).
  const first = /^[a-zA-Z]/.test(parts[0]) ? parts[0].toLowerCase() : parts[0];
  const rest = parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("");
  const key = first + rest;
  // Prefix leading digits with "_" so the key is a valid identifier shape
  // ("2nd Engineer" -> "_2ndEngineer").
  return /^[0-9]/.test(key) ? "_" + key : key;
}

export default function MasterListsManagement({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const canManageTypes = hasRole("Sail Admin");

  // ── Section + selected list type ──
  const [activeSection, setActiveSection] = useState<Section>("Components");
  const [selectedListType, setSelectedListType] = useState<string>("");

  // ── Item dialogs ──
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MasterList | null>(null);
  const [selectedRowItem, setSelectedRowItem] = useState<MasterList | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MasterList | null>(null);

  // ── List-type dialogs ──
  const [isCreateTypeOpen, setIsCreateTypeOpen] = useState(false);
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [newTypeSection, setNewTypeSection] = useState<Section>("Components");

  const [isManageTypesOpen, setIsManageTypesOpen] = useState(false);
  const [editingType, setEditingType] = useState<MasterListType | null>(null);
  const [editTypeLabel, setEditTypeLabel] = useState("");
  const [editTypeSection, setEditTypeSection] = useState<Section>("Components");
  const [editTypeActive, setEditTypeActive] = useState(true);
  const [typeToDelete, setTypeToDelete] = useState<MasterListType | null>(null);

  // ── Fetch master list types ──
  // Sail Admins see ALL (including inactive) so they can reactivate; others
  // see only active.
  const typesQueryKey = canManageTypes
    ? ['/technical/api/fleet/master-list-types', 'all']
    : ['/technical/api/fleet/master-list-types'];

  const { data: allTypes } = useQuery<MasterListType[]>({
    queryKey: typesQueryKey,
    queryFn: async () => {
      const url = canManageTypes
        ? '/technical/api/fleet/master-list-types?includeInactive=true'
        : '/technical/api/fleet/master-list-types';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch master list types');
      return response.json();
    },
  });

  // Types visible in the Add-Item dropdown are always active-only, in the
  // current section.
  const typesForCurrentSection = useMemo(() => {
    const list = (allTypes || []).filter((t) => t.section === activeSection && t.isActive);
    return list.sort((a, b) => (a.displayOrder - b.displayOrder) || a.label.localeCompare(b.label));
  }, [allTypes, activeSection]);

  // Auto-select first available type when section or types change.
  useEffect(() => {
    if (typesForCurrentSection.length === 0) {
      setSelectedListType("");
      return;
    }
    const stillExists = typesForCurrentSection.some((t) => t.listTypeKey === selectedListType);
    if (!stillExists) {
      setSelectedListType(typesForCurrentSection[0].listTypeKey);
    }
    setSelectedRowItem(null);
  }, [activeSection, typesForCurrentSection]);

  // ── Fetch master list items for the selected type ──
  const { data: masterLists, isLoading, error } = useQuery<MasterList[]>({
    queryKey: ['/technical/api/fleet/master-lists', selectedListType],
    enabled: !!selectedListType,
    queryFn: async () => {
      const response = await fetch(`/technical/api/fleet/master-lists?listType=${selectedListType}`);
      if (!response.ok) throw new Error('Failed to fetch master lists');
      return response.json();
    },
  });

  // ── Item form ──
  const form = useForm<MasterListFormData>({
    resolver: zodResolver(masterListFormSchema),
    defaultValues: {
      listType: selectedListType,
      listKey: "",
      listValue: "",
      displayOrder: 0,
      isActive: true,
    },
  });

  // ── Item mutations ──
  const createMutation = useMutation({
    mutationFn: async (data: MasterListFormData) => {
      return apiRequest('POST', '/technical/api/fleet/master-lists', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/master-lists'], exact: false });
      toast({ title: "Success", description: "Master list item created successfully" });
      setIsFormOpen(false);
      form.reset({ listType: selectedListType, listKey: "", listValue: "", displayOrder: 0, isActive: true });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message || "Failed to create", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: MasterListFormData & { id: number }) => {
      const { id, ...updateData } = data;
      return apiRequest('PUT', `/technical/api/fleet/master-lists/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/master-lists'], exact: false });
      toast({ title: "Success", description: "Master list item updated successfully" });
      setIsFormOpen(false);
      setSelectedItem(null);
      setSelectedRowItem(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message || "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/technical/api/fleet/master-lists/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/master-lists'], exact: false });
      toast({ title: "Success", description: "Master list item deleted successfully" });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      setSelectedRowItem(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message || "Failed to delete", variant: "destructive" }),
  });

  // ── List-type mutations ──
  const createTypeMutation = useMutation({
    mutationFn: async (payload: { listTypeKey: string; label: string; section: Section }) => {
      const res = await apiRequest('POST', '/technical/api/fleet/master-list-types', {
        ...payload,
        isActive: true,
        displayOrder: 0,
      });
      return res.json();
    },
    onSuccess: (created: MasterListType) => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/master-list-types'], exact: false });
      toast({ title: "Success", description: `List type "${created.label}" created` });
      // Close ONLY the Create Type dialog — the Add-Item popup stays open
      // so the admin can continue filling out the item form with the
      // newly created type preselected (single fluid flow).
      setIsCreateTypeOpen(false);
      setNewTypeLabel("");
      // Switch main page to the new type's section (in case it differs
      // from the current active tab) and select it.
      setActiveSection(created.section as Section);
      setSelectedListType(created.listTypeKey);
      // Auto-select the new type inside the open Add-Item form. The Select
      // dropdown will render it once the types query refetch lands.
      form.setValue("listType", created.listTypeKey);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message || "Failed to create list type", variant: "destructive" }),
  });

  const updateTypeMutation = useMutation({
    mutationFn: async (payload: { id: number; label: string; section: Section; isActive: boolean }) => {
      const { id, ...body } = payload;
      const res = await apiRequest('PUT', `/technical/api/fleet/master-list-types/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/master-list-types'], exact: false });
      toast({ title: "Success", description: "List type updated" });
      setEditingType(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message || "Failed to update list type", variant: "destructive" }),
  });

  const deleteTypeMutation = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/technical/api/fleet/master-list-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet/master-list-types'], exact: false });
      toast({ title: "Success", description: "List type deleted" });
      setTypeToDelete(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message || "Failed to delete list type", variant: "destructive" }),
  });

  // ── Item handlers ──
  const handleAddNew = () => {
    if (!selectedListType) {
      if (canManageTypes && typesForCurrentSection.length === 0) {
        setNewTypeSection(activeSection);
        setNewTypeLabel("");
        setIsCreateTypeOpen(true);
        return;
      }
      toast({ title: "Select a list type first", variant: "destructive" });
      return;
    }
    setSelectedItem(null);
    form.reset({ listType: selectedListType, listKey: "", listValue: "", displayOrder: 0, isActive: true });
    setIsFormOpen(true);
  };

  const handleEdit = (item: MasterList) => {
    setSelectedItem(item);
    form.reset({
      listType: item.listType,
      listKey: item.listKey,
      listValue: item.listValue,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
    });
    setIsFormOpen(true);
  };

  const handleDeleteClick = (item: MasterList) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (itemToDelete) deleteMutation.mutate(itemToDelete.id);
  };

  const onSubmit = (data: MasterListFormData) => {
    if (selectedItem) updateMutation.mutate({ ...data, id: selectedItem.id });
    else createMutation.mutate(data);
  };

  // ── List-type dialog handlers ──
  const handleListTypeDropdownChange = (value: string) => {
    if (value === CREATE_NEW_TYPE_SENTINEL) {
      // Don't change selection — open the Create Type dialog instead
      setNewTypeSection(activeSection);
      setNewTypeLabel("");
      setIsCreateTypeOpen(true);
      return;
    }
    form.setValue("listType", value);
  };

  const handleCreateTypeSubmit = () => {
    const label = newTypeLabel.trim();
    if (!label) {
      toast({ title: "Label required", variant: "destructive" });
      return;
    }
    const key = labelToKey(label);
    if (!key) {
      toast({ title: "Invalid label", description: "Label must contain letters", variant: "destructive" });
      return;
    }
    // Client-side duplicate check (server is authoritative)
    const exists = (allTypes || []).some((t) => t.listTypeKey === key);
    if (exists) {
      toast({ title: "Duplicate", description: `A list type with key "${key}" already exists`, variant: "destructive" });
      return;
    }
    createTypeMutation.mutate({ listTypeKey: key, label, section: newTypeSection });
  };

  const startEditType = (t: MasterListType) => {
    setEditingType(t);
    setEditTypeLabel(t.label);
    setEditTypeSection(t.section as Section);
    setEditTypeActive(t.isActive);
  };

  const handleUpdateTypeSubmit = () => {
    if (!editingType) return;
    const label = editTypeLabel.trim();
    if (!label) {
      toast({ title: "Label required", variant: "destructive" });
      return;
    }
    updateTypeMutation.mutate({
      id: editingType.id,
      label,
      section: editTypeSection,
      isActive: editTypeActive,
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const totalItems = masterLists?.length || 0;
  const currentTypeLabel = typesForCurrentSection.find((t) => t.listTypeKey === selectedListType)?.label || "";

  const typesBySection = useMemo(() => {
    const map: Record<Section, MasterListType[]> = { "Components": [], "Jobs/WO": [], "Spares": [] };
    for (const t of allTypes || []) {
      if (SECTIONS.includes(t.section as Section)) map[t.section as Section].push(t);
    }
    for (const s of SECTIONS) {
      map[s].sort((a, b) => (a.displayOrder - b.displayOrder) || a.label.localeCompare(b.label));
    }
    return map;
  }, [allTypes]);

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="I4.QL.2.7">
          <Marker id="I4.QL.2.7" />Master Lists Management
        </h1>
        <div className="flex gap-2 items-center">
          {onBack && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 bg-white text-[#0f172a] border-gray-300"
              onClick={onBack}
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          )}
          {canManageTypes && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 bg-white text-[#0f172a] border-gray-300"
              onClick={() => setIsManageTypesOpen(true)}
              data-testid="button-manage-list-types"
            >
              <Settings2 className="h-4 w-4" />
              Manage List Types
            </Button>
          )}
          <Button
            onClick={() => selectedRowItem && handleEdit(selectedRowItem)}
            disabled={!selectedRowItem}
            variant="outline"
            size="sm"
            className="h-8 gap-2 bg-white text-[#0f172a] border-gray-300 disabled:opacity-50"
            data-testid="I4.QL.2.11"
          >
            <Marker id="I4.QL.2.11" />
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            size="sm"
            className="bg-[#5dc86f] hover:bg-[#4db85f] text-white"
            onClick={handleAddNew}
            data-testid="I4.QL.2.12"
          >
            <Marker id="I4.QL.2.12" />
            <Plus className="h-4 w-4 mr-1" />
            Add New
          </Button>
        </div>
      </div>

      {/* Section Tabs */}
      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as Section)}>
        <TabsList>
          {SECTIONS.map((s) => (
            <TabsTrigger key={s} value={s} data-testid={`tab-section-${s.replace("/", "-")}`}>
              {s}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={selectedListType}
          onValueChange={(value) => {
            setSelectedListType(value);
            setSelectedRowItem(null);
          }}
        >
          <SelectTrigger className="w-[240px] bg-white border-gray-300" data-testid="I4.QL.2.10">
            <Marker id="I4.QL.2.10" />
            <SelectValue placeholder={typesForCurrentSection.length === 0 ? "No list types in this section" : "Select a list type"} />
          </SelectTrigger>
          <SelectContent>
            {typesForCurrentSection.map((type) => (
              <SelectItem key={type.listTypeKey} value={type.listTypeKey}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-total-items">
          <Package className="h-3 w-3 mr-1" />
          {totalItems} Total
        </Badge>
      </div>

      <div>
        {!selectedListType ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {typesForCurrentSection.length === 0
                ? `No list types in the ${activeSection} section yet.`
                : "Select a list type above."}
            </p>
            {typesForCurrentSection.length === 0 && canManageTypes && (
              <Button
                size="sm"
                className="mt-4 bg-[#5dc86f] hover:bg-[#4db85f] text-white"
                onClick={() => {
                  setNewTypeSection(activeSection);
                  setNewTypeLabel("");
                  setIsCreateTypeOpen(true);
                }}
                data-testid="button-create-first-list-type"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create List Type
              </Button>
            )}
          </div>
        ) : selectedListType === 'rank' ? (
          <RankReadOnlyView />
        ) : isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 animate-pulse rounded"></div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-red-700">Failed to load master lists</p>
          </div>
        ) : !masterLists || masterLists.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No items in this list. Add your first item to get started.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto bg-white rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#52baf3] hover:bg-[#52baf3]">
                  <th className="text-left text-white py-3 px-4 font-medium" data-testid="I4.QL.2.13"><Marker id="I4.QL.2.13" />Key</th>
                  <th className="text-left text-white py-3 px-4 font-medium" data-testid="I4.QL.2.14"><Marker id="I4.QL.2.14" />Value</th>
                  <th className="text-left text-white py-3 px-4 font-medium" data-testid="I4.QL.2.15"><Marker id="I4.QL.2.15" />Display Order</th>
                  <th className="text-left text-white py-3 px-4 font-medium" data-testid="I4.QL.2.16"><Marker id="I4.QL.2.16" />Active</th>
                  <th className="text-right text-white py-3 px-4 font-medium" data-testid="I4.QL.2.17"><Marker id="I4.QL.2.17" />Actions</th>
                </tr>
              </thead>
              <tbody>
                {masterLists.map((item, index) => (
                  <tr
                    key={item.id}
                    data-testid={`row-master-list-${item.id}`}
                    onClick={() => setSelectedRowItem(selectedRowItem?.id === item.id ? null : item)}
                    className={`cursor-pointer ${
                      selectedRowItem?.id === item.id
                        ? 'bg-blue-50'
                        : index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                    } hover:bg-gray-100`}
                  >
                    <td className="py-3 px-4 font-mono text-sm text-blue-600" data-testid={index === 0 ? "I4.QL.2.18" : undefined}>
                      {index === 0 && <Marker id="I4.QL.2.18" />}
                      {item.listKey}
                    </td>
                    <td className="py-3 px-4 font-medium" data-testid={index === 0 ? "I4.QL.2.19" : undefined}>
                      {index === 0 && <Marker id="I4.QL.2.19" />}
                      {item.listValue}
                    </td>
                    <td className="py-3 px-4" data-testid={index === 0 ? "I4.QL.2.20" : undefined}>
                      {index === 0 && <Marker id="I4.QL.2.20" />}
                      {item.displayOrder}
                    </td>
                    <td className="py-3 px-4" data-testid={index === 0 ? "I4.QL.2.21" : undefined}>
                      {index === 0 && <Marker id="I4.QL.2.21" />}
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                          className="p-1 hover:bg-gray-200 rounded"
                          data-testid={index === 0 ? "I4.QL.2.22" : `button-edit-${item.id}`}
                        >
                          {index === 0 && <Marker id="I4.QL.2.22" />}
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(item); }}
                          className="p-1 hover:bg-gray-200 rounded text-red-500"
                          data-testid={index === 0 ? "I4.QL.2.23" : `button-delete-${item.id}`}
                        >
                          {index === 0 && <Marker id="I4.QL.2.23" />}
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          Add/Edit Item Dialog
          ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-master-list-form">
          <DialogHeader>
            <DialogTitle>
              {selectedItem ? "Edit Master List Item" : "Add New Master List Item"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* List Type - Read only in edit mode */}
            <div className="space-y-2">
              <Label htmlFor="listType">List Type</Label>
              <Select
                value={form.watch("listType")}
                onValueChange={handleListTypeDropdownChange}
                disabled={!!selectedItem}
              >
                <SelectTrigger data-testid="input-list-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typesForCurrentSection.map((type) => (
                    <SelectItem key={type.listTypeKey} value={type.listTypeKey}>
                      {type.label}
                    </SelectItem>
                  ))}
                  {canManageTypes && !selectedItem && (
                    <SelectItem
                      key={CREATE_NEW_TYPE_SENTINEL}
                      value={CREATE_NEW_TYPE_SENTINEL}
                      data-testid="option-create-new-list-type"
                    >
                      <span className="flex items-center gap-1 text-blue-600 font-medium">
                        <Plus className="h-3 w-3" /> Create new list type…
                      </span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Showing list types in <b>{activeSection}</b> section.
              </p>
            </div>

            {/* Key */}
            <div className="space-y-2">
              <Label htmlFor="listKey">
                Key <span className="text-red-500">*</span>
              </Label>
              <Input
                id="listKey"
                {...form.register("listKey")}
                placeholder="Unique identifier (e.g., DECK, ENGINE)"
                data-testid="input-list-key"
              />
              {form.formState.errors.listKey && (
                <p className="text-sm text-red-500">{form.formState.errors.listKey.message}</p>
              )}
            </div>

            {/* Value */}
            <div className="space-y-2">
              <Label htmlFor="listValue">
                Value <span className="text-red-500">*</span>
              </Label>
              <Input
                id="listValue"
                {...form.register("listValue")}
                placeholder="Display value (e.g., Deck Department)"
                data-testid="input-list-value"
              />
              {form.formState.errors.listValue && (
                <p className="text-sm text-red-500">{form.formState.errors.listValue.message}</p>
              )}
            </div>

            {/* Display Order */}
            <div className="space-y-2">
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                type="number"
                {...form.register("displayOrder", { valueAsNumber: true })}
                placeholder="0"
                data-testid="input-display-order"
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={form.watch("isActive")}
                onCheckedChange={(checked) => form.setValue("isActive", checked)}
                data-testid="switch-is-active"
              />
              <Label htmlFor="isActive">Active</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                disabled={isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-save-master-list"
              >
                {isPending ? "Saving..." : selectedItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          Create New List Type Dialog (Sail Admin only)
          ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={isCreateTypeOpen} onOpenChange={setIsCreateTypeOpen}>
        <DialogContent className="sm:max-w-[450px]" data-testid="dialog-create-list-type">
          <DialogHeader>
            <DialogTitle>Create New List Type</DialogTitle>
            <DialogDescription>
              Add a new list type to the master list registry. The key is derived automatically from the label.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-type-label">Label <span className="text-red-500">*</span></Label>
              <Input
                id="new-type-label"
                value={newTypeLabel}
                onChange={(e) => setNewTypeLabel(e.target.value)}
                placeholder="e.g. Fuel Type"
                data-testid="input-new-type-label"
              />
              {newTypeLabel.trim() && (
                <p className="text-xs text-gray-500">
                  Key: <code className="bg-gray-100 px-1 rounded">{labelToKey(newTypeLabel)}</code>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-type-section">Section</Label>
              <Select value={newTypeSection} onValueChange={(v) => setNewTypeSection(v as Section)}>
                <SelectTrigger id="new-type-section" data-testid="input-new-type-section">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateTypeOpen(false)}
              disabled={createTypeMutation.isPending}
              data-testid="button-cancel-create-type"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTypeSubmit}
              disabled={createTypeMutation.isPending || !newTypeLabel.trim()}
              data-testid="button-save-create-type"
            >
              {createTypeMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          Manage List Types Dialog (Sail Admin only)
          ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={isManageTypesOpen} onOpenChange={setIsManageTypesOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto" data-testid="dialog-manage-list-types">
          <DialogHeader>
            <DialogTitle>Manage List Types</DialogTitle>
            <DialogDescription>
              System types cannot be deleted. Types that are in use cannot be renamed or deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {SECTIONS.map((s) => (
              <div key={s}>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{s}</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Label</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Key</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typesBySection[s].length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-4 text-gray-400">No list types</td>
                        </tr>
                      ) : (
                        typesBySection[s].map((t) => (
                          <tr key={t.id} className="border-t" data-testid={`row-list-type-${t.id}`}>
                            <td className="py-2 px-3">
                              <span className="flex items-center gap-1">
                                {t.isSystem && <Lock className="h-3 w-3 text-gray-400" />}
                                {t.label}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-xs text-blue-600">{t.listTypeKey}</td>
                            <td className="py-2 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  t.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {t.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => startEditType(t)}
                                  className="p-1 hover:bg-gray-200 rounded"
                                  data-testid={`button-edit-type-${t.id}`}
                                  title="Edit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setTypeToDelete(t)}
                                  disabled={t.isSystem}
                                  className="p-1 hover:bg-gray-200 rounded text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                  data-testid={`button-delete-type-${t.id}`}
                                  title={t.isSystem ? "System types cannot be deleted" : "Delete"}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManageTypesOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit List Type Dialog */}
      <Dialog open={!!editingType} onOpenChange={(open) => !open && setEditingType(null)}>
        <DialogContent className="sm:max-w-[450px]" data-testid="dialog-edit-list-type">
          <DialogHeader>
            <DialogTitle>Edit List Type</DialogTitle>
            {editingType?.isSystem && (
              <DialogDescription className="text-amber-700">
                This is a system type. Only the label can be changed; the key and section are locked.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-type-label">Label <span className="text-red-500">*</span></Label>
              <Input
                id="edit-type-label"
                value={editTypeLabel}
                onChange={(e) => setEditTypeLabel(e.target.value)}
                data-testid="input-edit-type-label"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type-key">Key (read-only)</Label>
              <Input id="edit-type-key" value={editingType?.listTypeKey || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type-section">Section</Label>
              <Select
                value={editTypeSection}
                onValueChange={(v) => setEditTypeSection(v as Section)}
                disabled={editingType?.isSystem}
              >
                <SelectTrigger id="edit-type-section" data-testid="input-edit-type-section">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-type-active"
                checked={editTypeActive}
                onCheckedChange={setEditTypeActive}
                data-testid="switch-edit-type-active"
              />
              <Label htmlFor="edit-type-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingType(null)} disabled={updateTypeMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateTypeSubmit}
              disabled={updateTypeMutation.isPending || !editTypeLabel.trim()}
              data-testid="button-save-edit-type"
            >
              {updateTypeMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog (items) */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-master-list">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Master List Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.listValue}"? This action cannot be undone.
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

      {/* Delete Confirmation Dialog (list types) */}
      <AlertDialog open={!!typeToDelete} onOpenChange={(open) => !open && setTypeToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-list-type">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete List Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the list type "{typeToDelete?.label}"? If any master list items still
              reference this type, the server will reject the delete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-type">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => typeToDelete && deleteTypeMutation.mutate(typeToDelete.id)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteTypeMutation.isPending}
              data-testid="button-confirm-delete-type"
            >
              {deleteTypeMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RankReadOnlyView() {
  const { ranks, isLoading, isError } = useRanks();
  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-center gap-2" data-testid="banner-rank-readonly">
        <Lock className="h-4 w-4" />
        <span>Ranks are managed centrally in <strong>Admin &rsaquo; Ranks</strong>. This is a read-only mirror &mdash; add, edit or reorder ranks from the Ranks Admin screen.</span>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 animate-pulse rounded"></div>
          ))}
        </div>
      ) : isError ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-700">Failed to load ranks</p>
        </div>
      ) : ranks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No ranks defined yet. Add ranks from Ranks Admin.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto bg-white rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#52baf3]">
                <th className="text-left text-white py-3 px-4 font-medium">Order</th>
                <th className="text-left text-white py-3 px-4 font-medium">Name (stored)</th>
                <th className="text-left text-white py-3 px-4 font-medium">Label (displayed)</th>
              </tr>
            </thead>
            <tbody>
              {ranks.map((r, index) => (
                <tr key={r.value} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} data-testid={`row-rank-readonly-${r.value}`}>
                  <td className="py-3 px-4 text-gray-600">{index + 1}</td>
                  <td className="py-3 px-4 font-mono text-blue-600">{r.value}</td>
                  <td className="py-3 px-4 font-medium">{r.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
