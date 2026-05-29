import type { AgColumn, ColDef, ColumnEventType, ColumnStateParams, IColsService, NamedBean } from 'ag-grid-community';
import { BaseColsService } from 'ag-grid-community';
export declare class PivotColsSvc extends BaseColsService implements NamedBean, IColsService {
    beanName: "pivotColsSvc";
    eventName: "columnPivotChanged";
    columnProcessors: {
        readonly set: (column: AgColumn, added: boolean, source: ColumnEventType) => void;
        readonly add: (column: AgColumn, added: boolean, source: ColumnEventType) => void;
        readonly remove: (column: AgColumn, added: boolean, source: ColumnEventType) => void;
    };
    columnOrdering: {
        readonly enableProp: "pivot";
        readonly initialEnableProp: "initialPivot";
        readonly indexProp: "pivotIndex";
        readonly initialIndexProp: "initialPivotIndex";
    };
    columnExtractors: {
        readonly setFlagFunc: (col: AgColumn, flag: boolean, source: ColumnEventType) => void;
        readonly getIndexFunc: (colDef: ColDef) => number | null | undefined;
        readonly getInitialIndexFunc: (colDef: ColDef) => number | undefined;
        readonly getValueFunc: (colDef: ColDef) => boolean | undefined;
        readonly getInitialValueFunc: (colDef: ColDef) => boolean | undefined;
    };
    private modifyColumnsNoEventsCallbacks;
    syncColumnWithState(column: AgColumn, source: ColumnEventType, getValue: <U extends keyof ColumnStateParams, S extends keyof ColumnStateParams>(key1: U, key2?: S) => {
        value1: ColumnStateParams[U] | undefined;
        value2: ColumnStateParams[S] | undefined;
    }, rowIndex: {
        [key: string]: number;
    } | null): void;
    private setColPivotActive;
}
