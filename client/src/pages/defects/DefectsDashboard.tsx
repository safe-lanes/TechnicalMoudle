import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Ship,
  Calendar,
  Shield,
  TrendingUp,
  Activity,
  AlertCircle,
  FileText,
  WrenchIcon,
  XCircle
} from "lucide-react";
import { startOfMonth, endOfMonth, isAfter, parseISO, subDays, startOfYear, isWithinInterval, format } from "date-fns";
import { formatForDisplay, parseDate } from "@/lib/dateUtils";
import type { Defect } from "@shared/schema";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

// KPI Card Component
interface KPICardProps {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  subtitle?: string;
  onClick?: () => void;
}

const KPICard = ({ title, value, icon: Icon, color, change, changeType, subtitle, onClick }: KPICardProps) => {
  return (
    <Card className={`${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''} ${color}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-3xl font-bold mt-2" data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
            {change && (
              <div className="flex items-center mt-2">
                <span className={`text-xs font-medium ${
                  changeType === 'positive' ? 'text-green-600' : 
                  changeType === 'negative' ? 'text-red-600' : 
                  'text-gray-600'
                }`}>
                  {change}
                </span>
              </div>
            )}
          </div>
          <Icon className="h-8 w-8 opacity-60" />
        </div>
      </CardContent>
    </Card>
  );
};

export default function DefectsDashboard() {
  const [selectedVessel, setSelectedVessel] = useState("all");
  const [dateRange, setDateRange] = useState("last30days");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch defects data
  const { data: defects = [], isLoading, refetch } = useQuery<Defect[]>({
    queryKey: ['/api/defects'],
  });

  // Apply date range filter
  const getDateRangeStart = () => {
    const now = new Date();
    switch (dateRange) {
      case 'last7days':
        return subDays(now, 7);
      case 'last30days':
        return subDays(now, 30);
      case 'last90days':
        return subDays(now, 90);
      case 'thisyear':
        return startOfYear(now);
      default:
        return subDays(now, 30); // Default to last 30 days
    }
  };

  // Filter defects by vessel and date range
  const filteredDefects = defects.filter(d => {
    // Vessel filter
    if (selectedVessel !== 'all' && d.vesselId !== selectedVessel) {
      return false;
    }
    
    // Date range filter (based on issue date)
    if (d.issueDate) {
      try {
        const issueDate = parseISO(d.issueDate);
        const rangeStart = getDateRangeStart();
        const rangeEnd = new Date();
        return isWithinInterval(issueDate, { start: rangeStart, end: rangeEnd });
      } catch {
        return true; // Include if date parsing fails
      }
    }
    
    return true; // Include defects without issue date
  });

  // Calculate KPIs based on filtered defects
  const kpis = {
    totalActive: filteredDefects.filter(d => d.status === 'Open').length,
    resolvedThisMonth: filteredDefects.filter(d => {
      if (d.status !== 'Closed' || !d.dateCompleted) return false;
      try {
        const completedDate = parseISO(d.dateCompleted);
        const monthStart = startOfMonth(new Date());
        const monthEnd = endOfMonth(new Date());
        return completedDate >= monthStart && completedDate <= monthEnd;
      } catch {
        return false;
      }
    }).length,
    conditionOfClass: filteredDefects.filter(d => d.is_coc && d.status === 'Open').length,
    overdueDefects: filteredDefects.filter(d => {
      if (d.status !== 'Open' || !d.targetCloseDate) return false;
      try {
        return isAfter(new Date(), parseISO(d.targetCloseDate));
      } catch {
        return false;
      }
    }).length
  };

  // Get unique vessels
  const vessels = Array.from(new Set(defects.map(d => d.vesselId))).filter(Boolean);

  // Prepare chart data
  const statusData = [
    { name: 'Open', value: filteredDefects.filter(d => d.status === 'Open').length, color: '#ef4444' },
    { name: 'In Progress', value: filteredDefects.filter(d => d.status === 'In Progress').length, color: '#f59e0b' },
    { name: 'Closed', value: filteredDefects.filter(d => d.status === 'Closed').length, color: '#10b981' },
  ];

  const vesselData = vessels.map(vessel => ({
    vessel,
    open: filteredDefects.filter(d => d.vesselId === vessel && d.status === 'Open').length,
    closed: filteredDefects.filter(d => d.vesselId === vessel && d.status === 'Closed').length
  }));

  // Recent defects (last 5) from filtered data
  const recentDefects = [...filteredDefects]
    .filter(d => d.status === 'Open')
    .sort((a, b) => {
      if (!a.issueDate || !b.issueDate) return 0;
      return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime();
    })
    .slice(0, 5);

  const handleRefresh = () => {
    refetch();
    setLastRefresh(new Date());
  };

  const navigateToDefectLog = (filter?: string) => {
    // Pass current vessel and date range filters along with specific filter
    const params = new URLSearchParams();
    if (selectedVessel !== 'all') {
      params.append('vessel', selectedVessel);
    }
    params.append('dateRange', dateRange);
    if (filter) {
      params.append('filter', filter);
    }
    const queryString = params.toString();
    window.location.href = `/defects/defect-log${queryString ? `?${queryString}` : ''}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <WrenchIcon className="h-8 w-8 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Defects Dashboard</h1>
              <p className="text-sm text-gray-500">Overview of maintenance defects and issues</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              System Active
            </Badge>
            <div className="text-sm text-gray-500">
              Last updated: {format(lastRefresh, 'HH:mm:ss')}
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Ship className="h-4 w-4 text-gray-500" />
              <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select vessel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vessels</SelectItem>
                  {vessels.map(vessel => (
                    <SelectItem key={vessel} value={vessel}>
                      {vessel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last7days">Last 7 Days</SelectItem>
                  <SelectItem value="last30days">Last 30 Days</SelectItem>
                  <SelectItem value="last90days">Last 90 Days</SelectItem>
                  <SelectItem value="thisyear">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(selectedVessel !== 'all' || dateRange !== 'last30days') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedVessel('all');
                setDateRange('last30days');
              }}
              className="flex items-center space-x-2"
            >
              <XCircle className="h-4 w-4" />
              <span>Clear Filters</span>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Active Defects"
          value={kpis.totalActive}
          icon={AlertTriangle}
          color="bg-red-50 text-red-600 border-red-200"
          change={kpis.totalActive > 0 ? `${kpis.totalActive} requiring attention` : "All clear"}
          changeType={kpis.totalActive > 0 ? "negative" : "positive"}
          onClick={() => navigateToDefectLog('active')}
        />
        
        <KPICard
          title="Resolved This Month"
          value={kpis.resolvedThisMonth}
          icon={CheckCircle}
          color="bg-green-50 text-green-600 border-green-200"
          change={`${((kpis.resolvedThisMonth / (kpis.resolvedThisMonth + kpis.totalActive)) * 100).toFixed(0)}% resolution rate`}
          changeType="positive"
          onClick={() => navigateToDefectLog('resolved')}
        />
        
        <KPICard
          title="Condition of Class"
          value={kpis.conditionOfClass}
          icon={Shield}
          color="bg-blue-50 text-blue-600 border-blue-200"
          change={kpis.conditionOfClass > 0 ? "Critical regulatory items" : "No CoC items"}
          changeType={kpis.conditionOfClass > 0 ? "negative" : "positive"}
          subtitle="Regulatory compliance"
          onClick={() => navigateToDefectLog('coc')}
        />
        
        <KPICard
          title="Overdue Defects"
          value={kpis.overdueDefects}
          icon={Clock}
          color="bg-orange-50 text-orange-600 border-orange-200"
          change={kpis.overdueDefects > 0 ? `${kpis.overdueDefects} past target date` : "All on schedule"}
          changeType={kpis.overdueDefects > 0 ? "negative" : "neutral"}
          onClick={() => navigateToDefectLog('overdue')}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Defects by Status</span>
              <Activity className="h-5 w-5 text-gray-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Vessel Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Defects by Vessel</span>
              <Ship className="h-5 w-5 text-gray-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={vesselData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="vessel" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="open" fill="#ef4444" name="Open" />
                <Bar dataKey="closed" fill="#10b981" name="Closed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Critical Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Critical Defects</span>
              <AlertCircle className="h-5 w-5 text-red-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Shield className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">Condition of Class</p>
                    <p className="text-sm text-gray-600">Regulatory items</p>
                  </div>
                </div>
                <Badge variant={kpis.conditionOfClass > 0 ? "destructive" : "secondary"}>
                  {kpis.conditionOfClass}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-medium">Overdue</p>
                    <p className="text-sm text-gray-600">Past target date</p>
                  </div>
                </div>
                <Badge variant={kpis.overdueDefects > 0 ? "destructive" : "secondary"}>
                  {kpis.overdueDefects}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="font-medium">High Priority</p>
                    <p className="text-sm text-gray-600">Immediate attention</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  {defects.filter(d => d.status === 'Open' && d.priority === 'High').length}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Defects Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Recent Active Defects</span>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigateToDefectLog()}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : recentDefects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <CheckCircle className="h-12 w-12 mb-2" />
              <p>No active defects</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Target Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDefects.map((defect) => (
                  <TableRow key={defect.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigateToDefectLog()}>
                    <TableCell className="font-medium">{defect.id}</TableCell>
                    <TableCell>{defect.vesselId}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      <div className="flex items-center space-x-2">
                        {defect.is_coc && (
                          <Badge variant="outline" className="text-blue-600 border-blue-300">
                            CoC
                          </Badge>
                        )}
                        <span>{defect.description}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatForDisplay(defect.issueDate)}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const targetDate = parseDate(defect.targetCloseDate);
                        if (!targetDate) return '-';
                        const isOverdue = isAfter(new Date(), targetDate);
                        return (
                          <span className={isOverdue ? 'text-red-600' : ''}>
                            {formatForDisplay(targetDate)}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={defect.status === 'Open' ? 'destructive' : 'secondary'}>
                        {defect.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}