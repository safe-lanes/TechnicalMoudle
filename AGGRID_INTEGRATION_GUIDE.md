
# AG Grid Enterprise Integration Guide

This guide provides step-by-step instructions to integrate the standardized AG Grid Enterprise table component into any module within the Element system.

## Quick Setup Checklist

### 1. Prerequisites
- AG Grid Enterprise packages already installed (ag-grid-react, ag-grid-community, ag-grid-enterprise)
- License key configured in environment variables
- Existing AgGridTable and AgGridTableActions components available

### 2. Copy Required Files
Ensure these files exist in your project:
```
client/src/components/AgGridTable.tsx
client/src/components/AgGridTableActions.tsx
client/src/index.css (with AG Grid styling)
```

### 3. Environment Setup
Ensure your `.env.local` contains:
```
VITE_AG_GRID_LICENSE_KEY=your_license_key_here
```

## Implementation Template

### Basic Table Implementation

```tsx
import React, { useState, useMemo, useCallback } from 'react';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import AgGridTable from '@/components/AgGridTable';
import AgGridTableActions from '@/components/AgGridTableActions';
import { Card, CardContent } from '@/components/ui/card';

// Define your data interface
interface YourDataInterface {
  id: string;
  field1: string;
  field2: string;
  // Add your fields here
}

export const YourTableComponent = () => {
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  
  // Sample data - replace with your actual data
  const data: YourDataInterface[] = [
    { id: '1', field1: 'Value 1', field2: 'Value 2' },
    // Your data here
  ];

  // Column definitions
  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'ID',
      field: 'id',
      width: 100,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
      pinned: 'left'
    },
    {
      headerName: 'Field 1',
      field: 'field1',
      width: 150,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: true
    },
    {
      headerName: 'Field 2',
      field: 'field2',
      width: 150,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: true
    }
  ], []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  return (
    <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg">
      <CardContent className="p-4 bg-[#f7fafc]">
        <AgGridTable
          rowData={data}
          columnDefs={columnDefs}
          onGridReady={onGridReady}
          autoHeight={true}
          maxHeight="500px"
          minHeight="200px"
          width="100%"
          enableExport={true}
          enableSideBar={true}
          enableStatusBar={true}
          enableRowGrouping={true}
          enablePivoting={true}
          enableAdvancedFilter={false}
          rowSelection={false}
          theme="alpine"
        />
        
        {/* Custom footer */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex justify-between items-center" style={{ marginTop: '-1px' }}>
          <div className="text-xs font-normal font-['Mulish',Helvetica] text-black">
            Rows: {data.length}
          </div>
          <div>
            <AgGridTableActions 
              gridApi={gridApi}
              exportFilename="your-data-export"
              showExportButtons={true}
              showFilterButtons={true}
              showGroupButtons={true}
              showSelectionButtons={false}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
```

## Column Configuration Examples

### Text Column with Filter
```tsx
{
  headerName: 'Name',
  field: 'name',
  width: 180,
  cellStyle: { fontSize: '13px', color: '#4f5863' },
  filter: 'agTextColumnFilter',
  sortable: true,
  resizable: true,
  enableRowGroup: true
}
```

### Number Column with Aggregation
```tsx
{
  headerName: 'Amount',
  field: 'amount',
  width: 120,
  cellStyle: { fontSize: '13px', color: '#4f5863' },
  filter: 'agNumberColumnFilter',
  sortable: true,
  resizable: true,
  enableValue: true,
  aggFunc: 'sum'
}
```

### Date Column
```tsx
{
  headerName: 'Date',
  field: 'date',
  width: 120,
  cellStyle: { fontSize: '13px', color: '#4f5863' },
  filter: 'agDateColumnFilter',
  sortable: true,
  resizable: true
}
```

### Custom Cell Renderer
```tsx
// Define outside component to avoid hooks issues
const StatusCellRenderer = (params: ICellRendererParams) => {
  const status = params.value;
  const colorClass = status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  );
};

// In column definition
{
  headerName: 'Status',
  field: 'status',
  width: 100,
  cellRenderer: StatusCellRenderer,
  filter: 'agSetColumnFilter',
  sortable: true,
  resizable: true
}
```

### Actions Column
```tsx
const ActionsCellRenderer = (params: ICellRendererParams & { context: { handleEdit: (data: any) => void, handleDelete: (data: any) => void } }) => {
  return (
    <div className="flex gap-2 justify-center">
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6"
        onClick={() => params.context.handleEdit(params.data)}
      >
        <EditIcon className="h-4 w-4 text-gray-500" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6"
        onClick={() => params.context.handleDelete(params.data)}
      >
        <Trash2Icon className="h-4 w-4 text-gray-500" />
      </Button>
    </div>
  );
};

// In column definition
{
  headerName: 'Actions',
  field: 'actions',
  width: 100,
  cellRenderer: ActionsCellRenderer,
  sortable: false,
  filter: false,
  cellClass: 'flex items-center justify-center',
  pinned: 'right'
}
```

## AgGridTable Props Reference

```tsx
interface AgGridTableProps {
  rowData: any[];                    // Your data array
  columnDefs: ColDef[];             // Column definitions
  onGridReady?: (event: GridReadyEvent) => void;
  context?: any;                    // Pass context for cell renderers
  height?: string | number;         // Fixed height (use with autoHeight: false)
  width?: string | number;          // Table width
  className?: string;               // Additional CSS classes
  loading?: boolean;                // Show loading state
  enableExport?: boolean;           // Enable export functionality
  enableSideBar?: boolean;          // Show column/filter panels
  enableStatusBar?: boolean;        // Show status bar
  enableRowGrouping?: boolean;      // Enable row grouping
  enablePivoting?: boolean;         // Enable pivot functionality
  enableAdvancedFilter?: boolean;   // Enable advanced filter
  rowSelection?: 'single' | 'multiple' | false; // Row selection mode
  theme?: 'alpine' | 'balham' | 'material' | 'legacy';
  gridOptions?: Partial<GridOptions>; // Additional grid options
  autoHeight?: boolean;             // Dynamic height calculation
  maxHeight?: string | number;      // Maximum height when autoHeight: true
  minHeight?: string | number;      // Minimum height when autoHeight: true
  pagination?: boolean;             // Enable pagination
  paginationPageSize?: number;      // Rows per page
  animateRows?: boolean;            // Row animation
  enableRangeSelection?: boolean;   // Range selection
  enableCharts?: boolean;           // Chart functionality
  suppressRowClickSelection?: boolean; // Disable row click selection
}
```

## AgGridTableActions Props

```tsx
interface AgGridTableActionsProps {
  gridApi: GridApi | null;
  className?: string;
  showExportButtons?: boolean;      // Show CSV/Excel export
  showFilterButtons?: boolean;      // Show clear filters
  showGroupButtons?: boolean;       // Show expand/collapse groups
  showSelectionButtons?: boolean;   // Show select all/deselect
  customButtons?: React.ReactNode;  // Add custom action buttons
  exportFilename?: string;          // Base filename for exports
}
```

## Common Configuration Presets

### Minimal Table (No Enterprise Features)
```tsx
<AgGridTable
  rowData={data}
  columnDefs={columnDefs}
  autoHeight={true}
  enableSideBar={false}
  enableStatusBar={false}
  enableRowGrouping={false}
  enablePivoting={false}
  theme="alpine"
/>
```

### Full Enterprise Table
```tsx
<AgGridTable
  rowData={data}
  columnDefs={columnDefs}
  autoHeight={true}
  maxHeight="600px"
  enableSideBar={true}
  enableStatusBar={true}
  enableRowGrouping={true}
  enablePivoting={true}
  enableAdvancedFilter={true}
  rowSelection="multiple"
  theme="alpine"
/>
```

### Data Export Table
```tsx
<AgGridTable
  rowData={data}
  columnDefs={columnDefs}
  autoHeight={true}
  enableExport={true}
  onGridReady={setGridApi}
/>

<AgGridTableActions
  gridApi={gridApi}
  exportFilename="audit-data"
  showExportButtons={true}
  showFilterButtons={true}
/>
```

## Styling Requirements

Ensure your `index.css` includes the AG Grid styling:

```css
/* AG Grid custom styling */
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

.ag-theme-alpine .ag-row:hover {
  background-color: #f9fafb !important;
}

.ag-theme-alpine .ag-cell {
  border-right: none !important;
  padding: 8px 16px !important;
}
```

## Integration Steps for New Module

1. **Import the components** in your module file
2. **Define your data interface** matching your API response
3. **Create column definitions** using the examples above
4. **Set up state management** for gridApi
5. **Implement data fetching** (useQuery recommended)
6. **Add the table component** with your preferred configuration
7. **Include table actions** if needed
8. **Test enterprise features** (grouping, pivoting, export)

## Troubleshooting

- **License warnings**: Ensure `VITE_AG_GRID_LICENSE_KEY` is set
- **Styling issues**: Verify AG Grid CSS is imported
- **Performance**: Use `autoHeight={true}` for dynamic sizing
- **Data updates**: Grid automatically updates when `rowData` changes
- **Context passing**: Use `context` prop for cell renderer callbacks

This template provides everything needed to implement the standardized AG Grid table in any module while maintaining consistency with the existing design patterns.
