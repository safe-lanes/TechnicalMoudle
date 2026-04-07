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
import { Plus, Trash2, Search, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TabType = "available-ranks" | "org-chart";

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
  const [activeTab, setActiveTab] = useState<TabType>("available-ranks");
  const [isEditMode, setIsEditMode] = useState(false);
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
      setHasSavedInSession(prev => ({ ...prev, [activeTab]: true }));
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
      setHasSavedInSession(prev => ({ ...prev, [activeTab]: true }));
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
    setDeletedOrgChartIds([]);
    setRanksData([]);
    setOrgChartData([]);
    queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/available-ranks'] });
    queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/vessel-org-chart'] });
  };

  const handleSave = () => {
    if (activeTab === "available-ranks") {
      const sorted = [...ranksData].sort((a, b) => a.sortOrder - b.sortOrder);
      sorted.forEach((r, i) => { r.sortOrder = i + 1; });
      saveRanksMutation.mutate({ ranks: sorted, deletedIds: deletedRankIds });
    } else {
      saveOrgChartMutation.mutate({ entries: orgChartData, deletedIds: deletedOrgChartIds });
    }
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
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <div className="relative flex-1 max-w-md">
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

      <div className="flex-1 overflow-auto border rounded-lg">
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

      {isEditMode && (
        <div className="flex-shrink-0 mt-3">
          <Button variant="outline" size="sm" onClick={addNewRank} className="gap-2" data-testid="button-add-rank">
            <Plus className="h-4 w-4" /> Add Rank
          </Button>
        </div>
      )}
    </div>
  );

  const renderOrgChartTab = () => (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-auto border rounded-lg">
        <table className="w-full">
          <thead className="bg-[#52baf3] text-white sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-sm w-16">#</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Rank</th>
              <th className="px-4 py-3 text-left font-medium text-sm w-28">Rank ID</th>
              <th className="px-4 py-3 text-left font-medium text-sm">Reports To</th>
              <th className="px-4 py-3 text-left font-medium text-sm w-28">Parent Rank ID</th>
              <th className="px-4 py-3 text-center font-medium text-sm w-24">Sort Order</th>
              {isEditMode && <th className="px-4 py-3 text-center font-medium text-sm w-20">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {orgChartData.map((entry, idx) => (
              <tr key={entry.id || `new-${idx}`} className={cn("border-b hover:bg-gray-50", idx % 2 === 0 ? "bg-white" : "bg-gray-50/50")}>
                <td className="px-4 py-3 text-sm text-gray-600" data-testid={`text-oc-seq-${idx}`}>{idx + 1}</td>
                <td className="px-4 py-3 text-sm" data-testid={`text-oc-rank-${idx}`}>
                  {isEditMode ? (
                    <Select value={entry.rankId} onValueChange={(v) => updateOrgChartEntry(idx, 'rankId', v)}>
                      <SelectTrigger className="h-8" data-testid={`select-oc-rank-${idx}`}><SelectValue placeholder="Select rank" /></SelectTrigger>
                      <SelectContent>
                        {ranksData.map(r => <SelectItem key={r.rankId} value={r.rankId}>{r.label || r.name} ({r.rankId})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (entry.rank || getRankLabel(entry.rankId))}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-blue-600" data-testid={`text-oc-rankid-${idx}`}>{entry.rankId}</td>
                <td className="px-4 py-3 text-sm" data-testid={`text-oc-parent-${idx}`}>
                  {isEditMode ? (
                    <Select value={entry.parentRankId || "__none__"} onValueChange={(v) => updateOrgChartEntry(idx, 'parentRankId', v === "__none__" ? null : v)}>
                      <SelectTrigger className="h-8" data-testid={`select-oc-parent-${idx}`}><SelectValue placeholder="None (top level)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None (top level)</SelectItem>
                        {ranksData.filter(r => r.rankId !== entry.rankId).map(r => <SelectItem key={r.rankId} value={r.rankId}>{r.label || r.name} ({r.rankId})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (entry.parentRankId ? getRankLabel(entry.parentRankId) : "—")}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-500" data-testid={`text-oc-parentid-${idx}`}>{entry.parentRankId || "—"}</td>
                <td className="px-4 py-3 text-center" data-testid={`text-oc-sort-${idx}`}>
                  {isEditMode ? (
                    <Input type="number" value={entry.sortOrder} onChange={(e) => updateOrgChartEntry(idx, 'sortOrder', parseInt(e.target.value, 10) || 0)} className="h-8 w-20 text-center mx-auto" data-testid={`input-oc-sort-${idx}`} />
                  ) : entry.sortOrder}
                </td>
                {isEditMode && (
                  <td className="px-4 py-3 text-center">
                    <Button variant="ghost" size="sm" onClick={() => deleteOrgChartEntry(idx)} className="text-red-500 hover:text-red-700" data-testid={`button-delete-oc-${idx}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {orgChartData.length === 0 && (
              <tr><td colSpan={isEditMode ? 7 : 6} className="px-4 py-8 text-center text-gray-500">No org chart entries found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isEditMode && (
        <div className="flex-shrink-0 mt-3">
          <Button variant="outline" size="sm" onClick={addNewOrgChartEntry} className="gap-2" data-testid="button-add-org-chart">
            <Plus className="h-4 w-4" /> Add Org Chart Entry
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between relative">
          <h1 className="text-2xl font-semibold text-gray-800" data-testid="text-ranks-admin-title">Ranks Admin</h1>

          <div className="absolute left-1/2 -translate-x-1/2 flex bg-gray-100 rounded-lg p-1">
            <button
              className={cn(
                "px-6 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === "available-ranks" ? "bg-[#52baf3] text-white" : "text-gray-600 hover:text-gray-800"
              )}
              onClick={() => setActiveTab("available-ranks")}
              data-testid="tab-available-ranks"
            >
              Available Ranks
            </button>
            <button
              className={cn(
                "px-6 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === "org-chart" ? "bg-[#52baf3] text-white" : "text-gray-600 hover:text-gray-800"
              )}
              onClick={() => setActiveTab("org-chart")}
              data-testid="tab-org-chart"
            >
              Vessel Org Chart
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isEditMode ? (
              <Button variant="outline" size="sm" onClick={toggleViewMode} data-testid="button-edit-mode">Edit</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={exitEditMode} data-testid="button-cancel">
                  {hasSavedInSession[activeTab] ? "Exit" : "Cancel"}
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
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-1">
        {activeTab === "available-ranks" ? renderRanksTab() : renderOrgChartTab()}
      </div>
    </div>
  );
}
