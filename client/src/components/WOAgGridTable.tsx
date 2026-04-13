import { useMemo, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GridReadyEvent, GridApi, RowClickedEvent } from 'ag-grid-community';
import { ModuleRegistry } from 'ag-grid-community';
import {
  MenuModule,
  ColumnsToolPanelModule,
  LicenseManager,
} from 'ag-grid-enterprise';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

try {
  const licenseKey = import.meta.env.VITE_AG_GRID_LICENSE_KEY || import.meta.env.AG_GRID_LICENSE_KEY;
  if (licenseKey) {
    LicenseManager.setLicenseKey(licenseKey);
  }
} catch (_) {}

try {
  ModuleRegistry.registerModules([
    MenuModule,
    ColumnsToolPanelModule,
  ]);
} catch (_) {}

interface WOAgGridTableProps {
  columnDefs: ColDef[];
  rowData: any[];
  height?: string;
  onRowClicked?: (event: RowClickedEvent) => void;
  getRowStyle?: (params: any) => any;
  getRowClass?: (params: any) => string | string[] | undefined;
  suppressRowClickSelection?: boolean;
  rowHeight?: number;
  headerHeight?: number;
  domLayout?: 'normal' | 'autoHeight' | 'print';
  noRowsMessage?: string;
  testId?: string;
}

const WOAgGridTable: React.FC<WOAgGridTableProps> = ({
  columnDefs,
  rowData,
  height = '100%',
  onRowClicked,
  getRowStyle,
  getRowClass,
  suppressRowClickSelection = true,
  rowHeight = 42,
  headerHeight = 42,
  domLayout = 'normal',
  noRowsMessage = 'No data available',
  testId = 'wo-ag-grid',
}) => {
  const gridApiRef = useRef<GridApi | null>(null);

  const defaultColDef: ColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: false,
    suppressHeaderFilterButton: true,
    wrapText: false,
    autoHeight: false,
    menuTabs: [],
  }), []);

  const onGridReady = useCallback((event: GridReadyEvent) => {
    gridApiRef.current = event.api;
  }, []);

  const overlayNoRowsTemplate = useMemo(() => {
    return `<div style="padding: 20px; text-align: center; color: #6b7280;">${noRowsMessage}</div>`;
  }, [noRowsMessage]);

  return (
    <div
      className="ag-theme-alpine wo-ag-grid"
      style={{ height, width: '100%' }}
      data-testid={testId}
    >
      <AgGridReact
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onGridReady={onGridReady}
        onRowClicked={onRowClicked}
        getRowStyle={getRowStyle}
        getRowClass={getRowClass}
        suppressHorizontalScroll={false}
        alwaysShowHorizontalScroll={false}
        alwaysShowVerticalScroll={false}
        animateRows={false}
        rowHeight={rowHeight}
        headerHeight={headerHeight}
        enableBrowserTooltips={true}
        tooltipShowDelay={500}
        suppressMenuHide={false}
        suppressMovableColumns={false}
        suppressCellFocus={true}
        enableCellTextSelection={true}
        suppressRowClickSelection={suppressRowClickSelection}
        domLayout={domLayout}
        reactiveCustomComponents={true}
        overlayNoRowsTemplate={overlayNoRowsTemplate}
        theme="legacy"
      />
    </div>
  );
};

export default WOAgGridTable;
