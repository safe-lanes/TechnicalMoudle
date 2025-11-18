import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { useVessel } from "@/contexts/VesselContext";
import {
  RefreshCw,
  Moon,
  Sun,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Package,
  Clock,
  ChevronDown,
  Ship,
  BarChart3,
  Activity,
  Wrench,
  Shield
} from "lucide-react";
import { AgCharts } from "ag-charts-react";
import { AgChartOptions } from "ag-charts-community";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkOrder } from "@shared/schema";

interface DashboardFilters {
  vesselId: string;
  dateRange: string;
  startDate: Date;
  endDate: Date;
}

const Dashboard = () => {
  const [, setLocation] = useLocation();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('dashboard-dark-mode') === 'true';
  });
  const [activeTab, setActiveTab] = useState("overview");
  const { vesselId, setVesselId } = useVessel();

  // Dashboard filters (date range only, vessel comes from context)
  const [filters, setFilters] = useState(() => {
    const saved = localStorage.getItem('dashboard-filters');
    const defaultFilters = {
      dateRange: 'last30',
      startDate: subDays(new Date(), 30),
      endDate: new Date()
    };
    
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        startDate: new Date(parsed.startDate),
        endDate: new Date(parsed.endDate)
      };
    }
    return defaultFilters;
  });

  // Vessel list
  const vessels = [
    { id: 'V001', name: 'MV Ocean Pioneer' },
    { id: 'V002', name: 'MV Sea Explorer' },
    { id: 'V003', name: 'MV Maritime Star' }
  ];

  // Date range presets
  const dateRanges = [
    { id: 'last7', label: 'Last 7 days', days: 7 },
    { id: 'last30', label: 'Last 30 days', days: 30 },
    { id: 'last90', label: 'Last 90 days', days: 90 },
    { id: 'ytd', label: 'Year to Date', isYTD: true }
  ];

  // Fetch real work orders data
  const { data: workOrdersData = [], isLoading: isWorkOrdersLoading } = useQuery({
    queryKey: ['/api/work-orders', vesselId],
    queryFn: async () => {
      const response = await fetch(`/api/work-orders?vesselId=${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch work orders');
      return await response.json() as WorkOrder[];
    }
  });

  // Fetch spares data
  const { data: sparesData = [] } = useQuery({
    queryKey: ['/api/spares', vesselId],
    queryFn: async () => {
      const response = await fetch(`/api/spares/${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch spares');
      return response.json();
    }
  });

  // Filter work orders based on date range
  const filteredWorkOrders = useMemo(() => {
    if (!workOrdersData || workOrdersData.length === 0) return [];
    return workOrdersData.filter(wo => {
      const woDate = new Date(wo.createdAt);
      return woDate >= filters.startDate && woDate <= filters.endDate;
    });
  }, [workOrdersData, filters]);

  // Helper: Determine department from component code
  const getDepartment = (componentCode: string): 'Engine' | 'Deck' | 'Electrical' | 'Other' => {
    if (!componentCode) return 'Other';
    const code = componentCode.toLowerCase();
    if (code.includes('engine') || code.includes('6.') || code.includes('boiler') || code.includes('generator')) {
      return 'Engine';
    }
    if (code.includes('electrical') || code.includes('power') || code.includes('battery')) {
      return 'Electrical';
    }
    if (code.includes('deck') || code.includes('crane') || code.includes('winch') || code.includes('steering')) {
      return 'Deck';
    }
    return 'Other';
  };

  // Helper: Get equipment category
  const getEquipmentCategory = (componentCode: string): string => {
    if (!componentCode) return 'Other';
    const code = componentCode.toLowerCase();
    if (code.includes('engine') || code.includes('6.') || code.includes('turbo')) return 'Main Engine';
    if (code.includes('generator') || code.includes('aux')) return 'Auxiliary Machinery';
    if (code.includes('pump')) return 'Pumps & Systems';
    if (code.includes('crane') || code.includes('winch') || code.includes('deck')) return 'Deck Machinery';
    if (code.includes('safety') || code.includes('fire') || code.includes('lifeboat')) return 'Safety Equipment';
    if (code.includes('nav') || code.includes('radar') || code.includes('radio')) return 'Navigation & Electronics';
    return 'Other';
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    const total = filteredWorkOrders.length;
    const completed = filteredWorkOrders.filter(wo => wo.status === 'Completed').length;
    const overdue = filteredWorkOrders.filter(wo => wo.status === 'Overdue').length;
    const pending = filteredWorkOrders.filter(wo => wo.status === 'Due').length;
    const criticalSpares = sparesData.filter((s: any) => s.stockStatus === 'Critical').length;
    
    return {
      activeWorkOrders: total - completed,
      completedWorkOrders: completed,
      overduePercentage: total > 0 ? ((overdue / total) * 100).toFixed(1) : '0.0',
      completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0',
      criticalSpares,
      totalSpares: sparesData.length
    };
  }, [filteredWorkOrders, sparesData]);

  // Department breakdown for bar charts
  const departmentData = useMemo(() => {
    const depts = ['Engine', 'Deck', 'Electrical', 'Other'];
    return depts.map(dept => {
      const deptWOs = filteredWorkOrders.filter(wo => getDepartment(wo.componentCode || '') === dept);
      return {
        department: dept,
        scheduled: deptWOs.filter(wo => wo.status === 'Due').length,
        completed: deptWOs.filter(wo => wo.status === 'Completed').length,
        overdue: deptWOs.filter(wo => wo.status === 'Overdue').length
      };
    });
  }, [filteredWorkOrders]);

  // Time series data for line/area charts
  const timeSeriesData = useMemo(() => {
    const days = 30;
    const data: { date: string; completed: number; created: number; cumulative: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'MM/dd');
      const wosOnDate = filteredWorkOrders.filter(wo => {
        const woDate = new Date(wo.createdAt);
        return format(woDate, 'MM/dd') === dateStr;
      });
      data.push({
        date: dateStr,
        completed: wosOnDate.filter(wo => wo.status === 'Completed').length,
        created: wosOnDate.length,
        cumulative: data.length > 0 ? data[data.length - 1].cumulative + wosOnDate.length : wosOnDate.length
      });
    }
    return data;
  }, [filteredWorkOrders]);

  // Job type breakdown for pie charts - using real data from work orders
  const jobTypeData = useMemo(() => {
    const typeCount: Record<string, number> = {};
    filteredWorkOrders.forEach(wo => {
      const type = wo.taskType || 'Other';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    
    const colorMap: Record<string, string> = {
      'Inspection': '#3b82f6',
      'Overhaul': '#10b981',
      'Service': '#f59e0b',
      'Testing': '#8b5cf6',
      'Other': '#6b7280'
    };
    
    return Object.entries(typeCount).map(([type, count]) => ({
      type,
      count,
      color: colorMap[type] || '#6b7280'
    }));
  }, [filteredWorkOrders]);

  // Criticality breakdown
  const criticalityData = useMemo(() => {
    const critical = filteredWorkOrders.filter(wo => wo.jobPriority === 'Critical' || wo.jobPriority === 'High').length;
    const medium = filteredWorkOrders.filter(wo => wo.jobPriority === 'Medium').length;
    const low = filteredWorkOrders.filter(wo => wo.jobPriority === 'Low').length;
    return [
      { level: 'Critical', count: critical, color: '#ef4444' },
      { level: 'Medium', count: medium, color: '#f59e0b' },
      { level: 'Low', count: low, color: '#10b981' }
    ];
  }, [filteredWorkOrders]);

  // Heatmap data: Department activity by day of week - using real data
  const heatmapData = useMemo(() => {
    const departments = ['Engine', 'Deck', 'Electrical', 'Other'];
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = [];
    
    for (const dept of departments) {
      for (const day of daysOfWeek) {
        // Filter work orders by department and day of week
        const dayWOs = filteredWorkOrders.filter(wo => {
          const woDept = getDepartment(wo.componentCode || '');
          const woDate = new Date(wo.createdAt);
          const woDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][woDate.getDay()];
          return woDept === dept && woDay === day;
        });
        
        const count = dayWOs.length;
        data.push({
          department: dept,
          day,
          activity: count,
          color: count > 15 ? '#ef4444' : count > 10 ? '#f59e0b' : count > 5 ? '#3b82f6' : '#10b981'
        });
      }
    }
    return data;
  }, [filteredWorkOrders]);

  // Scatter plot data: Maintenance frequency vs Equipment age - using real frequency data
  const scatterData = useMemo(() => {
    const categories = ['Main Engine', 'Auxiliary Machinery', 'Pumps & Systems', 'Deck Machinery', 'Safety Equipment', 'Navigation & Electronics'];
    return categories.map((category, idx) => {
      const categoryWOs = filteredWorkOrders.filter(wo => getEquipmentCategory(wo.componentCode || '') === category);
      // Use index as proxy for age since we don't have actual equipment age in schema
      // Main Engine (older) vs Navigation (newer)
      const estimatedAge = idx <= 1 ? 10 + idx * 2 : 3 + idx;
      return {
        category,
        equipmentAge: estimatedAge,
        maintenanceFrequency: categoryWOs.length,
        size: Math.max(categoryWOs.length * 3, 10) // Bubble size, minimum 10
      };
    }).filter(d => d.maintenanceFrequency > 0); // Only show categories with data
  }, [filteredWorkOrders]);

  // Treemap data: Hierarchical cost view by department - based on work order count
  const treemapData = useMemo(() => {
    const departments = ['Engine', 'Deck', 'Electrical', 'Other'];
    return departments.map(dept => {
      const deptWOs = filteredWorkOrders.filter(wo => getDepartment(wo.componentCode || '') === dept);
      // Calculate estimated costs based on work order counts and typical ratios
      const laborCost = deptWOs.length * 350;  // $350 avg per WO
      const partsCost = deptWOs.length * 520;  // $520 avg per WO
      const servicesCost = deptWOs.length * 180; // $180 avg per WO
      
      return {
        name: dept,
        value: laborCost + partsCost + servicesCost,
        children: [
          { name: 'Labor', value: laborCost },
          { name: 'Parts', value: partsCost },
          { name: 'Services', value: servicesCost }
        ]
      };
    }).filter(d => d.value > 0); // Only show departments with work orders
  }, [filteredWorkOrders]);

  // Equipment category performance metrics
  const equipmentPerformanceData = useMemo(() => {
    const categories = ['Main Engine', 'Auxiliary Machinery', 'Pumps & Systems', 'Deck Machinery', 'Safety Equipment', 'Navigation & Electronics'];
    return categories.map(category => {
      const categoryWOs = filteredWorkOrders.filter(wo => getEquipmentCategory(wo.componentCode || '') === category);
      const completed = categoryWOs.filter(wo => wo.status === 'Completed').length;
      return {
        category,
        total: categoryWOs.length,
        completed,
        pending: categoryWOs.filter(wo => wo.status === 'Due').length,
        overdue: categoryWOs.filter(wo => wo.status === 'Overdue').length,
        completionRate: categoryWOs.length > 0 ? ((completed / categoryWOs.length) * 100).toFixed(1) : '0'
      };
    });
  }, [filteredWorkOrders]);

  // Handle filter changes
  const handleVesselChange = (newVesselId: string) => {
    setVesselId(newVesselId);
  };

  const handleDateRangeChange = (rangeId: string) => {
    const range = dateRanges.find(r => r.id === rangeId);
    if (!range) return;

    let startDate: Date;
    let endDate = new Date();

    if (range.isYTD) {
      startDate = startOfYear(new Date());
    } else if (range.days) {
      startDate = subDays(new Date(), range.days);
    } else {
      startDate = subDays(new Date(), 30);
    }

    const newFilters = { ...filters, dateRange: rangeId, startDate, endDate };
    setFilters(newFilters);
    localStorage.setItem('dashboard-filters', JSON.stringify(newFilters));
  };

  const handleRefresh = () => {
    setLastUpdated(new Date());
    window.location.reload();
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('dashboard-dark-mode', String(newMode));
    document.documentElement.classList.toggle('dark', newMode);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-dashboard-title">Dashboard</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Electronic Planned Maintenance System Control Center</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Activity className="w-3 h-3 mr-1" />
                E-PMS Active
              </Badge>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Last updated: {format(lastUpdated, 'HH:mm:ss')}
              </span>
              <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={toggleDarkMode} data-testid="button-theme-toggle">
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Ship className="w-4 h-4 text-gray-500" />
              <Select value={vesselId} onValueChange={handleVesselChange}>
                <SelectTrigger className="w-48" data-testid="select-vessel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vessels.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <Select value={filters.dateRange} onValueChange={handleDateRangeChange}>
                <SelectTrigger className="w-40" data-testid="select-date-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dateRanges.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto" data-testid="tabs-navigation">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="departments" data-testid="tab-departments">
              <Wrench className="w-4 h-4 mr-2" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="equipment" data-testid="tab-equipment">
              <Package className="w-4 h-4 mr-2" />
              Equipment
            </TabsTrigger>
            <TabsTrigger value="compliance" data-testid="tab-compliance">
              <Shield className="w-4 h-4 mr-2" />
              Compliance
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="card-active-work-orders">
                <CardHeader className="pb-2">
                  <CardDescription>Active Work Orders</CardDescription>
                  <CardTitle className="text-3xl">{kpis.activeWorkOrders}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm">
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-green-600">+2 from last week</span>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-completion-rate">
                <CardHeader className="pb-2">
                  <CardDescription>Completion Rate</CardDescription>
                  <CardTitle className="text-3xl">{kpis.completionRate}%</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-gray-600 dark:text-gray-400">{kpis.completedWorkOrders} completed</span>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-overdue-tasks">
                <CardHeader className="pb-2">
                  <CardDescription>Overdue Tasks</CardDescription>
                  <CardTitle className="text-3xl text-red-600">{kpis.overduePercentage}%</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm">
                    <AlertTriangle className="w-4 h-4 text-red-500 mr-1" />
                    <span className="text-red-600">Action needed</span>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-critical-spares">
                <CardHeader className="pb-2">
                  <CardDescription>Critical Stock Alerts</CardDescription>
                  <CardTitle className="text-3xl">{kpis.criticalSpares}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm">
                    <Package className="w-4 h-4 text-orange-500 mr-1" />
                    <span className="text-gray-600 dark:text-gray-400">Low stock items</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart: Work Orders by Department */}
              <Card data-testid="card-dept-bar-chart">
                <CardHeader>
                  <CardTitle>Work Orders by Department</CardTitle>
                  <CardDescription>Scheduled, Completed, and Overdue maintenance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <AgCharts options={{
                      data: departmentData,
                      series: [
                        {
                          type: 'bar',
                          xKey: 'department',
                          yKey: 'scheduled',
                          yName: 'Scheduled',
                          fill: '#3b82f6',
                          strokeWidth: 0,
                          stacked: true
                        },
                        {
                          type: 'bar',
                          xKey: 'department',
                          yKey: 'completed',
                          yName: 'Completed',
                          fill: '#10b981',
                          strokeWidth: 0,
                          stacked: true
                        },
                        {
                          type: 'bar',
                          xKey: 'department',
                          yKey: 'overdue',
                          yName: 'Overdue',
                          fill: '#ef4444',
                          strokeWidth: 0,
                          stacked: true
                        }
                      ] as any,
                      axes: [
                        { type: 'category', position: 'bottom' },
                        { type: 'number', position: 'left', title: { text: 'Work Orders' } }
                      ] as any,
                      legend: { enabled: true, position: 'bottom' }
                    } as AgChartOptions} />
                  </div>
                </CardContent>
              </Card>

              {/* Line Chart: Completion Trends */}
              <Card data-testid="card-completion-trend">
                <CardHeader>
                  <CardTitle>Maintenance Completion Trends</CardTitle>
                  <CardDescription>Daily work order completion vs creation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <AgCharts options={{
                      data: timeSeriesData,
                      series: [
                        {
                          type: 'line',
                          xKey: 'date',
                          yKey: 'completed',
                          yName: 'Completed',
                          stroke: '#10b981',
                          marker: { enabled: true, size: 6 }
                        },
                        {
                          type: 'line',
                          xKey: 'date',
                          yKey: 'created',
                          yName: 'Created',
                          stroke: '#3b82f6',
                          marker: { enabled: true, size: 6 }
                        }
                      ] as any,
                      axes: [
                        { type: 'category', position: 'bottom' },
                        { type: 'number', position: 'left', title: { text: 'Count' } }
                      ] as any,
                      legend: { enabled: true, position: 'bottom' }
                    } as AgChartOptions} />
                  </div>
                </CardContent>
              </Card>

              {/* Pie Chart: Job Types */}
              <Card data-testid="card-job-types">
                <CardHeader>
                  <CardTitle>Maintenance Job Types</CardTitle>
                  <CardDescription>Breakdown by maintenance category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <AgCharts options={{
                      data: jobTypeData,
                      series: [{
                        type: 'pie',
                        angleKey: 'count',
                        calloutLabelKey: 'type',
                        sectorLabelKey: 'count',
                        fills: jobTypeData.map(d => d.color),
                        strokes: jobTypeData.map(d => d.color)
                      } as any],
                      legend: { enabled: true, position: 'bottom' }
                    } as AgChartOptions} />
                  </div>
                </CardContent>
              </Card>

              {/* Area Chart: Cumulative Work Orders */}
              <Card data-testid="card-cumulative-area">
                <CardHeader>
                  <CardTitle>Cumulative Maintenance Activity</CardTitle>
                  <CardDescription>Total work orders over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <AgCharts options={{
                      data: timeSeriesData,
                      series: [{
                        type: 'area',
                        xKey: 'date',
                        yKey: 'cumulative',
                        fill: '#3b82f6',
                        fillOpacity: 0.3,
                        stroke: '#3b82f6',
                        strokeWidth: 2
                      } as any],
                      axes: [
                        { type: 'category', position: 'bottom' },
                        { type: 'number', position: 'left', title: { text: 'Cumulative Count' } }
                      ] as any,
                      legend: { enabled: false }
                    } as AgChartOptions} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* DEPARTMENTS TAB */}
          <TabsContent value="departments" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-dept-comparison">
                <CardHeader>
                  <CardTitle>Department Performance Comparison</CardTitle>
                  <CardDescription>Maintenance workload across departments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96">
                    <AgCharts options={{
                      data: departmentData,
                      series: [{
                        type: 'bar',
                        xKey: 'department',
                        yKey: 'completed',
                        yName: 'Completed',
                        fill: '#10b981'
                      } as any],
                      axes: [
                        { type: 'category', position: 'bottom' },
                        { type: 'number', position: 'left' }
                      ] as any
                    } as AgChartOptions} />
                  </div>
                </CardContent>
              </Card>

              {/* Heatmap: Department activity by day - Using AG Charts bubble chart */}
              <Card data-testid="card-dept-heatmap">
                <CardHeader>
                  <CardTitle>Maintenance Activity Heatmap</CardTitle>
                  <CardDescription>Bubble size represents activity level (larger = more tasks)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96">
                    <AgCharts options={{
                      data: heatmapData.map((d, idx) => ({
                        ...d,
                        dayIndex: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(d.day),
                        deptIndex: ['Engine', 'Deck', 'Electrical', 'Other'].indexOf(d.department),
                        displaySize: Math.max(d.activity, 1) // Ensure visible markers even for 0 activity
                      })),
                      series: [{
                        type: 'scatter',
                        xKey: 'dayIndex',
                        yKey: 'deptIndex',
                        sizeKey: 'displaySize',
                        yName: 'Maintenance Activity',
                        marker: {
                          size: 5,
                          maxSize: 45,
                          fill: '#3b82f6',
                          fillOpacity: 0.7,
                          stroke: '#1e40af',
                          strokeWidth: 2
                        },
                        tooltip: {
                          renderer: (params: any) => ({
                            content: `${params.datum.department} - ${params.datum.day}<br/>Tasks: ${params.datum.activity}`
                          })
                        }
                      } as any],
                      axes: [
                        { 
                          type: 'category', 
                          position: 'bottom',
                          keys: ['dayIndex'],
                          title: { text: 'Day of Week' },
                          label: {
                            formatter: (params: any) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][params.value] || ''
                          }
                        },
                        { 
                          type: 'category', 
                          position: 'left',
                          keys: ['deptIndex'],
                          title: { text: 'Department' },
                          label: {
                            formatter: (params: any) => ['Engine', 'Deck', 'Electrical', 'Other'][params.value] || ''
                          }
                        }
                      ] as any,
                      legend: { 
                        enabled: true, 
                        position: 'bottom'
                      }
                    } as AgChartOptions} />
                  </div>
                </CardContent>
              </Card>

              {/* Treemap as grouped bar chart: Cost hierarchy by department */}
              <Card data-testid="card-dept-treemap">
                <CardHeader>
                  <CardTitle>Cost Distribution by Department</CardTitle>
                  <CardDescription>Hierarchical view of maintenance costs (Labor/Parts/Services)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96">
                    <AgCharts options={{
                      data: treemapData.map(dept => ({
                        department: dept.name,
                        labor: dept.children.find(c => c.name === 'Labor')?.value || 0,
                        parts: dept.children.find(c => c.name === 'Parts')?.value || 0,
                        services: dept.children.find(c => c.name === 'Services')?.value || 0
                      })),
                      series: [
                        {
                          type: 'bar',
                          xKey: 'department',
                          yKey: 'labor',
                          yName: 'Labor',
                          grouped: true,
                          fill: '#3b82f6'
                        },
                        {
                          type: 'bar',
                          xKey: 'department',
                          yKey: 'parts',
                          yName: 'Parts',
                          grouped: true,
                          fill: '#10b981'
                        },
                        {
                          type: 'bar',
                          xKey: 'department',
                          yKey: 'services',
                          yName: 'Services',
                          grouped: true,
                          fill: '#f59e0b'
                        }
                      ] as any,
                      axes: [
                        { type: 'category', position: 'bottom', title: { text: 'Department' } },
                        { type: 'number', position: 'left', title: { text: 'Cost ($)' } }
                      ] as any,
                      legend: { enabled: true, position: 'bottom' }
                    } as AgChartOptions} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* EQUIPMENT TAB */}
          <TabsContent value="equipment" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-criticality-pie">
                <CardHeader>
                  <CardTitle>Equipment Criticality Levels</CardTitle>
                  <CardDescription>Maintenance priority distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96">
                    <AgCharts options={{
                      data: criticalityData,
                      series: [{
                        type: 'pie',
                        angleKey: 'count',
                        calloutLabelKey: 'level',
                        sectorLabelKey: 'count',
                        fills: criticalityData.map(d => d.color),
                        strokes: criticalityData.map(d => d.color)
                      } as any],
                      legend: { enabled: true, position: 'bottom' }
                    } as AgChartOptions} />
                  </div>
                </CardContent>
              </Card>

              {/* Scatter/Bubble Chart: Maintenance vs Age */}
              <Card data-testid="card-scatter-bubble">
                <CardHeader>
                  <CardTitle>Maintenance Frequency vs Equipment Age</CardTitle>
                  <CardDescription>Bubble size represents maintenance workload</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96">
                    <AgCharts options={{
                      data: scatterData,
                      series: [{
                        type: 'scatter',
                        xKey: 'equipmentAge',
                        yKey: 'maintenanceFrequency',
                        sizeKey: 'size',
                        labelKey: 'category',
                        marker: {
                          size: 10,
                          maxSize: 30,
                          fill: '#3b82f6',
                          fillOpacity: 0.7,
                          stroke: '#1e40af',
                          strokeWidth: 2
                        },
                        tooltip: {
                          renderer: (params: any) => ({
                            content: `${params.datum.category}<br/>Age: ${params.datum.equipmentAge} years<br/>Frequency: ${params.datum.maintenanceFrequency} jobs`
                          })
                        }
                      } as any],
                      axes: [
                        { type: 'number', position: 'bottom', title: { text: 'Equipment Age (years)' } },
                        { type: 'number', position: 'left', title: { text: 'Maintenance Frequency' } }
                      ] as any
                    } as AgChartOptions} />
                  </div>
                </CardContent>
              </Card>

              {/* Equipment Performance Bar Chart */}
              <Card data-testid="card-equipment-performance" className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Equipment Category Performance</CardTitle>
                  <CardDescription>Completion rates by equipment type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96">
                    <AgCharts options={{
                      data: equipmentPerformanceData,
                      series: [
                        {
                          type: 'bar',
                          xKey: 'category',
                          yKey: 'completed',
                          yName: 'Completed',
                          fill: '#10b981',
                          stacked: true
                        },
                        {
                          type: 'bar',
                          xKey: 'category',
                          yKey: 'pending',
                          yName: 'Pending',
                          fill: '#3b82f6',
                          stacked: true
                        },
                        {
                          type: 'bar',
                          xKey: 'category',
                          yKey: 'overdue',
                          yName: 'Overdue',
                          fill: '#ef4444',
                          stacked: true
                        }
                      ] as any,
                      axes: [
                        { type: 'category', position: 'bottom' },
                        { type: 'number', position: 'left', title: { text: 'Work Orders' } }
                      ] as any,
                      legend: { enabled: true, position: 'bottom' }
                    } as AgChartOptions} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* COMPLIANCE TAB */}
          <TabsContent value="compliance" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Certificate Status Pie */}
              <Card data-testid="card-compliance-status">
                <CardHeader>
                  <CardTitle>Certificate Status Overview</CardTitle>
                  <CardDescription>Expiring and expired certificates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96">
                    <AgCharts options={{
                      data: [
                        { status: 'Valid', count: 15, color: '#10b981' },
                        { status: 'Expiring Soon', count: 3, color: '#f59e0b' },
                        { status: 'Expired', count: 1, color: '#ef4444' }
                      ],
                      series: [{
                        type: 'pie',
                        angleKey: 'count',
                        calloutLabelKey: 'status',
                        sectorLabelKey: 'count',
                        fills: ['#10b981', '#f59e0b', '#ef4444'],
                        strokes: ['#10b981', '#f59e0b', '#ef4444']
                      } as any],
                      legend: { enabled: true, position: 'bottom' }
                    } as AgChartOptions} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
