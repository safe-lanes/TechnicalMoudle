import type { AgColumn, BeanCollection, ColDef, ColGroupDef, ColKey, ColumnEventType, IPivotResultColsService, NamedBean, _ColumnCollections } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class PivotResultColsService extends BeanStub implements NamedBean, IPivotResultColsService {
    beanName: "pivotResultCols";
    private colModel;
    private visibleCols;
    wireBeans(beans: BeanCollection): void;
    private pivotResultCols;
    private previousPivotResultCols;
    destroy(): void;
    isPivotResultColsPresent(): boolean;
    lookupPivotResultCol(pivotKeys: string[], valueColKey: ColKey): AgColumn | null;
    getPivotResultCols(): _ColumnCollections | null;
    getPivotResultCol(key: ColKey): AgColumn | null;
    setPivotResultCols(colDefs: (ColDef | ColGroupDef)[] | null, source: ColumnEventType): void;
    private processPivotResultColDef;
}
