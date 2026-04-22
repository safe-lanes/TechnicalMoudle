import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useVessel } from "@/contexts/VesselContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Search, X, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import WOAgGridTable from "@/components/WOAgGridTable";
import type { ColDef, ICellRendererParams } from "ag-grid-community";

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
  expiryDate?: string;
  batchNumber?: string;
  sdsReference?: string;
}

type TransactionMode = "" | "consume" | "receive";

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function BulkUpdateStores() {
  const [, setLocation] = useLocation();
  const { vesselId } = useVessel();
  const { toast } = useToast();
  const { canEdit } = usePermissions();
  const canEditStore = canEdit("pms-stores");
  
  const searchParams = new URLSearchParams(window.location.search);
  const tabParam = searchParams.get('tab') as "stores" | "lubes" | "chemicals" | "others" | null;
  const activeTab = tabParam || "stores";
  
  const [transactionMode, setTransactionMode] = useState<TransactionMode>("");
  const [bulkSearchQuery, setBulkSearchQuery] = useState("");
  const [dateReceived, setDateReceived] = useState("");
  const [placeReceived, setPlaceReceived] = useState("");
  const [bulkUpdateData, setBulkUpdateData] = useState<{[key: number]: {consumedLocationA: number, consumedLocationB: number, receivedLocationA: number, receivedLocationB: number, comments?: string}}>({});

  const [chemBulkData, setChemBulkData] = useState<{[key: number]: {expiryDate?: string, batchNumber?: string, sdsReference?: string}}>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [bulkExpiryDate, setBulkExpiryDate] = useState("");
  const [bulkBatchNumber, setBulkBatchNumber] = useState("");
  const [bulkSdsReference, setBulkSdsReference] = useState("");
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const transactionLabel = transactionMode === "consume" ? "Consumed" : "Received";

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
      robLocationB: parseFloat(item.robLocationB) || 0,
      expiryDate: item.expiryDate || '',
      batchNumber: item.batchNumber || '',
      sdsReference: item.sdsReference || '',
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
      
      if (payload.consumeItems.length > 0) {
        const consumeRes = await apiRequest('POST', `/technical/api/stores/${vesselId}/batch-consume`, {
          items: payload.consumeItems,
          consumedBy: 'user'
        });
        results.push(consumeRes);
      }
      
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
    const consumeItems: any[] = [];
    const receiveItems: any[] = [];

    Object.entries(bulkUpdateData).forEach(([id, data]) => {
      const itemId = Number(id);
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      if (transactionMode === "consume") {
        if (data.consumedLocationA > 0) {
          consumeItems.push({ itemId, quantity: data.consumedLocationA, location: 'A', notes: data.comments });
        }
        if (data.consumedLocationB > 0) {
          consumeItems.push({ itemId, quantity: data.consumedLocationB, location: 'B', notes: data.comments });
        }
      } else if (transactionMode === "receive") {
        if (data.receivedLocationA > 0) {
          receiveItems.push({ itemId, quantity: data.receivedLocationA, location: 'A', place: placeReceived, dateLocal: dateReceived, notes: data.comments });
        }
        if (data.receivedLocationB > 0) {
          receiveItems.push({ itemId, quantity: data.receivedLocationB, location: 'B', place: placeReceived, dateLocal: dateReceived, notes: data.comments });
        }
      }
    });

    if (consumeItems.length === 0 && receiveItems.length === 0) {
      toast({ title: "No Changes", description: "No updates to save", variant: "default" });
      return;
    }

    const hasErrors = Object.entries(bulkUpdateData).some(([id, data]) => {
      const item = items.find(i => i.id === Number(id));
      if (!item) return false;
      const robA = item.robLocationA ?? 0;
      const robB = item.robLocationB ?? 0;
      if (transactionMode === "consume") {
        return (data.consumedLocationA > robA) || (data.consumedLocationB > robB);
      }
      const totalReceived = (data.receivedLocationA || 0) + (data.receivedLocationB || 0);
      return totalReceived > 0 && !dateReceived;
    });

    if (hasErrors) {
      toast({ title: "Validation Error", description: "Please fix all errors before saving", variant: "destructive" });
      return;
    }

    bulkUpdateMutation.mutate({ consumeItems, receiveItems });
  };

  const chemUpdateMutation = useMutation({
    mutationFn: async (updates: {itemId: number, data: any}[]) => {
      const results = [];
      for (const update of updates) {
        const res = await apiRequest('PUT', `/technical/api/stores/item/${update.itemId}`, update.data);
        results.push(res);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/technical/api/stores/${vesselId}?itemType=${activeTab}`] });
      toast({ title: "Success", description: "Chemical fields updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update chemical fields", variant: "destructive" });
    }
  });

  const handleSaveChemUpdates = async () => {
    const updates: {itemId: number, data: any}[] = [];
    Object.entries(chemBulkData).forEach(([id, data]) => {
      const itemId = Number(id);
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      const changed: any = {};
      if (data.expiryDate !== undefined && data.expiryDate !== item.expiryDate) changed.expiryDate = data.expiryDate;
      if (data.batchNumber !== undefined && data.batchNumber !== item.batchNumber) changed.batchNumber = data.batchNumber;
      if (data.sdsReference !== undefined && data.sdsReference !== item.sdsReference) changed.sdsReference = data.sdsReference;
      if (Object.keys(changed).length > 0) {
        updates.push({ itemId, data: changed });
      }
    });
    if (updates.length === 0) {
      toast({ title: "No Changes", description: "No chemical field updates to save", variant: "default" });
      return;
    }
    chemUpdateMutation.mutate(updates);
  };

  const applyBulkExpiryToAll = () => {
    if (!bulkExpiryDate) return;
    setChemBulkData(prev => {
      const updated = { ...prev };
      items.forEach(item => {
        updated[item.id] = { ...updated[item.id], expiryDate: bulkExpiryDate };
      });
      return updated;
    });
  };

  const applyBulkBatchToAll = () => {
    if (!bulkBatchNumber) return;
    setChemBulkData(prev => {
      const updated = { ...prev };
      items.forEach(item => {
        updated[item.id] = { ...updated[item.id], batchNumber: bulkBatchNumber };
      });
      return updated;
    });
  };

  const applyBulkSdsToAll = () => {
    if (!bulkSdsReference) return;
    setChemBulkData(prev => {
      const updated = { ...prev };
      items.forEach(item => {
        updated[item.id] = { ...updated[item.id], sdsReference: bulkSdsReference };
      });
      return updated;
    });
  };

  const hasAnyChemChanges = Object.entries(chemBulkData).some(([id, data]) => {
    const item = items.find(i => i.id === Number(id));
    if (!item) return false;
    return (data.expiryDate !== undefined && data.expiryDate !== item.expiryDate) ||
           (data.batchNumber !== undefined && data.batchNumber !== item.batchNumber) ||
           (data.sdsReference !== undefined && data.sdsReference !== item.sdsReference);
  });

  const hasAnyChanges = Object.values(bulkUpdateData).some(data => {
    if (transactionMode === "consume") {
      return data.consumedLocationA > 0 || data.consumedLocationB > 0;
    }
    if (transactionMode === "receive") {
      return data.receivedLocationA > 0 || data.receivedLocationB > 0;
    }
    return false;
  });

  const modifiedCount = useMemo(() => {
    if (!transactionMode) return 0;
    return Object.values(bulkUpdateData).filter(data => {
      if (transactionMode === "consume") return data.consumedLocationA > 0 || data.consumedLocationB > 0;
      if (transactionMode === "receive") return data.receivedLocationA > 0 || data.receivedLocationB > 0;
      return false;
    }).length;
  }, [bulkUpdateData, transactionMode]);

  const totalTransactionQty = useMemo(() => {
    if (!transactionMode) return 0;
    return Object.values(bulkUpdateData).reduce((sum, data) => {
      if (transactionMode === "consume") return sum + (data.consumedLocationA || 0) + (data.consumedLocationB || 0);
      if (transactionMode === "receive") return sum + (data.receivedLocationA || 0) + (data.receivedLocationB || 0);
      return sum;
    }, 0);
  }, [bulkUpdateData, transactionMode]);

  const getTabLabel = () => {
    switch (activeTab) {
      case "lubes": return "Lubes";
      case "chemicals": return "Chemicals";
      case "others": return "Others";
      default: return "Stores";
    }
  };

  // ============================================================
  // AG Grid: Bulk Update column definitions
  // ============================================================
  const bulkGetRowClass = (params: any): string | undefined => {
    const item = params.data as StoreItem | undefined;
    if (!item) return undefined;
    const consumedA = bulkUpdateData[item.id]?.consumedLocationA || 0;
    const consumedB = bulkUpdateData[item.id]?.consumedLocationB || 0;
    const receivedA = bulkUpdateData[item.id]?.receivedLocationA || 0;
    const receivedB = bulkUpdateData[item.id]?.receivedLocationB || 0;
    const robA = item.robLocationA ?? 0;
    const robB = item.robLocationB ?? 0;
    const hasInsufficientStockA = transactionMode === "consume" && consumedA > robA;
    const hasInsufficientStockB = transactionMode === "consume" && consumedB > robB;
    const transactionQtyA = transactionMode === "consume" ? consumedA : receivedA;
    const transactionQtyB = transactionMode === "consume" ? consumedB : receivedB;
    const hasAnyTransaction = transactionQtyA > 0 || transactionQtyB > 0;
    const needsReceivedDate = transactionMode === "receive" && hasAnyTransaction && !dateReceived;
    if (hasInsufficientStockA || hasInsufficientStockB || needsReceivedDate) return 'bulk-row-error';
    return undefined;
  };

  const bulkColumnDefs: ColDef[] = useMemo(() => {
    const cols: ColDef[] = [
      {
        field: 'itemCode',
        headerName: activeTab === 'lubes' ? 'Lube Grade' : activeTab === 'chemicals' ? 'Chem Code' : 'Item Code',
        flex: 1,
        minWidth: 110,
        cellRenderer: (params: ICellRendererParams) => <span className="text-sm">{params.value}</span>,
      },
      {
        field: 'itemName',
        headerName: activeTab === 'lubes' ? 'Lube Type' : activeTab === 'chemicals' ? 'Chemical Name' : 'Item Name',
        flex: 1.4,
        minWidth: 150,
        tooltipField: 'itemName',
        cellRenderer: (params: ICellRendererParams) => <span className="text-sm truncate">{params.value}</span>,
      },
      {
        headerName: `Current Stock (${locationNames.locationA})`,
        colId: 'currentRobA',
        flex: 0.9,
        minWidth: 120,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem;
          const itemLocA = item.location || locationNames.locationA;
          const robA = item.robLocationA ?? 0;
          return (
            <div className="text-center">
              <div className="text-[11px] italic text-blue-600 whitespace-normal leading-tight" data-testid={`text-location-a-${item.id}`}>{itemLocA}</div>
              <div className="text-sm text-gray-800 dark:text-gray-200 font-medium">{robA}</div>
            </div>
          );
        },
        cellStyle: { borderLeft: '1px solid #e5e7eb' },
      },
      {
        headerName: `Current Stock (${locationNames.locationB})`,
        colId: 'currentRobB',
        flex: 0.9,
        minWidth: 120,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams) => {
          const item = params.data as StoreItem;
          const itemLocB = item.location2 || locationNames.locationB;
          const robB = item.robLocationB ?? 0;
          return (
            <div className="text-center">
              <div className="text-[11px] italic text-blue-600 whitespace-normal leading-tight" data-testid={`text-location-b-${item.id}`}>{itemLocB}</div>
              <div className="text-sm text-gray-800 dark:text-gray-200 font-medium">{robB}</div>
            </div>
          );
        },
      },
    ];

    if (transactionMode === "consume") {
      cols.push(
        {
          headerName: `Consume (${locationNames.locationA})`,
          colId: 'consumeA',
          flex: 0.7,
          minWidth: 90,
          sortable: false,
          filter: false,
          cellRenderer: (params: ICellRendererParams) => {
            const item = params.data as StoreItem;
            const robA = item.robLocationA ?? 0;
            const consumedA = bulkUpdateData[item.id]?.consumedLocationA || 0;
            const insufficient = consumedA > robA;
            return (
              <Input
                type="number"
                min="0"
                max={robA}
                value={bulkUpdateData[item.id]?.consumedLocationA || ""}
                onChange={(e) => handleBulkUpdateChange(item.id, 'consumedLocationA', e.target.value)}
                className={`w-16 h-7 text-sm text-center mx-auto ${insufficient ? 'border-red-500' : ''}`}
                data-testid={`input-consume-a-${item.id}`}
                tabIndex={(params.node.rowIndex ?? 0) + 1}
              />
            );
          },
          cellStyle: { borderLeft: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        },
        {
          headerName: `Consume (${locationNames.locationB})`,
          colId: 'consumeB',
          flex: 0.7,
          minWidth: 90,
          sortable: false,
          filter: false,
          cellRenderer: (params: ICellRendererParams) => {
            const item = params.data as StoreItem;
            const robB = item.robLocationB ?? 0;
            const consumedB = bulkUpdateData[item.id]?.consumedLocationB || 0;
            const insufficient = consumedB > robB;
            return (
              <Input
                type="number"
                min="0"
                max={robB}
                value={bulkUpdateData[item.id]?.consumedLocationB || ""}
                onChange={(e) => handleBulkUpdateChange(item.id, 'consumedLocationB', e.target.value)}
                className={`w-16 h-7 text-sm text-center mx-auto ${insufficient ? 'border-red-500' : ''}`}
                data-testid={`input-consume-b-${item.id}`}
                tabIndex={paginatedItems.length + (params.node.rowIndex ?? 0) + 1}
              />
            );
          },
          cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
        },
      );
    } else if (transactionMode === "receive") {
      cols.push(
        {
          headerName: `Receive (${locationNames.locationA})`,
          colId: 'receiveA',
          flex: 0.7,
          minWidth: 90,
          sortable: false,
          filter: false,
          cellRenderer: (params: ICellRendererParams) => {
            const item = params.data as StoreItem;
            return (
              <Input
                type="number"
                min="0"
                value={bulkUpdateData[item.id]?.receivedLocationA || ""}
                onChange={(e) => handleBulkUpdateChange(item.id, 'receivedLocationA', e.target.value)}
                className="w-16 h-7 text-sm text-center mx-auto"
                data-testid={`input-receive-a-${item.id}`}
                tabIndex={(params.node.rowIndex ?? 0) + 1}
              />
            );
          },
          cellStyle: { borderLeft: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        },
        {
          headerName: `Receive (${locationNames.locationB})`,
          colId: 'receiveB',
          flex: 0.7,
          minWidth: 90,
          sortable: false,
          filter: false,
          cellRenderer: (params: ICellRendererParams) => {
            const item = params.data as StoreItem;
            return (
              <Input
                type="number"
                min="0"
                value={bulkUpdateData[item.id]?.receivedLocationB || ""}
                onChange={(e) => handleBulkUpdateChange(item.id, 'receivedLocationB', e.target.value)}
                className="w-16 h-7 text-sm text-center mx-auto"
                data-testid={`input-receive-b-${item.id}`}
                tabIndex={paginatedItems.length + (params.node.rowIndex ?? 0) + 1}
              />
            );
          },
          cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
        },
      );
    }

    cols.push({
      headerName: 'New ROB',
      colId: 'newRob',
      flex: 0.7,
      minWidth: 90,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams) => {
        const item = params.data as StoreItem;
        const consumedA = bulkUpdateData[item.id]?.consumedLocationA || 0;
        const consumedB = bulkUpdateData[item.id]?.consumedLocationB || 0;
        const receivedA = bulkUpdateData[item.id]?.receivedLocationA || 0;
        const receivedB = bulkUpdateData[item.id]?.receivedLocationB || 0;
        const robA = item.robLocationA ?? 0;
        const robB = item.robLocationB ?? 0;
        const effConsumedA = transactionMode === "consume" ? consumedA : 0;
        const effConsumedB = transactionMode === "consume" ? consumedB : 0;
        const effReceivedA = transactionMode === "receive" ? receivedA : 0;
        const effReceivedB = transactionMode === "receive" ? receivedB : 0;
        const newRobA = robA - effConsumedA + effReceivedA;
        const newRobB = robB - effConsumedB + effReceivedB;
        const newROB = newRobA + newRobB;
        const insuffA = transactionMode === "consume" && consumedA > robA;
        const insuffB = transactionMode === "consume" && consumedB > robB;
        const txQtyA = transactionMode === "consume" ? consumedA : receivedA;
        const txQtyB = transactionMode === "consume" ? consumedB : receivedB;
        const hasAnyTx = txQtyA > 0 || txQtyB > 0;
        const needsDate = transactionMode === "receive" && hasAnyTx && !dateReceived;
        const hasError = insuffA || insuffB || needsDate;
        return (
          <div className={`text-sm font-medium text-center ${hasError ? 'text-red-600' : ''}`}>
            {newROB}
            {(insuffA || insuffB) && <div className="text-[10px] text-red-600">Insufficient</div>}
            {needsDate && <div className="text-[10px] text-red-600">Date required</div>}
          </div>
        );
      },
      cellStyle: { borderLeft: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    });

    if (activeTab === "chemicals") {
      cols.push(
        {
          headerName: 'Expiry Date',
          colId: 'expiryDate',
          flex: 0.9,
          minWidth: 130,
          sortable: false,
          filter: false,
          cellRenderer: (params: ICellRendererParams) => {
            const item = params.data as StoreItem;
            return (
              <Input
                type="date"
                value={chemBulkData[item.id]?.expiryDate ?? item.expiryDate ?? ""}
                onChange={(e) => setChemBulkData(prev => ({
                  ...prev,
                  [item.id]: { ...prev[item.id], expiryDate: e.target.value }
                }))}
                className="w-32 h-7 text-xs"
                data-testid={`input-chem-expiry-${item.id}`}
              />
            );
          },
          cellStyle: { borderLeft: '1px solid #e5e7eb', display: 'flex', alignItems: 'center' },
        },
        {
          headerName: 'Batch #',
          colId: 'batchNumber',
          flex: 0.8,
          minWidth: 100,
          sortable: false,
          filter: false,
          cellRenderer: (params: ICellRendererParams) => {
            const item = params.data as StoreItem;
            return (
              <Input
                type="text"
                value={chemBulkData[item.id]?.batchNumber ?? item.batchNumber ?? ""}
                onChange={(e) => setChemBulkData(prev => ({
                  ...prev,
                  [item.id]: { ...prev[item.id], batchNumber: e.target.value }
                }))}
                className="w-24 h-7 text-xs"
                placeholder="Batch #"
                data-testid={`input-chem-batch-${item.id}`}
              />
            );
          },
          cellStyle: { display: 'flex', alignItems: 'center' },
        },
        {
          headerName: 'SDS Ref',
          colId: 'sdsReference',
          flex: 0.8,
          minWidth: 100,
          sortable: false,
          filter: false,
          cellRenderer: (params: ICellRendererParams) => {
            const item = params.data as StoreItem;
            return (
              <Input
                type="text"
                value={chemBulkData[item.id]?.sdsReference ?? item.sdsReference ?? ""}
                onChange={(e) => setChemBulkData(prev => ({
                  ...prev,
                  [item.id]: { ...prev[item.id], sdsReference: e.target.value }
                }))}
                className="w-24 h-7 text-xs"
                placeholder="SDS Ref"
                data-testid={`input-chem-sds-${item.id}`}
              />
            );
          },
          cellStyle: { display: 'flex', alignItems: 'center' },
        },
      );
    }

    return cols;
  }, [activeTab, transactionMode, locationNames.locationA, locationNames.locationB, bulkUpdateData, chemBulkData, dateReceived, paginatedItems.length]);

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
          <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3">
              <Label htmlFor="transaction-mode" className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Mode of Transaction</Label>
              <Select
                value={transactionMode}
                onValueChange={(value: TransactionMode) => setTransactionMode(value)}
              >
                <SelectTrigger 
                  id="transaction-mode"
                  className="w-40"
                  data-testid="select-transaction-mode"
                >
                  <SelectValue placeholder="Select mode..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consume">Consume</SelectItem>
                  <SelectItem value="receive">Receive</SelectItem>
                </SelectContent>
              </Select>
              {transactionMode && (
                <span className={`text-sm font-medium px-3 py-1 rounded ${transactionMode === "consume" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                  {transactionMode === "consume" ? "Consume Mode" : "Receive Mode"}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            <div className="w-56">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search by item code, name, category..."
                  value={bulkSearchQuery}
                  onChange={(e) => setBulkSearchQuery(e.target.value)}
                  className="pl-10"
                  disabled={!transactionMode}
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
            {transactionMode && (
              <>
                <div className="flex-1 min-w-[140px]">
                  <Label htmlFor="bulk-received-date" className="text-xs">Transaction Date (Apply to all)</Label>
                  <Input
                    id="bulk-received-date"
                    type="date"
                    value={dateReceived}
                    onChange={(e) => setDateReceived(e.target.value)}
                    data-testid="input-bulk-received-date"
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <Label htmlFor="bulk-received-place" className="text-xs">Received Place (Apply to all)</Label>
                  <Input
                    id="bulk-received-place"
                    type="text"
                    placeholder="e.g., Singapore Port"
                    value={placeReceived}
                    onChange={(e) => setPlaceReceived(e.target.value)}
                    data-testid="input-bulk-received-place"
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <Label htmlFor="bulk-comments" className="text-xs">Comments (Apply to all)</Label>
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
              </>
            )}
          </div>

          {activeTab === "chemicals" && transactionMode && (
            <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div>
                <Label htmlFor="bulk-expiry-date" className="text-sm">Expiry Date (Apply to all)</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="bulk-expiry-date"
                    type="date"
                    value={bulkExpiryDate}
                    onChange={(e) => setBulkExpiryDate(e.target.value)}
                    data-testid="input-bulk-expiry-date"
                  />
                  <Button size="sm" variant="outline" onClick={applyBulkExpiryToAll} disabled={!bulkExpiryDate} data-testid="button-apply-expiry-all">
                    Apply
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="bulk-batch-number" className="text-sm">Batch Number (Apply to all)</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="bulk-batch-number"
                    type="text"
                    placeholder="e.g., BT-2025-001"
                    value={bulkBatchNumber}
                    onChange={(e) => setBulkBatchNumber(e.target.value)}
                    data-testid="input-bulk-batch-number"
                  />
                  <Button size="sm" variant="outline" onClick={applyBulkBatchToAll} disabled={!bulkBatchNumber} data-testid="button-apply-batch-all">
                    Apply
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="bulk-sds-reference" className="text-sm">SDS Reference (Apply to all)</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="bulk-sds-reference"
                    type="text"
                    placeholder="e.g., SDS-2025-001"
                    value={bulkSdsReference}
                    onChange={(e) => setBulkSdsReference(e.target.value)}
                    data-testid="input-bulk-sds-reference"
                  />
                  <Button size="sm" variant="outline" onClick={applyBulkSdsToAll} disabled={!bulkSdsReference} data-testid="button-apply-sds-all">
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          )}

          {transactionMode && modifiedCount > 0 && (
            <div className="flex items-center gap-4 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-sm" data-testid="summary-bar">
              <span className="font-medium text-amber-700 dark:text-amber-400">{modifiedCount} item(s) modified</span>
              <span className="text-amber-600 dark:text-amber-500">Total {transactionLabel}: {totalTransactionQty}</span>
            </div>
          )}

          {!transactionMode ? (
            <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-800 flex flex-col flex-1 min-h-0 items-center justify-center">
              <div className="text-center p-8">
                <div className="text-gray-400 dark:text-gray-500 text-lg mb-2">Please select a Mode of Transaction</div>
                <div className="text-gray-500 dark:text-gray-400 text-sm">Choose either Consume or Receive to view and update {getTabLabel().toLowerCase()}</div>
              </div>
            </div>
          ) : (
          <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-800 flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0">
                <WOAgGridTable
                  columnDefs={bulkColumnDefs}
                  rowData={paginatedItems}
                  getRowClass={bulkGetRowClass}
                  noRowsMessage="No items match your filters."
                  testId="bulk-update-stores-grid"
                />
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
          )}
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
            onClick={() => setShowConfirmDialog(true)}
            disabled={!canEditStore || !transactionMode || !hasAnyChanges || bulkUpdateMutation.isPending}
            data-testid="button-save-updates"
          >
            {bulkUpdateMutation.isPending ? "Saving..." : "Save Updates"}
          </Button>
          {activeTab === "chemicals" && (
            <Button 
              onClick={handleSaveChemUpdates}
              disabled={!canEditStore || !hasAnyChemChanges || chemUpdateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-save-chem-updates"
            >
              {chemUpdateMutation.isPending ? "Saving..." : "Save Chemical Fields"}
            </Button>
          )}
        </div>
      </div>
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Update</DialogTitle>
            <DialogDescription>Please review the changes before saving.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Mode</span>
              <span className={`font-medium px-2 py-0.5 rounded ${transactionMode === "consume" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                {transactionMode === "consume" ? "Consume" : "Receive"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Items modified</span>
              <span className="font-medium">{modifiedCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Total quantity</span>
              <span className="font-medium">{totalTransactionQty}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} data-testid="button-confirm-cancel">Cancel</Button>
            <Button onClick={() => { setShowConfirmDialog(false); handleSaveBulkUpdates(); }} disabled={!canEditStore} data-testid="button-confirm-save">
              Confirm & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
