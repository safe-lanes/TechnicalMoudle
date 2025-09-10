import React from "react";
import { 
  LayoutDashboard, 
  Package, 
  ClipboardList, 
  Clock, 
  Archive, 
  Store,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Calendar,
  Settings,
  FileText
} from "lucide-react";

const Dashboard: React.FC = () => {
  // Mock data for demonstration - in real app this would come from API
  const dashboardData = {
    overview: {
      totalComponents: 1247,
      activeWorkOrders: 23,
      overdueTasks: 8,
      completedThisMonth: 156
    },
    workOrders: {
      pending: 15,
      inProgress: 8,
      completed: 156,
      overdue: 8
    },
    inventory: {
      sparesTotal: 423,
      sparesLow: 12,
      storesTotal: 198,
      storesLow: 5
    },
    maintenance: {
      upcomingWeek: 12,
      upcomingMonth: 45,
      critical: 3,
      routine: 42
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color = "blue",
    change,
    changeType = "positive"
  }: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    color?: "blue" | "green" | "yellow" | "red" | "gray";
    change?: string;
    changeType?: "positive" | "negative" | "neutral";
  }) => {
    const colorClasses: Record<string, string> = {
      blue: "bg-blue-50 text-blue-600 border-blue-200",
      green: "bg-green-50 text-green-600 border-green-200",
      yellow: "bg-yellow-50 text-yellow-600 border-yellow-200",
      red: "bg-red-50 text-red-600 border-red-200",
      gray: "bg-gray-50 text-gray-600 border-gray-200"
    };

    const changeColors = {
      positive: "text-green-600",
      negative: "text-red-600",
      neutral: "text-gray-600"
    };

    return (
      <div className="bg-white rounded-lg border shadow-sm p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {change && (
              <p className={`text-sm ${changeColors[changeType]} flex items-center mt-1`}>
                <TrendingUp className="h-3 w-3 mr-1" />
                {change}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center mb-2">
          <LayoutDashboard className="h-8 w-8 text-[#52baf3] mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">PMS Dashboard</h1>
        </div>
        <p className="text-gray-600">Planned Maintenance System Overview</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Components"
          value={dashboardData.overview.totalComponents.toLocaleString()}
          icon={Package}
          color="blue"
          change="+5% this month"
          changeType="positive"
        />
        <StatCard
          title="Active Work Orders"
          value={dashboardData.overview.activeWorkOrders}
          icon={ClipboardList}
          color="green"
          change="-12% from last month"
          changeType="positive"
        />
        <StatCard
          title="Overdue Tasks"
          value={dashboardData.overview.overdueTasks}
          icon={AlertTriangle}
          color="red"
          change="+2 this week"
          changeType="negative"
        />
        <StatCard
          title="Completed This Month"
          value={dashboardData.overview.completedThisMonth}
          icon={CheckCircle}
          color="green"
          change="+18% vs last month"
          changeType="positive"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Work Orders Status */}
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center mb-4">
            <ClipboardList className="h-5 w-5 text-[#52baf3] mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Work Orders Status</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="font-medium text-blue-900">Pending</span>
              <span className="text-2xl font-bold text-blue-600">{dashboardData.workOrders.pending}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <span className="font-medium text-yellow-900">In Progress</span>
              <span className="text-2xl font-bold text-yellow-600">{dashboardData.workOrders.inProgress}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="font-medium text-green-900">Completed</span>
              <span className="text-2xl font-bold text-green-600">{dashboardData.workOrders.completed}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <span className="font-medium text-red-900">Overdue</span>
              <span className="text-2xl font-bold text-red-600">{dashboardData.workOrders.overdue}</span>
            </div>
          </div>
        </div>

        {/* Inventory Overview */}
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center mb-4">
            <Archive className="h-5 w-5 text-[#52baf3] mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Inventory Overview</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Store className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">Spares</p>
              <p className="text-xl font-bold text-gray-900">{dashboardData.inventory.sparesTotal}</p>
              <p className="text-xs text-red-600">{dashboardData.inventory.sparesLow} Low Stock</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Package className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">Stores</p>
              <p className="text-xl font-bold text-gray-900">{dashboardData.inventory.storesTotal}</p>
              <p className="text-xs text-red-600">{dashboardData.inventory.storesLow} Low Stock</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming Maintenance */}
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center mb-4">
            <Calendar className="h-5 w-5 text-[#52baf3] mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Maintenance</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-gray-600">Next 7 days</span>
              <span className="font-semibold text-gray-900">{dashboardData.maintenance.upcomingWeek} tasks</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-gray-600">Next 30 days</span>
              <span className="font-semibold text-gray-900">{dashboardData.maintenance.upcomingMonth} tasks</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-gray-600">Critical</span>
              <span className="font-semibold text-red-600">{dashboardData.maintenance.critical} tasks</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Routine</span>
              <span className="font-semibold text-green-600">{dashboardData.maintenance.routine} tasks</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center mb-4">
            <Settings className="h-5 w-5 text-[#52baf3] mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="space-y-3">
            <button className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
              <div className="flex items-center">
                <ClipboardList className="h-4 w-4 text-blue-600 mr-3" />
                <span className="text-sm font-medium text-blue-900">Create Work Order</span>
              </div>
            </button>
            <button className="w-full text-left p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
              <div className="flex items-center">
                <Package className="h-4 w-4 text-green-600 mr-3" />
                <span className="text-sm font-medium text-green-900">Add Component</span>
              </div>
            </button>
            <button className="w-full text-left p-3 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors">
              <div className="flex items-center">
                <Clock className="h-4 w-4 text-yellow-600 mr-3" />
                <span className="text-sm font-medium text-yellow-900">Update Running Hours</span>
              </div>
            </button>
            <button className="w-full text-left p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
              <div className="flex items-center">
                <FileText className="h-4 w-4 text-purple-600 mr-3" />
                <span className="text-sm font-medium text-purple-900">Generate Report</span>
              </div>
            </button>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center mb-4">
            <CheckCircle className="h-5 w-5 text-[#52baf3] mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Database</span>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium text-green-600">Online</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Backup</span>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium text-green-600">Updated</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Sync Status</span>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium text-green-600">Synced</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last Update</span>
              <span className="text-sm font-medium text-gray-900">2 min ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;