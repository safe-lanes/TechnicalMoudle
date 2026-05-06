import { useState, useMemo } from "react";
import {
  ClipboardList,
  Clock,
  Package,
  Store,
  Biohazard,
  Settings2,
  AlertTriangle,
  LifeBuoy,
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
} from "lucide-react";
import { Input } from "@/components/ui/input";

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
  subModules: SubModuleNode[];
}

const APPROVAL_MODULES: ModuleNode[] = [
  {
    id: "pms",
    title: "PMS",
    icon: Workflow,
    subModules: [
      {
        id: "pms-maintenance",
        title: "Maintenance & Work Orders",
        icon: ClipboardList,
        functions: [
          { id: "wo-cancellation", name: "Work Order Cancellation" },
          { id: "wo-postpone", name: "Postpone Work Order" },
        ],
      },
      {
        id: "pms-running-hours",
        title: "Running Hours & Condition",
        icon: Clock,
        functions: [
          { id: "rh-threshold-approval", name: "Running Hours Threshold Approval" },
          { id: "rh-reset-approval", name: "Running Hours Reset Approval" },
        ],
      },
      {
        id: "pms-spares",
        title: "Inventory - Spares",
        icon: Package,
        functions: [
          { id: "spares-rob-adjustment", name: "ROB Adjustment Approval" },
          { id: "spares-min-level-change", name: "Minimum Level Change Approval" },
        ],
      },
      {
        id: "pms-stores",
        title: "Inventory - Stores/Lubes/Chemicals",
        icon: Store,
        functions: [
          { id: "stores-rob-adjustment", name: "ROB Adjustment Approval" },
          { id: "stores-write-off", name: "Write-Off Approval" },
        ],
      },
      {
        id: "pms-ihm",
        title: "IHM (Inventory of Hazardous Materials)",
        icon: Biohazard,
        functions: [
          { id: "ihm-item-addition", name: "IHM Item Addition Approval" },
        ],
      },
      {
        id: "pms-modify-pms",
        title: "Modify PMS",
        icon: Settings2,
        functions: [
          { id: "modify-pms-component", name: "Component Change Approval" },
          { id: "modify-pms-job", name: "Job Change Approval" },
        ],
      },
      {
        id: "pms-critical-equipment",
        title: "Critical Equipment",
        icon: AlertTriangle,
        functions: [
          { id: "critical-flag-change", name: "Critical Flag Change Approval" },
        ],
      },
      {
        id: "pms-lsa-ffa",
        title: "LSA/FFA Equipment",
        icon: LifeBuoy,
        functions: [
          { id: "lsa-ffa-survey-extension", name: "Survey Extension Approval" },
        ],
      },
      {
        id: "pms-class-items",
        title: "Class Items",
        icon: Shield,
        functions: [
          { id: "class-item-postponement", name: "Class Item Postponement" },
        ],
      },
    ],
  },
  {
    id: "defect-reporting",
    title: "Defect Reporting",
    icon: Bug,
    subModules: [
      {
        id: "defect-lifecycle",
        title: "Defect Lifecycle",
        icon: AlertTriangle,
        functions: [
          { id: "defect-closure", name: "Defect Closure Approval" },
          { id: "defect-deferral", name: "Defect Deferral Approval" },
        ],
      },
      {
        id: "defect-classification",
        title: "Defect Classification",
        icon: Shield,
        functions: [
          { id: "defect-severity-change", name: "Severity Change Approval" },
        ],
      },
    ],
  },
];

interface SelectedLeaf {
  moduleId: string;
  subModuleId: string;
  functionId: string;
}

export default function ApprovalWorkflow() {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(["pms"])
  );
  const [expandedSubModules, setExpandedSubModules] = useState<Set<string>>(
    new Set()
  );
  const [activeModuleId, setActiveModuleId] = useState<string>("pms");
  const [selected, setSelected] = useState<SelectedLeaf | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const matchedSubModuleIds = useMemo(() => {
    if (!isSearching) return null;
    const activeMod = APPROVAL_MODULES.find((m) => m.id === activeModuleId);
    if (!activeMod) return new Set<string>();
    const ids = new Set<string>();
    for (const sub of activeMod.subModules) {
      if (sub.functions.some((fn) => fn.name.toLowerCase().includes(normalizedQuery))) {
        ids.add(sub.id);
      }
    }
    return ids;
  }, [isSearching, normalizedQuery, activeModuleId]);

  const isLeafVisible = (modId: string, fnName: string) => {
    if (!isSearching) return true;
    if (modId !== activeModuleId) return false;
    return fnName.toLowerCase().includes(normalizedQuery);
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
    setExpandedSubModules(
      new Set(APPROVAL_MODULES.flatMap((m) => m.subModules.map((s) => s.id)))
    );
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

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
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
        <div
          className="flex-shrink-0 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col rounded-l-lg"
          style={{ width: "320px" }}
          data-testid="approval-tree-panel"
        >
          <div className="flex-shrink-0 bg-[#52baf3] text-white px-4 py-2 font-semibold text-sm flex items-center justify-between gap-2 rounded-tl-lg">
            <div className="flex items-center gap-2">APPROVAL WORKFLOW</div>
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
              const ModIcon = mod.icon;
              const modExpanded = isModuleExpanded(mod.id);
              const totalLeaves = mod.subModules.reduce(
                (sum, s) => sum + s.functions.length,
                0
              );
              return (
                <div
                  key={mod.id}
                  data-testid={`tree-module-${mod.id}`}
                >
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
                      {totalLeaves}
                    </span>
                  </div>

                  {modExpanded && (
                    <div className="bg-gray-50/40 dark:bg-gray-800/20">
                      {mod.subModules.map((sub) => {
                        const SubIcon = sub.icon;
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
                                  .filter((fn) => isLeafVisible(mod.id, fn.name))
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

        <div
          className="flex-1 overflow-y-auto bg-white dark:bg-background border border-l-0 border-gray-200 dark:border-gray-700 rounded-r-lg"
          data-testid="approval-viewer-panel"
        >
          {selectedDetails ? (
            <div className="h-full flex flex-col">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
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
              <div
                className="flex-1 overflow-y-auto"
                data-testid="container-approval-function-body"
              />
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
