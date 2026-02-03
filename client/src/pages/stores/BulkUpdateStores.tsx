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

interface StoreItem {
  id: number;
  itemCode: string;
  itemName: string;
  storesCategory: string;
  uom?: string;
  rob: number;
  min: number;
  stock: string;
  location: string;
  location2?: string;
  category: "stores" | "lubes" | "chemicals" | "others";
  robLocationA?: number;
  robLocationB?: number;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function BulkUpdateStores() {
  const [, setLocation] = useLocation();
  const { vesselId } = useVessel();
  const { toast } = useToast();
  
  const searchParams = new URLSearchParams(window.location.search);
  const tabParam = searchParams.get('tab') as "stores" | "lubes" | "chemicals" | "others" | null;
  const activeTab = tabParam || "stores";
  
  const [bulkSearchQuery, setBulkSearchQuery] = useState("");
  const [dateReceived, setDateReceived] = useState("");
  const [placeReceived, setPlaceReceived] = useState("");
  const [bulkUpdateData, setBulkUpdateData] = useState<{[key: number]: {consumedLocationA: number, consumedLocationB: number, receivedLocationA: number, receivedLocationB: number, comments?: string}}>({});
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const { data: storesData = [], isLoading } = useQuery({
    queryKey: [`/technical/api/stores/${vesselId}?itemType=${activeTab}`],
    queryFn: async () => {
      const response = await fetch(`/technical/api/stores/${vesselId}?itemType=${activeTab}`);
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

  const items = useMemo(() => {
    if (!storesData || !Array.isArray(storesData)) return [];
    // Backend already filters by itemType via query param, no need to filter again
    return (storesData as any[]).map((item: any) => ({
      id: item.id,
      itemCode: item.itemCode || '',
      itemName: item.itemName || '',
      storesCategory: item.storesCategory || item.category || '',
      uom: item.uom,
      rob: (parseFloat(item.robLocationA) || 0) + (parseFloat(item.robLocationB) || 0),
      min: parseFloat(item.min) ?? 0,
      stock: 'OK',
      location: item.location || item.locationA || '',
      location2: item.location2 || item.locationB || '',
      category: item.itemType || 'stores',
      robLocationA: parseFloat(item.robLocationA) || 0,
      robLocationB: parseFloat(item.robLocationB) || 0
    })) as StoreItem[];
  }, [storesData]);

  const filteredItems = useMemo(() => {
    if (!bulkSearchQuery) return items;
    const query = bulkSearchQuery.toLowerCase();
    return items.filter(item => 
      item.itemCode?.toLowerCase().includes(query) ||
      item.itemName?.toLowerCase().includes(query) ||
      item.storesCategory?.toLowerCase().includes(query)
    );
  }, [items, bulkSearchQuery]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  useEffect(() => {
    const initialData: {[key: number]: {consumedLocationA: number, consumedLocationB: number, receivedLocationA: number, receivedLocationB: number}} = {};
    items.forEach(item => {
      initialData[item.id] = { consumedLocationA: 0, consumedLocationB: 0, receivedLocationA: 0, receivedLocationB: 0 };
    });
    setBulkUpdateData(initialData);
  }, [items]);

  useEffect(() => {
    setCurrentPage(1);
  }, [bulkSearchQuery, itemsPerPage]);

  const handleBulkUpdateChange = (itemId: number, field: 'consumedLocationA' | 'consumedLocationB' | 'receivedLocationA' | 'receivedLocationB' | 'comments', value: string | number) => {
    if (field === 'comments') {
      setBulkUpdateData(prev => ({
        ...prev,
        [itemId]: { ...prev[itemId], [field]: String(value) }
      }));
    } else {
      const numValue = parseInt(String(value)) || 0;
      setBulkUpdateData(prev => ({
        ...prev,
        [itemId]: { ...prev[itemId], [field]: numValue }
      }));
    }
  };

  const bulkUpdateMutation = useMutation({
    mutationFn: async (payload: { consumeItems: any[], receiveItems: any[] }) => {
      const results = [];
      
      // Process consume items
      if (payload.consumeItems.length > 0) {
        const consumeRes = await apiRequest('POST', `/technical/api/stores/${vesselId}/batch-consume`, {
          items: payload.consumeItems,
          consumedBy: 'user'
        });
        results.push(consumeRes);
      }
      
      // Process receive items
      if (payload.receiveItems.length > 0) {
        const receiveRes = await apiRequest('POST', `/technical/api/stores/${vesselId}/batch-receive`, {
          items: payload.receiveItems,
          receivedBy: 'user'
        });
        results.push(receiveRes);
      }
      
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/technical/api/stores/${vesselId}?itemType=${activeTab}`] });
      toast({ title: "Success", description: "Bulk update completed successfully" });
      setLocation("/stores");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update stores", variant: "destructive" });
    }
  });

  const handleSaveBulkUpdates = async () => {
    const hasErrors = Object.entries(bulkUpdateData).some(([id, data]) => {
      const item = items.find(i => i.id === Number(id));
      if (!item) return false;
      const robA = item.robLocationA ?? 0;
      const robB = item.robLocationB ?? 0;
      const totalReceived = (data.receivedLocationA || 0) + (data.receivedLocationB || 0);
      return (data.consumedLocationA > robA) || (data.consumedLocationB > robB) || (totalReceived > 0 && !dateReceived);
    });

    if (hasErrors) {
      toast({ title: "Validation Error", description: "Please fix all errors before saving", variant: "destructive" });
      return;
    }

    const consumeItems: any[] = [];
    const receiveItems: any[] = [];

    Object.entries(bulkUpdateData).forEach(([id, data]) => {
      const itemId = Number(id);
      
      // Location A consumption
      if (data.consumedLocationA > 0) {
        consumeItems.push({ itemId, quantity: data.consumedLocationA, location: 'A', notes: data.comments });
      }
      // Location B consumption
      if (data.consumedLocationB > 0) {
        consumeItems.push({ itemId, quantity: data.consumedLocationB, location: 'B', notes: data.comments });
      }
      // Location A receipt
      if (data.receivedLocationA > 0) {
        receiveItems.push({ itemId, quantity: data.receivedLocationA, location: 'A', place: placeReceived, dateLocal: dateReceived, notes: data.comments });
      }
      // Location B receipt
      if (data.receivedLocationB > 0) {
        receiveItems.push({ itemId, quantity: data.receivedLocationB, location: 'B', place: placeReceived, dateLocal: dateReceived, notes: data.comments });
      }
    });

    if (consumeItems.length === 0 && receiveItems.length === 0) {
      toast({ title: "No Changes", description: "No updates to save", variant: "default" });
      return;
    }

    bulkUpdateMutation.mutate({ consumeItems, receiveItems });
  };

  const hasAnyChanges = Object.values(bulkUpdateData).some(data => 
    data.consumedLocationA > 0 || data.consumedLocationB > 0 || data.receivedLocationA > 0 || data.receivedLocationB > 0
  );

  const getTabLabel = () => {
    switch (activeTab) {
      case "lubes": return "Lubes";
      case "chemicals": return "Chemicals";
      case "others": return "Others";
      default: return "Stores";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading stores...</div>
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
              onClick={() => window.history.back()}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Bulk Update {getTabLabel()}</h1>
          </div>
          <div className="text-sm text-gray-500">
            Updating {filteredItems.length} item(s) {bulkSearchQuery && `(filtered)`}
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
                  placeholder="Search by item code, name, category..."
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
              <Label htmlFor="bulk-received-date">Received Date (Apply to all)</Label>
              <Input
                id="bulk-received-date"
                type="date"
                value={dateReceived}
                onChange={(e) => setDateReceived(e.target.value)}
                data-testid="input-bulk-received-date"
              />
            </div>
            <div>
              <Label htmlFor="bulk-received-place">Received Place (Apply to all)</Label>
              <Input
                id="bulk-received-place"
                type="text"
                placeholder="e.g., Singapore Port"
                value={placeReceived}
                onChange={(e) => setPlaceReceived(e.target.value)}
                data-testid="input-bulk-received-place"
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
                    <th className="px-3 py-2 text-left text-xs font-medium">
                      {activeTab === "lubes" ? "Lube Grade" : 
                       activeTab === "chemicals" ? "Chem Code" : "Item Code"}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium">
                      {activeTab === "lubes" ? "Lube Type" : 
                       activeTab === "chemicals" ? "Chemical Name" : "Item Name"}
                    </th>
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
                  {paginatedItems.map((item: StoreItem) => {
                    const consumedA = bulkUpdateData[item.id]?.consumedLocationA || 0;
                    const consumedB = bulkUpdateData[item.id]?.consumedLocationB || 0;
                    const receivedA = bulkUpdateData[item.id]?.receivedLocationA || 0;
                    const receivedB = bulkUpdateData[item.id]?.receivedLocationB || 0;
                    const robA = item.robLocationA ?? 0;
                    const robB = item.robLocationB ?? 0;
                    const newRobA = robA - consumedA + receivedA;
                    const newRobB = robB - consumedB + receivedB;
                    const newROB = newRobA + newRobB;
                    const hasInsufficientStockA = consumedA > robA;
                    const hasInsufficientStockB = consumedB > robB;
                    const totalReceived = receivedA + receivedB;
                    const needsReceivedDate = totalReceived > 0 && !dateReceived;
                    const hasError = hasInsufficientStockA || hasInsufficientStockB || needsReceivedDate;
                    
                    const itemLocA = item.location || locationNames.locationA;
                    const itemLocB = item.location2 || locationNames.locationB;
                    
                    return (
                      <tr key={item.id} className={`border-t ${hasError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                        <td className="px-3 py-2 text-sm">{item.itemCode}</td>
                        <td className="px-3 py-2 text-sm max-w-[150px] truncate" title={item.itemName}>{item.itemName}</td>
                        <td className="px-2 py-2 text-center">
                          <div className="text-[9px] text-gray-500 truncate max-w-[60px]" title={itemLocA}>{itemLocA}</div>
                          <div className="text-xs text-gray-600 font-medium">{robA}</div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className="text-[9px] text-gray-500 truncate max-w-[60px]" title={itemLocB}>{itemLocB}</div>
                          <div className="text-xs text-gray-600 font-medium">{robB}</div>
                        </td>
                        <td className="px-1 py-2 border-l">
                          <div className="text-[9px] text-gray-500 truncate max-w-[56px] text-center" title={itemLocA}>{itemLocA}</div>
                          <Input
                            type="number"
                            min="0"
                            max={robA}
                            value={bulkUpdateData[item.id]?.consumedLocationA || ""}
                            onChange={(e) => handleBulkUpdateChange(item.id, 'consumedLocationA', e.target.value)}
                            className={`w-14 h-7 text-sm text-center ${hasInsufficientStockA ? 'border-red-500' : ''}`}
                            data-testid={`input-consume-a-${item.id}`}
                          />
                        </td>
                        <td className="px-1 py-2">
                          <div className="text-[9px] text-gray-500 truncate max-w-[56px] text-center" title={itemLocB}>{itemLocB}</div>
                          <Input
                            type="number"
                            min="0"
                            max={robB}
                            value={bulkUpdateData[item.id]?.consumedLocationB || ""}
                            onChange={(e) => handleBulkUpdateChange(item.id, 'consumedLocationB', e.target.value)}
                            className={`w-14 h-7 text-sm text-center ${hasInsufficientStockB ? 'border-red-500' : ''}`}
                            data-testid={`input-consume-b-${item.id}`}
                          />
                        </td>
                        <td className="px-1 py-2 border-l">
                          <div className="text-[9px] text-gray-500 truncate max-w-[56px] text-center" title={itemLocA}>{itemLocA}</div>
                          <Input
                            type="number"
                            min="0"
                            value={bulkUpdateData[item.id]?.receivedLocationA || ""}
                            onChange={(e) => handleBulkUpdateChange(item.id, 'receivedLocationA', e.target.value)}
                            className="w-14 h-7 text-sm text-center"
                            data-testid={`input-receive-a-${item.id}`}
                          />
                        </td>
                        <td className="px-1 py-2">
                          <div className="text-[9px] text-gray-500 truncate max-w-[56px] text-center" title={itemLocB}>{itemLocB}</div>
                          <Input
                            type="number"
                            min="0"
                            value={bulkUpdateData[item.id]?.receivedLocationB || ""}
                            onChange={(e) => handleBulkUpdateChange(item.id, 'receivedLocationB', e.target.value)}
                            className="w-14 h-7 text-sm text-center"
                            data-testid={`input-receive-b-${item.id}`}
                          />
                        </td>
                        <td className="px-2 py-2 text-center border-l">
                          <div className={`text-sm font-medium ${hasError ? 'text-red-600' : ''}`}>
                            {newROB}
                            {(hasInsufficientStockA || hasInsufficientStockB) && (
                              <div className="text-[10px] text-red-600">Insufficient</div>
                            )}
                            {needsReceivedDate && (
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
                  Showing {filteredItems.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} - {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length}
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
                  disabled={currentPage === totalPages || totalPages === 0}
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
            onClick={() => window.history.back()}
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
