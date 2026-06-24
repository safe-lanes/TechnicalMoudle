import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Save, RefreshCw, Check, ChevronsUpDown, History, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatProfessionalDate } from "@/lib/dateUtils";

interface MasterComponent {
  id: string;
  componentCode: string;
  name: string;
  rhCurrentMaster: string;
  rhMasterUpdatedAt: string | null;
}

interface RHConfig {
  componentId: string;
  componentName: string;
  rhCounterType: string;
  rhMasterComponentId: string | null;
  rhMasterComponentName: string | null;
  rhCurrentValue: string | null;
  rhLastUpdated: string | null;
  rhUpdateSource: string | null;
}

interface MeterReplacementEvent {
  id: number;
  enteredAtUTC: string | null;
  dateUpdatedLocal: string;
  renewalActionType: string | null;
  renewalReason: string | null;
  renewalReference: string | null;
  oldMeterFinal: string | null;
  newMeterStart: string | null;
  userId: string;
  notes: string | null;
}

interface RunningHoursConditionPanelProps {
  componentId: string;
  vesselId: string;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  readOnly?: boolean;
  embedded?: boolean; // When true, skip collapsible wrapper (used inside AddEditComponentForm)
}

const RH_COUNTER_TYPES = [
  { value: "NOT_RH_DRIVEN", label: "Not RH Driven" },
  { value: "MASTER", label: "Master (RH Owner)" },
  { value: "INHERITED", label: "Inherited (Uses Master Counter)" },
] as const;

export default function RunningHoursConditionPanel({
  componentId,
  vesselId,
  isExpanded = false,
  onToggle,
  readOnly = false,
  embedded = false,
}: RunningHoursConditionPanelProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(isExpanded);
  const [localRHValue, setLocalRHValue] = useState<string>("");
  const [selectedMasterId, setSelectedMasterId] = useState<string>("");
  const [pendingCounterType, setPendingCounterType] = useState<string>("");
  const [masterSourceOpen, setMasterSourceOpen] = useState(false);

  const { data: rhConfig, isLoading: isLoadingConfig } = useQuery<RHConfig>({
    queryKey: ["/technical/api/rh-config", componentId],
    queryFn: async () => {
      const res = await fetch(`/technical/api/rh-config/${componentId}`);
      if (!res.ok) throw new Error("Failed to fetch RH config");
      return res.json();
    },
    enabled: !!componentId,
    staleTime: 0, // Always refetch on mount to get latest cascade updates
  });

  const { data: masterComponents = [], isLoading: isLoadingMasters } = useQuery<MasterComponent[]>({
    queryKey: ["/technical/api/rh-config/master-components", vesselId],
    queryFn: async () => {
      const res = await fetch(`/technical/api/rh-config/master-components/${vesselId}`);
      if (!res.ok) throw new Error("Failed to fetch master components");
      return res.json();
    },
    enabled: !!vesselId && (pendingCounterType === "INHERITED" || rhConfig?.rhCounterType === "INHERITED"),
    staleTime: 0, // Always refetch on mount to get latest values
  });

  const { data: replacementHistory = [] } = useQuery<MeterReplacementEvent[]>({
    queryKey: ["/technical/api/running-hours/replacement-history", componentId],
    queryFn: async () => {
      const res = await fetch(`/technical/api/running-hours/replacement-history/${componentId}`);
      if (!res.ok) throw new Error("Failed to fetch replacement history");
      return res.json();
    },
    enabled: !!componentId,
    staleTime: 30000,
  });

  const [replacementHistoryExpanded, setReplacementHistoryExpanded] = useState(false);

  useEffect(() => {
    if (rhConfig) {
      setLocalRHValue(rhConfig.rhCurrentValue || "0");
      setPendingCounterType(rhConfig.rhCounterType);
      setSelectedMasterId(rhConfig.rhMasterComponentId || "");
    }
  }, [rhConfig]);

  const updateConfigMutation = useMutation({
    mutationFn: async (data: { rhCounterType: string; rhMasterComponentId?: string | null }) => {
      const res = await apiRequest("PUT", `/technical/api/rh-config/${componentId}`, {
        ...data,
        userId: "admin",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/rh-config", componentId] });
      toast({
        title: "Success",
        description: "RH configuration updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update RH configuration",
        variant: "destructive",
      });
    },
  });

  const updateMasterRHMutation = useMutation({
    mutationFn: async (newRHValue: number) => {
      const res = await apiRequest("PUT", `/technical/api/rh-config/master/${componentId}`, {
        newRHValue,
        updateSource: "MANUAL",
        userId: "admin",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/rh-config", componentId] });
      toast({
        title: "Success",
        description: `Running hours updated. ${data.inheritedUpdated > 0 ? `Cascaded to ${data.inheritedUpdated} inherited components.` : ""}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update running hours",
        variant: "destructive",
      });
    },
  });

  const handleCounterTypeChange = (value: string) => {
    setPendingCounterType(value);
    if (value !== "INHERITED") {
      setSelectedMasterId("");
      updateConfigMutation.mutate({ rhCounterType: value, rhMasterComponentId: null });
    }
  };

  const handleMasterSelect = (masterId: string) => {
    setSelectedMasterId(masterId);
    if (pendingCounterType === "INHERITED" && masterId) {
      updateConfigMutation.mutate({ rhCounterType: "INHERITED", rhMasterComponentId: masterId });
    }
  };

  const handleSaveRH = () => {
    const rhValue = parseFloat(localRHValue);
    if (isNaN(rhValue) || rhValue < 0) {
      toast({
        title: "Invalid Value",
        description: "Running hours must be a non-negative number",
        variant: "destructive",
      });
      return;
    }
    updateMasterRHMutation.mutate(rhValue);
  };

  const handleToggle = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onToggle?.(newExpanded);
  };

  const getRHSourceDisplay = (): string => {
    if (!rhConfig) return "—";
    if (rhConfig.rhCounterType === "MASTER") return "SELF";
    if (rhConfig.rhCounterType === "INHERITED" && rhConfig.rhMasterComponentName) {
      return rhConfig.rhMasterComponentName;
    }
    if (rhConfig.rhCounterType === "NOT_RH_DRIVEN") return "—";
    return "—";
  };

  const getLastUpdatedDisplay = (): string => {
    if (!rhConfig?.rhLastUpdated) return "—";
    try {
      return formatProfessionalDate(rhConfig.rhLastUpdated);
    } catch {
      return rhConfig.rhLastUpdated;
    }
  };

  const isEditable = rhConfig?.rhCounterType === "MASTER" && !readOnly;

  if (isLoadingConfig) {
    return (
      <div className="border border-[#52baf3] rounded-lg p-4 mb-4" data-testid="rh-panel-loading">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  // Common table content shared by both embedded and collapsible modes
  const tableContent = (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" data-testid="rh-table">
        <thead>
          <tr className="bg-[#52baf3] text-white text-sm">
            <th className="p-3 text-left font-medium border-r border-[#4aa3d9]" data-testid="header-counter-type">
              RH Counter Type
            </th>
            <th className="p-3 text-left font-medium border-r border-[#4aa3d9]" data-testid="header-counter-source">
              RH Counter Source
            </th>
            <th className="p-3 text-left font-medium border-r border-[#4aa3d9]" data-testid="header-running-hours">
              Running Hours
            </th>
            <th className="p-3 text-left font-medium" data-testid="header-last-updated">
              Last Updated
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="p-3" data-testid="cell-counter-type">
              <Select
                value={pendingCounterType || rhConfig?.rhCounterType || "NOT_RH_DRIVEN"}
                onValueChange={handleCounterTypeChange}
                disabled={readOnly || updateConfigMutation.isPending}
              >
                <SelectTrigger 
                  className="w-full text-sm" 
                  data-testid="select-counter-type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RH_COUNTER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {pendingCounterType === "INHERITED" && (
                <div className="mt-2">
                  <Popover open={masterSourceOpen} onOpenChange={setMasterSourceOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        role="combobox"
                        aria-expanded={masterSourceOpen}
                        disabled={readOnly || isLoadingMasters || updateConfigMutation.isPending}
                        className="flex items-center justify-between w-full h-9 px-3 text-sm border rounded-md bg-white hover:bg-gray-50 text-left disabled:opacity-50"
                        data-testid="select-master-component"
                      >
                        <span className={`truncate ${selectedMasterId ? 'text-gray-900' : 'text-gray-400'}`}>
                          {selectedMasterId
                            ? (() => {
                                const mc = masterComponents.find((m) => m.id === selectedMasterId);
                                return mc ? `${mc.componentCode} — ${mc.name}` : "Select Master Component";
                              })()
                            : "Select Master Component"}
                        </span>
                        <ChevronsUpDown className="h-3 w-3 flex-shrink-0 text-gray-400 ml-1" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[350px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search by code or name..." data-testid="input-search-master-component" />
                        <CommandList className="max-h-[200px]">
                          <CommandEmpty>No MASTER components found.</CommandEmpty>
                          <CommandGroup>
                            {masterComponents
                              .filter((m) => m.id !== componentId)
                              .map((master) => (
                                <CommandItem
                                  key={master.id}
                                  value={`${master.componentCode} ${master.name}`}
                                  onSelect={() => {
                                    handleMasterSelect(master.id);
                                    setMasterSourceOpen(false);
                                  }}
                                  data-testid={`option-master-${master.componentCode}`}
                                >
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">{master.componentCode}</span>
                                    <span className="text-xs text-gray-500">{master.name}</span>
                                  </div>
                                  {selectedMasterId === master.id && <Check className="h-3 w-3 ml-auto text-blue-600" />}
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </td>

            <td className="p-3" data-testid="cell-counter-source">
              <span className="text-sm text-gray-700" data-testid="text-counter-source">
                {getRHSourceDisplay()}
              </span>
            </td>

            <td className="p-3" data-testid="cell-running-hours">
              {isEditable ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={localRHValue}
                    onChange={(e) => setLocalRHValue(e.target.value)}
                    className="w-32 text-sm"
                    min="0"
                    step="0.01"
                    data-testid="input-running-hours"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveRH}
                    disabled={updateMasterRHMutation.isPending}
                    className="bg-[#52baf3] hover:bg-[#4aa3d9]"
                    data-testid="button-save-rh"
                  >
                    {updateMasterRHMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <span className="text-sm font-medium" data-testid="text-running-hours">
                  {rhConfig?.rhCurrentValue || "0"}
                </span>
              )}
            </td>

            <td className="p-3" data-testid="cell-last-updated">
              <span className="text-sm text-gray-600" data-testid="text-last-updated">
                {getLastUpdatedDisplay()}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const inheritedNote = rhConfig?.rhCounterType === "INHERITED" && (
    <p className="mt-3 text-xs text-gray-500 italic" data-testid="inherited-note">
      * Effective Running Hours (Inherited) - Source: {rhConfig.rhMasterComponentName || "Unknown"}
    </p>
  );

  const latestReset = replacementHistory.length > 0 ? replacementHistory[0] : null;

  const replacementBanner = latestReset ? (
    <div className="mt-3" data-testid="meter-replacement-banner">
      <button
        type="button"
        onClick={() => setReplacementHistoryExpanded(prev => !prev)}
        className="w-full flex items-start justify-between gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-left hover:bg-amber-100 transition-colors"
        data-testid="button-toggle-replacement-history"
      >
        <span className="flex items-start gap-2 min-w-0">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-amber-800">
            <span className="font-medium">Last meter reset: </span>
            {latestReset.enteredAtUTC
              ? formatProfessionalDate(latestReset.enteredAtUTC)
              : latestReset.dateUpdatedLocal}
            {latestReset.oldMeterFinal
              ? ` (previous reading: ${parseFloat(latestReset.oldMeterFinal).toLocaleString()} hrs)`
              : ""}
            {latestReset.renewalActionType
              ? ` — ${latestReset.renewalActionType}`
              : ""}
          </span>
        </span>
        <span className="flex items-center gap-1 flex-shrink-0 text-xs text-amber-600 font-medium">
          <History className="h-3.5 w-3.5" />
          {replacementHistory.length}
          {replacementHistoryExpanded
            ? <ChevronDown className="h-3 w-3" />
            : <ChevronRight className="h-3 w-3" />}
        </span>
      </button>

      {replacementHistoryExpanded && (
        <div className="mt-1 border border-amber-200 rounded-md overflow-hidden" data-testid="replacement-history-list">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-amber-100 text-amber-900">
                <th className="p-2 text-left font-medium border-r border-amber-200">Date</th>
                <th className="p-2 text-left font-medium border-r border-amber-200">Action</th>
                <th className="p-2 text-left font-medium border-r border-amber-200">Prev. Reading</th>
                <th className="p-2 text-left font-medium border-r border-amber-200">New Start</th>
                <th className="p-2 text-left font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {replacementHistory.map((event, idx) => (
                <tr key={event.id} className={idx % 2 === 0 ? "bg-white" : "bg-amber-50"} data-testid={`replacement-event-${event.id}`}>
                  <td className="p-2 border-r border-amber-100 whitespace-nowrap">
                    {event.enteredAtUTC
                      ? formatProfessionalDate(event.enteredAtUTC)
                      : event.dateUpdatedLocal}
                  </td>
                  <td className="p-2 border-r border-amber-100">
                    {event.renewalActionType || "Reset"}
                  </td>
                  <td className="p-2 border-r border-amber-100">
                    {event.oldMeterFinal
                      ? `${parseFloat(event.oldMeterFinal).toLocaleString()} hrs`
                      : "—"}
                  </td>
                  <td className="p-2 border-r border-amber-100">
                    {event.newMeterStart !== null && event.newMeterStart !== undefined
                      ? `${parseFloat(event.newMeterStart).toLocaleString()} hrs`
                      : "0 hrs"}
                  </td>
                  <td className="p-2 text-gray-600 max-w-[200px] truncate" title={event.renewalReason || event.notes || ""}>
                    {event.renewalReason || event.notes || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  ) : null;

  // Embedded mode: render table directly without Collapsible wrapper
  if (embedded) {
    return (
      <div className="border border-[#52baf3] rounded-lg" data-testid="rh-condition-panel">
        <div className="p-4 bg-white rounded-lg">
          {tableContent}
          {inheritedNote}
          {replacementBanner}
        </div>
      </div>
    );
  }

  // Standard mode: render with Collapsible wrapper
  return (
    <Collapsible open={expanded} onOpenChange={handleToggle}>
      <div className="border border-[#52baf3] rounded-lg mb-4" data-testid="rh-condition-panel">
        <CollapsibleTrigger className="w-full" data-testid="rh-panel-trigger">
          <div className="flex items-center justify-between p-4 bg-[#52baf3] text-white rounded-t-lg cursor-pointer hover:bg-[#4aa3d9] transition-colors">
            <h4 className="text-md font-medium flex items-center gap-2">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              B. Running Hours & Condition Monitoring
            </h4>
            {rhConfig && (
              <span className="text-sm opacity-90">
                {rhConfig.rhCurrentValue ? `${rhConfig.rhCurrentValue} hrs` : "—"}
              </span>
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 bg-white rounded-b-lg">
            {tableContent}
            {inheritedNote}
            {replacementBanner}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
