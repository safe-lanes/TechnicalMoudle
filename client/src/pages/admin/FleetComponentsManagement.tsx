import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type FleetComponents } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, ChevronRight, ChevronDown, Upload, Download } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import FleetComponentForm from "./FleetComponentForm";
import { Marker } from "@/components/Marker";

export default function FleetComponentsManagement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<FleetComponents | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [componentToDelete, setComponentToDelete] = useState<FleetComponents | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Fetch fleet components from fleet_components table
  const { data: components, isLoading, error } = useQuery<FleetComponents[]>({
    queryKey: ['/technical/api/fleet-admin/fleet-components'],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/technical/api/fleet-admin/fleet-components/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/fleet-admin/fleet-components'], exact: false });
      toast({
        title: "Success",
        description: "Component deleted successfully",
      });
      setDeleteDialogOpen(false);
      setComponentToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete component",
        variant: "destructive",
      });
    },
  });

  // Define tree node type with children
  type TreeNode = FleetComponents & { children: TreeNode[] };

  // Build tree structure from flat list
  const buildTree = (components: FleetComponents[]): TreeNode[] => {
    const tree: TreeNode[] = [];
    const lookup = new Map<string, TreeNode>();

    // First pass: create lookup map by fleetEquipmentCode
    components.forEach((comp) => {
      lookup.set(comp.fleetEquipmentCode, { ...comp, children: [] });
    });

    // Second pass: build tree
    components.forEach((comp) => {
      const node = lookup.get(comp.fleetEquipmentCode);
      if (!node) return;

      if (comp.parentFleetEquipmentCode) {
        const parent = lookup.get(comp.parentFleetEquipmentCode);
        if (parent) {
          parent.children.push(node);
        } else {
          tree.push(node);
        }
      } else {
        tree.push(node);
      }
    });

    return tree;
  };

  // Filter components based on search query
  const filteredComponents = components?.filter((comp) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      comp.fleetEquipmentName?.toLowerCase().includes(query) ||
      comp.fleetEquipmentCode?.toLowerCase().includes(query) ||
      comp.makerName?.toLowerCase().includes(query)
    );
  }) || [];

  const treeData = buildTree(filteredComponents);

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddNew = (parentCode?: string | null) => {
    setSelectedComponent(parentCode ? { parentFleetEquipmentCode: parentCode } as FleetComponents : null);
    setIsFormOpen(true);
  };

  const handleEdit = (component: FleetComponents) => {
    setSelectedComponent(component);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (component: FleetComponents) => {
    setComponentToDelete(component);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (componentToDelete) {
      deleteMutation.mutate(componentToDelete.id);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/technical/api/fleet-admin/fleet-components/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fleet-components-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Success",
        description: "Components exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export components",
        variant: "destructive",
      });
    }
  };

  const renderTreeNode = (node: TreeNode, level: number = 0, isFirstRoot: boolean = false): JSX.Element => {
    const nodeKey = String(node.id);
    const isExpanded = expandedNodes.has(nodeKey);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <>
        <TableRow key={nodeKey} data-testid={`row-component-${nodeKey}`}>
          <TableCell style={{ paddingLeft: `${level * 24 + 16}px` }} className="font-mono text-sm" data-testid={isFirstRoot ? "I4.QL.3.20" : undefined}>
            {isFirstRoot && <Marker id="I4.QL.3.20" />}
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  onClick={() => toggleNode(nodeKey)}
                  className="p-1 hover:bg-gray-100 rounded"
                  data-testid={`button-toggle-${nodeKey}`}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <div className="w-6" />
              )}
              <span>{node.fleetEquipmentCode}</span>
            </div>
          </TableCell>
          <TableCell data-testid={isFirstRoot ? "I4.QL.3.21" : undefined}>
            {isFirstRoot && <Marker id="I4.QL.3.21" />}
            <span className="font-medium">{node.fleetEquipmentName}</span>
          </TableCell>
          <TableCell className="font-mono text-sm" data-testid={isFirstRoot ? "I4.QL.3.22" : undefined}>
            {isFirstRoot && <Marker id="I4.QL.3.22" />}
            {node.componentCategory || "-"}
          </TableCell>
          <TableCell data-testid={isFirstRoot ? "I4.QL.3.23" : undefined}>
            {isFirstRoot && <Marker id="I4.QL.3.23" />}
            {node.makerName || "-"}
          </TableCell>
          <TableCell data-testid={isFirstRoot ? "I4.QL.3.24" : undefined}>
            {isFirstRoot && <Marker id="I4.QL.3.24" />}
            {node.model || "-"}
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAddNew(node.fleetEquipmentCode)}
                data-testid={isFirstRoot ? "I4.QL.3.25" : `button-add-child-${nodeKey}`}
                title="Add Child"
              >
                {isFirstRoot && <Marker id="I4.QL.3.25" />}
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(node)}
                data-testid={isFirstRoot ? "I4.QL.3.26" : `button-edit-${nodeKey}`}
              >
                {isFirstRoot && <Marker id="I4.QL.3.26" />}
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteClick(node)}
                className="text-red-600"
                data-testid={isFirstRoot ? "I4.QL.3.27" : `button-delete-${nodeKey}`}
              >
                {isFirstRoot && <Marker id="I4.QL.3.27" />}
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        {isExpanded && hasChildren && node.children.map((child) => renderTreeNode(child, level + 1, false))}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Fleet Components Management</h1>
          <p className="text-gray-600 mt-2" data-testid="I4.QL.3.9"><Marker id="I4.QL.3.9" />Manage fleet-level equipment hierarchy (SFI structure)</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle data-testid="I4.QL.3.10"><Marker id="I4.QL.3.10" />All Fleet Components</CardTitle>
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 sm:min-w-[300px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by name, code, or SFI..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="I4.QL.3.11"
                  />
                  <Marker id="I4.QL.3.11" />
                </div>
                {/* Action Buttons */}
                <Button
                  variant="outline"
                  onClick={handleExport}
                  data-testid="I4.QL.3.12"
                >
                  <Marker id="I4.QL.3.12" />
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
                <Button
                  onClick={() => handleAddNew()}
                  className="whitespace-nowrap"
                  data-testid="I4.QL.3.13"
                >
                  <Marker id="I4.QL.3.13" />
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Component
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
                <p className="text-red-700">Failed to load components</p>
              </div>
            ) : filteredComponents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {searchQuery ? "No components found matching your search" : "No components yet. Add your first component to get started."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead data-testid="I4.QL.3.14"><Marker id="I4.QL.3.14" />Fleet Code</TableHead>
                      <TableHead data-testid="I4.QL.3.15"><Marker id="I4.QL.3.15" />Equipment Name</TableHead>
                      <TableHead data-testid="I4.QL.3.16"><Marker id="I4.QL.3.16" />Category</TableHead>
                      <TableHead data-testid="I4.QL.3.17"><Marker id="I4.QL.3.17" />Maker</TableHead>
                      <TableHead data-testid="I4.QL.3.18"><Marker id="I4.QL.3.18" />Model</TableHead>
                      <TableHead className="text-right" data-testid="I4.QL.3.19"><Marker id="I4.QL.3.19" />Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {treeData.map((node, index) => renderTreeNode(node, 0, index === 0))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Component Form Dialog */}
      <FleetComponentForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        component={selectedComponent}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-component">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Component</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{componentToDelete?.fleetEquipmentName}"? This action cannot be undone and will also delete all child components.
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
