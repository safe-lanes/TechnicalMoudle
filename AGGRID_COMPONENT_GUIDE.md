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
  context?: any;
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

## Usage Examples

### Basic Table

```tsx
import AgGridTable from '@/components/AgGridTable';

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
import AgGridTable from '@/components/AgGridTable';
import AgGridTableActions from '@/components/AgGridTableActions';

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
2. **Filtering**: Use appropriate filter types (agTextColumnFilter, agNumberColumnFilter, agDateColumnFilter)
3. **Height Management**: Use autoHeight with maxHeight for responsive behavior
4. **Export Naming**: Provide meaningful filenames for exports
5. **Performance**: Use virtual scrolling for large datasets (handled automatically)
6. **Accessibility**: Column headers and data are properly labeled for screen readers

## Enterprise Features

- **Set Filtering**: Multi-select dropdown filters
- **Advanced Filtering**: Complex filter expressions
- **Row Grouping**: Hierarchical data organization
- **Pivoting**: Data summarization and analysis
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

### Performance
- For large datasets (>1000 rows), consider server-side row model
- Use column virtualization for tables with many columns
- Implement lazy loading for better initial load times