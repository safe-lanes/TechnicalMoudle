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
  Ship,
  Calendar,
  Shield,
  Filter,
  Activity,
  AlertCircle,
  FileText,
  Loader2
} from "lucide-react";
import { isAfter, subDays, startOfYear, isWithinInterval } from "date-fns";
import { useVessels } from "@/hooks/useVessels";
import { formatForDisplay, parseDate } from "@/lib/dateUtils";
import type { Defect } from "@shared/schema";
import { 
  getComputedStatus, 
  COMPUTED_ACTIVE_STATUSES, 
  COMPUTED_RESOLVED_STATUSES,
  isActiveComputedStatus,
  isResolvedComputedStatus 
} from "@/lib/defectStatusUtils";
import { DefectsListModal } from "./DefectsListModal";
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
} from "recharts";

// Use ACTIVE_STATUSES and RESOLVED_STATUSES imported from @shared/defectStatus

interface KPICardProps {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  onClick?: () => void;
}

const KPICard = ({ title, value, icon: Icon, color, onClick }: KPICardProps) => {
  return (
    <Card 
      className={`${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''} ${color}`}
      onClick={onClick}
    >
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold mt-1" data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </p>
          </div>
          <Icon className="h-7 w-7 opacity-60" />
        </div>
      </CardContent>
    </Card>
  );
};

type ModalType = 'active' | 'resolved' | 'coc' | 'overdue' | null;

export default function DefectsDashboard() {
  const [selectedVessel, setSelectedVessel] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [showFilters, setShowFilters] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const { data: defects = [], isLoading, refetch } = useQuery<Defect[]>({
    queryKey: ['/technical/api/defects?includeClosedDefects=true'],
  });

  const { data: masterVessels = [], isLoading: isLoadingVessels } = useVessels();

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
      case 'all':
        return new Date(2000, 0, 1);
      default:
        return startOfYear(now);
    }
  };

  const filteredDefects = defects.filter(d => {
    if (selectedVessel !== 'all' && d.vesselId !== selectedVessel) {
      return false;
    }
    
    if (dateRange !== 'all' && d.issueDate) {
      try {
        const issueDate = parseDate(d.issueDate);
        if (!issueDate) return true;
        const rangeStart = getDateRangeStart();
        const rangeEnd = new Date();
        return isWithinInterval(issueDate, { start: rangeStart, end: rangeEnd });
      } catch {
        return true;
      }
    }
    
    return true;
  });

  const defectsWithComputedStatus = filteredDefects.map(d => ({
    ...d,
    computedStatus: getComputedStatus(d)
  }));
  
  const activeDefects = defectsWithComputedStatus.filter(d => isActiveComputedStatus(d.computedStatus.label));
  const resolvedDefects = defectsWithComputedStatus.filter(d => isResolvedComputedStatus(d.computedStatus.label));

  const kpis = {
    totalActive: activeDefects.length,
    totalResolved: resolvedDefects.length,
    conditionOfClass: activeDefects.filter(d => d.is_coc).length,
    overdueDefects: defectsWithComputedStatus.filter(d => d.computedStatus.label === 'Overdue').length,
    highPriority: activeDefects.filter(d => d.priority === 'High' || d.critical).length,
  };

  const resolutionRate = kpis.totalActive + kpis.totalResolved > 0
    ? Math.round((kpis.totalResolved / (kpis.totalActive + kpis.totalResolved)) * 100)
    : 0;

  const vessels = masterVessels.length > 0 
    ? masterVessels 
    : Array.from(new Set(defects.map(d => d.vesselId))).filter(Boolean).map(id => ({ id, name: id, code: id }));

  const statusData = [
    { name: 'Reported', value: defectsWithComputedStatus.filter(d => d.computedStatus.label === 'Reported').length, color: '#6b7280' },
    { name: 'In Progress', value: defectsWithComputedStatus.filter(d => d.computedStatus.label === 'In Progress').length, color: '#3b82f6' },
    { name: 'Extended', value: defectsWithComputedStatus.filter(d => d.computedStatus.label === 'Extended').length, color: '#6366f1' },
    { name: 'Overdue', value: defectsWithComputedStatus.filter(d => d.computedStatus.label === 'Overdue').length, color: '#ef4444' },
    { name: 'Closed', value: defectsWithComputedStatus.filter(d => d.computedStatus.label === 'Closed').length, color: '#10b981' },
    { name: 'Verified', value: defectsWithComputedStatus.filter(d => d.computedStatus.label === 'Verified').length, color: '#22c55e' },
  ].filter(s => s.value > 0);

  const vesselData = vessels.map(vessel => ({
    vessel: vessel.name || vessel.id,
    active: defectsWithComputedStatus.filter(d => d.vesselId === vessel.id && isActiveComputedStatus(d.computedStatus.label)).length,
    closed: defectsWithComputedStatus.filter(d => d.vesselId === vessel.id && isResolvedComputedStatus(d.computedStatus.label)).length
  }));

  const recentDefects = [...activeDefects]
    .sort((a, b) => {
      const dateA = parseDate(a.issueDate);
      const dateB = parseDate(b.issueDate);
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 5);

  const handleClearFilters = () => {
    setSelectedVessel('all');
    setDateRange('all');
  };

  const navigateToDefectLog = (filter?: string) => {
    const params = new URLSearchParams();
    if (selectedVessel !== 'all') {
      params.append('vessel', selectedVessel);
    }
    if (filter) {
      params.append('filter', filter);
    }
    const queryString = params.toString();
    window.location.href = `/defects/defect-log${queryString ? `?${queryString}` : ''}`;
  };

  const getModalDefects = () => {
    switch (activeModal) {
      case 'active':
        return activeDefects;
      case 'resolved':
        return resolvedDefects;
      case 'coc':
        return defectsWithComputedStatus.filter(d => d.is_coc && isActiveComputedStatus(d.computedStatus.label));
      case 'overdue':
        return defectsWithComputedStatus.filter(d => d.computedStatus.label === 'Overdue');
      default:
        return [];
    }
  };

  const getModalTitle = () => {
    switch (activeModal) {
      case 'active':
        return 'Active Defects';
      case 'resolved':
        return 'Resolved Defects';
      case 'coc':
        return 'Condition of Class Defects';
      case 'overdue':
        return 'Overdue Defects';
      default:
        return 'Defects';
    }
  };

  return (
    <div className="flex flex-col bg-gray-50 dark:bg-gray-900" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className="pt-2 px-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4 gap-4">
          <h1 className="text-2xl font-bold text-black dark:text-white">Defects Dashboard</h1>
          <div className="flex items-center gap-3">
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
          </div>
        </div>

        {/* Collapsible Filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 mb-4 bg-transparent rounded-lg">
            <div className="flex items-center gap-2">
              <Ship className="h-4 w-4 text-[#8798ad]" />
              <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                <SelectTrigger className="w-[150px] h-8 text-xs text-[#8798ad]" data-testid="select-vessel">
                  <SelectValue placeholder="Vessel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vessels</SelectItem>
                  {vessels.map(vessel => (
                    <SelectItem key={vessel.id} value={vessel.id}>
                      {vessel.name || vessel.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#8798ad]" />
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[150px] h-8 text-xs text-[#8798ad]" data-testid="select-date-range">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last7days">Last 7 Days</SelectItem>
                  <SelectItem value="last30days">Last 30 Days</SelectItem>
                  <SelectItem value="last90days">Last 90 Days</SelectItem>
                  <SelectItem value="thisyear">This Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleClearFilters}
              variant="ghost" 
              className="h-8 px-4 text-xs"
              data-testid="button-clear-filters"
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Dashboard Content */}
      <div className="px-4 flex-1 overflow-y-auto space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Active Defects"
          value={kpis.totalActive}
          icon={AlertTriangle}
          color="bg-white text-red-600 border-gray-200"
          onClick={() => setActiveModal('active')}
        />
        
        <KPICard
          title="Total Resolved"
          value={kpis.totalResolved}
          icon={CheckCircle}
          color="bg-white text-green-600 border-gray-200"
          onClick={() => setActiveModal('resolved')}
        />
        
        <KPICard
          title="Condition of Class"
          value={kpis.conditionOfClass}
          icon={Shield}
          color="bg-white text-blue-600 border-gray-200"
          onClick={() => setActiveModal('coc')}
        />
        
        <KPICard
          title="Overdue Defects"
          value={kpis.overdueDefects}
          icon={Clock}
          color="bg-white text-orange-600 border-gray-200"
          onClick={() => setActiveModal('overdue')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Defects by Status</span>
              <Activity className="h-5 w-5 text-gray-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[250px] text-gray-400">
                <CheckCircle className="h-12 w-12 mb-2" />
                <p>No defects to display</p>
              </div>
            ) : (
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
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Defects by Vessel</span>
              <Ship className="h-5 w-5 text-gray-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vesselData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[250px] text-gray-400">
                <Ship className="h-12 w-12 mb-2" />
                <p>No vessel data</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={vesselData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="vessel" angle={-45} textAnchor="end" height={80} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="active" fill="#ef4444" name="Active" />
                  <Bar dataKey="closed" fill="#10b981" name="Closed" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Critical Defects</span>
              <AlertCircle className="h-5 w-5 text-red-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
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
              
              <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
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

              <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="font-medium">High Priority</p>
                    <p className="text-sm text-gray-600">Immediate attention</p>
                  </div>
                </div>
                <Badge variant={kpis.highPriority > 0 ? "destructive" : "secondary"} className={kpis.highPriority > 0 ? "" : "bg-gray-100 text-gray-800"}>
                  {kpis.highPriority}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Recent Active Defects</span>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigateToDefectLog()} data-testid="button-view-all">
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
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
                  <TableHead>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDefects.map((defect) => (
                  <TableRow key={defect.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigateToDefectLog()}>
                    <TableCell className="font-medium font-mono text-blue-600">{defect.id}</TableCell>
                    <TableCell>{defect.vesselName || defect.vesselId}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      <div className="flex items-center space-x-2">
                        {defect.is_coc && (
                          <Badge variant="outline" className="text-blue-600 border-blue-300">
                            CoC
                          </Badge>
                        )}
                        <span className="truncate">{defect.description}</span>
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
                          <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                            {formatForDisplay(targetDate)}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={defect.computedStatus.label === 'Overdue' ? 'destructive' : 'secondary'}
                        className={
                          defect.computedStatus.label === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                          defect.computedStatus.label === 'Reported' ? 'bg-gray-100 text-gray-800' :
                          defect.computedStatus.label === 'Verified' ? 'bg-green-100 text-green-800' :
                          defect.computedStatus.label === 'Closed' ? 'bg-green-100 text-green-800' :
                          defect.computedStatus.label === 'Extended' ? 'bg-indigo-100 text-indigo-800' :
                          ''
                        }
                      >
                        {defect.computedStatus.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {defect.critical ? (
                        <Badge variant="destructive">Critical</Badge>
                      ) : defect.priority === 'High' ? (
                        <Badge className="bg-orange-100 text-orange-800">High</Badge>
                      ) : defect.priority === 'Medium' ? (
                        <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>
                      ) : (
                        <Badge variant="secondary">Low</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>

      <DefectsListModal
        open={activeModal !== null}
        onClose={() => setActiveModal(null)}
        title={getModalTitle()}
        defects={getModalDefects()}
      />
    </div>
  );
}
