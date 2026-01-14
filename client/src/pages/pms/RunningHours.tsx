import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, FileSpreadsheet, Calendar, Users, Settings, Pencil } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useModifyMode } from "@/hooks/useModifyMode";
import { ModifyFieldWrapper } from "@/components/modify/ModifyFieldWrapper";
import { ModifyStickyFooter } from "@/components/modify/ModifyStickyFooter";
import { useLocation } from "wouter";
import { formatProfessionalDateTime } from "@/lib/dateUtils";
import { useVessel } from "@/contexts/VesselContext";
import { Marker } from "@/components/Marker";

interface ChildRHData {
  id: string;
  componentCode: string;
  name: string;
  currentCumulativeRH: string;
  rhCounterType?: string;
  lastUpdated: string;
}

interface RunningHoursData {
  id: string;
  component: string;
  componentCode?: string;
  sfiCode?: string;
  componentCategory: string;
  runningHours: string;
  lastUpdated: string;
  utilizationRate?: number | null;
  inheritedCount?: number;
}

const RunningHours = () => {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<RunningHoursData | null>(null);
  
  // Modify mode integration  
  const { isModifyMode, targetId, fieldChanges } = useModifyMode();
  const [updateMode, setUpdateMode] = useState<"setTotal" | "addDelta">("setTotal");
  const [meterReplaced, setMeterReplaced] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    oldValue: "",
    newValue: "",
    dateUpdated: "",
    comments: "",
    oldMeterFinal: "",
    newMeterStart: "0"
  });
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [bulkUpdateMode, setBulkUpdateMode] = useState<"setTotal" | "addDelta">("setTotal");
  const [bulkUpdateData, setBulkUpdateData] = useState<{[key: string]: {
    value: string;
    meterReplaced: boolean;
    oldMeterFinal: string;
    newMeterStart: string;
  }}>({});
  const [bulkUpdateErrors, setBulkUpdateErrors] = useState<{[key: string]: string}>({});
  const [bulkUpdateGlobal, setBulkUpdateGlobal] = useState({
    dateUpdated: new Date().toISOString().split('T')[0],
    comments: ""
  });
  
  // Child RH popup state
  const [isChildRHOpen, setIsChildRHOpen] = useState(false);
  const [selectedParentForChildRH, setSelectedParentForChildRH] = useState<RunningHoursData | null>(null);
  
  // Child RH edit state
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editingChildRH, setEditingChildRH] = useState<string>("");
  const [editingChildComments, setEditingChildComments] = useState<string>("");
  
  const { toast } = useToast();
  const { vesselId } = useVessel(); // Get vessel ID from context
  
  // Fetch children RH data when popup is open
  const { data: childrenRHData, isLoading: isLoadingChildren } = useQuery<{
    parent: { componentCode: string; name: string; currentCumulativeRH: string };
    children: ChildRHData[];
  }>({
    queryKey: ['/technical/api/running-hours/children', selectedParentForChildRH?.componentCode, vesselId],
    queryFn: async () => {
      const response = await fetch(`/technical/api/running-hours/children/${selectedParentForChildRH?.componentCode}?vesselId=${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch children RH');
      return response.json();
    },
    enabled: isChildRHOpen && !!selectedParentForChildRH?.componentCode
  });
  
  const openChildRHPopup = (item: RunningHoursData) => {
    setSelectedParentForChildRH(item);
    setIsChildRHOpen(true);
  };
  
  // Fetch parent components with RH-based child jobs
  const { data: rawRunningHoursData = [], isLoading: isLoadingParents, refetch } = useQuery<any[]>({
    queryKey: ['/technical/api/running-hours/parents', vesselId],
    queryFn: async () => {
      const response = await fetch(`/technical/api/running-hours/parents?vesselId=${vesselId}`);
      if (!response.ok) throw new Error('Failed to fetch running hour parents');
      return response.json();
    },
    enabled: true
  });

  // Map API data to display format
  const runningHoursData: RunningHoursData[] = Array.isArray(rawRunningHoursData) ? rawRunningHoursData.map((parent: any) => ({
    id: parent.id,
    component: parent.name || '',
    componentCode: parent.componentCode || '',
    sfiCode: parent.sfiCode || '',
    componentCategory: parent.category || '',
    runningHours: `${parseFloat(parent.currentCumulativeRH || '0').toLocaleString()} hrs`,
    lastUpdated: formatProfessionalDateTime(parent.latestUpdate || parent.lastUpdated),
    utilizationRate: null,
    inheritedCount: parent.inheritedCount || 0
  })) : [];

  // Cascade update mutation
  const cascadeUpdateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/technical/api/running-hours/cascade', data);
    },
    onSuccess: () => {
      // Invalidate all related queries with refetchType 'all' to force refetch even inactive queries
      queryClient.invalidateQueries({ queryKey: ['/technical/api/running-hours/parents'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/rh-config'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/components'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/rh-config/master-components'], refetchType: 'all' });
      toast({ title: "Success", description: "Running hours updated successfully" });
      setIsUpdateDialogOpen(false);
      handleCancelUpdate();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update running hours",
        variant: "destructive"
      });
    }
  });

  // Mutation for bulk update - calls cascade endpoint for each component
  const bulkUpdateRunningHours = useMutation({
    mutationFn: async (updates: any[]) => {
      const promises = updates.map(update => 
        apiRequest('POST', '/technical/api/running-hours/cascade', {
          parentComponentId: update.componentId,
          mode: update.mode,
          value: update.value,
          dateUpdated: update.dateUpdated,
          comments: update.comments || '',
          meterReplaced: update.meterReplaced,
          oldMeterFinal: update.oldMeterFinal,
          newMeterStart: update.newMeterStart
        })
      );
      return await Promise.all(promises);
    },
    onSuccess: () => {
      // Invalidate all related queries with refetchType 'all' to force refetch even inactive queries
      queryClient.invalidateQueries({ queryKey: ['/technical/api/running-hours/parents'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/rh-config'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/components'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/rh-config/master-components'], refetchType: 'all' });
      toast({
        title: "Success",
        description: "Bulk update completed successfully",
      });
      setIsBulkUpdateOpen(false);
      setBulkUpdateData({});
      setBulkUpdateErrors({});
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to perform bulk update",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating individual child component RH
  const updateChildRHMutation = useMutation({
    mutationFn: async (data: { componentId: string; newRHValue: number; comments?: string }) => {
      return await apiRequest('PUT', `/technical/api/running-hours/child/${data.componentId}`, {
        newRHValue: data.newRHValue,
        comments: data.comments || ''
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/running-hours/children'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/components'], refetchType: 'all' });
      toast({ title: "Success", description: "Child running hours updated successfully" });
      setEditingChildId(null);
      setEditingChildRH("");
      setEditingChildComments("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update child running hours",
        variant: "destructive"
      });
    }
  });

  // Start editing a child component
  const startEditingChild = (child: ChildRHData) => {
    setEditingChildId(child.id);
    setEditingChildRH(child.currentCumulativeRH || "0");
    setEditingChildComments("");
  };

  // Cancel editing
  const cancelEditingChild = () => {
    setEditingChildId(null);
    setEditingChildRH("");
    setEditingChildComments("");
  };

  // Save child RH edit
  const saveChildRHEdit = () => {
    if (!editingChildId) return;
    
    const newValue = parseFloat(editingChildRH.replace(/,/g, ''));
    if (isNaN(newValue) || newValue < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid positive number for running hours",
        variant: "destructive"
      });
      return;
    }
    
    updateChildRHMutation.mutate({
      componentId: editingChildId,
      newRHValue: newValue,
      comments: editingChildComments
    });
  };

  const clearFilters = () => {
    setSearchTerm("");
  };

  // Export to CSV function
  const exportToCSV = () => {
    // Filter data based on current filters
    const filteredData = runningHoursData.filter(item => {
      if (searchTerm && !item.component.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    });

    // Prepare CSV headers
    const headers = [
      "Vessel",
      "Component",
      "Component Code",
      "Component Category",
      "Running Hours (cumulative)",
      "Last Updated (local)",
      "Utilization Rate (hrs/day)",
      "Notes"
    ];

    // Prepare CSV rows
    const rows = filteredData.map(item => [
      vesselId,
      item.component,
      item.componentCode || "",
      item.componentCategory,
      item.runningHours.replace(" hrs", ""),
      item.lastUpdated,
      item.utilizationRate !== null && item.utilizationRate !== undefined ? item.utilizationRate.toString() : "",
      "" // Notes field (empty for now)
    ]);

    // Convert to CSV format
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const now = new Date();
    const filename = `running-hours_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.csv`;
    
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    
    toast({
      title: "Export Complete",
      description: `Exported ${filteredData.length} records to ${filename}`,
    });
  };

  const openUpdateDialog = (component: RunningHoursData) => {
    setSelectedComponent(component);
    setUpdateForm({
      oldValue: component.runningHours.replace(" hrs", "").replace(/,/g, ""),
      newValue: "",
      dateUpdated: "",
      comments: "",
      oldMeterFinal: "",
      newMeterStart: "0"
    });
    setUpdateMode("setTotal");
    setMeterReplaced(false);
    setIsUpdateDialogOpen(true);
  };

  const handleUpdateFormChange = (field: string, value: string) => {
    setUpdateForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveUpdate = () => {
    if (!selectedComponent) return;
    
    // Validate date is provided
    if (!updateForm.dateUpdated || updateForm.dateUpdated.trim() === "") {
      toast({
        title: "Error",
        description: "Date is required. Please select a date.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate date not in future
    const selectedDate = new Date(updateForm.dateUpdated);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (selectedDate > today) {
      toast({
        title: "Error",
        description: "Date cannot be in the future",
        variant: "destructive",
      });
      return;
    }
    
    // Format date in vessel local time
    const dateLocal = selectedDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ' ' + selectedDate.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    cascadeUpdateMutation.mutate({
      parentComponentId: selectedComponent.id,
      mode: updateMode,
      value: parseFloat(updateForm.newValue),
      dateUpdated: dateLocal,
      comments: updateForm.comments,
      meterReplaced,
      oldMeterFinal: meterReplaced ? updateForm.oldMeterFinal : undefined,
      newMeterStart: meterReplaced ? updateForm.newMeterStart : undefined
    });
  };

  const handleCancelUpdate = () => {
    setIsUpdateDialogOpen(false);
    setSelectedComponent(null);
    setUpdateForm({
      oldValue: "",
      newValue: "",
      dateUpdated: "",
      comments: "",
      oldMeterFinal: "",
      newMeterStart: "0"
    });
    setUpdateMode("setTotal");
    setMeterReplaced(false);
  };

  const openBulkUpdate = () => {
    setBulkUpdateData({});
    setBulkUpdateErrors({});
    setBulkUpdateGlobal({
      dateUpdated: new Date().toISOString().split('T')[0],
      comments: ""
    });
    setIsBulkUpdateOpen(true);
  };

  const handleBulkUpdateChange = (componentId: string, field: string, value: any) => {
    setBulkUpdateData(prev => ({
      ...prev,
      [componentId]: {
        ...prev[componentId],
        [field]: value
      }
    }));
    // Clear error when user starts typing
    if (bulkUpdateErrors[componentId] && field === 'value') {
      setBulkUpdateErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[componentId];
        return newErrors;
      });
    }
  };

  const handleBulkSave = () => {
    const errors: {[key: string]: string} = {};
    const updates = [];
    
    // Validate global date
    if (!bulkUpdateGlobal.dateUpdated) {
      toast({
        title: "Date Required",
        description: "Please select the date when running hours were updated",
        variant: "destructive"
      });
      return;
    }
    
    // Parse user-selected date and format it
    const selectedDate = new Date(bulkUpdateGlobal.dateUpdated);
    selectedDate.setHours(23, 59, 59, 999);
    
    const dateLocal = selectedDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ' ' + selectedDate.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    // Process each component with updates
    for (const component of runningHoursData) {
      const updateData = bulkUpdateData[component.id];
      if (!updateData || !updateData.value || updateData.value.trim() === "") continue;
      
      // Validate numeric input
      const inputValue = parseFloat(updateData.value.replace(/,/g, ''));
      if (isNaN(inputValue)) {
        errors[component.id] = "Please enter a valid number";
        continue;
      }
      
      updates.push({
        componentId: component.id,
        mode: bulkUpdateMode,
        value: inputValue,
        dateUpdated: dateLocal,
        comments: bulkUpdateGlobal.comments,
        meterReplaced: updateData.meterReplaced || false,
        oldMeterFinal: updateData.meterReplaced ? updateData.oldMeterFinal : undefined,
        newMeterStart: updateData.meterReplaced ? updateData.newMeterStart : undefined
      });
    }
    
    if (Object.keys(errors).length > 0) {
      setBulkUpdateErrors(errors);
      return;
    }
    
    if (updates.length === 0) {
      toast({
        title: "No changes",
        description: "No values were entered for update",
      });
      return;
    }
    
    bulkUpdateRunningHours.mutate(updates);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900" data-testid="D1"><Marker id="D1" />Running Hours</h1>
        <Button 
          className="bg-green-600 hover:bg-green-700 text-white ml-[228px] mr-[228px]"
          onClick={openBulkUpdate}
          data-testid="D5"
        >
          <Marker id="D5" /><span className="mr-2">+</span>
          Bulk Update RH
        </Button>
      </div>

      {/* Search and Export Row */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md" data-testid="D2">
          <Marker id="D2" />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search Component"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button variant="outline" className="flex items-center gap-2" onClick={exportToCSV} data-testid="D3">
          <Marker id="D3" /><FileSpreadsheet className="h-4 w-4" />
          Export
        </Button>

        <Button variant="outline" onClick={clearFilters} className="flex items-center gap-2" data-testid="D4">
          <Marker id="D4" />Clear
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Table Header */}
        <div className="bg-[#52baf3] text-white px-4 py-3">
          <div className="grid grid-cols-9 gap-4 text-sm font-medium">
            <div data-testid="D6"><Marker id="D6" />Component Name</div>
            <div data-testid="D7"><Marker id="D7" />Component Code</div>
            <div data-testid="D8"><Marker id="D8" />Component Category</div>
            <div data-testid="D9"><Marker id="D9" />Running Hours</div>
            <div data-testid="D10"><Marker id="D10" />Last Updated</div>
            <div data-testid="D11"><Marker id="D11" />Utilization Rate</div>
            <div data-testid="D22">Inherited RH</div>
            <div className="col-span-2" data-testid="D12"><Marker id="D12" />Update RH</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-gray-200">
          {isLoadingParents ? (
            <div className="px-4 py-8 text-center text-gray-500">
              Loading running hours data...
            </div>
          ) : (() => {
            const filteredData = runningHoursData.filter(item => 
              !searchTerm || item.component.toLowerCase().includes(searchTerm.toLowerCase())
            );
            
            if (filteredData.length === 0 && searchTerm) {
              return (
                <div className="px-4 py-8 text-center text-gray-500">
                  No results found. <button onClick={clearFilters} className="text-blue-600 underline">Reset</button>
                </div>
              );
            }
            
            if (filteredData.length === 0) {
              return (
                <div className="px-4 py-8 text-center text-gray-500">
                  No running hours data available
                </div>
              );
            }
            
            return filteredData.map((item, index) => (
              <div key={item.id} className="px-4 py-3 hover:bg-gray-50">
              <div className="grid grid-cols-9 gap-4 text-sm items-center">
                <div className="text-gray-900" data-testid={index === 0 ? "D13" : undefined}>{index === 0 && <Marker id="D13" />}{item.component}</div>
                <div data-testid={index === 0 ? "D14" : undefined}>
                  {index === 0 && <Marker id="D14" />}
                  {item.sfiCode && item.componentCode ? (
                    <button
                      type="button"
                      onClick={() => {
                        sessionStorage.setItem('targetComponentCode', item.componentCode!);
                        navigate('/pms/components');
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 rounded"
                      data-testid={`link-sfi-code-${item.id}`}
                    >
                      {item.sfiCode}
                    </button>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>
                <div className="text-gray-700" data-testid={index === 0 ? "D15" : undefined}>{index === 0 && <Marker id="D15" />}{item.componentCategory}</div>
                <div className="text-gray-900 font-medium" data-testid={index === 0 ? "D16" : undefined}>{index === 0 && <Marker id="D16" />}{item.runningHours}</div>
                <div className="text-gray-700" data-testid={index === 0 ? "D17" : undefined}>{index === 0 && <Marker id="D17" />}{item.lastUpdated}</div>
                <div className="text-gray-700" title="Computed from last 30 days of RH entries" data-testid={index === 0 ? "D18" : undefined}>
                  {index === 0 && <Marker id="D18" />}{item.utilizationRate !== null ? `${item.utilizationRate} hrs/day` : "—"}
                </div>
                <div className="flex items-center gap-2">
                  {item.inheritedCount && item.inheritedCount > 0 ? (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      onClick={() => openChildRHPopup(item)}
                      title="View Inherited Components"
                      data-testid={index === 0 ? "D23" : `button-inherited-rh-${item.id}`}
                    >
                      <Users className="h-4 w-4 mr-1" />
                      <span className="text-xs font-medium">{item.inheritedCount}</span>
                    </Button>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </div>
                <div className="col-span-2 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => openUpdateDialog(item)}
                    title="Update Running Hours"
                    data-testid={index === 0 ? "D19" : `button-update-rh-${item.id}`}
                  >
                    {index === 0 && <Marker id="D19" />}<Settings className="h-4 w-4 text-gray-600" />
                  </Button>
                </div>
              </div>
            </div>
            ));
          })()}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex justify-end text-sm text-gray-500" data-testid="D21">
        <Marker id="D21" />Page 6 of 6
      </div>

      {/* Update Running Hours Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#52baf3] border-b border-[#52baf3] pb-2">
              Update Running Hours - {selectedComponent?.component}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Mode Toggle */}
            <div>
              <Label className="text-sm text-gray-600">Mode</Label>
              <RadioGroup value={updateMode} onValueChange={(value: any) => setUpdateMode(value)} className="mt-2">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="setTotal" id="setTotal" />
                    <Label htmlFor="setTotal">Set Total</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="addDelta" id="addDelta" />
                    <Label htmlFor="addDelta">Add Delta</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-600">Old Value</Label>
                <Input 
                  value={updateForm.oldValue}
                  readOnly
                  className="mt-1 bg-gray-100"
                />
              </div>
              <div>
                <Label className="text-sm text-gray-600">
                  {updateMode === "addDelta" ? "Delta Value" : "New Value"}
                </Label>
                <Input 
                  type="number"
                  value={updateForm.newValue}
                  onChange={(e) => handleUpdateFormChange('newValue', e.target.value)}
                  className="mt-1"
                  placeholder={updateMode === "addDelta" ? "100" : "20000"}
                />
              </div>
            </div>
            
            <div>
              <Label className="text-sm text-gray-600">Date Updated</Label>
              <Input 
                type="date"
                value={updateForm.dateUpdated}
                onChange={(e) => handleUpdateFormChange('dateUpdated', e.target.value)}
                className="mt-1"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Meter Replaced Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="meterReplaced"
                checked={meterReplaced}
                onCheckedChange={(checked) => setMeterReplaced(checked as boolean)}
              />
              <Label htmlFor="meterReplaced" className="text-sm">Meter replaced?</Label>
            </div>

            {/* Meter Replacement Fields */}
            {meterReplaced && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded">
                <div>
                  <Label className="text-sm text-gray-600">Old Meter Final *</Label>
                  <Input 
                    type="number"
                    value={updateForm.oldMeterFinal}
                    onChange={(e) => handleUpdateFormChange('oldMeterFinal', e.target.value)}
                    className="mt-1"
                    placeholder="Final reading"
                    required
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-600">New Meter Start *</Label>
                  <Input 
                    type="number"
                    value={updateForm.newMeterStart}
                    onChange={(e) => handleUpdateFormChange('newMeterStart', e.target.value)}
                    className="mt-1"
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm text-gray-600">Comments</Label>
              <Textarea 
                value={updateForm.comments}
                onChange={(e) => handleUpdateFormChange('comments', e.target.value)}
                className="mt-1 resize-none"
                rows={3}
                placeholder={meterReplaced ? "Reason for meter replacement" : "Comments"}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleCancelUpdate}>
              Cancel
            </Button>
            <Button 
              className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white" 
              onClick={handleSaveUpdate}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Update Dialog */}
      <Dialog open={isBulkUpdateOpen} onOpenChange={setIsBulkUpdateOpen}>
        <DialogContent className="w-[90vw] max-w-none h-[90vh] flex flex-col">
          <DialogHeader className="pb-4 space-y-3">
            <DialogTitle className="text-[#52baf3] text-xl">
              Bulk Update Running Hours
            </DialogTitle>
            {/* Mode Toggle for Bulk Update */}
            <div className="flex items-center space-x-4">
              <Label className="text-sm text-gray-600">Mode:</Label>
              <RadioGroup value={bulkUpdateMode} onValueChange={(value: any) => setBulkUpdateMode(value)} className="flex flex-row space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="setTotal" id="bulkSetTotal" />
                  <Label htmlFor="bulkSetTotal">Set Total</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="addDelta" id="bulkAddDelta" />
                  <Label htmlFor="bulkAddDelta">Add Delta</Label>
                </div>
              </RadioGroup>
            </div>
            
            {/* Global Date and Comments - applies to all updates */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
              <div>
                <Label className="text-sm text-gray-700 font-medium">Date Updated <span className="text-red-500">*</span></Label>
                <Input 
                  type="date"
                  value={bulkUpdateGlobal.dateUpdated}
                  onChange={(e) => setBulkUpdateGlobal(prev => ({ ...prev, dateUpdated: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  className="mt-1"
                  data-testid="input-bulk-date"
                />
                <p className="text-xs text-gray-500 mt-1">When were the running hours readings taken?</p>
              </div>
              <div>
                <Label className="text-sm text-gray-700 font-medium">Comments</Label>
                <Input 
                  type="text"
                  value={bulkUpdateGlobal.comments}
                  onChange={(e) => setBulkUpdateGlobal(prev => ({ ...prev, comments: e.target.value }))}
                  placeholder="e.g., Monthly update, After dry dock"
                  className="mt-1"
                  data-testid="input-bulk-comments"
                />
                <p className="text-xs text-gray-500 mt-1">Optional notes about this update</p>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            <div className="bg-white rounded-lg border border-gray-200">
              {/* Table Header */}
              <div className="bg-[#52baf3] text-white px-4 py-3">
                <div className="grid grid-cols-5 gap-4 text-sm font-medium">
                  <div>Component Name</div>
                  <div>Previous Running Hours</div>
                  <div>{bulkUpdateMode === "addDelta" ? "Delta Hours" : "Present Running Hours"}</div>
                  <div>Meter Replaced?</div>
                  <div>Status</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {runningHoursData.map((item) => {
                  const updateData = bulkUpdateData[item.id] || { value: "", meterReplaced: false };
                  return (
                    <div key={item.id} className="px-4 py-3">
                      <div className="grid grid-cols-5 gap-4 text-sm items-center">
                        <div className="text-gray-900 font-medium">{item.component}</div>
                        <div className="text-gray-700">{item.runningHours}</div>
                        <div className="space-y-1">
                          <Input 
                            type="number"
                            value={updateData.value || ""}
                            onChange={(e) => handleBulkUpdateChange(item.id, 'value', e.target.value)}
                            placeholder={bulkUpdateMode === "addDelta" ? "Enter delta" : "Enter new value"}
                            className="w-full"
                          />
                          {bulkUpdateErrors[item.id] && (
                            <div className="text-red-500 text-xs">
                              {bulkUpdateErrors[item.id]}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-center">
                          <Checkbox 
                            checked={updateData.meterReplaced || false}
                            onCheckedChange={(checked) => handleBulkUpdateChange(item.id, 'meterReplaced', checked)}
                          />
                        </div>
                        <div className="text-gray-500">
                          {updateData.value && updateData.value.trim() !== "" ? "Ready to update" : "No change"}
                        </div>
                      </div>
                      {/* Meter replacement fields if checkbox is checked */}
                      {updateData.meterReplaced && (
                        <div className="grid grid-cols-2 gap-4 mt-2 pl-10 pr-4">
                          <div>
                            <Label className="text-xs text-gray-600">Old Meter Final</Label>
                            <Input 
                              type="number"
                              value={updateData.oldMeterFinal || ""}
                              onChange={(e) => handleBulkUpdateChange(item.id, 'oldMeterFinal', e.target.value)}
                              placeholder="Final reading"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">New Meter Start</Label>
                            <Input 
                              type="number"
                              value={updateData.newMeterStart || ""}
                              onChange={(e) => handleBulkUpdateChange(item.id, 'newMeterStart', e.target.value)}
                              placeholder="0"
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsBulkUpdateOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white" 
              onClick={handleBulkSave}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Child RH Popup - View and edit children's running hours */}
      <Dialog open={isChildRHOpen} onOpenChange={(open) => {
        if (!open) {
          cancelEditingChild();
        }
        setIsChildRHOpen(open);
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-[#52baf3] border-b border-[#52baf3] pb-2">
              Inherited Components — {selectedParentForChildRH?.component}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {isLoadingChildren ? (
              <div className="text-center text-gray-500 py-8">Loading inherited components...</div>
            ) : childrenRHData?.children && childrenRHData.children.length > 0 ? (
              <div className="space-y-2">
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Inherited Running Hours:</strong> These components inherit running hours from the master component. 
                    Click the pencil icon to edit individual component running hours.
                  </p>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 grid grid-cols-[1fr_auto_100px_120px_60px] gap-4 text-sm font-medium text-gray-700">
                    <div>Component Name</div>
                    <div>Component Code</div>
                    <div className="text-right">Running Hours</div>
                    <div>Last Updated</div>
                    <div className="text-center">Edit</div>
                  </div>
                  <div className="divide-y max-h-[400px] overflow-y-auto">
                    {childrenRHData.children.map((child) => (
                      <div key={child.id} className="px-4 py-3 hover:bg-gray-50">
                        {editingChildId === child.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-[1fr_auto_100px_120px_60px] gap-4 text-sm items-center">
                              <div className="text-gray-900 font-medium">{child.name}</div>
                              <div className="text-gray-600">{child.componentCode}</div>
                              <div>
                                <Input 
                                  type="number"
                                  value={editingChildRH}
                                  onChange={(e) => setEditingChildRH(e.target.value)}
                                  className="h-8 text-sm text-right"
                                  placeholder="0"
                                  data-testid={`input-edit-child-rh-${child.id}`}
                                />
                              </div>
                              <div className="text-gray-600 text-xs">
                                {child.lastUpdated !== '-' ? formatProfessionalDateTime(child.lastUpdated) : '-'}
                              </div>
                              <div className="flex gap-1 justify-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
                                  onClick={saveChildRHEdit}
                                  disabled={updateChildRHMutation.isPending}
                                  title="Save"
                                  data-testid={`button-save-child-rh-${child.id}`}
                                >
                                  {updateChildRHMutation.isPending ? "..." : "✓"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                                  onClick={cancelEditingChild}
                                  title="Cancel"
                                  data-testid={`button-cancel-child-rh-${child.id}`}
                                >
                                  ✕
                                </Button>
                              </div>
                            </div>
                            <div className="pl-0">
                              <Input 
                                type="text"
                                value={editingChildComments}
                                onChange={(e) => setEditingChildComments(e.target.value)}
                                className="h-8 text-sm"
                                placeholder="Comments (optional)"
                                data-testid={`input-edit-child-comments-${child.id}`}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-[1fr_auto_100px_120px_60px] gap-4 text-sm items-center">
                            <div className="text-gray-900">{child.name}</div>
                            <div className="text-gray-600">{child.componentCode}</div>
                            <div className="text-right font-medium text-gray-900">
                              {parseFloat(child.currentCumulativeRH || '0').toLocaleString()} hrs
                            </div>
                            <div className="text-gray-600 text-xs">
                              {child.lastUpdated !== '-' ? formatProfessionalDateTime(child.lastUpdated) : '-'}
                            </div>
                            <div className="flex justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                onClick={() => startEditingChild(child)}
                                title="Edit Running Hours"
                                data-testid={`button-edit-child-rh-${child.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No inherited components found for this master component.
              </div>
            )}
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => {
              cancelEditingChild();
              setIsChildRHOpen(false);
            }}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modify Mode Sticky Footer */}
      {isModifyMode && (
        <ModifyStickyFooter
          isVisible={true}
          hasChanges={Object.keys(fieldChanges).length > 0}
          changedFieldsCount={Object.keys(fieldChanges).length}
          onCancel={() => { window.location.href = '/pms/modify'; }}
          onSubmitChangeRequest={() => {
            // Submit change request logic will be implemented
            console.log('Submitting changes:', fieldChanges);
          }}
        />
      )}
    </div>
  );
};

export default RunningHours;