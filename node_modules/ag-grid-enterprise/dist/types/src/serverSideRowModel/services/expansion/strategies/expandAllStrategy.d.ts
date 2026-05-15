import { BeanStub } from 'ag-grid-community';
import type { IRowNode, RowGroupBulkExpansionState } from 'ag-grid-community';
import type { IExpansionStrategy } from './iExpansionStrategy';
export declare class ExpandAllStrategy extends BeanStub implements IExpansionStrategy<RowGroupBulkExpansionState> {
    name: string;
    private allExpanded;
    private flipped;
    setExpandedState(state: RowGroupBulkExpansionState): void;
    getExpandedState(): RowGroupBulkExpansionState;
    setRowExpanded(row: IRowNode, expanded: boolean): void;
    isRowExpanded(node: IRowNode): boolean;
    isRowInitialised(): boolean;
    expandAll(expanded: boolean): void;
}
