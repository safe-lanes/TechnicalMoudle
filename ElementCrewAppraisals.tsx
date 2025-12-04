import {
  EditIcon,
  EyeIcon,
  FilterIcon,
  Trash2Icon,
} from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import AgGridTableActions from '@/components/AgGrid/AgGridTableActions';
import { AppraisalForm } from "./AppraisalForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CrewMember, AppraisalResult } from "@shared/schema";
import { fromStorageCrew, CrewMemberDTO } from "@shared/crew-mapping";
import SectionTitleComponents from "@/components/Section/SectionTitleComponents";
import SideBarComponent from "@/components/Navbar/SideBarComponent";
import MainLayout from "@/components/main/MainLayout";
import { useVesselLookup } from "@/hooks/useVesselLookup";
import { DEFAULT_DROPDOWN_VESSEL_TYPES } from '@/utils/data/vesselTypes';

// Interface for combined crew member and appraisal data
interface CrewAppraisalData {
  id: string;
  employeeId: string;
  name: { first: string; middle: string; last: string };
  rank: string;
  nationality: string;
  age: string;
  vessel: string;
  vesselType: string;
  signOn: string;
  appraisalType: string;
  appraisalDate: string;
  status: string;
  competenceRating: { value: string; color: string };
  behavioralRating: { value: string; color: string };
  overallRating: { value: string; color: string };
  appraisalId?: number;
}

// Status badge component - moved outside component to avoid hooks issues
const StatusBadge = ({ status }: { status: string }) => {
  let bgColor = '';
  let textColor = '';
  let displayText = '';

  if (status === 'preliminary') {
    bgColor = 'bg-blue-100';
    textColor = 'text-blue-700';
    displayText = 'Preliminary';
  } else if (status === 'submitted') {
    bgColor = 'bg-amber-100';
    textColor = 'text-amber-700';
    displayText = 'Submitted';
  } else if (status === 'reviewed') {
    bgColor = 'bg-green-100';
    textColor = 'text-green-700';
    displayText = 'Reviewed';
  } else {
    bgColor = 'bg-gray-100';
    textColor = 'text-gray-700';
    displayText = status || 'N/A';
  }

  return (
    <Badge className={`rounded-md px-2.5 py-1 font-semibold ${bgColor} ${textColor} min-w-[90px] text-center`}>
      {displayText}
    </Badge>
  );
};

// Rating badge component - moved outside component to avoid hooks issues
const RatingBadge = ({ value, color }: { value: string; color: string }) => {
  const numValue = parseFloat(value);
  const formattedValue = numValue.toFixed(1);
  let bgColor = '';
  let textColor = '';

  if (numValue >= 4.0) {
    bgColor = 'bg-[#c3f2cb]';
    textColor = 'text-[#286e34]';
  } else if (numValue >= 3.0) {
    bgColor = 'bg-[#ffeaa7]';
    textColor = 'text-[#814c02]';
  } else if (numValue >= 2.0) {
    bgColor = 'bg-[#f9ecef]';
    textColor = 'text-[#811f1a]';
  } else {
    bgColor = 'bg-red-600';
    textColor = 'text-white';
  }

  return (
    <Badge className={`rounded-md px-2.5 py-1 font-bold ${bgColor} ${textColor} min-w-[48px] text-center`}>
      {formattedValue}
    </Badge>
  );
};

// Cell renderers moved outside component to avoid hooks issues
const StatusCellRenderer = (params: ICellRendererParams) => {
  // Defensive guard for AG Grid initialization
  if (!params.colDef || !params.data) return null;
  return <StatusBadge status={params.value || 'N/A'} />;
};

const RatingCellRenderer = (params: ICellRendererParams) => {
  // Defensive guard for AG Grid initialization
  if (!params.colDef || !params.data) return null;
  
  if (params.value === "N/A") {
    return <Badge className="rounded-md px-2.5 py-1 font-bold bg-gray-400 text-white min-w-[48px] text-center">N/A</Badge>;
  }
  return <RatingBadge value={params.value} color={params.data.competenceRating.color} />;
};

const ActionsCellRenderer = (params: ICellRendererParams & { context: { handleEditClick: (data: CrewAppraisalData) => void } }) => {
  // Defensive guard for AG Grid initialization
  if (!params.colDef || !params.data) return null;
  
  return (
    <div className="flex gap-2 justify-center">
      <Button variant="ghost" size="icon" className="h-6 w-6">
        <EyeIcon className="h-[18px] w-[18px] text-gray-500" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => params.context.handleEditClick(params.data)}
      >
        <EditIcon className="h-[18px] w-[18px] text-gray-500" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6">
        <Trash2Icon className="h-[18px] w-[18px] text-gray-500" />
      </Button>
    </div>
  );
};

export const ElementCrewAppraisals = (): JSX.Element => {
  const [selectedAdminPage, setSelectedAdminPage] = useState("all");
  const [selectedCrewMember, setSelectedCrewMember] = useState<CrewAppraisalData | null>(null);
  const [showAppraisalForm, setShowAppraisalForm] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  // Filter state
  const [filters, setFilters] = useState({
    searchName: "",
    rank: "",
    vessel: "",
    vesselType: "",
    nationality: "",
    appraisalType: "",
    rating: ""
  });

  // Vessel lookup for ID to name translation
  const { getVesselName } = useVesselLookup();

  // Fetch crew members and appraisal results
  const { data: crewMembers = [], isLoading: isLoadingCrew } = useQuery<CrewMember[]>({
    queryKey: ["/api/crew-members"],
    queryFn: async () => {
      const response = await fetch("/api/crew-members");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
  });

  const { data: appraisalResults = [], isLoading: isLoadingAppraisals } = useQuery<AppraisalResult[]>({
    queryKey: ["/api/appraisals"],
    queryFn: async () => {
      const response = await fetch("/api/appraisals");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
  });

  // Fetch master data for filters
  const { data: availableRanks = [] } = useQuery<Array<{ id: number; name: string; category: string }>>({
    queryKey: ["/api/available-ranks"],
  });

  const { data: vesselMasterData = [] } = useQuery<Array<{ entryId: string; name: string }>>({
    queryKey: ["/api/masters/014/data"],
  });

  const { data: vesselTypeMasterData = [] } = useQuery<Array<{ entryId: string; name: string; level?: number; parentId?: string | null; code?: string }>>({
    queryKey: ["/api/masters/004/data"],
  });

  const { data: nationalityMasterData = [] } = useQuery<Array<{ entryId: string; name: string; countryName?: string }>>({
    queryKey: ["/api/masters/001/data"],
  });

  // Extract unique values from crew data for filters that have empty master data
  const uniqueNationalities = useMemo(() => {
    if (nationalityMasterData.length > 0) return nationalityMasterData;
    
    const nationalities = new Set<string>();
    crewMembers.forEach(crew => {
      const crewDTO = fromStorageCrew(crew);
      if (crewDTO.nationality) {
        nationalities.add(crewDTO.nationality);
      }
    });
    return Array.from(nationalities).sort().map((nat, index) => ({
      entryId: `NAT-${index}`,
      name: nat,
      countryName: nat
    }));
  }, [nationalityMasterData, crewMembers]);

  const uniqueVesselTypes = useMemo(() => {
    // Filter to Level 2 and Level 3 types for dropdown (not Level 1 categories)
    if (vesselTypeMasterData.length > 0) {
      const filteredTypes = vesselTypeMasterData.filter(vt => vt.level && vt.level >= 2);
      if (filteredTypes.length > 0) return filteredTypes;
    }
    
    // Fallback to static data
    return DEFAULT_DROPDOWN_VESSEL_TYPES.map((vt, index) => ({
      entryId: `VT-${index}`,
      name: vt
    }));
  }, [vesselTypeMasterData]);

  const handleEditClick = useCallback((crewMember: CrewAppraisalData) => {
    setSelectedCrewMember(crewMember);
    setShowAppraisalForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowAppraisalForm(false);
    setSelectedCrewMember(null);
  }, []);


  // Helper function to get rating color based on value
  const getRatingColor = useCallback((rating: string): string => {
    const numRating = parseFloat(rating);
    if (numRating >= 4.0) return "bg-[#c3f2cb] text-[#286e34]"; // Green
    if (numRating >= 3.0) return "bg-[#ffeaa7] text-[#814c02]"; // Yellow
    if (numRating >= 2.0) return "bg-[#f9ecef] text-[#811f1a]"; // Light Pink
    return "bg-red-600 text-white"; // Dark Red
  }, []);

  // Combine crew member and appraisal data
  const allCrewData: CrewAppraisalData[] = useMemo(() =>
    crewMembers.map((crewMember) => {
      // Transform raw database data to frontend DTO format
      const crewDTO = fromStorageCrew(crewMember);
      const appraisal = appraisalResults.find(ar => ar.crewMemberId === crewMember.id);

      // Extract vessel ID and translate to vessel name
      const vesselId = crewDTO.vessel || crewDTO.presentVessel || "";
      const vesselName = vesselId ? getVesselName(vesselId) : "";

      return {
        id: crewDTO.id,
        employeeId: crewDTO.employeeId || "", // Add employeeId for crew ID display
        name: {
          first: crewDTO.firstName,
          middle: crewDTO.middleName || "",
          last: crewDTO.lastName || crewDTO.familyName || "",
        },
        rank: crewDTO.rank || crewDTO.presentRank || "",
        nationality: crewDTO.nationality || "",
        age: crewDTO.ageInYears || crewDTO.age || "",
        vessel: vesselName || vesselId || "",
        vesselType: crewDTO.vesselType || "",
        signOn: crewDTO.signOnDate || crewDTO.joiningDate || "",
        appraisalType: appraisal?.appraisalType || "Not Started",
        appraisalDate: appraisal?.appraisalDate || "N/A",
        status: appraisal?.status || "N/A",
        competenceRating: {
          value: appraisal?.competenceRating || "N/A",
          color: appraisal?.competenceRating ? getRatingColor(appraisal.competenceRating) : "bg-gray-400 text-white",
        },
        behavioralRating: {
          value: appraisal?.behavioralRating || "N/A",
          color: appraisal?.behavioralRating ? getRatingColor(appraisal.behavioralRating) : "bg-gray-400 text-white",
        },
        overallRating: {
          value: appraisal?.overallRating || "N/A",
          color: appraisal?.overallRating ? getRatingColor(appraisal.overallRating) : "bg-gray-400 text-white",
        },
        appraisalId: appraisal?.id,
      };
    }), [crewMembers, appraisalResults, getRatingColor, getVesselName]);

  // Filter crew data based on filter state
  const crewData = useMemo(() =>
    allCrewData.filter((crew) => {
      // Only show crew members who have at least Stage 1 submitted (status: Preliminary, Submitted, or Reviewed)
      const status = crew.status.toLowerCase();
      if (!['preliminary', 'submitted', 'reviewed'].includes(status)) {
        return false;
      }
      
      const fullName = `${crew.name.first} ${crew.name.middle} ${crew.name.last}`.toLowerCase();

      // Name search filter
      if (filters.searchName && !fullName.includes(filters.searchName.toLowerCase())) {
        return false;
      }

      // Rank filter
      if (filters.rank && crew.rank.toLowerCase() !== filters.rank.toLowerCase()) {
        return false;
      }

      // Vessel filter
      if (filters.vessel && crew.vessel.toLowerCase() !== filters.vessel.toLowerCase()) {
        return false;
      }

      // Vessel type filter
      if (filters.vesselType && crew.vesselType.toLowerCase() !== filters.vesselType.toLowerCase()) {
        return false;
      }

      // Nationality filter
      if (filters.nationality && crew.nationality.toLowerCase() !== filters.nationality.toLowerCase()) {
        return false;
      }

      // Appraisal type filter
      if (filters.appraisalType && crew.appraisalType.toLowerCase() !== filters.appraisalType.toLowerCase()) {
        return false;
      }

      // Rating filter
      if (filters.rating && crew.overallRating.value !== "N/A") {
        const rating = parseFloat(crew.overallRating.value);
        if (filters.rating === "high" && rating < 4.0) return false;
        if (filters.rating === "medium" && (rating < 3.0 || rating >= 4.0)) return false;
        if (filters.rating === "low" && rating >= 3.0) return false;
      }

      return true;
    }), [allCrewData, filters]);

  // Column definitions for AG Grid with Enterprise features
  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Crew ID',
      field: 'employeeId',
      flex: 0.7,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
      pinned: 'left',
      hide: true
    },
    {
      headerName: 'Name',
      field: 'fullName',
      flex: 1.2,
      valueGetter: (params) => `${params.data.name.first} ${params.data.name.middle} ${params.data.name.last}`,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
      pinned: 'left'
    },
    {
      headerName: 'Rank',
      field: 'rank',
      flex: 0.8,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Nationality',
      field: 'nationality',
      flex: 0.8,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Age',
      field: 'age',
      flex: 0.5,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agNumberColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: true
    },
    {
      headerName: 'Vessel',
      field: 'vessel',
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Type',
      field: 'vesselType',
      flex: 0.7,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Sign-On',
      field: 'signOn',
      flex: 0.8,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'App. Type',
      field: 'appraisalType',
      flex: 0.9,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'App. Date',
      field: 'appraisalDate',
      flex: 0.8,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Status',
      field: 'status',
      flex: 0.9,
      cellRenderer: StatusCellRenderer,
      cellClass: 'flex items-center justify-center',
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Comp. Rating',
      field: 'competenceRating.value',
      flex: 0.9,
      cellRenderer: RatingCellRenderer,
      cellClass: 'flex items-center justify-center',
      filter: 'agNumberColumnFilter',
      sortable: true,
      resizable: true,
      enableValue: true,
      aggFunc: 'avg',
      hide: true
    },
    {
      headerName: 'Behav. Rating',
      field: 'behavioralRating.value',
      flex: 0.9,
      cellRenderer: RatingCellRenderer,
      cellClass: 'flex items-center justify-center',
      filter: 'agNumberColumnFilter',
      sortable: true,
      resizable: true,
      enableValue: true,
      aggFunc: 'avg',
      hide: true
    },
    {
      headerName: 'Overall',
      field: 'overallRating.value',
      flex: 0.7,
      cellRenderer: RatingCellRenderer,
      cellClass: 'flex items-center justify-center',
      filter: 'agNumberColumnFilter',
      sortable: true,
      resizable: true,
      enableValue: true,
      aggFunc: 'avg'
    },
    {
      headerName: 'Actions',
      field: 'actions',
      flex: 0.6,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      cellClass: 'flex items-center justify-center',
      pinned: 'right',
      lockPosition: true
    }
  ], []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    // Auto-size columns to fit the available space
    params.api.sizeColumnsToFit();
    
    // Add window resize listener for responsive behavior
    const handleResize = () => {
      setTimeout(() => {
        params.api.sizeColumnsToFit();
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Early return after all hooks
  if (isLoadingCrew || isLoadingAppraisals) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading crew appraisals...</div>
      </div>
    );
  }

  return (
    <>
      <SideBarComponent selectedAdminPage={selectedAdminPage} setSelectedAdminPage={setSelectedAdminPage} allowedPages={["all"]} />
      <MainLayout>
        <SectionTitleComponents title="Crew Appraisals">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-8 w-32 text-[#8798ad] text-xs border-[#e1e8ed]"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FilterIcon className="h-3 w-3 mr-1" />
              Toggle Filters
            </Button>
          </div>
        </SectionTitleComponents>
        {/* Filters Section */}
        {showFilters && (
          <div className="flex flex-wrap gap-4 mb-4 p-4 pl-0 bg-[#f7fafc] rounded-lg">
            <div className="flex gap-4 flex-wrap">
              <Input
                placeholder="Search by name..."
                className="h-8 w-48 text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae]"
                value={filters.searchName}
                onChange={(e) => setFilters(prev => ({ ...prev, searchName: e.target.value }))}
              />

              <Select value={filters.rank} onValueChange={(value) => setFilters(prev => ({ ...prev, rank: value }))}>
                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]">
                  <SelectValue placeholder="Rank" />
                </SelectTrigger>
                <SelectContent>
                  {availableRanks.map((rank) => (
                    <SelectItem key={rank.id} value={rank.name}>
                      {rank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.vessel} onValueChange={(value) => setFilters(prev => ({ ...prev, vessel: value }))}>
                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]">
                  <SelectValue placeholder="Vessel" />
                </SelectTrigger>
                <SelectContent>
                  {vesselMasterData.map((vessel) => (
                    <SelectItem key={vessel.entryId} value={vessel.name}>
                      {vessel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.vesselType} onValueChange={(value) => setFilters(prev => ({ ...prev, vesselType: value }))}>
                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]">
                  <SelectValue placeholder="Vessel Type" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueVesselTypes.map((vesselType) => (
                    <SelectItem key={vesselType.entryId} value={vesselType.name}>
                      {vesselType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.nationality} onValueChange={(value) => setFilters(prev => ({ ...prev, nationality: value }))}>
                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]">
                  <SelectValue placeholder="Nationality" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueNationalities.map((nationality) => (
                    <SelectItem key={nationality.entryId} value={nationality.countryName || nationality.name}>
                      {nationality.countryName || nationality.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.appraisalType} onValueChange={(value) => setFilters(prev => ({ ...prev, appraisalType: value }))}>
                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]">
                  <SelectValue placeholder="Appraisal Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mid-Contract">Mid-Contract</SelectItem>
                  <SelectItem value="End-Contract">End-Contract</SelectItem>
                  <SelectItem value="Annual">Annual</SelectItem>
                  <SelectItem value="Promotion">Promotion</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.rating} onValueChange={(value) => setFilters(prev => ({ ...prev, rating: value }))}>
                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]">
                  <SelectValue placeholder="Rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High (4-5)</SelectItem>
                  <SelectItem value="medium">Medium (3-4)</SelectItem>
                  <SelectItem value="low">Low (1-3)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button className="h-8 w-20 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px]">
                Apply
              </Button>

              <Button
                variant="outline"
                className="h-8 w-20 text-[#8798ad] text-xs border-[#e1e8ed]"
                onClick={() => setFilters({
                  searchName: "",
                  rank: "",
                  vessel: "",
                  vesselType: "",
                  nationality: "",
                  appraisalType: "",
                  rating: ""
                })}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* AG Grid Enterprise Table with Actions */}
        <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg">
          <CardContent className="p-4 pl-0 bg-[#f7fafc]">
            <AgGridTable
              rowData={crewData}
              columnDefs={columnDefs}
              onGridReady={onGridReady}
              context={{ handleEditClick }}
              autoHeight={true}
              maxHeight="500px"
              minHeight="200px"
              width="100%"
              enableExport={true}
              enableSideBar={true}
              enableStatusBar={false}
              enableRowGrouping={true}
              enablePivoting={true}
              enableAdvancedFilter={false}
              rowSelection={false}
              theme="alpine"
            />

            {/* Custom footer within the table area */}
            <div className="bg-white border-t border-gray-200 px-4 py-3 flex justify-between items-center" style={{ marginTop: '-1px' }}>
              <div className="text-xs font-normal font-['Mulish',Helvetica] text-black">
                Rows: {crewData.length > 0 ? crewData.length : 0}
              </div>
              <div>
                <AgGridTableActions
                  gridApi={gridApi}
                  exportFilename="crew-appraisals"
                  showExportButtons={true}
                  showFilterButtons={true}
                  showGroupButtons={true}
                  showSelectionButtons={false}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Appraisal Form Modal */}
        {showAppraisalForm && selectedCrewMember && (
          <AppraisalForm
            crewMember={selectedCrewMember}
            appraisalId={selectedCrewMember.appraisalId}
            initialStatus={selectedCrewMember.status as 'draft' | 'preliminary' | 'submitted' | 'reviewed'}
            onClose={handleCloseForm}
          />
        )}
      </MainLayout>
    </>
  );
};