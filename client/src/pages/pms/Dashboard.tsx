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
import { FleetVesselContextBar } from "@/components/FleetVesselContextBar";

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

  const summaryLine = useMemo(() => {
    const scope = isFleetView ? "Fleet" : (currentVessel?.name || "No vessel");
    const parts: string[] = [`Scope: ${scope}`];
    if (!isFleetView) {
      parts.push(`${workOrderKPIs.total} work orders`);
      parts.push(`${sparesKPIs.total} spares`);
      parts.push(`${componentsKPIs.total} components`);
    } else {
      parts.push(`${vessels.length} vessels`);
    }
    parts.push(`Data as of ${format(lastUpdated, 'dd MMM yyyy, HH:mm')}`);
    return parts.join(' \u00b7 ');
  }, [isFleetView, currentVessel, workOrderKPIs.total, sparesKPIs.total, componentsKPIs.total, vessels.length, lastUpdated]);

  const criticalIssues = workOrderKPIs.overdue + sparesKPIs.criticalLowStock;

  const overduePercent = workOrderKPIs.total > 0 ? Math.round((workOrderKPIs.overdue / workOrderKPIs.total) * 100) : 0;
  const completionRate = workOrderKPIs.total > 0 ? Math.round((workOrderKPIs.completed / workOrderKPIs.total) * 100) : 0;

  const cardStyle = {
    background: '#FFFFFF',
    borderRadius: '8px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    border: 'none',
  };

  const sectionTitleStyle: React.CSSProperties = {
    color: '#1565C0',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  };

  const sectionBarStyle: React.CSSProperties = {
    background: '#EEF2FF',
    padding: '10px 16px',
    borderRadius: '6px',
    marginBottom: '12px',
  };

  const tableHeaderStyle: React.CSSProperties = {
    background: '#1565C0',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* SECTION 1: PAGE HEADER BAR */}
      <div className="flex-shrink-0 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6">
        {(isSailAdmin || isClientAdmin) ? (
          <FleetVesselContextBar
            isFleetView={isFleetView}
            onViewModeChange={(isFleet) => setIsFleetView(isFleet)}
            vesselId={vesselId}
            onVesselChange={handleVesselChange}
            vessels={vessels}
            summaryLine={summaryLine}
          />
        ) : (
          <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E0E0E0' }} className="px-5 py-3">
            <h1 className="text-base font-bold" style={{ color: '#212121' }} data-testid="text-dashboard-title">PMS Dashboard</h1>
            <p className="text-xs mt-0.5" style={{ color: '#9E9E9E' }} data-testid="text-hero-summary">{summaryLine}</p>
          </div>
        )}
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto" style={{ background: '#F4F6F9', padding: '16px' }}>
        <div className="space-y-4 max-w-[1400px] mx-auto">

        {/* Fleet View Mode */}
        {isFleetView && vessels.length > 0 && (
          <FleetView vessels={vessels} onSelectVessel={handleFleetVesselSelect} />
        )}

        {!isFleetView && (<>

        {/* ═══ SECTION 2: EXECUTIVE SUMMARY ═══ */}
        <section data-testid="band-executive-summary">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ alignItems: 'stretch' }}>
            {/* Card 1: Total Work Orders */}
            <div
              className="cursor-pointer transition-shadow hover:shadow-md"
              style={cardStyle}
              onClick={() => navigateToWorkOrders('Planned')}
              data-testid="card-total-wo"
            >
              <div style={{ height: '4px', background: '#1565C0', borderRadius: '8px 8px 0 0' }} />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="w-4 h-4" style={{ color: '#1565C0' }} />
                  <span style={{ ...sectionTitleStyle, color: '#1565C0' }}>TOTAL WORK ORDERS</span>
                </div>
                <div className="text-3xl font-bold" style={{ color: '#212121' }} data-testid="text-total-wo-count">{workOrderKPIs.total}</div>
                <div className="text-xs mt-1" style={{ color: '#757575' }}>{workOrderKPIs.active} planned / active</div>
                <div className="text-xs mt-2" style={{ color: '#9E9E9E' }}>{isFleetView ? 'Fleet scope' : (currentVessel?.name || 'All vessels')}</div>
              </div>
            </div>

            {/* Card 2: Overdue */}
            <div
              className="cursor-pointer transition-shadow hover:shadow-md"
              style={cardStyle}
              onClick={() => navigateToWorkOrders('Overdue')}
              data-testid="card-overdue-wo"
            >
              <div style={{ height: '4px', background: '#E53935', borderRadius: '8px 8px 0 0' }} />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" style={{ color: '#E53935' }} />
                  <span style={{ ...sectionTitleStyle, color: '#E53935' }}>OVERDUE</span>
                </div>
                <div className="text-3xl font-bold" style={{ color: '#E53935' }} data-testid="text-overdue-count">{workOrderKPIs.overdue}</div>
                <div className="text-xs mt-1" style={{ color: '#757575' }}>{overduePercent}% of all work orders</div>
                {workOrderKPIs.overdue > 0 && (
                  <div className="mt-2">
                    <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#FFEBEE', color: '#E53935' }} data-testid="badge-action-required">Action required</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 3: Completed */}
            <div
              className="cursor-pointer transition-shadow hover:shadow-md"
              style={cardStyle}
              onClick={() => navigateToWorkOrders('Completed')}
              data-testid="card-completed-wo"
            >
              <div style={{ height: '4px', background: '#2E7D32', borderRadius: '8px 8px 0 0' }} />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4" style={{ color: '#2E7D32' }} />
                  <span style={{ ...sectionTitleStyle, color: '#2E7D32' }}>COMPLETED</span>
                </div>
                <div className="text-3xl font-bold" style={{ color: '#2E7D32' }} data-testid="text-completed-count">{workOrderKPIs.completed}</div>
                <div className="text-xs mt-1" style={{ color: '#757575' }}>{completionRate}% completion rate</div>
                <div className="text-xs mt-2" style={{ color: '#9E9E9E' }}>
                  {maintenanceTrendData.delta !== 0 ? `vs last month: ${maintenanceTrendData.delta > 0 ? '+' : ''}${maintenanceTrendData.delta}%` : 'No change vs last month'}
                </div>
              </div>
            </div>

            {/* Card 4: Outstanding / Backlog */}
            <div
              className="cursor-pointer transition-shadow hover:shadow-md"
              style={cardStyle}
              onClick={() => navigateToWorkOrders('Planned')}
              data-testid="card-outstanding-summary"
            >
              <div style={{ height: '4px', background: '#F57C00', borderRadius: '8px 8px 0 0' }} />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList className="w-4 h-4" style={{ color: '#F57C00' }} />
                  <span style={{ ...sectionTitleStyle, color: '#F57C00' }}>OUTSTANDING TASKS</span>
                </div>
                <div className="text-3xl font-bold" style={{ color: '#212121' }} data-testid="text-outstanding-count">
                  {outstandingTasksChartData.outstandingCount} / {outstandingTasksChartData.totalMonthly}
                </div>
                <div className="text-xs mt-1" style={{ color: '#757575' }}>{outstandingTasksChartData.outstandingPercent}% incomplete this month</div>
                {maintenanceTrendData.delta !== 0 && (
                  <div className="mt-2">
                    <span
                      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: maintenanceTrendData.delta > 0 ? '#FFF3E0' : '#E8F5E9',
                        color: maintenanceTrendData.delta > 0 ? '#E65100' : '#2E7D32',
                      }}
                      data-testid="badge-trend-delta"
                    >
                      {maintenanceTrendData.delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {maintenanceTrendData.delta > 0 ? '+' : ''}{maintenanceTrendData.delta}% vs last month
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ SECTION 3: TWO-COLUMN MIDDLE — Charts + Quick Stats ═══ */}
        <section data-testid="band-charts-quickstats">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* LEFT: WO Status Distribution (3/5 = 60%) */}
            <div className="lg:col-span-3" style={cardStyle} data-testid="card-wo-status-chart">
              <div className="p-4">
                <div style={sectionTitleStyle} className="mb-1">WORK ORDER STATUS DISTRIBUTION</div>
                <div className="text-xs mb-3" style={{ color: '#9E9E9E' }}>Click segments to filter work orders</div>
                <div className="h-64">
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
            </div>

            {/* RIGHT: Quick Stats (2/5 = 40%) */}
            <div className="lg:col-span-2" style={cardStyle} data-testid="card-quick-stats">
              <div className="p-4">
                <div style={sectionTitleStyle} className="mb-3">QUICK STATS</div>
                <div className="divide-y" style={{ borderColor: '#E0E0E0' }}>
                  <div className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 px-2 rounded transition-colors" onClick={() => navigateToWorkOrders('Due')} data-testid="row-quick-due">
                    <span className="text-sm" style={{ color: '#424242' }}>Due this week</span>
                    <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: '#F57C00' }} data-testid="badge-due-count">{workOrderKPIs.due}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 px-2 rounded transition-colors" onClick={() => navigateToWorkOrders('Pending Approval')} data-testid="row-quick-pending">
                    <span className="text-sm" style={{ color: '#424242' }}>Pending Approval</span>
                    <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: '#1565C0' }} data-testid="badge-pending-count">{workOrderKPIs.pendingApproval}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 px-2 rounded transition-colors" onClick={() => navigateToSpares('Low')} data-testid="row-quick-critical-spares">
                    <span className="text-sm" style={{ color: '#424242' }}>Critical Low Stock Spares</span>
                    <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: '#E53935' }} data-testid="badge-critical-spares">{sparesKPIs.criticalLowStock}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 px-2 rounded transition-colors" onClick={navigateToComponents} data-testid="row-quick-components">
                    <span className="text-sm" style={{ color: '#424242' }}>Total Components</span>
                    <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: '#546E7A' }} data-testid="badge-components">{componentsKPIs.total}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 px-2 rounded transition-colors" onClick={navigateToRunningHours} data-testid="row-quick-rh">
                    <span className="text-sm" style={{ color: '#424242' }}>Running Hours Tracked</span>
                    <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: '#F57C00' }} data-testid="badge-rh">{runningHoursKPIs.totalComponents}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ SECTION 4A: WORK ORDER HEALTH ═══ */}
        <section data-testid="band-work-order-health">
          <div style={sectionBarStyle}>
            <span style={sectionTitleStyle} data-testid="text-band-wo-health">WORK ORDER HEALTH</span>
          </div>

          {/* 5 compact KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            {[
              { label: 'OVERDUE', value: workOrderKPIs.overdue, color: '#E53935', icon: AlertTriangle, onClick: () => navigateToWorkOrders('Overdue'), testId: 'card-wo-overdue' },
              { label: 'DUE', value: workOrderKPIs.due, color: '#F57C00', icon: Clock, onClick: () => navigateToWorkOrders('Due'), testId: 'card-wo-due' },
              { label: 'PENDING APPROVAL', value: workOrderKPIs.pendingApproval, color: '#1565C0', icon: ClipboardList, onClick: () => navigateToWorkOrders('Pending Approval'), testId: 'card-wo-pending' },
              { label: 'COMPLETED', value: workOrderKPIs.completed, color: '#2E7D32', icon: CheckCircle, onClick: () => navigateToWorkOrders('Completed'), testId: 'card-wo-completed' },
              { label: 'TOTAL WOs', value: workOrderKPIs.total, color: '#1565C0', icon: Wrench, onClick: () => navigateToWorkOrders('Planned'), testId: 'card-wo-total' },
            ].map(item => (
              <div
                key={item.testId}
                className="cursor-pointer transition-shadow hover:shadow-md"
                style={cardStyle}
                onClick={item.onClick}
                data-testid={item.testId}
              >
                <div style={{ height: '3px', background: item.color, borderRadius: '8px 8px 0 0' }} />
                <div className="p-3 text-center">
                  <item.icon className="w-4 h-4 mx-auto mb-1" style={{ color: item.color }} />
                  <div className="text-xs font-bold uppercase mb-1" style={{ color: item.color, letterSpacing: '0.03em' }}>{item.label}</div>
                  <div className="text-2xl font-bold" style={{ color: item.value > 0 && (item.label === 'OVERDUE') ? '#E53935' : '#212121' }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Overdue Work Orders Table */}
          <div style={cardStyle} className="overflow-hidden" data-testid="card-overdue-table">
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #E0E0E0' }}>
              <div>
                <span style={sectionTitleStyle}>OVERDUE WORK ORDERS</span>
                <div className="text-xs mt-0.5" style={{ color: '#9E9E9E' }}>
                  {workOrderKPIs.overdueList.length > 0
                    ? `Showing top ${workOrderKPIs.overdueList.length} of ${workOrderKPIs.overdue} total`
                    : 'No overdue items'}
                </div>
              </div>
              {workOrderKPIs.overdue > 0 && (
                <Button variant="outline" size="sm" onClick={() => navigateToWorkOrders('Overdue')} data-testid="button-view-all-overdue" style={{ borderColor: '#1565C0', color: '#1565C0' }}>
                  View All ({workOrderKPIs.overdue})
                </Button>
              )}
            </div>
            {workOrderKPIs.overdueList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-overdue-wo">
                  <thead>
                    <tr>
                      <th className="text-left py-2.5 px-4" style={tableHeaderStyle}>Work Order</th>
                      <th className="text-left py-2.5 px-4" style={tableHeaderStyle}>Equipment</th>
                      <th className="text-left py-2.5 px-4" style={tableHeaderStyle}>Status</th>
                      <th className="text-right py-2.5 px-4" style={tableHeaderStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {workOrderKPIs.overdueList.map((wo: any, idx: number) => (
                      <tr
                        key={wo.id}
                        className="cursor-pointer transition-colors"
                        style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#E3F2FD')}
                        onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB')}
                        onClick={() => navigateToWorkOrder(wo.id)}
                        data-testid={`row-overdue-wo-${wo.id}`}
                      >
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-xs" style={{ color: '#212121' }}>{wo.workOrderNumber || `WO-${wo.id}`}</div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="text-xs" style={{ color: '#616161' }}>{wo.taskDescription || wo.jobTitle || 'No description'}</div>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: '#E53935' }}>Overdue</span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <ChevronRight className="w-4 h-4 inline-block" style={{ color: '#BDBDBD' }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8" style={{ color: '#9E9E9E' }}>
                <CheckCircle className="w-10 h-10 mx-auto mb-2" style={{ color: '#2E7D32' }} />
                <p className="text-sm">No overdue work orders</p>
              </div>
            )}
          </div>
        </section>

        {/* ═══ SECTION 4B: MAINTENANCE EFFECTIVENESS ═══ */}
        <section data-testid="band-maintenance-effectiveness">
          <div style={sectionBarStyle}>
            <span style={sectionTitleStyle} data-testid="text-band-maintenance">MAINTENANCE EFFECTIVENESS</span>
          </div>

          {/* 3 KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div style={cardStyle} data-testid="card-outstanding-tasks-kpi">
              <div style={{ height: '3px', background: '#F57C00', borderRadius: '8px 8px 0 0' }} />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList className="w-4 h-4" style={{ color: '#F57C00' }} />
                  <span className="text-xs font-bold uppercase" style={{ color: '#F57C00' }}>Outstanding Tasks</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: '#212121' }} data-testid="text-outstanding-fraction">
                  {outstandingTasksChartData.outstandingCount} of {outstandingTasksChartData.totalMonthly}
                </div>
                <div className="text-xs mt-1" style={{ color: '#757575' }}>{outstandingTasksChartData.outstandingPercent}% incomplete</div>
              </div>
            </div>

            <div style={cardStyle} data-testid="card-backlog-trend-kpi">
              <div style={{ height: '3px', background: maintenanceTrendData.delta > 0 ? '#E53935' : '#2E7D32', borderRadius: '8px 8px 0 0' }} />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {maintenanceTrendData.delta > 0 ? <TrendingUp className="w-4 h-4" style={{ color: '#E53935' }} /> : <TrendingDown className="w-4 h-4" style={{ color: '#2E7D32' }} />}
                  <span className="text-xs font-bold uppercase" style={{ color: maintenanceTrendData.delta > 0 ? '#E53935' : '#2E7D32' }}>Backlog Trend</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: '#212121' }} data-testid="text-backlog-trend">
                  {maintenanceTrendData.delta > 0 ? '+' : ''}{maintenanceTrendData.delta}% vs last month
                </div>
                <div className="text-xs mt-1" style={{ color: '#757575' }}>Trend: {maintenanceTrendData.delta > 0 ? 'Worsening \u2191' : maintenanceTrendData.delta < 0 ? 'Improving \u2193' : 'Stable'}</div>
              </div>
            </div>

            <div style={cardStyle} className="cursor-pointer hover:shadow-md transition-shadow" onClick={navigateToRunningHours} data-testid="card-running-hours-summary">
              <div style={{ height: '3px', background: '#1565C0', borderRadius: '8px 8px 0 0' }} />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="w-4 h-4" style={{ color: '#1565C0' }} />
                  <span className="text-xs font-bold uppercase" style={{ color: '#1565C0' }}>Running Hours</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: '#212121' }}>{runningHoursKPIs.totalComponents}</div>
                <div className="text-xs mt-1" style={{ color: '#757575' }}>{runningHoursKPIs.totalTracked} master, {runningHoursKPIs.totalInherited} inherited</div>
                <div className="text-xs mt-1" style={{ color: runningHoursKPIs.recentlyUpdated > 0 ? '#2E7D32' : '#9E9E9E' }}>
                  {runningHoursKPIs.recentlyUpdated} updated this week
                </div>
              </div>
            </div>
          </div>

          {/* 6-Month Maintenance Trend Chart */}
          <div style={cardStyle} data-testid="card-maintenance-trend">
            <div className="p-4">
              <div style={sectionTitleStyle} className="mb-1">6-MONTH MAINTENANCE TREND</div>
              <div className="text-xs mb-3" style={{ color: '#9E9E9E' }}>Outstanding tasks % over time</div>
              {maintenanceTrendData.months.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="h-48" data-testid="chart-maintenance-trend">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={maintenanceTrendData.months} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                        <XAxis dataKey="monthShort" tick={{ fontSize: 11, fill: '#757575' }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#757575' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div style={{ background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', padding: '8px 12px' }} data-testid="tooltip-trend-bar">
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
                        <Bar dataKey="outstandingPercent" radius={[4, 4, 0, 0]} maxBarSize={32}>
                          {maintenanceTrendData.months.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.outstandingPercent > 60 ? '#E53935' : entry.outstandingPercent >= 30 ? '#F57C00' : '#2E7D32'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center gap-4 text-xs" style={{ color: '#757575' }} data-testid="legend-maintenance-trend">
                    <div className="flex items-center gap-1" data-testid="legend-item-healthy">
                      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#2E7D32' }} />
                      <span>Healthy (&lt;30%)</span>
                    </div>
                    <div className="flex items-center gap-1" data-testid="legend-item-watch">
                      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#F57C00' }} />
                      <span>Watch (30\u201360%)</span>
                    </div>
                    <div className="flex items-center gap-1" data-testid="legend-item-backlog">
                      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#E53935' }} />
                      <span>Backlog (&gt;60%)</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center" style={{ color: '#9E9E9E' }}>No trend data available</div>
              )}
            </div>
          </div>
        </section>

        {/* ═══ SECTION 4C: INVENTORY HEALTH ═══ */}
        <section data-testid="band-inventory-health">
          <div style={sectionBarStyle}>
            <span style={sectionTitleStyle} data-testid="text-band-inventory">INVENTORY HEALTH</span>
          </div>

          {/* 4 KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div style={cardStyle} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigateToSpares()} data-testid="card-spares-summary">
              <div style={{ height: '3px', background: '#1565C0', borderRadius: '8px 8px 0 0' }} />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4" style={{ color: '#1565C0' }} />
                  <span className="text-xs font-bold uppercase" style={{ color: '#1565C0' }}>Total Spares</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: '#212121' }}>{sparesKPIs.total}</div>
                <div className="text-xs mt-1" style={{ color: '#757575' }}>{sparesKPIs.critical} critical items</div>
              </div>
            </div>

            <div style={cardStyle} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigateToSpares('Low')} data-testid="card-low-stock-kpi">
              <div style={{ height: '3px', background: '#E53935', borderRadius: '8px 8px 0 0' }} />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4" style={{ color: '#E53935' }} />
                  <span className="text-xs font-bold uppercase" style={{ color: '#E53935' }}>Low Stock</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: '#E53935' }}>{sparesKPIs.lowStock}</div>
                <div className="text-xs mt-1" style={{ color: '#757575' }}>{sparesKPIs.criticalLowStock} critical low stock</div>
              </div>
            </div>

            <div style={cardStyle} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigateToStores()} data-testid="card-stores-summary">
              <div style={{ height: '3px', background: '#1565C0', borderRadius: '8px 8px 0 0' }} />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Box className="w-4 h-4" style={{ color: '#1565C0' }} />
                  <span className="text-xs font-bold uppercase" style={{ color: '#1565C0' }}>Stores Inventory</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: '#212121' }}>{storesKPIs.total}</div>
                <div className="text-xs mt-1" style={{ color: '#757575' }}>{storesKPIs.stores}S / {storesKPIs.lubes}L / {storesKPIs.chemicals}C / {storesKPIs.others}O</div>
              </div>
            </div>

            <div style={cardStyle} className="cursor-pointer hover:shadow-md transition-shadow" onClick={navigateToComponents} data-testid="card-components-summary">
              <div style={{ height: '3px', background: '#546E7A', borderRadius: '8px 8px 0 0' }} />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Box className="w-4 h-4" style={{ color: '#546E7A' }} />
                  <span className="text-xs font-bold uppercase" style={{ color: '#546E7A' }}>Components</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: '#212121' }}>{componentsKPIs.total}</div>
                <div className="text-xs mt-1" style={{ color: '#757575' }}>{componentsKPIs.active} active ({componentsKPIs.total > 0 ? Math.round((componentsKPIs.active / componentsKPIs.total) * 100) : 0}%)</div>
              </div>
            </div>
          </div>

          {/* Spares charts side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div style={cardStyle} data-testid="card-spares-status-chart">
              <div className="p-4">
                <div style={sectionTitleStyle} className="mb-1">SPARES STOCK STATUS</div>
                <div className="text-xs mb-3" style={{ color: '#9E9E9E' }}>Click segments to view filtered spares</div>
                <div className="h-56">
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
                    <div className="h-full flex items-center justify-center" style={{ color: '#9E9E9E' }}>No spares to display</div>
                  )}
                </div>
              </div>
            </div>

            <div style={cardStyle} data-testid="card-spares-consumption-trend">
              <div className="p-4">
                <div style={sectionTitleStyle} className="mb-1">6-MONTH SPARES MOVEMENT TREND</div>
                <div className="text-xs mb-3" style={{ color: '#9E9E9E' }}>Consumption vs receiving activity</div>
                {sparesConsumptionTrendData.length > 0 ? (
                  <div className="h-56" data-testid="chart-spares-consumption-trend">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sparesConsumptionTrendData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                        <XAxis dataKey="monthShort" tick={{ fontSize: 11, fill: '#757575' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#757575' }} tickLine={false} axisLine={false} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div style={{ background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', padding: '8px 12px' }} data-testid="tooltip-spares-consumption">
                                  <div className="font-semibold text-xs mb-1" style={{ color: '#212121' }}>{d.month}</div>
                                  <div className="text-xs" style={{ color: '#E53935' }}>Consumed: {d.consumeEvents} events ({d.totalQty} units)</div>
                                  <div className="text-xs" style={{ color: '#2E7D32' }}>Received: {d.receiveEvents} events ({d.receiveQty} units)</div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} formatter={(value) => value === 'consumeEvents' ? 'Consumed' : 'Received'} />
                        <Bar dataKey="consumeEvents" name="consumeEvents" fill="#E53935" radius={[3, 3, 0, 0]} maxBarSize={24} />
                        <Bar dataKey="receiveEvents" name="receiveEvents" fill="#2E7D32" radius={[3, 3, 0, 0]} maxBarSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-56 flex items-center justify-center" style={{ color: '#9E9E9E' }}>No spares history data available</div>
                )}
              </div>
            </div>
          </div>

          {/* Low Stock Spares Table */}
          <div style={cardStyle} className="overflow-hidden" data-testid="card-low-stock-table">
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #E0E0E0' }}>
              <div>
                <span style={sectionTitleStyle}>LOW STOCK SPARES</span>
                <div className="text-xs mt-0.5" style={{ color: '#9E9E9E' }}>
                  {sparesKPIs.lowStockList.length > 0
                    ? `Sample from ${sparesKPIs.lowStock} low stock items${sparesKPIs.criticalLowStock > 0 ? ` (${sparesKPIs.criticalLowStock} critical)` : ''}`
                    : 'All spares adequately stocked'}
                </div>
              </div>
              {sparesKPIs.lowStock > 0 && (
                <Button variant="outline" size="sm" onClick={() => navigateToSpares('Low')} data-testid="button-view-all-low-stock" style={{ borderColor: '#1565C0', color: '#1565C0' }}>
                  View All ({sparesKPIs.lowStock})
                </Button>
              )}
            </div>
            {sparesKPIs.lowStockList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-low-stock">
                  <thead>
                    <tr>
                      <th className="text-left py-2.5 px-4" style={tableHeaderStyle}>Part Name</th>
                      <th className="text-left py-2.5 px-4" style={tableHeaderStyle}>Part No.</th>
                      <th className="text-right py-2.5 px-4" style={tableHeaderStyle}>Current Stock</th>
                      <th className="text-right py-2.5 px-4" style={tableHeaderStyle}>Min. Required</th>
                      <th className="text-center py-2.5 px-4" style={tableHeaderStyle}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sparesKPIs.lowStockList.map((spare: Spare, idx: number) => {
                      const isCritical = spare.critical === 'Critical' || spare.critical === 'Yes';
                      return (
                        <tr
                          key={spare.id}
                          className="cursor-pointer transition-colors"
                          style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#E3F2FD')}
                          onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB')}
                          onClick={() => navigateToSpares('Low')}
                          data-testid={`row-low-stock-spare-${spare.id}`}
                        >
                          <td className="py-2.5 px-4 font-medium text-xs" style={{ color: '#212121' }}>{spare.partName}</td>
                          <td className="py-2.5 px-4 text-xs" style={{ color: '#616161' }}>{spare.partNumber}</td>
                          <td className="py-2.5 px-4 text-right text-xs font-mono font-medium" style={{ color: '#212121' }}>{spare.rob}</td>
                          <td className="py-2.5 px-4 text-right text-xs font-mono" style={{ color: '#616161' }}>{spare.min}</td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold text-white"
                              style={{ background: isCritical ? '#E53935' : '#F57C00' }}
                            >
                              {isCritical ? 'Critical' : 'Low'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8" style={{ color: '#9E9E9E' }}>
                <CheckCircle className="w-10 h-10 mx-auto mb-2" style={{ color: '#2E7D32' }} />
                <p className="text-sm">All spares adequately stocked</p>
              </div>
            )}
          </div>
        </section>

        {/* ═══ Pending Approval Section (Head of Dept) ═══ */}
        {isHeadOfDept && workOrderKPIs.pendingApproval > 0 && (
          <section>
            <div style={sectionBarStyle}>
              <span style={sectionTitleStyle}>PENDING YOUR APPROVAL</span>
            </div>
            <div style={cardStyle} className="overflow-hidden" data-testid="card-pending-approval-section">
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #E0E0E0' }}>
                <div>
                  <span className="text-sm font-medium" style={{ color: '#212121' }}>
                    {workOrderKPIs.pendingApproval} work orders from {currentVessel?.name || 'vessel'} require your review
                  </span>
                </div>
                <Button
                  onClick={() => setBulkApproveModalOpen(true)}
                  style={{ background: '#1565C0' }}
                  className="text-white hover:opacity-90"
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
                {workOrderKPIs.pendingApproval > 5 && (
                  <div className="text-center pt-2">
                    <Button variant="link" onClick={() => setBulkApproveModalOpen(true)} style={{ color: '#1565C0' }}>
                      View all {workOrderKPIs.pendingApproval} pending work orders
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        </>)}
        </div>
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
