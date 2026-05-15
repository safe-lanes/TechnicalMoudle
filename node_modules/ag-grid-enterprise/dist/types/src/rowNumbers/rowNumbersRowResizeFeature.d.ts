import type { BeanCollection, CellCtrl, GridOptionsService, IRowNumbersRowResizeFeature } from 'ag-grid-community';
export declare function _isRowNumbersResizerEnabled(gos: GridOptionsService): boolean;
export declare class RowNumbersRowResizeFeature implements IRowNumbersRowResizeFeature {
    private readonly beans;
    private readonly cellCtrl;
    private rowResizer;
    constructor(beans: BeanCollection, cellCtrl: CellCtrl);
    refreshRowResizer(): void;
    private isRowResizeSupported;
    private addResizerToCellComp;
    private removeRowResizerFromCellComp;
    destroy(): void;
}
