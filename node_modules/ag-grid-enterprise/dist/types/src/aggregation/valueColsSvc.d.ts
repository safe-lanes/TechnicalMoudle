import type { AgColumn, ColDef, ColKey, ColumnEventType, ColumnStateParams, IAggFunc, IColsService, NamedBean } from 'ag-grid-community';
import { BaseColsService } from 'ag-grid-community';
export declare class ValueColsSvc extends BaseColsService implements NamedBean, IColsService {
    beanName: "valueColsSvc";
    eventName: "columnValueChanged";
    columnProcessors: {
        readonly set: (column: AgColumn, added: boolean, source: ColumnEventType) => void;
        readonly add: (column: AgColumn, added: boolean, source: ColumnEventType) => void;
        readonly remove: (column: AgColumn, added: boolean, source: ColumnEventType) => void;
    };
    columnExtractors: {
        readonly setFlagFunc: (col: AgColumn, flag: boolean, source: ColumnEventType) => void;
        readonly getIndexFunc: () => undefined;
        readonly getInitialIndexFunc: () => undefined;
        readonly getValueFunc: (colDef: ColDef) => boolean | null | undefined;
        readonly getInitialValueFunc: (colDef: ColDef) => boolean;
    };
    private modifyColumnsNoEventsCallbacks;
    extractCols(source: ColumnEventType, oldProvidedCols: AgColumn[] | undefined): AgColumn[];
    setColumnAggFunc(key: ColKey | undefined, aggFunc: string | IAggFunc | null | undefined, source: ColumnEventType): void;
    syncColumnWithState(column: AgColumn, source: ColumnEventType, getValue: <U extends keyof ColumnStateParams, S extends keyof ColumnStateParams>(key1: U, key2?: S) => {
        value1: ColumnStateParams[U] | undefined;
        value2: ColumnStateParams[S] | undefined;
    }): void;
    private setValueActive;
    private setColAggFunc;
    private setColValueActive;
}
