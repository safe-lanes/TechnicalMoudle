import { useState, useMemo, useEffect } from "react";
import {
  ClipboardList,
  Clock,
  Package,
  Store,
  Settings2,
  AlertTriangle,
  Shield,
  ChevronRight,
  ChevronDown,
  FileText,
  Pencil,
  Expand,
  Minimize2,
  Workflow,
  Bug,
  Search,
  CheckCircle2,
  Loader2,
  Save,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ApprovalFunctionNode {
  id: string;
  name: string;
}

interface SubModuleNode {
  id: string;
  title: string;
  icon: React.ElementType;
  functions: ApprovalFunctionNode[];
}

interface ModuleNode {
  id: string;
  title: string;
  icon: React.ElementType;
  twoLevel?: boolean;
  subModules: SubModuleNode[];
}

const APPROVAL_MODULES: ModuleNode[] = [
  {
    id: "pms",
    title: "PMS",
    icon: Workflow,
    subModules: [
      {
        id: "pms-components",
        title: "Components",
        icon: Settings2,
        functions: [{ id: "pms-components-cr", name: "Change Request" }],
      },
      {
        id: "pms-jobs",
        title: "Jobs",
        icon: ClipboardList,
        functions: [{ id: "pms-jobs-cr", name: "Change Request" }],
      },
      {
        id: "pms-spares",
        title: "Spares",
        icon: Package,
        functions: [{ id: "pms-spares-cr", name: "Change Request" }],
      },
      {
        id: "pms-stores",
        title: "Stores",
        icon: Store,
        functions: [{ id: "pms-stores-cr", name: "Change Request" }],
      },
      {
        id: "pms-work-order",
        title: "Work Order",
        icon: Clock,
        functions: [{ id: "pms-wo-postponement", name: "WO Postponement" }],
      },
    ],
  },
  {
    id: "defects",
    title: "Defects",
    icon: Bug,
    twoLevel: true,
    subModules: [
      {
        id: "defects-extension",
        title: "Extension",
        icon: AlertTriangle,
        functions: [{ id: "defects-extension", name: "Extension" }],
      },
      {
        id: "defects-closure",
        title: "Closure",
        icon: Shield,
        functions: [{ id: "defects-closure", name: "Closure" }],
      },
      {
        id: "defects-verification",
        title: "Verification",
        icon: CheckCircle2,
        functions: [{ id: "defects-verification", name: "Verification" }],
      },
    ],
  },
];

const CONFIG_ROWS: Record<string, string[]> = {
  "pms-components-cr":    ["Critical Equipment", "Normal Equipment"],
  "pms-jobs-cr":          ["Critical Jobs", "Critical Equipment Jobs", "Normal Jobs"],
  "pms-spares-cr":        ["Critical Spares", "Normal Spares"],
  "pms-stores-cr":        ["Store Items"],
  "pms-wo-postponement":  ["Critical WO", "Normal WO", "Critical Equipment WO"],
  "defects-extension":    ["Critical Equipment Related", "COC Related", "Normal Defects"],
  "defects-closure":      ["Critical Equipment Related", "COC Related", "Normal Defects"],
  "defects-verification": ["Critical Equipment Related", "COC Related", "Normal Defects"],
};

interface SelectedLeaf {
  moduleId: string;
  subModuleId: string;
  functionId: string;
}

export default function ApprovalWorkflow() {
  const { toast } = useToast();
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(["pms"]));
  const [expandedSubModules, setExpandedSubModules] = useState<Set<string>>(new Set());
  const [activeModuleId, setActiveModuleId] = useState<string>("pms");
  const [selected, setSelected] = useState<SelectedLeaf | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [checkboxState, setCheckboxState] = useState<Record<string, { level1: boolean; level2: boolean }>>({});

  // Load config from server on mount
  const { data: configData } = useQuery<{ success: boolean; data: Array<{
    functionId: string;
    variableName: string;
    level1Enabled: boolean;
    level2Enabled: boolean;
  }> }>({
    queryKey: ['/technical/api/admin/approval-workflow-config'],
  });

  // Seed checkboxState from server data when it arrives
  useEffect(() => {
    if (!configData?.data) return;
    const stateMap: Record<string, { level1: boolean; level2: boolean }> = {};
    for (const row of configData.data) {
      stateMap[`${row.functionId}:${row.variableName}`] = {
        level1: row.level1Enabled,
        level2: row.level2Enabled,
      };
    }
    setCheckboxState(stateMap);
  }, [configData]);

  // Save mutation — sends all 20 rows in one batch PUT
  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows: Array<{
        moduleId: string;
        subModuleId: string;
        functionId: string;
        variableName: string;
        level1Enabled: boolean;
        level2Enabled: boolean;
      }> = [];
      for (const mod of APPROVAL_MODULES) {
        for (const sub of mod.subModules) {
          for (const fn of sub.functions) {
            for (const variableName of (CONFIG_ROWS[fn.id] || [])) {
              const key = `${fn.id}:${variableName}`;
              rows.push({
                moduleId: mod.id,
                subModuleId: sub.id,
                functionId: fn.id,
                variableName,
                level1Enabled: checkboxState[key]?.level1 ?? false,
                level2Enabled: checkboxState[key]?.level2 ?? false,
              });
            }
          }
        }
      }
      return apiRequest('PUT', '/technical/api/admin/approval-workflow-config', { rows });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/approval-workflow-config'] });
      toast({ title: 'Saved', description: 'Approval workflow configuration saved.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save configuration.', variant: 'destructive' });
    },
  });

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const matchedSubModuleIds = useMemo(() => {
    if (!isSearching) return null;
    const activeMod = APPROVAL_MODULES.find((m) => m.id === activeModuleId);
    if (!activeMod) return new Set<string>();
    const ids = new Set<string>();
    for (const sub of activeMod.subModules) {
      const matchesSub = sub.title.toLowerCase().includes(normalizedQuery);
      const matchesFn = sub.functions.some((fn) => fn.name.toLowerCase().includes(normalizedQuery));
      if (matchesSub || matchesFn) ids.add(sub.id);
    }
    return ids;
  }, [isSearching, normalizedQuery, activeModuleId]);

  const isLeafVisible = (modId: string, subTitle: string, fnName: string) => {
    if (!isSearching) return true;
    if (modId !== activeModuleId) return false;
    return (
      fnName.toLowerCase().includes(normalizedQuery) ||
      subTitle.toLowerCase().includes(normalizedQuery)
    );
  };

  const isModuleExpanded = (id: string) => {
    if (isSearching) return id === activeModuleId;
    return expandedModules.has(id);
  };

  const isSubModuleExpanded = (id: string) => {
    if (isSearching) return matchedSubModuleIds?.has(id) ?? false;
    return expandedSubModules.has(id);
  };

  const toggleModule = (id: string) => {
    if (isSearching) {
      setSearchQuery("");
      setActiveModuleId(id);
      setExpandedModules((prev) => new Set(prev).add(id));
      return;
    }
    setActiveModuleId(id);
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSubModule = (id: string, modId: string) => {
    if (isSearching) {
      setSearchQuery("");
      setActiveModuleId(modId);
      setExpandedModules((prev) => new Set(prev).add(modId));
      setExpandedSubModules((prev) => new Set(prev).add(id));
      return;
    }
    setActiveModuleId(modId);
    setExpandedSubModules((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedModules(new Set(APPROVAL_MODULES.map((m) => m.id)));
    setExpandedSubModules(new Set(APPROVAL_MODULES.flatMap((m) => m.subModules.map((s) => s.id))));
  };

  const collapseAll = () => {
    setExpandedModules(new Set());
    setExpandedSubModules(new Set());
  };

  const selectedDetails = useMemo(() => {
    if (!selected) return null;
    const mod = APPROVAL_MODULES.find((m) => m.id === selected.moduleId);
    const sub = mod?.subModules.find((s) => s.id === selected.subModuleId);
    const fn = sub?.functions.find((f) => f.id === selected.functionId);
    if (!mod || !sub || !fn) return null;
    return { module: mod, subModule: sub, fn };
  }, [selected]);

  const toggleCheckbox = (leafId: string, rowLabel: string, level: "level1" | "level2") => {
    if (!isEditMode) return;
    const key = `${leafId}:${rowLabel}`;
    setCheckboxState((prev) => ({
      ...prev,
      [key]: {
        level1: prev[key]?.level1 ?? false,
        level2: prev[key]?.level2 ?? false,
        [level]: !(prev[key]?.[level] ?? false),
      },
    }));
  };

  const getCheckbox = (leafId: string, rowLabel: string, level: "level1" | "level2"): boolean => {
    return checkboxState[`${leafId}:${rowLabel}`]?.[level] ?? false;
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
      {/* Title + Search */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h1
            className="text-2xl font-semibold text-gray-800 dark:text-foreground"
            data-testid="text-approval-workflow-title"
          >
            Approval Workflow
          </h1>
        </div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in selected Module"
            className="pl-9"
            data-testid="input-approval-workflow-search"
          />
        </div>
      </div>

      <div className="flex flex-1 gap-0 overflow-hidden rounded-lg shadow-sm">
        {/* ── LEFT PANEL ── */}
        <div
          className="flex-shrink-0 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col rounded-l-lg"
          style={{ width: "320px" }}
          data-testid="approval-tree-panel"
        >
          {/* Panel header */}
          <div className="flex-shrink-0 bg-[#52baf3] text-white px-4 py-2 font-semibold text-sm flex items-center justify-between gap-2 rounded-tl-lg">
            <span>APPROVAL WORKFLOW</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsEditMode((v) => !v)}
                className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-white/20 transition-colors ${
                  isEditMode ? "bg-white/20" : ""
                }`}
                data-testid="button-edit-approval-workflow"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
              <button
                onClick={expandAll}
                className="flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-white/20 transition-colors"
                data-testid="button-expand-all-approval-workflow"
              >
                <Expand className="h-3 w-3" />
                Expand
              </button>
              <button
                onClick={collapseAll}
                className="flex items-center gap-1 px-2 py-0.5 text-xs rounded hover:bg-white/20 transition-colors"
                data-testid="button-collapse-all-approval-workflow"
              >
                <Minimize2 className="h-3 w-3" />
                Collapse
              </button>
            </div>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto">
            {isSearching && (matchedSubModuleIds?.size ?? 0) === 0 && (
              <div
                className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                data-testid="text-no-results"
              >
                No matching approval functions in this module.
              </div>
            )}

            {APPROVAL_MODULES.map((mod) => {
              if (isSearching && mod.id !== activeModuleId) return null;
              const ModIcon = mod.icon;
              const modExpanded = isModuleExpanded(mod.id);
              const isTwoLevel = mod.twoLevel === true;

              return (
                <div key={mod.id} data-testid={`tree-module-${mod.id}`}>
                  {/* Module row */}
                  <div
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-semibold transition-colors border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      activeModuleId === mod.id
                        ? "text-blue-700 dark:text-blue-300 bg-blue-50/40 dark:bg-blue-900/10"
                        : "text-gray-800 dark:text-gray-200"
                    }`}
                    onClick={() => toggleModule(mod.id)}
                    data-testid={`button-toggle-module-${mod.id}`}
                  >
                    {modExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                    )}
                    <ModIcon className="h-4 w-4 flex-shrink-0 text-[#52baf3]" />
                    <span className="truncate flex-1">{mod.title}</span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-full px-1.5 py-0.5 min-w-[20px] text-center flex-shrink-0">
                      {mod.subModules.length}
                    </span>
                  </div>

                  {modExpanded && (
                    <div className="bg-gray-50/40 dark:bg-gray-800/20">
                      {mod.subModules.map((sub) => {
                        if (isSearching && !matchedSubModuleIds?.has(sub.id)) return null;
                        const SubIcon = sub.icon;

                        /* ── TWO-LEVEL (Defects): sub rendered directly as a leaf ── */
                        if (isTwoLevel) {
                          const fn = sub.functions[0];
                          if (!fn) return null;
                          const isSelected =
                            selected?.functionId === fn.id &&
                            selected?.moduleId === mod.id;
                          return (
                            <button
                              key={sub.id}
                              className={`w-full flex items-center gap-2 pl-8 pr-3 py-2 text-left text-[13px] transition-colors border-b border-gray-100/70 dark:border-gray-800/70 ${
                                isSelected
                                  ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 font-medium border-l-2 border-l-blue-500"
                                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200"
                              }`}
                              onClick={() => {
                                setActiveModuleId(mod.id);
                                setSelected({ moduleId: mod.id, subModuleId: sub.id, functionId: fn.id });
                              }}
                              data-testid={`button-function-${fn.id}`}
                            >
                              <SubIcon className="h-3.5 w-3.5 flex-shrink-0 text-[#52baf3]" />
                              <span className="truncate">{sub.title}</span>
                            </button>
                          );
                        }

                        /* ── THREE-LEVEL (PMS): sub-module row + leaf children ── */
                        const subExpanded = isSubModuleExpanded(sub.id);
                        return (
                          <div key={sub.id} data-testid={`tree-submodule-${sub.id}`}>
                            <div
                              className="w-full flex items-center gap-2 pl-7 pr-3 py-2 text-left text-[13px] font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-100/70 dark:border-gray-800/70"
                              onClick={() => toggleSubModule(sub.id, mod.id)}
                              data-testid={`button-toggle-submodule-${sub.id}`}
                            >
                              {subExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                              )}
                              <SubIcon className="h-3.5 w-3.5 flex-shrink-0 text-[#52baf3]" />
                              <span className="truncate flex-1">{sub.title}</span>
                              <span className="text-[11px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-full px-1.5 py-0.5 min-w-[20px] text-center flex-shrink-0">
                                {sub.functions.length}
                              </span>
                            </div>

                            {subExpanded && (
                              <div>
                                {sub.functions
                                  .filter((fn) => isLeafVisible(mod.id, sub.title, fn.name))
                                  .map((fn) => {
                                    const isSelected =
                                      selected?.functionId === fn.id &&
                                      selected?.subModuleId === sub.id &&
                                      selected?.moduleId === mod.id;
                                    return (
                                      <button
                                        key={fn.id}
                                        className={`w-full flex items-center gap-2 pl-14 pr-3 py-2 text-left text-[13px] transition-colors border-b border-gray-50 dark:border-gray-800/50 ${
                                          isSelected
                                            ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 font-medium border-l-2 border-l-blue-500"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200"
                                        }`}
                                        onClick={() => {
                                          setActiveModuleId(mod.id);
                                          setSelected({
                                            moduleId: mod.id,
                                            subModuleId: sub.id,
                                            functionId: fn.id,
                                          });
                                        }}
                                        data-testid={`button-function-${fn.id}`}
                                      >
                                        <FileText className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                                        <span className="truncate">{fn.name}</span>
                                      </button>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div
          className="flex-1 overflow-y-auto bg-white dark:bg-background border border-l-0 border-gray-200 dark:border-gray-700 rounded-r-lg"
          data-testid="approval-viewer-panel"
        >
          {selectedDetails ? (
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0 flex items-start justify-between gap-4">
                <div>
                  <h2
                    className="text-lg font-semibold text-gray-900 dark:text-foreground"
                    data-testid="text-selected-function-name"
                  >
                    {selectedDetails.fn.name}
                  </h2>
                  <p
                    className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5"
                    data-testid="text-selected-submodule-name"
                  >
                    {selectedDetails.subModule.title}
                  </p>
                </div>
                {isEditMode && (
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    size="sm"
                    className="flex-shrink-0"
                    data-testid="button-save-approval-config"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save
                  </Button>
                )}
              </div>

              {/* Checkbox grid */}
              <div
                className="flex-1 overflow-y-auto p-5"
                data-testid="container-approval-function-body"
              >
                {(() => {
                  const rows = CONFIG_ROWS[selectedDetails.fn.id];
                  if (!rows || rows.length === 0) {
                    return (
                      <p className="text-sm text-gray-400" data-testid="text-no-config">
                        No configuration available.
                      </p>
                    );
                  }
                  const leafId = selectedDetails.fn.id;
                  return (
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide border-b border-r border-gray-200 dark:border-gray-700 w-[60%]">
                            Variables
                          </th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide border-b border-r border-gray-200 dark:border-gray-700 w-[20%]">
                            Level 1
                          </th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 w-[20%]">
                            Level 2
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((rowLabel, idx) => (
                          <tr
                            key={rowLabel}
                            className={`border border-gray-200 dark:border-gray-700 ${
                              idx % 2 === 0
                                ? "bg-white dark:bg-background"
                                : "bg-gray-50/60 dark:bg-gray-900/20"
                            }`}
                            data-testid={`row-config-${leafId}-${idx}`}
                          >
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">
                              {rowLabel}
                            </td>
                            <td className="px-4 py-3 text-center border-r border-gray-200 dark:border-gray-700">
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={getCheckbox(leafId, rowLabel, "level1")}
                                  onCheckedChange={() => toggleCheckbox(leafId, rowLabel, "level1")}
                                  disabled={!isEditMode}
                                  data-testid={`checkbox-level1-${leafId}-${idx}`}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={getCheckbox(leafId, rowLabel, "level2")}
                                  onCheckedChange={() => toggleCheckbox(leafId, rowLabel, "level2")}
                                  disabled={!isEditMode}
                                  data-testid={`checkbox-level2-${leafId}-${idx}`}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-50/30 dark:bg-gray-900/20">
              <div className="text-center px-6" data-testid="approval-placeholder">
                <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-5">
                  <Workflow className="h-8 w-8 text-[#52baf3]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">
                  Select an Approval Function
                </h3>
                <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs leading-relaxed">
                  Select an approval function from the tree on the left.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
