import React from 'react';
import { Button } from '@/components/ui/button';
import { GridApi } from 'ag-grid-community';
import { agGridUtils } from './AgGridTable';
import { useToast } from '@/hooks/use-toast';

export interface AgGridTableActionsProps {
  gridApi: GridApi | null;
  className?: string;
  showExportButtons?: boolean;
  showFilterButtons?: boolean;
  showGroupButtons?: boolean;
  showSelectionButtons?: boolean;
  customButtons?: React.ReactNode;
  exportFilename?: string;
  onExportCsv?: () => void;
  onExportExcel?: () => void;
}

export const AgGridTableActions: React.FC<AgGridTableActionsProps> = ({
  gridApi,
  className = '',
  showExportButtons = true,
  showFilterButtons = true,
  showGroupButtons = true,
  showSelectionButtons = false,
  customButtons,
  exportFilename = 'data',
  onExportCsv,
  onExportExcel,
}) => {
  const { toast } = useToast();
  
  if (!gridApi) return null;

  return (
    <div className={`flex gap-2 flex-wrap ${className}`}>
      {showExportButtons && (
        <>
          <Button 
            variant="outline" 
            className="h-8 text-[#8798ad] text-xs border-[#e1e8ed]"
            onClick={() => onExportCsv ? onExportCsv() : agGridUtils.exportToCsv(gridApi, `${exportFilename}.csv`)}
          >
            Export CSV
          </Button>
          <Button 
            variant="outline" 
            className="h-8 text-[#8798ad] text-xs border-[#e1e8ed]"
            onClick={() => onExportExcel ? onExportExcel() : agGridUtils.exportToExcel(gridApi, `${exportFilename}.xlsx`)}
          >
            Export Excel
          </Button>
        </>
      )}
      
      {showFilterButtons && (
        <Button 
          variant="outline" 
          className="h-8 text-[#8798ad] text-xs border-[#e1e8ed]"
          onClick={() => agGridUtils.clearFilters(gridApi)}
        >
          Clear Filters
        </Button>
      )}
      
      {showGroupButtons && (
        <>
          <Button 
            variant="outline" 
            className="h-8 text-[#8798ad] text-xs border-[#e1e8ed]"
            onClick={() => {
              if (agGridUtils.hasRowGroups(gridApi)) {
                agGridUtils.expandAllGroups(gridApi);
                toast({
                  title: "Groups Expanded",
                  description: "All row groups have been expanded."
                });
              } else {
                toast({
                  title: "No Row Groups",
                  description: "Drag a column to the Row Groups panel to create groups first.",
                  variant: "destructive"
                });
              }
            }}
            title="Expand all row groups (drag columns to Row Groups panel first)"
          >
            Expand All
          </Button>
          <Button 
            variant="outline" 
            className="h-8 text-[#8798ad] text-xs border-[#e1e8ed]"
            onClick={() => {
              if (agGridUtils.hasRowGroups(gridApi)) {
                agGridUtils.collapseAllGroups(gridApi);
                toast({
                  title: "Groups Collapsed",
                  description: "All row groups have been collapsed."
                });
              } else {
                toast({
                  title: "No Row Groups",
                  description: "Drag a column to the Row Groups panel to create groups first.",
                  variant: "destructive"
                });
              }
            }}
            title="Collapse all row groups (drag columns to Row Groups panel first)"
          >
            Collapse All
          </Button>
        </>
      )}
      
      {showSelectionButtons && (
        <>
          <Button 
            variant="outline" 
            className="h-8 text-[#8798ad] text-xs border-[#e1e8ed]"
            onClick={() => agGridUtils.selectAll(gridApi)}
          >
            Select All
          </Button>
          <Button 
            variant="outline" 
            className="h-8 text-[#8798ad] text-xs border-[#e1e8ed]"
            onClick={() => agGridUtils.deselectAll(gridApi)}
          >
            Deselect All
          </Button>
        </>
      )}
      
      {customButtons}
    </div>
  );
};

export default AgGridTableActions;