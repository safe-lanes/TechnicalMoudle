import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Clock, Eye, Edit, Paperclip, Link, Trash2, Search, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import DefectFormExact from "./DefectFormExact";
import { cn } from "@/lib/utils";
import type { Defect } from "@shared/schema";

interface DefectsFilters {
  period?: string;
  search?: string;
  vesselId?: string;
  fleet?: string;
  addGroup?: string;
  dueOverdue?: string;
  type?: string;
  includeClosedDefects?: boolean;
}

export default function DefectsLog() {
  const [filters, setFilters] = useState<DefectsFilters>({
    includeClosedDefects: false,
  });
  const [showNewDefectForm, setShowNewDefectForm] = useState(false);

  const { data: defects = [], isLoading } = useQuery({
    queryKey: ['/api/defects', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.vesselId) params.append('vesselId', filters.vesselId);
      if (filters.type) params.append('category', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.period) params.append('period', filters.period);
      if (filters.fleet) params.append('fleet', filters.fleet);
      if (filters.addGroup) params.append('group', filters.addGroup);
      if (filters.dueOverdue) params.append('dueOverdue', filters.dueOverdue);
      if (filters.includeClosedDefects) params.append('includeClosedDefects', 'true');
      
      const response = await fetch(`/api/defects?${params}`);
      if (!response.ok) throw new Error('Failed to fetch defects');
      return response.json();
    },
  });

  const getStatusBadge = (status: string, critical: boolean) => {
    if (status === "Closed") {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (critical) {
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
    return <Clock className="h-4 w-4 text-amber-600" />;
  };

  const handleFilterChange = (key: keyof DefectsFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyFilters = () => {
    // Filters are automatically applied via useQuery dependency on filters
  };

  const handleClearFilters = () => {
    setFilters({ includeClosedDefects: false });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center">
                <div className="w-3 h-3 bg-gray-600 rounded"></div>
              </div>
              Defects log
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" className="text-gray-600">
              All Vessel
            </Button>
            <Button variant="outline" size="sm" className="text-gray-600">
              My Vessel
            </Button>
            <Button variant="outline" size="sm" className="text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 border border-gray-400"></div>
                Filters
              </div>
            </Button>
            <Dialog open={showNewDefectForm} onOpenChange={setShowNewDefectForm}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 text-white" size="sm" data-testid="button-new-defect">
                  <Plus className="h-4 w-4 mr-1" />
                  New Defect
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
                <DefectFormExact 
                  onClose={() => setShowNewDefectForm(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Period */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <Select value={filters.period} onValueChange={(value) => handleFilterChange('period', value)}>
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <Input
              placeholder="Search Defect"
              value={filters.search || ""}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-36 h-8 text-xs"
            />

            {/* Vessel */}
            <Select value={filters.vesselId} onValueChange={(value) => handleFilterChange('vesselId', value)}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue placeholder="Vessel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="V001">Vessel 1</SelectItem>
                <SelectItem value="V002">Vessel 2</SelectItem>
              </SelectContent>
            </Select>

            {/* Fleet */}
            <Select value={filters.fleet} onValueChange={(value) => handleFilterChange('fleet', value)}>
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue placeholder="Fleet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fleet1">Fleet 1</SelectItem>
                <SelectItem value="fleet2">Fleet 2</SelectItem>
              </SelectContent>
            </Select>

            {/* Add Group */}
            <Select value={filters.addGroup} onValueChange={(value) => handleFilterChange('addGroup', value)}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue placeholder="Add Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="department">Department</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
              </SelectContent>
            </Select>

            {/* Due/Overdue */}
            <Select value={filters.dueOverdue} onValueChange={(value) => handleFilterChange('dueOverdue', value)}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue placeholder="Due / Overdue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due">Due</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>

            {/* Type */}
            <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Defect">Defect</SelectItem>
                <SelectItem value="COC">COC</SelectItem>
                <SelectItem value="Observation">Observation</SelectItem>
                <SelectItem value="NCR">NCR</SelectItem>
              </SelectContent>
            </Select>

            {/* Apply/Clear buttons */}
            <Button 
              onClick={handleApplyFilters}
              className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-4 text-xs"
            >
              Apply
            </Button>
            <Button 
              onClick={handleClearFilters}
              variant="outline" 
              className="h-8 px-4 text-xs"
            >
              Clear
            </Button>
          </div>

          {/* Include Closed Defects */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeClosedDefects"
              checked={filters.includeClosedDefects}
              onCheckedChange={(checked) => handleFilterChange('includeClosedDefects', checked)}
            />
            <label 
              htmlFor="includeClosedDefects" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Include Closed Defects
            </label>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            {/* Table Header */}
            <div className="bg-sky-100 px-4 py-2 border-b">
              <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-700">
                <div className="col-span-1">ID</div>
                <div className="col-span-1">Vessel</div>
                <div className="col-span-1">Issue Date</div>
                <div className="col-span-1">Category</div>
                <div className="col-span-2">Description</div>
                <div className="col-span-2">Action Taken / Requested</div>
                <div className="col-span-1">Target Date</div>
                <div className="col-span-1">Date Compl.</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-1">Actions</div>
                <div className="col-span-1">Search</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-200">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading defects...</div>
              ) : defects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No defects found</div>
              ) : (
                defects.map((defect: Defect, index: number) => (
                  <div
                    key={defect.id}
                    className={cn(
                      "grid grid-cols-12 gap-4 px-4 py-3 text-xs hover:bg-gray-50",
                      index % 2 === 0 ? "bg-white" : "bg-gray-25"
                    )}
                  >
                    <div className="col-span-1 font-mono text-blue-600">{defect.id}</div>
                    <div className="col-span-1 text-gray-700">{defect.vesselName}</div>
                    <div className="col-span-1 text-gray-700">{defect.issueDate}</div>
                    <div className="col-span-1">
                      <Badge variant={defect.category === 'COC' ? 'destructive' : 'secondary'} className="text-xs">
                        {defect.category}
                      </Badge>
                    </div>
                    <div className="col-span-2 text-gray-700 truncate" title={defect.description}>
                      {defect.description}
                    </div>
                    <div className="col-span-2 text-gray-700 truncate" title={defect.actionTakenRequested || ""}>
                      {defect.actionTakenRequested}
                    </div>
                    <div className="col-span-1 text-gray-700">{defect.targetDate}</div>
                    <div className="col-span-1 text-gray-700">{defect.dateCompleted}</div>
                    <div className="col-span-1 flex items-center gap-1">
                      {getStatusBadge(defect.status, defect.critical)}
                    </div>
                    <div className="col-span-1 flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <Eye className="h-3 w-3 text-gray-500" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <Edit className="h-3 w-3 text-gray-500" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <Paperclip className="h-3 w-3 text-gray-500" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <Link className="h-3 w-3 text-gray-500" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <Trash2 className="h-3 w-3 text-gray-500" />
                      </Button>
                    </div>
                    <div className="col-span-1">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <Search className="h-3 w-3 text-gray-500" />
                      </Button>
                      <span className="text-gray-500 text-xs ml-1">Vessel {defect.vesselId.slice(-2)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 px-2">
          <div className="text-sm text-gray-500">
            {defects.length > 0 ? `0 to 0 of ${defects.length}` : "0 to 0 of 0"}
          </div>
          <div className="text-sm text-gray-500">
            Page 0 of {defects.length > 0 ? 1 : 0}
          </div>
        </div>
      </div>
    </div>
  );
}