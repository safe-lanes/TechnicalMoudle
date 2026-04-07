import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Trash2, Search, Save, Loader2, ChevronUp, ChevronDown, X, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RankRow {
  id?: number;
  rankId: string;
  name: string;
  label: string;
  category: string;
  applicableToCompany: boolean;
  isSystemRank: boolean;
  sortOrder: number;
  isNew?: boolean;
}

interface OrgChartRow {
  id?: number;
  rank: string;
  rankId: string;
  parentRankId: string | null;
  sortOrder: number;
  isNew?: boolean;
}

const RANK_CATEGORIES = [
  "Senior Officers",
  "Junior Officers",
  "Ratings",
  "Catering",
  "Other",
];

export default function RanksAdmin() {
  const { toast } = useToast();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isOrgChartModalOpen, setIsOrgChartModalOpen] = useState(false);
  const [isOrgChartEditMode, setIsOrgChartEditMode] = useState(false);
  const [hasSavedInSession, setHasSavedInSession] = useState<Record<string, boolean>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [ranksData, setRanksData] = useState<RankRow[]>([]);
  const [orgChartData, setOrgChartData] = useState<OrgChartRow[]>([]);
  const [deletedRankIds, setDeletedRankIds] = useState<string[]>([]);
  const [deletedOrgChartIds, setDeletedOrgChartIds] = useState<number[]>([]);

  const { data: savedRanks } = useQuery<any[]>({
    queryKey: ['/technical/api/admin/available-ranks'],
  });

  const { data: savedOrgChart } = useQuery<any[]>({
    queryKey: ['/technical/api/admin/vessel-org-chart'],
  });

  useEffect(() => {
    if (savedRanks && Array.isArray(savedRanks)) {
      if (savedRanks.length > 0) {
        const mapped: RankRow[] = savedRanks.map((r: any) => ({
          id: r.id,
          rankId: r.rankId || r.rank_id,
          name: r.name,
          label: r.label || "",
          category: r.category || "",
          applicableToCompany: r.applicableToCompany ?? r.applicable_to_company ?? true,
          isSystemRank: r.isSystemRank ?? r.is_system_rank ?? true,
          sortOrder: r.sortOrder ?? r.sort_order ?? 0,
        }));
        setRanksData(mapped);
      } else {
        setRanksData([]);
      }
    }
  }, [savedRanks]);

  useEffect(() => {
    if (savedOrgChart && Array.isArray(savedOrgChart)) {
      if (savedOrgChart.length > 0) {
        const mapped: OrgChartRow[] = savedOrgChart.map((o: any) => ({
          id: o.id,
          rank: o.rank || "",
          rankId: o.rankId || o.rank_id,
          parentRankId: o.parentRankId || o.parent_rank_id || null,
          sortOrder: o.sortOrder ?? o.sort_order ?? 0,
        }));
        setOrgChartData(mapped);
      } else {
        setOrgChartData([]);
      }
    }
  }, [savedOrgChart]);

  const saveRanksMutation = useMutation({
    mutationFn: async (payload: { ranks: RankRow[]; deletedIds: string[] }) => {
      for (const rankId of payload.deletedIds) {
        await apiRequest('DELETE', `/technical/api/admin/available-ranks/${rankId}`);
      }
      const response = await apiRequest('POST', '/technical/api/admin/available-ranks', { ranks: payload.ranks });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Saved successfully", description: `${data.inserted || 0} new ranks added, ${data.updated || 0} updated` });
      setHasUnsavedChanges(false);
      setHasSavedInSession(prev => ({ ...prev, ranks: true }));
      setDeletedRankIds([]);
      setRanksData([]);
      queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/available-ranks'] });
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message || "Failed to save ranks", variant: "destructive" });
    },
  });

  const saveOrgChartMutation = useMutation({
    mutationFn: async (payload: { entries: OrgChartRow[]; deletedIds: number[] }) => {
      for (const id of payload.deletedIds) {
        await apiRequest('DELETE', `/technical/api/admin/vessel-org-chart/${id}`);
      }
      const response = await apiRequest('POST', '/technical/api/admin/vessel-org-chart', { entries: payload.entries });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Saved successfully", description: `${data.inserted || 0} new entries added, ${data.updated || 0} updated` });
      setHasUnsavedChanges(false);
      setHasSavedInSession(prev => ({ ...prev, orgChart: true }));
      setDeletedOrgChartIds([]);
      setOrgChartData([]);
      queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/vessel-org-chart'] });
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message || "Failed to save org chart", variant: "destructive" });
    },
  });

  const toggleViewMode = () => setIsEditMode(true);
  const exitEditMode = () => {
    setIsEditMode(false);
    setHasUnsavedChanges(false);
    setHasSavedInSession({});
    setDeletedRankIds([]);
    setRanksData([]);
    queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/available-ranks'] });
  };

  const handleSave = () => {
    const sorted = [...ranksData].sort((a, b) => a.sortOrder - b.sortOrder);
    sorted.forEach((r, i) => { r.sortOrder = i + 1; });
    saveRanksMutation.mutate({ ranks: sorted, deletedIds: deletedRankIds });
  };

  const handleOrgChartSave = () => {
    const validEntries = orgChartData.filter(e => e.rankId);
    saveOrgChartMutation.mutate({ entries: validEntries, deletedIds: deletedOrgChartIds });
  };

  const exitOrgChartEditMode = () => {
    setIsOrgChartEditMode(false);
    setHasUnsavedChanges(false);
    setDeletedOrgChartIds([]);
    setOrgChartData([]);
    queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/vessel-org-chart'] });
  };

  const closeOrgChartModal = () => {
    if (isOrgChartEditMode) {
      exitOrgChartEditMode();
    }
    setIsOrgChartModalOpen(false);
  };

  const addNewRank = () => {
    const maxSort = ranksData.reduce((max, r) => Math.max(max, r.sortOrder), 0);
    const maxRankNum = ranksData.reduce((max, r) => {
      const m = r.rankId.match(/^R(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const newRankId = `R${String(maxRankNum + 1).padStart(3, '0')}`;
    setRanksData(prev => [...prev, {
      rankId: newRankId,
      name: "",
      label: "",
      category: "Senior Officers",
      applicableToCompany: true,
      isSystemRank: false,
      sortOrder: maxSort + 1,
      isNew: true,
    }]);
    setHasUnsavedChanges(true);
  };

  const deleteRank = (rankId: string) => {
    const rank = ranksData.find(r => r.rankId === rankId);
    if (rank && !rank.isNew) {
      setDeletedRankIds(prev => [...prev, rankId]);
    }
    setRanksData(prev => prev.filter(r => r.rankId !== rankId));
    setHasUnsavedChanges(true);
  };

  const updateRank = (rankId: string, field: keyof RankRow, value: any) => {
    setRanksData(prev => prev.map(r =>
      r.rankId === rankId ? { ...r, [field]: value } : r
    ));
    setHasUnsavedChanges(true);
  };

  const addNewOrgChartEntry = () => {
    setOrgChartData(prev => [...prev, {
      rank: "",
      rankId: "",
      parentRankId: null,
      sortOrder: 0,
      isNew: true,
    }]);
    setHasUnsavedChanges(true);
  };

  const deleteOrgChartEntry = (index: number) => {
    const entry = orgChartData[index];
    if (entry && entry.id && !entry.isNew) {
      setDeletedOrgChartIds(prev => [...prev, entry.id!]);
    }
    setOrgChartData(prev => prev.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  };

  const updateOrgChartEntry = (index: number, field: keyof OrgChartRow, value: any) => {
    setOrgChartData(prev => prev.map((entry, i) => {
      if (i !== index) return entry;
      if (field === 'rankId') {
        const selectedRank = ranksData.find(r => r.rankId === value);
        return { ...entry, rankId: value, rank: selectedRank?.label || selectedRank?.name || "" };
      }
      return { ...entry, [field]: value };
    }));
    setHasUnsavedChanges(true);
  };

  const getRankLabel = (rankId: string) => {
    const rank = ranksData.find(r => r.rankId === rankId);
    return rank ? (rank.label || rank.name) : rankId;
  };

  interface TreeNode {
    entry: OrgChartRow;
    index: number;
    children: TreeNode[];
  }

  const buildOrgTree = (entries: OrgChartRow[]): { tree: TreeNode[]; unassigned: { entry: OrgChartRow; index: number }[] } => {
    const validEntries: { entry: OrgChartRow; index: number }[] = [];
    const unassigned: { entry: OrgChartRow; index: number }[] = [];

    entries.forEach((entry, index) => {
      if (entry.rankId) {
        validEntries.push({ entry, index });
      } else {
        unassigned.push({ entry, index });
      }
    });

    const nodeMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    validEntries.forEach(({ entry, index }) => {
      if (!nodeMap.has(entry.rankId)) {
        nodeMap.set(entry.rankId, { entry, index, children: [] });
      }
    });

    validEntries.forEach(({ entry }) => {
      const node = nodeMap.get(entry.rankId)!;
      if (entry.parentRankId && nodeMap.has(entry.parentRankId)) {
        nodeMap.get(entry.parentRankId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortChildren = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.entry.sortOrder - b.entry.sortOrder);
      nodes.forEach(n => sortChildren(n.children));
    };
    sortChildren(roots);
    return { tree: roots, unassigned };
  };

  const isEngineDepartment = (rankId: string, entries: OrgChartRow[], visited = new Set<string>()): boolean => {
    if (rankId === "R005") return true;
    if (visited.has(rankId)) return false;
    visited.add(rankId);
    const entry = entries.find(e => e.rankId === rankId);
    if (!entry || !entry.parentRankId) return false;
    return isEngineDepartment(entry.parentRankId, entries, visited);
  };

  const isCateringDepartment = (rankId: string, entries: OrgChartRow[], visited = new Set<string>()): boolean => {
    if (rankId === "R022") return true;
    if (visited.has(rankId)) return false;
    visited.add(rankId);
    const entry = entries.find(e => e.rankId === rankId);
    if (!entry || !entry.parentRankId) return false;
    return isCateringDepartment(entry.parentRankId, entries, visited);
  };

  const getBadgeColor = (rankId: string): string => {
    if (isEngineDepartment(rankId, orgChartData)) return "bg-green-500";
    if (isCateringDepartment(rankId, orgChartData)) return "bg-amber-500";
    return "bg-blue-500";
  };

  const getDescendantRankIds = (rankId: string, entries: OrgChartRow[]): Set<string> => {
    const descendants = new Set<string>();
    const collect = (parentId: string) => {
      entries.forEach(e => {
        if (e.parentRankId === parentId && !descendants.has(e.rankId)) {
          descendants.add(e.rankId);
          collect(e.rankId);
        }
      });
    };
    collect(rankId);
    return descendants;
  };

  const moveOrgChartEntry = (entryRankId: string, direction: 'up' | 'down') => {
    setOrgChartData(prev => {
      const entry = prev.find(e => e.rankId === entryRankId);
      if (!entry) return prev;
      const siblings = prev.filter(e => e.parentRankId === entry.parentRankId);
      siblings.sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = siblings.findIndex(s => s.rankId === entryRankId);
      if (direction === 'up' && idx <= 0) return prev;
      if (direction === 'down' && idx >= siblings.length - 1) return prev;

      const reordered = [...siblings];
      const [moved] = reordered.splice(idx, 1);
      reordered.splice(direction === 'up' ? idx - 1 : idx + 1, 0, moved);

      const sortMap = new Map<string, number>();
      reordered.forEach((s, i) => sortMap.set(s.rankId, i + 1));

      return prev.map(e => {
        const newSort = sortMap.get(e.rankId);
        return newSort !== undefined ? { ...e, sortOrder: newSort } : e;
      });
    });
    setHasUnsavedChanges(true);
  };

  const filteredRanks = ranksData.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.rankId.toLowerCase().includes(q) && !(r.label || "").toLowerCase().includes(q)) {
        return false;
      }
    }
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
    return true;
  });

  const categories = [...new Set(ranksData.map(r => r.category).filter(Boolean))];
  const isSaving = saveRanksMutation.isPending || saveOrgChartMutation.isPending;

  const renderRanksTab = () => (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#52baf3] text-white sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-sm w-16">#</th>
              <th className="px-4 py-3 text-left font-medium text-sm w-28">Rank ID</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Name</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Label</th>
              <th className="px-4 py-3 text-left font-medium text-sm w-40">Category</th>
              <th className="px-4 py-3 text-center font-medium text-sm w-28">Apply to Co.</th>
              <th className="px-4 py-3 text-center font-medium text-sm w-28">System Rank</th>
              <th className="px-4 py-3 text-center font-medium text-sm w-24">Sort Order</th>
              {isEditMode && <th className="px-4 py-3 text-center font-medium text-sm w-20">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredRanks.map((rank, idx) => (
              <tr key={rank.rankId} className={cn("border-b hover:bg-gray-50", idx % 2 === 0 ? "bg-white" : "bg-gray-50/50")}>
                <td className="px-4 py-3 text-sm text-gray-600" data-testid={`text-rank-seq-${rank.rankId}`}>{idx + 1}</td>
                <td className="px-4 py-3 text-sm font-mono text-blue-600" data-testid={`text-rank-id-${rank.rankId}`}>{rank.rankId}</td>
                <td className="px-4 py-3 text-sm" data-testid={`text-rank-name-${rank.rankId}`}>
                  {isEditMode ? (
                    <Input value={rank.name} onChange={(e) => updateRank(rank.rankId, 'name', e.target.value)} className="h-8" data-testid={`input-rank-name-${rank.rankId}`} />
                  ) : rank.name}
                </td>
                <td className="px-4 py-3 text-sm" data-testid={`text-rank-label-${rank.rankId}`}>
                  {isEditMode ? (
                    <Input value={rank.label} onChange={(e) => updateRank(rank.rankId, 'label', e.target.value)} className="h-8" data-testid={`input-rank-label-${rank.rankId}`} />
                  ) : rank.label}
                </td>
                <td className="px-4 py-3 text-sm" data-testid={`text-rank-category-${rank.rankId}`}>
                  {isEditMode ? (
                    <Select value={rank.category} onValueChange={(v) => updateRank(rank.rankId, 'category', v)}>
                      <SelectTrigger className="h-8" data-testid={`select-rank-category-${rank.rankId}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RANK_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : rank.category}
                </td>
                <td className="px-4 py-3 text-center" data-testid={`text-rank-atc-${rank.rankId}`}>
                  {isEditMode ? (
                    <Checkbox checked={rank.applicableToCompany} onCheckedChange={(v) => updateRank(rank.rankId, 'applicableToCompany', !!v)} data-testid={`checkbox-rank-atc-${rank.rankId}`} />
                  ) : (rank.applicableToCompany ? "Yes" : "No")}
                </td>
                <td className="px-4 py-3 text-center" data-testid={`text-rank-system-${rank.rankId}`}>
                  {isEditMode ? (
                    <Checkbox checked={rank.isSystemRank} onCheckedChange={(v) => updateRank(rank.rankId, 'isSystemRank', !!v)} data-testid={`checkbox-rank-system-${rank.rankId}`} />
                  ) : (rank.isSystemRank ? "Yes" : "No")}
                </td>
                <td className="px-4 py-3 text-center" data-testid={`text-rank-sort-${rank.rankId}`}>
                  {isEditMode ? (
                    <Input type="number" value={rank.sortOrder} onChange={(e) => updateRank(rank.rankId, 'sortOrder', parseInt(e.target.value, 10) || 0)} className="h-8 w-20 text-center mx-auto" data-testid={`input-rank-sort-${rank.rankId}`} />
                  ) : rank.sortOrder}
                </td>
                {isEditMode && (
                  <td className="px-4 py-3 text-center">
                    {!rank.isSystemRank && (
                      <Button variant="ghost" size="sm" onClick={() => deleteRank(rank.rankId)} className="text-red-500 hover:text-red-700" data-testid={`button-delete-rank-${rank.rankId}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {filteredRanks.length === 0 && (
              <tr><td colSpan={isEditMode ? 9 : 8} className="px-4 py-8 text-center text-gray-500">No ranks found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTreeNode = (node: TreeNode, depth: number, isLast: boolean, parentDepths: number[] = []): JSX.Element => {
    const { entry, index } = node;
    const label = entry.rank || getRankLabel(entry.rankId);
    const badgeColor = getBadgeColor(entry.rankId);
    const indent = depth * 36;
    const nextParentDepths = isLast ? parentDepths : [...parentDepths, depth];

    return (
      <div key={entry.rankId || `new-${index}`} data-testid={`tree-node-${entry.rankId}`}>
        <div className="flex items-center py-1.5 relative" style={{ paddingLeft: indent }}>
          {parentDepths.map(d => (
            <div
              key={`vline-${d}`}
              className="absolute border-l border-gray-300"
              style={{ left: d * 36 + 18, top: 0, height: '100%' }}
            />
          ))}
          {depth > 0 && (
            <div
              className="absolute border-l border-gray-300"
              style={{ left: indent - 18, top: 0, height: isLast ? '50%' : '100%' }}
            />
          )}
          {depth > 0 && (
            <div
              className="absolute border-t border-gray-300"
              style={{ left: indent - 18, top: '50%', width: 18 }}
            />
          )}

          {isOrgChartEditMode && (
            <div className="flex flex-col mr-1 flex-shrink-0" data-testid={`reorder-oc-${entry.rankId}`}>
              <button
                onClick={() => moveOrgChartEntry(entry.rankId, 'up')}
                className="text-gray-400 hover:text-gray-700 p-0 leading-none"
                data-testid={`button-move-up-${entry.rankId}`}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => moveOrgChartEntry(entry.rankId, 'down')}
                className="text-gray-400 hover:text-gray-700 p-0 leading-none"
                data-testid={`button-move-down-${entry.rankId}`}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <span
            className={cn(
              "inline-block px-4 py-1.5 rounded text-white text-sm font-medium whitespace-nowrap",
              badgeColor
            )}
            data-testid={`badge-oc-${entry.rankId}`}
          >
            {label}
          </span>

          {isOrgChartEditMode && (
            <>
              <Select
                value={entry.parentRankId || "__none__"}
                onValueChange={(v) => updateOrgChartEntry(index, 'parentRankId', v === "__none__" ? null : v)}
              >
                <SelectTrigger className="h-8 w-[180px] ml-3 text-sm" data-testid={`select-oc-parent-${entry.rankId}`}>
                  <SelectValue placeholder="Root (No Parent)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Root (No Parent)</SelectItem>
                  {(() => {
                    const descendants = getDescendantRankIds(entry.rankId, orgChartData);
                    return orgChartData
                      .filter(r => r.rankId && r.rankId !== entry.rankId && !descendants.has(r.rankId))
                      .map(r => (
                        <SelectItem key={r.rankId} value={r.rankId}>
                          {r.rank || getRankLabel(r.rankId)}
                        </SelectItem>
                      ));
                  })()}
                </SelectContent>
              </Select>
              <button
                onClick={() => deleteOrgChartEntry(index)}
                className="ml-3 text-red-400 hover:text-red-600 flex-shrink-0"
                data-testid={`button-delete-oc-${entry.rankId}`}
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {node.children.length > 0 && (
          <div className="relative">
            {node.children.map((child, childIdx) =>
              renderTreeNode(child, depth + 1, childIdx === node.children.length - 1, nextParentDepths)
            )}
          </div>
        )}
      </div>
    );
  };

  const usedRankIds = new Set(orgChartData.filter(e => e.rankId).map(e => e.rankId));
  const availableRanksForOrgChart = ranksData.filter(r => !usedRankIds.has(r.rankId));

  const renderOrgChartContent = () => {
    const { tree, unassigned } = buildOrgTree(orgChartData);

    if (orgChartData.length === 0) {
      return (
        <div className="p-8 text-center text-gray-500" data-testid="text-oc-empty">
          No org chart entries found
        </div>
      );
    }

    return (
      <div className="p-4">
        {tree.map((rootNode, idx) =>
          renderTreeNode(rootNode, 0, idx === tree.length - 1)
        )}
        {isOrgChartEditMode && unassigned.map(({ entry, index }) => (
          <div key={`unassigned-${index}`} className="flex items-center py-1.5 gap-2 border-t border-dashed border-gray-200 mt-2 pt-2" data-testid={`tree-node-unassigned-${index}`}>
            <span className="inline-block px-4 py-1.5 rounded bg-gray-400 text-white text-sm font-medium">
              New Entry
            </span>
            <Select value={entry.rankId || "__unset__"} onValueChange={(v) => {
              if (v !== "__unset__") updateOrgChartEntry(index, 'rankId', v);
            }}>
              <SelectTrigger className="h-8 w-[200px] text-sm" data-testid={`select-oc-rank-new-${index}`}>
                <SelectValue placeholder="Select rank..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unset__" disabled>Select rank...</SelectItem>
                {availableRanksForOrgChart.map(r => (
                  <SelectItem key={r.rankId} value={r.rankId}>{r.label || r.name} ({r.rankId})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entry.parentRankId || "__none__"} onValueChange={(v) => updateOrgChartEntry(index, 'parentRankId', v === "__none__" ? null : v)}>
              <SelectTrigger className="h-8 w-[180px] text-sm" data-testid={`select-oc-parent-new-${index}`}>
                <SelectValue placeholder="Root (No Parent)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Root (No Parent)</SelectItem>
                {orgChartData.filter(r => r.rankId).map(r => (
                  <SelectItem key={r.rankId} value={r.rankId}>{r.rank || getRankLabel(r.rankId)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => deleteOrgChartEntry(index)}
              className="text-red-400 hover:text-red-600 flex-shrink-0"
              data-testid={`button-delete-oc-new-${index}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800" data-testid="text-ranks-admin-title">Ranks Admin</h1>

          <div className="flex items-center gap-2">
            {!isEditMode ? (
              <Button variant="outline" size="sm" onClick={toggleViewMode} data-testid="button-edit-mode">Edit</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={exitEditMode} data-testid="button-cancel">
                  {hasSavedInSession['ranks'] ? "Exit" : "Cancel"}
                </Button>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={handleSave}
                  disabled={isSaving}
                  data-testid="button-save"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" onClick={addNewRank} data-testid="button-add-rank">
                  <Plus className="h-4 w-4" /> New
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search ranks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-ranks"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <button
              onClick={() => setIsOrgChartModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2 rounded-full border border-blue-400 text-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium"
              data-testid="button-open-org-chart"
            >
              <Network className="h-4 w-4" />
              Vessel Org Chart
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {renderRanksTab()}
      </div>

      <Dialog open={isOrgChartModalOpen} onOpenChange={(open) => {
        if (!open) closeOrgChartModal();
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0" data-testid="modal-org-chart">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="text-xl font-semibold" data-testid="text-org-chart-title">Vessel Org Chart</DialogTitle>
              <DialogDescription className="sr-only">Manage the vessel organizational chart hierarchy</DialogDescription>
              <div className="flex items-center gap-2">
                {!isOrgChartEditMode ? (
                  <Button variant="outline" size="sm" onClick={() => setIsOrgChartEditMode(true)} data-testid="button-oc-edit-mode">Edit</Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={exitOrgChartEditMode} data-testid="button-oc-cancel">
                      {hasSavedInSession['orgChart'] ? "Exit" : "Cancel"}
                    </Button>
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={handleOrgChartSave}
                      disabled={isSaving}
                      data-testid="button-oc-save"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save
                    </Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" onClick={addNewOrgChartEntry} data-testid="button-add-org-chart">
                      <Plus className="h-4 w-4" /> New
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {renderOrgChartContent()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
