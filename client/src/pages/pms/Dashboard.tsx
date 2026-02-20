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
  ChevronRight,
  CheckSquare,
  XCircle,
  Eye,
  TrendingUp,
  TrendingDown,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2
} from "lucide-react";
import { AgCharts } from "ag-charts-react";
import { AgChartOptions } from "ag-charts-community";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorkOrder } from "@shared/schema";
import { useVessels } from "@/hooks/useVessels";
import { BulkApproveModal } from "@/components/BulkApproveModal";
import { FleetVesselContextBar } from "@/components/FleetVesselContextBar";
import { SemiCircleGauge } from "@/components/SemiCircleGauge";

interface Spare {
  id: number;
  partNumber: string;
  partName: string;
  rob: number;
  min: number;
  critical: string;
  componentName?: string;
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
  const [activeTab, setActiveTab] = useState('overview');
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

  // Helper: Calculate stock status
  const getStockStatus = (rob: number, min: number): { label: string; isLow: boolean } => {
    if (rob < min) return { label: 'Low', isLow: true };
    if (rob === min) return { label: 'At Min', isLow: true };
    return { label: 'OK', isLow: false };
  };

  // Work Order KPIs with computed status
  // Updated to match new tab semantics:
  // - Due: items within warning window + Grace P (past due but within tolerance)
  // - Overdue: only breach items (past tolerance/grace period)
  // - Planned: includes 'Active' and 'Postponed' items
  const workOrderKPIs = useMemo(() => {
    const safeWOs = workOrdersData.filter(wo => wo !== null && wo !== undefined);
    
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
      due: due.length,
      dueList: due.slice(0, 5),
      pendingApproval: pendingApproval.length,
      pendingApprovalList: pendingApproval.slice(0, 5),
      pendingApprovalFull: pendingApproval, // Full list for bulk approve modal
      completed: completed.length,
      active: planned.length  // Keep 'active' property name for backwards compatibility
    };
  }, [workOrdersData]);

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

  // Spares KPIs
  const sparesKPIs = useMemo(() => {
    const lowStockSpares = sparesData.filter(spare => {
      const status = getStockStatus(spare.rob, spare.min);
      return status.isLow;
    });
    const criticalSpares = sparesData.filter(spare => 
      spare.critical === 'Critical' || spare.critical === 'Yes'
    );
    const criticalLowStock = lowStockSpares.filter(spare => 
      spare.critical === 'Critical' || spare.critical === 'Yes'
    );

    return {
      total: sparesData.length,
      lowStock: lowStockSpares.length,
      lowStockList: lowStockSpares.slice(0, 5),
      critical: criticalSpares.length,
      criticalLowStock: criticalLowStock.length,
      criticalLowStockList: criticalLowStock.slice(0, 5)
    };
  }, [sparesData]);

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

  // Work Order Status chart data
  // Note: Active status is excluded as the dashboard focuses on items needing attention
  const workOrderStatusChartData = useMemo(() => {
    return [
      { status: 'Overdue', count: workOrderKPIs.overdue, color: '#E53935' },
      { status: 'Due', count: workOrderKPIs.due, color: '#F57C00' },
      { status: 'Pending Approval', count: workOrderKPIs.pendingApproval, color: '#1565C0' },
      { status: 'Completed', count: workOrderKPIs.completed, color: '#2E7D32' }
    ].filter(d => d.count > 0);
  }, [workOrderKPIs]);

  // Spares Stock Status chart data
  const sparesStockChartData = useMemo(() => {
    const ok = sparesData.filter(s => getStockStatus(s.rob, s.min).label === 'OK').length;
    const atMin = sparesData.filter(s => getStockStatus(s.rob, s.min).label === 'At Min').length;
    const low = sparesData.filter(s => getStockStatus(s.rob, s.min).label === 'Low').length;
    
    return [
      { status: 'OK', count: ok, color: '#2E7D32' },
      { status: 'At Min', count: atMin, color: '#F57C00' },
      { status: 'Low', count: low, color: '#E53935' }
    ].filter(d => d.count > 0);
  }, [sparesData]);

  // Helper to parse dates in both ISO (YYYY-MM-DD) and legacy (DD-MMM-YYYY) formats
  const parseFlexibleDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr || dateStr === '' || dateStr === '—') return null;
    
    // Try ISO format first (YYYY-MM-DD or full ISO timestamp)
    let parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;
    
    // Try DD-MMM-YYYY format (e.g., "22-Nov-2025")
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

  // Outstanding Tasks as Percentage of Monthly Planned Maintenance Tasks
  const outstandingTasksChartData = useMemo(() => {
    const safeWOs = workOrdersData.filter(wo => wo !== null && wo !== undefined);
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
  }, [workOrdersData]);

  const maintenanceTrendData = useMemo(() => {
    const safeWOs = workOrdersData.filter(wo => wo !== null && wo !== undefined);
    const now = new Date();
    const months: { month: string; monthShort: string; totalPlanned: number; completed: number; outstanding: number; outstandingPercent: number; overdue: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = format(d, 'MMM yyyy');
      const monthShort = format(d, 'MMM');

      if (i === 0) {
        months.push({
          month: monthName,
          monthShort,
          totalPlanned: outstandingTasksChartData.totalMonthly,
          completed: outstandingTasksChartData.completedCount,
          outstanding: outstandingTasksChartData.outstandingCount,
          outstandingPercent: outstandingTasksChartData.outstandingPercent,
          overdue: workOrderKPIs.overdue
        });
      } else {
        const targetMonth = d.getMonth();
        const targetYear = d.getFullYear();

        const monthlyPlanned = safeWOs.filter(wo => {
          if (wo.isExecution) return false;
          const dueDate = parseFlexibleDate(wo.dueDate);
          if (!dueDate) return false;
          return dueDate.getMonth() === targetMonth && dueDate.getFullYear() === targetYear;
        });

        const totalPlanned = monthlyPlanned.length;
        const completedCount = monthlyPlanned.filter(wo => (wo as any).computedStatus === 'Completed').length;
        const outstandingCount = totalPlanned - completedCount;
        const outstandingPercent = totalPlanned > 0 ? Math.round((outstandingCount / totalPlanned) * 100) : 0;
        const overdueCount = monthlyPlanned.filter(wo => (wo as any).computedStatus === 'Overdue').length;

        months.push({
          month: monthName,
          monthShort,
          totalPlanned,
          completed: completedCount,
          outstanding: outstandingCount,
          outstandingPercent,
          overdue: overdueCount
        });
      }
    }

    let delta = 0;
    if (months.length >= 2) {
      const currentPct = months[months.length - 1].outstandingPercent;
      const prevPct = months[months.length - 2].outstandingPercent;
      delta = currentPct - prevPct;
    }

    return { months, delta };
  }, [workOrdersData, outstandingTasksChartData, workOrderKPIs.overdue]);

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
  const completionRate = workOrderKPIs.total > 0 ? Math.round((workOrderKPIs.completed / workOrderKPIs.total) * 100) : 0;

  const HEADER_BLUE = '#1a3a5c';

  const sectionHeaderBar: React.CSSProperties = {
    background: HEADER_BLUE,
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    padding: '8px 16px',
  };

  const subTitle: React.CSSProperties = {
    color: '#1565C0',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  };

  const tableHeaderStyle: React.CSSProperties = {
    background: HEADER_BLUE,
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
  };

  const contentCard: React.CSSProperties = {
    background: '#FFFFFF',
    borderRadius: '6px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    padding: '16px',
  };

  const dividerH: React.CSSProperties = {
    borderBottom: '1px solid #e8e8e8',
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
    return vessels.slice(0, 8);
  }, [vessels]);

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
    const GREY = '#BDBDBD';
    const GREEN = '#2E7D32';
    const AMBER = '#F57C00';
    const RED = '#E53935';

    const wos = dotMatrixWoQueries[vesselIdx]?.data || [];
    const spares = dotMatrixSparesQueries[vesselIdx]?.data || [];
    const rhParents = dotMatrixRhQueries[vesselIdx]?.data || [];

    if (metric === 'Work Orders') {
      if (!wos || wos.length === 0) return GREY;
      return GREEN;
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
      return GREEN;
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
      return GREEN;
    }
    if (metric === 'Spares') {
      if (!spares || spares.length === 0) return GREY;
      return GREEN;
    }
    if (metric === 'Running Hrs') {
      if (!rhParents || rhParents.length === 0) return GREY;
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const hasRecent = rhParents.some((p: any) => {
        if (!p.lastUpdated) return false;
        return new Date(p.lastUpdated) >= thirtyDaysAgo;
      });
      if (hasRecent) return GREEN;
      const hasModerate = rhParents.some((p: any) => {
        if (!p.lastUpdated) return false;
        const d = new Date(p.lastUpdated);
        return d >= ninetyDaysAgo && d < thirtyDaysAgo;
      });
      if (hasModerate) return AMBER;
      return RED;
    }
    return GREY;
  };

  const watchListItems = useMemo(() => {
    const items: { label: string; vessel: string; badge: string; badgeColor: string }[] = [];
    workOrderKPIs.overdueList.slice(0, 3).forEach((wo: any) => {
      items.push({
        label: wo.taskDescription || wo.jobTitle || `WO-${wo.id}`,
        vessel: currentVessel?.name || '',
        badge: 'Overdue',
        badgeColor: '#E53935',
      });
    });
    sparesKPIs.criticalLowStockList?.slice(0, 2).forEach((spare: Spare) => {
      items.push({
        label: spare.partName,
        vessel: currentVessel?.name || '',
        badge: 'Critical',
        badgeColor: '#E53935',
      });
    });
    return items.slice(0, 5);
  }, [workOrderKPIs.overdueList, sparesKPIs.criticalLowStockList, currentVessel]);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* SUB-HEADER BAR */}
      <div className="flex-shrink-0 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6">
        <FleetVesselContextBar
          isAllVessels={isAllVessels}
          onAllVesselsChange={handleAllVesselsChange}
          vesselId={vesselId}
          onVesselChange={handleVesselChange}
          vessels={vessels}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto" style={{ background: '#F4F6F9' }}>

        {/* MANAGEMENT TAB: Fleet Benchmarking Table */}
        {activeTab === 'management' && vessels.length > 0 && (
          <div style={{ padding: '16px' }}>
            <FleetView vessels={vessels} onSelectVessel={handleFleetVesselSelect} />
          </div>
        )}

        {/* OVERVIEW TAB: 3-Column Layout */}
        {activeTab === 'overview' && (
          <div
            className="grid grid-cols-1 lg:grid-cols-[25%_1px_40%_1px_1fr]"
            style={{ minHeight: '100%' }}
          >
            {/* ═══ COLUMN 1: WORK ORDER KPIs ═══ */}
            <div className="lg:overflow-y-auto" data-testid="column-wo-kpis">
              <div style={sectionHeaderBar}>WORK ORDER KPIs</div>

              <SemiCircleGauge
                value={workOrderKPIs.overdue}
                max={workOrderKPIs.total || 10}
                color="#E53935"
                label="Overdue WOs"
                displayValue={workOrderKPIs.overdue.toString()}
                subtitle={`${overduePercent}% of total`}
                statLine={`Due: ${workOrderKPIs.due} · Pending: ${workOrderKPIs.pendingApproval}`}
                onClick={() => navigateToWorkOrders('Overdue')}
                testId="gauge-overdue-wo"
              />

              <div style={dividerH} />

              <SemiCircleGauge
                value={workOrderKPIs.completed}
                max={workOrderKPIs.total || 10}
                color="#2E7D32"
                label="Completion Rate"
                displayValue={workOrderKPIs.completed.toString()}
                subtitle={`${completionRate}% completion rate`}
                statLine={`Total: ${workOrderKPIs.total} · Active: ${workOrderKPIs.active}`}
                onClick={() => navigateToWorkOrders('Completed')}
                testId="gauge-completion-rate"
              />

              <div style={dividerH} />

              <SemiCircleGauge
                value={outstandingTasksChartData.outstandingCount}
                max={outstandingTasksChartData.totalMonthly || 10}
                color="#F57C00"
                label="Outstanding Tasks"
                displayValue={`${outstandingTasksChartData.outstandingPercent}%`}
                subtitle={`${outstandingTasksChartData.outstandingCount} of ${outstandingTasksChartData.totalMonthly} tasks`}
                statLine={`Tasks: ${outstandingTasksChartData.outstandingCount}/${outstandingTasksChartData.totalMonthly} · vs last month: ${maintenanceTrendData.delta > 0 ? '+' : ''}${maintenanceTrendData.delta}%`}
                onClick={() => navigateToWorkOrders('Planned')}
                testId="gauge-outstanding-tasks"
              />
            </div>

            {/* Vertical Divider 1 */}
            <div className="hidden lg:block" style={{ background: '#e8e8e8', width: '1px' }} />

            {/* ═══ COLUMN 2: WORK ORDER STATUS & TRENDS ═══ */}
            <div className="lg:overflow-y-auto" data-testid="column-wo-status-trends">
              <div style={sectionHeaderBar}>WORK ORDER STATUS & TRENDS</div>

              {/* Status Distribution Donut Chart — NO progress bars */}
              <div style={{ padding: '16px' }}>
                <div style={subTitle} className="mb-1">Status Distribution</div>
                <div style={{ fontSize: '11px', color: '#9E9E9E', marginBottom: '8px' }}>Click segments to filter</div>
                <div style={{ height: '250px' }} data-testid="card-wo-status-chart">
                  {workOrderStatusChartData.length > 0 ? (
                    <AgCharts options={{
                      data: workOrderStatusChartData,
                      series: [{
                        type: 'donut',
                        angleKey: 'count',
                        calloutLabelKey: 'status',
                        sectorLabelKey: 'count',
                        innerRadiusRatio: 0.6,
                        fills: workOrderStatusChartData.map(d => d.color),
                        strokes: workOrderStatusChartData.map(d => d.color),
                        listeners: {
                          nodeClick: (event: any) => {
                            const status = event.datum.status;
                            if (status === 'Overdue') navigateToWorkOrders('Overdue');
                            else if (status === 'Due') navigateToWorkOrders('Due');
                            else if (status === 'Pending Approval') navigateToWorkOrders('Pending Approval');
                            else if (status === 'Completed') navigateToWorkOrders('Completed');
                            else navigateToWorkOrders('Planned');
                          }
                        }
                      } as any],
                      legend: { enabled: true, position: 'bottom' }
                    } as AgChartOptions} />
                  ) : (
                    <div className="h-full flex items-center justify-center" style={{ color: '#9E9E9E' }}>No work orders to display</div>
                  )}
                </div>
              </div>

              <div style={dividerH} />

              {/* 6-Month Maintenance Trend — LINE/AREA chart with zone bands */}
              <div style={{ padding: '16px' }}>
                <div style={subTitle} className="mb-1">6-MONTH MAINTENANCE TREND</div>
                {maintenanceTrendData.months.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div style={{ height: '180px' }} data-testid="chart-maintenance-trend">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={maintenanceTrendData.months} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                          <defs>
                            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#1565C0" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#1565C0" stopOpacity={0.05}/>
                            </linearGradient>
                          </defs>
                          <ReferenceArea y1={0} y2={30} fill="#E8F5E9" fillOpacity={0.5} />
                          <ReferenceArea y1={30} y2={60} fill="#FFF3E0" fillOpacity={0.5} />
                          <ReferenceArea y1={60} y2={100} fill="#FFEBEE" fillOpacity={0.5} />
                          <XAxis dataKey="monthShort" tick={{ fontSize: 11, fill: '#757575' }} tickLine={false} axisLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#757575' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                  <div style={{ background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', padding: '8px 12px' }} data-testid="tooltip-trend-line">
                                    <div className="font-semibold text-xs mb-1" style={{ color: '#212121' }}>{d.month}</div>
                                    <div className="text-xs" style={{ color: '#616161' }}>Total planned: {d.totalPlanned}</div>
                                    <div className="text-xs" style={{ color: '#616161' }}>Completed: {d.completed}</div>
                                    <div className="text-xs" style={{ color: '#616161' }}>Outstanding: {d.outstandingPercent}%</div>
                                    <div className="text-xs" style={{ color: '#616161' }}>Overdue: {d.overdue}</div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="outstandingPercent"
                            stroke="#1565C0"
                            strokeWidth={2.5}
                            fill="url(#trendFill)"
                            dot={{ r: 4, fill: '#1565C0', stroke: '#FFFFFF', strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: '#1565C0' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-center gap-4 text-xs" style={{ color: '#757575' }} data-testid="legend-maintenance-trend">
                      <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#2E7D32' }} /><span>Healthy (&lt;30%)</span></div>
                      <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#F57C00' }} /><span>Watch (30–60%)</span></div>
                      <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#E53935' }} /><span>Backlog (&gt;60%)</span></div>
                    </div>
                  </div>
                ) : (
                  <div style={{ height: '180px' }} className="flex items-center justify-center" ><span style={{ color: '#9E9E9E', fontSize: '12px' }}>No trend data available</span></div>
                )}
              </div>

              <div style={dividerH} />

              {/* Overdue Work Orders Table */}
              <div style={{ padding: '16px' }} data-testid="card-overdue-table">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={subTitle}>OVERDUE WORK ORDERS</div>
                  {workOrderKPIs.overdue > 0 && (
                    <button
                      onClick={() => navigateToWorkOrders('Overdue')}
                      style={{ fontSize: '11px', color: '#1565C0', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                      data-testid="button-view-all-overdue"
                    >
                      View All ({workOrderKPIs.overdue})
                    </button>
                  )}
                </div>
                {workOrderKPIs.overdue > 0 && (
                  <div style={{ fontSize: '11px', color: '#9E9E9E', marginBottom: '6px' }}>
                    Showing top {workOrderKPIs.overdueList.length} of {workOrderKPIs.overdue} total
                  </div>
                )}
                <div style={{ ...contentCard, padding: 0, overflow: 'hidden' }}>
                  {workOrderKPIs.overdueList.length > 0 ? (
                    <table className="w-full text-sm" data-testid="table-overdue-wo">
                      <thead>
                        <tr>
                          <th className="text-left py-2 px-3" style={tableHeaderStyle}>Work Order</th>
                          <th className="text-left py-2 px-3" style={tableHeaderStyle}>Equipment</th>
                          <th className="text-left py-2 px-3" style={tableHeaderStyle}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workOrderKPIs.overdueList.map((wo: any, idx: number) => (
                          <tr
                            key={wo.id}
                            className="cursor-pointer"
                            style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#E3F2FD')}
                            onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB')}
                            onClick={() => navigateToWorkOrder(wo.id)}
                            data-testid={`row-overdue-wo-${wo.id}`}
                          >
                            <td className="py-2 px-3" style={{ fontSize: '11px', color: '#212121', fontWeight: 500, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {wo.workOrderNumber || `WO-${wo.id}`}
                            </td>
                            <td className="py-2 px-3" style={{ fontSize: '11px', color: '#616161', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {wo.taskDescription || wo.jobTitle || 'No description'}
                            </td>
                            <td className="py-2 px-3">
                              <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, color: '#FFFFFF', background: '#E53935' }}>Overdue</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-6" style={{ color: '#9E9E9E' }}>
                      <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: '#2E7D32' }} />
                      <p style={{ fontSize: '12px' }}>No overdue work orders</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Vertical Divider 2 */}
            <div className="hidden lg:block" style={{ background: '#e8e8e8', width: '1px' }} />

            {/* ═══ COLUMN 3: INVENTORY & FLEET ANALYSIS ═══ */}
            <div className="lg:overflow-y-auto" data-testid="column-inventory-fleet">
              <div style={sectionHeaderBar}>INVENTORY & FLEET ANALYSIS</div>

              {/* Inventory Quick Stats */}
              <div data-testid="card-quick-stats">
                {[
                  { label: 'Total Spares', value: sparesKPIs.total, color: '#37474F', onClick: () => navigateToSpares() },
                  { label: 'Low Stock', value: sparesKPIs.lowStock, color: '#E53935', onClick: () => navigateToSpares('Low') },
                  { label: 'Critical Low Stock', value: sparesKPIs.criticalLowStock, color: '#E53935', onClick: () => navigateToSpares('Low') },
                  { label: 'Total Components', value: componentsKPIs.total, color: '#37474F', onClick: navigateToComponents },
                  { label: 'Stores Inventory', value: storesKPIs.total, color: '#37474F', onClick: () => navigateToStores() },
                ].map((item, idx) => (
                  <div key={item.label}>
                    <div
                      style={statRow}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={item.onClick}
                      data-testid={`row-stat-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                    >
                      <span style={{ fontSize: '12px', color: '#757575' }}>{item.label}</span>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '36px',
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#FFFFFF',
                        background: item.color,
                      }}>{item.value}</span>
                    </div>
                    {idx < 4 && <div style={{ borderBottom: '1px solid #EEEEEE' }} />}
                  </div>
                ))}
              </div>

              <div style={dividerH} />

              {/* Spares Stock Status donut */}
              <div style={{ padding: '16px' }} data-testid="card-spares-status-chart">
                <div style={subTitle} className="mb-1">SPARES STOCK STATUS</div>
                <div style={{ height: '200px' }}>
                  {sparesStockChartData.length > 0 ? (
                    <AgCharts options={{
                      data: sparesStockChartData,
                      series: [{
                        type: 'donut',
                        angleKey: 'count',
                        calloutLabelKey: 'status',
                        sectorLabelKey: 'count',
                        innerRadiusRatio: 0.6,
                        fills: sparesStockChartData.map(d => d.color),
                        strokes: sparesStockChartData.map(d => d.color),
                        listeners: {
                          nodeClick: (event: any) => {
                            navigateToSpares(event.datum.status);
                          }
                        }
                      } as any],
                      legend: { enabled: true, position: 'bottom' }
                    } as AgChartOptions} />
                  ) : (
                    <div className="h-full flex items-center justify-center" style={{ color: '#9E9E9E', fontSize: '12px' }}>No spares data</div>
                  )}
                </div>
              </div>

              <div style={dividerH} />

              {/* Vessel / Fleet Analysis Dot Matrix — with real data colors and column headers */}
              <div style={{ padding: '16px' }} data-testid="card-dot-matrix">
                <div style={subTitle} className="mb-2">VESSEL / GROUP ANALYSIS</div>
                {dotMatrixVesselData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '4px 6px', color: '#757575', fontWeight: 600, fontSize: '10px' }}>Metric</th>
                          {dotMatrixVesselData.map(v => (
                            <th key={v.id} style={{
                              textAlign: 'center',
                              padding: '4px 3px',
                              color: '#546E7A',
                              fontWeight: 600,
                              fontSize: '9px',
                              maxWidth: '55px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              borderBottom: '1px solid #E0E0E0',
                            }}>
                              {v.name.length > 8 ? v.name.substring(0, 7) + '..' : v.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {['Work Orders', 'Overdue WOs', 'Low Stock', 'Spares', 'Running Hrs'].map(metric => (
                          <tr key={metric}>
                            <td style={{ padding: '6px 6px', color: '#424242', fontWeight: 500, whiteSpace: 'nowrap', fontSize: '11px' }}>{metric}</td>
                            {dotMatrixVesselData.map((v, vIdx) => {
                              const dotColor = getDotColor(vIdx, metric);
                              return (
                                <td key={v.id} style={{ textAlign: 'center', padding: '6px 4px' }}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      width: '12px',
                                      height: '12px',
                                      borderRadius: '50%',
                                      background: dotColor,
                                    }}
                                    title={`${v.name} - ${metric}`}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4" style={{ color: '#9E9E9E', fontSize: '12px' }}>
                    No vessel data available for analysis
                  </div>
                )}
              </div>

              <div style={dividerH} />

              {/* Watch List */}
              <div style={{ padding: '16px' }} data-testid="card-watch-list">
                <div style={subTitle} className="mb-2">WATCH LIST</div>
                {watchListItems.length > 0 ? (
                  <div>
                    {watchListItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < watchListItems.length - 1 ? '1px solid #EEEEEE' : 'none' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', color: '#212121', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                          {item.vessel && <div style={{ fontSize: '10px', color: '#9E9E9E' }}>{item.vessel}</div>}
                        </div>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, color: '#FFFFFF', background: item.badgeColor, flexShrink: 0 }}>{item.badge}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => navigateToWorkOrders('Overdue')}
                      style={{ display: 'block', width: '100%', textAlign: 'center', fontSize: '11px', color: '#1565C0', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', marginTop: '8px', padding: '4px' }}
                      data-testid="button-view-all-watchlist"
                    >
                      View All
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4" style={{ color: '#9E9E9E', fontSize: '12px' }}>
                    <CheckCircle className="w-6 h-6 mx-auto mb-1" style={{ color: '#2E7D32' }} />
                    No items requiring attention
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pending Approval Section (Head of Dept) - shown below layout */}
        {activeTab === 'overview' && isHeadOfDept && workOrderKPIs.pendingApproval > 0 && (
          <div style={{ padding: '16px', borderTop: '1px solid #e8e8e8' }}>
            <div style={{ ...contentCard, padding: 0, overflow: 'hidden' }} data-testid="card-pending-approval-section">
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
    </div>
  );
};

export default Dashboard;
