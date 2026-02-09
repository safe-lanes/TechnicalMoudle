import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type FleetComponents } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, ChevronRight, ChevronDown, Upload, Download, Settings, Package, ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import FleetComponentForm from "./FleetComponentForm";
import { Marker } from "@/components/Marker";

export default function FleetComponentsManagement({ onBack }: { onBack?: () => void }) {
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

  const totalComponents = components?.length || 0;
  const rootComponents = treeData.length;

  const renderTreeNode = (node: TreeNode, level: number = 0, isFirstRoot: boolean = false): JSX.Element => {
    const nodeKey = String(node.id);
    const isExpanded = expandedNodes.has(nodeKey);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <>
        <TableRow
          key={nodeKey}
          className="hover:bg-blue-50/40 transition-colors border-b border-gray-100"
          data-testid={`row-component-${nodeKey}`}
        >
          <TableCell style={{ paddingLeft: `${level * 28 + 16}px` }} className="font-mono text-sm py-3" data-testid={isFirstRoot ? "I4.QL.3.20" : undefined}>
            {isFirstRoot && <Marker id="I4.QL.3.20" />}
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  onClick={() => toggleNode(nodeKey)}
                  className="p-1 rounded-md hover:bg-cyan-100 text-cyan-700 transition-colors"
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
              <span className="text-gray-700 font-semibold">{node.fleetEquipmentCode}</span>
            </div>
          </TableCell>
          <TableCell className="py-3" data-testid={isFirstRoot ? "I4.QL.3.21" : undefined}>
            {isFirstRoot && <Marker id="I4.QL.3.21" />}
            <span className="font-medium text-gray-800">{node.fleetEquipmentName}</span>
          </TableCell>
          <TableCell className="font-mono text-sm text-gray-500 py-3" data-testid={isFirstRoot ? "I4.QL.3.22" : undefined}>
            {isFirstRoot && <Marker id="I4.QL.3.22" />}
            {node.componentCategory || "-"}
          </TableCell>
          <TableCell className="text-gray-600 py-3" data-testid={isFirstRoot ? "I4.QL.3.23" : undefined}>
            {isFirstRoot && <Marker id="I4.QL.3.23" />}
            {node.makerName || "-"}
          </TableCell>
          <TableCell className="text-gray-600 py-3" data-testid={isFirstRoot ? "I4.QL.3.24" : undefined}>
            {isFirstRoot && <Marker id="I4.QL.3.24" />}
            {node.model || "-"}
          </TableCell>
          <TableCell className="text-right py-3">
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleAddNew(node.fleetEquipmentCode)}
                className="text-cyan-600"
                data-testid={isFirstRoot ? "I4.QL.3.25" : `button-add-child-${nodeKey}`}
                title="Add Child"
              >
                {isFirstRoot && <Marker id="I4.QL.3.25" />}
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEdit(node)}
                className="text-blue-600"
                data-testid={isFirstRoot ? "I4.QL.3.26" : `button-edit-${nodeKey}`}
                title="Edit"
              >
                {isFirstRoot && <Marker id="I4.QL.3.26" />}
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteClick(node)}
                className="text-red-500"
                data-testid={isFirstRoot ? "I4.QL.3.27" : `button-delete-${nodeKey}`}
                title="Delete"
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
    <div className="p-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-5">
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
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Fleet Components Management</h1>
              <p className="text-cyan-100 text-sm mt-0.5" data-testid="I4.QL.3.9"><Marker id="I4.QL.3.9" />Manage fleet-level equipment hierarchy (SFI structure)</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-semibold text-gray-800" data-testid="I4.QL.3.10"><Marker id="I4.QL.3.10" />All Fleet Components</h2>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-total-components">
                  <Package className="h-3 w-3 mr-1" />
                  {totalComponents} Total
                </Badge>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 no-default-hover-elevate no-default-active-elevate" data-testid="badge-root-components">
                  {rootComponents} Root
                </Badge>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 sm:min-w-[280px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by name, code, or SFI..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-gray-300"
                  data-testid="I4.QL.3.11"
                />
                <Marker id="I4.QL.3.11" />
              </div>
              <Button
                variant="outline"
                onClick={handleExport}
                className="border-gray-300 text-gray-700"
                data-testid="I4.QL.3.12"
              >
                <Marker id="I4.QL.3.12" />
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button
                onClick={() => handleAddNew()}
                className="bg-cyan-600 whitespace-nowrap"
                data-testid="I4.QL.3.13"
              >
                <Marker id="I4.QL.3.13" />
                <Plus className="mr-2 h-4 w-4" />
                Add New Component
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-5 w-16 bg-gray-200 animate-pulse rounded" />
                  <div className="h-5 flex-1 bg-gray-100 animate-pulse rounded" />
                  <div className="h-5 w-20 bg-gray-100 animate-pulse rounded" />
                  <div className="h-5 w-24 bg-gray-100 animate-pulse rounded" />
                  <div className="h-5 w-20 bg-gray-100 animate-pulse rounded" />
                  <div className="h-5 w-24 bg-gray-100 animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <Trash2 className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-red-700 font-medium">Failed to load components</p>
              <p className="text-red-500 text-sm mt-1">Please try refreshing the page</p>
            </div>
          ) : filteredComponents.length === 0 ? (
            <div className="text-center py-16">
              <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Package className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">
                {searchQuery ? "No components found matching your search" : "No components yet"}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {searchQuery ? "Try adjusting your search terms" : "Add your first component to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-200">
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.3.14"><Marker id="I4.QL.3.14" />Fleet Code</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.3.15"><Marker id="I4.QL.3.15" />Equipment Name</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.3.16"><Marker id="I4.QL.3.16" />Category</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.3.17"><Marker id="I4.QL.3.17" />Maker</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.3.18"><Marker id="I4.QL.3.18" />Model</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider py-3" data-testid="I4.QL.3.19"><Marker id="I4.QL.3.19" />Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treeData.map((node, index) => renderTreeNode(node, 0, index === 0))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>

      <FleetComponentForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        component={selectedComponent}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-component">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Delete Component</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Are you sure you want to delete "<span className="font-medium text-gray-800">{componentToDelete?.fleetEquipmentName}</span>"? This action cannot be undone and will also delete all child components.
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
