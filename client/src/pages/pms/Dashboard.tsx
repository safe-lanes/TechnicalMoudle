import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useVessel } from "@/contexts/VesselContext";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Package,
  Clock,
  Ship,
  Wrench,
  ClipboardList,
  Box,
  Gauge,
  FileText,
  ChevronRight,
  AlertCircle,
  RotateCcw,
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
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Cell, Legend, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkOrder } from "@shared/schema";
import { useVessels } from "@/hooks/useVessels";
import { BulkApproveModal } from "@/components/BulkApproveModal";

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
    <Card data-testid="card-fleet-view" className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5" />
          Fleet Comparison — Vessel Benchmarking
        </CardTitle>
        <CardDescription>
          All vessels ranked by maintenance KPIs. Click a vessel name to view its dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-fleet-comparison">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {columns.map(col => (
                  <th
                    key={col.field}
                    className="text-left py-3 px-3 font-medium text-gray-600 dark:text-gray-400 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort(col.field)}
                    data-testid={`th-sort-${col.field}`}
                  >
                    <span className="flex items-center">
                      {col.label}
                      <SortIcon field={col.field} />
                    </span>
                  </th>
                ))}
                <th className="text-left py-3 px-3 font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((v, idx) => {
                const status = getFleetStatus(v.overduePercent);
                return (
                  <tr
                    key={v.vesselId}
                    className={`border-b border-gray-100 dark:border-gray-800 ${idx % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-900/30' : ''}`}
                    data-testid={`row-fleet-vessel-${v.vesselId}`}
                  >
                    <td className="py-3 px-3">
                      <button
                        className="font-medium text-blue-600 dark:text-blue-400 hover:underline text-left"
                        onClick={() => onSelectVessel(v.vesselId)}
                        data-testid={`button-select-vessel-${v.vesselId}`}
                      >
                        {v.vesselName}
                      </button>
                    </td>
                    <td className="py-3 px-3" data-testid={`cell-overdue-percent-${v.vesselId}`}>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <span className="w-10 text-right font-mono font-medium">{v.overduePercent}%</span>
                        <div className="flex-1">
                          <InlineBar value={v.overduePercent} colorClass={getBarColor(v.overduePercent)} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3" data-testid={`cell-outstanding-percent-${v.vesselId}`}>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <span className="w-10 text-right font-mono font-medium">{v.outstandingPercent}%</span>
                        <div className="flex-1">
                          <InlineBar value={v.outstandingPercent} colorClass={getBarColor(v.outstandingPercent)} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3" data-testid={`cell-compliance-percent-${v.vesselId}`}>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <span className="w-10 text-right font-mono font-medium">{v.compliancePercent}%</span>
                        <div className="flex-1">
                          <InlineBar value={v.compliancePercent} colorClass={getBarColor(v.compliancePercent, true)} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-medium" data-testid={`cell-low-stock-${v.vesselId}`}>
                      <span className={v.lowStockItems > 0 ? 'text-amber-600' : 'text-gray-500'}>{v.lowStockItems}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-medium" data-testid={`cell-overdue-count-${v.vesselId}`}>
                      <span className={v.overdueCount > 0 ? 'text-red-600' : 'text-gray-500'}>{v.overdueCount}</span>
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
                  <td colSpan={7} className="py-12 text-center text-gray-500">No vessel data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const [, setLocation] = useLocation();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [bulkApproveModalOpen, setBulkApproveModalOpen] = useState(false);
  const [isFleetView, setIsFleetView] = useState(false);
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
      { status: 'Overdue', count: workOrderKPIs.overdue, color: '#ef4444' },
      { status: 'Due', count: workOrderKPIs.due, color: '#f59e0b' },
      { status: 'Pending Approval', count: workOrderKPIs.pendingApproval, color: '#3b82f6' },
      { status: 'Completed', count: workOrderKPIs.completed, color: '#10b981' }
    ].filter(d => d.count > 0);
  }, [workOrderKPIs]);

  // Spares Stock Status chart data
  const sparesStockChartData = useMemo(() => {
    const ok = sparesData.filter(s => getStockStatus(s.rob, s.min).label === 'OK').length;
    const atMin = sparesData.filter(s => getStockStatus(s.rob, s.min).label === 'At Min').length;
    const low = sparesData.filter(s => getStockStatus(s.rob, s.min).label === 'Low').length;
    
    return [
      { status: 'OK', count: ok, color: '#10b981' },
      { status: 'At Min', count: atMin, color: '#f59e0b' },
      { status: 'Low', count: low, color: '#ef4444' }
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
        { status: 'Outstanding', count: outstandingCount, percent: outstandingPercent, color: '#ef4444' },
        { status: 'Completed', count: completedCount, percent: completedPercent, color: '#10b981' }
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
    if (newVesselId !== 'all') {
      setIsFleetView(false);
    }
  };

  const handleFleetVesselSelect = (selectedVesselId: string) => {
    setVesselId(selectedVesselId);
    setIsFleetView(false);
  };

  const handleRefresh = () => {
    setLastUpdated(new Date());
    window.location.reload();
  };

  const isLoading = isWorkOrdersLoading || isSparesLoading || isStoresLoading || isComponentsLoading || isRHLoading || isSparesHistoryLoading;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header - Fixed */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-dashboard-title">PMS Dashboard</h1>
        </div>

        {/* Vessel Selector + Fleet View Toggle - Visible for Sail Admin and Client Admin */}
        {(isSailAdmin || isClientAdmin) && (
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Ship className="w-4 h-4 text-gray-500" />
              <Select value={vesselId} onValueChange={handleVesselChange}>
                <SelectTrigger className="w-48" data-testid="select-vessel">
                  <SelectValue placeholder="Select vessel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-all-vessels">
                    All Vessels
                  </SelectItem>
                  {vessels.map(vessel => (
                    <SelectItem key={vessel.id} value={vessel.id}>
                      {vessel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {vessels.length > 1 && (
              <Button
                variant={isFleetView ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsFleetView(!isFleetView)}
                data-testid="button-toggle-fleet-view"
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                {isFleetView ? 'Vessel View' : 'Fleet View'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto space-y-6">

        {/* Fleet View Mode */}
        {isFleetView && vessels.length > 0 && (
          <FleetView vessels={vessels} onSelectVessel={handleFleetVesselSelect} />
        )}

        {/* Single Vessel Dashboard */}
        {!isFleetView && (<>
        
        {/* Work Order Status KPI Cards - Clickable */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-red-500 bg-white"
            onClick={() => navigateToWorkOrders('Overdue')}
            data-testid="card-overdue-wo"
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Overdue Work Orders
              </CardDescription>
              <CardTitle className="text-3xl text-red-600">{workOrderKPIs.overdue}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-red-600">
                <ChevronRight className="w-4 h-4" />
                <span>View all overdue</span>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-amber-500 bg-white"
            onClick={() => navigateToWorkOrders('Due')}
            data-testid="card-due-wo"
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-amber-500" />
                Due Work Orders
              </CardDescription>
              <CardTitle className="text-3xl text-amber-600">{workOrderKPIs.due}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-amber-600">
                <ChevronRight className="w-4 h-4" />
                <span>View all due</span>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-blue-500 bg-white"
            onClick={() => navigateToWorkOrders('Pending Approval')}
            data-testid="card-pending-approval-wo"
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <ClipboardList className="w-4 h-4 text-blue-500" />
                Pending Approval
              </CardDescription>
              <CardTitle className="text-3xl text-blue-600">{workOrderKPIs.pendingApproval}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-blue-600">
                <ChevronRight className="w-4 h-4" />
                <span>Review pending</span>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-green-500 bg-white"
            onClick={() => navigateToWorkOrders('Completed')}
            data-testid="card-completed-wo"
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Completed
              </CardDescription>
              <CardTitle className="text-3xl text-green-600">{workOrderKPIs.completed}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-green-600">
                <ChevronRight className="w-4 h-4" />
                <span>View completed</span>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-gray-400 bg-white"
            onClick={() => navigateToWorkOrders('Planned')}
            data-testid="card-total-wo"
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Wrench className="w-4 h-4 text-gray-500" />
                Total Work Orders
              </CardDescription>
              <CardTitle className="text-3xl">{workOrderKPIs.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-gray-600">
                <ChevronRight className="w-4 h-4" />
                <span>View all work orders</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row - Work Order Status, Outstanding Tasks, Maintenance Trend, and Spares Stock */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Work Order Status Donut - Clickable */}
          <Card data-testid="card-wo-status-chart" className="bg-white">
            <CardHeader>
              <CardTitle>Work Order Status Distribution</CardTitle>
              <CardDescription>Click segments to view filtered work orders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
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
                  <div className="h-full flex items-center justify-center text-gray-500">
                    No work orders to display
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 1: Outstanding Tasks — Donut + Percentage + Trend Delta */}
          <Card data-testid="card-outstanding-tasks-chart" className="bg-white">
            <CardHeader>
              <CardTitle>Outstanding Tasks</CardTitle>
              <CardDescription>
                {outstandingTasksChartData.totalMonthly > 0 
                  ? `${outstandingTasksChartData.outstandingCount} of ${outstandingTasksChartData.totalMonthly} tasks outstanding`
                  : 'No planned maintenance tasks this month'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {outstandingTasksChartData.data.length > 0 ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-52 w-full">
                    <AgCharts options={{
                      data: outstandingTasksChartData.data,
                      series: [{
                        type: 'donut',
                        angleKey: 'count',
                        calloutLabelKey: 'status',
                        sectorLabelKey: 'percent',
                        sectorLabel: {
                          formatter: (params: any) => `${params.datum.percent}%`
                        },
                        innerRadiusRatio: 0.6,
                        fills: outstandingTasksChartData.data.map(d => d.color),
                        strokes: outstandingTasksChartData.data.map(d => d.color),
                        listeners: {
                          nodeClick: (event: any) => {
                            const status = event.datum.status;
                            if (status === 'Outstanding') {
                              navigateToWorkOrders('Planned');
                            } else {
                              navigateToWorkOrders('Completed');
                            }
                          }
                        }
                      } as any],
                      legend: { enabled: true, position: 'bottom' },
                      padding: { top: 0, bottom: 0, left: 0, right: 0 }
                    } as AgChartOptions} />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-3xl font-bold" data-testid="text-outstanding-percent">{outstandingTasksChartData.outstandingPercent}%</span>
                    {maintenanceTrendData.delta !== 0 && (
                      <div 
                        className={`flex items-center gap-1 mt-1 text-sm font-medium ${maintenanceTrendData.delta > 0 ? 'text-red-600' : 'text-green-600'}`}
                        data-testid="text-trend-delta"
                      >
                        {maintenanceTrendData.delta > 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        <span>{Math.abs(maintenanceTrendData.delta)}% vs last month</span>
                      </div>
                    )}
                    {maintenanceTrendData.delta === 0 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1" data-testid="text-trend-delta">No change vs last month</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  No planned maintenance tasks this month
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: 6-Month Maintenance Trend — Sparkline Bar Chart */}
          <Card data-testid="card-maintenance-trend" className="bg-white">
            <CardHeader>
              <CardTitle>6-Month Maintenance Trend</CardTitle>
              <CardDescription>Outstanding tasks % over time</CardDescription>
            </CardHeader>
            <CardContent>
              {maintenanceTrendData.months.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <div className="h-52" data-testid="chart-maintenance-trend">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={maintenanceTrendData.months} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <XAxis dataKey="monthShort" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-md p-2 text-xs text-gray-900 dark:text-gray-100" data-testid="tooltip-trend-bar">
                                  <div className="font-semibold mb-1">{d.month}</div>
                                  <div>Total planned: {d.totalPlanned}</div>
                                  <div>Completed: {d.completed}</div>
                                  <div>Outstanding: {d.outstandingPercent}%</div>
                                  <div>Overdue: {d.overdue}</div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="outstandingPercent" radius={[3, 3, 0, 0]} maxBarSize={32}>
                          {maintenanceTrendData.months.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.outstandingPercent > 60 ? '#ef4444' : entry.outstandingPercent >= 30 ? '#f59e0b' : '#10b981'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center gap-4 text-xs text-gray-600 dark:text-gray-400" data-testid="legend-maintenance-trend">
                    <div className="flex items-center gap-1" data-testid="legend-item-healthy">
                      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#10b981' }} />
                      <span>Healthy (&lt;30%)</span>
                    </div>
                    <div className="flex items-center gap-1" data-testid="legend-item-watch">
                      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#f59e0b' }} />
                      <span>Watch (30–60%)</span>
                    </div>
                    <div className="flex items-center gap-1" data-testid="legend-item-backlog">
                      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
                      <span>Backlog (&gt;60%)</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  No trend data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Spares Stock Status Donut - Clickable */}
          <Card data-testid="card-spares-status-chart" className="bg-white">
            <CardHeader>
              <CardTitle>Spares Stock Status</CardTitle>
              <CardDescription>Click segments to view filtered spares</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
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
                          const status = event.datum.status;
                          navigateToSpares(status);
                        }
                      }
                    } as any],
                    legend: { enabled: true, position: 'bottom' }
                  } as AgChartOptions} />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    No spares to display
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Head of Dept Approval Section - Only visible to Head of Dept */}
        {isHeadOfDept && workOrderKPIs.pendingApproval > 0 && (
          <Card data-testid="card-pending-approval-section" className="bg-white border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-500" />
                  Work Orders Pending Your Approval
                </CardTitle>
                <CardDescription>
                  {workOrderKPIs.pendingApproval} work orders from {currentVessel?.name || 'vessel'} require your review
                </CardDescription>
              </div>
              <Button 
                onClick={() => setBulkApproveModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-bulk-approve-open"
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                Bulk Approve ({workOrderKPIs.pendingApproval})
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {workOrderKPIs.pendingApprovalList.map((wo: any) => (
                  <div 
                    key={wo.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${wo.wasRejected ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}
                    data-testid={`row-pending-approval-wo-${wo.id}`}
                  >
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => navigateToWorkOrder(wo.id)}
                    >
                      <div className={`font-medium text-sm ${wo.wasRejected ? 'text-red-700' : ''}`}>
                        {wo.workOrderNo || `WO-${wo.id}`}
                        {wo.wasRejected && (
                          <Badge variant="destructive" className="ml-2 text-xs">Resubmitted</Badge>
                        )}
                      </div>
                      <div className={`text-xs ${wo.wasRejected ? 'text-red-600' : 'text-gray-600'}`}>
                        {wo.jobTitle || 'No description'} - {wo.component}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Assigned: {wo.assignedTo} | Submitted: {wo.submittedDate ? new Date(wo.submittedDate).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigateToWorkOrder(wo.id)}
                        data-testid={`button-view-pending-wo-${wo.id}`}
                      >
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
                        className="text-red-600 hover:bg-red-50"
                        disabled={rejectMutation.isPending}
                        data-testid={`button-reject-wo-${wo.id}`}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate(wo.id)}
                        className="bg-green-600 hover:bg-green-700"
                        disabled={approveMutation.isPending}
                        data-testid={`button-approve-wo-${wo.id}`}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
                {workOrderKPIs.pendingApproval > 5 && (
                  <div className="text-center pt-2">
                    <Button
                      variant="link"
                      onClick={() => setBulkApproveModalOpen(true)}
                      className="text-blue-600"
                    >
                      View all {workOrderKPIs.pendingApproval} pending work orders
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actionable Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overdue Work Orders Table */}
          <Card data-testid="card-overdue-table" className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Overdue Work Orders
                </CardTitle>
                <CardDescription>Immediate attention required</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigateToWorkOrders('Overdue')}
                data-testid="button-view-all-overdue"
              >
                View All ({workOrderKPIs.overdue})
              </Button>
            </CardHeader>
            <CardContent>
              {workOrderKPIs.overdueList.length > 0 ? (
                <div className="space-y-2">
                  {workOrderKPIs.overdueList.map((wo: any) => (
                    <div 
                      key={wo.id}
                      className="flex items-center justify-between p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                      onClick={() => navigateToWorkOrder(wo.id)}
                      data-testid={`row-overdue-wo-${wo.id}`}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{wo.workOrderNumber || `WO-${wo.id}`}</div>
                        <div className="text-xs text-gray-600">{wo.taskDescription || wo.jobTitle || 'No description'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-500 text-white">Overdue</Badge>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>No overdue work orders</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock Spares Table */}
          <Card data-testid="card-low-stock-table" className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Low Stock Spares
                </CardTitle>
                <CardDescription>Reorder recommended</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigateToSpares('Low')}
                data-testid="button-view-all-low-stock"
              >
                View All ({sparesKPIs.lowStock})
              </Button>
            </CardHeader>
            <CardContent>
              {sparesKPIs.lowStockList.length > 0 ? (
                <div className="space-y-2">
                  {sparesKPIs.lowStockList.map((spare: Spare) => (
                    <div 
                      key={spare.id}
                      className="flex items-center justify-between p-3 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors"
                      onClick={() => navigateToSpares('Low')}
                      data-testid={`row-low-stock-spare-${spare.id}`}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{spare.partName}</div>
                        <div className="text-xs text-gray-600">{spare.partNumber}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">ROB: {spare.rob} / Min: {spare.min}</span>
                        {(spare.critical === 'Critical' || spare.critical === 'Yes') && (
                          <Badge className="bg-red-500 text-white text-xs">Critical</Badge>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>All spares adequately stocked</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sub-Module Summary Cards - All Clickable */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Components Card */}
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow bg-white"
            onClick={navigateToComponents}
            data-testid="card-components-summary"
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Box className="w-4 h-4 text-blue-500" />
                Components
              </CardDescription>
              <CardTitle className="text-2xl">{componentsKPIs.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{componentsKPIs.active} active</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          {/* Spares Card */}
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow bg-white"
            onClick={() => navigateToSpares()}
            data-testid="card-spares-summary"
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Package className="w-4 h-4 text-purple-500" />
                Spares Inventory
              </CardDescription>
              <CardTitle className="text-2xl">{sparesKPIs.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  <span className={sparesKPIs.lowStock > 0 ? 'text-red-500 font-medium' : 'text-gray-500'}>
                    {sparesKPIs.lowStock} low stock
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          {/* Stores Card */}
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow bg-white"
            onClick={() => navigateToStores()}
            data-testid="card-stores-summary"
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Box className="w-4 h-4 text-teal-500" />
                Stores Inventory
              </CardDescription>
              <CardTitle className="text-2xl">{storesKPIs.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  <span className={storesKPIs.lowStock > 0 ? 'text-amber-500 font-medium' : 'text-gray-500'}>
                    {storesKPIs.lowStock} low stock
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          {/* Running Hours Card */}
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow bg-white"
            onClick={navigateToRunningHours}
            data-testid="card-running-hours-summary"
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Gauge className="w-4 h-4 text-orange-500" />
                Running Hours
              </CardDescription>
              <CardTitle className="text-2xl">{runningHoursKPIs.totalComponents}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{runningHoursKPIs.totalTracked} master, {runningHoursKPIs.totalInherited} inherited</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${runningHoursKPIs.recentlyUpdated > 0 ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                    {runningHoursKPIs.recentlyUpdated} updated this week
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stores Breakdown */}
        <Card data-testid="card-stores-breakdown" className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="w-5 h-5 text-teal-500" />
              Stores Inventory Breakdown
            </CardTitle>
            <CardDescription>Click on category to view</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div 
                className="p-4 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors text-center"
                onClick={() => navigateToStores('stores')}
                data-testid="card-stores-tab"
              >
                <div className="text-2xl font-bold text-blue-600">{storesKPIs.stores}</div>
                <div className="text-sm text-gray-600">Stores</div>
              </div>
              <div 
                className="p-4 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors text-center"
                onClick={() => navigateToStores('lubes')}
                data-testid="card-lubes-tab"
              >
                <div className="text-2xl font-bold text-amber-600">{storesKPIs.lubes}</div>
                <div className="text-sm text-gray-600">Lubes</div>
              </div>
              <div 
                className="p-4 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition-colors text-center"
                onClick={() => navigateToStores('chemicals')}
                data-testid="card-chemicals-tab"
              >
                <div className="text-2xl font-bold text-green-600">{storesKPIs.chemicals}</div>
                <div className="text-sm text-gray-600">Chemicals</div>
              </div>
              <div 
                className="p-4 bg-purple-50 rounded-lg cursor-pointer hover:bg-purple-100 transition-colors text-center"
                onClick={() => navigateToStores('others')}
                data-testid="card-others-tab"
              >
                <div className="text-2xl font-bold text-purple-600">{storesKPIs.others}</div>
                <div className="text-sm text-gray-600">Others</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Spares Movement Trend */}
        <div className="grid grid-cols-1 gap-6">
          <Card data-testid="card-spares-consumption-trend" className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-500" />
                6-Month Spares Movement Trend
              </CardTitle>
              <CardDescription>Consumption vs receiving activity over time</CardDescription>
            </CardHeader>
            <CardContent>
              {sparesConsumptionTrendData.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <div className="h-52" data-testid="chart-spares-consumption-trend">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sparesConsumptionTrendData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                        <XAxis dataKey="monthShort" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-md p-2 text-xs text-gray-900 dark:text-gray-100" data-testid="tooltip-spares-consumption">
                                  <div className="font-semibold mb-1">{d.month}</div>
                                  <div className="text-red-600">Consumed: {d.consumeEvents} events ({d.totalQty} units)</div>
                                  <div className="text-green-600">Received: {d.receiveEvents} events ({d.receiveQty} units)</div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '11px' }}
                          formatter={(value) => value === 'consumeEvents' ? 'Consumed' : 'Received'}
                        />
                        <Bar dataKey="consumeEvents" name="consumeEvents" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={24} />
                        <Bar dataKey="receiveEvents" name="receiveEvents" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="h-52 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  No spares history data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        </>)}
      </div>

      {/* Bulk Approve Modal for Head of Dept */}
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
