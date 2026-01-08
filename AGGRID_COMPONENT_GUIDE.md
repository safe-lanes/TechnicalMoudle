# AG Grid Enterprise Component Guide

This guide provides comprehensive documentation for using the AG Grid Enterprise components in the Element Crew Appraisals System.

## Overview

The system uses AG Grid Enterprise as the standard table component across all modules. The reusable `AgGridTable` component provides consistent implementation with enterprise features pre-configured, optimized for clean appearance and responsive behavior.

## Key Features

- **Enterprise License**: Fully licensed AG Grid Enterprise with all premium features
- **Clean Design**: Single header row, no checkbox columns by default, optimized spacing
- **Dynamic Height**: Auto-adjusting table height with smart scroll behavior
- **Advanced Filtering**: Column filters and advanced filter builder (floating filters disabled)
- **Data Export**: Excel and CSV export capabilities
- **Row Grouping**: Hierarchical data organization
- **Pivoting**: Data summarization and analysis
- **Column Management**: Resizable, sortable, and moveable columns
- **Status Bar**: Row count and aggregation display (selection count hidden when no selection)
- **Side Bar**: Column and filter management panels
- **Responsive Scroll**: Vertical scroll only appears when content exceeds screen height

## Component Architecture

### Import Paths

```typescript
import AgGridTable from '@/components/AgGrid/AgGridTable';
import AgGridTableActions from '@/components/AgGrid/AgGridTableActions';
```

### AgGridTable Component

The main reusable table component with the following props:

```typescript
interface AgGridTableProps {
  rowData: any[];
  columnDefs: ColDef[];
  onGridReady?: (event: GridReadyEvent) => void;
  gridOptions?: Partial<GridOptions>;
  className?: string;
  width?: string;
  height?: string;
  enableSideBar?: boolean;
  enableStatusBar?: boolean;
  enableRowGrouping?: boolean;
  enablePivoting?: boolean;
  enableAdvancedFilter?: boolean;
  rowSelection?: 'single' | 'multiple' | false; // Default: false (no checkboxes)
  theme?: 'alpine' | 'balham' | 'material';
  context?: any; // Pass custom context to cell renderers
  autoHeight?: boolean; // Enable dynamic height calculation
  maxHeight?: string; // Maximum table height
  minHeight?: string; // Minimum table height
}
```

### Default Configuration

The component comes with these optimized defaults:

- **Single Header Row**: No floating filters for cleaner appearance
- **No Row Selection**: Checkbox columns disabled by default
- **Dynamic Height**: Automatically adjusts to content with smart scrolling
- **Blue Header**: #52baf3 background with white text
- **Row Hover**: Light gray hover effect on rows
- **No Cell Borders**: Clean appearance without vertical cell borders
- **Rounded Corners**: 8px border radius for modern look

## Column Definition Options

### Complete ColDef Interface

The following properties are commonly used in column definitions:

```typescript
interface ColDef {
  // Basic Configuration
  field: string;                    // Data field name
  headerName: string;               // Column header display text
  flex?: number;                    // Flexible column width (e.g., 0.8, 1.2)
  width?: number;                   // Fixed column width in pixels
  minWidth?: number;                // Minimum column width
  maxWidth?: number;                // Maximum column width
  hide?: boolean;                   // Hide column by default (visible in column panel)
  
  // Sorting & Filtering
  sortable?: boolean;               // Enable column sorting
  filter?: string | boolean;        // Filter type (see Filter Types below)
  resizable?: boolean;              // Allow column resizing
  
  // Cell Rendering
  cellRenderer?: React.ComponentType; // Custom cell renderer component
  cellStyle?: object;               // Inline CSS styles for cells
  cellClass?: string;               // CSS class for cells
  valueGetter?: (params) => any;    // Compute cell value from row data
  valueFormatter?: (params) => string; // Format cell value for display
  
  // Enterprise Features
  enableRowGroup?: boolean;         // Enable row grouping on this column
  enablePivot?: boolean;            // Enable pivot on this column
  enableValue?: boolean;            // Enable value aggregation
  aggFunc?: string;                 // Aggregation function: 'sum', 'avg', 'count', 'min', 'max'
}
```

### Filter Types

AG Grid provides specialized filter types for different data:

| Filter Type | Use Case | Example |
|-------------|----------|---------|
| `agTextColumnFilter` | Text/string columns | Name, Description |
| `agNumberColumnFilter` | Numeric columns | Age, Salary, Ratings |
| `agDateColumnFilter` | Date columns | Sign-On Date, Appraisal Date |
| `agSetColumnFilter` | Multi-select dropdown (Enterprise) | Rank, Nationality, Status |

### Flex Column Sizing

Use `flex` property for responsive column widths that adjust proportionally:

```typescript
const columnDefs = [
  { field: 'name', headerName: 'Name', flex: 1.2 },      // Wider column
  { field: 'rank', headerName: 'Rank', flex: 0.8 },      // Narrower column
  { field: 'age', headerName: 'Age', flex: 0.5 },        // Smallest column
  { field: 'vessel', headerName: 'Vessel', flex: 1 }     // Standard column
];
```

### Cell Styling

Apply inline styles or CSS classes to cells:

```typescript
{
  field: 'name',
  headerName: 'Name',
  cellStyle: { fontSize: '13px', color: '#4f5863' },
  cellClass: 'flex items-center justify-center'
}
```

### Value Getters

Compute cell values from multiple row fields:

```typescript
{
  headerName: 'Full Name',
  field: 'fullName',
  valueGetter: (params) => {
    return `${params.data.name.first} ${params.data.name.middle} ${params.data.name.last}`;
  }
}
```

### Hidden Columns

Hide columns by default (users can show them via column panel):

```typescript
{
  field: 'crewId',
  headerName: 'Crew ID',
  hide: true  // Hidden by default, visible in column panel
}
```

## Custom Cell Renderers

Custom cell renderers allow rich content display within cells. Define renderers outside your component to avoid React hooks issues.

### Status Badge Renderer

```tsx
import { ICellRendererParams } from 'ag-grid-community';
import { Badge } from "@/components/ui/badge";

const StatusCellRenderer = (params: ICellRendererParams) => {
  // Defensive guard for AG Grid initialization
  if (!params.colDef || !params.data) return null;
  
  const status = params.value || 'N/A';
  let bgColor = '';
  let textColor = '';
  let displayText = status;

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
  }

  return (
    <Badge className={`rounded-md px-2.5 py-1 font-semibold ${bgColor} ${textColor} min-w-[90px] text-center`}>
      {displayText}
    </Badge>
  );
};
```

### Rating Badge Renderer

```tsx
const RatingCellRenderer = (params: ICellRendererParams) => {
  if (!params.colDef || !params.data) return null;
  
  if (params.value === "N/A") {
    return (
      <Badge className="rounded-md px-2.5 py-1 font-bold bg-gray-400 text-white min-w-[48px] text-center">
        N/A
      </Badge>
    );
  }
  
  const numValue = parseFloat(params.value);
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
```

### Actions Cell Renderer with Context

Use the `context` prop to pass handlers to cell renderers. In the Crew Appraisals implementation, only the Edit action is currently wired via context:

```tsx
// Define the renderer with typed context (Crew Appraisals uses handleEditClick only)
interface ActionsCellContext {
  handleEditClick: (data: any) => void;
}

const ActionsCellRenderer = (params: ICellRendererParams & { context: ActionsCellContext }) => {
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
```

> **Note**: The View and Delete buttons are rendered but not connected to handlers in the current implementation. Future updates may wire these via additional context handlers.

### Using Custom Renderers

```tsx
// Column definition
const columnDefs = [
  {
    headerName: 'Status',
    field: 'status',
    cellRenderer: StatusCellRenderer,
    cellClass: 'flex items-center justify-center'
  },
  {
    headerName: 'Rating',
    field: 'overallRating.value',
    cellRenderer: RatingCellRenderer,
    cellClass: 'flex items-center justify-center'
  },
  {
    headerName: 'Actions',
    field: 'actions',
    cellRenderer: ActionsCellRenderer,
    sortable: false,
    filter: false,
    cellClass: 'flex items-center justify-center'
  }
];

// Pass context to AgGridTable (Crew Appraisals only uses handleEditClick)
<AgGridTable
  rowData={data}
  columnDefs={columnDefs}
  context={{
    handleEditClick: (data) => { /* handle edit */ }
  }}
/>
```

## Usage Examples

### Basic Table

```tsx
import AgGridTable from '@/components/AgGrid/AgGridTable';

const MyComponent = () => {
  const columnDefs = [
    { field: 'name', headerName: 'Name' },
    { field: 'age', headerName: 'Age', filter: 'agNumberColumnFilter' },
    { field: 'country', headerName: 'Country' }
  ];

  const rowData = [
    { name: 'John Doe', age: 30, country: 'USA' },
    { name: 'Jane Smith', age: 25, country: 'UK' }
  ];

  return (
    <AgGridTable
      rowData={rowData}
      columnDefs={columnDefs}
      autoHeight={true}
      theme="alpine"
    />
  );
};
```

### Advanced Table with Enterprise Features

```tsx
const AdvancedTable = () => {
  const columnDefs = [
    {
      field: 'name',
      headerName: 'Name',
      enableRowGroup: true,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'department',
      headerName: 'Department',
      enableRowGroup: true,
      enablePivot: true
    },
    {
      field: 'salary',
      headerName: 'Salary',
      filter: 'agNumberColumnFilter',
      enableValue: true,
      aggFunc: 'sum'
    }
  ];

  return (
    <AgGridTable
      rowData={employeeData}
      columnDefs={columnDefs}
      enableSideBar={true}
      enableStatusBar={true}
      enableRowGrouping={true}
      enablePivoting={true}
      autoHeight={true}
      maxHeight="600px"
    />
  );
};
```

### Table with Export Actions

```tsx
import AgGridTable from '@/components/AgGrid/AgGridTable';
import AgGridTableActions from '@/components/AgGrid/AgGridTableActions';

const TableWithActions = () => {
  const [gridApi, setGridApi] = useState(null);

  const onGridReady = (event) => {
    setGridApi(event.api);
  };

  return (
    <div>
      <AgGridTable
        rowData={data}
        columnDefs={columns}
        onGridReady={onGridReady}
        autoHeight={true}
      />
      
      <AgGridTableActions
        gridApi={gridApi}
        filename="export_data"
        showExcelExport={true}
        showCsvExport={true}
        showPdfExport={false}
      />
    </div>
  );
};
```

## Crew Appraisals Table Configuration

The Crew Appraisals module uses a comprehensive AG Grid configuration. Here's the complete reference:

### Column Definitions

```typescript
const columnDefs: ColDef[] = [
  {
    headerName: 'Crew ID',
    field: 'employeeId',
    flex: 0.7,
    cellStyle: { fontSize: '13px', color: '#4f5863' },
    filter: 'agTextColumnFilter',
    sortable: true,
    resizable: true,
    hide: true  // Hidden by default
  },
  {
    headerName: 'Name',
    field: 'fullName',
    flex: 1.2,
    valueGetter: (params) => `${params.data.name.first} ${params.data.name.middle} ${params.data.name.last}`,
    cellStyle: { fontSize: '13px', color: '#4f5863' },
    filter: 'agTextColumnFilter',
    sortable: true,
    resizable: true
  },
  {
    headerName: 'Rank',
    field: 'rank',
    flex: 0.8,
    cellStyle: { fontSize: '13px', color: '#4f5863' },
    filter: 'agSetColumnFilter',  // Enterprise multi-select filter
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
    enableRowGroup: true  // Enabled for grouping
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
    hide: true  // Hidden by default, visible in column panel
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
    hide: true  // Hidden by default, visible in column panel
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
    aggFunc: 'avg'  // Average when grouped
  },
  {
    headerName: 'Actions',
    field: 'actions',
    flex: 0.6,
    cellRenderer: ActionsCellRenderer,
    sortable: false,
    filter: false,
    cellClass: 'flex items-center justify-center'
  }
];
```

### Grid Ready Handler

```typescript
const onGridReady = useCallback((params: GridReadyEvent) => {
  setGridApi(params.api);
  
  // Auto-size columns to fit available space
  params.api.sizeColumnsToFit();
  
  // Responsive resize handling
  const handleResize = () => {
    setTimeout(() => {
      params.api.sizeColumnsToFit();
    }, 100);
  };
  
  window.addEventListener('resize', handleResize);
  
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);
```

### Complete Implementation

```tsx
<AgGridTable
  rowData={crewData}
  columnDefs={columnDefs}
  onGridReady={onGridReady}
  enableSideBar={true}
  enableStatusBar={true}
  enableRowGrouping={true}
  context={{
    handleEditClick: (data) => {
      setSelectedCrewMember(data);
      setShowAppraisalForm(true);
    }
  }}
/>

<AgGridTableActions
  gridApi={gridApi}
  filename="crew_appraisals"
  showExcelExport={true}
  showCsvExport={true}
/>
```

## CSS Customization

The component includes custom CSS for optimal appearance:

```css
/* Blue header styling */
.ag-theme-alpine .ag-header {
  background-color: #52baf3 !important;
}

.ag-theme-alpine .ag-header-cell {
  background-color: #52baf3 !important;
  color: white !important;
  font-size: 12px !important;
  font-weight: normal !important;
  border-right: none !important;
}

/* Row styling */
.ag-theme-alpine .ag-row:hover {
  background-color: #f9fafb !important;
}

/* Remove cell borders */
.ag-theme-alpine .ag-cell {
  border-right: none !important;
  padding: 8px 16px !important;
}

/* Scroll control */
.ag-theme-alpine.no-scroll .ag-body-viewport {
  overflow-y: hidden !important;
}

.ag-theme-alpine.needs-scroll .ag-body-viewport {
  overflow-y: auto !important;
}
```

## AgGridTableActions Component

Companion component for export functionality:

```typescript
interface AgGridTableActionsProps {
  gridApi: GridApi | null;
  filename?: string;
  showExcelExport?: boolean;
  showCsvExport?: boolean;
  showPdfExport?: boolean;
  customActions?: React.ReactNode;
  className?: string;
}
```

## Best Practices

1. **Column Definitions**: Always define proper field names and header names
2. **Filtering**: Use appropriate filter types (agTextColumnFilter, agNumberColumnFilter, agDateColumnFilter, agSetColumnFilter)
3. **Height Management**: Use autoHeight with maxHeight for responsive behavior
4. **Export Naming**: Provide meaningful filenames for exports
5. **Performance**: Use virtual scrolling for large datasets (handled automatically)
6. **Accessibility**: Column headers and data are properly labeled for screen readers
7. **Custom Renderers**: Define cell renderers outside components to avoid React hooks issues
8. **Defensive Guards**: Always check `params.colDef` and `params.data` in cell renderers
9. **Context Usage**: Pass handlers via context prop for action buttons in cells

## Enterprise Features

- **Set Filtering**: Multi-select dropdown filters (agSetColumnFilter)
- **Advanced Filtering**: Complex filter expressions
- **Row Grouping**: Hierarchical data organization with `enableRowGroup`
- **Pivoting**: Data summarization and analysis with `enablePivot`
- **Aggregation**: Sum, average, count with `enableValue` and `aggFunc`
- **Excel Export**: Full Excel export with formatting
- **Range Selection**: Multi-cell selection and operations
- **Status Bar**: Comprehensive data statistics
- **Side Bar**: Advanced column and filter management

## License Configuration

The component automatically handles AG Grid Enterprise licensing:

```typescript
// License is set automatically from environment variables
const licenseKey = import.meta.env.VITE_AG_GRID_LICENSE_KEY || import.meta.env.AG_GRID_LICENSE_KEY;
if (licenseKey) {
  LicenseManager.setLicenseKey(licenseKey);
}
```

Ensure your environment has the `VITE_AG_GRID_LICENSE_KEY` variable set for frontend access.

## Troubleshooting

### License Issues
- Ensure `VITE_AG_GRID_LICENSE_KEY` is set in your environment
- Restart the development server after adding the license key
- Check browser console for license warnings

### Scroll Issues
- Use `autoHeight={true}` for automatic height management
- Set `maxHeight` to prevent tables from becoming too tall
- The component automatically manages scroll behavior based on content size

### Cell Renderer Issues
- Define renderers outside the main component function
- Always include defensive guards: `if (!params.colDef || !params.data) return null;`
- Use context prop for passing event handlers

### Performance
- For large datasets (>1000 rows), consider server-side row model
- Use column virtualization for tables with many columns
- Implement lazy loading for better initial load times
