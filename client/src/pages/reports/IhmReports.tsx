import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText,
  Download,
  Calendar,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Package,
  Wrench,
  TrendingUp
} from 'lucide-react';
import { FEATURES } from '@/config/features';

interface IhmSummary {
  totalComponents: number;
  knownStatus: number;
  unknownStatus: number;
  withIHM: number;
  withoutIHM: number;
  lastUpdated: string;
}

interface IhmMaterial {
  material: string;
  count: number;
  totalWeight: string;
  percentage: number;
}

const IhmReports = () => {
  const [reportType, setReportType] = useState("summary");
  const [dateRange, setDateRange] = useState("last30days");

  // Mock data - in real implementation, fetch from API
  const summary: IhmSummary = {
    totalComponents: 1247,
    knownStatus: 892,
    unknownStatus: 355,
    withIHM: 187,
    withoutIHM: 705,
    lastUpdated: "2025-01-02"
  };

  const materials: IhmMaterial[] = [
    { material: "Asbestos", count: 45, totalWeight: "125.5 kg", percentage: 24 },
    { material: "PCB", count: 32, totalWeight: "78.2 kg", percentage: 17 },
    { material: "PFOS", count: 28, totalWeight: "45.3 kg", percentage: 15 },
    { material: "Lead", count: 52, totalWeight: "210.8 kg", percentage: 28 },
    { material: "Mercury", count: 12, totalWeight: "3.5 kg", percentage: 6 },
    { material: "Ozone Depleting Substances", count: 18, totalWeight: "22.1 kg", percentage: 10 }
  ];

  const recentChanges = [
    {
      date: "2025-01-02",
      action: "Removed",
      component: "ME-COMP-001",
      material: "Asbestos",
      quantity: "5.2 kg",
      user: "Chief Engineer"
    },
    {
      date: "2025-01-01",
      action: "Installed",
      component: "AUX-COMP-045",
      material: "PCB",
      quantity: "2.1 kg",
      user: "2nd Engineer"
    },
    {
      date: "2024-12-30",
      action: "Replaced",
      component: "ELEC-COMP-012",
      material: "Lead",
      quantity: "8.7 kg",
      user: "3rd Engineer"
    }
  ];

  if (!FEATURES.IHM) {
    return (
      <div className="p-6 bg-[#fafafa] h-full">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">IHM Reports Not Available</h2>
          <p className="text-gray-500">IHM feature is currently disabled. Contact your administrator to enable this feature.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#fafafa] h-full overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-800">IHM Reports</h1>
          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Last Updated: {summary.lastUpdated}
            </Button>
            <Button className="bg-[#52baf3] hover:bg-[#40a8e0] text-white flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Report Type Selection */}
        <div className="flex gap-4 items-center">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">IHM Summary</SelectItem>
              <SelectItem value="materials">Materials Breakdown</SelectItem>
              <SelectItem value="changes">Recent Changes</SelectItem>
              <SelectItem value="compliance">Compliance Status</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last7days">Last 7 Days</SelectItem>
              <SelectItem value="last30days">Last 30 Days</SelectItem>
              <SelectItem value="last90days">Last 90 Days</SelectItem>
              <SelectItem value="thisYear">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <Package className="h-5 w-5 text-blue-500" />
            <span className="text-xs text-gray-500">Total</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{summary.totalComponents}</div>
          <div className="text-xs text-gray-600">Components</div>
        </Card>

        <Card className="p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-xs text-gray-500">Known</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{summary.knownStatus}</div>
          <div className="text-xs text-gray-600">Status Known</div>
        </Card>

        <Card className="p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <HelpCircle className="h-5 w-5 text-gray-400" />
            <span className="text-xs text-gray-500">Unknown</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{summary.unknownStatus}</div>
          <div className="text-xs text-gray-600">Status Unknown</div>
        </Card>

        <Card className="p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-xs text-gray-500">With IHM</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{summary.withIHM}</div>
          <div className="text-xs text-gray-600">Contains HazMat</div>
        </Card>

        <Card className="p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-xs text-gray-500">Without IHM</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{summary.withoutIHM}</div>
          <div className="text-xs text-gray-600">No HazMat</div>
        </Card>
      </div>

      {/* Materials Breakdown */}
      <Card className="p-6 bg-white mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[#52baf3]" />
          Hazardous Materials Distribution
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Material</th>
                <th className="text-center py-2 px-3 text-sm font-medium text-gray-700">Components</th>
                <th className="text-center py-2 px-3 text-sm font-medium text-gray-700">Total Weight</th>
                <th className="text-center py-2 px-3 text-sm font-medium text-gray-700">Percentage</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((mat, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-3 text-sm text-gray-900">{mat.material}</td>
                  <td className="py-3 px-3 text-sm text-center text-gray-700">{mat.count}</td>
                  <td className="py-3 px-3 text-sm text-center text-gray-700">{mat.totalWeight}</td>
                  <td className="py-3 px-3 text-sm text-center text-gray-700">{mat.percentage}%</td>
                  <td className="py-3 px-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-[#52baf3] h-2 rounded-full"
                        style={{ width: `${mat.percentage}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent Changes */}
      <Card className="p-6 bg-white">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Wrench className="h-5 w-5 text-[#52baf3]" />
          Recent IHM Changes
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Date</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Action</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Component</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Material</th>
                <th className="text-center py-2 px-3 text-sm font-medium text-gray-700">Quantity</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Performed By</th>
              </tr>
            </thead>
            <tbody>
              {recentChanges.map((change, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-3 text-sm text-gray-700">{change.date}</td>
                  <td className="py-3 px-3">
                    <span className={`text-sm px-2 py-1 rounded-full ${
                      change.action === 'Removed' ? 'bg-red-100 text-red-700' :
                      change.action === 'Installed' ? 'bg-green-100 text-green-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {change.action}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-900">{change.component}</td>
                  <td className="py-3 px-3 text-sm text-gray-700">{change.material}</td>
                  <td className="py-3 px-3 text-sm text-center text-gray-700">{change.quantity}</td>
                  <td className="py-3 px-3 text-sm text-gray-700">{change.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default IhmReports;