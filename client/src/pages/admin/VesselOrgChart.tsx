import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Switch } from "@/components/ui/switch";
import {
  Plus, Save, Loader2, ChevronUp, ChevronDown, ArrowLeft,
  Network, Star, X, Search, Users, Eye, GripVertical, Trash2,
  AlertTriangle, Pencil, Check, Crown, Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useVessels } from "@/hooks/useVessels";
import { useDepartmentOptions } from "@/hooks/useDepartments";
import { VISIBLE_UI_ROLES, UI_ROLE_LABELS } from "@shared/uiRoles";
import type { UIRole } from "@shared/uiRoles";
import { useLocation } from "wouter";

type NodeLayer = 'department' | 'overall-head' | 'supervisory';

interface RoleMasterOption {
  ruid: string;
  assignedRole: string;
  roletype: string;
  isActive: boolean;
  sortOrder: number | null;
}

interface OrgNode {
  nodeUuid: string;
  vesselId: string;
  rankId: string;
  nodeLabel: string;
  department: string | null;
  parentNodeUuid: string | null;
  isHod: boolean;
  isAssigned: boolean;
  viewMode: string | null;
  sortOrder: number;
  nodeLayer: NodeLayer;
  roleRuid: string | null;
  roleName?: string | null;
  roleType?: string | null;
  roleIsActive?: boolean | null;
  isNew?: boolean;
}

interface DeptConfig {
  department: string;
  isEnabled: boolean;
  sortOrder: number;
}

interface RankRow {
  id?: number;
  rankId: string;
  name: string;
  label: string;
  category: string;
  sortOrder: number;
  viewMode: string;
}

const DEPT_COLORS: Record<string, string> = {
  Deck: "bg-blue-500",
  Engine: "bg-green-600",
  Catering: "bg-amber-500",
  Electrical: "bg-purple-500",
  Radio: "bg-indigo-500",
};

const LAYER_COLORS: Record<NodeLayer, string> = {
  'overall-head': 'bg-rose-600',
  'supervisory': 'bg-slate-600',
  'department': 'bg-gray-400',
};

function getDeptColor(dept: string | null, layer?: NodeLayer): string {
  if (layer && layer !== 'department') return LAYER_COLORS[layer];
  if (!dept) return "bg-gray-400";
  return DEPT_COLORS[dept] || "bg-teal-500";
}

function generateNodeUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function VesselOrgChart() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: vessels = [], isLoading: isLoadingVessels } = useVessels();
  const { options: departmentOptions } = useDepartmentOptions();

  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [deptConfigs, setDeptConfigs] = useState<DeptConfig[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [rankSearch, setRankSearch] = useState("");
  const [activeDept, setActiveDept] = useState<string | null>(null);
  const [deleteConfirmNode, setDeleteConfirmNode] = useState<OrgNode | null>(null);
  const [editingLabelNodeUuid, setEditingLabelNodeUuid] = useState<string | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState("");
  const [draggedNodeUuid, setDraggedNodeUuid] = useState<string | null>(null);
  const [dragOverDept, setDragOverDept] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ nodeUuid: string; position: 'before' | 'after' | 'child' } | null>(null);

  const { data: savedRanks = [] } = useQuery<RankRow[]>({
    queryKey: ['/technical/api/admin/available-ranks'],
  });

  const { data: roleOptions = [] } = useQuery<RoleMasterOption[]>({
    queryKey: ['/technical/api/admin/role-master/active'],
  });

  const { data: savedNodes, isLoading: isLoadingNodes } = useQuery<OrgNode[]>({
    queryKey: ['/technical/api/admin/vessel-org-chart-nodes', selectedVesselId],
    queryFn: async () => {
      if (!selectedVesselId) return [];
      const res = await fetch(`/technical/api/admin/vessel-org-chart-nodes/${selectedVesselId}`);
      if (!res.ok) throw new Error("Failed to fetch nodes");
      return res.json();
    },
    enabled: !!selectedVesselId,
  });

  const { data: savedDeptConfigs } = useQuery<DeptConfig[]>({
    queryKey: ['/technical/api/admin/vessel-department-config', selectedVesselId],
    queryFn: async () => {
      if (!selectedVesselId) return [];
      const res = await fetch(`/technical/api/admin/vessel-department-config/${selectedVesselId}`);
      if (!res.ok) throw new Error("Failed to fetch dept config");
      return res.json();
    },
    enabled: !!selectedVesselId,
  });

  useEffect(() => {
    if (savedNodes && Array.isArray(savedNodes)) {
      setNodes(savedNodes.map(n => ({ ...n, nodeLayer: (n.nodeLayer || 'department') as NodeLayer })));
      setHasUnsavedChanges(false);
      const depts = new Set(savedNodes.filter(n => n.department && n.nodeLayer === 'department').map(n => n.department!));
      if (depts.size > 0 && !activeDept) {
        setActiveDept([...depts][0]);
      }
    }
  }, [savedNodes]);

  useEffect(() => {
    if (savedDeptConfigs && Array.isArray(savedDeptConfigs)) {
      setDeptConfigs(savedDeptConfigs.map(c => ({ department: c.department, isEnabled: c.isEnabled, sortOrder: c.sortOrder })));
    }
  }, [savedDeptConfigs]);

  const bulkSaveMutation = useMutation({
    mutationFn: async (payload: OrgNode[]) => {
      const response = await apiRequest('POST', `/technical/api/admin/vessel-org-chart-nodes/${selectedVesselId}/bulk-save`, {
        nodes: payload.map(n => ({
          nodeUuid: n.nodeUuid,
          rankId: n.rankId,
          nodeLabel: n.nodeLabel,
          department: n.department,
          parentNodeUuid: n.parentNodeUuid,
          isHod: n.isHod,
          isAssigned: n.isAssigned,
          viewMode: n.viewMode,
          sortOrder: n.sortOrder,
          nodeLayer: n.nodeLayer,
          roleRuid: n.roleRuid,
        })),
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Saved successfully", description: `${data.inserted || 0} created, ${data.updated || 0} updated` });
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/vessel-org-chart-nodes', selectedVesselId] });
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message || "Failed to save org chart", variant: "destructive" });
    },
  });

  const deptConfigMutation = useMutation({
    mutationFn: async (configs: DeptConfig[]) => {
      const response = await apiRequest('POST', `/technical/api/admin/vessel-department-config/${selectedVesselId}`, { configs });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/vessel-department-config', selectedVesselId] });
    },
  });

  const handleSave = () => {
    if (!selectedVesselId) return;
    const normalized = nodes.map(n => {
      if (n.isAssigned && !n.department && n.nodeLayer === 'department') {
        return { ...n, isAssigned: false, parentNodeUuid: null, isHod: false, sortOrder: 0 };
      }
      return n;
    });
    bulkSaveMutation.mutate(normalized);
    if (deptConfigs.length > 0) {
      deptConfigMutation.mutate(deptConfigs);
    }
  };

  const ranksMap = useMemo(() => {
    const map = new Map<string, RankRow>();
    savedRanks.forEach(r => map.set(r.rankId, r));
    return map;
  }, [savedRanks]);

  const getRankDisplay = useCallback((rankId: string, nodeLabel?: string | null) => {
    if (nodeLabel && nodeLabel.trim()) return nodeLabel;
    const rank = ranksMap.get(rankId);
    return rank ? (rank.label || rank.name) : rankId;
  }, [ranksMap]);

  const overallHeadNodes = useMemo(() => nodes.filter(n => n.nodeLayer === 'overall-head' && n.isAssigned).sort((a, b) => a.sortOrder - b.sortOrder), [nodes]);
  const supervisoryNodes = useMemo(() => nodes.filter(n => n.nodeLayer === 'supervisory' && n.isAssigned).sort((a, b) => a.sortOrder - b.sortOrder), [nodes]);
  const assignedNodes = useMemo(() => nodes.filter(n => n.isAssigned && n.department && n.nodeLayer === 'department'), [nodes]);
  const unassignedNodes = useMemo(() => nodes.filter(n => !n.isAssigned), [nodes]);

  const departments = useMemo(() => {
    const deptSet = new Set<string>();
    assignedNodes.forEach(n => { if (n.department) deptSet.add(n.department); });
    departmentOptions.forEach(d => deptSet.add(d.value));
    return [...deptSet].sort();
  }, [assignedNodes, departmentOptions]);

  const enabledDepartments = useMemo(() => {
    const configMap = new Map(deptConfigs.map(c => [c.department, c]));
    return departments.filter(d => {
      const cfg = configMap.get(d);
      return !cfg || cfg.isEnabled;
    });
  }, [departments, deptConfigs]);

  const nodesByDept = useMemo(() => {
    const map = new Map<string, OrgNode[]>();
    assignedNodes.forEach(n => {
      if (!n.department) return;
      const list = map.get(n.department) || [];
      list.push(n);
      map.set(n.department, list);
    });
    map.forEach((list) => list.sort((a, b) => a.sortOrder - b.sortOrder));
    return map;
  }, [assignedNodes]);

  const availableRanksForAdd = useMemo(() => {
    const filtered = savedRanks.filter(r => {
      if (rankSearch) {
        const q = rankSearch.toLowerCase();
        return (r.label || r.name).toLowerCase().includes(q) || r.rankId.toLowerCase().includes(q);
      }
      return true;
    });
    return filtered.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [savedRanks, rankSearch]);

  const createNodeInstance = (rankId: string, layer: NodeLayer = 'department') => {
    if (!selectedVesselId) return;
    const rank = ranksMap.get(rankId);
    const newNode: OrgNode = {
      nodeUuid: generateNodeUuid(),
      vesselId: selectedVesselId,
      rankId,
      nodeLabel: "",
      department: null,
      parentNodeUuid: null,
      isHod: false,
      isAssigned: layer !== 'department',
      viewMode: rank?.viewMode || null,
      sortOrder: 0,
      nodeLayer: layer,
      roleRuid: null,
      isNew: true,
    };
    setNodes(prev => [...prev, newNode]);
    setHasUnsavedChanges(true);
  };

  const assignNodeToDept = (nodeUuid: string, department: string) => {
    setNodes(prev => {
      const target = prev.find(n => n.nodeUuid === nodeUuid);
      const oldDept = target?.department;
      const deptNodes = prev.filter(x => x.department === department && x.isAssigned && x.nodeLayer === 'department');
      return prev.map(n => {
        if (n.nodeUuid === nodeUuid) {
          return {
            ...n,
            department,
            isAssigned: true,
            parentNodeUuid: null,
            isHod: false,
            sortOrder: deptNodes.length + 1,
            nodeLayer: 'department' as NodeLayer,
          };
        }
        if (oldDept && n.department === oldDept && n.parentNodeUuid === nodeUuid) {
          return { ...n, parentNodeUuid: null };
        }
        return n;
      });
    });
    if (!activeDept) setActiveDept(department);
    setHasUnsavedChanges(true);
  };

  const unassignNode = (nodeUuid: string) => {
    setNodes(prev => prev.map(n => {
      if (n.nodeUuid !== nodeUuid) return n;
      return { ...n, department: null, parentNodeUuid: null, isAssigned: false, isHod: false, sortOrder: 0, nodeLayer: 'department' as NodeLayer };
    }).map(n => {
      if (n.parentNodeUuid === nodeUuid) return { ...n, parentNodeUuid: null };
      return n;
    }));
    setHasUnsavedChanges(true);
  };

  const confirmDeleteNode = (node: OrgNode) => {
    setDeleteConfirmNode(node);
  };

  const executeDeleteNode = () => {
    if (!deleteConfirmNode) return;
    const nodeUuid = deleteConfirmNode.nodeUuid;
    setNodes(prev => prev.filter(n => n.nodeUuid !== nodeUuid).map(n => {
      if (n.parentNodeUuid === nodeUuid) return { ...n, parentNodeUuid: null };
      return n;
    }));
    setHasUnsavedChanges(true);
    setDeleteConfirmNode(null);
  };

  const startEditLabel = (node: OrgNode) => {
    setEditingLabelNodeUuid(node.nodeUuid);
    setEditingLabelValue(node.nodeLabel || "");
  };

  const commitEditLabel = () => {
    if (editingLabelNodeUuid) {
      updateNodeField(editingLabelNodeUuid, 'nodeLabel', editingLabelValue.trim() || "");
    }
    setEditingLabelNodeUuid(null);
    setEditingLabelValue("");
  };

  const cancelEditLabel = () => {
    setEditingLabelNodeUuid(null);
    setEditingLabelValue("");
  };

  const toggleHod = (nodeUuid: string, department: string) => {
    setNodes(prev => {
      const target = prev.find(n => n.nodeUuid === nodeUuid);
      if (!target) return prev;
      const willBeHod = !target.isHod;

      return prev.map(n => {
        if (n.department === department && n.nodeUuid !== nodeUuid && n.isHod) {
          return { ...n, isHod: false };
        }
        if (n.nodeUuid === nodeUuid) {
          if (willBeHod) {
            return { ...n, isHod: true, parentNodeUuid: null, sortOrder: 0 };
          }
          return { ...n, isHod: false };
        }
        if (willBeHod && n.department === department && n.parentNodeUuid === null && n.nodeUuid !== nodeUuid) {
          return { ...n, parentNodeUuid: nodeUuid };
        }
        return n;
      });
    });
    setHasUnsavedChanges(true);
  };

  const updateNodeField = (nodeUuid: string, field: keyof OrgNode, value: any) => {
    setNodes(prev => prev.map(n => n.nodeUuid === nodeUuid ? { ...n, [field]: value } : n));
    setHasUnsavedChanges(true);
  };

  const assignNodeToLayer = (nodeUuid: string, layer: NodeLayer) => {
    setNodes(prev => {
      const layerNodes = prev.filter(n => n.nodeLayer === layer && n.isAssigned);
      return prev.map(n => {
        if (n.nodeUuid !== nodeUuid) return n;
        return { ...n, nodeLayer: layer, isAssigned: true, department: null, parentNodeUuid: null, isHod: false, sortOrder: layerNodes.length + 1 };
      });
    });
    setHasUnsavedChanges(true);
  };

  const toggleDeptEnabled = (department: string) => {
    setDeptConfigs(prev => {
      const existing = prev.find(c => c.department === department);
      if (existing) {
        return prev.map(c => c.department === department ? { ...c, isEnabled: !c.isEnabled } : c);
      }
      return [...prev, { department, isEnabled: false, sortOrder: prev.length }];
    });
    setHasUnsavedChanges(true);
  };

  const isDeptEnabled = (department: string): boolean => {
    const cfg = deptConfigs.find(c => c.department === department);
    return !cfg || cfg.isEnabled;
  };

  const setParentNode = (nodeUuid: string, parentNodeUuid: string | null) => {
    setNodes(prev => {
      const target = prev.find(n => n.nodeUuid === nodeUuid);
      if (!target) return prev;
      if (parentNodeUuid !== null) {
        const parent = prev.find(n => n.nodeUuid === parentNodeUuid);
        if (!parent) return prev;
        const targetLayer = target.nodeLayer;
        const parentLayer = parent.nodeLayer;
        if (targetLayer === 'department' && parentLayer === 'department' && parent.department !== target.department) return prev;
        if (target.isHod && targetLayer === 'department' && parentLayer === 'department') return prev;
      }
      return prev.map(n => n.nodeUuid === nodeUuid ? { ...n, parentNodeUuid } : n);
    });
    setHasUnsavedChanges(true);
  };

  const moveNode = (nodeUuid: string, direction: 'up' | 'down') => {
    setNodes(prev => {
      const node = prev.find(n => n.nodeUuid === nodeUuid);
      if (!node || !node.department) return prev;
      const siblings = prev
        .filter(n => n.department === node.department && n.parentNodeUuid === node.parentNodeUuid)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = siblings.findIndex(s => s.nodeUuid === nodeUuid);
      if (direction === 'up' && idx <= 0) return prev;
      if (direction === 'down' && idx >= siblings.length - 1) return prev;

      const reordered = [...siblings];
      const [moved] = reordered.splice(idx, 1);
      reordered.splice(direction === 'up' ? idx - 1 : idx + 1, 0, moved);

      const sortMap = new Map<string, number>();
      reordered.forEach((s, i) => sortMap.set(s.nodeUuid, i + 1));
      return prev.map(n => {
        const newSort = sortMap.get(n.nodeUuid);
        return newSort !== undefined ? { ...n, sortOrder: newSort } : n;
      });
    });
    setHasUnsavedChanges(true);
  };

  const dropNodeAtPosition = (droppedUuid: string, targetUuid: string, position: 'before' | 'after' | 'child', deptNodes: OrgNode[]) => {
    const droppedDescendants = getDescendants(droppedUuid, deptNodes);
    if (droppedDescendants.has(targetUuid)) return;

    setNodes(prev => {
      const dropped = prev.find(n => n.nodeUuid === droppedUuid);
      const target = prev.find(n => n.nodeUuid === targetUuid);
      if (!dropped || !target) return prev;
      if (dropped.isHod && position === 'child') return prev;

      if (position === 'child') {
        if (dropped.nodeLayer === 'department' && target.nodeLayer === 'department' && target.department !== dropped.department) return prev;
        const childrenOfTarget = prev
          .filter(n => n.parentNodeUuid === targetUuid)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const newSort = childrenOfTarget.length + 1;
        return prev.map(n => n.nodeUuid === droppedUuid
          ? { ...n, parentNodeUuid: targetUuid, sortOrder: newSort }
          : n
        );
      }

      if (dropped.nodeLayer === 'department' && target.nodeLayer === 'department' && target.department !== dropped.department) return prev;
      const newParent = target.parentNodeUuid;
      const siblings = prev
        .filter(n => n.department === target.department && n.parentNodeUuid === newParent && n.nodeUuid !== droppedUuid)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const targetIdx = siblings.findIndex(s => s.nodeUuid === targetUuid);
      const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
      const reordered = [...siblings];
      reordered.splice(insertIdx, 0, dropped);

      const sortMap = new Map<string, number>();
      reordered.forEach((s, i) => sortMap.set(s.nodeUuid, i + 1));
      sortMap.set(droppedUuid, insertIdx + 1);

      return prev.map(n => {
        if (n.nodeUuid === droppedUuid) {
          return { ...n, parentNodeUuid: newParent, sortOrder: sortMap.get(droppedUuid)! };
        }
        const newSort = sortMap.get(n.nodeUuid);
        return newSort !== undefined ? { ...n, sortOrder: newSort } : n;
      });
    });
    setHasUnsavedChanges(true);
  };

  interface TreeNode {
    node: OrgNode;
    children: TreeNode[];
  }

  const buildTree = useCallback((deptNodes: OrgNode[]): TreeNode[] => {
    const nodeMap = new Map<string, TreeNode>();
    deptNodes.forEach(n => nodeMap.set(n.nodeUuid, { node: n, children: [] }));
    const roots: TreeNode[] = [];
    deptNodes.forEach(n => {
      const treeNode = nodeMap.get(n.nodeUuid)!;
      if (n.parentNodeUuid && nodeMap.has(n.parentNodeUuid)) {
        nodeMap.get(n.parentNodeUuid)!.children.push(treeNode);
      } else {
        roots.push(treeNode);
      }
    });
    const sortFn = (arr: TreeNode[]) => {
      arr.sort((a, b) => {
        if (a.node.isHod !== b.node.isHod) return a.node.isHod ? -1 : 1;
        return a.node.sortOrder - b.node.sortOrder;
      });
      arr.forEach(t => sortFn(t.children));
    };
    sortFn(roots);
    return roots;
  }, []);

  const renderPreviewNode = (treeNode: TreeNode, depth: number): JSX.Element => {
    const { node } = treeNode;
    const label = getRankDisplay(node.rankId, node.nodeLabel);
    const color = getDeptColor(node.department, node.nodeLayer);
    const indent = depth * 28;

    return (
      <div key={node.nodeUuid} data-testid={`preview-node-${node.nodeUuid}`}>
        <div className="flex items-center py-1" style={{ paddingLeft: indent }}>
          {depth > 0 && (
            <span className="text-gray-300 mr-1">└</span>
          )}
          <span
            className={cn("inline-block px-3 py-1 rounded text-white text-xs font-medium whitespace-nowrap", color)}
          >
            {label}
          </span>
          {node.isHod && (
            <Star className="h-3 w-3 ml-1 text-yellow-500 fill-yellow-500" />
          )}
          {node.viewMode && (
            <span className="ml-1 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              {UI_ROLE_LABELS[node.viewMode as UIRole] || node.viewMode}
            </span>
          )}
          {node.roleRuid && (() => {
            const role = roleOptions.find(r => r.ruid === node.roleRuid);
            return role ? (
              <span className="ml-1 text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded" data-testid={`preview-role-${node.nodeUuid}`}>
                {role.assignedRole}
              </span>
            ) : (
              <span className="ml-1 text-[10px] text-orange-400 bg-orange-50 px-1.5 py-0.5 rounded" data-testid={`preview-role-inactive-${node.nodeUuid}`}>
                Inactive Role
              </span>
            );
          })()}
        </div>
        {treeNode.children.map(child => renderPreviewNode(child, depth + 1))}
      </div>
    );
  };

  const getDescendants = useCallback((nodeUuid: string, allNodes: OrgNode[]): Set<string> => {
    const result = new Set<string>();
    const collect = (parentId: string) => {
      allNodes.forEach(n => {
        if (n.parentNodeUuid === parentId && !result.has(n.nodeUuid)) {
          result.add(n.nodeUuid);
          collect(n.nodeUuid);
        }
      });
    };
    collect(nodeUuid);
    return result;
  }, []);

  const renderArea1 = () => (
    <div className="flex flex-col h-full min-h-0 border-r" data-testid="area-unassigned">
      <div className="flex-shrink-0 p-3 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
          <Users className="h-4 w-4" /> Available Ranks
        </h3>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search ranks..."
            value={rankSearch}
            onChange={(e) => setRankSearch(e.target.value)}
            className="pl-7 h-8 text-xs"
            data-testid="input-search-available-ranks"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar">
        {unassignedNodes.length > 0 && (
          <div className="p-2">
            <h4 className="text-[11px] uppercase text-gray-400 font-semibold mb-1 px-1">Unassigned Instances</h4>
            {unassignedNodes.map(node => (
              <div
                key={node.nodeUuid}
                draggable
                onDragStart={(e) => {
                  setDraggedNodeUuid(node.nodeUuid);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', node.nodeUuid);
                }}
                onDragEnd={() => { setDraggedNodeUuid(null); setDragOverDept(null); }}
                className={cn(
                  "flex items-center justify-between p-2 mb-1 bg-white rounded border hover:border-blue-300 transition-colors group cursor-grab active:cursor-grabbing",
                  draggedNodeUuid === node.nodeUuid && "opacity-50"
                )}
                data-testid={`unassigned-node-${node.nodeUuid}`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <GripVertical className="h-3 w-3 text-gray-300 flex-shrink-0" />
                  <span className="text-xs font-medium truncate">{getRankDisplay(node.rankId, node.nodeLabel)}</span>
                  <span className="text-[10px] text-gray-400">({node.rankId})</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Select onValueChange={(val) => {
                    if (val === '__overall-head__') assignNodeToLayer(node.nodeUuid, 'overall-head');
                    else if (val === '__supervisory__') assignNodeToLayer(node.nodeUuid, 'supervisory');
                    else assignNodeToDept(node.nodeUuid, val);
                  }}>
                    <SelectTrigger className="h-6 w-[100px] text-[10px]" data-testid={`assign-dept-${node.nodeUuid}`}>
                      <SelectValue placeholder="Assign..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__overall-head__">Overall Head</SelectItem>
                      <SelectItem value="__supervisory__">Supervisory</SelectItem>
                      {enabledDepartments.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => confirmDeleteNode(node)}
                    className="text-red-400 hover:text-red-600 p-0.5"
                    data-testid={`delete-node-${node.nodeUuid}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="p-2">
          <h4 className="text-[11px] uppercase text-gray-400 font-semibold mb-1 px-1">Add New Instance</h4>
          {availableRanksForAdd.map(rank => (
            <div
              key={rank.rankId}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('application/rank-id', rank.rankId);
              }}
              className="flex items-center justify-between p-1.5 mb-0.5 hover:bg-blue-50 rounded cursor-grab active:cursor-grabbing transition-colors group"
              data-testid={`rank-catalog-${rank.rankId}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs truncate">{rank.label || rank.name}</span>
                <span className="text-[10px] text-gray-400">{rank.rankId}</span>
                {rank.category && (
                  <span className="text-[9px] text-gray-300 bg-gray-50 px-1 rounded">{rank.category}</span>
                )}
              </div>
              <button
                onClick={() => createNodeInstance(rank.rankId)}
                className="text-blue-400 hover:text-blue-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`add-rank-${rank.rankId}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {availableRanksForAdd.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">No ranks found</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderDeptNode = (treeNode: TreeNode, depth: number, deptNodes: OrgNode[]): JSX.Element => {
    const { node } = treeNode;
    const label = getRankDisplay(node.rankId, node.nodeLabel);
    const indent = depth * 24;
    const isEditingLabel = editingLabelNodeUuid === node.nodeUuid;
    const descendants = getDescendants(node.nodeUuid, deptNodes);
    const sameDeptParents = deptNodes.filter(
      n => n.nodeUuid !== node.nodeUuid && !descendants.has(n.nodeUuid)
    );
    const crossLayerParents = overallHeadNodes.filter(n => n.nodeUuid !== node.nodeUuid);
    const possibleParents = [...crossLayerParents, ...sameDeptParents];

    return (
      <div key={node.nodeUuid} data-testid={`dept-node-${node.nodeUuid}`}>
        <div
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            setDraggedNodeUuid(node.nodeUuid);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', node.nodeUuid);
          }}
          onDragEnd={() => { setDraggedNodeUuid(null); setDragOverDept(null); setDropTarget(null); }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            const rect = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const third = rect.height / 3;
            let position: 'before' | 'child' | 'after' = 'child';
            if (y < third) position = 'before';
            else if (y > third * 2) position = 'after';
            setDropTarget({ nodeUuid: node.nodeUuid, position });
          }}
          onDragLeave={() => { if (dropTarget?.nodeUuid === node.nodeUuid) setDropTarget(null); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const droppedUuid = e.dataTransfer.getData('text/plain');
            if (droppedUuid && droppedUuid !== node.nodeUuid && dropTarget) {
              dropNodeAtPosition(droppedUuid, node.nodeUuid, dropTarget.position, deptNodes);
            }
            setDraggedNodeUuid(null);
            setDropTarget(null);
          }}
          className={cn(
            "flex items-center py-1.5 px-2 hover:bg-gray-50 rounded transition-colors group cursor-grab active:cursor-grabbing relative",
            draggedNodeUuid === node.nodeUuid && "opacity-50 bg-blue-50",
            dropTarget?.nodeUuid === node.nodeUuid && dropTarget.position === 'child' && "bg-blue-50 ring-1 ring-blue-300",
            dropTarget?.nodeUuid === node.nodeUuid && dropTarget.position === 'before' && "border-t-2 border-blue-400",
            dropTarget?.nodeUuid === node.nodeUuid && dropTarget.position === 'after' && "border-b-2 border-blue-400"
          )}
          style={{ paddingLeft: indent + 8 }}
        >
          <div className="flex items-center gap-1 mr-1 flex-shrink-0">
            <button onClick={() => moveNode(node.nodeUuid, 'up')} className="text-gray-300 hover:text-gray-600 p-0" data-testid={`move-up-${node.nodeUuid}`}>
              <ChevronUp className="h-3 w-3" />
            </button>
            <button onClick={() => moveNode(node.nodeUuid, 'down')} className="text-gray-300 hover:text-gray-600 p-0" data-testid={`move-down-${node.nodeUuid}`}>
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          {isEditingLabel ? (
            <div className="flex items-center gap-1">
              <Input
                value={editingLabelValue}
                onChange={(e) => setEditingLabelValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEditLabel();
                  if (e.key === 'Escape') cancelEditLabel();
                }}
                className="h-6 w-[140px] text-xs px-2"
                autoFocus
                data-testid={`input-label-${node.nodeUuid}`}
              />
              <button onClick={commitEditLabel} className="text-green-500 hover:text-green-700 p-0.5" data-testid={`save-label-${node.nodeUuid}`}>
                <Check className="h-3 w-3" />
              </button>
              <button onClick={cancelEditLabel} className="text-gray-400 hover:text-gray-600 p-0.5" data-testid={`cancel-label-${node.nodeUuid}`}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className={cn("inline-block px-2.5 py-0.5 rounded text-white text-xs font-medium whitespace-nowrap", getDeptColor(node.department, node.nodeLayer))}>
                {label}
              </span>
              <button
                onClick={() => startEditLabel(node)}
                className="text-gray-300 hover:text-blue-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Edit label"
                data-testid={`edit-label-${node.nodeUuid}`}
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}

          <button
            onClick={() => node.department && toggleHod(node.nodeUuid, node.department)}
            className={cn("ml-1.5 p-0.5 rounded transition-colors", node.isHod ? "text-yellow-500" : "text-gray-300 hover:text-yellow-400")}
            title={node.isHod ? "Head of Department" : "Set as HOD"}
            data-testid={`toggle-hod-${node.nodeUuid}`}
          >
            <Star className={cn("h-3.5 w-3.5", node.isHod && "fill-yellow-500")} />
          </button>

          <Select
            value={node.parentNodeUuid || "__none__"}
            onValueChange={(v) => setParentNode(node.nodeUuid, v === "__none__" ? null : v)}
          >
            <SelectTrigger className="h-6 w-[120px] ml-1.5 text-[10px]" data-testid={`parent-select-${node.nodeUuid}`}>
              <SelectValue placeholder="Root" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Root</SelectItem>
              {possibleParents.map(p => (
                <SelectItem key={p.nodeUuid} value={p.nodeUuid}>
                  {getRankDisplay(p.rankId, p.nodeLabel)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={node.viewMode || "__none__"}
            onValueChange={(v) => updateNodeField(node.nodeUuid, 'viewMode', v === "__none__" ? null : v)}
          >
            <SelectTrigger className="h-6 w-[100px] ml-1 text-[10px]" data-testid={`viewmode-select-${node.nodeUuid}`}>
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {VISIBLE_UI_ROLES.map(role => (
                <SelectItem key={role} value={role}>{UI_ROLE_LABELS[role]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={node.roleRuid || "__none__"}
            onValueChange={(v) => updateNodeField(node.nodeUuid, 'roleRuid', v === "__none__" ? null : v)}
          >
            <SelectTrigger className="h-6 w-[110px] ml-1 text-[10px]" data-testid={`role-binding-select-${node.nodeUuid}`}>
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No Role</SelectItem>
              {node.roleRuid && !roleOptions.find(r => r.ruid === node.roleRuid) && (
                <SelectItem value={node.roleRuid} disabled>{node.roleName || 'Inactive Role'} (Inactive)</SelectItem>
              )}
              {roleOptions.map(r => (
                <SelectItem key={r.ruid} value={r.ruid}>{r.assignedRole} — {r.roletype}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            onClick={() => unassignNode(node.nodeUuid)}
            className="ml-auto text-gray-300 hover:text-red-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Unassign from department"
            data-testid={`unassign-${node.nodeUuid}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {treeNode.children.map(child => renderDeptNode(child, depth + 1, deptNodes))}
      </div>
    );
  };

  const getLayerParentOptions = useCallback((node: OrgNode): OrgNode[] => {
    if (node.nodeLayer === 'overall-head') {
      return nodes.filter(n => n.nodeLayer === 'supervisory' && n.isAssigned && n.nodeUuid !== node.nodeUuid);
    }
    if (node.nodeLayer === 'supervisory') {
      return [];
    }
    return [];
  }, [nodes]);

  const renderLayerNode = (node: OrgNode, layer: NodeLayer) => {
    const label = getRankDisplay(node.rankId, node.nodeLabel);
    const isEditingLabel = editingLabelNodeUuid === node.nodeUuid;
    const parentOptions = getLayerParentOptions(node);

    return (
      <div key={node.nodeUuid} className="flex items-center py-1.5 px-2 hover:bg-gray-50 rounded transition-colors group" data-testid={`layer-node-${node.nodeUuid}`}>
        {isEditingLabel ? (
          <div className="flex items-center gap-1">
            <Input
              value={editingLabelValue}
              onChange={(e) => setEditingLabelValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEditLabel();
                if (e.key === 'Escape') cancelEditLabel();
              }}
              className="h-6 w-[140px] text-xs px-2"
              autoFocus
              data-testid={`input-label-${node.nodeUuid}`}
            />
            <button onClick={commitEditLabel} className="text-green-500 hover:text-green-700 p-0.5" data-testid={`save-label-${node.nodeUuid}`}>
              <Check className="h-3 w-3" />
            </button>
            <button onClick={cancelEditLabel} className="text-gray-400 hover:text-gray-600 p-0.5" data-testid={`cancel-label-${node.nodeUuid}`}>
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className={cn("inline-block px-2.5 py-0.5 rounded text-white text-xs font-medium whitespace-nowrap", LAYER_COLORS[layer])}>
              {label}
            </span>
            <button
              onClick={() => startEditLabel(node)}
              className="text-gray-300 hover:text-blue-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit label"
              data-testid={`edit-label-${node.nodeUuid}`}
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}

        {parentOptions.length > 0 && (
          <Select
            value={node.parentNodeUuid || "__none__"}
            onValueChange={(v) => setParentNode(node.nodeUuid, v === "__none__" ? null : v)}
          >
            <SelectTrigger className="h-6 w-[120px] ml-1.5 text-[10px]" data-testid={`parent-select-${node.nodeUuid}`}>
              <SelectValue placeholder="Root" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Root</SelectItem>
              {parentOptions.map(p => (
                <SelectItem key={p.nodeUuid} value={p.nodeUuid}>
                  {getRankDisplay(p.rankId, p.nodeLabel)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={node.viewMode || "__none__"}
          onValueChange={(v) => updateNodeField(node.nodeUuid, 'viewMode', v === "__none__" ? null : v)}
        >
          <SelectTrigger className="h-6 w-[100px] ml-1 text-[10px]" data-testid={`viewmode-select-${node.nodeUuid}`}>
            <SelectValue placeholder="View" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {VISIBLE_UI_ROLES.map(role => (
              <SelectItem key={role} value={role}>{UI_ROLE_LABELS[role]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={node.roleRuid || "__none__"}
          onValueChange={(v) => updateNodeField(node.nodeUuid, 'roleRuid', v === "__none__" ? null : v)}
        >
          <SelectTrigger className="h-6 w-[110px] ml-1 text-[10px]" data-testid={`role-binding-select-${node.nodeUuid}`}>
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No Role</SelectItem>
            {node.roleRuid && !roleOptions.find(r => r.ruid === node.roleRuid) && (
              <SelectItem value={node.roleRuid} disabled>{node.roleName || 'Inactive Role'} (Inactive)</SelectItem>
            )}
            {roleOptions.map(r => (
              <SelectItem key={r.ruid} value={r.ruid}>{r.assignedRole} — {r.roletype}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          onClick={() => unassignNode(node.nodeUuid)}
          className="ml-auto text-gray-300 hover:text-red-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Unassign"
          data-testid={`unassign-${node.nodeUuid}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const handleLayerDrop = (e: React.DragEvent, layer: NodeLayer) => {
    e.preventDefault();
    const nodeUuid = e.dataTransfer.getData('text/plain');
    const rankId = e.dataTransfer.getData('application/rank-id');
    if (nodeUuid) {
      assignNodeToLayer(nodeUuid, layer);
    } else if (rankId && selectedVesselId) {
      createNodeInstance(rankId, layer);
    }
    setDraggedNodeUuid(null);
    setDragOverDept(null);
  };

  const renderArea2 = () => (
    <div className="flex flex-col h-full min-h-0 border-r" data-testid="area-departments">
      <div className="flex-shrink-0 p-3 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
          <Network className="h-4 w-4" /> Hierarchy Builder
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar p-2 space-y-2">
        <div
          className={cn("border rounded-lg border-rose-200", dragOverDept === '__overall-head__' && "ring-2 ring-rose-400 bg-rose-50")}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverDept('__overall-head__'); }}
          onDragLeave={() => { if (dragOverDept === '__overall-head__') setDragOverDept(null); }}
          onDrop={(e) => handleLayerDrop(e, 'overall-head')}
          data-testid="overall-head-section"
        >
          <div className="flex items-center justify-between px-3 py-2 bg-rose-50 rounded-t-lg">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
              <Crown className="h-3.5 w-3.5" />
              Overall Head
              {overallHeadNodes.length > 0 && <span className="text-[10px] font-normal text-rose-400">({overallHeadNodes.length})</span>}
            </span>
          </div>
          <div className="px-2 pb-2 pt-1">
            {overallHeadNodes.length === 0 ? (
              <div className="text-center py-3 text-gray-400 text-xs" data-testid="text-overall-head-empty">
                No overall head assigned. Drag ranks here or use the assign menu.
              </div>
            ) : (
              overallHeadNodes.map(n => renderLayerNode(n, 'overall-head'))
            )}
          </div>
        </div>

        <div
          className={cn("border rounded-lg border-slate-200", dragOverDept === '__supervisory__' && "ring-2 ring-slate-400 bg-slate-50")}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverDept('__supervisory__'); }}
          onDragLeave={() => { if (dragOverDept === '__supervisory__') setDragOverDept(null); }}
          onDrop={(e) => handleLayerDrop(e, 'supervisory')}
          data-testid="supervisory-section"
        >
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-t-lg">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Building2 className="h-3.5 w-3.5" />
              Supervisory / Shore
              {supervisoryNodes.length > 0 && <span className="text-[10px] font-normal text-slate-400">({supervisoryNodes.length})</span>}
            </span>
          </div>
          <div className="px-2 pb-2 pt-1">
            {supervisoryNodes.length === 0 ? (
              <div className="text-center py-3 text-gray-400 text-xs" data-testid="text-supervisory-empty">
                No supervisory roles assigned. Drag ranks here or use the assign menu.
              </div>
            ) : (
              supervisoryNodes.map(n => renderLayerNode(n, 'supervisory'))
            )}
          </div>
        </div>

        {departments.map(dept => {
          const enabled = isDeptEnabled(dept);
          const deptNodes = nodesByDept.get(dept) || [];
          const count = deptNodes.length;
          const isExpanded = activeDept === dept;
          const isDragOver = dragOverDept === dept;
          const tree = count > 0 ? buildTree(deptNodes) : [];
          const hasHod = deptNodes.some(n => n.isHod);

          return (
            <div
              key={dept}
              className={cn(
                "border rounded-lg transition-colors",
                !enabled && "opacity-50",
                isDragOver && enabled && "ring-2 ring-blue-400 border-blue-400 bg-blue-50",
                !isDragOver && "border-gray-200"
              )}
              onDragOver={(e) => { if (!enabled) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverDept(dept); }}
              onDragLeave={() => setDragOverDept(null)}
              onDrop={(e) => {
                if (!enabled) return;
                e.preventDefault();
                const nodeUuid = e.dataTransfer.getData('text/plain');
                const rankId = e.dataTransfer.getData('application/rank-id');
                if (nodeUuid) {
                  assignNodeToDept(nodeUuid, dept);
                  setActiveDept(dept);
                } else if (rankId && selectedVesselId) {
                  const rank = ranksMap.get(rankId);
                  const newNode: OrgNode = {
                    nodeUuid: generateNodeUuid(),
                    vesselId: selectedVesselId,
                    rankId,
                    nodeLabel: "",
                    department: dept,
                    parentNodeUuid: null,
                    isHod: false,
                    isAssigned: true,
                    viewMode: rank?.viewMode || null,
                    sortOrder: count + 1,
                    nodeLayer: 'department' as NodeLayer,
                    roleRuid: null,
                    isNew: true,
                  };
                  setNodes(prev => [...prev, newNode]);
                  setHasUnsavedChanges(true);
                  setActiveDept(dept);
                }
                setDraggedNodeUuid(null);
                setDragOverDept(null);
              }}
              data-testid={`dept-block-${dept}`}
            >
              <div
                className={cn(
                  "flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors",
                  isExpanded ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-600"
                )}
              >
                <button
                  onClick={() => enabled && setActiveDept(isExpanded ? null : dept)}
                  className="flex items-center gap-1.5 flex-1 text-left"
                  disabled={!enabled}
                  data-testid={`dept-tab-${dept}`}
                >
                  <Users className="h-3.5 w-3.5" />
                  {dept}
                  {count > 0 && <span className="text-[10px] font-normal text-gray-400">({count})</span>}
                  {!hasHod && count > 0 && enabled && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                  {isExpanded && enabled ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                <Switch
                  checked={enabled}
                  onCheckedChange={() => toggleDeptEnabled(dept)}
                  className="scale-75"
                  data-testid={`switch-dept-${dept}`}
                />
              </div>

              {isExpanded && enabled && (
                <div className="px-2 pb-2 pt-1">
                  {count === 0 ? (
                    <div className="text-center py-4 text-gray-400 text-xs" data-testid="text-dept-empty">
                      No ranks assigned. Drag ranks here from the left panel.
                    </div>
                  ) : (
                    <>
                      {!hasHod && (
                        <div className="flex items-center gap-1.5 px-2 py-1.5 mb-2 bg-amber-50 border border-amber-200 rounded text-amber-700 text-xs" data-testid={`no-hod-warning-${dept}`}>
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>No HOD assigned. Click the star icon on a rank to set Head of Department.</span>
                        </div>
                      )}
                      {tree.map(rootNode => renderDeptNode(rootNode, 0, deptNodes))}
                      {draggedNodeUuid && (
                        <div
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const droppedUuid = e.dataTransfer.getData('text/plain');
                            if (droppedUuid) {
                              setParentNode(droppedUuid, null);
                            }
                            setDraggedNodeUuid(null);
                          }}
                          className="mt-2 p-2 border-2 border-dashed border-gray-300 rounded text-center text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                          data-testid="drop-zone-root"
                        >
                          Drop here to make root level
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const buildUnifiedTree = useCallback((allNodes: OrgNode[]): TreeNode[] => {
    const nodeMap = new Map<string, TreeNode>();
    allNodes.forEach(n => nodeMap.set(n.nodeUuid, { node: n, children: [] }));
    const roots: TreeNode[] = [];
    allNodes.forEach(n => {
      const treeNode = nodeMap.get(n.nodeUuid)!;
      if (n.parentNodeUuid && nodeMap.has(n.parentNodeUuid)) {
        nodeMap.get(n.parentNodeUuid)!.children.push(treeNode);
      } else {
        roots.push(treeNode);
      }
    });
    const layerOrder: Record<string, number> = { 'supervisory': 0, 'overall-head': 1, 'department': 2 };
    const sortFn = (arr: TreeNode[]) => {
      arr.sort((a, b) => {
        const la = layerOrder[a.node.nodeLayer] ?? 2;
        const lb = layerOrder[b.node.nodeLayer] ?? 2;
        if (la !== lb) return la - lb;
        if (a.node.isHod !== b.node.isHod) return a.node.isHod ? -1 : 1;
        return a.node.sortOrder - b.node.sortOrder;
      });
      arr.forEach(t => sortFn(t.children));
    };
    sortFn(roots);
    return roots;
  }, []);

  const renderArea3 = () => {
    const allAssigned = [...supervisoryNodes, ...overallHeadNodes, ...assignedNodes];
    const enabledDeptSet = new Set(enabledDepartments);
    const filteredAssigned = allAssigned.filter(n => {
      if (n.nodeLayer !== 'department') return true;
      return n.department && enabledDeptSet.has(n.department);
    });
    const unifiedTree = buildUnifiedTree(filteredAssigned);

    return (
      <div className="flex flex-col h-full min-h-0" data-testid="area-preview">
        <div className="flex-shrink-0 p-3 border-b bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
            <Eye className="h-4 w-4" /> Live Preview
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto thin-scrollbar p-3">
          {filteredAssigned.length > 0 ? (
            unifiedTree.map(rootNode => renderPreviewNode(rootNode, 0))
          ) : (
            <div className="text-center py-8 text-gray-400 text-xs" data-testid="text-preview-empty">
              No assigned ranks yet. Create and assign ranks to departments to see the hierarchy preview.
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoadingVessels) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }} data-testid="vessel-org-chart-page">
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/admin/ranks")}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              data-testid="button-back-to-ranks"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold text-gray-800" data-testid="text-vessel-org-chart-title">
              Vessel Org Chart
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedVesselId || "__none__"} onValueChange={(v) => setSelectedVesselId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="w-[220px]" data-testid="select-vessel">
                <SelectValue placeholder="Select Vessel..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select Vessel...</SelectItem>
                {vessels.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              className="gap-2"
              onClick={handleSave}
              disabled={bulkSaveMutation.isPending || !selectedVesselId || !hasUnsavedChanges}
              data-testid="button-save-org-chart"
            >
              {bulkSaveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        </div>
      </div>

      {!selectedVesselId ? (
        <div className="flex-1 flex items-center justify-center text-gray-400" data-testid="text-select-vessel-prompt">
          <div className="text-center">
            <Network className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Select a vessel to manage its org chart</p>
          </div>
        </div>
      ) : isLoadingNodes ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-[280px_1fr_280px] gap-0 border rounded-lg overflow-hidden bg-white" data-testid="org-chart-panels">
          {renderArea1()}
          {renderArea2()}
          {renderArea3()}
        </div>
      )}

      <AlertDialog open={!!deleteConfirmNode} onOpenChange={(open) => { if (!open) setDeleteConfirmNode(null); }}>
        <AlertDialogContent data-testid="dialog-confirm-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this node?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteConfirmNode ? getRankDisplay(deleteConfirmNode.rankId, deleteConfirmNode.nodeLabel) : ''}</strong> ({deleteConfirmNode?.rankId}) from this vessel's org chart. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDeleteNode}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
