import type { IRowModel, IViewportDatasource, NamedBean, RowBounds, RowModelType } from 'ag-grid-community';
import { BeanStub, RowNode } from 'ag-grid-community';
export declare class ViewportRowModel extends BeanStub implements NamedBean, IRowModel {
    beanName: "rowModel";
    private firstRow;
    private lastRow;
    private rowCount;
    private rowNodesByIndex;
    private rowHeight;
    private datasource;
    /**
     * Used to see if setRowData has been called inside of the viewportChanged event context,
     * if so the new rows are already being calculated, and the model does not need updated
     * otherwise, a new model event needs to fire as rows have changed externally.
     */
    private viewportChangedContext;
    ensureRowHeightsValid(_startPixel: number, _endPixel: number, _startLimitIndex: number, _endLimitIndex: number): boolean;
    postConstruct(): void;
    start(): void;
    isLastRowIndexKnown(): boolean;
    destroy(): void;
    private destroyDatasource;
    private updateDatasource;
    private getPageSize;
    private getBufferSize;
    private calculateFirstRow;
    private calculateLastRow;
    private onViewportChanged;
    purgeRowsNotInViewport(): void;
    private isRowFocused;
    setViewportDatasource(viewportDatasource: IViewportDatasource): void;
    getType(): RowModelType;
    getRow(rowIndex: number): RowNode;
    getRowNode(id: string): RowNode | undefined;
    getRowCount(): number;
    getRowIndexAtPixel(pixel: number): number;
    getRowBounds(index: number): RowBounds;
    private updateRowHeights;
    getTopLevelRowCount(): number;
    getTopLevelRowDisplayedIndex(topLevelIndex: number): number;
    isEmpty(): boolean;
    isRowsToRender(): boolean;
    getNodesInRangeForSelection(firstInRange: RowNode, lastInRange: RowNode): RowNode[];
    forEachNode(callback: (rowNode: RowNode, index: number) => void): void;
    private setRowData;
    private createBlankRowNode;
    setRowCount(rowCount: number, keepRenderedRows?: boolean): void;
    isRowPresent(rowNode: RowNode): boolean;
}
