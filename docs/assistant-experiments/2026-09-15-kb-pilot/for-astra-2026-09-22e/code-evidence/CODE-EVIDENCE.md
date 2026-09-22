# Code evidence — repository revision f5e4c0d545440bb4ae611401998dea710e03f31a (branch chatbot-enterprise)

Every block below is quoted from the working tree at that revision. Line numbers are 1-based and inclusive.

## Stores and Spares are separate screens, rendered side by side
`client/src/pages/TechnicalModule.tsx` lines 214-226
```
  214            ) : selectedSubModule === "pms" && selectedMenuItem === "work-orders" ? (
  215              <WorkOrders />
  216            ) : selectedSubModule === "pms" && selectedMenuItem === "running-hrs" ? (
  217              <RunningHours />
  218            ) : selectedSubModule === "pms" && selectedMenuItem === "spares" ? (
  219              <Spares />
  220            ) : selectedSubModule === "pms" && selectedMenuItem === "stores" ? (
  221              <Stores />
  222            ) : selectedSubModule === "pms" && selectedMenuItem === "modify-pms" ? (
  223              <ModifyPMS />
  224            ) : selectedSubModule === "pms" && selectedMenuItem === "modify-pms/jobs" ? (
  225              <JobsSelector />
  226            ) : selectedSubModule === "pms" && selectedMenuItem === "superintendent" ? (
```

## Stores has its own export to stores_<tab>_inventory / _history .xlsx
`client/src/pages/stores/Stores.tsx` lines 859-912
```
  859    };
  860    
  861    // Export to Excel functions
  862    const exportInventoryToExcel = () => {
  863      const now = new Date();
  864      const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
  865      const filename = `stores_${activeTab}_inventory_${timestamp}.xlsx`;
  866      
  867      const data = filteredItems.map(item => ({
  868        'Item Name': item.itemName,
  869        'Part Code': item.itemCode,
  870        'UOM': item.uom || '-',
  871        'ROB': item.rob,
  872        'Min': item.min,
  873        'Stock': item.stock,
  874        'Location': item.location,
  875        'Category': item.storesCategory
  876      }));
  877      
  878      const ws = XLSX.utils.json_to_sheet(data);
  879      const wb = XLSX.utils.book_new();
  880      XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  881      XLSX.writeFile(wb, filename);
  882      
  883      toast({ title: "Export Successful", description: `Exported ${data.length} items to ${filename}` });
  884    };
  885    
  886    const exportHistoryToExcel = () => {
  887      const now = new Date();
  888      const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
  889      const filename = `stores_${activeTab}_history_${timestamp}.xlsx`;
  890      
  891      const data = filteredHistoryItems.map(item => ({
  892        'Date': item.dateLocal,
  893        'Event': item.eventType,
  894        'Item Name': item.itemName,
  895        'Part Code': item.partCode,
  896        'UOM': item.uom || '-',
  897        'Qty Change': item.qtyChange > 0 ? `+${item.qtyChange}` : item.qtyChange.toString(),
  898        'ROB After': item.robAfter,
  899        'Place': item.place || '-',
  900        'User': item.userId,
  901        'Remarks/Ref': item.remarks || item.ref || '-'
  902      }));
  903      
  904      const ws = XLSX.utils.json_to_sheet(data);
  905      const wb = XLSX.utils.book_new();
  906      XLSX.utils.book_append_sheet(wb, ws, 'History');
  907      XLSX.writeFile(wb, filename);
  908      
  909      toast({ title: "Export Successful", description: `Exported ${data.length} entries to ${filename}` });
  910    };
  911    
  912    // Filter history items
```

## Stores LOCATION view controls: vessel selector, Search, All Categories, Stock (data-testid stores-loc-*)
`client/src/pages/stores/Stores.tsx` lines 2690-2770
```
 2690          {(isOfficeUser || isChangeMode) && (
 2691            <div className="flex items-center gap-2">
 2692              <span className="text-sm font-medium text-gray-600">Vessel:</span>
 2693              <Select value={(vesselId === 'all' || vesselId === 'my') ? '' : vesselId} onValueChange={setVesselId}>
 2694                <SelectTrigger className="w-[200px]" data-testid="stores-loc-vessel-selector">
 2695                  <SelectValue placeholder="Choose vessel" />
 2696                </SelectTrigger>
 2697                <SelectContent>
 2698                  {myVesselsEmpty ? (
 2699                    <div className="px-2 py-1.5 text-sm text-gray-500" data-testid="select-no-assigned-vessels">
 2700                      No assigned vessels
 2701                    </div>
 2702                  ) : (
 2703                    pickerVessels.map(vessel => (
 2704                      <SelectItem key={vessel.id} value={vessel.id}>
 2705                        {vessel.name}
 2706                      </SelectItem>
 2707                    ))
 2708                  )}
 2709                </SelectContent>
 2710              </Select>
 2711            </div>
 2712          )}
 2713          <div className="relative w-80">
 2714            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
 2715            <Input
 2716              placeholder="Search"
 2717              value={searchTerm}
 2718              onChange={(e) => setSearchTerm(e.target.value)}
 2719              className="pl-10"
 2720              data-testid="stores-loc-search"
 2721            />
 2722          </div>
 2723          <div>
 2724            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
 2725              <SelectTrigger className="w-40" data-testid="stores-loc-category-filter">
 2726                <SelectValue placeholder="All Categories" />
 2727              </SelectTrigger>
 2728              <SelectContent>
 2729                <SelectItem value="all">All Categories</SelectItem>
 2730                <SelectItem value="Engine">Engine Stores</SelectItem>
 2731                <SelectItem value="General">General Tools</SelectItem>
 2732                <SelectItem value="PPE">PPE / All Sections</SelectItem>
 2733                <SelectItem value="Machinery">General Machinery</SelectItem>
 2734              </SelectContent>
 2735            </Select>
 2736          </div>
 2737          <div>
 2738            <Select value={stockFilter} onValueChange={setStockFilter}>
 2739              <SelectTrigger className="w-32" data-testid="stores-loc-stock-filter">
 2740                <SelectValue placeholder="Stock" />
 2741              </SelectTrigger>
 2742              <SelectContent>
 2743                <SelectItem value="all">All</SelectItem>
 2744                <SelectItem value="OK">OK</SelectItem>
 2745                <SelectItem value="Low">Low</SelectItem>
 2746              </SelectContent>
 2747            </Select>
 2748          </div>
 2749          <Button 
 2750            variant="outline" 
 2751            size="sm" 
 2752            className="text-gray-600"
 2753            onClick={() => {
 2754              setSearchTerm("");
 2755              setCategoryFilter("all");
 2756              setStockFilter("all");
 2757            }}
 2758            data-testid="stores-loc-clear"
 2759          >
 2760            Clear
 2761          </Button>
 2762          <Button 
 2763            size="sm" 
 2764            className="bg-[#52baf3] hover:bg-[#3da8e0] text-white"
 2765            onClick={handleSaveAllLocRob}
 2766            disabled={isSavingLocRob || !canEditStore}
 2767            data-testid="stores-loc-save"
 2768          >
 2769            {isSavingLocRob ? 'Saving...' : 'Save'}
 2770          </Button>
```

## Stores INVENTORY view controls (the viewMode === 'inventory' branch): Search, All Categories, Stock
`client/src/pages/stores/Stores.tsx` lines 2772-2832
```
 2772        ) : viewMode === "inventory" ? (
 2773        <div className="flex gap-3 items-center">
 2774          {/* Vessel selector - visible for all Office users, or in change mode */}
 2775          {(isOfficeUser || isChangeMode) && (
 2776            <div className="flex items-center gap-2">
 2777              <span className="text-sm font-medium text-gray-600">Vessel:</span>
 2778              <Select value={(vesselId === 'all' || vesselId === 'my') ? '' : vesselId} onValueChange={setVesselId}>
 2779                <SelectTrigger className="w-[200px]" data-testid={getMarkerId(activeTab, "4")}>
 2780                  <Marker id={getMarkerId(activeTab, "4")} />
 2781                  <SelectValue placeholder="Choose vessel" />
 2782                </SelectTrigger>
 2783                <SelectContent>
 2784                  {myVesselsEmpty ? (
 2785                    <div className="px-2 py-1.5 text-sm text-gray-500" data-testid="select-no-assigned-vessels">
 2786                      No assigned vessels
 2787                    </div>
 2788                  ) : (
 2789                    pickerVessels.map(vessel => (
 2790                      <SelectItem key={vessel.id} value={vessel.id}>
 2791                        {vessel.name}
 2792                      </SelectItem>
 2793                    ))
 2794                  )}
 2795                </SelectContent>
 2796              </Select>
 2797            </div>
 2798          )}
 2799          <div className="relative w-80">
 2800            <Marker id={getMarkerId(activeTab, "5")} />
 2801            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
 2802            <Input
 2803              placeholder="Search"
 2804              value={searchTerm}
 2805              onChange={(e) => setSearchTerm(e.target.value)}
 2806              className="pl-10"
 2807              data-testid={getMarkerId(activeTab, "5")}
 2808            />
 2809          </div>
 2810          <div>
 2811            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
 2812              <SelectTrigger className="w-40" data-testid={getMarkerId(activeTab, "6")}>
 2813                <Marker id={getMarkerId(activeTab, "6")} />
 2814                <SelectValue placeholder="All Categories" />
 2815              </SelectTrigger>
 2816              <SelectContent>
 2817                <SelectItem value="all">All Categories</SelectItem>
 2818                <SelectItem value="Engine">Engine Stores</SelectItem>
 2819                <SelectItem value="General">General Tools</SelectItem>
 2820                <SelectItem value="PPE">PPE / All Sections</SelectItem>
 2821                <SelectItem value="Machinery">General Machinery</SelectItem>
 2822              </SelectContent>
 2823            </Select>
 2824          </div>
 2825          <div>
 2826            <Select value={stockFilter} onValueChange={setStockFilter}>
 2827              <SelectTrigger className="w-32" data-testid={getMarkerId(activeTab, "7")}>
 2828                <Marker id={getMarkerId(activeTab, "7")} />
 2829                <SelectValue placeholder="Stock" />
 2830              </SelectTrigger>
 2831              <SelectContent>
 2832                <SelectItem value="all">All</SelectItem>
```

## Stores HISTORY view: search box only
`client/src/pages/stores/Stores.tsx` lines 2855-2865
```
 2855        <div className="flex gap-3">
 2856          <div className="relative w-80">
 2857            <Marker id={getMarkerId(activeTab, "2.9")} />
 2858            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
 2859            <Input
 2860              placeholder="Search history..."
 2861              value={historySearch}
 2862              onChange={(e) => setHistorySearch(e.target.value)}
 2863              className="pl-10"
 2864              data-testid={getMarkerId(activeTab, "2.9")}
 2865            />
```

## Surveys editable columns: Survey Date, Due Date, 1st Range Date, 2nd Range Date, Postponed (editable: canEditSurvey, DateCellEditor)
`client/src/pages/cert-surveys/SurveysPage.tsx` lines 404-500
```
  404        headerName: 'Vessel',
  405        field: 'vessel',
  406        flex: 1,
  407        minWidth: 150,
  408        cellStyle: { fontSize: '13px', color: '#4f5863' },
  409        filter: 'agSetColumnFilter',
  410        sortable: true,
  411        resizable: true,
  412      },
  413      {
  414        headerName: 'Survey Date',
  415        field: 'surveyDate',
  416        width: 120,
  417        cellStyle: { fontSize: '13px', color: '#4f5863' },
  418        filter: 'agDateColumnFilter',
  419        sortable: true,
  420        resizable: true,
  421        editable: canEditSurvey,
  422        cellEditor: DateCellEditor,
  423        cellClass: 'editable-date-cell',
  424      },
  425      {
  426        headerName: 'Due Date',
  427        field: 'dueDate',
  428        width: 120,
  429        cellStyle: (params: any) => {
  430          const baseStyle = { fontSize: '13px' };
  431          if (!params.value) return { ...baseStyle, color: '#4f5863' };
  432          
  433          const months: { [key: string]: number } = { 
  434            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
  435            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 
  436          };
  437          const parts = params.value.split(' ');
  438          if (parts.length !== 3) return { ...baseStyle, color: '#4f5863' };
  439          
  440          const day = parseInt(parts[0], 10);
  441          const month = months[parts[1]];
  442          const year = parseInt(parts[2], 10);
  443          if (isNaN(day) || month === undefined || isNaN(year)) return { ...baseStyle, color: '#4f5863' };
  444          
  445          const dueDate = new Date(year, month, day);
  446          const today = new Date();
  447          today.setHours(0, 0, 0, 0);
  448          
  449          const twoMonthsFromNow = new Date(today);
  450          twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
  451          
  452          if (dueDate < today) {
  453            return { ...baseStyle, color: '#dc2626', fontWeight: '600' };
  454          } else if (dueDate <= twoMonthsFromNow) {
  455            return { ...baseStyle, color: '#f59e0b', fontWeight: '600' };
  456          }
  457          return { ...baseStyle, color: '#4f5863' };
  458        },
  459        filter: 'agDateColumnFilter',
  460        sortable: true,
  461        resizable: true,
  462        editable: canEditSurvey,
  463        cellEditor: DateCellEditor,
  464        cellClass: 'editable-date-cell',
  465      },
  466      {
  467        headerName: '1st Range Date',
  468        field: 'firstRangeDate',
  469        width: 130,
  470        cellStyle: { fontSize: '13px', color: '#4f5863' },
  471        filter: 'agDateColumnFilter',
  472        sortable: true,
  473        resizable: true,
  474        editable: canEditSurvey,
  475        cellEditor: DateCellEditor,
  476        cellClass: 'editable-date-cell',
  477      },
  478      {
  479        headerName: '2nd Range Date',
  480        field: 'secondRangeDate',
  481        width: 130,
  482        cellStyle: { fontSize: '13px', color: '#4f5863' },
  483        filter: 'agDateColumnFilter',
  484        sortable: true,
  485        resizable: true,
  486        editable: canEditSurvey,
  487        cellEditor: DateCellEditor,
  488        cellClass: 'editable-date-cell',
  489      },
  490      {
  491        headerName: 'Postponed',
  492        field: 'postponed',
  493        width: 120,
  494        cellStyle: { fontSize: '13px', color: '#4f5863' },
  495        filter: 'agDateColumnFilter',
  496        sortable: true,
  497        resizable: true,
  498        editable: canEditSurvey,
  499        cellEditor: DateCellEditor,
  500        cellClass: 'editable-date-cell',
```

## Spares filter controls: Search, Criticality, Rotation Item, Stock
`client/src/pages/spares/SparesNew.tsx` lines 3695-3742
```
 3695          <div className="relative w-80" data-testid="E5">
 3696            <Marker id="E5" />
 3697            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
 3698            <Input
 3699              placeholder="Search parts or components..."
 3700              value={searchTerm}
 3701              onChange={(e) => setSearchTerm(e.target.value)}
 3702              className="pl-10"
 3703            />
 3704          </div>
 3705  
 3706          <div className="relative" data-testid="E6">
 3707            <Marker id="E6" />
 3708            <Select value={criticalityFilter} onValueChange={setCriticalityFilter}>
 3709              <SelectTrigger className="w-32">
 3710                <SelectValue placeholder="Criticality" />
 3711              </SelectTrigger>
 3712              <SelectContent>
 3713                <SelectItem value="All">All</SelectItem>
 3714                <SelectItem value="Critical">Critical</SelectItem>
 3715                <SelectItem value="Non-critical">Non-critical</SelectItem>
 3716              </SelectContent>
 3717            </Select>
 3718          </div>
 3719  
 3720          <div className="relative" data-testid="filter-rotation-item">
 3721            <Select value={rotationItemFilter} onValueChange={setRotationItemFilter}>
 3722              <SelectTrigger className="w-40">
 3723                <SelectValue placeholder="Rotation Item" />
 3724              </SelectTrigger>
 3725              <SelectContent>
 3726                <SelectItem value="All">All</SelectItem>
 3727                <SelectItem value="Rotation Items">Rotation Items</SelectItem>
 3728                <SelectItem value="Non-Rotation Items">Non-Rotation Items</SelectItem>
 3729              </SelectContent>
 3730            </Select>
 3731          </div>
 3732  
 3733          <div className="relative" data-testid="E7">
 3734            <Marker id="E7" />
 3735            <Select value={stockFilter} onValueChange={setStockFilter}>
 3736              <SelectTrigger className="w-32">
 3737                <SelectValue placeholder="Stock" />
 3738              </SelectTrigger>
 3739              <SelectContent>
 3740                <SelectItem value="All">All</SelectItem>
 3741                <SelectItem value="OK">OK</SelectItem>
 3742                <SelectItem value="At Min">At Min</SelectItem>
```

## Surveys edits in the grid rather than on another screen
`client/src/pages/cert-surveys/SurveysPage.tsx` lines 104-112
```
  104  };
  105  
  106  export default function SurveysPage() {
  107    const { isClientAdmin, isSailAdmin, isTechSuperintendent } = useUIRole();
  108    const { canEdit } = usePermissions();
  109    const canEditSurvey = canEdit('cert-surveys-page');
  110    const [showFilters, setShowFilters] = useState(true);
  111    const [filterValue, setFilterValue] = useState<VesselFleetGroupFilterValue>(createDefaultFilterValue());
  112    const [selectedVesselNames, setSelectedVesselNames] = useState<string[]>([]);
```

## Surveys has its own PDF / CSV / Excel export
`client/src/pages/cert-surveys/SurveysPage.tsx` lines 586-596
```
  586      return allSurveys;
  587    }, [selectedVesselNames, dueInFilter]);
  588  
  589    const handleExportPdf = useCallback(async () => {
  590      const columns: TableColumn[] = [
  591        { header: 'Company ID', field: 'companyId', width: 18 },
  592        { header: 'Survey', field: 'surveyName', width: 35 },
  593        { header: 'Company Group', field: 'type', width: 20 },
  594        { header: 'Vessel', field: 'vessel', width: 22 },
  595        { header: 'Survey Date', field: 'surveyDate', width: 20 },
  596        { header: 'Due Date', field: 'dueDate', width: 20 },
```

## Certificates has its own PDF / CSV / Excel export too
`client/src/pages/cert-surveys/CertificatesPage.tsx` lines 971-980
```
  971    }, [selectedVesselNames, sortBy, sortOrder, dueInFilter]);
  972  
  973    const handleExportPdf = useCallback(async () => {
  974      const columns: TableColumn[] = [
  975        { header: 'Company ID', field: 'id', width: 18 },
  976        { header: 'Name of Certificate', field: 'certificateName', width: 35 },
  977        { header: 'Company Group', field: 'type', width: 20 },
  978        { header: 'Vessel', field: 'vessel', width: 22 },
  979        { header: 'Certificate No.', field: 'certificateNumber', width: 22 },
  980        { header: 'Issue Date', field: 'issueDate', width: 20 },
```

## CoC is its own page with its own export
`client/src/pages/defects/DefectsCoC.tsx` lines 418-428
```
  418      });
  419    };
  420  
  421    const handleExportPdf = () => {
  422      const formatDate = (dateStr: string | null | undefined): string => {
  423        if (!dateStr) return "-";
  424        const parts = dateStr.split("-");
  425        if (parts.length === 3 && parts[0].length === 4) {
  426          return `${parts[2]}-${parts[1]}-${parts[0]}`;
  427        }
  428        return dateStr;
```

## CoC records are created through the SHARED defect form, with is_coc set
`client/src/pages/defects/DefectFormWizard.tsx` lines 184-202
```
  184    const currentDefect = defect || fetchedDefect;
  185    
  186    // Compute the correct is_coc default: use existing defect value if available, otherwise use isCoc prop for new defects
  187    const defaultIsCoc = currentDefect?.is_coc ?? isCoc;
  188    
  189    const form = useForm<DefectFormData>({
  190      resolver: zodResolver(defectFormSchema),
  191      defaultValues: {
  192        vesselId: "",
  193        vesselName: "",
  194        issueDate: new Date().toISOString().split('T')[0],
  195        category: "Defect",
  196        equipmentCategory: "",
  197        status: "Open",
  198        priority: "Medium",
  199        critical: false,
  200        is_coc: defaultIsCoc, // Use defect's value if editing, or isCoc prop for new defects
  201        severity: 1,
  202        reportedBy: "MASTER",
```

## The one line that causes every defect: the source body is pasted verbatim
`central-assistant-py/indexer/xrefs.py` lines 218-227
```
  218      """A pasted figure caption describes the SOURCE screen, not the destination. Mark it as such and
  219      leave the caption text itself intact — captions sometimes carry the only statement of a step."""
  220      def mark(m: re.Match) -> str:
  221          return f"{m.group(1)}[illustration of the {src_parent} screen] {m.group(2)}"
  222      return re.sub(r"(?mi)^(\s*(?:screenshot(?:_from_computer)?|screen shot)\s*:\s*)(.*)$", mark, body)
  223  
  224  
  225  _GENERIC_OBJ = {"how", "to", "a", "an", "the", "and", "or", "record", "records", "details", "report",
  226                  "reports", "crew", "new", "all", "test", "item", "items", "data"}
  227  
```

## Counted evidence — an absence is the point

| claim | occurrences |
|---|---:|
| Certificates page editable columns (each 'editable: canEdit') | 8 |
| Surveys page editable columns (each 'editable: canEditSurvey') | 5 |
| 'Issue Date' anywhere in the Surveys page | 0 |
| 'criticality' anywhere in the Stores screen | 0 |
| 'rotation' anywhere in the Stores screen | 0 |
| 'Certificates' anywhere in the Surveys page | 0 |
| 'Add Group' in the Surveys page | 0 |
| 'Add Group' in the Certificates page | 0 |
| 'Due Status' in the Surveys page | 0 |
| 'Due in' in the Surveys page (the control that exists instead) | 1 |

## What the code does NOT establish

- The Crewing screens (Appraisals, Crew Promotion, the Annual/Periodic/Monthly/Other/
  Summary drug & alcohol tests, and the Recruited/Waitlist/Rejected crew lists) are **not in
  this repository**. The SAILERP backend holds crew-appraisal entities, but the screens'
  filter chips and buttons are not available to check. Every Crewing destination field list
  is therefore UNRESOLVED and must not be restated by the repair.
- For CoC, a shared creation form establishes only that **creation** transfers. It does not
  establish that every filter, export and permission transfers; those stay UNRESOLVED.
- 'Add Group' does not appear in the Certificates page either, so the manual's Certificates
  filter list is itself stale against the code. The repair must not copy that list into
  Surveys as though it were verified.