import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import {
  LayoutDashboard,
  RefreshCw,
  Moon,
  Sun,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Package,
  ClipboardList,
  Clock,
  Archive,
  Store,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Ship,
  BarChart3,
  Activity
} from "lucide-react";
import {
  ComposedChart,
  DonutChart,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  LineChart
} from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Types for dashboard data
interface WorkOrderMock {
  id: string;
  title: string;
  component: string;
  dueDate: string;
  status: "pending" | "in_progress" | "completed" | "overdue";
  priority: "critical" | "routine";
  vesselId: string;
  createdDate: string;
  completedDate?: string;
}

interface DashboardFilters {
  vesselId: string;
  dateRange: string;
  startDate: Date;
  endDate: Date;
}

const Dashboard: React.FC = () => {
  const [, setLocation] = useLocation();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('dashboard-dark-mode') === 'true';
  });

  // Dashboard filters
  const [filters, setFilters] = useState<DashboardFilters>(() => {
    const saved = localStorage.getItem('dashboard-filters');
    const defaultFilters = {
      vesselId: 'all',
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
    { id: 'all', name: 'All Vessels' },
    { id: 'V001', name: 'MV Ocean Pioneer' },
    { id: 'V002', name: 'MV Sea Explorer' },
    { id: 'V003', name: 'MV Maritime Star' }
  ];

  // Date range presets
  const dateRanges = [
    { id: 'last7', label: 'Last 7 days', days: 7 },
    { id: 'last30', label: 'Last 30 days', days: 30 },
    { id: 'last90', label: 'Last 90 days', days: 90 },
    { id: 'thisMonth', label: 'This Month', isMonth: true },
    { id: 'lastMonth', label: 'Last Month', isLastMonth: true },
    { id: 'ytd', label: 'Year to Date', isYTD: true }
  ];

  // Mock Work Orders Data (realistic for demo)
  const mockWorkOrders: WorkOrderMock[] = useMemo(() => [
    {
      id: "WO-2024-001",
      title: "Main Engine Cylinder Head Overhaul",
      component: "6.1.1.1 Cylinder Head",
      dueDate: "2024-01-15",
      status: "overdue",
      priority: "critical",
      vesselId: "V001",
      createdDate: "2024-01-01",
    },
    {
      id: "WO-2024-002", 
      title: "Fresh Water Pump Inspection",
      component: "1.1.1.2 Feed Pump",
      dueDate: "2024-01-20",
      status: "pending",
      priority: "routine",
      vesselId: "V001",
      createdDate: "2024-01-05",
    },
    {
      id: "WO-2024-003",
      title: "Steering Gear Oil Change",
      component: "3.1 Steering Gear",
      dueDate: "2024-01-25",
      status: "in_progress", 
      priority: "routine",
      vesselId: "V002",
      createdDate: "2024-01-10",
    },
    {
      id: "WO-2024-004",
      title: "Boiler Safety Valve Test",
      component: "4.1.2 Safety Valve",
      dueDate: "2024-01-12",
      status: "completed",
      priority: "critical",
      vesselId: "V001",
      createdDate: "2024-01-01",
      completedDate: "2024-01-11",
    },
    {
      id: "WO-2024-005",
      title: "Compressor Filter Replacement",
      component: "5.2.1 Air Filter",
      dueDate: "2024-01-30",
      status: "pending",
      priority: "routine",
      vesselId: "V003",
      createdDate: "2024-01-15",
    },
    {
      id: "WO-2024-006",
      title: "Emergency Generator Load Test",
      component: "6.3 Emergency Generator",
      dueDate: "2024-01-08",
      status: "overdue",
      priority: "critical",
      vesselId: "V002",
      createdDate: "2023-12-25",
    },
    {
      id: "WO-2024-007",
      title: "Fire Pump Maintenance",
      component: "7.1 Fire Pump",
      dueDate: "2024-02-01",
      status: "pending",
      priority: "critical",
      vesselId: "V001",
      createdDate: "2024-01-18",
    },
    {
      id: "WO-2024-008",
      title: "Auxiliary Engine Service",
      component: "6.2 Auxiliary Engine",
      dueDate: "2024-01-18",
      status: "completed",
      priority: "routine",
      vesselId: "V003",
      createdDate: "2024-01-05",
      completedDate: "2024-01-17",
    }
  ], []);

  // Fetch real spares data
  const { data: sparesData = [] } = useQuery({
    queryKey: ['/api/spares', filters.vesselId === 'all' ? 'V001' : filters.vesselId],
    queryFn: async () => {
      const vesselToFetch = filters.vesselId === 'all' ? 'V001' : filters.vesselId;
      const response = await fetch(`/api/spares/${vesselToFetch}`);
      if (!response.ok) throw new Error('Failed to fetch spares');
      return response.json();
    }
  });

  // Filter work orders based on current filters
  const filteredWorkOrders = useMemo(() => {
    return mockWorkOrders.filter(wo => {
      if (filters.vesselId !== 'all' && wo.vesselId !== filters.vesselId) {
        return false;
      }
      
      const woDate = new Date(wo.createdDate);
      return woDate >= filters.startDate && woDate <= filters.endDate;
    });
  }, [mockWorkOrders, filters]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const activeWOs = filteredWorkOrders.filter(wo => wo.status !== 'completed').length;
    const overdueWOs = filteredWorkOrders.filter(wo => wo.status === 'overdue').length;
    const completedWOs = filteredWorkOrders.filter(wo => wo.status === 'completed').length;
    
    // Calculate low stock items
    const lowStockItems = sparesData.filter((spare: any) => spare.rob < spare.min).length;
    
    return {
      activeWorkOrders: activeWOs,
      overdueTasks: overdueWOs,
      completedThisPeriod: completedWOs,
      criticalStockAlerts: lowStockItems
    };
  }, [filteredWorkOrders, sparesData]);

  // Generate sparkline data (last 12 data points)
  const generateSparklineData = (type: string) => {
    const points = [];
    for (let i = 11; i >= 0; i--) {
      const date = subDays(new Date(), i);
      let value = 0;
      
      switch (type) {
        case 'active':
          value = Math.floor(Math.random() * 10) + 15; // 15-25 range
          break;
        case 'overdue':
          value = Math.floor(Math.random() * 5) + 3; // 3-8 range
          break;
        case 'completed':
          value = Math.floor(Math.random() * 8) + 5; // 5-13 range
          break;
        case 'critical':
          value = Math.floor(Math.random() * 6) + 8; // 8-14 range
          break;
      }
      
      points.push({ date: format(date, 'MM/dd'), value });
    }
    return points;
  };

  // Chart data
  const workOrderStatusData = [
    { name: 'Pending', value: filteredWorkOrders.filter(wo => wo.status === 'pending').length, color: '#fbbf24' },
    { name: 'In Progress', value: filteredWorkOrders.filter(wo => wo.status === 'in_progress').length, color: '#3b82f6' },
    { name: 'Completed', value: filteredWorkOrders.filter(wo => wo.status === 'completed').length, color: '#10b981' },
    { name: 'Overdue', value: filteredWorkOrders.filter(wo => wo.status === 'overdue').length, color: '#ef4444' }
  ];

  const completionTrendData = useMemo(() => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const completed = Math.floor(Math.random() * 6) + 2;
      const created = Math.floor(Math.random() * 4) + 3;
      
      data.push({
        date: format(date, 'MM/dd'),
        completed,
        created
      });
    }
    return data;
  }, [filters.dateRange]);

  const upcomingMaintenanceData = [
    { name: 'Due in 7d', critical: 3, routine: 9, total: 12 },
    { name: '8-30d', critical: 5, routine: 18, total: 23 },
    { name: '>30d', critical: 2, routine: 28, total: 30 }
  ];

  const inventoryHealthData = [
    { name: 'Spares', total: sparesData.length, belowMin: sparesData.filter((s: any) => s.rob < s.min).length },
    { name: 'Stores', total: 198, belowMin: 5 },
    { name: 'Lubes', total: 45, belowMin: 2 },
    { name: 'Chemicals', total: 32, belowMin: 1 }
  ];

  // Top overdue work orders
  const topOverdueWOs = filteredWorkOrders
    .filter(wo => wo.status === 'overdue')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 10);

  // Top low stock items
  const topLowStockItems = sparesData
    .filter((spare: any) => spare.rob < spare.min)
    .sort((a: any, b: any) => (a.rob / a.min) - (b.rob / b.min))
    .slice(0, 10);

  // Update filters
  const updateFilters = (newFilters: Partial<DashboardFilters>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    localStorage.setItem('dashboard-filters', JSON.stringify(updated));
  };

  // Handle date range change
  const handleDateRangeChange = (rangeId: string) => {
    const range = dateRanges.find(r => r.id === rangeId);
    if (!range) return;

    let startDate: Date, endDate: Date;

    if (range.days) {
      endDate = new Date();
      startDate = subDays(endDate, range.days);
    } else if (range.isMonth) {
      startDate = startOfMonth(new Date());
      endDate = endOfMonth(new Date());
    } else if (range.isLastMonth) {
      const lastMonth = subDays(startOfMonth(new Date()), 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);
    } else if (range.isYTD) {
      startDate = startOfYear(new Date());
      endDate = new Date();
    } else {
      return;
    }

    updateFilters({ 
      dateRange: rangeId,
      startDate,
      endDate
    });
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('dashboard-dark-mode', newMode.toString());
    document.documentElement.classList.toggle('dark', newMode);
  };

  // Refresh data
  const handleRefresh = () => {
    setLastUpdated(new Date());
    // Trigger refetch of queries
    window.location.reload();
  };

  // Navigation helpers
  const navigateToWorkOrders = (filter?: string) => {
    const params = new URLSearchParams();
    if (filters.vesselId !== 'all') params.set('vessel', filters.vesselId);
    if (filter) params.set('status', filter);
    setLocation(`/pms/work-orders?${params.toString()}`);
  };

  const navigateToSpares = (filter?: string) => {
    const params = new URLSearchParams();
    if (filters.vesselId !== 'all') params.set('vessel', filters.vesselId);
    if (filter) params.set('stock', filter);
    setLocation(`/spares?${params.toString()}`);
  };

  const navigateToComponent = (componentId: string) => {
    setLocation(`/pms/components?component=${componentId}`);
  };

  // KPI Card Component
  const KPICard = ({ 
    title, 
    value, 
    icon: Icon, 
    color, 
    change, 
    changeType, 
    sparklineData,
    onClick
  }: {
    title: string;
    value: number;
    icon: React.ElementType;
    color: string;
    change: string;
    changeType: 'positive' | 'negative' | 'neutral';
    sparklineData: any[];
    onClick: () => void;
  }) => (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className={`text-sm flex items-center mt-1 ${
              changeType === 'positive' ? 'text-green-600' : 
              changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
            }`}>
              <TrendingUp className="h-3 w-3 mr-1" />
              {change}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
        
        {/* Mini Sparkline */}
        <div className="h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={color.includes('blue') ? '#3b82f6' : 
                        color.includes('red') ? '#ef4444' :
                        color.includes('green') ? '#10b981' : '#6b7280'}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-[#52baf3] transition-colors float-right" />
      </CardContent>
    </Card>
  );

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors ${isDarkMode ? 'dark' : ''}`}>
      {/* Header with Global Controls */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <LayoutDashboard className="h-8 w-8 text-[#52baf3] mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">PMS Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400">Maritime Planned Maintenance Control Center</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {format(lastUpdated, 'HH:mm:ss')}
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={toggleDarkMode}>
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Ship className="h-4 w-4 text-gray-500" />
            <Select value={filters.vesselId} onValueChange={(value) => updateFilters({ vesselId: value })}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select vessel" />
              </SelectTrigger>
              <SelectContent>
                {vessels.map(vessel => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    {vessel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <Select value={filters.dateRange} onValueChange={handleDateRangeChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                {dateRanges.map(range => (
                  <SelectItem key={range.id} value={range.id}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Active Work Orders"
            value={kpis.activeWorkOrders}
            icon={ClipboardList}
            color="bg-blue-50 text-blue-600 border-blue-200"
            change="+2 from last week"
            changeType="positive"
            sparklineData={generateSparklineData('active')}
            onClick={() => navigateToWorkOrders('active')}
          />
          
          <KPICard
            title="Overdue Tasks"
            value={kpis.overdueTasks}
            icon={AlertTriangle}
            color="bg-red-50 text-red-600 border-red-200"
            change="+1 this week"
            changeType="negative"
            sparklineData={generateSparklineData('overdue')}
            onClick={() => navigateToWorkOrders('overdue')}
          />
          
          <KPICard
            title="Completed This Period"
            value={kpis.completedThisPeriod}
            icon={CheckCircle}
            color="bg-green-50 text-green-600 border-green-200"
            change="+15% vs last period"
            changeType="positive"
            sparklineData={generateSparklineData('completed')}
            onClick={() => navigateToWorkOrders('completed')}
          />
          
          <KPICard
            title="Critical Stock Alerts"
            value={kpis.criticalStockAlerts}
            icon={Package}
            color="bg-yellow-50 text-yellow-600 border-yellow-200"
            change="-2 from last check"
            changeType="positive"
            sparklineData={generateSparklineData('critical')}
            onClick={() => navigateToSpares('low')}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Work Orders by Status - Donut Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 text-[#52baf3] mr-2" />
                Work Orders by Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={workOrderStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      onClick={(data) => navigateToWorkOrders(data.name.toLowerCase())}
                      className="cursor-pointer"
                    >
                      {workOrderStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Completion Trend - Area Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 text-[#52baf3] mr-2" />
                Work Order Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={completionTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="completed" 
                      stackId="1"
                      stroke="#10b981" 
                      fill="#10b981" 
                      fillOpacity={0.6}
                      name="Completed"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="created" 
                      stackId="2"
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.6}
                      name="Created"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Second Chart Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Maintenance Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 text-[#52baf3] mr-2" />
                Upcoming Maintenance Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={upcomingMaintenanceData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" />
                    <Tooltip />
                    <Bar 
                      dataKey="critical" 
                      stackId="a" 
                      fill="#ef4444" 
                      name="Critical"
                      onClick={(data) => navigateToWorkOrders('critical')}
                      className="cursor-pointer"
                    />
                    <Bar 
                      dataKey="routine" 
                      stackId="a" 
                      fill="#10b981" 
                      name="Routine"
                      onClick={(data) => navigateToWorkOrders('routine')}
                      className="cursor-pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Archive className="h-5 w-5 text-[#52baf3] mr-2" />
                Inventory Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {inventoryHealthData.map((item, index) => (
                  <div key={index} className="cursor-pointer" onClick={() => navigateToSpares()}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-sm text-gray-500">{item.belowMin}/{item.total}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full relative"
                        style={{ width: `${((item.total - item.belowMin) / item.total) * 100}%` }}
                      >
                        {item.belowMin > 0 && (
                          <div 
                            className="absolute right-0 top-0 bg-red-500 h-2 rounded-r-full"
                            style={{ width: `${(item.belowMin / (item.total - item.belowMin)) * 100}%` }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Smart Lists Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Needs Attention */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                Needs Attention - Overdue Work Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topOverdueWOs.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No overdue work orders</p>
                ) : (
                  topOverdueWOs.map((wo) => (
                    <div 
                      key={wo.id}
                      className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 cursor-pointer transition-colors"
                      onClick={() => navigateToWorkOrders('overdue')}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{wo.title}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{wo.component}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-red-600 dark:text-red-400">Due: {format(new Date(wo.dueDate), 'MMM dd')}</p>
                        <p className="text-xs text-gray-500">
                          {Math.ceil((new Date().getTime() - new Date(wo.dueDate).getTime()) / (1000 * 60 * 60 * 24))} days overdue
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Low Stock Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="h-5 w-5 text-yellow-500 mr-2" />
                Low Stock Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topLowStockItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">All items above minimum stock</p>
                ) : (
                  topLowStockItems.map((item: any) => (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30 cursor-pointer transition-colors"
                      onClick={() => navigateToSpares('low')}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.partName}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{item.partCode}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">
                          {item.rob}/{item.min}
                        </p>
                        <p className="text-xs text-gray-500">{item.location || 'N/A'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Glance Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Running Hours Widget */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation('/pms/running-hrs')}>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 text-[#52baf3] mr-2" />
                Running Hours Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Main Engine</span>
                  <span className="font-medium">12,450 hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Aux Engine #1</span>
                  <span className="font-medium">8,230 hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Emergency Gen</span>
                  <span className="font-medium">456 hrs</span>
                </div>
                <div className="text-xs text-gray-500 mt-4">
                  Last updated: {format(new Date(), 'MMM dd, HH:mm')}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Inventory Activity */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigateToSpares()}>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Store className="h-5 w-5 text-[#52baf3] mr-2" />
                Recent Inventory Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">Oil Filter received</p>
                    <p className="text-xs text-gray-500">SP-001-045</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-600">+5</p>
                    <p className="text-xs text-gray-500">Today</p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">Gasket consumed</p>
                    <p className="text-xs text-gray-500">SP-002-012</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-red-600">-2</p>
                    <p className="text-xs text-gray-500">Yesterday</p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">Bearing received</p>
                    <p className="text-xs text-gray-500">SP-003-089</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-600">+1</p>
                    <p className="text-xs text-gray-500">2 days ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">PMS Database</span>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-sm text-green-600">Online</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Data Sync</span>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-sm text-green-600">Synced</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Backup Status</span>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-sm text-green-600">Current</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-4">
                  All systems operational
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;