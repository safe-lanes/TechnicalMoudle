import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useVessel } from "@/contexts/VesselContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, X, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface Spare {
  id: number;
  partCode: string;
  partName: string;
  component?: string;
  rob: number;
  min: number;
  robLocationA?: number;
  robLocationB?: number;
  location?: string;
  location2?: string;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function BulkUpdateSpares() {
  const [, setLocation] = useLocation();
  const { vesselId } = useVessel();
  const { toast } = useToast();
  
  const [bulkSearchQuery, setBulkSearchQuery] = useState("");
  const [bulkUpdateData, setBulkUpdateData] = useState<{[key: number]: {consumedA: number, consumedB: number, receivedA: number, receivedB: number, receivedDate?: string, receivedPlace?: string, comments?: string}}>({});
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const { data: sparesData = [], isLoading } = useQuery({
    queryKey: ['/technical/api/inventory/spares-with-inventory', vesselId],
    queryFn: async () => {
      const response = await fetch(`/technical/api/inventory/spares-with-inventory/${vesselId}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!vesselId
  });

  const { data: locationNamesData } = useQuery({
    queryKey: [`/technical/api/vessel-location-names/${vesselId}`],
    queryFn: async () => {
      const response = await fetch(`/technical/api/vessel-location-names/${vesselId}`);
      if (!response.ok) return { locationAName: 'Location A', locationBName: 'Location B' };
      return response.json();
    },
    enabled: !!vesselId
  });

  const locationNames = {
    locationA: locationNamesData?.locationAName || 'Location A',
    locationB: locationNamesData?.locationBName || 'Location B'
  };

  const filteredSpares = useMemo(() => {
    if (!sparesData || !Array.isArray(sparesData)) return [];
    const spares = sparesData as Spare[];
    if (!bulkSearchQuery) return spares;
    
    const query = bulkSearchQuery.toLowerCase();
    return spares.filter(spare => 
      spare.partCode?.toLowerCase().includes(query) ||
      spare.partName?.toLowerCase().includes(query) ||
      spare.component?.toLowerCase().includes(query)
    );
  }, [sparesData, bulkSearchQuery]);

  const totalPages = Math.ceil(filteredSpares.length / itemsPerPage);
  
  const paginatedSpares = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSpares.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSpares, currentPage, itemsPerPage]);

  useEffect(() => {
    const initialData: {[key: number]: {consumedA: number, consumedB: number, receivedA: number, receivedB: number}} = {};
    const spares = Array.isArray(sparesData) ? sparesData : [];
    spares.forEach((spare: Spare) => {
      initialData[spare.id] = { consumedA: 0, consumedB: 0, receivedA: 0, receivedB: 0 };
    });
    setBulkUpdateData(initialData);
  }, [sparesData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [bulkSearchQuery, itemsPerPage]);

  const handleBulkUpdateChange = (spareId: number, field: 'consumedA' | 'consumedB' | 'receivedA' | 'receivedB' | 'receivedDate' | 'receivedPlace' | 'comments', value: string | number) => {
    if (field === 'receivedDate' || field === 'receivedPlace' || field === 'comments') {
      setBulkUpdateData(prev => ({
        ...prev,
        [spareId]: { ...prev[spareId], [field]: value }
      }));
    } else {
      const numValue = parseInt(String(value)) || 0;
      setBulkUpdateData(prev => ({
        ...prev,
        [spareId]: { ...prev[spareId], [field]: numValue }
      }));
    }
  };

  const bulkUpdateMutation = useMutation({
    mutationFn: async (payload: { vesselId: string, tz: string, rows: any[] }) => {
      const response = await apiRequest('POST', '/technical/api/spares/bulk-update', payload);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/inventory/spares-with-inventory', vesselId] });
      toast({ title: "Success", description: "Bulk update completed successfully" });
      setLocation("/spares");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update spares", variant: "destructive" });
    }
  });

  const handleSaveBulkUpdates = async () => {
    const sparesArray = Array.isArray(sparesData) ? sparesData : [];
    const hasErrors = Object.entries(bulkUpdateData).some(([id, data]) => {
      const spare = sparesArray.find((s: Spare) => s.id === Number(id));
      if (!spare) return false;
      const robA = spare.robLocationA ?? 0;
      const robB = spare.robLocationB ?? 0;
      const totalReceived = (data.receivedA || 0) + (data.receivedB || 0);
      const totalConsumed = (data.consumedA || 0) + (data.consumedB || 0);
      const hasAnyTransaction = totalReceived > 0 || totalConsumed > 0;
      return (data.consumedA > robA) || (data.consumedB > robB) || (hasAnyTransaction && !data.receivedDate);
    });

    if (hasErrors) {
      toast({ title: "Validation Error", description: "Please fix all errors before saving", variant: "destructive" });
      return;
    }

    const rows = Object.entries(bulkUpdateData)
      .filter(([_, data]) => data.consumedA > 0 || data.consumedB > 0 || data.receivedA > 0 || data.receivedB > 0)
      .map(([id, data]) => {
        const spare = (sparesData as Spare[]).find(s => s.id === Number(id));
        return {
          componentSpareId: Number(id),
          spareId: spare?.id,
          partCode: spare?.partCode,
          consumedA: data.consumedA || 0,
          consumedB: data.consumedB || 0,
          receivedA: data.receivedA || 0,
          receivedB: data.receivedB || 0,
          receivedDate: data.receivedDate,
          receivedPlace: data.receivedPlace,
          remarks: data.comments,
          userId: 'user'
        };
      });

    if (rows.length === 0) {
      toast({ title: "No Changes", description: "No updates to save", variant: "default" });
      return;
    }

    bulkUpdateMutation.mutate({ vesselId, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, rows });
  };

  const hasAnyChanges = Object.values(bulkUpdateData).some(data => 
    data.consumedA > 0 || data.consumedB > 0 || data.receivedA > 0 || data.receivedB > 0
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading spares...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLocation("/spares")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Spares
            </Button>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Bulk Update Spares</h1>
          </div>
          <div className="text-sm text-gray-500">
            Updating {filteredSpares.length} spare(s) {bulkSearchQuery && `(filtered)`}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-6 py-4 flex flex-col">
        <div className="w-full flex flex-col flex-1 min-h-0 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search by part code, name, component..."
                  value={bulkSearchQuery}
                  onChange={(e) => setBulkSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-bulk-search"
                />
                {bulkSearchQuery && (
                  <button 
                    onClick={() => setBulkSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <Label htmlFor="bulk-received-date">Transaction Date (Apply to all)</Label>
              <Input
                id="bulk-received-date"
                type="date"
                data-testid="input-bulk-transaction-date"
                onChange={(e) => {
                  const date = e.target.value;
                  setBulkUpdateData(prev => {
                    const updated = { ...prev };
                    Object.keys(updated).forEach(id => {
                      updated[Number(id)] = { ...updated[Number(id)], receivedDate: date };
                    });
                    return updated;
                  });
                }}
              />
            </div>
            <div>
              <Label htmlFor="bulk-received-place">Received Place (Apply to all)</Label>
              <Input
                id="bulk-received-place"
                type="text"
                placeholder="e.g., Singapore Port"
                data-testid="input-bulk-received-place"
                onChange={(e) => {
                  const place = e.target.value;
                  setBulkUpdateData(prev => {
                    const updated = { ...prev };
                    Object.keys(updated).forEach(id => {
                      updated[Number(id)] = { ...updated[Number(id)], receivedPlace: place };
                    });
                    return updated;
                  });
                }}
              />
            </div>
            <div>
              <Label htmlFor="bulk-comments">Comments (Apply to all)</Label>
              <Input
                id="bulk-comments"
                type="text"
                placeholder="Enter comments"
                data-testid="input-bulk-comments"
                onChange={(e) => {
                  const comments = e.target.value;
                  setBulkUpdateData(prev => {
                    const updated = { ...prev };
                    Object.keys(updated).forEach(id => {
                      updated[Number(id)] = { ...updated[Number(id)], comments: comments };
                    });
                    return updated;
                  });
                }}
              />
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-800 flex flex-col flex-1 min-h-0">
            <div className="overflow-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium">Part Code</th>
                    <th className="px-3 py-2 text-left text-xs font-medium">Part Name</th>
                    <th className="px-2 py-2 text-center text-xs font-medium" colSpan={2}>
                      <div className="text-center">ROB</div>
                      <div className="flex justify-center gap-4 text-[10px] mt-1">
                        <span className="font-semibold text-blue-600" data-testid="label-rob-location-a">{locationNames.locationA}</span>
                        <span className="font-semibold text-blue-600" data-testid="label-rob-location-b">{locationNames.locationB}</span>
                      </div>
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium border-l" colSpan={2}>
                      <div className="text-center text-orange-600">Consumed</div>
                      <div className="flex justify-center gap-4 text-[10px] mt-1">
                        <span className="font-semibold text-blue-600" data-testid="label-consumed-location-a">{locationNames.locationA}</span>
                        <span className="font-semibold text-blue-600" data-testid="label-consumed-location-b">{locationNames.locationB}</span>
                      </div>
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium border-l" colSpan={2}>
                      <div className="text-center text-green-600">Received</div>
                      <div className="flex justify-center gap-4 text-[10px] mt-1">
                        <span className="font-semibold text-blue-600" data-testid="label-received-location-a">{locationNames.locationA}</span>
                        <span className="font-semibold text-blue-600" data-testid="label-received-location-b">{locationNames.locationB}</span>
                      </div>
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium border-l">New ROB</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSpares.map((spare: Spare) => {
                    const consumedA = bulkUpdateData[spare.id]?.consumedA || 0;
                    const consumedB = bulkUpdateData[spare.id]?.consumedB || 0;
                    const receivedA = bulkUpdateData[spare.id]?.receivedA || 0;
                    const receivedB = bulkUpdateData[spare.id]?.receivedB || 0;
                    const robA = spare.robLocationA ?? 0;
                    const robB = spare.robLocationB ?? 0;
                    const newRobA = robA - consumedA + receivedA;
                    const newRobB = robB - consumedB + receivedB;
                    const newROB = newRobA + newRobB;
                    const hasInsufficientStockA = consumedA > robA;
                    const hasInsufficientStockB = consumedB > robB;
                    const totalReceived = receivedA + receivedB;
                    const totalConsumed = consumedA + consumedB;
                    const hasAnyTransaction = totalReceived > 0 || totalConsumed > 0;
                    const needsTransactionDate = hasAnyTransaction && !bulkUpdateData[spare.id]?.receivedDate;
                    const hasError = hasInsufficientStockA || hasInsufficientStockB || needsTransactionDate;
                    
                    const spareLocA = spare.location || locationNames.locationA;
                    const spareLocB = spare.location2 || locationNames.locationB;
                    
                    return (
                      <tr key={spare.id} className={`border-t ${hasError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                        <td className="px-3 py-2 text-sm">{spare.partCode}</td>
                        <td className="px-3 py-2 text-sm max-w-[150px] truncate" title={spare.partName}>{spare.partName}</td>
                        <td className="px-2 py-2 text-center">
                          <div className="text-[9px] text-gray-500 truncate max-w-[60px]" title={spareLocA}>{spareLocA}</div>
                          <div className="text-xs text-gray-600 font-medium">{robA}</div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className="text-[9px] text-gray-500 truncate max-w-[60px]" title={spareLocB}>{spareLocB}</div>
                          <div className="text-xs text-gray-600 font-medium">{robB}</div>
                        </td>
                        <td className="px-1 py-2 border-l">
                          <div className="text-[9px] text-gray-500 truncate max-w-[56px] text-center" title={spareLocA}>{spareLocA}</div>
                          <Input
                            type="number"
                            min="0"
                            max={robA}
                            value={bulkUpdateData[spare.id]?.consumedA || ""}
                            onChange={(e) => handleBulkUpdateChange(spare.id, 'consumedA', e.target.value)}
                            className={`w-14 h-7 text-sm text-center ${hasInsufficientStockA ? 'border-red-500' : ''}`}
                            data-testid={`input-consume-a-${spare.id}`}
                          />
                        </td>
                        <td className="px-1 py-2">
                          <div className="text-[9px] text-gray-500 truncate max-w-[56px] text-center" title={spareLocB}>{spareLocB}</div>
                          <Input
                            type="number"
                            min="0"
                            max={robB}
                            value={bulkUpdateData[spare.id]?.consumedB || ""}
                            onChange={(e) => handleBulkUpdateChange(spare.id, 'consumedB', e.target.value)}
                            className={`w-14 h-7 text-sm text-center ${hasInsufficientStockB ? 'border-red-500' : ''}`}
                            data-testid={`input-consume-b-${spare.id}`}
                          />
                        </td>
                        <td className="px-1 py-2 border-l">
                          <div className="text-[9px] text-gray-500 truncate max-w-[56px] text-center" title={spareLocA}>{spareLocA}</div>
                          <Input
                            type="number"
                            min="0"
                            value={bulkUpdateData[spare.id]?.receivedA || ""}
                            onChange={(e) => handleBulkUpdateChange(spare.id, 'receivedA', e.target.value)}
                            className="w-14 h-7 text-sm text-center"
                            data-testid={`input-receive-a-${spare.id}`}
                          />
                        </td>
                        <td className="px-1 py-2">
                          <div className="text-[9px] text-gray-500 truncate max-w-[56px] text-center" title={spareLocB}>{spareLocB}</div>
                          <Input
                            type="number"
                            min="0"
                            value={bulkUpdateData[spare.id]?.receivedB || ""}
                            onChange={(e) => handleBulkUpdateChange(spare.id, 'receivedB', e.target.value)}
                            className="w-14 h-7 text-sm text-center"
                            data-testid={`input-receive-b-${spare.id}`}
                          />
                        </td>
                        <td className="px-2 py-2 text-center border-l">
                          <div className={`text-sm font-medium ${hasError ? 'text-red-600' : ''}`}>
                            {newROB}
                            {(hasInsufficientStockA || hasInsufficientStockB) && (
                              <div className="text-[10px] text-red-600">Insufficient</div>
                            )}
                            {needsTransactionDate && (
                              <div className="text-[10px] text-red-600">Date required</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 dark:bg-gray-700">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="border rounded px-2 py-1 text-sm"
                  data-testid="select-items-per-page"
                >
                  {ITEMS_PER_PAGE_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <span className="text-sm text-gray-600 dark:text-gray-300">per page</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredSpares.length)} of {filteredSpares.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      data-testid={`button-page-${pageNum}`}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border-t px-6 py-4">
        <div className="w-full flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={() => setLocation("/spares")}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveBulkUpdates}
            disabled={!hasAnyChanges || bulkUpdateMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
            data-testid="button-save-updates"
          >
            {bulkUpdateMutation.isPending ? "Saving..." : "Save Updates"}
          </Button>
        </div>
      </div>
    </div>
  );
}
