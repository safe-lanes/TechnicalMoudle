import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { 
  ColDef, 
  GridReadyEvent, 
  GridApi, 
  ICellRendererParams, 
  ModuleRegistry,
  GridOptions
} from 'ag-grid-community';
import { 
  AllEnterpriseModule,
  SetFilterModule,
  MultiFilterModule,
  MenuModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
  StatusBarModule,
  SideBarModule,
  RangeSelectionModule,
  RowGroupingModule,
  AggregationModule,
  PivotModule,
  MasterDetailModule,
  ViewportRowModelModule,
  ServerSideRowModelModule,
  InfiniteRowModelModule,
  ExcelExportModule,
  CsvExportModule,
  ClipboardModule,
  AdvancedFilterModule,
  LicenseManager
} from 'ag-grid-enterprise';
import { useViewport, getViewportConfig } from '@/hooks/useViewport';

// Set AG Grid Enterprise License - check both possible environment variable names
const licenseKey = import.meta.env.VITE_AG_GRID_LICENSE_KEY || import.meta.env.AG_GRID_LICENSE_KEY;
if (licenseKey) {
  LicenseManager.setLicenseKey(licenseKey);
} else {
  console.warn('AG Grid Enterprise license key not found. Please set VITE_AG_GRID_LICENSE_KEY environment variable.');
}

// Register AG Grid Enterprise modules
ModuleRegistry.registerModules([
  AllEnterpriseModule,
  SetFilterModule,
  MultiFilterModule,
  MenuModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
  StatusBarModule,
  SideBarModule,
  RangeSelectionModule,
  RowGroupingModule,
  AggregationModule,
  PivotModule,
  MasterDetailModule,
  ViewportRowModelModule,
  ServerSideRowModelModule,
  InfiniteRowModelModule,
  ExcelExportModule,
  CsvExportModule,
  ClipboardModule,
  AdvancedFilterModule
]);

export interface AgGridTableProps {
  rowData: any[];
  columnDefs: ColDef[];
  onGridReady?: (event: GridReadyEvent) => void;
  context?: any;
  height?: string | number;
  width?: string | number;
  className?: string;
  loading?: boolean;
  enableExport?: boolean;
  enableSideBar?: boolean;
  enableStatusBar?: boolean;
  enableRowGrouping?: boolean;
  enablePivoting?: boolean;
  enableAdvancedFilter?: boolean;
  rowSelection?: 'single' | 'multiple' | false;
  theme?: 'alpine' | 'balham' | 'material' | 'legacy';
  gridOptions?: Partial<GridOptions>;
  autoHeight?: boolean;
  maxHeight?: string | number;
  minHeight?: string | number;
  pagination?: boolean;
  paginationPageSize?: number;
  animateRows?: boolean;
  enableRangeSelection?: boolean;
  enableCharts?: boolean;
  suppressRowClickSelection?: boolean;
}

export const AgGridTable: React.FC<AgGridTableProps> = ({
  rowData,
  columnDefs,
  onGridReady,
  context,
  height = '500px',
  width = '100%',
  className = '',
  loading = false,
  enableExport = true,
  enableSideBar = true,
  enableStatusBar = true,
  enableRowGrouping = false,
  enablePivoting = true,
  enableAdvancedFilter = false,
  rowSelection = false,
  theme = 'alpine',
  gridOptions = {},
  autoHeight = false,
  maxHeight = '600px',
  minHeight = '200px',
  pagination = false,
  paginationPageSize = 20,
  animateRows = false,
  enableRangeSelection = false,
  enableCharts = false,
  suppressRowClickSelection = false,
}) => {
  const viewport = useViewport();
  const viewportConfig = getViewportConfig(viewport);
  const gridApiRef = useRef<GridApi | null>(null);

  // Responsive grid handler
  const handleResponsiveGrid = useCallback((gridApi: GridApi) => {
    if (!gridApi || gridApi.isDestroyed()) return;
    
    const config = getViewportConfig(viewport);
    
    if (config.useFitColumns) {
      // Desktop/Laptop: fit columns to container
      try {
        gridApi.sizeColumnsToFit();
      } catch (error) {
        console.warn('Failed to size columns to fit:', error);
      }
    } else {
      // Tablet/Phone: enforce minimum column widths for horizontal scroll
      const allColumns = gridApi.getAllDisplayedColumns();
      if (allColumns && allColumns.length > 0) {
        // Set specific column widths to ensure horizontal scrolling
        const columnWidths = allColumns.map((col: any) => {
          const colDef = col.getColDef();
          const currentWidth = col.getActualWidth();
          // Use either the defined width from column def or minimum width
          const targetWidth = colDef.width || Math.max(config.minColumnWidth, currentWidth || 70);
          
          return {
            key: col.getColId(),
            newWidth: targetWidth
          };
        });
        
        if (columnWidths.length) {
          try {
            gridApi.setColumnWidths(columnWidths);
            // Force layout update to ensure proper horizontal scrolling
            setTimeout(() => {
              if (!gridApi.isDestroyed()) {
                gridApi.refreshCells();
              }
            }, 100);
          } catch (error) {
            console.warn('Failed to set column widths:', error);
          }
        }
      }
    }
  }, [viewport]);

  // Handle grid ready event with responsive setup
  const handleGridReady = useCallback((event: GridReadyEvent) => {
    gridApiRef.current = event.api;
    handleResponsiveGrid(event.api);
    
    if (onGridReady) {
      onGridReady(event);
    }
  }, [onGridReady, handleResponsiveGrid]);

  // Handle viewport changes
  useEffect(() => {
    if (gridApiRef.current && !gridApiRef.current.isDestroyed()) {
      handleResponsiveGrid(gridApiRef.current);
    }
  }, [viewport, handleResponsiveGrid]);

  // Default column definitions with enterprise features
  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    menuTabs: ['filterMenuTab' as const, 'generalMenuTab' as const, 'columnsMenuTab' as const],
    floatingFilter: false, // Will be set per column based on viewport
    minWidth: viewportConfig.minColumnWidth,
    wrapHeaderText: true,
    autoHeaderHeight: true
  }), [viewportConfig]);

  // Side bar configuration
  const sideBar = useMemo(() => {
    if (!enableSideBar) return false;

    return {
      toolPanels: [
        {
          id: 'columns',
          labelDefault: 'Columns',
          labelKey: 'columns',
          iconKey: 'columns',
          toolPanel: 'agColumnsToolPanel',
          toolPanelParams: {
            suppressRowGroups: !enableRowGrouping,
            suppressValues: false,
            suppressPivots: !enablePivoting,
            suppressPivotMode: !enablePivoting,
            suppressColumnFilter: false,
            suppressColumnSelectAll: false,
            suppressColumnExpandAll: false
          }
        },
        {
          id: 'filters',
          labelDefault: 'Filters',
          labelKey: 'filters',
          iconKey: 'filter',
          toolPanel: 'agFiltersToolPanel'
        }
      ]
    };
  }, [enableSideBar, enableRowGrouping, enablePivoting]);

  // Status bar configuration
  const statusBar = useMemo(() => {
    if (!enableStatusBar) return undefined;

    return {
      statusPanels: [
        {
          statusPanel: 'agTotalAndFilteredRowCountComponent',
          align: 'left' as const
        },
        {
          statusPanel: 'agAggregationComponent',
          align: 'center' as const
        },
        {
          statusPanel: 'agSelectedRowCountComponent',
          align: 'right' as const
        }
      ]
    };
  }, [enableStatusBar]);

  // Row selection configuration
  const rowSelectionConfig = useMemo(() => {
    if (rowSelection === false) return undefined;

    return rowSelection === 'single' ? 'single' as const : 'multiple' as const;
  }, [rowSelection]);

  // Default grid options with responsive features
  const defaultGridOptions: Partial<GridOptions> = useMemo(() => ({
    theme: 'legacy', // Use legacy theme to avoid theming API conflicts
    defaultColDef,
    headerHeight: viewportConfig.headerHeight,
    groupHeaderHeight: 30, // Compact group header height
    rowHeight: viewportConfig.rowHeight,
    suppressHorizontalScroll: false,
    animateRows: true,
    rowSelection: rowSelectionConfig,
    getRowStyle: () => ({ backgroundColor: 'white' }),
    cellSelection: true,
    enableAdvancedFilter,
    sideBar: viewportConfig.showSideBar ? sideBar : false,
    statusBar: viewportConfig.showStatusBar ? statusBar : undefined,
    allowContextMenuWithControlKey: true,
    copyHeadersToClipboard: true,
    copyGroupHeadersToClipboard: true,
    enableCellTextSelection: true,
    enableBrowserTooltips: false,
    tooltipShowDelay: 2000,
    rowGroupPanelShow: 'never',
    pivotPanelShow: enablePivoting ? 'always' : 'never',
    functionsReadOnly: false,
    suppressAggFuncInHeader: false,
    alwaysShowHorizontalScroll: viewportConfig.alwaysShowHorizontalScroll,
    alwaysShowVerticalScroll: false,
    suppressScrollOnNewData: true,
    // Prevent auto-sizing on mobile to maintain fixed column widths
    suppressAutoSize: viewportConfig.isTabletOrPhone,
    suppressColumnVirtualisation: false,
    debug: false
  }), [
    defaultColDef,
    rowSelectionConfig,
    enableAdvancedFilter,
    sideBar,
    statusBar,
    enableRowGrouping,
    enablePivoting,
    viewportConfig
  ]);

  // Helper to parse height values (handles px, calc, and numbers)
  const parseHeightToPixels = useCallback((value: string | number): number => {
    if (typeof value === 'number') return value;
    if (value.startsWith('calc(')) {
      // For calc values with viewport height, compute based on window.innerHeight
      const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
      // Extract the subtraction value from calc(100vh - Xpx)
      const match = value.match(/calc\(100vh\s*-\s*(\d+)px\)/);
      if (match) {
        return screenHeight - parseInt(match[1]);
      }
      // Fallback for other calc patterns
      return screenHeight - 200;
    }
    return parseInt(value) || 600;
  }, []);

  // Calculate dynamic height based on row count and screen size
  const dynamicHeight = useMemo(() => {
    if (!autoHeight) return height;
    
    const headerHeight = 50; // Header row height
    const rowHeight = 50; // Data row height
    const footerHeight = enableStatusBar ? 40 : 0; // Status bar height
    const padding = 4; // Container padding
    
    const calculatedHeight = headerHeight + (rowData.length * rowHeight) + footerHeight + padding;
    
    // Get available screen height (subtract header, margins, etc.)
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const reservedHeight = 200; // Reserve space for header, margins, padding, etc.
    const availableHeight = screenHeight - reservedHeight;
    
    // Convert maxHeight and minHeight to numbers for comparison
    const maxHeightNum = parseHeightToPixels(maxHeight);
    const minHeightNum = parseHeightToPixels(minHeight);
    
    // Use the smaller of calculated height, available screen height, or maxHeight
    const effectiveMaxHeight = Math.min(maxHeightNum, availableHeight);
    const constrainedHeight = Math.max(minHeightNum, Math.min(calculatedHeight, effectiveMaxHeight));
    
    return `${constrainedHeight}px`;
  }, [autoHeight, height, rowData.length, enableStatusBar, maxHeight, minHeight, parseHeightToPixels]);

  // Merge default options with provided options
  const finalGridOptions = useMemo(() => {
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const reservedHeight = 200;
    const availableHeight = screenHeight - reservedHeight;
    const calculatedHeight = 50 + (rowData.length * 50) + (enableStatusBar ? 40 : 0) + 4;
    
    const needsScroll = autoHeight && calculatedHeight > availableHeight;
    
    // Calculate default domLayout, but allow override from gridOptions
    const defaultDomLayout = needsScroll ? ('normal' as const) : ('autoHeight' as const);
    
    return {
      ...defaultGridOptions,
      ...gridOptions,
      // Only set these defaults if not explicitly provided in gridOptions
      alwaysShowVerticalScroll: gridOptions.alwaysShowVerticalScroll ?? false,
      suppressHorizontalScroll: gridOptions.suppressHorizontalScroll ?? false,
      suppressScrollOnNewData: gridOptions.suppressScrollOnNewData ?? true,
      // Allow domLayout override from gridOptions, otherwise use calculated default
      domLayout: gridOptions.domLayout ?? defaultDomLayout
    };
  }, [defaultGridOptions, gridOptions, autoHeight, rowData.length, enableStatusBar]);

  // Check if scroll is needed or if domLayout is explicitly set to 'normal'
  // Note: We use finalGridOptions.domLayout which is already memoized
  const needsScroll = useMemo(() => {
    // If domLayout is 'normal' in finalGridOptions, we need a fixed height container
    if (finalGridOptions.domLayout === 'normal') return true;
    
    if (!autoHeight) return false;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const calculatedHeight = 50 + (rowData.length * 50) + 4;
    return calculatedHeight > (screenHeight - 200);
  }, [autoHeight, rowData.length, finalGridOptions.domLayout]);

  // Determine the container height
  const containerHeight = useMemo(() => {
    // If domLayout is 'normal' and a height prop is provided, use it
    if (finalGridOptions.domLayout === 'normal') {
      return height;
    }
    // If scroll is needed due to autoHeight calculations, use dynamic height
    if (needsScroll) {
      return dynamicHeight;
    }
    // Otherwise, auto height
    return 'auto';
  }, [finalGridOptions.domLayout, height, needsScroll, dynamicHeight]);

  return (
    <div 
      className={`ag-theme-${theme} ${needsScroll ? 'needs-scroll' : 'no-scroll'} bg-white rounded-lg shadow-md ${className}`} 
      style={{ 
        height: containerHeight, 
        width,
        overflow: needsScroll ? 'auto' : 'visible'
      }}
    >
      <AgGridReact
        rowData={rowData}
        columnDefs={columnDefs}
        onGridReady={handleGridReady}
        context={context}
        {...finalGridOptions}
      />
    </div>
  );
};

// Export functions for common AG Grid operations
export const agGridUtils = {
  exportToCsv: (gridApi: GridApi, filename = 'data.csv') => {
    gridApi.exportDataAsCsv({ fileName: filename });
  },

  exportToExcel: (gridApi: GridApi, filename = 'data.xlsx') => {
    gridApi.exportDataAsExcel({ fileName: filename });
  },

  clearFilters: (gridApi: GridApi) => {
    gridApi.setFilterModel(null);
  },

  resetColumns: (gridApi: GridApi) => {
    gridApi.resetColumnState();
  },

  expandAllGroups: (gridApi: GridApi) => {
    // Check if there are any row groups first
    const rowGroupCols = gridApi.getRowGroupColumns();
    if (rowGroupCols && rowGroupCols.length > 0) {
      gridApi.expandAll();
    } else {
      console.warn('No row groups found. Drag a column to the row group panel to create groups first.');
    }
  },

  collapseAllGroups: (gridApi: GridApi) => {
    // Check if there are any row groups first
    const rowGroupCols = gridApi.getRowGroupColumns();
    if (rowGroupCols && rowGroupCols.length > 0) {
      gridApi.collapseAll();
    } else {
      console.warn('No row groups found. Drag a column to the row group panel to create groups first.');
    }
  },

  hasRowGroups: (gridApi: GridApi) => {
    const rowGroupCols = gridApi.getRowGroupColumns();
    return rowGroupCols && rowGroupCols.length > 0;
  },

  getSelectedRows: (gridApi: GridApi) => {
    return gridApi.getSelectedRows();
  },

  selectAll: (gridApi: GridApi) => {
    gridApi.selectAll();
  },

  deselectAll: (gridApi: GridApi) => {
    gridApi.deselectAll();
  }
};

export default AgGridTable;