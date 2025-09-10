import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, AlertCircle, Clock, Package, FileText, Wrench, ChevronRight, RefreshCw } from 'lucide-react';
import { format, addDays, startOfDay, endOfDay, differenceInDays, subDays, isAfter, isBefore } from 'date-fns';
import { useLocation } from 'wouter';
import { FEATURES } from '@/config/features';

// Types for dashboard data
interface DashboardKPIs {
  overdueWorkOrders: number;
  dueNext7Days: number;
  runningHoursDueSoon: number;
  criticalSparesBelowMin: number;
  certificatesExpiring30Days: number;
  pendingChangeRequests: number;
  ihmUnknownItems?: number;
}

interface WorkOrder {
  id: number;
  workOrderNo: string;
  title: string;
  componentName: string;
  dueDate: string;
  status: string;
  assignedTo?: string;
  department?: string;
  maintenanceType?: 'Calendar' | 'Running Hours';
  currentRunningHours?: number;
  runningHoursThreshold?: number;
}

interface SpareItem {
  id: number;
  itemCode: string;
  itemName: string;
  uom: string;
  rob: number;
  min: number;
  isCritical: boolean;
  location?: string;
}

interface Certificate {
  id: number;
  name: string;
  expiryDate: string;
  daysLeft: number;
  type: string;
}

// Date window options
type DateWindow = 'today' | '7d' | '30d';

export default function Dashboard() {
  // Check if dashboard feature is enabled
  if (!FEATURES.DASHBOARD) {
    return null;
  }

  const [, setLocation] = useLocation();
  const [selectedVessel, setSelectedVessel] = useState('vessel-1');
  const [dateWindow, setDateWindow] = useState<DateWindow>('7d');
  const [whatIfDeferDays, setWhatIfDeferDays] = useState(0);
  const [whatIfDepartment, setWhatIfDepartment] = useState<string>('all');

  // Calculate date range based on window
  const dateRange = useMemo(() => {
    const today = new Date();
    const start = startOfDay(today);
    let end: Date;
    
    switch (dateWindow) {
      case 'today':
        end = endOfDay(today);
        break;
      case '7d':
        end = endOfDay(addDays(today, 6));
        break;
      case '30d':
        end = endOfDay(addDays(today, 29));
        break;
      default:
        end = endOfDay(addDays(today, 6));
    }
    
    return { start, end };
  }, [dateWindow]);

  // Fetch dashboard KPIs
  const { data: kpis, isLoading: kpisLoading } = useQuery<DashboardKPIs>({
    queryKey: ['/api/dashboard/kpis', selectedVessel, dateRange],
    queryFn: async () => {
      // For now, fetch from existing endpoints and calculate
      const [workOrdersRes, sparesRes, certificatesRes, changeRequestsRes] = await Promise.all([
        fetch('/api/work-orders'),
        fetch('/api/spares'),
        fetch('/api/certificates'),
        fetch('/api/change-requests?status=Pending')
      ]);
      
      const workOrders = await workOrdersRes.json();
      const spares = await sparesRes.json();
      const certificates = await certificatesRes.json();
      const changeRequests = await changeRequestsRes.json();
      
      const today = new Date();
      
      return {
        overdueWorkOrders: workOrders.filter((wo: any) => 
          wo.status !== 'Completed' && new Date(wo.dueDate) < today
        ).length,
        dueNext7Days: workOrders.filter((wo: any) => {
          const dueDate = new Date(wo.dueDate);
          return wo.status !== 'Completed' && 
                 dueDate >= today && 
                 dueDate <= addDays(today, 7);
        }).length,
        runningHoursDueSoon: workOrders.filter((wo: any) => 
          wo.maintenanceType === 'Running Hours' &&
          wo.currentRunningHours >= (wo.runningHoursThreshold - 200)
        ).length,
        criticalSparesBelowMin: spares.filter((s: any) => 
          s.isCritical && s.rob < s.min
        ).length,
        certificatesExpiring30Days: certificates.filter((c: any) => {
          const daysLeft = differenceInDays(new Date(c.expiryDate), today);
          return daysLeft <= 30 && daysLeft >= 0;
        }).length,
        pendingChangeRequests: changeRequests.length,
        ihmUnknownItems: FEATURES.IHM ? 15 : undefined // Placeholder
      };
    }
  });

  // Fetch work orders for heatmap and queue
  const { data: workOrders = [], isLoading: workOrdersLoading } = useQuery<WorkOrder[]>({
    queryKey: ['/api/work-orders', selectedVessel],
    queryFn: async () => {
      const res = await fetch('/api/work-orders');
      const data = await res.json();
      return data.map((wo: any) => ({
        ...wo,
        department: wo.category?.includes('Engine') ? 'Engine' : 
                    wo.category?.includes('Deck') ? 'Deck' : 
                    wo.category?.includes('Electrical') ? 'Electrical' : 'Other'
      }));
    }
  });

  // Apply What-If transformations
  const transformedWorkOrders = useMemo(() => {
    let filtered = [...workOrders];
    
    // Apply department filter
    if (whatIfDepartment !== 'all') {
      filtered = filtered.filter(wo => wo.department === whatIfDepartment);
    }
    
    // Apply defer days
    if (whatIfDeferDays > 0) {
      filtered = filtered.map(wo => ({
        ...wo,
        dueDate: format(addDays(new Date(wo.dueDate), whatIfDeferDays), 'yyyy-MM-dd')
      }));
    }
    
    return filtered;
  }, [workOrders, whatIfDeferDays, whatIfDepartment]);

  // Calculate heatmap data
  const heatmapData = useMemo(() => {
    const data: Record<string, { count: number; departments: Record<string, number> }> = {};
    const startDate = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = format(addDays(startDate, i), 'yyyy-MM-dd');
      data[date] = { count: 0, departments: { Deck: 0, Engine: 0, Electrical: 0, Other: 0 } };
    }
    
    transformedWorkOrders.forEach(wo => {
      const date = format(new Date(wo.dueDate), 'yyyy-MM-dd');
      if (data[date]) {
        data[date].count++;
        data[date].departments[wo.department || 'Other']++;
      }
    });
    
    return data;
  }, [transformedWorkOrders]);

  // Fetch critical spares
  const { data: criticalSpares = [] } = useQuery<SpareItem[]>({
    queryKey: ['/api/dashboard/spares-critical', selectedVessel],
    queryFn: async () => {
      const res = await fetch('/api/spares');
      const data = await res.json();
      return data.filter((s: any) => s.isCritical && s.rob < s.min);
    }
  });

  // Fetch certificates
  const { data: certificates = [] } = useQuery<Certificate[]>({
    queryKey: ['/api/certificates', selectedVessel],
    queryFn: async () => {
      const res = await fetch('/api/certificates');
      const data = await res.json();
      const today = new Date();
      return data.map((c: any) => ({
        ...c,
        daysLeft: differenceInDays(new Date(c.expiryDate), today)
      })).filter((c: any) => c.daysLeft <= 90);
    }
  });

  // My work queue (filter by current user)
  const myWorkOrders = useMemo(() => {
    const today = startOfDay(new Date());
    const next7Days = endOfDay(addDays(today, 6));
    
    return workOrders
      .filter(wo => wo.assignedTo === 'current-user') // Replace with actual user
      .filter(wo => wo.status !== 'Completed')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [workOrders]);

  // KPI Tile Component
  const KPITile = ({ 
    title, 
    value, 
    icon: Icon, 
    color, 
    onClick 
  }: { 
    title: string; 
    value: number; 
    icon: any; 
    color: string;
    onClick: () => void;
  }) => (
    <Card 
      className={`cursor-pointer hover:shadow-lg transition-shadow border-l-4 ${color}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <Icon className="h-8 w-8 text-muted-foreground opacity-50" />
        </div>
      </CardContent>
    </Card>
  );

  // Heatmap color calculation
  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'bg-gray-100';
    if (count <= 2) return 'bg-green-200';
    if (count <= 4) return 'bg-yellow-200';
    if (count <= 6) return 'bg-orange-200';
    return 'bg-red-200';
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header with vessel selector and date window */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">PMS Dashboard</h1>
        <div className="flex gap-4">
          <Select value={selectedVessel} onValueChange={setSelectedVessel}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select vessel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vessel-1">MV Seafarer</SelectItem>
              <SelectItem value="vessel-2">MV Navigator</SelectItem>
              <SelectItem value="vessel-3">MV Explorer</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex gap-2">
            <Button 
              variant={dateWindow === 'today' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateWindow('today')}
            >
              Today
            </Button>
            <Button 
              variant={dateWindow === '7d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateWindow('7d')}
            >
              7 Days
            </Button>
            <Button 
              variant={dateWindow === '30d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateWindow('30d')}
            >
              30 Days
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPITile
          title="Overdue WOs"
          value={kpis?.overdueWorkOrders || 0}
          icon={AlertCircle}
          color="border-red-500"
          onClick={() => setLocation('/work-orders?status=overdue')}
        />
        <KPITile
          title="Due in 7 Days"
          value={kpis?.dueNext7Days || 0}
          icon={Clock}
          color="border-yellow-500"
          onClick={() => setLocation('/work-orders?dueIn=7')}
        />
        <KPITile
          title="RH Due Soon"
          value={kpis?.runningHoursDueSoon || 0}
          icon={Wrench}
          color="border-orange-500"
          onClick={() => setLocation('/work-orders?type=rh-due')}
        />
        <KPITile
          title="Critical Spares Low"
          value={kpis?.criticalSparesBelowMin || 0}
          icon={Package}
          color="border-purple-500"
          onClick={() => setLocation('/spares?critical=true&belowMin=true')}
        />
        <KPITile
          title="Certs Expiring"
          value={kpis?.certificatesExpiring30Days || 0}
          icon={FileText}
          color="border-blue-500"
          onClick={() => setLocation('/certificates?expiringIn=30')}
        />
        <KPITile
          title="Pending Requests"
          value={kpis?.pendingChangeRequests || 0}
          icon={CalendarIcon}
          color="border-indigo-500"
          onClick={() => setLocation('/modify-pms/change-requests?status=Pending')}
        />
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workload Heatmap (2 columns wide) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>30-Day Workload Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-xs">
                {/* Day headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center font-medium p-1">
                    {day}
                  </div>
                ))}
                
                {/* Calendar grid */}
                {Object.entries(heatmapData).slice(0, 30).map(([date, data]) => {
                  const dayOfWeek = new Date(date).getDay();
                  return (
                    <div
                      key={date}
                      className={`${getHeatmapColor(data.count)} border rounded p-2 cursor-pointer hover:opacity-80 transition-opacity`}
                      onClick={() => setLocation(`/work-orders?date=${date}`)}
                      title={`${format(new Date(date), 'MMM d')}: ${data.count} WOs`}
                    >
                      <div className="text-center">
                        <div className="font-medium">{new Date(date).getDate()}</div>
                        <div className="text-xs">{data.count}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Legend */}
              <div className="flex gap-4 mt-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-gray-100 rounded"></div>
                  <span>0</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-green-200 rounded"></div>
                  <span>1-2</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-yellow-200 rounded"></div>
                  <span>3-4</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-orange-200 rounded"></div>
                  <span>5-6</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-red-200 rounded"></div>
                  <span>7+</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* What-If Panel */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>What-If Simulation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Defer WOs by:</label>
                <Select value={whatIfDeferDays.toString()} onValueChange={(v) => setWhatIfDeferDays(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No deferral</SelectItem>
                    <SelectItem value="3">+3 days</SelectItem>
                    <SelectItem value="7">+7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Filter by Department:</label>
                <Select value={whatIfDepartment} onValueChange={setWhatIfDepartment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="Deck">Deck</SelectItem>
                    <SelectItem value="Engine">Engine</SelectItem>
                    <SelectItem value="Electrical">Electrical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => {
                  setWhatIfDeferDays(0);
                  setWhatIfDepartment('all');
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset Simulation
              </Button>
              
              {whatIfDeferDays > 0 && (
                <div className="text-xs text-muted-foreground">
                  Note: This is a simulation only. No data has been saved.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Work Queue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My Work Queue</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setLocation('/work-orders?assignedToMe=true')}>
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myWorkOrders.slice(0, 5).map(wo => (
                <div 
                  key={wo.id} 
                  className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer"
                  onClick={() => setLocation(`/work-orders/${wo.id}`)}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{wo.workOrderNo}</div>
                    <div className="text-xs text-muted-foreground">{wo.componentName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs">{format(new Date(wo.dueDate), 'MMM d')}</div>
                    <Badge variant={
                      new Date(wo.dueDate) < new Date() ? 'destructive' : 
                      differenceInDays(new Date(wo.dueDate), new Date()) <= 3 ? 'warning' : 
                      'secondary'
                    } className="text-xs">
                      {wo.status}
                    </Badge>
                  </div>
                </div>
              ))}
              
              {myWorkOrders.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-4">
                  No work orders assigned
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Spares Risk Snapshot */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Critical Spares at Risk</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setLocation('/spares?critical=true&belowMin=true')}>
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {criticalSpares.slice(0, 5).map(spare => (
                <div 
                  key={spare.id}
                  className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer"
                  onClick={() => setLocation(`/spares/${spare.id}`)}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{spare.itemCode}</div>
                    <div className="text-xs text-muted-foreground">{spare.itemName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs">ROB: {spare.rob} {spare.uom}</div>
                    <Badge variant="destructive" className="text-xs">
                      Min: {spare.min}
                    </Badge>
                  </div>
                </div>
              ))}
              
              {criticalSpares.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-4">
                  All critical spares above minimum
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Certificates Pane */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Certificates Expiring</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setLocation('/certificates')}>
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {certificates.slice(0, 5).map(cert => (
                <div 
                  key={cert.id}
                  className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer"
                  onClick={() => setLocation(`/certificates/${cert.id}`)}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm truncate">{cert.name}</div>
                    <div className="text-xs text-muted-foreground">{cert.type}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs">{format(new Date(cert.expiryDate), 'MMM d, yyyy')}</div>
                    <Badge variant={
                      cert.daysLeft <= 7 ? 'destructive' : 
                      cert.daysLeft <= 30 ? 'warning' : 
                      'secondary'
                    } className="text-xs">
                      {cert.daysLeft}d left
                    </Badge>
                  </div>
                </div>
              ))}
              
              {certificates.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-4">
                  No certificates expiring soon
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* IHM Attention (if enabled) */}
      {FEATURES.IHM && kpis?.ihmUnknownItems && kpis.ihmUnknownItems > 0 && (
        <Card className="border-l-4 border-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">IHM Attention Required</p>
                <p className="text-sm text-muted-foreground">
                  {kpis.ihmUnknownItems} items with unknown status or missing evidence
                </p>
              </div>
              <Button onClick={() => setLocation('/components?ihmStatus=unknown')}>
                Review IHM Items <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}