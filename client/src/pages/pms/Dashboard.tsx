import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useVessel } from "@/contexts/VesselContext";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckCircle,
  CheckSquare,
  XCircle,
  Eye,
  TrendingUp,
  TrendingDown,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Filter
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WorkOrder, ChangeRequest } from "@shared/schema";
import { useVessels } from "@/hooks/useVessels";
import { BulkApproveModal } from "@/components/BulkApproveModal";
import { SemiCircleGauge } from "@/components/SemiCircleGauge";
import { ComplianceAnomalyPanel } from "./ComplianceAnomalyPanel";
import { WorkOrdersListModal } from "./WorkOrdersListModal";
import { SparesListModal } from "./SparesListModal";

interface Spare {
  id: number;
  partNumber: string;
  partName: string;
  partCode?: string;
  rob: number;
  min: number;
  critical: string;
  componentName?: string;
  vesselId?: string;
}

interface StoresItem {
  id: number;
  itemCode: string;
  itemName: string;
  rob: number;
  min: number;
  itemType: string;
}

interface Component {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  isActive?: boolean;
}

interface RHParentComponent {
  id: string;
  componentCode: string;
  name: string;
  runningHours: string | number | null;
  currentCumulativeRH: string | number | null;
  rhCounterType: string | null;
  lastUpdated: string | null;
  inheritedCount: number;
}

interface SparesHistoryItem {
  id: number;
  timestampUTC: string;
  vesselId: string;
  eventType: string;
  qtyChange: number;
  partName: string;
}

type EnrichedWorkOrder = WorkOrder & { computedStatus?: string; criticality?: string };

type SortField = 'vessel' | 'overduePercent' | 'outstandingPercent' | 'compliancePercent' | 'lowStockItems' | 'overdueCount';
type SortDir = 'asc' | 'desc';

interface VesselKPI {
  vesselId: string;
  vesselName: string;
  overduePercent: number;
  outstandingPercent: number;
  compliancePercent: number;
  lowStockItems: number;
  overdueCount: number;
  totalWOs: number;
  totalPlanned: number;
  completedPlanned: number;
}

function getFleetStatus(overduePercent: number): { label: string; color: string; bgColor: string } {
  if (overduePercent > 40) return { label: 'Critical', color: 'text-red-700', bgColor: 'bg-red-100 border-red-300' };
  if (overduePercent >= 20) return { label: 'At Risk', color: 'text-amber-700', bgColor: 'bg-amber-100 border-amber-300' };
  return { label: 'Good', color: 'text-green-700', bgColor: 'bg-green-100 border-green-300' };
}

function getBarColor(value: number, invert: boolean = false): string {
  if (invert) {
    if (value >= 80) return 'bg-green-500';
    if (value >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  }
  if (value > 40) return 'bg-red-500';
  if (value >= 20) return 'bg-amber-500';
  return 'bg-green-500';
}

const FleetView = ({ vessels, onSelectVessel }: { vessels: { id: string; name: string }[]; onSelectVessel: (id: string) => void }) => {
  const [sortField, setSortField] = useState<SortField>('overduePercent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const woQueries = useQueries({
    queries: vessels.map(vessel => ({
      queryKey: ['/technical/api/work-orders', vessel.id],
      queryFn: async () => {
        const response = await fetch(`/technical/api/work-orders?vesselId=${vessel.id}`);
        if (!response.ok) return [];
        return response.json();
      },
    })),
  });

  const sparesQueries = useQueries({
    queries: vessels.map(vessel => ({
      queryKey: ['/technical/api/spares', vessel.id],
      queryFn: async () => {
        const response = await fetch(`/technical/api/spares/${vessel.id}`);
        if (!response.ok) return [];
        return response.json();
      },
    })),
  });

  const isLoading = woQueries.some(q => q.isLoading) || sparesQueries.some(q => q.isLoading);

  const vesselKPIs: VesselKPI[] = useMemo(() => {
    return vessels.map((vessel, idx) => {
      const workOrders = (woQueries[idx]?.data || []).filter((wo: any) => wo !== null && wo !== undefined);
      const sparesArr = sparesQueries[idx]?.data || [];

      const nonExecWOs = workOrders.filter((wo: any) => !wo.isExecution);
      const totalWOs = nonExecWOs.length;
      const overdueWOs = nonExecWOs.filter((wo: any) => (wo as any).computedStatus === 'Overdue');
      const overdueCount = overdueWOs.length;
      const overduePercent = totalWOs > 0 ? Math.round((overdueCount / totalWOs) * 100) : 0;

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const monthlyPlanned = nonExecWOs.filter((wo: any) => {
        const dueDate = wo.dueDate ? new Date(wo.dueDate) : null;
        if (!dueDate || isNaN(dueDate.getTime())) return false;
        return dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear;
      });
      const totalPlanned = monthlyPlanned.length;
      const completedPlanned = monthlyPlanned.filter((wo: any) => (wo as any).computedStatus === 'Completed').length;
      const outstandingPlanned = totalPlanned - completedPlanned;
      const outstandingPercent = totalPlanned > 0 ? Math.round((outstandingPlanned / totalPlanned) * 100) : 0;
      const compliancePercent = totalPlanned > 0 ? Math.round((completedPlanned / totalPlanned) * 100) : 0;

      const lowStockItems = sparesArr.filter((s: any) => {
        const rob = typeof s.rob === 'number' ? s.rob : parseInt(s.rob) || 0;
        const min = typeof s.min === 'number' ? s.min : parseInt(s.min) || 0;
        return rob <= min && min > 0;
      }).length;

      return {
        vesselId: vessel.id,
        vesselName: vessel.name,
        overduePercent,
        outstandingPercent,
        compliancePercent,
        lowStockItems,
        overdueCount,
        totalWOs,
        totalPlanned,
        completedPlanned,
      };
    });
  }, [vessels, woQueries.map(q => q.data), sparesQueries.map(q => q.data)]);

  const sorted = useMemo(() => {
    const list = [...vesselKPIs];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'vessel') cmp = a.vesselName.localeCompare(b.vesselName);
      else cmp = (a[sortField] as number) - (b[sortField] as number);
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [vesselKPIs, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'vessel' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const InlineBar = ({ value, maxValue = 100, colorClass }: { value: number; maxValue?: number; colorClass: string }) => {
    const width = Math.min((value / maxValue) * 100, 100);
    return (
      <div className="relative flex items-center gap-2">
        <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded-sm overflow-hidden">
          <div className={`h-full rounded-sm transition-all ${colorClass}`} style={{ width: `${width}%` }} />
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <span className="ml-3 text-gray-500">Loading fleet data...</span>
      </div>
    );
  }

  const columns: { field: SortField; label: string }[] = [
    { field: 'vessel', label: 'Vessel' },
    { field: 'overduePercent', label: 'Overdue %' },
    { field: 'outstandingPercent', label: 'Outstanding %' },
    { field: 'compliancePercent', label: 'Compliance %' },
    { field: 'lowStockItems', label: 'Low Stock Items' },
    { field: 'overdueCount', label: 'Overdue Count' },
  ];

  return (
    <div style={{ background: '#FFFFFF', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }} data-testid="card-fleet-view">
      <div className="px-4 py-3" style={{ borderBottom: '1px solid #E0E0E0' }}>
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5" style={{ color: '#1565C0' }} />
          <span style={{ color: '#1565C0', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fleet Comparison — Vessel Benchmarking</span>
        </div>
        <div className="text-xs mt-0.5" style={{ color: '#9E9E9E' }}>
          All vessels ranked by maintenance KPIs. Click a vessel name to view its dashboard.
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="table-fleet-comparison">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.field}
                  className="text-left py-2.5 px-3 cursor-pointer select-none whitespace-nowrap"
                  style={{ background: '#1565C0', color: '#FFFFFF', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}
                  onClick={() => handleSort(col.field)}
                  data-testid={`th-sort-${col.field}`}
                >
                  <span className="flex items-center">
                    {col.label}
                    <SortIcon field={col.field} />
                  </span>
                </th>
              ))}
              <th className="text-left py-2.5 px-3 whitespace-nowrap" style={{ background: '#1565C0', color: '#FFFFFF', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v, idx) => {
              const status = getFleetStatus(v.overduePercent);
              return (
                <tr
                  key={v.vesselId}
                  style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}
                  data-testid={`row-fleet-vessel-${v.vesselId}`}
                >
                  <td className="py-3 px-3">
                    <button
                      className="font-medium hover:underline text-left"
                      style={{ color: '#1565C0' }}
                      onClick={() => onSelectVessel(v.vesselId)}
                      data-testid={`button-select-vessel-${v.vesselId}`}
                    >
                      {v.vesselName}
                    </button>
                  </td>
                  <td className="py-3 px-3" data-testid={`cell-overdue-percent-${v.vesselId}`}>
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <span className="w-10 text-right font-mono font-medium" style={{ color: '#212121' }}>{v.overduePercent}%</span>
                      <div className="flex-1">
                        <InlineBar value={v.overduePercent} colorClass={getBarColor(v.overduePercent)} />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3" data-testid={`cell-outstanding-percent-${v.vesselId}`}>
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <span className="w-10 text-right font-mono font-medium" style={{ color: '#212121' }}>{v.outstandingPercent}%</span>
                      <div className="flex-1">
                        <InlineBar value={v.outstandingPercent} colorClass={getBarColor(v.outstandingPercent)} />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3" data-testid={`cell-compliance-percent-${v.vesselId}`}>
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <span className="w-10 text-right font-mono font-medium" style={{ color: '#212121' }}>{v.compliancePercent}%</span>
                      <div className="flex-1">
                        <InlineBar value={v.compliancePercent} colorClass={getBarColor(v.compliancePercent, true)} />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-medium" data-testid={`cell-low-stock-${v.vesselId}`}>
                    <span style={{ color: v.lowStockItems > 0 ? '#F57C00' : '#9E9E9E' }}>{v.lowStockItems}</span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-medium" data-testid={`cell-overdue-count-${v.vesselId}`}>
                    <span style={{ color: v.overdueCount > 0 ? '#E53935' : '#9E9E9E' }}>{v.overdueCount}</span>
                  </td>
                  <td className="py-3 px-3" data-testid={`cell-status-${v.vesselId}`}>
                    <Badge className={`${status.bgColor} ${status.color} border text-xs`}>
                      {status.label}
                    </Badge>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center" style={{ color: '#9E9E9E' }}>No vessel data available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [, setLocation] = useLocation();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [bulkApproveModalOpen, setBulkApproveModalOpen] = useState(false);
  const [woListModal, setWoListModal] = useState<{ open: boolean; title: string; workOrders: EnrichedWorkOrder[] }>({ open: false, title: '', workOrders: [] });
  const [sparesListModal, setSparesListModal] = useState<{ open: boolean; title: string; spares: Spare[] }>({ open: false, title: '', spares: [] });
  const [activeTab, setActiveTab] = useState('overview');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCriticality, setSelectedCriticality] = useState("");
  const { vesselId, setVesselId } = useVessel();
  const { data: vessels = [] } = useVessels();
  const { isSailAdmin, isClientAdmin, isHeadOfDept } = useUIRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAllVessels = vesselId === 'all';
  
  const currentVessel = vessels.find(v => v.id === vesselId);

  // Fetch real work orders data
  const { data: workOrdersData = [], isLoading: isWorkOrdersLoading } = useQuery<WorkOrder[]>({
    queryKey: ['/technical/api/work-orders', vesselId],
    queryFn: async () => {
      const url = isAllVessels 
        ? '/technical/api/work-orders' 
        : `/technical/api/work-orders?vesselId=${vesselId}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch work orders');
      return await response.json();
    },
    enabled: !!vesselId
  });

  // Fetch spares data - for all vessels, fetch each vessel's spares and combine
  const { data: sparesData = [], isLoading: isSparesLoading } = useQuery<Spare[]>({
    queryKey: ['/technical/api/spares', vesselId],
    queryFn: async () => {
      if (isAllVessels) {
        const allSpares: Spare[] = [];
        for (const vessel of vessels) {
          try {
            const response = await fetch(`/technical/api/spares/${vessel.id}`);
            if (response.ok) {
              const vesselSpares = await response.json();
              allSpares.push(...vesselSpares);
            }
          } catch (e) {
            console.warn(`Failed to fetch spares for ${vessel.id}`);
          }
        }
        return allSpares;
      }
      const response = await fetch(`/technical/api/spares/${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch spares');
      return response.json();
    },
    enabled: !!vesselId && (isAllVessels ? vessels.length > 0 : true)
  });

  // Fetch stores data - for all vessels, fetch each vessel's stores and combine
  const { data: storesData = [], isLoading: isStoresLoading } = useQuery<StoresItem[]>({
    queryKey: ['/technical/api/stores', vesselId],
    queryFn: async () => {
      if (isAllVessels) {
        const allStores: StoresItem[] = [];
        for (const vessel of vessels) {
          try {
            const response = await fetch(`/technical/api/stores/${vessel.id}`);
            if (response.ok) {
              const vesselStores = await response.json();
              allStores.push(...vesselStores);
            }
          } catch (e) {
            console.warn(`Failed to fetch stores for ${vessel.id}`);
          }
        }
        return allStores;
      }
      const response = await fetch(`/technical/api/stores/${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch stores');
      return response.json();
    },
    enabled: !!vesselId && (isAllVessels ? vessels.length > 0 : true)
  });

  // Fetch components data - for all vessels, fetch each vessel's components and combine
  const { data: componentsData = [], isLoading: isComponentsLoading } = useQuery<Component[]>({
    queryKey: ['/technical/api/components', vesselId],
    queryFn: async () => {
      if (isAllVessels) {
        const allComponents: Component[] = [];
        for (const vessel of vessels) {
          try {
            const response = await fetch(`/technical/api/components/${vessel.id}`);
            if (response.ok) {
              const vesselComponents = await response.json();
              allComponents.push(...vesselComponents);
            }
          } catch (e) {
            console.warn(`Failed to fetch components for ${vessel.id}`);
          }
        }
        return allComponents;
      }
      const response = await fetch(`/technical/api/components/${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch components');
      return response.json();
    },
    enabled: !!vesselId && (isAllVessels ? vessels.length > 0 : true)
  });

  const { data: rhParentsData = [], isLoading: isRHLoading } = useQuery<RHParentComponent[]>({
    queryKey: ['/technical/api/running-hours/parents', vesselId],
    queryFn: async () => {
      if (isAllVessels) {
        const results = await Promise.allSettled(
          vessels.map(vessel =>
            fetch(`/technical/api/running-hours/parents?vesselId=${vessel.id}`)
              .then(r => r.ok ? r.json() : [])
          )
        );
        return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      }
      const response = await fetch(`/technical/api/running-hours/parents?vesselId=${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch running hours');
      return response.json();
    },
    enabled: !!vesselId && (isAllVessels ? vessels.length > 0 : true)
  });

  const { data: sparesHistoryData = [], isLoading: isSparesHistoryLoading } = useQuery<SparesHistoryItem[]>({
    queryKey: ['/technical/api/spares/history', vesselId],
    queryFn: async () => {
      if (isAllVessels) {
        const results = await Promise.allSettled(
          vessels.map(vessel =>
            fetch(`/technical/api/spares/history/${vessel.id}`)
              .then(r => r.ok ? r.json() : [])
          )
        );
        return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      }
      const response = await fetch(`/technical/api/spares/history/${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch spares history');
      return response.json();
    },
    enabled: !!vesselId && (isAllVessels ? vessels.length > 0 : true)
  });

  const { data: changeRequestsData = [] } = useQuery<ChangeRequest[]>({
    queryKey: ['/api/change-requests', vesselId],
    queryFn: async () => {
      const url = `/api/change-requests?vesselId=${vesselId}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch change requests');
      return response.json();
    },
    enabled: !!vesselId,
  });

  const { data: superintendentSummary } = useQuery<{ pendingCount: number; acknowledgedThisMonthCount: number }>({
    queryKey: ['/technical/api/superintendent/notifications/summary', vesselId],
    queryFn: async () => {
      const url = isAllVessels
        ? '/technical/api/superintendent/notifications/summary'
        : `/technical/api/superintendent/notifications/summary?vesselId=${vesselId}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch superintendent summary');
      return response.json();
    },
    enabled: !!vesselId,
  });

  // Helper: Calculate stock status
  const getStockStatus = (rob: number, min: number): { label: string; isLow: boolean } => {
    if (rob < min) return { label: 'Low', isLow: true };
    if (rob === min) return { label: 'At Min', isLow: true };
    return { label: 'OK', isLow: false };
  };

  const filteredWorkOrdersData = useMemo(() => {
    if (!selectedCriticality || selectedCriticality === "all") return workOrdersData;
    return workOrdersData.filter(wo => {
      const woCriticality = ((wo as WorkOrder & { criticality?: string }).criticality ?? '').toLowerCase();
      if (selectedCriticality === "critical") {
        return woCriticality === "yes";
      }
      return woCriticality !== "yes";
    });
  }, [workOrdersData, selectedCriticality]);

  const filteredSparesData = useMemo(() => {
    if (!selectedCriticality || selectedCriticality === "all") return sparesData;
    if (selectedCriticality === "critical") {
      return sparesData.filter(spare => spare.critical === 'Critical' || spare.critical === 'Yes');
    }
    return sparesData.filter(spare => spare.critical !== 'Critical' && spare.critical !== 'Yes');
  }, [sparesData, selectedCriticality]);

  const workOrderKPIs = useMemo(() => {
    const safeWOs = filteredWorkOrdersData.filter(wo => wo !== null && wo !== undefined);
    
    // Due includes warning window items + grace period items
    const due = safeWOs.filter(wo => 
      ((wo as any).computedStatus === 'Due' || (wo as any).computedStatus === 'Due (Grace P)') && !wo.isExecution
    );
    // Overdue only includes breach items (past tolerance/grace period)
    const overdue = safeWOs.filter(wo => 
      (wo as any).computedStatus === 'Overdue' && !wo.isExecution
    );
    const pendingApproval = safeWOs.filter(wo => 
      (wo as any).computedStatus === 'Pending Approval'
    );
    const completed = safeWOs.filter(wo => 
      (wo as any).computedStatus === 'Completed'
    );
    // Planned includes Active and Postponed items
    const planned = safeWOs.filter(wo => 
      ((wo as any).computedStatus === 'Active' || (wo as any).computedStatus === 'Postponed') && !wo.isExecution
    );

    return {
      total: safeWOs.filter(wo => !wo.isExecution).length,
      overdue: overdue.length,
      overdueList: overdue.slice(0, 5),
      overdueFull: overdue as EnrichedWorkOrder[],
      due: due.length,
      dueList: due.slice(0, 5),
      dueFull: due as EnrichedWorkOrder[],
      pendingApproval: pendingApproval.length,
      pendingApprovalList: pendingApproval.slice(0, 5),
      pendingApprovalFull: pendingApproval as EnrichedWorkOrder[],
      completed: completed.length,
      completedFull: completed as EnrichedWorkOrder[],
      active: planned.length,
      plannedFull: planned as EnrichedWorkOrder[],
    };
  }, [filteredWorkOrdersData]);

  // Approve single work order mutation (for Head of Dept quick actions)
  const approveMutation = useMutation({
    mutationFn: async (workOrderId: string) => {
      const response = await apiRequest('POST', '/technical/api/work-orders/bulk-approve', {
        workOrderIds: [workOrderId],
        approver: "Head of Dept"
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Work order approved successfully" });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/work-orders', vesselId] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to approve work order", variant: "destructive" });
    }
  });

  // Reject single work order mutation (for Head of Dept quick actions)
  const rejectMutation = useMutation({
    mutationFn: async ({ workOrderId, comments }: { workOrderId: string; comments: string }) => {
      const response = await apiRequest('POST', '/technical/api/work-orders/bulk-reject', {
        workOrderIds: [workOrderId],
        approver: "Head of Dept",
        rejectionComments: comments
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Rejected", description: "Work order rejected and sent back to Due" });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/work-orders', vesselId] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to reject work order", variant: "destructive" });
    }
  });

  const sparesKPIs = useMemo(() => {
    const lowStockSpares = filteredSparesData.filter(spare => {
      const status = getStockStatus(spare.rob, spare.min);
      return status.isLow;
    });
    const criticalSpares = filteredSparesData.filter(spare => 
      spare.critical === 'Critical' || spare.critical === 'Yes'
    );
    const criticalLowStock = lowStockSpares.filter(spare => 
      spare.critical === 'Critical' || spare.critical === 'Yes'
    );

    return {
      total: filteredSparesData.length,
      lowStock: lowStockSpares.length,
      lowStockList: lowStockSpares.slice(0, 5),
      critical: criticalSpares.length,
      criticalLowStock: criticalLowStock.length,
      criticalLowStockList: criticalLowStock.slice(0, 5)
    };
  }, [filteredSparesData]);

  // Stores KPIs
  const storesKPIs = useMemo(() => {
    const lowStockStores = storesData.filter(item => {
      const status = getStockStatus(item.rob, item.min);
      return status.isLow;
    });

    return {
      total: storesData.length,
      lowStock: lowStockStores.length,
      lowStockList: lowStockStores.slice(0, 5),
      stores: storesData.filter(i => i.itemType === 'stores').length,
      lubes: storesData.filter(i => i.itemType === 'lubes').length,
      chemicals: storesData.filter(i => i.itemType === 'chemicals').length,
      others: storesData.filter(i => i.itemType === 'others').length
    };
  }, [storesData]);

  // Components KPIs
  const componentsKPIs = useMemo(() => {
    const activeComponents = componentsData.filter(c => c.isActive !== false);
    return {
      total: componentsData.length,
      active: activeComponents.length
    };
  }, [componentsData]);

  // Helper to parse dates in both ISO (YYYY-MM-DD) and legacy (DD-MMM-YYYY) formats
  const parseFlexibleDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr || dateStr === '' || dateStr === '—') return null;
    
    let parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;
    
    const legacyMatch = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (legacyMatch) {
      const [, day, monthStr, year] = legacyMatch;
      const monthMap: Record<string, number> = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      const month = monthMap[monthStr];
      if (month !== undefined) {
        return new Date(parseInt(year), month, parseInt(day));
      }
    }
    
    return null;
  };

  // Work Order Status chart data - filtered to current calendar month
  const workOrderStatusChartData = useMemo(() => {
    const safeWOs = filteredWorkOrdersData.filter(wo => wo !== null && wo !== undefined);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyWOs = safeWOs.filter(wo => {
      if (wo.isExecution) return false;
      const dueDate = parseFlexibleDate(wo.dueDate);
      if (!dueDate) return false;
      return dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear;
    });

    const planned = monthlyWOs.filter(wo => {
      const s = (wo as EnrichedWorkOrder).computedStatus;
      return s === 'Active' || s === 'Postponed';
    }).length;
    const due = monthlyWOs.filter(wo => {
      const s = (wo as EnrichedWorkOrder).computedStatus;
      return s === 'Due' || s === 'Due (Grace P)';
    }).length;
    const overdue = monthlyWOs.filter(wo =>
      (wo as EnrichedWorkOrder).computedStatus === 'Overdue'
    ).length;
    const completed = monthlyWOs.filter(wo =>
      (wo as EnrichedWorkOrder).computedStatus === 'Completed'
    ).length;
    const pendingApproval = monthlyWOs.filter(wo =>
      (wo as EnrichedWorkOrder).computedStatus === 'Pending Approval'
    ).length;

    return [
      { status: 'Planned', count: planned, color: '#9E9E9E' },
      { status: 'Due', count: due, color: '#FF964f' },
      { status: 'Overdue', count: overdue, color: '#ff6961' },
      { status: 'Completed', count: completed, color: '#5dc86f' },
      { status: 'Pending Approval', count: pendingApproval, color: '#FFEEAA' }
    ].filter(d => d.count > 0);
  }, [filteredWorkOrdersData]);

  // Spares Stock Status chart data
  const sparesStockChartData = useMemo(() => {
    const ok = filteredSparesData.filter(s => getStockStatus(s.rob, s.min).label === 'OK').length;
    const atMin = filteredSparesData.filter(s => getStockStatus(s.rob, s.min).label === 'At Min').length;
    const low = filteredSparesData.filter(s => getStockStatus(s.rob, s.min).label === 'Low').length;
    
    return [
      { status: 'OK', count: ok, color: '#5dc86f' },
      { status: 'At Min', count: atMin, color: '#FF964f' },
      { status: 'Low', count: low, color: '#ff6961' }
    ].filter(d => d.count > 0);
  }, [filteredSparesData]);

  const criticalSparesStockChartData = useMemo(() => {
    const criticalSpares = sparesData.filter(s => s.critical === 'Critical' || s.critical === 'Yes');
    const ok = criticalSpares.filter(s => getStockStatus(s.rob, s.min).label === 'OK').length;
    const atMin = criticalSpares.filter(s => getStockStatus(s.rob, s.min).label === 'At Min').length;
    const low = criticalSpares.filter(s => getStockStatus(s.rob, s.min).label === 'Low').length;
    return [
      { status: 'OK', count: ok, color: '#5dc86f' },
      { status: 'At Min', count: atMin, color: '#FF964f' },
      { status: 'Low', count: low, color: '#ff6961' }
    ].filter(d => d.count > 0);
  }, [sparesData]);

  // Outstanding Tasks as Percentage of Monthly Planned Maintenance Tasks
  const outstandingTasksChartData = useMemo(() => {
    const safeWOs = filteredWorkOrdersData.filter(wo => wo !== null && wo !== undefined);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Filter planned maintenance tasks for current month (non-execution work orders)
    const monthlyPlannedTasks = safeWOs.filter(wo => {
      if (wo.isExecution) return false;
      // Check if due date falls in current month - handle both date formats
      const dueDate = parseFlexibleDate(wo.dueDate);
      if (!dueDate) return false;
      return dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear;
    });
    
    // Outstanding = not completed (Overdue, Due, Due (Grace P), Active, Pending Approval)
    const outstandingTasks = monthlyPlannedTasks.filter(wo => {
      const status = (wo as any).computedStatus;
      return status !== 'Completed';
    });
    
    // Completed tasks
    const completedTasks = monthlyPlannedTasks.filter(wo => {
      const status = (wo as any).computedStatus;
      return status === 'Completed';
    });
    
    const totalMonthly = monthlyPlannedTasks.length;
    const outstandingCount = outstandingTasks.length;
    const completedCount = completedTasks.length;
    
    // Calculate percentages
    const outstandingPercent = totalMonthly > 0 ? Math.round((outstandingCount / totalMonthly) * 100) : 0;
    const completedPercent = totalMonthly > 0 ? Math.round((completedCount / totalMonthly) * 100) : 0;
    
    return {
      data: [
        { status: 'Outstanding', count: outstandingCount, percent: outstandingPercent, color: '#E53935' },
        { status: 'Completed', count: completedCount, percent: completedPercent, color: '#2E7D32' }
      ].filter(d => d.count > 0),
      totalMonthly,
      outstandingCount,
      completedCount,
      outstandingPercent
    };
  }, [filteredWorkOrdersData]);

  const maintenanceTrendData = useMemo(() => {
    const safeWOs = filteredWorkOrdersData.filter(wo => wo !== null && wo !== undefined);
    const now = new Date();
    const months: { month: string; monthShort: string; completedPercent: number; outstandingPercent: number; overduePercent: number; totalPlanned: number; completed: number; outstanding: number; overdue: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = format(d, 'MMM yyyy');
      const monthShort = format(d, 'MMM');
      const targetMonth = d.getMonth();
      const targetYear = d.getFullYear();

      const monthlyWOs = safeWOs.filter(wo => {
        if (wo.isExecution) return false;
        const dueDate = parseFlexibleDate(wo.dueDate);
        if (!dueDate) return false;
        return dueDate.getMonth() === targetMonth && dueDate.getFullYear() === targetYear;
      });

      const totalPlanned = monthlyWOs.length;
      const completedCount = monthlyWOs.filter(wo => (wo as any).computedStatus === 'Completed').length;
      const overdueCount = monthlyWOs.filter(wo => (wo as any).computedStatus === 'Overdue').length;
      const outstandingCount = totalPlanned - completedCount - overdueCount;

      months.push({
        month: monthName,
        monthShort,
        completedPercent: totalPlanned > 0 ? Math.round((completedCount / totalPlanned) * 100) : 0,
        outstandingPercent: totalPlanned > 0 ? Math.round((outstandingCount / totalPlanned) * 100) : 0,
        overduePercent: totalPlanned > 0 ? Math.round((overdueCount / totalPlanned) * 100) : 0,
        totalPlanned,
        completed: completedCount,
        outstanding: outstandingCount,
        overdue: overdueCount,
      });
    }

    const currentOutstanding = months.length >= 1 ? months[months.length - 1].outstandingPercent : 0;
    const prevOutstanding = months.length >= 2 ? months[months.length - 2].outstandingPercent : 0;
    const delta = currentOutstanding - prevOutstanding;

    return { months, delta };
  }, [filteredWorkOrdersData]);

  const runningHoursKPIs = useMemo(() => {
    const totalTracked = rhParentsData.length;
    const totalInherited = rhParentsData.reduce((sum, p) => sum + (p.inheritedCount || 0), 0);
    const totalComponents = totalTracked + totalInherited;
    const recentlyUpdated = rhParentsData.filter(p => {
      if (!p.lastUpdated) return false;
      const updated = new Date(p.lastUpdated);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return updated >= sevenDaysAgo;
    }).length;
    return { totalTracked, totalInherited, totalComponents, recentlyUpdated };
  }, [rhParentsData]);

  const sparesConsumptionTrendData = useMemo(() => {
    const now = new Date();
    const months: { month: string; monthShort: string; consumeEvents: number; totalQty: number; receiveEvents: number; receiveQty: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = format(d, 'MMM yyyy');
      const monthShort = format(d, 'MMM');
      const targetMonth = d.getMonth();
      const targetYear = d.getFullYear();

      const monthEvents = sparesHistoryData.filter(e => {
        if (!e.timestampUTC) return false;
        const ts = new Date(e.timestampUTC);
        return ts.getMonth() === targetMonth && ts.getFullYear() === targetYear;
      });

      const consumeEvents = monthEvents.filter(e => e.eventType === 'CONSUME');
      const receiveEvents = monthEvents.filter(e => e.eventType === 'RECEIVE');

      months.push({
        month: monthName,
        monthShort,
        consumeEvents: consumeEvents.length,
        totalQty: consumeEvents.reduce((sum, e) => sum + Math.abs(e.qtyChange), 0),
        receiveEvents: receiveEvents.length,
        receiveQty: receiveEvents.reduce((sum, e) => sum + Math.abs(e.qtyChange), 0),
      });
    }

    return months;
  }, [sparesHistoryData]);

  // Navigation handlers
  const navigateToWorkOrders = (tab?: string) => {
    if (tab) {
      sessionStorage.setItem('workOrdersActiveTab', tab);
    }
    setLocation('/pms/work-orders');
  };

  const navigateToSpares = (filter?: string) => {
    if (filter) {
      sessionStorage.setItem('sparesStockFilter', filter);
    }
    setLocation('/spares');
  };

  const navigateToStores = (tab?: string) => {
    if (tab) {
      sessionStorage.setItem('storesActiveTab', tab);
    }
    setLocation('/stores');
  };

  const navigateToComponents = () => {
    setLocation('/pms/components');
  };

  const navigateToRunningHours = () => {
    setLocation('/pms/running-hrs');
  };

  const navigateToReports = () => {
    setLocation('/reports');
  };

  const navigateToWorkOrder = (workOrderId: number) => {
    setLocation(`/pms/work-order/${workOrderId}`);
  };

  const handleVesselChange = (newVesselId: string) => {
    setVesselId(newVesselId);
  };

  const handleAllVesselsChange = (isAll: boolean) => {
    if (isAll) {
      setVesselId('all');
    } else {
      if (vesselId === 'all' && vessels.length > 0) {
        setVesselId(vessels[0].id);
      }
    }
  };

  const handleFleetVesselSelect = (selectedVesselId: string) => {
    setVesselId(selectedVesselId);
  };

  const handleRefresh = () => {
    setLastUpdated(new Date());
    window.location.reload();
  };

  const isLoading = isWorkOrdersLoading || isSparesLoading || isStoresLoading || isComponentsLoading || isRHLoading || isSparesHistoryLoading;

  const summaryLine = useMemo(() => {
    const scope = isAllVessels ? "Fleet" : (currentVessel?.name || "No vessel");
    const parts: string[] = [`Scope: ${scope}`];
    if (!isAllVessels) {
      parts.push(`${workOrderKPIs.total} work orders`);
      parts.push(`${sparesKPIs.total} spares`);
      parts.push(`${componentsKPIs.total} components`);
    } else {
      parts.push(`${vessels.length} vessels`);
    }
    parts.push(`Data as of ${format(lastUpdated, 'dd MMM yyyy, HH:mm')}`);
    return parts.join(' \u00b7 ');
  }, [isAllVessels, currentVessel, workOrderKPIs.total, sparesKPIs.total, componentsKPIs.total, vessels.length, lastUpdated]);

  const overduePercent = workOrderKPIs.total > 0 ? Math.round((workOrderKPIs.overdue / workOrderKPIs.total) * 100) : 0;

  const criticalWorkOrderKPIs = useMemo(() => {
    const criticalWOs = (workOrdersData as EnrichedWorkOrder[]).filter(wo => {
      return (wo.criticality ?? '').toLowerCase() === "yes";
    });
    const safeWOs = criticalWOs.filter(wo => wo !== null && wo !== undefined);

    const due = safeWOs.filter(wo =>
      (wo.computedStatus === 'Due' || wo.computedStatus === 'Due (Grace P)') && !wo.isExecution
    );
    const overdue = safeWOs.filter(wo =>
      wo.computedStatus === 'Overdue' && !wo.isExecution
    );
    const pendingApproval = safeWOs.filter(wo =>
      wo.computedStatus === 'Pending Approval'
    );
    const completed = safeWOs.filter(wo =>
      wo.computedStatus === 'Completed'
    );

    const planned = safeWOs.filter(wo =>
      (wo.computedStatus === 'Active' || wo.computedStatus === 'Postponed') && !wo.isExecution
    );

    return {
      total: safeWOs.filter(wo => !wo.isExecution).length,
      overdue: overdue.length,
      overdueFull: overdue as EnrichedWorkOrder[],
      due: due.length,
      dueFull: due as EnrichedWorkOrder[],
      pendingApproval: pendingApproval.length,
      pendingApprovalFull: pendingApproval as EnrichedWorkOrder[],
      completed: completed.length,
      completedFull: completed as EnrichedWorkOrder[],
      plannedFull: planned as EnrichedWorkOrder[],
    };
  }, [workOrdersData]);

  const criticalWorkOrderStatusChartData = useMemo(() => {
    return [
      { status: 'Overdue', count: criticalWorkOrderKPIs.overdue, color: '#ff6961' },
      { status: 'Due', count: criticalWorkOrderKPIs.due, color: '#FF964f' },
      { status: 'Pending Approval', count: criticalWorkOrderKPIs.pendingApproval, color: '#1565C0' },
      { status: 'Completed', count: criticalWorkOrderKPIs.completed, color: '#5dc86f' }
    ].filter(d => d.count > 0);
  }, [criticalWorkOrderKPIs]);

  const criticalOverduePercent = criticalWorkOrderKPIs.total > 0
    ? Math.round((criticalWorkOrderKPIs.overdue / criticalWorkOrderKPIs.total) * 100)
    : 0;
  const completionRate = workOrderKPIs.total > 0 ? Math.round((workOrderKPIs.completed / workOrderKPIs.total) * 100) : 0;

  const ytdKPIs = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const ytdWOs = (workOrdersData as EnrichedWorkOrder[]).filter(wo => {
      if (!wo || wo.isExecution) return false;
      const createdDate = wo.createdAt ? new Date(wo.createdAt) : null;
      return createdDate !== null && createdDate.getFullYear() === currentYear;
    });

    const total = ytdWOs.length;
    const postponed = ytdWOs.filter(wo =>
      wo.computedStatus === 'Postponed'
    ).length;
    const unplanned = ytdWOs.filter(wo => !wo.jobId && !wo.templateCode).length;

    const changeRequestCountYTD = changeRequestsData.filter(cr => {
      const created = cr.createdAt ? new Date(cr.createdAt) : null;
      return created !== null && created.getFullYear() === currentYear;
    }).length;
    const changeRequestPercent = total > 0 ? Math.round((changeRequestCountYTD / total) * 100) : 0;

    return {
      total,
      postponed,
      postponedPercent: total > 0 ? Math.round((postponed / total) * 100) : 0,
      unplanned,
      unplannedPercent: total > 0 ? Math.round((unplanned / total) * 100) : 0,
      changeRequests: changeRequestCountYTD,
      changeRequestPercent,
    };
  }, [workOrdersData, changeRequestsData]);

  const HEADER_BLUE = '#1a3a5c';

  const sectionHeaderBar: React.CSSProperties = {
    background: 'transparent',
    color: '#4a4a4a',
    fontWeight: 700,
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    padding: '16px 4px 12px 4px',
  };

  const subTitle: React.CSSProperties = {
    color: '#4a4a4a',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
  };

  const tableHeaderStyle: React.CSSProperties = {
    background: '#1a2b4a',
    color: '#FFFFFF',
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    padding: '10px 12px',
  };

  const contentCard: React.CSSProperties = {
    background: '#FFFFFF',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    border: '1px solid #f1f5f9',
    padding: '16px',
  };

  const dividerH: React.CSSProperties = {
    borderBottom: '1px solid #f1f5f9',
    margin: '0',
  };

  const statRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
  };

  const dotMatrixVesselData = useMemo(() => {
    if (vessels.length === 0) return [];
    if (!isAllVessels) {
      const selected = vessels.find(v => v.id === vesselId);
      return selected ? [selected] : [];
    }
    return vessels.slice(0, 8);
  }, [vessels, isAllVessels, vesselId]);

  const dotMatrixWoQueries = useQueries({
    queries: dotMatrixVesselData.map(vessel => ({
      queryKey: ['/technical/api/work-orders/dot-matrix', vessel.id],
      queryFn: async () => {
        const response = await fetch(`/technical/api/work-orders?vesselId=${vessel.id}`);
        if (!response.ok) return [];
        return response.json();
      },
    })),
  });

  const dotMatrixSparesQueries = useQueries({
    queries: dotMatrixVesselData.map(vessel => ({
      queryKey: ['/technical/api/spares/dot-matrix', vessel.id],
      queryFn: async () => {
        const response = await fetch(`/technical/api/spares/${vessel.id}`);
        if (!response.ok) return [];
        return response.json();
      },
    })),
  });

  const dotMatrixRhQueries = useQueries({
    queries: dotMatrixVesselData.map(vessel => ({
      queryKey: ['/technical/api/running-hours/parents/dot-matrix', vessel.id],
      queryFn: async () => {
        const response = await fetch(`/technical/api/running-hours/parents?vesselId=${vessel.id}`);
        if (!response.ok) return [];
        return response.json();
      },
    })),
  });

  const getDotColor = (vesselIdx: number, metric: string): string => {
    const GREY = '#9ca3af';
    const AMBER = '#F57C00';
    const RED = '#E53935';

    const wos = dotMatrixWoQueries[vesselIdx]?.data || [];
    const spares = dotMatrixSparesQueries[vesselIdx]?.data || [];
    const rhParents = dotMatrixRhQueries[vesselIdx]?.data || [];

    if (metric === 'Work Orders') {
      if (!wos || wos.length === 0) return GREY;
      return GREY;
    }
    if (metric === 'Overdue WOs') {
      if (!wos || wos.length === 0) return GREY;
      const nonExec = wos.filter((wo: any) => !wo.isExecution);
      const total = nonExec.length;
      if (total === 0) return GREY;
      const overdueCount = nonExec.filter((wo: any) => (wo as any).computedStatus === 'Overdue').length;
      const pct = (overdueCount / total) * 100;
      if (pct > 30) return RED;
      if (pct >= 10) return AMBER;
      return GREY;
    }
    if (metric === 'Low Stock') {
      if (!spares || spares.length === 0) return GREY;
      const lowCount = spares.filter((s: any) => {
        const rob = typeof s.rob === 'number' ? s.rob : parseInt(s.rob) || 0;
        const min = typeof s.min === 'number' ? s.min : parseInt(s.min) || 0;
        return rob <= min && min > 0;
      }).length;
      if (lowCount > 100) return RED;
      if (lowCount >= 50) return AMBER;
      return GREY;
    }
    if (metric === 'Spares') {
      if (!spares || spares.length === 0) return GREY;
      return GREY;
    }
    if (metric === 'Running Hrs') {
      if (!rhParents || rhParents.length === 0) return GREY;
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const hasStale = rhParents.every((p: any) => {
        if (!p.lastUpdated) return true;
        return new Date(p.lastUpdated) < ninetyDaysAgo;
      });
      if (hasStale) return RED;
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const allModerate = rhParents.every((p: any) => {
        if (!p.lastUpdated) return true;
        const d = new Date(p.lastUpdated);
        return d < thirtyDaysAgo;
      });
      if (allModerate) return AMBER;
      return GREY;
    }
    return GREY;
  };

  const cardStyle = "bg-white rounded-lg shadow-sm border border-gray-200";

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* HEADER ROW — matches Work Orders pattern, directly on background */}
      <div className="flex-shrink-0 space-y-4">
        <div className="flex items-center justify-between relative">
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-dashboard-title">
            Dashboard
          </h1>

          <div className="absolute left-1/2 -translate-x-1/2 bg-gray-100 rounded-md p-1 flex items-center gap-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'overview' ? 'bg-[#52baf3] text-white' : 'text-gray-700 hover:bg-gray-200'
              }`}
              data-testid="tab-overview"
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('management')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'management' ? 'bg-[#52baf3] text-white' : 'text-gray-700 hover:bg-gray-200'
              }`}
              data-testid="tab-management"
            >
              Management
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#1a2b4a' }} data-testid="text-current-year">
              {new Date().getFullYear()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
              data-testid="button-toggle-dashboard-filters"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>

        {showFilters && (
        <div className="flex items-center gap-3 flex-wrap" data-testid="bar-fleet-vessel-context">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 font-medium">Vessel:</span>
            <Select value={vesselId} onValueChange={handleVesselChange}>
              <SelectTrigger className="w-[180px]" data-testid="select-context-vessel">
                <SelectValue placeholder="Select vessel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-vessel-all">All Vessels</SelectItem>
                {vessels.map(v => (
                  <SelectItem key={v.id} value={v.id} data-testid={`option-vessel-${v.id}`}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 font-medium">Scope:</span>
            <Select value={isAllVessels ? 'all' : 'my'} onValueChange={(val) => handleAllVesselsChange(val === 'all')}>
              <SelectTrigger className="w-[140px]" data-testid="select-vessel-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="toggle-all-vessels">All Vessel</SelectItem>
                <SelectItem value="my" data-testid="toggle-my-vessel">My Vessel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={selectedCriticality} onValueChange={setSelectedCriticality}>
            <SelectTrigger className="w-32" data-testid="select-criticality">
              <SelectValue placeholder="Criticality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="non-critical">Non-Critical</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            className="text-gray-600"
            onClick={() => {
              setSelectedCriticality("");
              handleAllVesselsChange(false);
              if (vessels.length > 0) {
                handleVesselChange(vessels[0].id);
              }
            }}
            data-testid="button-clear-dashboard-filters"
          >
            Clear
          </Button>
        </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto mt-4" style={{ background: '#f8fafc' }}>

        {/* MANAGEMENT TAB: Fleet Benchmarking Table */}
        {activeTab === 'management' && vessels.length > 0 && (
          <div className="p-4">
            <FleetView vessels={vessels} onSelectVessel={handleFleetVesselSelect} />
          </div>
        )}

        {/* OVERVIEW TAB: Card-based Grid Layout */}
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">

            {/* DASHBOARD GRID: 3 columns (25% / 50% / 25%), 4 explicit rows */}
            <div
              className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] lg:[grid-template-rows:180px_90px_180px_200px]"
              style={{ gap: '16px' }}
              data-testid="dashboard-grid"
            >

              {/* LEFT COLUMN: Work Orders card — spans all 4 rows */}
              <div
                className={`${cardStyle} lg:[grid-row:1/5] lg:[grid-column:1]`}
                style={{ overflow: 'hidden' }}
                data-testid="column-wo-kpis"
              >
                <div className="p-3">
                  <div style={sectionHeaderBar} className="!pt-0 !pb-2">OVERDUE W.O - ALL EQPT.</div>

                  {/* Row 1: Overdue WOs Gauge */}
                  <SemiCircleGauge
                    value={workOrderKPIs.overdue}
                    max={workOrderKPIs.total || 10}
                    color="#e74c3c"
                    arcFillColor={overduePercent <= 1 ? '#FFEEAA' : '#e74c3c'}
                    displayValue={`${overduePercent}%`}
                    subtitle={`${workOrderKPIs.overdue} out of ${workOrderKPIs.total}`}
                    onClick={() => setWoListModal({ open: true, title: 'Overdue Work Orders - All Equipment', workOrders: workOrderKPIs.overdueFull })}
                    testId="gauge-overdue-wo"
                  />

                  <div style={dividerH} />

                  {/* Row 2: WO Status Distribution Donut */}
                  <div style={subTitle} className="mb-1 mt-2">WO Status - All Eqpt</div>
                  <div style={{ height: '170px' }} data-testid="card-wo-status-chart">
                    {workOrderStatusChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie
                            data={workOrderStatusChartData}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="45%"
                            innerRadius={35}
                            outerRadius={58}
                            paddingAngle={2}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, payload }: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; payload: { count: number } }) => {
                              const RADIAN = Math.PI / 180;
                              const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);
                              return (
                                <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">
                                  {payload.count}
                                </text>
                              );
                            }}
                            labelLine={false}
                            onClick={(_data: Record<string, unknown>, index: number) => {
                              const entry = workOrderStatusChartData[index];
                              if (!entry) return;
                              const status = entry.status;
                              let wos: EnrichedWorkOrder[] = [];
                              if (status === 'Overdue') wos = workOrderKPIs.overdueFull;
                              else if (status === 'Due') wos = workOrderKPIs.dueFull;
                              else if (status === 'Completed') wos = workOrderKPIs.completedFull;
                              else if (status === 'Pending Approval') wos = workOrderKPIs.pendingApprovalFull;
                              else wos = workOrderKPIs.plannedFull;
                              setWoListModal({ open: true, title: `${status} Work Orders - All Equipment`, workOrders: wos });
                            }}
                            cursor="pointer"
                          >
                            {workOrderStatusChartData.map((entry, index) => (
                              <Cell key={`wo-cell-${index}`} fill={entry.color} stroke={entry.color} />
                            ))}
                          </Pie>
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center" style={{ color: '#9E9E9E', fontSize: '11px' }}>No work orders to display</div>
                    )}
                  </div>

                  <div style={dividerH} />

                  {/* Row 3: Overdue WO Critical gauge */}
                  <div style={subTitle} className="mb-1 mt-2">OVERDUE W.O - CRITICAL EQPT.</div>
                  <SemiCircleGauge
                    value={criticalWorkOrderKPIs.overdue}
                    max={criticalWorkOrderKPIs.total || 10}
                    color="#e74c3c"
                    displayValue={criticalWorkOrderKPIs.overdue.toString()}
                    subtitle={`${criticalOverduePercent}% of total`}
                    onClick={() => setWoListModal({ open: true, title: 'Overdue Work Orders - Critical Equipment', workOrders: criticalWorkOrderKPIs.overdueFull })}
                    testId="gauge-overdue-wo-critical"
                  />

                  <div style={dividerH} />

                  {/* Row 4: WO Status Critical donut */}
                  <div style={subTitle} className="mb-1 mt-2">WO STATUS - CRITICAL EQPT.</div>
                  <div style={{ height: '170px' }} data-testid="card-wo-status-critical-chart">
                    {criticalWorkOrderStatusChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie
                            data={criticalWorkOrderStatusChartData}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="45%"
                            innerRadius={35}
                            outerRadius={58}
                            paddingAngle={2}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, payload }: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; payload: { count: number } }) => {
                              const RADIAN = Math.PI / 180;
                              const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);
                              return (
                                <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">
                                  {payload.count}
                                </text>
                              );
                            }}
                            labelLine={false}
                            onClick={(_data: Record<string, unknown>, index: number) => {
                              const entry = criticalWorkOrderStatusChartData[index];
                              if (!entry) return;
                              const status = entry.status;
                              let wos: EnrichedWorkOrder[] = [];
                              if (status === 'Overdue') wos = criticalWorkOrderKPIs.overdueFull;
                              else if (status === 'Due') wos = criticalWorkOrderKPIs.dueFull;
                              else if (status === 'Pending Approval') wos = criticalWorkOrderKPIs.pendingApprovalFull;
                              else if (status === 'Completed') wos = criticalWorkOrderKPIs.completedFull;
                              else wos = criticalWorkOrderKPIs.plannedFull;
                              setWoListModal({ open: true, title: `${status} Work Orders - Critical Equipment`, workOrders: wos });
                            }}
                            cursor="pointer"
                          >
                            {criticalWorkOrderStatusChartData.map((entry, index) => (
                              <Cell key={`wo-critical-cell-${index}`} fill={entry.color} stroke={entry.color} />
                            ))}
                          </Pie>
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center" style={{ color: '#9E9E9E', fontSize: '11px' }}>No critical work orders to display</div>
                    )}
                  </div>
                </div>
              </div>

              {/* CENTER COLUMN: Trend chart spanning rows 1-2 */}
              <div
                className={`${cardStyle} lg:[grid-row:1/3] lg:[grid-column:2]`}
                style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                data-testid="column-maintenance-trend"
              >
                <div className="p-4" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <div style={sectionHeaderBar} className="!pt-0">6-MONTH MAINTENANCE TREND</div>

                  <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
                    {maintenanceTrendData.months.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minHeight: 0 }}>
                        <div style={{ flex: 1, minHeight: 0, borderRadius: '8px', padding: '8px 4px' }} data-testid="chart-maintenance-trend">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={maintenanceTrendData.months} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
                              <XAxis dataKey="monthShort" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={38} />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                      <div style={{ background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', padding: '8px 12px' }} data-testid="tooltip-trend-line">
                                        <div className="font-semibold text-xs mb-1" style={{ color: '#212121' }}>{d.month}</div>
                                        <div className="text-xs" style={{ color: '#616161' }}>Total planned: {d.totalPlanned}</div>
                                        <div className="text-xs" style={{ color: '#2ecc71' }}>Completed: {d.completedPercent}% ({d.completed})</div>
                                        <div className="text-xs" style={{ color: '#f39c12' }}>Outstanding: {d.outstandingPercent}% ({d.outstanding})</div>
                                        <div className="text-xs" style={{ color: '#e74c3c' }}>Overdue: {d.overduePercent}% ({d.overdue})</div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Line type="monotone" dataKey="completedPercent" name="Completed %" stroke="#2ecc71" strokeWidth={2} dot={{ r: 4, fill: '#2ecc71', stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#2ecc71' }} />
                              <Line type="monotone" dataKey="outstandingPercent" name="Outstanding %" stroke="#f39c12" strokeWidth={2} dot={{ r: 4, fill: '#f39c12', stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#f39c12' }} />
                              <Line type="monotone" dataKey="overduePercent" name="Overdue %" stroke="#e74c3c" strokeWidth={2} dot={{ r: 4, fill: '#e74c3c', stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#e74c3c' }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex items-center justify-center gap-4 text-xs" style={{ color: '#6b7280' }} data-testid="legend-maintenance-trend">
                          <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#2ecc71' }} /><span>Completed %</span></div>
                          <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#f39c12' }} /><span>Outstanding %</span></div>
                          <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#e74c3c' }} /><span>Overdue %</span></div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ flex: 1 }} className="flex items-center justify-center"><span style={{ color: '#9E9E9E', fontSize: '12px' }}>No trend data available</span></div>
                    )}
                  </div>

                </div>
              </div>

              {/* CENTER COLUMN Rows 3-4: Postponed WOs + Unplanned Maintenance gauges */}
              <div
                className={`${cardStyle} lg:[grid-row:3/5] lg:[grid-column:2]`}
                data-testid="cell-center-row3"
              >
                <div className="p-3 grid grid-cols-2 gap-4 h-full">
                  <div className="flex flex-col items-center">
                    <div style={subTitle} className="mb-1 text-center">Postponed Work Orders</div>
                    <SemiCircleGauge
                      value={ytdKPIs.postponed}
                      max={ytdKPIs.total || 10}
                      color="#e74c3c"
                      displayValue={ytdKPIs.postponed.toString()}
                      subtitle={`${ytdKPIs.postponedPercent}% of total`}
                      testId="gauge-postponed-wo"
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <div style={subTitle} className="mb-1 text-center">Unplanned Maintenance %</div>
                    <SemiCircleGauge
                      value={ytdKPIs.unplanned}
                      max={ytdKPIs.total || 10}
                      color="#e74c3c"
                      displayValue={ytdKPIs.unplanned.toString()}
                      subtitle={`${ytdKPIs.unplannedPercent}% of total`}
                      testId="gauge-unplanned-wo"
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Spares Stock Status card — spans all 4 rows */}
              <div
                className={`${cardStyle} lg:[grid-row:1/5] lg:[grid-column:3]`}
                style={{ overflow: 'hidden' }}
                data-testid="column-inventory-fleet"
              >
                <div className="p-3">
                  <div style={sectionHeaderBar} className="!pt-0 !pb-2">SPARES STOCK STATUS</div>

                  {/* Row 1: Spare Parts Donut */}
                  <div style={{ height: '170px' }} data-testid="card-spares-status-chart">
                    {sparesStockChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie
                            data={sparesStockChartData}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="45%"
                            innerRadius={35}
                            outerRadius={58}
                            paddingAngle={2}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, payload }: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; payload: { count: number } }) => {
                              const RADIAN = Math.PI / 180;
                              const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);
                              return (
                                <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">
                                  {payload.count}
                                </text>
                              );
                            }}
                            labelLine={false}
                            onClick={(_data: Record<string, unknown>, index: number) => {
                              const entry = sparesStockChartData[index];
                              if (!entry) return;
                              const filtered = filteredSparesData.filter(s => getStockStatus(s.rob, s.min).label === entry.status);
                              setSparesListModal({ open: true, title: `${entry.status} Stock Spares - All Equipment`, spares: filtered });
                            }}
                            cursor="pointer"
                          >
                            {sparesStockChartData.map((entry, index) => (
                              <Cell key={`spares-cell-${index}`} fill={entry.color} stroke={entry.color} />
                            ))}
                          </Pie>
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center" style={{ color: '#9E9E9E', fontSize: '11px' }}>No spares data</div>
                    )}
                  </div>

                  <div style={dividerH} />

                  {/* Row 2: Critical Spare Parts donut */}
                  <div style={subTitle} className="mb-1 mt-2">CRITICAL SPARES STOCK STATUS</div>
                  <div style={{ height: '170px' }} data-testid="card-critical-spares-status-chart">
                    {criticalSparesStockChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie
                            data={criticalSparesStockChartData}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="45%"
                            innerRadius={35}
                            outerRadius={58}
                            paddingAngle={2}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, payload }: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; payload: { count: number } }) => {
                              const RADIAN = Math.PI / 180;
                              const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);
                              return (
                                <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">
                                  {payload.count}
                                </text>
                              );
                            }}
                            labelLine={false}
                            onClick={(_data: Record<string, unknown>, index: number) => {
                              const entry = criticalSparesStockChartData[index];
                              if (!entry) return;
                              const criticalSparesList = sparesData.filter(s => s.critical === 'Critical' || s.critical === 'Yes');
                              const filtered = criticalSparesList.filter(s => getStockStatus(s.rob, s.min).label === entry.status);
                              setSparesListModal({ open: true, title: `${entry.status} Stock Spares - Critical Equipment`, spares: filtered });
                            }}
                            cursor="pointer"
                          >
                            {criticalSparesStockChartData.map((entry, index) => (
                              <Cell key={`critical-spares-cell-${index}`} fill={entry.color} stroke={entry.color} />
                            ))}
                          </Pie>
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center" style={{ color: '#9E9E9E', fontSize: '11px' }}>No critical spares data</div>
                    )}
                  </div>

                  <div style={dividerH} />

                  {/* Row 3: Modify PMS Requests YTD gauge */}
                  <div style={subTitle} className="mb-1 mt-2">MODIFY PMS REQUESTS YTD</div>
                  <div data-testid="cell-right-row3">
                    <SemiCircleGauge
                      value={ytdKPIs.changeRequests}
                      max={ytdKPIs.total || 10}
                      color="#e74c3c"
                      displayValue={ytdKPIs.changeRequests.toString()}
                      subtitle={`${ytdKPIs.changeRequestPercent}% of total`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 2: Compliance Anomaly Detection (includes Work Order Anomalies + Superintendent Notifications) */}
            <ComplianceAnomalyPanel
              vesselId={vesselId}
              superintendentSummary={superintendentSummary}
              onNavigateToSuperintendent={() => setLocation('/pms/superintendent')}
            />

            {/* Pending Approval Section (Head of Dept) */}
            {isHeadOfDept && workOrderKPIs.pendingApproval > 0 && (
              <div className={cardStyle} data-testid="card-pending-approval-section">
                <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E0E0E0' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: '#212121' }}>
                    {workOrderKPIs.pendingApproval} work orders from {currentVessel?.name || 'vessel'} require your review
                  </span>
                  <Button
                    onClick={() => setBulkApproveModalOpen(true)}
                    style={{ background: '#1565C0' }}
                    className="text-white hover:opacity-90"
                    size="sm"
                    data-testid="button-bulk-approve-open"
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Bulk Approve ({workOrderKPIs.pendingApproval})
                  </Button>
                </div>
                <div className="p-4 space-y-2">
                  {workOrderKPIs.pendingApprovalList.map((wo: any) => (
                    <div
                      key={wo.id}
                      className="flex items-center justify-between p-3 rounded-lg border transition-colors"
                      style={{ background: wo.wasRejected ? '#FFEBEE' : '#E3F2FD', borderColor: wo.wasRejected ? '#FFCDD2' : '#BBDEFB' }}
                      data-testid={`row-pending-approval-wo-${wo.id}`}
                    >
                      <div className="flex-1 cursor-pointer" onClick={() => navigateToWorkOrder(wo.id)}>
                        <div className="font-medium text-sm" style={{ color: wo.wasRejected ? '#C62828' : '#212121' }}>
                          {wo.workOrderNo || `WO-${wo.id}`}
                          {wo.wasRejected && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: '#E53935' }}>Resubmitted</span>
                          )}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: wo.wasRejected ? '#E53935' : '#616161' }}>
                          {wo.jobTitle || 'No description'} - {wo.component}
                        </div>
                        <div className="text-xs mt-1" style={{ color: '#9E9E9E' }}>
                          Assigned: {wo.assignedTo} | Submitted: {wo.submittedDate ? new Date(wo.submittedDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => navigateToWorkOrder(wo.id)} data-testid={`button-view-pending-wo-${wo.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const reason = window.prompt("Enter rejection reason:");
                            if (reason) {
                              rejectMutation.mutate({ workOrderId: wo.id, comments: reason });
                            }
                          }}
                          style={{ borderColor: '#E53935', color: '#E53935' }}
                          disabled={rejectMutation.isPending}
                          data-testid={`button-reject-wo-${wo.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(wo.id)}
                          style={{ background: '#2E7D32' }}
                          className="text-white hover:opacity-90"
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-wo-${wo.id}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      <BulkApproveModal
        open={bulkApproveModalOpen}
        onOpenChange={setBulkApproveModalOpen}
        workOrders={workOrderKPIs.pendingApprovalFull || []}
        vesselId={vesselId}
        vesselName={currentVessel?.name}
      />

      <WorkOrdersListModal
        open={woListModal.open}
        onClose={() => setWoListModal({ open: false, title: '', workOrders: [] })}
        title={woListModal.title}
        workOrders={woListModal.workOrders}
        vessels={vessels}
      />

      <SparesListModal
        open={sparesListModal.open}
        onClose={() => setSparesListModal({ open: false, title: '', spares: [] })}
        title={sparesListModal.title}
        spares={sparesListModal.spares}
        vessels={vessels}
        getStockStatus={getStockStatus}
      />
    </div>
  );
};

export default Dashboard;
