import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, differenceInDays } from "date-fns";
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
  Activity,
  Settings,
  Anchor,
  Shield,
  FileText,
  AlertCircle,
  Wrench,
  Navigation,
  Radio,
  ShieldCheck,
  HelpCircle,
  ClipboardCheck,
  FileCheck
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
  LineChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Types for dashboard data - import from shared schema
import { WorkOrder } from "@shared/schema";

interface Certificate {
  id: string;
  name: string;
  expiryDate: string;
  daysRemaining: number;
  status: "valid" | "expiring" | "expired";
  category: "class" | "flag" | "safety" | "pollution";
}

interface DefectReport {
  id: string;
  equipment: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  reportedDate: string;
  status: "open" | "in_progress" | "resolved";
  department: "engine" | "deck";
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
  const [activeTab, setActiveTab] = useState("overview");

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

  // Mock Certificates Data
  const mockCertificates: Certificate[] = useMemo(() => [
    { id: "CERT-001", name: "Annual Class Survey", expiryDate: "2024-02-15", daysRemaining: 25, status: "expiring", category: "class" },
    { id: "CERT-002", name: "IOPP Certificate", expiryDate: "2024-06-30", daysRemaining: 160, status: "valid", category: "pollution" },
    { id: "CERT-003", name: "Safety Management Certificate", expiryDate: "2024-01-10", daysRemaining: -10, status: "expired", category: "safety" },
    { id: "CERT-004", name: "Load Line Certificate", expiryDate: "2024-08-20", daysRemaining: 210, status: "valid", category: "flag" },
    { id: "CERT-005", name: "Fire Safety Certificate", expiryDate: "2024-01-25", daysRemaining: 5, status: "expiring", category: "safety" }
  ], []);

  // Mock Defect Reports
  const mockDefects: DefectReport[] = useMemo(() => [
    { id: "DEF-001", equipment: "Main Engine Turbocharger", description: "Abnormal vibration at high RPM", severity: "high", reportedDate: "2024-01-18", status: "open", department: "engine" },
    { id: "DEF-002", equipment: "Deck Crane #2", description: "Hydraulic leak in slewing motor", severity: "medium", reportedDate: "2024-01-17", status: "in_progress", department: "deck" },
    { id: "DEF-003", equipment: "Emergency Generator", description: "Starting battery voltage low", severity: "critical", reportedDate: "2024-01-19", status: "open", department: "engine" },
    { id: "DEF-004", equipment: "Fire Pump", description: "Pressure gauge malfunction", severity: "low", reportedDate: "2024-01-16", status: "resolved", department: "deck" },
    { id: "DEF-005", equipment: "Navigation Radar", description: "Intermittent display issues", severity: "medium", reportedDate: "2024-01-18", status: "in_progress", department: "deck" }
  ], []);

  // Fetch real work orders data
  const { data: workOrdersData = [], isLoading: isWorkOrdersLoading, error: workOrdersError } = useQuery({
    queryKey: ['/api/work-orders', filters.vesselId === 'all' ? 'V001' : filters.vesselId],
    queryFn: async () => {
      const vesselToFetch = filters.vesselId === 'all' ? 'V001' : filters.vesselId;
      const response = await fetch(`/api/work-orders?vesselId=${vesselToFetch}`);
      if (!response.ok) throw new Error('Failed to fetch work orders');
      return await response.json() as WorkOrder[];
    }
  });

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
    if (!workOrdersData || workOrdersData.length === 0) return [];
    
    return workOrdersData.filter(wo => {
      // Filter by vessel (if not 'all')
      if (filters.vesselId !== 'all' && wo.vesselId !== filters.vesselId) {
        return false;
      }
      
      // Filter by date range (using createdAt timestamp)
      const woDate = new Date(wo.createdAt);
      return woDate >= filters.startDate && woDate <= filters.endDate;
    });
  }, [workOrdersData, filters]);

  // Helper function to determine department from component
  const getDepartment = (componentCode: string): 'engine' | 'deck' => {
    if (!componentCode) return 'engine';
    const code = componentCode.toLowerCase();
    // Engine department indicators
    if (code.includes('engine') || code.includes('6.') || code.includes('boiler') || code.includes('generator')) {
      return 'engine';
    }
    // Deck department by default
    return 'deck';
  };

  // Calculate Department-specific KPIs
  const departmentKPIs = useMemo(() => {
    const engineWOs = filteredWorkOrders.filter(wo => getDepartment(wo.componentCode || '') === 'engine');
    const deckWOs = filteredWorkOrders.filter(wo => getDepartment(wo.componentCode || '') === 'deck');
    
    return {
      engine: {
        total: engineWOs.length,
        overdue: engineWOs.filter(wo => wo.status === 'Overdue').length,
        completed: engineWOs.filter(wo => wo.status === 'Completed').length,
        pending: engineWOs.filter(wo => wo.status === 'Due').length
      },
      deck: {
        total: deckWOs.length,
        overdue: deckWOs.filter(wo => wo.status === 'Overdue').length,
        completed: deckWOs.filter(wo => wo.status === 'Completed').length,
        pending: deckWOs.filter(wo => wo.status === 'Due').length
      }
    };
  }, [filteredWorkOrders]);

  // Helper function to determine equipment category from component
  const getEquipmentCategory = (componentCode: string): string => {
    if (!componentCode) return 'Other equipment';
    const code = componentCode.toLowerCase();
    
    if (code.includes('engine') || code.includes('6.') || code.includes('turbo') || code.includes('pump') && code.includes('fuel')) {
      return 'Engine machinery';
    }
    if (code.includes('crane') || code.includes('winch') || code.includes('deck') || code.includes('steering')) {
      return 'Deck machinery';
    }
    if (code.includes('safety') || code.includes('fire') || code.includes('lsa') || code.includes('lifeboat') || code.includes('valve')) {
      return 'Safety Equipment';
    }
    if (code.includes('nav') || code.includes('gps') || code.includes('radar') || code.includes('radio') || code.includes('gyro')) {
      return 'Navigation & Radio';
    }
    if (code.includes('cargo') || code.includes('hatch') || code.includes('hold')) {
      return 'Cargo handling';
    }
    if (code.includes('hull') || code.includes('tank') || code.includes('ballast')) {
      return 'Hull structure';
    }
    return 'Other equipment';
  };

  // Equipment Category Breakdown
  const equipmentCategoryData = useMemo(() => {
    const categories = [
      'Engine machinery',
      'Deck machinery', 
      'Safety Equipment',
      'Navigation & Radio',
      'Cargo handling',
      'Hull structure',
      'Other equipment'
    ];
    
    return categories.map(cat => ({
      category: cat,
      total: filteredWorkOrders.filter(wo => getEquipmentCategory(wo.componentCode || '') === cat).length,
      overdue: filteredWorkOrders.filter(wo => getEquipmentCategory(wo.componentCode || '') === cat && wo.status === 'Overdue').length,
      pending: filteredWorkOrders.filter(wo => getEquipmentCategory(wo.componentCode || '') === cat && wo.status === 'Due').length
    })).filter(cat => cat.total > 0); // Only show categories with data
  }, [filteredWorkOrders]);

  // Helper function to check if work order is overdue (only status "Overdue")
  const isOverdue = (workOrder: WorkOrder): boolean => {
    return workOrder.status === 'Overdue';
  };

  // Helper function to check if work order is due soon
  const isDueSoon = (workOrder: WorkOrder): boolean => {
    return workOrder.status === 'Due' || workOrder.status === 'Due (Grace P)';
  };

  // Helper function to check if work order is completed
  const isCompleted = (workOrder: WorkOrder): boolean => {
    return workOrder.status === 'Completed' || workOrder.status === 'Approved';
  };

  // Calculate Enhanced KPIs using real work orders data
  const kpis = useMemo(() => {
    if (isWorkOrdersLoading || !filteredWorkOrders) {
      return {
        activeWorkOrders: 0,
        overdueTasks: 0,
        completedThisPeriod: 0,
        criticalStockAlerts: 0,
        expiringCertificates: 0,
        openDefects: 0,
        highRiskTasks: 0,
        criticalDefects: 0
      };
    }

    // Work order calculations using real data
    const activeWOs = filteredWorkOrders.filter(wo => !isCompleted(wo)).length;
    const overdueWOs = filteredWorkOrders.filter(wo => isOverdue(wo)).length;
    const completedWOs = filteredWorkOrders.filter(wo => isCompleted(wo)).length;
    const dueSoonWOs = filteredWorkOrders.filter(wo => isDueSoon(wo)).length;
    
    // Calculate low stock items
    const lowStockItems = sparesData.filter((spare: any) => spare.rob < spare.min).length;
    
    // Certificate metrics
    const expiringCerts = mockCertificates.filter(cert => cert.status === 'expiring').length;
    const expiredCerts = mockCertificates.filter(cert => cert.status === 'expired').length;
    
    // Defect metrics
    const openDefects = mockDefects.filter(def => def.status === 'open').length;
    const criticalDefects = mockDefects.filter(def => def.severity === 'critical' || def.severity === 'high').length;
    
    return {
      activeWorkOrders: activeWOs,
      overdueTasks: overdueWOs, // Only counts status "Overdue"
      completedThisPeriod: completedWOs,
      dueSoon: dueSoonWOs, // New KPI for due soon
      criticalStockAlerts: lowStockItems,
      expiringCertificates: expiringCerts + expiredCerts,
      openDefects: openDefects,
      highRiskTasks: 0, // Will need to implement risk calculation based on real data
      criticalDefects: criticalDefects
    };
  }, [filteredWorkOrders, sparesData, mockCertificates, mockDefects, isWorkOrdersLoading]);

  // Generate sparkline data
  const generateSparklineData = (type: string) => {
    const points = [];
    for (let i = 11; i >= 0; i--) {
      const date = subDays(new Date(), i);
      let value = 0;
      
      switch (type) {
        case 'active':
          value = Math.floor(Math.random() * 10) + 15;
          break;
        case 'overdue':
          value = Math.floor(Math.random() * 5) + 3;
          break;
        case 'completed':
          value = Math.floor(Math.random() * 8) + 5;
          break;
        case 'critical':
          value = Math.floor(Math.random() * 6) + 8;
          break;
        case 'defects':
          value = Math.floor(Math.random() * 4) + 2;
          break;
        case 'certificates':
          value = Math.floor(Math.random() * 3) + 1;
          break;
      }
      
      points.push({ date: format(date, 'MM/dd'), value });
    }
    return points;
  };

  // Risk Assessment Radar Data
  const riskRadarData = [
    { category: 'Main Engine', engineRisk: 75, deckRisk: 0, fullMark: 100 },
    { category: 'Safety Systems', engineRisk: 60, deckRisk: 85, fullMark: 100 },
    { category: 'Navigation', engineRisk: 20, deckRisk: 70, fullMark: 100 },
    { category: 'Cargo Equipment', engineRisk: 30, deckRisk: 65, fullMark: 100 },
    { category: 'Hull & Structure', engineRisk: 25, deckRisk: 80, fullMark: 100 },
    { category: 'Pollution Control', engineRisk: 55, deckRisk: 45, fullMark: 100 }
  ];

  // Chart data
  // Work Orders Status Distribution for charts (using real API statuses)
  const workOrderStatusData = useMemo(() => [
    { name: 'Due', value: filteredWorkOrders.filter(wo => wo.status === 'Due').length, color: '#fbbf24' },
    { name: 'Due (Grace P)', value: filteredWorkOrders.filter(wo => wo.status === 'Due (Grace P)').length, color: '#f59e0b' },
    { name: 'Completed', value: filteredWorkOrders.filter(wo => isCompleted(wo)).length, color: '#10b981' },
    { name: 'Overdue', value: filteredWorkOrders.filter(wo => isOverdue(wo)).length, color: '#ef4444' },
    { name: 'Pending Approval', value: filteredWorkOrders.filter(wo => wo.status === 'Pending Approval').length, color: '#8b5cf6' },
    { name: 'Postponed', value: filteredWorkOrders.filter(wo => wo.status === 'Postponed').length, color: '#6b7280' }
  ].filter(item => item.value > 0), [filteredWorkOrders]); // Only show categories with data

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

  // Upcoming Maintenance Data (based on real work orders due dates)
  const upcomingMaintenanceData = useMemo(() => {
    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const dueIn7d = filteredWorkOrders.filter(wo => {
      const dueDate = new Date(wo.dueDate);
      return dueDate >= now && dueDate <= next7Days && !isCompleted(wo);
    }).length;
    
    const due8to30d = filteredWorkOrders.filter(wo => {
      const dueDate = new Date(wo.dueDate);
      return dueDate > next7Days && dueDate <= next30Days && !isCompleted(wo);
    }).length;
    
    const dueAfter30d = filteredWorkOrders.filter(wo => {
      const dueDate = new Date(wo.dueDate);
      return dueDate > next30Days && !isCompleted(wo);
    }).length;
    
    return [
      { name: 'Due in 7d', critical: Math.floor(dueIn7d * 0.3), routine: Math.ceil(dueIn7d * 0.7), total: dueIn7d },
      { name: '8-30d', critical: Math.floor(due8to30d * 0.2), routine: Math.ceil(due8to30d * 0.8), total: due8to30d },
      { name: '>30d', critical: Math.floor(dueAfter30d * 0.1), routine: Math.ceil(dueAfter30d * 0.9), total: dueAfter30d }
    ];
  }, [filteredWorkOrders]);

  const inventoryHealthData = [
    { name: 'Spares', total: sparesData.length, belowMin: sparesData.filter((s: any) => s.rob < s.min).length },
    { name: 'Stores', total: 198, belowMin: 5 },
    { name: 'Lubes', total: 45, belowMin: 2 },
    { name: 'Chemicals', total: 32, belowMin: 1 }
  ];

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

  // KPI Card Component
  const KPICard = ({ 
    title, 
    value, 
    icon: Icon, 
    color, 
    change, 
    changeType, 
    sparklineData,
    onClick,
    subtitle
  }: {
    title: string;
    value: number | string;
    icon: React.ElementType;
    color: string;
    change?: string;
    changeType?: 'positive' | 'negative' | 'neutral';
    sparklineData?: any[];
    onClick: () => void;
    subtitle?: string;
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
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
            {change && (
              <p className={`text-sm flex items-center mt-1 ${
                changeType === 'positive' ? 'text-green-600' : 
                changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
              }`}>
                <TrendingUp className="h-3 w-3 mr-1" />
                {change}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
        
        {sparklineData && (
          <div className="h-12">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={color.includes('blue') ? '#3b82f6' : 
                          color.includes('red') ? '#ef4444' :
                          color.includes('green') ? '#10b981' : 
                          color.includes('yellow') ? '#f59e0b' : '#6b7280'}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400">Electronic Planned Maintenance System Control Center</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              E-PMS Active
            </Badge>
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
      <div className="p-6">
        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="equipment">Equipment</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            {/* Enhanced KPI Row */}
            {isWorkOrdersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-8 bg-gray-200 rounded mb-4"></div>
                      <div className="h-12 bg-gray-200 rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : workOrdersError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-red-700">Failed to load work orders data: {workOrdersError.message}</span>
                </div>
              </div>
            ) : (
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
                subtitle="Immediate attention required"
              />
              
              <KPICard
                title="Certificates Status"
                value={`${kpis.expiringCertificates}`}
                icon={FileCheck}
                color="bg-yellow-50 text-yellow-600 border-yellow-200"
                change={kpis.expiringCertificates > 0 ? "Action needed" : "All valid"}
                changeType={kpis.expiringCertificates > 0 ? "negative" : "positive"}
                sparklineData={generateSparklineData('certificates')}
                onClick={() => setActiveTab('compliance')}
                subtitle="Expiring/Expired"
              />
              
              <KPICard
                title="Open Defects"
                value={kpis.openDefects}
                icon={AlertCircle}
                color="bg-orange-50 text-orange-600 border-orange-200"
                change={`${kpis.criticalDefects} critical`}
                changeType={kpis.criticalDefects > 0 ? "negative" : "neutral"}
                sparklineData={generateSparklineData('defects')}
                onClick={() => setLocation('/defects')}
                subtitle="Total reported issues"
              />
            </div>
            )}

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
                    Maintenance Trend
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

            {/* Defect Reports & Critical Spares */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Defect Reports */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-orange-500 mr-2" />
                    Active Defect Reports
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockDefects.filter(d => d.status !== 'resolved').slice(0, 5).map((defect) => (
                      <div 
                        key={defect.id}
                        className={`flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                          defect.severity === 'critical' ? 'bg-red-50 dark:bg-red-900/20' :
                          defect.severity === 'high' ? 'bg-orange-50 dark:bg-orange-900/20' :
                          'bg-gray-50 dark:bg-gray-800'
                        }`}
                        onClick={() => setLocation('/defects')}
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{defect.equipment}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{defect.description}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={defect.severity === 'critical' ? 'destructive' : 
                                        defect.severity === 'high' ? 'secondary' : 'outline'}>
                            {defect.severity}
                          </Badge>
                          <p className="text-xs text-gray-500 mt-1">
                            {defect.department === 'engine' ? 'Engine' : 'Deck'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Low Stock Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Package className="h-5 w-5 text-yellow-500 mr-2" />
                    Critical Stock Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sparesData
                      .filter((spare: any) => spare.rob < spare.min)
                      .sort((a: any, b: any) => (a.rob / a.min) - (b.rob / b.min))
                      .slice(0, 5)
                      .map((item: any) => (
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
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="departments" className="space-y-8">
            {/* Department Overview Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Engine Department */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Settings className="h-5 w-5 text-blue-500 mr-2" />
                    Engine Department Maintenance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                        <p className="text-2xl font-bold text-blue-600">{departmentKPIs.engine.total}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Total Tasks</p>
                      </div>
                      <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded">
                        <p className="text-2xl font-bold text-red-600">{departmentKPIs.engine.overdue}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Overdue</p>
                      </div>
                    </div>
                    
                    <Progress value={(departmentKPIs.engine.completed / departmentKPIs.engine.total) * 100} className="h-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Completion Rate: {Math.round((departmentKPIs.engine.completed / departmentKPIs.engine.total) * 100)}%
                    </p>
                    
                    <div className="pt-2">
                      <p className="text-sm font-medium mb-2">Key Systems:</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Main Engine</span>
                          <Badge variant="outline" className="text-xs">3 tasks</Badge>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Auxiliary Engines</span>
                          <Badge variant="outline" className="text-xs">2 tasks</Badge>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Boilers & Heaters</span>
                          <Badge variant="outline" className="text-xs">1 task</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Deck Department */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Anchor className="h-5 w-5 text-green-500 mr-2" />
                    Deck Department Maintenance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                        <p className="text-2xl font-bold text-green-600">{departmentKPIs.deck.total}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Total Tasks</p>
                      </div>
                      <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded">
                        <p className="text-2xl font-bold text-red-600">{departmentKPIs.deck.overdue}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Overdue</p>
                      </div>
                    </div>
                    
                    <Progress value={(departmentKPIs.deck.completed / departmentKPIs.deck.total) * 100} className="h-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Completion Rate: {Math.round((departmentKPIs.deck.completed / departmentKPIs.deck.total) * 100)}%
                    </p>
                    
                    <div className="pt-2">
                      <p className="text-sm font-medium mb-2">Key Systems:</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Life Saving Appliances</span>
                          <Badge variant="outline" className="text-xs">2 tasks</Badge>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Fire Fighting Equipment</span>
                          <Badge variant="outline" className="text-xs">1 task</Badge>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Navigation Equipment</span>
                          <Badge variant="outline" className="text-xs">1 task</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Risk Assessment Radar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 text-[#52baf3] mr-2" />
                  Department Risk Assessment Matrix
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={riskRadarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="category" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      <Radar name="Engine Dept" dataKey="engineRisk" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                      <Radar name="Deck Dept" dataKey="deckRisk" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipment" className="space-y-8">
            {/* Equipment Categories Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {equipmentCategoryData.map((category, index) => {
                const icons = {
                  "Engine machinery": Settings,
                  "Deck machinery": Anchor,
                  "Safety Equipment": ShieldCheck,
                  "Navigation & Radio": Navigation,
                  "Cargo handling": Package,
                  "Hull structure": Ship,
                  "Electronic equipment": Radio
                };
                const Icon = icons[category.category as keyof typeof icons] || HelpCircle;
                
                return (
                  <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center">
                        <Icon className="h-4 w-4 text-[#52baf3] mr-2" />
                        {category.category}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-600">Total Tasks</span>
                          <Badge variant="outline">{category.total}</Badge>
                        </div>
                        {category.overdue > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Overdue</span>
                            <Badge variant="destructive">{category.overdue}</Badge>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-600">Pending</span>
                          <Badge variant="secondary">{category.pending}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Upcoming Maintenance Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 text-[#52baf3] mr-2" />
                  Equipment Maintenance Schedule
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
                        onClick={() => navigateToWorkOrders('critical')}
                        className="cursor-pointer"
                      />
                      <Bar 
                        dataKey="routine" 
                        stackId="a" 
                        fill="#10b981" 
                        name="Routine"
                        onClick={() => navigateToWorkOrders('routine')}
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
                  Spare Parts Inventory Health
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
          </TabsContent>

          <TabsContent value="compliance" className="space-y-8">
            {/* Certificate Status Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Valid Certificates</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-600">
                    {mockCertificates.filter(c => c.status === 'valid').length}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">All documentation current</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Expiring Soon</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-yellow-600">
                    {mockCertificates.filter(c => c.status === 'expiring').length}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Within 30 days</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Expired</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-red-600">
                    {mockCertificates.filter(c => c.status === 'expired').length}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Immediate action required</p>
                </CardContent>
              </Card>
            </div>

            {/* Certificate Details List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 text-[#52baf3] mr-2" />
                  Certificate & Survey Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockCertificates.map((cert) => (
                    <div 
                      key={cert.id}
                      className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${
                        cert.status === 'expired' ? 'bg-red-50 dark:bg-red-900/20 border-red-200' :
                        cert.status === 'expiring' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200' :
                        'bg-green-50 dark:bg-green-900/20 border-green-200'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{cert.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Category: {cert.category.charAt(0).toUpperCase() + cert.category.slice(1)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={
                          cert.status === 'expired' ? 'destructive' :
                          cert.status === 'expiring' ? 'secondary' : 'default'
                        }>
                          {cert.status === 'expired' ? 'Expired' :
                           cert.status === 'expiring' ? `${cert.daysRemaining} days` :
                           'Valid'}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          Expires: {format(new Date(cert.expiryDate), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Class & Flag Requirements */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="h-5 w-5 text-blue-500 mr-2" />
                    Classification Society Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Annual Survey</span>
                      <Badge variant="secondary">Due in 25 days</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Intermediate Survey</span>
                      <Badge variant="default">Completed</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Special Survey</span>
                      <Badge variant="outline">2025</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Drydocking</span>
                      <Badge variant="outline">2025</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <ClipboardCheck className="h-5 w-5 text-green-500 mr-2" />
                    Regulatory Compliance Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">ISM Compliance</span>
                      <Badge variant="default">Compliant</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">ISPS Compliance</span>
                      <Badge variant="default">Compliant</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">MLC Compliance</span>
                      <Badge variant="default">Compliant</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">MARPOL Compliance</span>
                      <Badge variant="destructive">Review needed</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Quick Access Cards - Always visible */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-8">
          {/* Running Hours Widget */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation('/pms/running-hrs')}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center">
                <Clock className="h-4 w-4 text-[#52baf3] mr-2" />
                Running Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Main Engine</span>
                  <span className="font-medium">12,450 hrs</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Aux Engine #1</span>
                  <span className="font-medium">8,230 hrs</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Emergency Gen</span>
                  <span className="font-medium">456 hrs</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PMS Status Widget */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                PMS System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>E-PMS Status</span>
                  <Badge variant="default" className="text-xs">Active</Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Data Sync</span>
                  <Badge variant="default" className="text-xs">Synced</Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Last Backup</span>
                  <span className="font-medium">2 hrs ago</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity Widget */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigateToSpares()}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center">
                <Store className="h-4 w-4 text-[#52baf3] mr-2" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span>Oil Filter received</span>
                  <span className="text-green-600">+5</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>Gasket consumed</span>
                  <span className="text-red-600">-2</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>WO completed</span>
                  <CheckCircle className="h-3 w-3 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Manufacturer Recommendations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center">
                <Wrench className="h-4 w-4 text-[#52baf3] mr-2" />
                Maker Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>Compliant</span>
                  <Badge variant="default" className="text-xs">85%</Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Overdue</span>
                  <Badge variant="destructive" className="text-xs">3</Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Modified</span>
                  <Badge variant="secondary" className="text-xs">12</Badge>
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