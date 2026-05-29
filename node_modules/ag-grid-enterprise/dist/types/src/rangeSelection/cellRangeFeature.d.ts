import type { BeanCollection, CellCtrl, ICellComp, ICellRangeFeature } from 'ag-grid-community';
export declare class CellRangeFeature implements ICellRangeFeature {
    private readonly beans;
    private readonly cellCtrl;
    private rangeSvc;
    private cellComp;
    private eGui;
    private rangeCount;
    private hasChartRange;
    private selectionHandle;
    constructor(beans: BeanCollection, cellCtrl: CellCtrl);
    setComp(cellComp: ICellComp): void;
    onCellSelectionChanged(): void;
    private updateRangeBorders;
    private isSingleCell;
    private getHasChartRange;
    updateRangeBordersIfRangeCount(): void;
    private getRangeBorders;
    refreshHandle(): void;
    private shouldHaveSelectionHandle;
    private addSelectionHandle;
    destroy(): void;
}
