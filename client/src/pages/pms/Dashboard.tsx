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
  Pencil,
  Download,
  TrendingUp,
  TrendingDown,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Filter,
  BarChart3
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, BarChart, Bar } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WorkOrder, ChangeRequest } from "@shared/schema";
import { useVessels } from "@/hooks/useVessels";
import { BulkApproveModal } from "@/components/BulkApproveModal";
import { SemiCircleGauge } from "@/components/SemiCircleGauge";
import { ComplianceAnomalyPanel } from "./ComplianceAnomalyPanel";
import { WorkOrdersListModal } from "./WorkOrdersListModal";
import { SparesListModal } from "./SparesListModal";
import WorkOrderForm from "@/components/WorkOrderForm";
import { pdfReportGenerator } from "@/lib/pdfReportGenerator";
import type { TableColumn } from "@/lib/pdfReportGenerator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

type EnrichedWorkOrder = WorkOrder & { computedStatus?: string; criticality?: string; jobPriority?: string };

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
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center" style={{ color: '#9E9E9E' }}>No vessel data available</td>
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
  type OperationCardFilter = 'overdue' | 'overdue-critical' | 'planned-today' | 'pending-approvals' | 'critical-spares' | 'anomalies' | 'modify-pms';
  const [selectedOpCard, setSelectedOpCard] = useState<OperationCardFilter>('overdue');
  const [hodScope, setHodScope] = useState<'me' | 'myTeam'>('myTeam');
  const [opViewModal, setOpViewModal] = useState<{ open: boolean; workOrder: EnrichedWorkOrder | null }>({ open: false, workOrder: null });
  const [showBenchmarking, setShowBenchmarking] = useState(false);
  const [selectedCriticality, setSelectedCriticality] = useState("");
  const [reasonsToggle, setReasonsToggle] = useState<'overdue' | 'postponement'>('overdue');
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

  const { data: complianceAnomalies } = useQuery<{
    cycleSkipRate: { severity: string };
    backdatingFrequency: { severity: string };
    bulkCompletions: { severity: string; eventCount: number };
    scheduleDrift: { severity: string };
  }>({
    queryKey: ['/technical/api/dashboard/compliance-anomalies', vesselId],
    queryFn: async () => {
      const url = isAllVessels
        ? '/technical/api/dashboard/compliance-anomalies'
        : `/technical/api/dashboard/compliance-anomalies?vesselId=${vesselId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch compliance anomalies');
      return res.json();
    },
    enabled: activeTab === 'management' && !!vesselId,
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

  const operationDonutData = useMemo(() => {
    const safeWOs = workOrdersData.filter(wo => wo !== null && wo !== undefined && !wo.isExecution);
    const overdue = safeWOs.filter(wo => (wo as EnrichedWorkOrder).computedStatus === 'Overdue').length;
    const due = safeWOs.filter(wo => {
      const s = (wo as EnrichedWorkOrder).computedStatus;
      return s === 'Due' || s === 'Due (Grace P)';
    }).length;
    const planned = safeWOs.filter(wo => {
      const s = (wo as EnrichedWorkOrder).computedStatus;
      return s === 'Active' || s === 'Postponed' || s === 'Completed';
    }).length;
    return [
      { status: 'Overdue', count: overdue, color: '#ff6961' },
      { status: 'Due', count: due, color: '#FF964f' },
      { status: 'Planned', count: planned, color: '#5dc86f' },
    ].filter(d => d.count > 0);
  }, [workOrdersData]);

  const operationKPIs = useMemo(() => {
    const safeWOs = workOrdersData.filter(wo => wo !== null && wo !== undefined && !wo.isExecution);
    const overdueWOs = safeWOs.filter(wo => (wo as EnrichedWorkOrder).computedStatus === 'Overdue');
    const overdueCount = overdueWOs.length;

    const overdueCriticalWOs = overdueWOs.filter(wo =>
      ((wo as EnrichedWorkOrder).criticality ?? '').toLowerCase() === 'yes'
    );
    const overdueCriticalCount = overdueCriticalWOs.length;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const plannedTodayWOs = safeWOs.filter(wo => {
      if (!wo.plannedDate) return false;
      const parsed = parseFlexibleDate(wo.plannedDate);
      if (!parsed) return false;
      return parsed >= todayStart && parsed < todayEnd;
    });
    const plannedTodayCount = plannedTodayWOs.length;

    const criticalSparesLowCount = sparesData.filter(spare => {
      const isCritical = spare.critical === 'Critical' || spare.critical === 'Yes';
      if (!isCritical) return false;
      const rob = typeof spare.rob === 'number' ? spare.rob : parseInt(String(spare.rob)) || 0;
      const min = typeof spare.min === 'number' ? spare.min : parseInt(String(spare.min)) || 0;
      return rob < min && min > 0;
    }).length;

    const pendingApprovalWOs = safeWOs.filter(wo =>
      (wo as EnrichedWorkOrder).computedStatus === 'Pending Approval'
    );
    const pendingApprovalCount = pendingApprovalWOs.length;

    const anomalyCount = complianceAnomalies ? [
      complianceAnomalies.cycleSkipRate.severity,
      complianceAnomalies.backdatingFrequency.severity,
      complianceAnomalies.bulkCompletions.severity,
      complianceAnomalies.scheduleDrift.severity,
    ].filter(s => s !== 'green').length : 0;

    const openChangeRequests = changeRequestsData.filter(cr =>
      cr.status !== 'approved' && cr.status !== 'rejected'
    ).length;

    return {
      overdueCount,
      overdueWOs: overdueWOs as EnrichedWorkOrder[],
      overdueCriticalCount,
      overdueCriticalWOs: overdueCriticalWOs as EnrichedWorkOrder[],
      plannedTodayCount,
      plannedTodayWOs: plannedTodayWOs as EnrichedWorkOrder[],
      criticalSparesLowCount,
      pendingApprovalCount,
      pendingApprovalWOs: pendingApprovalWOs as EnrichedWorkOrder[],
      anomalyCount,
      openChangeRequests,
    };
  }, [workOrdersData, sparesData, changeRequestsData, complianceAnomalies]);

  const operationTableData = useMemo(() => {
    switch (selectedOpCard) {
      case 'overdue':
        return operationKPIs.overdueWOs;
      case 'overdue-critical':
        return operationKPIs.overdueCriticalWOs;
      case 'planned-today':
        return operationKPIs.plannedTodayWOs;
      case 'pending-approvals':
        return operationKPIs.pendingApprovalWOs;
      default:
        return [];
    }
  }, [selectedOpCard, operationKPIs]);

  const operationTableTitle = useMemo(() => {
    switch (selectedOpCard) {
      case 'overdue': return 'Overdue Work Orders';
      case 'overdue-critical': return 'Overdue Work Orders – Critical Equipment';
      case 'planned-today': return 'Work Orders – Planned for Today';
      case 'pending-approvals': return 'Pending Approval Work Orders';
      case 'critical-spares': return 'Critical Spares Low';
      case 'anomalies': return 'W.O Anomalies';
      case 'modify-pms': return 'Modify PMS Requests';
      default: return 'Work Orders';
    }
  }, [selectedOpCard]);

  const isNonWOCard = selectedOpCard === 'critical-spares' || selectedOpCard === 'anomalies' || selectedOpCard === 'modify-pms';

  const ytdKPIs = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const ytdWOs = (workOrdersData as EnrichedWorkOrder[]).filter(wo => {
      if (!wo || wo.isExecution) return false;
      const createdDate = wo.createdAt ? new Date(wo.createdAt) : null;
      return createdDate !== null && createdDate.getFullYear() === currentYear;
    });

    const total = ytdWOs.length;
    const postponedFull = ytdWOs.filter(wo =>
      wo.computedStatus === 'Postponed'
    );
    const postponed = postponedFull.length;
    const unplannedFull = ytdWOs.filter(wo => wo.workOrderType === 'Unplanned');
    const unplanned = unplannedFull.length;

    const changeRequestCountYTD = changeRequestsData.filter(cr => {
      const created = cr.createdAt ? new Date(cr.createdAt) : null;
      return created !== null && created.getFullYear() === currentYear;
    }).length;
    const changeRequestPercent = total > 0 ? Math.round((changeRequestCountYTD / total) * 100) : 0;

    return {
      total,
      postponed,
      postponedFull,
      postponedPercent: total > 0 ? Math.round((postponed / total) * 100) : 0,
      unplanned,
      unplannedFull,
      unplannedPercent: total > 0 ? Math.round((unplanned / total) * 100) : 0,
      changeRequests: changeRequestCountYTD,
      changeRequestPercent,
    };
  }, [workOrdersData, changeRequestsData]);

  const top5ReasonsData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const ytdWOs = (workOrdersData as EnrichedWorkOrder[]).filter(wo => {
      if (!wo || wo.isExecution) return false;
      const createdDate = wo.createdAt ? new Date(wo.createdAt) : null;
      return createdDate !== null && createdDate.getFullYear() === currentYear;
    });

    const overdueWOs = ytdWOs.filter(wo => wo.computedStatus === 'Overdue');
    const overdueByReason = new Map<string, EnrichedWorkOrder[]>();
    overdueWOs.forEach(wo => {
      const reason = String(wo.overdueReason ?? '').trim();
      if (reason) {
        const arr = overdueByReason.get(reason) || [];
        arr.push(wo);
        overdueByReason.set(reason, arr);
      }
    });
    const overdueTop5 = Array.from(overdueByReason.entries())
      .map(([reason, wos]) => ({ reason, count: wos.length, workOrders: wos }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const postponedWOs = ytdWOs.filter(wo => wo.computedStatus === 'Postponed');
    const postponeByReason = new Map<string, EnrichedWorkOrder[]>();
    postponedWOs.forEach(wo => {
      const reason = String(wo.postponementReason ?? '').trim();
      if (reason) {
        const arr = postponeByReason.get(reason) || [];
        arr.push(wo);
        postponeByReason.set(reason, arr);
      }
    });
    const postponeTop5 = Array.from(postponeByReason.entries())
      .map(([reason, wos]) => ({ reason, count: wos.length, workOrders: wos }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { overdueTop5, postponeTop5 };
  }, [workOrdersData]);

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
              Management
            </button>
            <button
              onClick={() => setActiveTab('management')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'management' ? 'bg-[#52baf3] text-white' : 'text-gray-700 hover:bg-gray-200'
              }`}
              data-testid="tab-management"
            >
              Operation
            </button>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'management' ? (
              <div className="flex items-center gap-2" data-testid="toggle-hod-scope">
                <span
                  className={`text-sm font-medium cursor-pointer transition-colors ${hodScope === 'me' ? 'text-[#1a2b4a]' : 'text-gray-400'}`}
                  onClick={() => setHodScope('me')}
                  data-testid="toggle-label-me"
                >
                  Me
                </span>
                <button
                  onClick={() => setHodScope(hodScope === 'me' ? 'myTeam' : 'me')}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
                  style={{ backgroundColor: hodScope === 'myTeam' ? '#52baf3' : '#d1d5db' }}
                  data-testid="toggle-switch-hod-scope"
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform ${hodScope === 'myTeam' ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
                <span
                  className={`text-sm font-medium cursor-pointer transition-colors ${hodScope === 'myTeam' ? 'text-[#1a2b4a]' : 'text-gray-400'}`}
                  onClick={() => setHodScope('myTeam')}
                  data-testid="toggle-label-myteam"
                >
                  My Team
                </span>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>

        {activeTab === 'overview' && showFilters && (
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

          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBenchmarking(true)}
              className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
              data-testid="button-open-benchmarking"
            >
              <BarChart3 className="h-4 w-4" />
              Benchmarking
            </Button>
          </div>
        </div>
        )}
      </div>
      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto mt-4" style={{ background: '#f8fafc' }}>

        {/* OPERATION TAB */}
        {activeTab === 'management' && (
          <div className="px-4 pt-3 pb-2 flex flex-col" style={{ height: 'calc(100% - 0px)' }} data-testid="section-operation-dashboard">
            {(isWorkOrdersLoading || isSparesLoading) ? (
              <div className="flex items-center justify-center" style={{ minHeight: '300px' }}>
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                <span className="ml-3 text-gray-500">Loading operation data...</span>
              </div>
            ) : (
              <>
                <div className="flex items-stretch gap-3 mb-3" data-testid="section-operation-top">
                  <div className="flex items-center gap-3 flex-shrink-0" data-testid="card-operation-wo-donut">
                    {operationDonutData.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <div style={{ width: 130, height: 120 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={operationDonutData}
                                dataKey="count"
                                nameKey="status"
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={58}
                                paddingAngle={2}
                                label={({ cx, cy, midAngle, innerRadius, outerRadius, payload }: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; payload: { count: number } }) => {
                                  const RADIAN = Math.PI / 180;
                                  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                  return (
                                    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight="bold">
                                      {payload.count}
                                    </text>
                                  );
                                }}
                                labelLine={false}
                              >
                                {operationDonutData.map((entry, index) => (
                                  <Cell key={`op-cell-${index}`} fill={entry.color} stroke={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-gray-700">Work Orders</span>
                          {[
                            { status: 'Planned', color: '#5dc86f' },
                            { status: 'Due', color: '#FF964f' },
                            { status: 'Overdue', color: '#ff6961' },
                          ].map(item => (
                            <div key={item.status} className="flex items-center gap-1.5">
                              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="text-[10px] text-gray-500">{item.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center" style={{ width: 120, height: 70, color: '#9E9E9E', fontSize: '11px' }}>No WOs</div>
                    )}
                  </div>

                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2" data-testid="section-operation-kpi-cards">
                    {([
                      { key: 'overdue' as OperationCardFilter, label: 'Overdue WO', value: operationKPIs.overdueCount, borderColor: 'border-l-red-500', textColor: 'text-red-600', testId: 'card-kpi-overdue-wo', valueTestId: 'kpi-overdue-wo' },
                      { key: 'overdue-critical' as OperationCardFilter, label: 'Overdue WO – Critical Eqpt', value: operationKPIs.overdueCriticalCount, borderColor: 'border-l-red-500', textColor: 'text-red-600', testId: 'card-kpi-overdue-wo-critical', valueTestId: 'kpi-overdue-wo-critical' },
                      { key: 'planned-today' as OperationCardFilter, label: 'WO – Planned for Today', value: operationKPIs.plannedTodayCount, borderColor: 'border-l-green-500', textColor: 'text-green-600', testId: 'card-kpi-planned-today', valueTestId: 'kpi-planned-today' },
                      { key: 'critical-spares' as OperationCardFilter, label: 'Critical Spares Low', value: operationKPIs.criticalSparesLowCount, borderColor: 'border-l-orange-500', textColor: 'text-orange-600', testId: 'card-kpi-critical-spares-low', valueTestId: 'kpi-critical-spares-low' },
                      { key: 'pending-approvals' as OperationCardFilter, label: 'Pending Approvals', value: operationKPIs.pendingApprovalCount, borderColor: 'border-l-orange-500', textColor: 'text-orange-600', testId: 'card-kpi-pending-approvals', valueTestId: 'kpi-pending-approvals' },
                      { key: 'anomalies' as OperationCardFilter, label: 'W.O Anomalies', value: operationKPIs.anomalyCount, borderColor: 'border-l-orange-500', textColor: 'text-orange-600', testId: 'card-kpi-wo-anomalies', valueTestId: 'kpi-wo-anomalies' },
                      { key: 'modify-pms' as OperationCardFilter, label: 'Modify PMS Requests', value: operationKPIs.openChangeRequests, borderColor: 'border-l-gray-400', textColor: 'text-gray-600', testId: 'card-kpi-modify-pms-requests', valueTestId: 'kpi-modify-pms-requests' },
                    ]).map(card => (
                      <Card
                        key={card.key}
                        className={`cursor-pointer transition-shadow bg-white border-0 border-l-4 ${card.borderColor} ${selectedOpCard === card.key ? 'ring-2 ring-blue-400 shadow-md' : 'hover:shadow-lg'} flex min-h-[120px]`}
                        onClick={() => setSelectedOpCard(card.key)}
                        data-testid={card.testId}
                      >
                        <CardContent className="py-2 px-3 flex flex-col justify-start flex-1">
                          <p className="font-medium text-gray-600 text-[14px]">{card.label}</p>
                          <p className={`text-xl font-bold mt-0.5 ${card.textColor}`} data-testid={card.valueTestId}>{card.value}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-semibold text-gray-800" data-testid="text-operation-table-title">{operationTableTitle}</h2>
                    {!isNonWOCard && operationTableData.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs border-[#e1e8ed] text-[#8798ad]"
                        onClick={() => {
                          const columns: TableColumn[] = [
                            { header: 'Component', field: 'component', width: 30 },
                            { header: 'Work Order No', field: 'workOrderNo', width: 30 },
                            { header: 'Job Title', field: 'jobTitle', width: 40 },
                            { header: 'Due Date', field: 'dueDate', width: 18 },
                            { header: 'Status', field: 'status', width: 15 },
                            { header: 'Criticality', field: 'criticality', width: 15 },
                          ];
                          const safeFormatDate = (d: string | null | undefined) => {
                            if (!d) return '-';
                            const parsed = parseFlexibleDate(d);
                            if (!parsed) return d;
                            try { return format(parsed, 'dd-MMM-yyyy'); } catch { return d; }
                          };
                          const rows = operationTableData.map(wo => ({
                            component: wo.component || '-',
                            workOrderNo: wo.workOrderNo || '-',
                            jobTitle: wo.jobTitle || '-',
                            dueDate: safeFormatDate(wo.dueDate),
                            status: (wo as EnrichedWorkOrder).computedStatus || wo.status || '-',
                            criticality: (wo as EnrichedWorkOrder).jobPriority || '-',
                          }));
                          pdfReportGenerator.generateReport(
                            {
                              title: operationTableTitle,
                              subtitle: `Total: ${operationTableData.length} work order${operationTableData.length !== 1 ? 's' : ''}`,
                              orientation: 'landscape',
                            },
                            columns,
                            rows
                          );
                        }}
                        data-testid="button-export-operation-table"
                      >
                        <Download className="h-3 w-3" />
                        Export
                      </Button>
                    )}
                  </div>

                  {isNonWOCard ? (
                    <div className="flex-1 flex items-center justify-center border border-gray-200 rounded-lg bg-white">
                      <p className="text-sm text-gray-400">No work orders for this category — detailed view coming soon.</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-auto border border-gray-200 rounded-lg bg-white">
                      <Table>
                        <TableHeader className="sticky top-0 bg-[#eff6ff] z-10">
                          <TableRow>
                            <TableHead className="font-medium w-[160px] bg-[#eff6ff] text-[#0e4c81] text-xs">Component</TableHead>
                            <TableHead className="font-medium w-[180px] bg-[#eff6ff] text-[#0e4c81] text-xs">Work Order No</TableHead>
                            <TableHead className="font-medium min-w-[200px] bg-[#eff6ff] text-[#0e4c81] text-xs">Job Title</TableHead>
                            <TableHead className="font-medium w-[100px] bg-[#eff6ff] text-[#0e4c81] text-xs">Due Date</TableHead>
                            <TableHead className="font-medium w-[100px] bg-[#eff6ff] text-[#0e4c81] text-xs">Status</TableHead>
                            <TableHead className="font-medium w-[100px] bg-[#eff6ff] text-[#0e4c81] text-xs">Criticality</TableHead>
                            <TableHead className="font-medium w-[80px] text-center bg-[#eff6ff] text-[#0e4c81] text-xs">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {operationTableData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-gray-500 text-sm">
                                No work orders found
                              </TableCell>
                            </TableRow>
                          ) : (
                            operationTableData.map((wo) => {
                              const effectiveStatus = (wo as EnrichedWorkOrder).computedStatus || wo.status || 'Active';
                              const getStatusColor = (s: string) => {
                                if (s === 'Overdue') return 'bg-red-500';
                                if (s === 'Due' || s === 'Due (Grace P)') return 'bg-orange-500';
                                if (s === 'Pending Approval') return 'bg-blue-600';
                                if (s === 'Completed') return 'bg-green-500';
                                return 'bg-gray-500';
                              };
                              const getCritColor = (c: string) => {
                                const cl = c.toLowerCase();
                                if (cl === 'critical' || cl === 'yes') return 'bg-red-500';
                                if (cl === 'high') return 'bg-orange-500';
                                if (cl === 'medium') return 'bg-yellow-500';
                                if (cl === 'low') return 'bg-green-500';
                                return 'bg-gray-400';
                              };
                              const formatWoDate = (d: string | null | undefined) => {
                                if (!d) return '-';
                                const parsed = parseFlexibleDate(d);
                                if (!parsed) return d;
                                try { return format(parsed, 'dd-MMM-yyyy'); } catch { return d; }
                              };
                              return (
                                <TableRow key={wo.id} className="hover:bg-gray-50">
                                  <TableCell className="font-medium text-blue-600 text-xs py-2">{wo.component || '-'}</TableCell>
                                  <TableCell className="text-xs py-2">{wo.workOrderNo || '-'}</TableCell>
                                  <TableCell className="whitespace-normal break-words max-w-[300px] text-xs py-2">{wo.jobTitle || '-'}</TableCell>
                                  <TableCell className="text-xs py-2">{formatWoDate(wo.dueDate)}</TableCell>
                                  <TableCell className="py-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium text-white ${getStatusColor(effectiveStatus)}`}>
                                      {effectiveStatus}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-2">
                                    {(wo as EnrichedWorkOrder).jobPriority ? (
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium text-white ${getCritColor((wo as EnrichedWorkOrder).jobPriority)}`}>
                                        {(wo as EnrichedWorkOrder).jobPriority}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 text-xs">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <div className="flex gap-1 justify-center">
                                      <TooltipProvider>
                                        <UITooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-6"
                                              onClick={() => setOpViewModal({ open: true, workOrder: wo as EnrichedWorkOrder })}
                                              data-testid={`op-view-wo-${wo.id}`}
                                            >
                                              <Eye className="h-3.5 w-3.5 text-gray-500" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>View</TooltipContent>
                                        </UITooltip>
                                      </TooltipProvider>
                                      <TooltipProvider>
                                        <UITooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-6"
                                              onClick={() => setOpViewModal({ open: true, workOrder: wo as EnrichedWorkOrder })}
                                              data-testid={`op-edit-wo-${wo.id}`}
                                            >
                                              <Pencil className="h-3.5 w-3.5 text-gray-500" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Edit</TooltipContent>
                                        </UITooltip>
                                      </TooltipProvider>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {opViewModal.workOrder && (
                  <WorkOrderForm
                    isOpen={opViewModal.open}
                    onClose={() => setOpViewModal({ open: false, workOrder: null })}
                    workOrder={opViewModal.workOrder}
                    mode="template"
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* OVERVIEW TAB: Card-based Grid Layout */}
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">

            {/* DASHBOARD GRID: 3 columns (25% / 50% / 25%), 4 explicit rows */}
            <div
              className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] lg:[grid-template-rows:180px_90px_200px_250px]"
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
                    arcFillColor={criticalOverduePercent <= 1 ? '#FFEEAA' : '#e74c3c'}
                    displayValue={`${criticalOverduePercent}%`}
                    subtitle={`${criticalWorkOrderKPIs.overdue} out of ${criticalWorkOrderKPIs.total}`}
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
                className={`${cardStyle} lg:[grid-row:3/4] lg:[grid-column:2]`}
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
                      onClick={() => setWoListModal({ open: true, title: 'Postponed Work Orders YTD', workOrders: ytdKPIs.postponedFull })}
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
                      onClick={() => setWoListModal({ open: true, title: 'Unplanned Work Orders YTD', workOrders: ytdKPIs.unplannedFull })}
                      testId="gauge-unplanned-wo"
                    />
                  </div>
                </div>
              </div>

              {/* CENTER COLUMN ROW 5: Top 5 Reasons Chart */}
              <div
                className={`${cardStyle} lg:[grid-row:4/5] lg:[grid-column:2]`}
                data-testid="cell-center-reasons-chart"
              >
                <div className="p-3 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div style={subTitle}>Top 5 Reason for Postponement / Overdue YTD</div>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        className={`font-semibold px-2 py-0.5 rounded transition-colors ${reasonsToggle === 'overdue' ? 'bg-[#0e4c81] text-white' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}
                        onClick={() => setReasonsToggle('overdue')}
                        aria-pressed={reasonsToggle === 'overdue'}
                        data-testid="toggle-overdue-reasons"
                      >
                        Overdue
                      </button>
                      <button
                        type="button"
                        className={`font-semibold px-2 py-0.5 rounded transition-colors ${reasonsToggle === 'postponement' ? 'bg-[#0e4c81] text-white' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}
                        onClick={() => setReasonsToggle('postponement')}
                        aria-pressed={reasonsToggle === 'postponement'}
                        data-testid="toggle-postponement-reasons"
                      >
                        Postponement
                      </button>
                    </div>
                  </div>
                  <div className="flex-1">
                    {(reasonsToggle === 'overdue' ? top5ReasonsData.overdueTop5 : top5ReasonsData.postponeTop5).length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={reasonsToggle === 'overdue' ? top5ReasonsData.overdueTop5 : top5ReasonsData.postponeTop5}
                          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                          <YAxis
                            dataKey="reason"
                            type="category"
                            width={160}
                            tick={{ fontSize: 9 }}
                          />
                          <Tooltip
                            contentStyle={{ fontSize: '11px' }}
                            formatter={(value: number) => [value, 'Count']}
                          />
                          <Bar
                            dataKey="count"
                            fill={reasonsToggle === 'overdue' ? '#5B9BD5' : '#FF964f'}
                            radius={[0, 4, 4, 0]}
                            barSize={18}
                            cursor="pointer"
                            onClick={(data: { reason: string; count: number; workOrders: EnrichedWorkOrder[] }) => {
                              if (data?.workOrders) {
                                const label = reasonsToggle === 'overdue' ? 'Overdue' : 'Postponement';
                                setWoListModal({ open: true, title: `${label} — ${data.reason}`, workOrders: data.workOrders });
                              }
                            }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center" style={{ color: '#9E9E9E', fontSize: '11px' }}>
                        No {reasonsToggle === 'overdue' ? 'overdue' : 'postponement'} reasons recorded
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Spares Stock Status card — spans all rows */}
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
            {(isSailAdmin || isClientAdmin) && workOrderKPIs.pendingApproval > 0 && (
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
      <Dialog open={showBenchmarking} onOpenChange={setShowBenchmarking}>
        <DialogContent className="max-w-[95vw] h-[calc(100vh-10vw)] max-h-[90vh] overflow-hidden flex flex-col [&>button.absolute]:top-6 [&>button.absolute]:translate-y-1">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl font-semibold text-[#0f4c81]" data-testid="title-benchmarking-modal">
              Fleet Benchmarking
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {vessels.length > 0 && (
              <FleetView vessels={vessels} onSelectVessel={(id) => { handleFleetVesselSelect(id); setShowBenchmarking(false); }} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
