import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, startOfQuarter, endOfQuarter, eachDayOfInterval, isWithinInterval } from "date-fns";
import {
  LayoutDashboard,
  RefreshCw,
  Calendar,
  TrendingUp,
  TrendingDown,
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
  Activity,
  FileText,
  Shield,
  AlertCircle,
  Plus,
  Settings,
  Database,
  RefreshCcw,
  HardDrive,
  Anchor,
  Wrench,
  Zap
} from "lucide-react";
import {
  ComposedChart,
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
import { Badge } from "@/components/ui/badge";

// Types for dashboard data
interface WorkOrderMock {
  id: string;
  title: string;
  component: string;
  dueDate: string;
  status: "Pending" | "In Progress" | "Completed" | "Overdue";
  priority: "Critical" | "Routine";
  vesselId: string;
  createdDate: string;
  completedDate?: string;
  department: "Deck" | "Engine" | "Electrical";
  isCritical: boolean;
}

interface DefectMock {
  id: string;
  title: string;
  category: string;
  openedAt: string;
  closedAt?: string;
  vesselId: string;
  severity: "Low" | "Medium" | "High";
}

interface CertificateMock {
  id: string;
  name: string;
  type: string;
  dueDate: string;
  vesselId: string;
  status: "Valid" | "Due Soon" | "Expired";
}

interface DashboardFilters {
  vesselId: string;
  timeRange: string;
  startDate: Date;
  endDate: Date;
  department: string;
  criticalOnly: boolean;
}

const Dashboard: React.FC = () => {
  const [, setLocation] = useLocation();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  // Dashboard filters
  const [filters, setFilters] = useState<DashboardFilters>(() => {
    const saved = localStorage.getItem('dashboard-filters');
    const defaultFilters = {
      vesselId: 'all',
      timeRange: 'mtd',
      startDate: startOfMonth(new Date()),
      endDate: new Date(),
      department: 'all',
      criticalOnly: false
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

  // Departments
  const departments = [
    { id: 'all', name: 'All Departments' },
    { id: 'deck', name: 'Deck' },
    { id: 'engine', name: 'Engine' },
    { id: 'electrical', name: 'Electrical' }
  ];

  // Time ranges
  const timeRanges = [
    { id: 'mtd', label: 'Month to Date' },
    { id: 'last30', label: 'Last 30 days' },
    { id: 'quarter', label: 'Quarter' },
    { id: 'custom', label: 'Custom' }
  ];

  // Mock Work Orders Data
  const mockWorkOrders: WorkOrderMock[] = useMemo(() => [
    {
      id: "WO-2024-001",
      title: "Main Engine Cylinder Head Overhaul",
      component: "6.1.1.1 Cylinder Head",
      dueDate: "2024-01-15",
      status: "Overdue",
      priority: "Critical",
      vesselId: "V001",
      createdDate: "2024-01-01",
      department: "Engine",
      isCritical: true
    },
    {
      id: "WO-2024-002", 
      title: "Fresh Water Pump Inspection",
      component: "1.1.1.2 Feed Pump",
      dueDate: "2024-01-20",
      status: "Pending",
      priority: "Routine",
      vesselId: "V001",
      createdDate: "2024-01-05",
      department: "Engine",
      isCritical: false
    },
    {
      id: "WO-2024-003",
      title: "Steering Gear Oil Change",
      component: "3.1 Steering Gear",
      dueDate: "2024-01-25",
      status: "In Progress", 
      priority: "Routine",
      vesselId: "V002",
      createdDate: "2024-01-10",
      department: "Deck",
      isCritical: false
    },
    {
      id: "WO-2024-004",
      title: "Boiler Safety Valve Test",
      component: "4.1.2 Safety Valve",
      dueDate: "2024-01-12",
      status: "Completed",
      priority: "Critical",
      vesselId: "V001",
      createdDate: "2024-01-01",
      completedDate: "2024-01-11",
      department: "Engine",
      isCritical: true
    },
    {
      id: "WO-2024-005",
      title: "Navigation Lights Check",
      component: "2.1 Navigation System",
      dueDate: "2024-01-18",
      status: "Completed",
      priority: "Critical",
      vesselId: "V001",
      createdDate: "2024-01-05",
      completedDate: "2024-01-17",
      department: "Electrical",
      isCritical: true
    },
    {
      id: "WO-2024-006",
      title: "Emergency Generator Load Test",
      component: "6.3 Emergency Generator",
      dueDate: "2024-01-08",
      status: "Overdue",
      priority: "Critical",
      vesselId: "V002",
      createdDate: "2023-12-25",
      department: "Electrical",
      isCritical: true
    },
    {
      id: "WO-2024-007",
      title: "Fire Pump Maintenance",
      component: "7.1 Fire Pump",
      dueDate: "2024-02-01",
      status: "Pending",
      priority: "Critical",
      vesselId: "V001",
      createdDate: "2024-01-18",
      department: "Deck",
      isCritical: true
    },
    {
      id: "WO-2024-008",
      title: "Auxiliary Engine Service",
      component: "6.2 Auxiliary Engine",
      dueDate: "2024-01-18",
      status: "Completed",
      priority: "Routine",
      vesselId: "V003",
      createdDate: "2024-01-05",
      completedDate: "2024-01-17",
      department: "Engine",
      isCritical: false
    }
  ], []);

  // Mock Defects Data
  const mockDefects: DefectMock[] = useMemo(() => [
    {
      id: "DEF-001",
      title: "Oil leak in engine room",
      category: "Engine",
      openedAt: "2024-01-01",
      closedAt: "2024-01-15",
      vesselId: "V001",
      severity: "High"
    },
    {
      id: "DEF-002",
      title: "Deck crane hydraulic issue",
      category: "Deck Equipment",
      openedAt: "2024-01-10",
      vesselId: "V002",
      severity: "Medium"
    },
    {
      id: "DEF-003",
      title: "Navigation light failure",
      category: "Electrical",
      openedAt: "2024-01-12",
      closedAt: "2024-01-13",
      vesselId: "V001",
      severity: "High"
    }
  ], []);

  // Mock Certificates Data
  const mockCertificates: CertificateMock[] = useMemo(() => [
    {
      id: "CERT-001",
      name: "Safety Management Certificate",
      type: "SMC",
      dueDate: "2024-02-15",
      vesselId: "V001",
      status: "Due Soon"
    },
    {
      id: "CERT-002",
      name: "International Ship Security Certificate",
      type: "ISSC",
      dueDate: "2024-03-20",
      vesselId: "V001",
      status: "Valid"
    },
    {
      id: "CERT-003",
      name: "Loadline Certificate",
      type: "LLC",
      dueDate: "2024-04-10",
      vesselId: "V002",
      status: "Valid"
    }
  ], []);

  // Fetch real data from existing APIs
  const { data: componentsData = [] } = useQuery({
    queryKey: ['/api/components', filters.vesselId === 'all' ? 'V001' : filters.vesselId],
    queryFn: async () => {
      const vesselToFetch = filters.vesselId === 'all' ? 'V001' : filters.vesselId;
      const response = await fetch(`/api/components/${vesselToFetch}`);
      if (!response.ok) throw new Error('Failed to fetch components');
      return response.json();
    }
  });

  const { data: sparesData = [] } = useQuery({
    queryKey: ['/api/spares', filters.vesselId === 'all' ? 'V001' : filters.vesselId],
    queryFn: async () => {
      const vesselToFetch = filters.vesselId === 'all' ? 'V001' : filters.vesselId;
      const response = await fetch(`/api/spares/${vesselToFetch}`);
      if (!response.ok) throw new Error('Failed to fetch spares');
      return response.json();
    }
  });

  const { data: changeRequestsData = [] } = useQuery({
    queryKey: ['/api/change-requests'],
    queryFn: async () => {
      const response = await fetch('/api/change-requests');
      if (!response.ok) throw new Error('Failed to fetch change requests');
      return response.json();
    }
  });

  // Filter data based on current filters
  const filteredWorkOrders = useMemo(() => {
    return mockWorkOrders.filter(wo => {
      if (filters.vesselId !== 'all' && wo.vesselId !== filters.vesselId) {
        return false;
      }
      if (filters.department !== 'all' && wo.department.toLowerCase() !== filters.department) {
        return false;
      }
      if (filters.criticalOnly && !wo.isCritical) {
        return false;
      }
      
      const woDate = new Date(wo.createdDate);
      return woDate >= filters.startDate && woDate <= filters.endDate;
    });
  }, [mockWorkOrders, filters]);

  const filteredDefects = useMemo(() => {
    return mockDefects.filter(defect => {
      if (filters.vesselId !== 'all' && defect.vesselId !== filters.vesselId) {
        return false;
      }
      const defectDate = new Date(defect.openedAt);
      return defectDate >= filters.startDate && defectDate <= filters.endDate;
    });
  }, [mockDefects, filters]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalComponents = componentsData.length;
    const activeWOs = filteredWorkOrders.filter(wo => wo.status === 'Pending' || wo.status === 'In Progress').length;
    const overdueWOs = filteredWorkOrders.filter(wo => wo.status === 'Overdue').length;
    const completedWOs = filteredWorkOrders.filter(wo => wo.status === 'Completed').length;
    
    // Critical PMS Compliance calculation
    const criticalDueThisPeriod = filteredWorkOrders.filter(wo => 
      wo.isCritical && new Date(wo.dueDate) <= filters.endDate
    ).length;
    const criticalCompletedOnTime = filteredWorkOrders.filter(wo => 
      wo.isCritical && 
      wo.status === 'Completed' && 
      wo.completedDate && 
      new Date(wo.completedDate) <= new Date(wo.dueDate)
    ).length;
    const criticalCompliance = criticalDueThisPeriod > 0 
      ? Math.round((criticalCompletedOnTime / criticalDueThisPeriod) * 100)
      : 100;
    
    // Fleet Compliance (all vessels)
    const fleetCompliance = 92; // Mock value, would calculate across all vessels
    
    return {
      totalComponents,
      activeWorkOrders: activeWOs,
      overdueTasks: overdueWOs,
      completedThisPeriod: completedWOs,
      criticalPMSCompliance: criticalCompliance,
      fleetComplianceIndex: fleetCompliance
    };
  }, [filteredWorkOrders, componentsData]);

  // Work order status counts
  const workOrderStatusCounts = useMemo(() => ({
    pending: filteredWorkOrders.filter(wo => wo.status === 'Pending').length,
    inProgress: filteredWorkOrders.filter(wo => wo.status === 'In Progress').length,
    completed: filteredWorkOrders.filter(wo => wo.status === 'Completed').length,
    overdue: filteredWorkOrders.filter(wo => wo.status === 'Overdue').length
  }), [filteredWorkOrders]);

  // Upcoming maintenance counts
  const upcomingMaintenanceCounts = useMemo(() => {
    const now = new Date();
    const next7Days = filteredWorkOrders.filter(wo => {
      const due = new Date(wo.dueDate);
      return due > now && due <= subDays(now, -7);
    }).length;
    const next30Days = filteredWorkOrders.filter(wo => {
      const due = new Date(wo.dueDate);
      return due > now && due <= subDays(now, -30);
    }).length;
    const critical = filteredWorkOrders.filter(wo => wo.isCritical && wo.status !== 'Completed').length;
    const routine = filteredWorkOrders.filter(wo => !wo.isCritical && wo.status !== 'Completed').length;
    
    return { next7Days, next30Days, critical, routine };
  }, [filteredWorkOrders]);

  // Inventory counts
  const inventoryCounts = useMemo(() => {
    const sparesLowStock = sparesData.filter((spare: any) => spare.rob < spare.min).length;
    const storesLowStock = 3; // Mock value
    
    return {
      sparesTotal: sparesData.length,
      sparesLowStock,
      storesTotal: 198,
      storesLowStock
    };
  }, [sparesData]);

  // Certificate counts
  const certificateCounts = useMemo(() => {
    const now = new Date();
    const due30 = mockCertificates.filter(cert => {
      const due = new Date(cert.dueDate);
      return due > now && due <= subDays(now, -30);
    }).length;
    const due60 = mockCertificates.filter(cert => {
      const due = new Date(cert.dueDate);
      return due > now && due <= subDays(now, -60);
    }).length;
    const due90 = mockCertificates.filter(cert => {
      const due = new Date(cert.dueDate);
      return due > now && due <= subDays(now, -90);
    }).length;
    
    return { due30, due60, due90 };
  }, [mockCertificates]);

  // Change request counts
  const changeRequestCounts = useMemo(() => {
    const pending = changeRequestsData.filter((cr: any) => cr.status === 'submitted').length;
    const approved = changeRequestsData.filter((cr: any) => cr.status === 'approved').length;
    const rejected = changeRequestsData.filter((cr: any) => cr.status === 'rejected').length;
    
    return { pending, approved, rejected };
  }, [changeRequestsData]);

  // Generate heatmap data
  const heatmapData = useMemo(() => {
    const days = eachDayOfInterval({ start: filters.startDate, end: filters.endDate });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const count = filteredWorkOrders.filter(wo => 
        format(new Date(wo.dueDate), 'yyyy-MM-dd') === dayStr
      ).length;
      return {
        date: day,
        count,
        intensity: count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : 3
      };
    });
  }, [filteredWorkOrders, filters]);

  // Defects trend data
  const defectsTrendData = useMemo(() => {
    const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
    return months.map(month => ({
      month,
      opened: Math.floor(Math.random() * 15) + 5,
      closedRate: Math.floor(Math.random() * 30) + 60
    }));
  }, []);

  // Update filters
  const updateFilters = (newFilters: Partial<DashboardFilters>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    localStorage.setItem('dashboard-filters', JSON.stringify(updated));
  };

  // Handle time range change
  const handleTimeRangeChange = (rangeId: string) => {
    let startDate: Date, endDate: Date;

    switch (rangeId) {
      case 'mtd':
        startDate = startOfMonth(new Date());
        endDate = new Date();
        break;
      case 'last30':
        endDate = new Date();
        startDate = subDays(endDate, 30);
        break;
      case 'quarter':
        startDate = startOfQuarter(new Date());
        endDate = endOfQuarter(new Date());
        break;
      default:
        return;
    }

    updateFilters({ 
      timeRange: rangeId,
      startDate,
      endDate
    });
  };

  // Refresh data
  const handleRefresh = () => {
    setLastUpdated(new Date());
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

  const navigateToStores = (filter?: string) => {
    const params = new URLSearchParams();
    if (filters.vesselId !== 'all') params.set('vessel', filters.vesselId);
    if (filter) params.set('stock', filter);
    setLocation(`/stores?${params.toString()}`);
  };

  const navigateToChangeRequests = (filter?: string) => {
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    setLocation(`/pms/modify?${params.toString()}`);
  };

  const navigateToRunningHours = () => {
    setLocation('/pms/running-hrs');
  };

  const navigateToReports = () => {
    setLocation('/pms/reports');
  };

  const navigateToComponents = () => {
    setLocation('/pms/components');
  };

  // KPI Card Component
  const KPICard = ({ 
    title, 
    value, 
    change,
    changeType,
    onClick,
    badge,
    subtitle
  }: {
    title: string;
    value: number | string;
    change?: string;
    changeType?: 'positive' | 'negative' | 'neutral';
    onClick?: () => void;
    badge?: { color: string; text: string };
    subtitle?: string;
  }) => (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <p className="text-xs font-medium text-gray-600 mb-1">{title}</p>
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-bold text-gray-900">
            {typeof value === 'number' ? value : `${value}%`}
          </p>
          {badge && (
            <Badge className={`${badge.color} text-white`}>
              {badge.text}
            </Badge>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        )}
        {change && (
          <p className={`text-xs flex items-center mt-2 ${
            changeType === 'positive' ? 'text-green-600' : 
            changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
          }`}>
            {changeType === 'positive' ? <TrendingUp className="h-3 w-3 mr-1" /> : 
             changeType === 'negative' ? <TrendingDown className="h-3 w-3 mr-1" /> : null}
            {change}
          </p>
        )}
      </CardContent>
    </Card>
  );

  // Get compliance badge
  const getComplianceBadge = (percentage: number) => {
    if (percentage >= 95) {
      return { color: 'bg-green-500', text: `${percentage}%` };
    } else if (percentage >= 90) {
      return { color: 'bg-yellow-500', text: `${percentage}%` };
    } else {
      return { color: 'bg-red-500', text: `${percentage}%` };
    }
  };

  // Get IHM status
  const getIHMStatus = () => {
    const percentage = 87; // Mock value
    if (percentage >= 95) return { text: 'Compliant', color: 'bg-green-500' };
    if (percentage >= 80) return { text: 'Attention', color: 'bg-yellow-500' };
    return { text: 'Unknown', color: 'bg-gray-500' };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Global Controls */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <LayoutDashboard className="h-6 w-6 text-[#52baf3] mr-2" />
              <h1 className="text-2xl font-bold text-gray-900">PMS Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="text-xs text-gray-500">
                Last updated: {format(lastUpdated, 'HH:mm')}
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Global Filters */}
          <div className="flex flex-wrap items-center gap-4">
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

            <Select value={filters.timeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                {timeRanges.map(range => (
                  <SelectItem key={range.id} value={range.id}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.department} onValueChange={(value) => updateFilters({ department: value })}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={filters.criticalOnly ? "default" : "outline"}
              size="sm"
              onClick={() => updateFilters({ criticalOnly: !filters.criticalOnly })}
            >
              Critical Only
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Header Tiles - 6 cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard
            title="Total Components"
            value={kpis.totalComponents}
            change="+12 vs last period"
            changeType="positive"
            onClick={navigateToComponents}
          />
          
          <KPICard
            title="Active Work Orders"
            value={kpis.activeWorkOrders}
            onClick={() => navigateToWorkOrders('active')}
          />
          
          <KPICard
            title="Overdue Tasks"
            value={kpis.overdueTasks}
            change="+2 this week"
            changeType="negative"
            onClick={() => navigateToWorkOrders('overdue')}
          />
          
          <KPICard
            title="Completed This Period"
            value={kpis.completedThisPeriod}
            change="+15% vs last period"
            changeType="positive"
            onClick={() => navigateToWorkOrders('completed')}
          />
          
          <KPICard
            title="Critical PMS Compliance"
            value={`${kpis.criticalPMSCompliance}`}
            badge={getComplianceBadge(kpis.criticalPMSCompliance)}
            onClick={() => navigateToWorkOrders('critical')}
          />
          
          <KPICard
            title="Fleet Compliance Index"
            value={`${kpis.fleetComplianceIndex}`}
            badge={getComplianceBadge(kpis.fleetComplianceIndex)}
            subtitle="All vessels"
            onClick={() => navigateToWorkOrders()}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Work Orders Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Work Orders Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div 
                  className="flex items-center justify-between p-2 bg-yellow-50 rounded cursor-pointer hover:bg-yellow-100"
                  onClick={() => navigateToWorkOrders('pending')}
                >
                  <span className="text-sm">Pending</span>
                  <span className="font-medium">{workOrderStatusCounts.pending}</span>
                </div>
                <div 
                  className="flex items-center justify-between p-2 bg-blue-50 rounded cursor-pointer hover:bg-blue-100"
                  onClick={() => navigateToWorkOrders('in-progress')}
                >
                  <span className="text-sm">In Progress</span>
                  <span className="font-medium">{workOrderStatusCounts.inProgress}</span>
                </div>
                <div 
                  className="flex items-center justify-between p-2 bg-green-50 rounded cursor-pointer hover:bg-green-100"
                  onClick={() => navigateToWorkOrders('completed')}
                >
                  <span className="text-sm">Completed</span>
                  <span className="font-medium">{workOrderStatusCounts.completed}</span>
                </div>
                <div 
                  className="flex items-center justify-between p-2 bg-red-50 rounded cursor-pointer hover:bg-red-100"
                  onClick={() => navigateToWorkOrders('overdue')}
                >
                  <span className="text-sm">Overdue</span>
                  <span className="font-medium text-red-600">{workOrderStatusCounts.overdue}</span>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Maintenance */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Upcoming Maintenance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div 
                  className="flex items-center justify-between cursor-pointer hover:text-[#52baf3]"
                  onClick={() => navigateToWorkOrders()}
                >
                  <span className="text-sm">Next 7 days</span>
                  <span className="font-medium">{upcomingMaintenanceCounts.next7Days}</span>
                </div>
                <div 
                  className="flex items-center justify-between cursor-pointer hover:text-[#52baf3]"
                  onClick={() => navigateToWorkOrders()}
                >
                  <span className="text-sm">Next 30 days</span>
                  <span className="font-medium">{upcomingMaintenanceCounts.next30Days}</span>
                </div>
                <div 
                  className="flex items-center justify-between cursor-pointer hover:text-[#52baf3]"
                  onClick={() => navigateToWorkOrders('critical')}
                >
                  <span className="text-sm text-red-600">Critical</span>
                  <span className="font-medium text-red-600">{upcomingMaintenanceCounts.critical}</span>
                </div>
                <div 
                  className="flex items-center justify-between cursor-pointer hover:text-[#52baf3]"
                  onClick={() => navigateToWorkOrders('routine')}
                >
                  <span className="text-sm">Routine</span>
                  <span className="font-medium">{upcomingMaintenanceCounts.routine}</span>
                </div>
              </CardContent>
            </Card>

            {/* Inventory Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Inventory Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    className="p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                    onClick={() => navigateToSpares()}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Package className="h-4 w-4 text-[#52baf3]" />
                      <span className="text-lg font-bold">{inventoryCounts.sparesTotal}</span>
                    </div>
                    <p className="text-xs font-medium">Spares</p>
                    {inventoryCounts.sparesLowStock > 0 && (
                      <p className="text-xs text-red-600 mt-1">{inventoryCounts.sparesLowStock} Low Stock</p>
                    )}
                  </div>
                  <div 
                    className="p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                    onClick={() => navigateToStores()}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Store className="h-4 w-4 text-[#52baf3]" />
                      <span className="text-lg font-bold">{inventoryCounts.storesTotal}</span>
                    </div>
                    <p className="text-xs font-medium">Stores</p>
                    {inventoryCounts.storesLowStock > 0 && (
                      <p className="text-xs text-red-600 mt-1">{inventoryCounts.storesLowStock} Low Stock</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column */}
          <div className="space-y-6">
            {/* Certificates & Compliance */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Certificates & Compliance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-600 mb-2">Certificates Due</p>
                  <div className="flex space-x-4">
                    <div className="text-center">
                      <p className="text-lg font-bold">{certificateCounts.due30}</p>
                      <p className="text-xs text-gray-500">30 days</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold">{certificateCounts.due60}</p>
                      <p className="text-xs text-gray-500">60 days</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold">{certificateCounts.due90}</p>
                      <p className="text-xs text-gray-500">90 days</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">IHM Status</span>
                  <Badge className={`${getIHMStatus().color} text-white`}>
                    {getIHMStatus().text}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">LSA/FFA Test</span>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-xs">Due Feb 15</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Change Requests */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Change Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div 
                  className="flex items-center justify-between cursor-pointer hover:text-[#52baf3]"
                  onClick={() => navigateToChangeRequests('pending')}
                >
                  <span className="text-sm">Pending Approval</span>
                  <span className="font-medium text-yellow-600">{changeRequestCounts.pending}</span>
                </div>
                <div 
                  className="flex items-center justify-between cursor-pointer hover:text-[#52baf3]"
                  onClick={() => navigateToChangeRequests('approved')}
                >
                  <span className="text-sm">Approved this period</span>
                  <span className="font-medium text-green-600">{changeRequestCounts.approved}</span>
                </div>
                <div 
                  className="flex items-center justify-between cursor-pointer hover:text-[#52baf3]"
                  onClick={() => navigateToChangeRequests('rejected')}
                >
                  <span className="text-sm">Rejected this period</span>
                  <span className="font-medium text-red-600">{changeRequestCounts.rejected}</span>
                </div>
                
                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-600 mb-2">Postponed PMS Jobs: 8</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">Spares</Badge>
                    <Badge variant="outline" className="text-xs">Voyage</Badge>
                    <Badge variant="outline" className="text-xs">Manpower</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={() => setLocation('/pms/work-orders?action=new')}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create WO
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={navigateToRunningHours}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Update RH
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={navigateToComponents}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Component
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={navigateToReports}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Maintenance Heatmap */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Maintenance Calendar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 mb-2">
                  <Badge variant="outline" className="text-xs cursor-pointer">All</Badge>
                  <Badge variant="outline" className="text-xs cursor-pointer">Critical Only</Badge>
                  <Badge variant="outline" className="text-xs cursor-pointer">Deck</Badge>
                  <Badge variant="outline" className="text-xs cursor-pointer">Engine</Badge>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <div key={i} className="text-xs text-center text-gray-500 p-1">
                      {day}
                    </div>
                  ))}
                  {heatmapData.slice(0, 28).map((day, i) => (
                    <div
                      key={i}
                      className={`p-2 text-xs text-center rounded cursor-pointer hover:opacity-80 ${
                        day.intensity === 0 ? 'bg-gray-100' :
                        day.intensity === 1 ? 'bg-blue-100' :
                        day.intensity === 2 ? 'bg-blue-300' : 'bg-blue-500 text-white'
                      }`}
                      title={`${format(day.date, 'MMM dd')}: ${day.count} tasks`}
                      onClick={() => navigateToWorkOrders()}
                    >
                      {format(day.date, 'd')}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Defects Trend */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Recurring Issues Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={defectsTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="opened" fill="#ef4444" />
                      <Line type="monotone" dataKey="closedRate" stroke="#10b981" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium">Top Categories</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Engine</span>
                      <span>15</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Electrical</span>
                      <span>8</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Deck Equipment</span>
                      <span>5</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Database className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm">Database</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                    <span className="text-xs text-green-600">Online</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <HardDrive className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm">Backup</span>
                  </div>
                  <span className="text-xs text-gray-500">2 hrs ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <RefreshCcw className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm">Sync Status</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                    <span className="text-xs text-green-600">Synced</span>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-500">Last Update: 2 min ago</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;