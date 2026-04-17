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
  Shield,
  Filter,
  Activity,
  AlertCircle,
  FileText,
  Loader2
} from "lucide-react";
import { isAfter } from "date-fns";
import { useVessels } from "@/hooks/useVessels";
import { formatForDisplay, parseDate } from "@/lib/dateUtils";
import { PeriodPicker, type PeriodValue } from "@/components/filters/PeriodPicker";
import type { Defect } from "@shared/schema";
import { 
  getComputedStatus, 
  COMPUTED_ACTIVE_STATUSES, 
  COMPUTED_RESOLVED_STATUSES,
  isActiveComputedStatus,
  isResolvedComputedStatus 
} from "@/lib/defectStatusUtils";
import { DefectsListModal } from "./DefectsListModal";
import DefectModal from "./DefectModal";
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
  borderColor: string;
  textColor: string;
  onClick?: () => void;
}

const KPICard = ({ title, value, borderColor, textColor, onClick }: KPICardProps) => {
  return (
    <Card 
      className={`${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''} bg-white border-0 border-l-4 ${borderColor}`}
      onClick={onClick}
    >
      <CardContent className="py-3 px-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${textColor}`} data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

type ModalType = 'active' | 'resolved' | 'coc' | 'overdue' | 'criticalEquipment' | 'highPriority' | `status_${string}` | `vessel_${string}` | `vessel_active_${string}` | `vessel_closed_${string}` | null;

export default function DefectsDashboard() {
  const getYtdPeriod = (): PeriodValue => {
    const now = new Date();
    return {
      mode: 'dateRange',
      dateFrom: new Date(now.getFullYear(), 0, 1),
      dateTo: now,
    };
  };

  const [selectedVessel, setSelectedVessel] = useState("all");
  const [periodValue, setPeriodValue] = useState<PeriodValue | null>(() => getYtdPeriod());
  const [showFilters, setShowFilters] = useState(true);
  const [activeTab, setActiveTab] = useState<'management' | 'operation'>('management');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [viewModal, setViewModal] = useState<{ open: boolean; defectId: string | null }>({ 
    open: false, 
    defectId: null 
  });

  const { data: defects = [], isLoading, refetch } = useQuery<Defect[]>({
    queryKey: ['/technical/api/defects', 'dashboard', 'active'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('statusScope', 'active');
      const response = await fetch(`/technical/api/defects?${params}`);
      if (!response.ok) throw new Error('Failed to fetch defects');
      return response.json();
    },
  });

  const { data: masterVessels = [], isLoading: isLoadingVessels } = useVessels();

  const selectedVesselObj = selectedVessel !== 'all' ? masterVessels.find(v => v.id === selectedVessel) : null;
  const selectedVesselNameLower = selectedVesselObj?.name?.toLowerCase().trim() || '';

  const filteredDefects = defects.filter(d => {
    if (selectedVessel !== 'all') {
      const matchesId = d.vesselId === selectedVessel;
      const matchesName = selectedVesselNameLower && (d.vesselName || '').toLowerCase().trim() === selectedVesselNameLower;
      if (!matchesId && !matchesName) return false;
    }
    
    if (periodValue) {
      if (!d.issueDate) return false;
      const val = String(d.issueDate);
      let issueDate: Date;
      const isoMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
      const ddmmyyyyMatch = val.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (isoMatch) {
        const [, yStr, mStr, dStr] = isoMatch;
        issueDate = new Date(parseInt(yStr), parseInt(mStr) - 1, parseInt(dStr));
      } else if (ddmmyyyyMatch) {
        const [, dStr, mStr, yStr] = ddmmyyyyMatch;
        issueDate = new Date(parseInt(yStr), parseInt(mStr) - 1, parseInt(dStr));
      } else {
        issueDate = new Date(val);
      }
      if (isNaN(issueDate.getTime())) return false;
      issueDate.setHours(0, 0, 0, 0);

      if (periodValue.mode === "yearQuarterMonth") {
        if (periodValue.month !== undefined && periodValue.year) {
          return issueDate.getFullYear() === periodValue.year && issueDate.getMonth() === periodValue.month;
        }
        if (periodValue.quarter !== undefined && periodValue.year) {
          const qStartMonth = (periodValue.quarter - 1) * 3;
          return issueDate.getFullYear() === periodValue.year && issueDate.getMonth() >= qStartMonth && issueDate.getMonth() <= qStartMonth + 2;
        }
        if (periodValue.year) {
          return issueDate.getFullYear() === periodValue.year;
        }
      } else if (periodValue.mode === "dateRange") {
        if (periodValue.dateFrom) {
          const from = new Date(periodValue.dateFrom);
          from.setHours(0, 0, 0, 0);
          if (issueDate < from) return false;
        }
        if (periodValue.dateTo) {
          const to = new Date(periodValue.dateTo);
          to.setHours(23, 59, 59, 999);
          if (issueDate > to) return false;
        }
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
    criticalEquipment: activeDefects.filter(d => d.critical).length,
    highPriority: activeDefects.filter(d => d.priority === 'High').length,
  };

  const resolutionRate = kpis.totalActive + kpis.totalResolved > 0
    ? Math.round((kpis.totalResolved / (kpis.totalActive + kpis.totalResolved)) * 100)
    : 0;

  const allDefectsWithComputedStatus = defects.map(d => ({
    ...d,
    computedStatus: getComputedStatus(d)
  }));

  const vessels = masterVessels.map(v => ({
    id: v.id,
    name: v.name,
    code: v.code
  }));

  const statusData = [
    { name: 'Reported', value: defectsWithComputedStatus.filter(d => d.computedStatus.label === 'Reported').length, color: '#6b7280' },
    { name: 'In Progress', value: defectsWithComputedStatus.filter(d => d.computedStatus.label === 'In Progress').length, color: '#3b82f6' },
    { name: 'Extended', value: defectsWithComputedStatus.filter(d => d.computedStatus.label === 'Extended').length, color: '#f97316' },
    { name: 'Overdue', value: defectsWithComputedStatus.filter(d => d.computedStatus.label === 'Overdue').length, color: '#ff6961' },
    { name: 'Closed', value: defectsWithComputedStatus.filter(d => d.computedStatus.label === 'Closed').length, color: '#5dc86f' },
    { name: 'Verified', value: defectsWithComputedStatus.filter(d => d.computedStatus.label === 'Verified').length, color: '#00AF7B' },
  ].filter(s => s.value > 0);

  const vesselData = vessels.map(vessel => {
    const vesselNameLower = (vessel.name || '').toLowerCase().trim();
    const matchesVessel = (d: any) => d.vesselId === vessel.id || (vesselNameLower && (d.vesselName || '').toLowerCase().trim() === vesselNameLower);
    return {
      vessel: vessel.name || vessel.id,
      vesselId: vessel.id,
      active: defectsWithComputedStatus.filter(d => matchesVessel(d) && isActiveComputedStatus(d.computedStatus.label)).length,
      closed: defectsWithComputedStatus.filter(d => matchesVessel(d) && isResolvedComputedStatus(d.computedStatus.label)).length
    };
  }).filter(v => v.active > 0 || v.closed > 0);

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
    setPeriodValue(getYtdPeriod());
  };

  const DEFECT_CATEGORY_COLORS = [
    '#52baf3', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#6b7280',
  ];

  const defectCategoryData = (() => {
    const counts = new Map<string, number>();
    for (const d of defectsWithComputedStatus) {
      const raw = d.defectCategory ? String(d.defectCategory).trim() : '';
      const key = raw || 'Unspecified';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const top10 = sorted.slice(0, 10);
    const rest = sorted.slice(10);
    const data = top10.map(([name, value], i) => ({
      name,
      value,
      color: DEFECT_CATEGORY_COLORS[i % DEFECT_CATEGORY_COLORS.length],
    }));
    if (rest.length > 0) {
      data.push({
        name: 'Other',
        value: rest.reduce((sum, [, v]) => sum + v, 0),
        color: DEFECT_CATEGORY_COLORS[DEFECT_CATEGORY_COLORS.length - 1],
      });
    }
    return data;
  })();

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

  const defectMatchesVesselId = (defect: any, vId: string) => {
    if (defect.vesselId === vId) return true;
    const vessel = vessels.find(v => v.id === vId);
    if (vessel?.name) {
      return (defect.vesselName || '').toLowerCase().trim() === vessel.name.toLowerCase().trim();
    }
    return false;
  };

  const getModalDefects = () => {
    if (!activeModal) return [];
    switch (activeModal) {
      case 'active':
        return activeDefects;
      case 'resolved':
        return resolvedDefects;
      case 'coc':
        return defectsWithComputedStatus.filter(d => d.is_coc && isActiveComputedStatus(d.computedStatus.label));
      case 'overdue':
        return defectsWithComputedStatus.filter(d => d.computedStatus.label === 'Overdue');
      case 'criticalEquipment':
        return activeDefects.filter(d => d.critical);
      case 'highPriority':
        return activeDefects.filter(d => d.priority === 'High');
      default:
        if (activeModal.startsWith('status_')) {
          const statusName = activeModal.replace('status_', '');
          return defectsWithComputedStatus.filter(d => d.computedStatus.label === statusName);
        }
        if (activeModal.startsWith('vessel_active_')) {
          const vId = activeModal.replace('vessel_active_', '');
          return defectsWithComputedStatus.filter(d => defectMatchesVesselId(d, vId) && isActiveComputedStatus(d.computedStatus.label));
        }
        if (activeModal.startsWith('vessel_closed_')) {
          const vId = activeModal.replace('vessel_closed_', '');
          return defectsWithComputedStatus.filter(d => defectMatchesVesselId(d, vId) && isResolvedComputedStatus(d.computedStatus.label));
        }
        if (activeModal.startsWith('vessel_')) {
          const vId = activeModal.replace('vessel_', '');
          return defectsWithComputedStatus.filter(d => defectMatchesVesselId(d, vId));
        }
        return [];
    }
  };

  const getModalTitle = () => {
    if (!activeModal) return 'Defects';
    switch (activeModal) {
      case 'active':
        return 'Active Defects';
      case 'resolved':
        return 'Resolved Defects';
      case 'coc':
        return 'Condition of Class Defects';
      case 'overdue':
        return 'Overdue Defects';
      case 'criticalEquipment':
        return 'Critical Equipment Defects';
      case 'highPriority':
        return 'High Priority Defects';
      default:
        if (activeModal.startsWith('status_')) {
          const statusName = activeModal.replace('status_', '');
          return `${statusName} Defects`;
        }
        if (activeModal.startsWith('vessel_active_')) {
          const vId = activeModal.replace('vessel_active_', '');
          const vName = vessels.find(v => v.id === vId)?.name || vId;
          return `Active Defects - ${vName}`;
        }
        if (activeModal.startsWith('vessel_closed_')) {
          const vId = activeModal.replace('vessel_closed_', '');
          const vName = vessels.find(v => v.id === vId)?.name || vId;
          return `Closed Defects - ${vName}`;
        }
        if (activeModal.startsWith('vessel_')) {
          const vId = activeModal.replace('vessel_', '');
          const vName = vessels.find(v => v.id === vId)?.name || vId;
          return `Defects - ${vName}`;
        }
        return 'Defects';
    }
  };

  return (
    <div className="flex flex-col bg-gray-50 dark:bg-gray-900" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-4 gap-4 relative">
          <h1 className="text-2xl font-bold text-black dark:text-white">Defects Dashboard</h1>

          <div className="absolute left-1/2 -translate-x-1/2 bg-gray-100 rounded-md p-1 flex items-center gap-1">
            <button
              onClick={() => setActiveTab('management')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'management' ? 'bg-[#52baf3] text-white' : 'text-gray-700 hover:bg-gray-200'
              }`}
              data-testid="tab-management"
            >
              Management
            </button>
            <button
              onClick={() => setActiveTab('operation')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'operation' ? 'bg-[#52baf3] text-white' : 'text-gray-700 hover:bg-gray-200'
              }`}
              data-testid="tab-operation"
            >
              Operation
            </button>
          </div>

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

            <PeriodPicker
              value={periodValue}
              onChange={(val: PeriodValue | null) => setPeriodValue(val)}
            />

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
      <div className="flex-1 overflow-y-auto space-y-6">

      {activeTab === 'management' && (
      <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Overdue Defects"
          value={kpis.overdueDefects}
          borderColor="border-[#ff6961]"
          textColor="text-[#ff6961]"
          onClick={() => setActiveModal('overdue')}
        />
        
        <KPICard
          title="Critical Equipment Defects"
          value={kpis.criticalEquipment}
          borderColor="border-[#ff6961]"
          textColor="text-[#ff6961]"
          onClick={() => setActiveModal('criticalEquipment')}
        />
        
        <KPICard
          title="High Priority Defects"
          value={kpis.highPriority}
          borderColor="border-orange-500"
          textColor="text-orange-600"
          onClick={() => setActiveModal('highPriority')}
        />
        
        <KPICard
          title="Condition of Class"
          value={kpis.conditionOfClass}
          borderColor="border-orange-500"
          textColor="text-orange-600"
          onClick={() => setActiveModal('coc')}
        />
        
        <KPICard
          title="Total Active Defects"
          value={kpis.totalActive}
          borderColor="border-gray-400"
          textColor="text-gray-700"
          onClick={() => setActiveModal('active')}
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
                    style={{ cursor: 'pointer' }}
                    onClick={(_data: any, index: number) => {
                      const clicked = statusData[index];
                      if (clicked && clicked.value > 0) {
                        setActiveModal(`status_${clicked.name}` as ModalType);
                      }
                    }}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} style={{ cursor: 'pointer' }} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white lg:col-span-2">
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
                <BarChart data={vesselData} style={{ cursor: 'pointer' }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="vessel" angle={-45} textAnchor="end" height={80} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="active"
                    fill="#ff6961"
                    name="Active"
                    style={{ cursor: 'pointer' }}
                    onClick={(data: any) => {
                      if (data && data.vesselId && data.active > 0) {
                        setActiveModal(`vessel_active_${data.vesselId}` as ModalType);
                      }
                    }}
                  />
                  <Bar
                    dataKey="closed"
                    fill="#5dc86f"
                    name="Closed"
                    style={{ cursor: 'pointer' }}
                    onClick={(data: any) => {
                      if (data && data.vesselId && data.closed > 0) {
                        setActiveModal(`vessel_closed_${data.vesselId}` as ModalType);
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white" data-testid="card-top-defect-categories">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Top 10 Defect Categories</span>
              <Activity className="h-5 w-5 text-gray-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {defectCategoryData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[250px] text-gray-400">
                <CheckCircle className="h-12 w-12 mb-2" />
                <p>No defects to display</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={defectCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {defectCategoryData.map((entry, index) => (
                      <Cell key={`cat-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
      </>
      )}

      {activeTab === 'operation' && (
      <Card className="bg-white" data-testid="card-recent-active-defects">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Recent Active Defects</span>
            </CardTitle>
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
                  <TableRow key={defect.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setViewModal({ open: true, defectId: defect.id })}>
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
                          defect.computedStatus.label === 'Extended' ? 'bg-orange-100 text-orange-800' :
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
      )}
      </div>

      <DefectsListModal
        open={activeModal !== null}
        onClose={() => setActiveModal(null)}
        title={getModalTitle()}
        defects={getModalDefects()}
      />

      {viewModal.defectId && (
        <DefectModal
          open={viewModal.open}
          onClose={() => setViewModal({ open: false, defectId: null })}
          defectId={viewModal.defectId}
          mode="view"
        />
      )}
    </div>
  );
}
