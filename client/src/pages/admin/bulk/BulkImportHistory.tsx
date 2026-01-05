import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Search,
  Eye,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  Ship,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { useVessels } from "@/hooks/useVessels";
import type { BulkImportHistory as BulkImportHistoryType, BulkImportError } from "@shared/schema";

interface BulkImportHistoryProps {
  vesselId?: string;
  moduleType?: string;
}

export default function BulkImportHistory({ vesselId, moduleType }: BulkImportHistoryProps) {
  const { data: vessels = [] } = useVessels();
  const [selectedVessel, setSelectedVessel] = useState<string>(vesselId || 'all');
  const [selectedModule, setSelectedModule] = useState<string>(moduleType || 'all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [selectedImport, setSelectedImport] = useState<BulkImportHistoryType | null>(null);
  const pageSize = 20;

  const queryParams = new URLSearchParams();
  if (selectedVessel && selectedVessel !== 'all') queryParams.set('vesselCode', selectedVessel);
  if (selectedModule && selectedModule !== 'all') queryParams.set('moduleType', selectedModule);
  if (selectedStatus && selectedStatus !== 'all') queryParams.set('status', selectedStatus);
  queryParams.set('limit', pageSize.toString());
  queryParams.set('offset', (page * pageSize).toString());

  const { data: historyData, isLoading, refetch } = useQuery<{ items: BulkImportHistoryType[], total: number }>({
    queryKey: ['/technical/api/fleet-admin/import-history', selectedVessel, selectedModule, selectedStatus, page],
    queryFn: async () => {
      const response = await fetch(`/technical/api/fleet-admin/import-history?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch import history');
      return response.json();
    }
  });

  const { data: selectedImportErrors, isLoading: isLoadingErrors } = useQuery<BulkImportError[]>({
    queryKey: ['/technical/api/fleet-admin/import-history', selectedImport?.id, 'errors'],
    queryFn: async () => {
      const response = await fetch(`/technical/api/fleet-admin/import-history/${selectedImport?.id}/errors`);
      if (!response.ok) throw new Error('Failed to fetch import errors');
      return response.json();
    },
    enabled: !!selectedImport
  });

  const filteredHistory = (historyData?.items || []).filter(item =>
    searchTerm === '' ||
    item.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.vesselCode && item.vesselCode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const moduleTypes = [
    { value: 'all', label: 'All Modules' },
    { value: 'machinery', label: 'Machinery Components' },
    { value: 'jobs', label: 'Jobs' },
    { value: 'spares', label: 'Spares' },
    { value: 'stores', label: 'Stores' },
    { value: 'fleet-component', label: 'Fleet Components' },
    { value: 'fleet-jobs', label: 'Fleet Jobs' },
    { value: 'fleet-spares', label: 'Fleet Spares' },
    { value: 'maker-list', label: 'Maker List' },
    { value: 'master-data', label: 'Master Data' },
    { value: 'master-list', label: 'Master Lists' },
  ];

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'completed', label: 'Completed' },
    { value: 'partial', label: 'Partial Success' },
    { value: 'failed', label: 'Failed' },
    { value: 'processing', label: 'Processing' },
  ];

  const getStatusBadge = (status: string, successCount: number, failedCount: number) => {
    if (status === 'processing') {
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><Clock className="h-3 w-3 mr-1" />Processing</Badge>;
    }
    if (failedCount === 0 && successCount > 0) {
      return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
    }
    if (successCount === 0 && failedCount > 0) {
      return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    }
    if (successCount > 0 && failedCount > 0) {
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200"><AlertTriangle className="h-3 w-3 mr-1" />Partial</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Unknown</Badge>;
  };

  const getModuleLabel = (moduleType: string) => {
    const module = moduleTypes.find(m => m.value === moduleType);
    return module?.label || moduleType;
  };

  const totalPages = Math.ceil((historyData?.total || 0) / pageSize);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-sky-600" />
              Bulk Import History
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-history">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by file name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-history"
              />
            </div>
            
            <Select value={selectedVessel} onValueChange={setSelectedVessel}>
              <SelectTrigger className="w-48" data-testid="select-vessel-filter">
                <Ship className="h-4 w-4 mr-2 text-gray-500" />
                <SelectValue placeholder="Filter by vessel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels</SelectItem>
                {vessels.map((vessel) => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    {vessel.id} - {vessel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedModule} onValueChange={setSelectedModule}>
              <SelectTrigger className="w-52" data-testid="select-module-filter">
                <FileSpreadsheet className="h-4 w-4 mr-2 text-gray-500" />
                <SelectValue placeholder="Filter by module" />
              </SelectTrigger>
              <SelectContent>
                {moduleTypes.map((module) => (
                  <SelectItem key={module.value} value={module.value}>
                    {module.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-44" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No import history found</p>
              <p className="text-sm text-gray-400 mt-1">
                Import records will appear here after you upload files
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Date/Time</TableHead>
                      <TableHead>File Name</TableHead>
                      <TableHead>Vessel</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead className="text-center">Success</TableHead>
                      <TableHead className="text-center">Failed</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((item) => (
                      <TableRow key={item.id} className="hover:bg-gray-50" data-testid={`row-import-${item.id}`}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {format(new Date(item.uploadedAt!), 'MMM dd, yyyy HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate" title={item.fileName}>
                          {item.fileName}
                        </TableCell>
                        <TableCell>
                          {item.vesselCode ? (
                            <span className="text-sm">{item.vesselCode}</span>
                          ) : (
                            <span className="text-gray-400 text-sm">Fleet</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getModuleLabel(item.moduleType)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-green-600 font-medium">{item.successCount}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={item.failedCount > 0 ? "text-red-600 font-medium" : "text-gray-400"}>
                            {item.failedCount}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(item.status, item.successCount, item.failedCount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedImport(item)}
                                data-testid={`button-view-import-${item.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                              <DialogHeader>
                                <DialogTitle>Import Details: {item.fileName}</DialogTitle>
                              </DialogHeader>
                              <div className="flex-1 overflow-auto">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                                  <div>
                                    <p className="text-xs text-gray-500 uppercase">Module</p>
                                    <p className="font-medium">{getModuleLabel(item.moduleType)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 uppercase">Vessel</p>
                                    <p className="font-medium">{item.vesselCode || 'Fleet-wide'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 uppercase">Uploaded By</p>
                                    <p className="font-medium">{item.uploadedBy || 'System'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 uppercase">Date/Time</p>
                                    <p className="font-medium">
                                      {format(new Date(item.uploadedAt!), 'MMM dd, yyyy HH:mm:ss')}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4 mb-6">
                                  <Card className="border-green-200 bg-green-50">
                                    <CardContent className="p-4 text-center">
                                      <CheckCircle2 className="h-8 w-8 mx-auto text-green-600 mb-2" />
                                      <p className="text-2xl font-bold text-green-700">{item.successCount}</p>
                                      <p className="text-sm text-green-600">Successful Rows</p>
                                    </CardContent>
                                  </Card>
                                  <Card className="border-red-200 bg-red-50">
                                    <CardContent className="p-4 text-center">
                                      <XCircle className="h-8 w-8 mx-auto text-red-600 mb-2" />
                                      <p className="text-2xl font-bold text-red-700">{item.failedCount}</p>
                                      <p className="text-sm text-red-600">Failed Rows</p>
                                    </CardContent>
                                  </Card>
                                  <Card className="border-blue-200 bg-blue-50">
                                    <CardContent className="p-4 text-center">
                                      <FileSpreadsheet className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                                      <p className="text-2xl font-bold text-blue-700">
                                        {item.successCount + item.failedCount}
                                      </p>
                                      <p className="text-sm text-blue-600">Total Rows</p>
                                    </CardContent>
                                  </Card>
                                </div>

                                {item.failedCount > 0 && (
                                  <div>
                                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                                      Error Details
                                    </h3>
                                    {isLoadingErrors ? (
                                      <div className="space-y-2">
                                        {[1, 2, 3].map((i) => (
                                          <Skeleton key={i} className="h-12 w-full" />
                                        ))}
                                      </div>
                                    ) : (selectedImportErrors?.length || 0) === 0 ? (
                                      <p className="text-gray-500 text-center py-6">
                                        No detailed error information available
                                      </p>
                                    ) : (
                                      <div className="rounded-lg border overflow-hidden max-h-[300px] overflow-y-auto">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-gray-50">
                                              <TableHead className="w-20">Row</TableHead>
                                              <TableHead>Field</TableHead>
                                              <TableHead>Error</TableHead>
                                              <TableHead>Recommended Fix</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {selectedImportErrors?.map((error) => (
                                              <TableRow key={error.id} className="text-sm" data-testid={`row-error-${error.id}`}>
                                                <TableCell className="font-mono text-red-600">
                                                  {error.rowNumber}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                  {error.fieldName}
                                                </TableCell>
                                                <TableCell className="text-red-600">
                                                  {error.errorDescription}
                                                </TableCell>
                                                <TableCell className="text-green-700">
                                                  {error.recommendedFix || '-'}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, historyData?.total || 0)} of {historyData?.total || 0} records
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600 px-2">
                    Page {page + 1} of {Math.max(1, totalPages)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages - 1}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
