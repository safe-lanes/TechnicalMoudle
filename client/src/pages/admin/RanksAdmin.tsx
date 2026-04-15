import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Search, Save, Loader2, ChevronUp, ChevronDown, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VISIBLE_UI_ROLES, UI_ROLE_LABELS } from "@shared/uiRoles";
import type { UIRole } from "@shared/uiRoles";
import VesselOrgChartModal from "./VesselOrgChartModal";

interface RankRow {
  id?: number;
  rankId: string;
  name: string;
  label: string;
  category: string;
  applicableToCompany: boolean;
  isSystemRank: boolean;
  sortOrder: number;
  viewMode: string;
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
  const [hasSavedInSession, setHasSavedInSession] = useState<Record<string, boolean>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [ranksData, setRanksData] = useState<RankRow[]>([]);
  const [deletedRankIds, setDeletedRankIds] = useState<string[]>([]);
  const [showOrgChart, setShowOrgChart] = useState(false);

  const { data: savedRanks } = useQuery<any[]>({
    queryKey: ['/technical/api/admin/available-ranks'],
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
          viewMode: r.viewMode ?? r.view_mode ?? "",
        }));
        setRanksData(mapped);
      } else {
        setRanksData([]);
      }
    }
  }, [savedRanks]);


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


  const toggleViewMode = () => setIsEditMode(true);
  const exitEditMode = async () => {
    setHasUnsavedChanges(false);
    setHasSavedInSession({});
    setDeletedRankIds([]);
    await queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/available-ranks'] });
    setIsEditMode(false);
  };

  const handleSave = () => {
    const sorted = [...ranksData].sort((a, b) => a.sortOrder - b.sortOrder);
    sorted.forEach((r, i) => { r.sortOrder = i + 1; });
    saveRanksMutation.mutate({ ranks: sorted, deletedIds: deletedRankIds });
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
      viewMode: "",
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


  const moveRank = (rankId: string, direction: 'up' | 'down') => {
    setRanksData(prev => {
      const sorted = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex(r => r.rankId === rankId);
      if (direction === 'up' && idx <= 0) return prev;
      if (direction === 'down' && idx >= sorted.length - 1) return prev;

      const reordered = [...sorted];
      const [moved] = reordered.splice(idx, 1);
      reordered.splice(direction === 'up' ? idx - 1 : idx + 1, 0, moved);

      const sortMap = new Map<string, number>();
      reordered.forEach((r, i) => sortMap.set(r.rankId, i + 1));

      return prev.map(r => {
        const newSort = sortMap.get(r.rankId);
        return newSort !== undefined ? { ...r, sortOrder: newSort } : r;
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
  }).sort((a, b) => a.sortOrder - b.sortOrder);

  const categories = [...new Set(ranksData.map(r => r.category).filter(Boolean))];
  const isSaving = saveRanksMutation.isPending;

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
              <th className="px-4 py-3 text-left font-medium text-sm w-48">View Mode</th>
              {isEditMode && <th className="px-4 py-3 text-center font-medium text-sm w-28">Actions</th>}
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
                <td className="px-4 py-3 text-sm" data-testid={`text-rank-viewmode-${rank.rankId}`}>
                  {isEditMode ? (
                    <Select value={rank.viewMode || "__none__"} onValueChange={(v) => updateRank(rank.rankId, 'viewMode', v === "__none__" ? "" : v)}>
                      <SelectTrigger className="h-8" data-testid={`select-rank-viewmode-${rank.rankId}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {VISIBLE_UI_ROLES.map(role => <SelectItem key={role} value={role}>{UI_ROLE_LABELS[role]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (rank.viewMode ? UI_ROLE_LABELS[rank.viewMode as UIRole] || rank.viewMode : "")}
                </td>
                {isEditMode && (
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => moveRank(rank.rankId, 'up')}
                        className="text-blue-500 hover:text-blue-700 p-0.5"
                        data-testid={`button-move-up-rank-${rank.rankId}`}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveRank(rank.rankId, 'down')}
                        className="text-blue-500 hover:text-blue-700 p-0.5"
                        data-testid={`button-move-down-rank-${rank.rankId}`}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      {!rank.isSystemRank && (
                        <Button variant="ghost" size="sm" onClick={() => deleteRank(rank.rankId)} className="text-red-500 hover:text-red-700 ml-1 h-6 w-6 p-0" data-testid={`button-delete-rank-${rank.rankId}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {filteredRanks.length === 0 && (
              <tr><td colSpan={isEditMode ? 7 : 6} className="px-4 py-8 text-center text-gray-500">No ranks found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800" data-testid="text-ranks-admin-title">Ranks Admin</h1>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowOrgChart(true)} className="gap-1.5" data-testid="button-vessel-org-chart">
              <Network className="h-4 w-4" />
              Vessel Org Chart
            </Button>
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
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {renderRanksTab()}
      </div>

      <VesselOrgChartModal open={showOrgChart} onOpenChange={setShowOrgChart} />
    </div>
  );
}
