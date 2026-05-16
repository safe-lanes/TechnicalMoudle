import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Search, Loader2, RefreshCw, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useUIRole } from "@/contexts/UIRoleContext";
import {
  useExternalNationalities,
  useLocalVessels,
  useExternalVessels,
  useExternalVesselTypes,
  useExternalLicenses,
  useExternalAdditionalGroups,
  useExternalPorts,
  useExternalLanguages,
  useExternalFleetGroups,
  useExternalCountries,
  useExternalManningAgents,
  useExternalCrewPools,
  useExternalAppraisalTypes,
  useExternalUsers,
  getDomain,
} from "@/hooks/useExternalMasterData";

interface ColumnDef {
  header: string;
  fields: string[];
}

interface MasterType {
  id: string;
  name: string;
  idFields: string[];
  columns: ColumnDef[];
  isEditable?: boolean;
}

const masterTypes: MasterType[] = [
  // {
  //   id: "nationality",
  //   name: "Nationality Master",
  //   idFields: ["cid", "id", "nationalityId"],
  //   columns: [
  //     { header: "Nationality", fields: ["countryName", "nationalityName", "name"] },
  //     { header: "Country", fields: ["country_name", "countryName", "country"] },
  //   ],
  // },
  {
    id: "vessel",
    name: "Vessel Master",
    idFields: ["vuid", "vuuid", "vesselId", "id"],
    columns: [
      { header: "Vessel", fields: ["vessel", "vesselName", "name"] },
      { header: "IMO Number", fields: ["imo_number", "imoNumber", "imo_no", "imo"] },
      { header: "Vessel Type", fields: ["vessel_type_name", "vesselTypeName", "vessel_type", "vesselType", "type"] },
    ],
  },
  {
    id: "vesselType",
    name: "Vessel Type",
    idFields: ["vtuid", "id", "vesselTypeId"],
    columns: [
      { header: "Vessel Type", fields: ["vesselType", "vesselTypeName", "name", "type_name"] },
      { header: "Classification", fields: ["classification", "classification_name", "class_name", "class"] },

    ],
  },

  {
    id: "additionalGroup",
    name: "Additional Group",
    idFields: ["id", "groupId", "additional_group_id"],
    columns: [
      { header: "Name", fields: ["group_name", "groupName", "name", "additional_group_name"] },
      { header: "Description", fields: ["vessels", "group_description", "desc"] },
    ],
  },
  {
    id: "ports",
    name: "Ports",
    idFields: ["puid", "id", "portId"],
    columns: [
      { header: "Port Name", fields: ["port_name", "portName", "name"] },
      { header: "Country", fields: ["country_name", "countryName", "country"] },
    ],
  },
    {
    id: "users",
    name: "Users",
    idFields: ["uuid", "id", "userId"],
    columns: [
      { header: "User Name", fields: ["fullname", "userName", "name", "username", "full_name"] },
      { header: "Role", fields: ["role", "role_name", "roleName", "user_role"] },
      { header: "Designation", fields: ["designation", "position", "title", "job_title"] },
      { header: "User Type", fields: ["user_type", "userType", "type"] },
      { header: "Department", fields: ["department", "department_name", "dept"] },
      { header: "Email", fields: ["email", "email_address", "user_email"] },
    ],
  },
  {
    id: "fleetGroup",
    name: "Fleet Group",
    idFields: ["fleet_group_id", "id", "fleetGroupId"],
    columns: [
      { header: "Name", fields: ["fleet_group_name", "fleetGroupName", "name", "group_name"] },
      { header: "Description", fields: ["vessels", "fleet_group_description", "desc"] },
    ],
  },
  {
    id: "equipmentCategory",
    name: "Equipment Category",
    idFields: ["id"],
    columns: [
      { header: "Category Name", fields: ["name"] },
      { header: "Sort Order", fields: ["sortOrder"] },
    ],
    isEditable: true,
  },
  {
    id: "defectCategory",
    name: "Defect Category",
    idFields: ["id"],
    columns: [
      { header: "Category Name", fields: ["name"] },
      { header: "Sort Order", fields: ["sortOrder"] },
    ],
    isEditable: true,
  },
  {
    id: "defectType",
    name: "Defect Type",
    idFields: ["id"],
    columns: [
      { header: "Type Name", fields: ["name"] },
      { header: "Sort Order", fields: ["sortOrder"] },
    ],
    isEditable: true,
  },
   // {
  //   id: "licenseDce",
  //   name: "License & DCE Master",
  //   idFields: ["license_id", "id", "licenseId"],
  //   columns: [
  //     { header: "Name", fields: ["license_name", "licenseName", "name"] },
  //     { header: "Description", fields: ["description", "license_description", "desc"] },
  //   ],
  // },
  // {
  //   id: "language",
  //   name: "Language",
  //   idFields: ["luid", "id", "languageId"],
  //   columns: [
  //     { header: "Language Name", fields: ["language_name", "languageName", "name"] },
  //     { header: "Native Name", fields: ["native_name", "nativeName", "native"] },
  //     { header: "ISO Code", fields: ["iso_code", "isoCode", "code", "language_code"] },
  //   ],
  // },

  // {
  //   id: "country",
  //   name: "Country",
  //   idFields: ["nuid", "id", "countryId"],
  //   columns: [
  //     { header: "Country Name", fields: ["country_name", "countryName", "name"] },
  //   ],
  // },
  // {
  //   id: "manningAgents",
  //   name: "Manning Agents",
  //   idFields: ["agent_id", "id", "agentId", "manning_agent_id"],
  //   columns: [
  //     { header: "Name", fields: ["agent_name", "agentName", "name", "manning_agent_name"] },
  //     { header: "Country", fields: ["country_name", "countryName", "country"] },
  //     { header: "Email", fields: ["email", "agent_email", "email_address"] },
  //   ],
  // },
  // {
  //   id: "crewPool",
  //   name: "Crew Pool",
  //   idFields: ["pool_id", "id", "poolId", "crew_pool_id"],
  //   columns: [
  //     { header: "Name", fields: ["pool_name", "poolName", "name", "crew_pool_name"] },
  //   ],
  // },
  // {
  //   id: "appraisalType",
  //   name: "Appraisal Type",
  //   idFields: ["appraisal_type_id", "id", "appraisalTypeId"],
  //   columns: [
  //     { header: "Name", fields: ["appraisal_type_name", "appraisalTypeName", "name", "type_name"] },
  //   ],
  // },

];

export default function DataMasters() {
  const [selectedMaster, setSelectedMaster] = useState<string>("vessel");
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<{ id?: number; name: string; sortOrder: number } | null>(null);
  const { toast } = useToast();
  const { isHeadOfDept, isVessel } = useUIRole();
  const isShipRole = isHeadOfDept || isVessel;

  // Equipment Categories - local editable master
  const equipmentCategoriesQuery = useQuery<{ id: number; name: string; sortOrder: number; isActive: boolean }[]>({
    queryKey: ['/technical/api/equipment-categories'],
    enabled: selectedMaster === "equipmentCategory",
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; sortOrder: number }) => {
      const res = await apiRequest("POST", "/technical/api/equipment-categories", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/equipment-categories'] });
      toast({ title: "Category created successfully" });
      setIsEditDialogOpen(false);
      setEditingEntry(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed to create category", description: error.message });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name: string; sortOrder: number }) => {
      const res = await apiRequest("PATCH", `/technical/api/equipment-categories/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/equipment-categories'] });
      toast({ title: "Category updated successfully" });
      setIsEditDialogOpen(false);
      setEditingEntry(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed to update category", description: error.message });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/technical/api/equipment-categories/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/equipment-categories'] });
      toast({ title: "Category deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed to delete category", description: error.message });
    },
  });

  // Defect Categories - local editable master
  const defectCategoriesQuery = useQuery<{ id: number; name: string; sortOrder: number; isActive: boolean }[]>({
    queryKey: ['/technical/api/defect-categories'],
    enabled: selectedMaster === "defectCategory",
  });

  const createDefectCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; sortOrder: number }) => {
      const res = await apiRequest("POST", "/technical/api/defect-categories", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/defect-categories'] });
      toast({ title: "Defect category created successfully" });
      setIsEditDialogOpen(false);
      setEditingEntry(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed to create defect category", description: error.message });
    },
  });

  const updateDefectCategoryMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name: string; sortOrder: number }) => {
      const res = await apiRequest("PATCH", `/technical/api/defect-categories/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/defect-categories'] });
      toast({ title: "Defect category updated successfully" });
      setIsEditDialogOpen(false);
      setEditingEntry(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed to update defect category", description: error.message });
    },
  });

  const deleteDefectCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/technical/api/defect-categories/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/defect-categories'] });
      toast({ title: "Defect category deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed to delete defect category", description: error.message });
    },
  });

  // Defect Types - local editable master
  const defectTypesQuery = useQuery<{ id: number; name: string; sortOrder: number; isActive: boolean }[]>({
    queryKey: ['/technical/api/defect-types'],
    enabled: selectedMaster === "defectType",
  });

  const createDefectTypeMutation = useMutation({
    mutationFn: async (data: { name: string; sortOrder: number }) => {
      const res = await apiRequest("POST", "/technical/api/defect-types", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/defect-types'] });
      toast({ title: "Defect type created successfully" });
      setIsEditDialogOpen(false);
      setEditingEntry(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed to create defect type", description: error.message });
    },
  });

  const updateDefectTypeMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name: string; sortOrder: number }) => {
      const res = await apiRequest("PATCH", `/technical/api/defect-types/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/defect-types'] });
      toast({ title: "Defect type updated successfully" });
      setIsEditDialogOpen(false);
      setEditingEntry(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed to update defect type", description: error.message });
    },
  });

  const deleteDefectTypeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/technical/api/defect-types/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/defect-types'] });
      toast({ title: "Defect type deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed to delete defect type", description: error.message });
    },
  });

  // Sync All mutation - calls backend to sync external master data
  // apiRequest throws on non-OK responses, so errors are caught by onError handler
  const syncMastersMutation = useMutation({
    mutationFn: async () => {
      const domain = getDomain();
      if (!domain) {
        throw new Error('Domain not found in localStorage. Cannot sync master data.');
      }
      const response = await apiRequest("POST", "/technical/api/admin/sync-masters", { domain });
      return response.json();
    },
    onSuccess: (data) => {
      const stats = data.statistics;
      const totalUpdated = 
        (stats.vessels?.updated || 0) + (stats.vessels?.inserted || 0) +
        (stats.vesselTypes?.updated || 0) + (stats.vesselTypes?.inserted || 0) +
        (stats.additionalGroups?.updated || 0) + (stats.additionalGroups?.inserted || 0) +
        (stats.ports?.updated || 0) + (stats.ports?.inserted || 0) +
        (stats.users?.updated || 0) + (stats.users?.inserted || 0) +
        (stats.fleetGroups?.updated || 0) + (stats.fleetGroups?.inserted || 0);
      
      toast({
        title: "Master data sync completed successfully",
        description: `${totalUpdated} records synchronized across all masters.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: error.message,
      });
    },
  });

  const nationalitiesQuery = useExternalNationalities({ enabled: selectedMaster === "nationality" });
  // Vessel Master tab: local-primary, external fallback (mirrors useVessels()
  // inversion from Task #147). External Master Data is only hit when the
  // local vessels table is empty.
  const localVesselsQuery = useLocalVessels({ enabled: selectedMaster === "vessel" });
  const localVesselsResolved = !localVesselsQuery.isLoading;
  const localVesselsHasData = (localVesselsQuery.data?.length ?? 0) > 0;
  const externalVesselsEnabled =
    selectedMaster === "vessel" && localVesselsResolved && !localVesselsHasData;
  const externalVesselsQuery = useExternalVessels({ enabled: externalVesselsEnabled });
  const vesselsQuery = {
    data: localVesselsHasData ? localVesselsQuery.data : externalVesselsQuery.data,
    isLoading:
      localVesselsQuery.isLoading ||
      (externalVesselsEnabled && externalVesselsQuery.isLoading),
    error: localVesselsHasData ? localVesselsQuery.error : externalVesselsQuery.error,
  };
  const vesselTypesQuery = useExternalVesselTypes({ enabled: selectedMaster === "vesselType" });
  const licensesQuery = useExternalLicenses({ enabled: selectedMaster === "licenseDce" });
  const additionalGroupsQuery = useExternalAdditionalGroups({ enabled: selectedMaster === "additionalGroup" });
  const portsQuery = useExternalPorts({ enabled: selectedMaster === "ports" });
  const languagesQuery = useExternalLanguages({ enabled: selectedMaster === "language" });
  const fleetGroupsQuery = useExternalFleetGroups({ enabled: selectedMaster === "fleetGroup" });
  const countriesQuery = useExternalCountries({ enabled: selectedMaster === "country" });
  const manningAgentsQuery = useExternalManningAgents({ enabled: selectedMaster === "manningAgents" });
  const crewPoolsQuery = useExternalCrewPools({ enabled: selectedMaster === "crewPool" });
  const appraisalTypesQuery = useExternalAppraisalTypes({ enabled: selectedMaster === "appraisalType" });
  const usersQuery = useExternalUsers({ enabled: selectedMaster === "users" });

  const queryMap: Record<string, { data: any[]; isLoading: boolean; error: Error | null }> = {
    nationality: { data: nationalitiesQuery.data || [], isLoading: nationalitiesQuery.isLoading, error: nationalitiesQuery.error },
    vessel: { data: vesselsQuery.data || [], isLoading: vesselsQuery.isLoading, error: vesselsQuery.error },
    vesselType: { data: vesselTypesQuery.data || [], isLoading: vesselTypesQuery.isLoading, error: vesselTypesQuery.error },
    licenseDce: { data: licensesQuery.data || [], isLoading: licensesQuery.isLoading, error: licensesQuery.error },
    additionalGroup: { data: additionalGroupsQuery.data || [], isLoading: additionalGroupsQuery.isLoading, error: additionalGroupsQuery.error },
    ports: { data: portsQuery.data || [], isLoading: portsQuery.isLoading, error: portsQuery.error },
    language: { data: languagesQuery.data || [], isLoading: languagesQuery.isLoading, error: languagesQuery.error },
    fleetGroup: { data: fleetGroupsQuery.data || [], isLoading: fleetGroupsQuery.isLoading, error: fleetGroupsQuery.error },
    country: { data: countriesQuery.data || [], isLoading: countriesQuery.isLoading, error: countriesQuery.error },
    manningAgents: { data: manningAgentsQuery.data || [], isLoading: manningAgentsQuery.isLoading, error: manningAgentsQuery.error },
    crewPool: { data: crewPoolsQuery.data || [], isLoading: crewPoolsQuery.isLoading, error: crewPoolsQuery.error },
    appraisalType: { data: appraisalTypesQuery.data || [], isLoading: appraisalTypesQuery.isLoading, error: appraisalTypesQuery.error },
    users: { data: usersQuery.data || [], isLoading: usersQuery.isLoading, error: usersQuery.error },
    equipmentCategory: { data: equipmentCategoriesQuery.data || [], isLoading: equipmentCategoriesQuery.isLoading, error: equipmentCategoriesQuery.error },
    defectCategory: { data: defectCategoriesQuery.data || [], isLoading: defectCategoriesQuery.isLoading, error: defectCategoriesQuery.error },
    defectType: { data: defectTypesQuery.data || [], isLoading: defectTypesQuery.isLoading, error: defectTypesQuery.error },
  };

  const currentMaster = masterTypes.find(m => m.id === selectedMaster);
  const currentQuery = queryMap[selectedMaster];
  const entries = currentQuery?.data || [];
  const isLoading = currentQuery?.isLoading || false;
  const error = currentQuery?.error;

  useEffect(() => {
    if (entries.length > 0) {
      console.log(`[DataMasters] ${selectedMaster} sample entry keys:`, Object.keys(entries[0]));
    }
  }, [entries, selectedMaster]);

  const getFieldValue = (entry: any, fieldOptions: string[]): string => {
    for (const field of fieldOptions) {
      if (entry[field] !== undefined && entry[field] !== null) {
        return String(entry[field]);
      }
    }
    return '';
  };

  const getEntryId = (entry: any): string => {
    if (!currentMaster) return String(entry.id || '');
    for (const field of currentMaster.idFields) {
      if (entry[field] !== undefined && entry[field] !== null) {
        return String(entry[field]);
      }
    }
    const keys = Object.keys(entry);
    const idKey = keys.find(k => k.toLowerCase().includes('id'));
    return idKey ? String(entry[idKey] || '') : String(Math.random());
  };

  const filteredEntries = useMemo(() => {
    if (!searchTerm || !currentMaster) return entries;
    const lowerSearch = searchTerm.toLowerCase();
    return entries.filter((entry: any) => {
      const id = getEntryId(entry).toLowerCase();
      if (id.includes(lowerSearch)) return true;
      return currentMaster.columns.some(col => {
        const val = getFieldValue(entry, col.fields).toLowerCase();
        return val.includes(lowerSearch);
      });
    });
  }, [entries, searchTerm, currentMaster]);

   const getMasterIdDisplay = (index: number) => {
    return `ID:${String(index + 1).padStart(3, '0')}`;
  };

  const gridTemplateColumns = currentMaster 
    ? `minmax(100px, 140px) repeat(${currentMaster.columns.length}, minmax(0, 1fr)) minmax(60px, 80px)`
    : 'minmax(100px, 140px) 1fr 1fr minmax(60px, 80px)';

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header - Fixed */}
      <div className="flex-shrink-0 space-y-6 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-page-title">Data Masters</h1>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={isShipRole ? "cursor-not-allowed" : undefined}>
                  <Button
                    onClick={() => syncMastersMutation.mutate()}
                    disabled={syncMastersMutation.isPending || isShipRole}
                    className="bg-[#52baf3] hover:bg-[#3da8e0]"
                    data-testid="btn-sync-all"
                  >
                    {syncMastersMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync All
                      </>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {isShipRole && (
                <TooltipContent side="bottom">
                  <p>Available on shore only</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search in selected Data Master"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white"
            data-testid="input-search-master"
          />
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto flex gap-6 min-h-0">
        <div className="w-80 flex-shrink-0 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-[#52baf3] text-white px-4 py-3 font-medium text-sm">
            Data Master Name
          </div>
          <ScrollArea className="h-[500px]">
            {masterTypes.map((master, index) => (
              <button
                key={master.id}
                onClick={() => {
                  setSelectedMaster(master.id);
                  setSearchTerm("");
                }}
                className={cn(
                  "w-full px-4 py-3 flex items-center justify-between text-left border-b border-gray-100 hover:bg-gray-50 transition-colors",
                  selectedMaster === master.id && "bg-blue-50 border-l-4 border-l-[#52baf3]"
                )}
                data-testid={`btn-master-${master.id}`}
              >
                <span className={cn(
                  "text-sm",
                  selectedMaster === master.id ? "text-[#52baf3] font-medium" : "text-gray-700"
                )}>
                  {master.name}
                </span>
                <span className="text-xs text-gray-400">{getMasterIdDisplay(index)}</span>
              </button>
            ))}
          </ScrollArea>
        </div>

        <div className="flex-1 min-w-0 bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Add button for editable masters */}
          {currentMaster?.isEditable && (
            <div className="px-4 py-3 border-b border-gray-200 flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  setEditingEntry({ name: '', sortOrder: (entries.length + 1) * 10 });
                  setIsEditDialogOpen(true);
                }}
                className="bg-[#52baf3] hover:bg-[#3da8e0]"
                data-testid="btn-add-category"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Category
              </Button>
            </div>
          )}
          <div className="bg-[#52baf3] text-white">
            <div
              className="font-medium text-sm"
              style={{ display: 'grid', gridTemplateColumns }}
            >
              <div className="px-4 py-3 border-r border-blue-400/30">Entry ID</div>
              {currentMaster?.columns.map((col, idx) => (
                <div key={idx} className="px-4 py-3 border-r border-blue-400/30">{col.header}</div>
              ))}
              <div className="px-4 py-3">Actions</div>
            </div>
          </div>
          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#52baf3]" />
                <span className="ml-2 text-gray-500">Loading data...</span>
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center text-red-500">
                Failed to load data: {error.message}
              </div>
            ) : filteredEntries.length > 0 ? (
              filteredEntries.map((entry: any, index: number) => (
                <div
                  key={getEntryId(entry) || index}
                  className="border-b border-gray-200 hover:bg-gray-50 text-sm"
                  style={{ display: 'grid', gridTemplateColumns }}
                  data-testid={`row-entry-${getEntryId(entry)}`}
                >
                  <div className="px-4 py-3 text-gray-600 text-sm break-words border-r border-gray-200">{getEntryId(entry)}</div>
                  {currentMaster?.columns.map((col, idx) => (
                    <div key={idx} className="px-4 py-3 text-gray-900 break-words overflow-hidden border-r border-gray-200" title={getFieldValue(entry, col.fields)}>
                      {getFieldValue(entry, col.fields) || '-'}
                    </div>
                  ))}
                  <div className="px-4 py-3">
                    {currentMaster?.isEditable ? (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingEntry({ 
                              id: entry.id, 
                              name: entry.name, 
                              sortOrder: entry.sortOrder 
                            });
                            setIsEditDialogOpen(true);
                          }}
                          data-testid={`btn-edit-${entry.id}`}
                        >
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Delete "${entry.name}"?`)) {
                              if (selectedMaster === 'defectType') {
                                deleteDefectTypeMutation.mutate(entry.id);
                              } else if (selectedMaster === 'defectCategory') {
                                deleteDefectCategoryMutation.mutate(entry.id);
                              } else {
                                deleteCategoryMutation.mutate(entry.id);
                              }
                            }
                          }}
                          data-testid={`btn-delete-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">External</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-gray-500">
                No entries found
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Edit/Create Dialog for Editable Categories */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntry?.id ? `Edit ${currentMaster?.name || 'Entry'}` : `Add New ${currentMaster?.name || 'Entry'}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700">{selectedMaster === 'defectType' ? 'Type Name' : 'Category Name'}</label>
              <Input
                value={editingEntry?.name || ''}
                onChange={(e) => setEditingEntry(prev => prev ? { ...prev, name: e.target.value } : null)}
                placeholder="Enter category name"
                data-testid="input-category-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Sort Order</label>
              <Input
                type="number"
                value={editingEntry?.sortOrder || 0}
                onChange={(e) => setEditingEntry(prev => prev ? { ...prev, sortOrder: parseInt(e.target.value) || 0 } : null)}
                placeholder="Display order"
                data-testid="input-sort-order"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingEntry(null); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editingEntry?.name?.trim()) {
                  toast({ variant: "destructive", title: "Name is required" });
                  return;
                }
                if (selectedMaster === 'defectType') {
                  if (editingEntry.id) {
                    updateDefectTypeMutation.mutate({ id: editingEntry.id, name: editingEntry.name, sortOrder: editingEntry.sortOrder });
                  } else {
                    createDefectTypeMutation.mutate({ name: editingEntry.name, sortOrder: editingEntry.sortOrder });
                  }
                } else if (selectedMaster === 'defectCategory') {
                  if (editingEntry.id) {
                    updateDefectCategoryMutation.mutate({ id: editingEntry.id, name: editingEntry.name, sortOrder: editingEntry.sortOrder });
                  } else {
                    createDefectCategoryMutation.mutate({ name: editingEntry.name, sortOrder: editingEntry.sortOrder });
                  }
                } else {
                  if (editingEntry.id) {
                    updateCategoryMutation.mutate({ id: editingEntry.id, name: editingEntry.name, sortOrder: editingEntry.sortOrder });
                  } else {
                    createCategoryMutation.mutate({ name: editingEntry.name, sortOrder: editingEntry.sortOrder });
                  }
                }
              }}
              disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending || createDefectCategoryMutation.isPending || updateDefectCategoryMutation.isPending || createDefectTypeMutation.isPending || updateDefectTypeMutation.isPending}
              className="bg-[#52baf3] hover:bg-[#3da8e0]"
              data-testid="btn-save-category"
            >
              {(createCategoryMutation.isPending || updateCategoryMutation.isPending || createDefectCategoryMutation.isPending || updateDefectCategoryMutation.isPending || createDefectTypeMutation.isPending || updateDefectTypeMutation.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
