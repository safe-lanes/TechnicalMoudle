import type { AdvancedFilterModel, AgColumn, BeanCollection, ColumnVO, FilterModel, IServerSideDatasource, IServerSideRowModel, LoadSuccessParams, NamedBean, RefreshServerSideParams, RowBounds, RowModelType, ServerSideGroupLevelState, SortModelItem, StoreRefreshAfterParams } from 'ag-grid-community';
import { BeanStub, RowNode } from 'ag-grid-community';
import type { LazyStore } from './stores/lazy/lazyStore';
export interface SSRMParams {
    sortModel: SortModelItem[];
    filterModel: FilterModel | AdvancedFilterModel | null;
    lastAccessedSequence: {
        value: number;
    };
    dynamicRowHeight: boolean;
    rowGroupCols: ColumnVO[];
    valueCols: ColumnVO[];
    pivotCols: ColumnVO[];
    pivotMode: boolean;
    datasource?: IServerSideDatasource;
}
export declare class ServerSideRowModel extends BeanStub implements NamedBean, IServerSideRowModel {
    beanName: "rowModel";
    private colModel;
    private colNames;
    private pivotResultCols?;
    private rowGroupColsSvc?;
    private pivotColsSvc?;
    private valueColsSvc?;
    private filterManager?;
    private sortSvc?;
    private rowRenderer;
    private nodeManager;
    private storeFactory;
    private pivotColDefSvc?;
    wireBeans(beans: BeanCollection): void;
    rootNode: RowNode;
    private datasource;
    private storeParams;
    private pauseStoreUpdateListening;
    private started;
    private managingPivotResultColumns;
    ensureRowHeightsValid(): boolean;
    start(): void;
    private destroyDatasource;
    postConstruct(): void;
    private updateDatasource;
    private verifyProps;
    setDatasource(datasource: IServerSideDatasource): void;
    applyRowData(rowDataParams: LoadSuccessParams, startRow: number, route: string[]): void;
    isLastRowIndexKnown(): boolean;
    private onColumnEverything;
    private destroyRootStore;
    refreshAfterSort(newSortModel: SortModelItem[], params: StoreRefreshAfterParams): void;
    generateSecondaryColumns(pivotFields: string[]): void;
    resetRowHeights(): void;
    private resetRowHeightsForAllRowNodes;
    resetRootStore(): void;
    columnsToValueObjects(columns?: AgColumn[]): ColumnVO[];
    private createStoreParams;
    getParams(): SSRMParams;
    private dispatchModelUpdated;
    private onStoreUpdated;
    onRowHeightChanged(): void;
    updateRowIndexesAndBounds(): void;
    retryLoads(): void;
    getRow(index: number): RowNode | undefined;
    /**
     * Pauses the store, to prevent it updating the UI. This is used when doing batch updates to the store.
     */
    setPaused(paused: boolean): void;
    expandAll(value: boolean): void;
    refreshAfterFilter(newFilterModel: FilterModel | AdvancedFilterModel | null, params: StoreRefreshAfterParams): void;
    getRootStore(): LazyStore | undefined;
    getRowCount(): number;
    getTopLevelRowCount(): number;
    getTopLevelRowDisplayedIndex(topLevelIndex: number): number;
    getRowBounds(index: number): RowBounds;
    getBlockStates(): any;
    getRowIndexAtPixel(pixel: number): number;
    isEmpty(): boolean;
    isRowsToRender(): boolean;
    getType(): RowModelType;
    forEachNode(callback: (rowNode: RowNode, index: number) => void): void;
    forEachDisplayedNode(callback: (rowNode: RowNode<any>, index: number) => void): void;
    forEachNodeAfterFilterAndSort(callback: (node: RowNode, index: number) => void, includeFooterNodes?: boolean): void;
    /** @returns false if store hasn't started */
    executeOnStore(route: string[], callback: (cache: LazyStore) => void): boolean;
    refreshStore(params?: RefreshServerSideParams): void;
    getStoreState(): ServerSideGroupLevelState[];
    getNodesInRangeForSelection(firstInRange: RowNode, lastInRange: RowNode): RowNode[] | null;
    getRowNode(id: string): RowNode | undefined;
    isRowPresent(rowNode: RowNode): boolean;
    setRowCount(rowCount: number, lastRowIndexKnown?: boolean): void;
    destroy(): void;
    private onRowHeightChanged_debounced;
    /**
     * @deprecated v33.1
     */
    onRowHeightChangedDebounced(): void;
}
