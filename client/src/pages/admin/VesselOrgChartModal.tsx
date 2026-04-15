import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, X, Save, Loader2, Plus, Trash2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface OrgChartEntry {
  id?: number;
  rankId: string;
  rank: string | null;
  parentRankId: string | null;
  sortOrder: number;
  rankView?: string | null;
}

interface RankInfo {
  rankId: string;
  name: string;
  category: string;
}

interface TreeNode {
  entry: OrgChartEntry;
  rankName: string;
  category: string;
  children: TreeNode[];
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Senior Officers": { bg: "bg-blue-500", text: "text-white", border: "border-blue-600" },
  "Junior Officers": { bg: "bg-blue-400", text: "text-white", border: "border-blue-500" },
  "Ratings": { bg: "bg-emerald-500", text: "text-white", border: "border-emerald-600" },
  "Catering": { bg: "bg-teal-500", text: "text-white", border: "border-teal-600" },
  "Other": { bg: "bg-amber-500", text: "text-white", border: "border-amber-600" },
};

function getColorForCategory(category: string) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS["Other"];
}

function buildTree(entries: OrgChartEntry[], ranksMap: Map<string, RankInfo>): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();

  for (const entry of entries) {
    const rankInfo = ranksMap.get(entry.rankId);
    nodeMap.set(entry.rankId, {
      entry,
      rankName: rankInfo?.name || entry.rank || entry.rankId,
      category: rankInfo?.category || "Other",
      children: [],
    });
  }

  const roots: TreeNode[] = [];
  for (const entry of entries) {
    const node = nodeMap.get(entry.rankId)!;
    if (entry.parentRankId && nodeMap.has(entry.parentRankId)) {
      nodeMap.get(entry.parentRankId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.entry.sortOrder - b.entry.sortOrder);
    nodes.forEach(n => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

function OrgTreeNode({ node, depth, isLast, isEditMode, onRemove }: {
  node: TreeNode;
  depth: number;
  isLast: boolean;
  isEditMode: boolean;
  onRemove: (rankId: string) => void;
}) {
  const colors = getColorForCategory(node.category);
  const indent = depth * 32;

  return (
    <>
      <div className="relative flex items-center group" style={{ paddingLeft: indent }} data-testid={`orgchart-node-${node.entry.rankId}`}>
        {depth > 0 && (
          <div className="absolute" style={{ left: indent - 20, top: 0, bottom: isLast && node.children.length === 0 ? '50%' : 0 }}>
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-300" />
            <div className="absolute left-0 top-1/2 w-4 h-px bg-gray-300" />
          </div>
        )}
        <span className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${colors.bg} ${colors.text} my-1 shadow-sm`}>
          {node.rankName}
        </span>
        {isEditMode && (
          <button
            onClick={() => onRemove(node.entry.rankId)}
            className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700"
            data-testid={`button-remove-orgchart-${node.entry.rankId}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {node.children.map((child, idx) => (
        <OrgTreeNode
          key={child.entry.rankId}
          node={child}
          depth={depth + 1}
          isLast={idx === node.children.length - 1}
          isEditMode={isEditMode}
          onRemove={onRemove}
        />
      ))}
    </>
  );
}

interface VesselOrgChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function VesselOrgChartModal({ open, onOpenChange }: VesselOrgChartModalProps) {
  const { toast } = useToast();
  const [isEditMode, setIsEditMode] = useState(false);
  const [editEntries, setEditEntries] = useState<OrgChartEntry[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [newRankId, setNewRankId] = useState("");
  const [newParentRankId, setNewParentRankId] = useState("");

  const { data: orgChartData, isLoading: isLoadingChart } = useQuery<OrgChartEntry[]>({
    queryKey: ['/technical/api/admin/vessel-org-chart'],
    enabled: open,
  });

  const { data: ranksData } = useQuery<RankInfo[]>({
    queryKey: ['/technical/api/admin/available-ranks'],
  });

  const ranksMap = useMemo(() => {
    const map = new Map<string, RankInfo>();
    if (ranksData) {
      for (const r of ranksData) {
        const rankId = (r as any).rankId || (r as any).rank_id;
        map.set(rankId, {
          rankId,
          name: r.name,
          category: r.category || "Other",
        });
      }
    }
    return map;
  }, [ranksData]);

  const currentEntries = isEditMode ? editEntries : (orgChartData || []);
  const tree = useMemo(() => buildTree(currentEntries, ranksMap), [currentEntries, ranksMap]);

  const usedRankIds = useMemo(() => new Set(currentEntries.map(e => e.rankId)), [currentEntries]);

  const availableRanksForAdd = useMemo(() => {
    if (!ranksData) return [];
    return ranksData
      .filter((r: any) => {
        const rid = r.rankId || r.rank_id;
        return !usedRankIds.has(rid);
      })
      .map((r: any) => ({
        rankId: r.rankId || r.rank_id,
        name: r.name,
      }));
  }, [ranksData, usedRankIds]);

  const saveMutation = useMutation({
    mutationFn: async (entries: OrgChartEntry[]) => {
      for (const id of deletedIds) {
        await apiRequest('DELETE', `/technical/api/admin/vessel-org-chart/${id}`);
      }
      if (entries.length > 0) {
        const response = await apiRequest('POST', '/technical/api/admin/vessel-org-chart', { entries });
        return response.json();
      }
      return { success: true };
    },
    onSuccess: () => {
      toast({ title: "Org chart saved", description: "Vessel org chart updated successfully" });
      setIsEditMode(false);
      setDeletedIds([]);
      queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/vessel-org-chart'] });
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message || "Failed to save org chart", variant: "destructive" });
    },
  });

  const enterEditMode = () => {
    setEditEntries([...(orgChartData || [])]);
    setDeletedIds([]);
    setIsEditMode(true);
  };

  const cancelEdit = () => {
    setIsEditMode(false);
    setEditEntries([]);
    setDeletedIds([]);
    setNewRankId("");
    setNewParentRankId("");
  };

  const handleSave = () => {
    saveMutation.mutate(editEntries);
  };

  const removeEntry = (rankId: string) => {
    const entry = editEntries.find(e => e.rankId === rankId);
    if (entry?.id) {
      setDeletedIds(prev => [...prev, entry.id!]);
    }
    const childrenToOrphan = editEntries.filter(e => e.parentRankId === rankId);
    setEditEntries(prev => prev
      .filter(e => e.rankId !== rankId)
      .map(e => e.parentRankId === rankId ? { ...e, parentRankId: entry?.parentRankId || null } : e)
    );
  };

  const addEntry = () => {
    if (!newRankId) return;
    const rankInfo = ranksMap.get(newRankId);
    const maxSort = editEntries.reduce((max, e) => Math.max(max, e.sortOrder), 0);
    setEditEntries(prev => [...prev, {
      rankId: newRankId,
      rank: rankInfo?.name || newRankId,
      parentRankId: newParentRankId || null,
      sortOrder: maxSort + 1,
    }]);
    setNewRankId("");
    setNewParentRankId("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && isEditMode) {
        cancelEdit();
      }
      onOpenChange(v);
    }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" data-testid="dialog-vessel-org-chart">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-xl font-semibold" data-testid="text-orgchart-title">Vessel Org Chart</DialogTitle>
            <div className="flex items-center gap-2">
              {!isEditMode ? (
                <Button variant="outline" size="sm" onClick={enterEditMode} className="gap-1.5" data-testid="button-orgchart-edit">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={cancelEdit} data-testid="button-orgchart-cancel">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5" data-testid="button-orgchart-save">
                    {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 px-2" data-testid="orgchart-tree-container">
          {isLoadingChart ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : tree.length === 0 ? (
            <div className="text-center py-12 text-gray-500" data-testid="text-orgchart-empty">
              No org chart entries configured. Click Edit to add ranks to the hierarchy.
            </div>
          ) : (
            tree.map((root, idx) => (
              <OrgTreeNode
                key={root.entry.rankId}
                node={root}
                depth={0}
                isLast={idx === tree.length - 1}
                isEditMode={isEditMode}
                onRemove={removeEntry}
              />
            ))
          )}
        </div>

        {isEditMode && (
          <div className="flex-shrink-0 border-t pt-4 px-2" data-testid="orgchart-add-section">
            <div className="flex items-center gap-2">
              <Select value={newRankId} onValueChange={setNewRankId}>
                <SelectTrigger className="flex-1" data-testid="select-orgchart-add-rank">
                  <SelectValue placeholder="Select rank to add..." />
                </SelectTrigger>
                <SelectContent>
                  {availableRanksForAdd.map(r => (
                    <SelectItem key={r.rankId} value={r.rankId}>{r.name}</SelectItem>
                  ))}
                  {availableRanksForAdd.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-gray-500">All ranks added</div>
                  )}
                </SelectContent>
              </Select>
              <Select value={newParentRankId || "__root__"} onValueChange={(v) => setNewParentRankId(v === "__root__" ? "" : v)}>
                <SelectTrigger className="flex-1" data-testid="select-orgchart-parent-rank">
                  <SelectValue placeholder="Parent rank (root)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">No parent (root)</SelectItem>
                  {currentEntries.map(e => (
                    <SelectItem key={e.rankId} value={e.rankId}>
                      {ranksMap.get(e.rankId)?.name || e.rank || e.rankId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={addEntry} disabled={!newRankId} className="gap-1" data-testid="button-orgchart-add">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
