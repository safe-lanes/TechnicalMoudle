import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useVessel } from "@/contexts/VesselContext";
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
  RotateCcw
} from "lucide-react";
import { AgCharts } from "ag-charts-react";
import { AgChartOptions } from "ag-charts-community";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkOrder } from "@shared/schema";
import { useVessels } from "@/hooks/useVessels";

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

const Dashboard = () => {
  const [, setLocation] = useLocation();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const { vesselId, setVesselId } = useVessel();
  const { data: vessels = [] } = useVessels();

  const isAllVessels = vesselId === 'all';

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

  // Helper: Calculate stock status
  const getStockStatus = (rob: number, min: number): { label: string; isLow: boolean } => {
    if (rob < min) return { label: 'Low', isLow: true };
    if (rob === min) return { label: 'At Min', isLow: true };
    return { label: 'OK', isLow: false };
  };

  // Work Order KPIs with computed status
  const workOrderKPIs = useMemo(() => {
    const safeWOs = workOrdersData.filter(wo => wo !== null && wo !== undefined);
    
    const overdue = safeWOs.filter(wo => 
      (wo as any).computedStatus === 'Overdue' && !wo.isExecution
    );
    const due = safeWOs.filter(wo => 
      ((wo as any).computedStatus === 'Due' || (wo as any).computedStatus === 'Due (Grace P)') && !wo.isExecution
    );
    const pendingApproval = safeWOs.filter(wo => 
      (wo as any).computedStatus === 'Pending Approval'
    );
    const completed = safeWOs.filter(wo => 
      (wo as any).computedStatus === 'Completed'
    );
    const active = safeWOs.filter(wo => 
      (wo as any).computedStatus === 'Active' && !wo.isExecution
    );

    return {
      total: safeWOs.filter(wo => !wo.isExecution).length,
      overdue: overdue.length,
      overdueList: overdue.slice(0, 5),
      due: due.length,
      dueList: due.slice(0, 5),
      pendingApproval: pendingApproval.length,
      pendingApprovalList: pendingApproval.slice(0, 5),
      completed: completed.length,
      active: active.length
    };
  }, [workOrdersData]);

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

  const handleRefresh = () => {
    setLastUpdated(new Date());
    window.location.reload();
  };

  const isLoading = isWorkOrdersLoading || isSparesLoading || isStoresLoading || isComponentsLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="text-dashboard-title">PMS Dashboard</h1>
              <p className="text-sm text-gray-500">Planned Maintenance System Control Center</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                E-PMS Active
              </Badge>
              <span className="text-sm text-gray-500">
                Last updated: {format(lastUpdated, 'HH:mm:ss')}
              </span>
              <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Vessel Selector */}
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
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-6 space-y-6">
        
        {/* Work Order Status KPI Cards - Clickable */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-red-500"
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
            className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-amber-500"
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
            className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-blue-500"
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
            className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-green-500"
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
            className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-gray-400"
            onClick={() => navigateToWorkOrders('Active')}
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

        {/* Charts Row - Work Order Status, Outstanding Tasks, and Spares Stock */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Work Order Status Donut - Clickable */}
          <Card data-testid="card-wo-status-chart">
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
                          else navigateToWorkOrders('Active');
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

          {/* Outstanding Tasks as Percentage of Monthly Planned Maintenance - NEW */}
          <Card data-testid="card-outstanding-tasks-chart">
            <CardHeader>
              <CardTitle>Outstanding Tasks as % of Monthly Planned Maintenance</CardTitle>
              <CardDescription>
                {outstandingTasksChartData.totalMonthly > 0 
                  ? `${outstandingTasksChartData.outstandingCount} of ${outstandingTasksChartData.totalMonthly} tasks outstanding (${outstandingTasksChartData.outstandingPercent}%)`
                  : 'No planned maintenance tasks this month'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {outstandingTasksChartData.data.length > 0 ? (
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
                            navigateToWorkOrders('Active');
                          } else {
                            navigateToWorkOrders('Completed');
                          }
                        }
                      }
                    } as any],
                    legend: { enabled: true, position: 'bottom' }
                  } as AgChartOptions} />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    No planned maintenance tasks this month
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Spares Stock Status Donut - Clickable */}
          <Card data-testid="card-spares-status-chart">
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

        {/* Actionable Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overdue Work Orders Table */}
          <Card data-testid="card-overdue-table">
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
          <Card data-testid="card-low-stock-table">
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
            className="cursor-pointer hover:shadow-lg transition-shadow"
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
            className="cursor-pointer hover:shadow-lg transition-shadow"
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
            className="cursor-pointer hover:shadow-lg transition-shadow"
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
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={navigateToRunningHours}
            data-testid="card-running-hours-summary"
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Gauge className="w-4 h-4 text-orange-500" />
                Running Hours
              </CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                Track
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Update component hours</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stores Breakdown */}
        <Card data-testid="card-stores-breakdown">
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

        {/* Quick Actions */}
        <Card data-testid="card-quick-actions">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Navigate to sub-modules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button 
                variant="outline" 
                className="h-16 flex flex-col gap-1"
                onClick={() => navigateToWorkOrders()}
                data-testid="button-goto-workorders"
              >
                <Wrench className="w-5 h-5" />
                <span className="text-xs">Work Orders</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-16 flex flex-col gap-1"
                onClick={navigateToComponents}
                data-testid="button-goto-components"
              >
                <Box className="w-5 h-5" />
                <span className="text-xs">Components</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-16 flex flex-col gap-1"
                onClick={() => navigateToSpares()}
                data-testid="button-goto-spares"
              >
                <Package className="w-5 h-5" />
                <span className="text-xs">Spares</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-16 flex flex-col gap-1"
                onClick={navigateToReports}
                data-testid="button-goto-reports"
              >
                <FileText className="w-5 h-5" />
                <span className="text-xs">Reports</span>
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default Dashboard;
