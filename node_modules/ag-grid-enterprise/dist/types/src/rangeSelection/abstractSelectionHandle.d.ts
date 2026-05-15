import type { CellCtrl, CellPosition, CellRange, RowPosition } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
export declare enum SelectionHandleType {
    FILL = 0,
    RANGE = 1
}
export declare abstract class AbstractSelectionHandle extends Component {
    protected cellCtrl: CellCtrl;
    protected cellRange: CellRange;
    protected rangeStartRow: RowPosition;
    protected rangeEndRow: RowPosition;
    private cellHoverListener;
    private lastCellHovered;
    protected changedCalculatedValues: boolean;
    private dragging;
    protected abstract type: SelectionHandleType;
    protected abstract shouldSkipCell(cell: CellPosition): boolean;
    protected shouldDestroyOnEndDragging: boolean;
    postConstruct(): void;
    protected abstract onDrag(e: MouseEvent | Touch): void;
    protected abstract onDragEnd(e: MouseEvent | Touch): void;
    protected abstract onDragCancel(): void;
    protected getLastCellHovered(): CellPosition | null | undefined;
    private preventRangeExtension;
    protected onDragStart(_: MouseEvent): void;
    private getDraggingCssClass;
    protected updateValuesOnMove(e: MouseEvent): void;
    private clearDragProperties;
    getType(): SelectionHandleType;
    refresh(cellCtrl: CellCtrl): void;
    protected clearValues(): void;
    private removeListeners;
    destroy(): void;
}
