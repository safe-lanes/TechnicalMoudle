import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Eye, FileDown, Search } from "lucide-react";
import { formatForDisplay } from "@/lib/dateUtils";
import type { Defect } from "@shared/schema";

interface DefectsFilters {
  period?: string;
  search?: string;
  vesselId?: string;
  fleet?: string;
  addGroup?: string;
  type?: string;
  completionPeriod?: string;
}

export default function DefectsResolved() {
  const [filters, setFilters] = useState<DefectsFilters>({});

  const { data: defects = [], isLoading } = useQuery({
    queryKey: ['/api/defects', { ...filters, statusView: 'resolved' }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('statusView', 'resolved'); // Force resolved filter
      
      if (filters.vesselId) params.append('vesselId', filters.vesselId);
      if (filters.type) params.append('category', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.period) params.append('period', filters.period);
      if (filters.fleet) params.append('fleet', filters.fleet);
      if (filters.addGroup) params.append('group', filters.addGroup);
      if (filters.completionPeriod) params.append('completionPeriod', filters.completionPeriod);
      
      const response = await fetch(`/api/defects?${params}`);
      if (!response.ok) throw new Error('Failed to fetch defects');
      return response.json();
    },
  });

  const getStatusBadge = (status: string) => {
    if (status === 'Closed') {
      return (
        <Badge className="bg-green-100 text-green-700 text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          Closed
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-100 text-gray-600 text-xs">
        Cancelled
      </Badge>
    );
  };

  const getCompletionStatus = (targetDate: string | null, dateCompleted: string | null) => {
    if (!targetDate || !dateCompleted) return null;
    const target = new Date(targetDate);
    const completed = new Date(dateCompleted);
    const diffTime = completed.getTime() - target.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
      return <span className="text-green-600 text-xs">On Time</span>;
    } else {
      return <span className="text-red-600 text-xs">Late ({diffDays} days)</span>;
    }
  };

  const handleFilterChange = (key: keyof DefectsFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export resolved defects');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Resolved Defects
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" className="text-gray-600">
              All Vessel
            </Button>
            <Button variant="outline" size="sm" className="text-gray-600">
              My Vessel
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-gray-600"
              onClick={handleExport}
            >
              <FileDown className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Controls - Include Closed is forced ON */}
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

            {/* Completion Period */}
            <Select value={filters.completionPeriod} onValueChange={(value) => handleFilterChange('completionPeriod', value)}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Completion Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="quarter">Last Quarter</SelectItem>
              </SelectContent>
            </Select>

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

            {/* Include Closed - FORCED ON and disabled for Resolved view */}
            <div className="flex items-center gap-2 opacity-50 cursor-not-allowed">
              <Checkbox 
                disabled
                checked={true}
                className="h-3 w-3" 
              />
              <span className="text-xs text-gray-500">Include Closed Defects</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs px-3">
              Apply
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs px-3"
              onClick={handleClearFilters}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Table - Read-only */}
      <div className="p-6">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading resolved defects...</div>
        ) : defects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No resolved defects found</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearFilters}
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-24">ID</TableHead>
                  <TableHead className="w-32">Vessel</TableHead>
                  <TableHead className="w-28">Issue Date</TableHead>
                  <TableHead className="w-24">Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Action Taken</TableHead>
                  <TableHead className="w-28">Target Date</TableHead>
                  <TableHead className="w-32">Date Completed</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defects.map((defect: Defect) => (
                  <TableRow key={defect.id}>
                    <TableCell className="font-medium text-xs">{defect.id}</TableCell>
                    <TableCell className="text-xs">{defect.vesselName}</TableCell>
                    <TableCell className="text-xs">{formatForDisplay(defect.issueDate)}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-2">
                        {defect.category}
                        {defect.is_coc && (
                          <Badge className="bg-blue-100 text-blue-700 text-xs py-0 px-1">
                            CoC
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{defect.description}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{defect.actionTakenRequested}</TableCell>
                    <TableCell className="text-xs">{formatForDisplay(defect.targetCloseDate)}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col">
                        <span>{formatForDisplay(defect.dateCompleted)}</span>
                        {getCompletionStatus(defect.targetCloseDate, defect.dateCompleted)}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(defect.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0"
                          title="View (Read-only)"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0"
                          title="Export Row"
                        >
                          <FileDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="px-4 py-3 border-t bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-700">
                  Showing {defects.length} resolved defects
                </span>
                <span className="text-xs text-gray-500">
                  Page 1 of 1
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}