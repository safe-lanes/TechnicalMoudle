import type { AgColumn, BeanCollection, ColumnEventType, IAggFunc } from 'ag-grid-community';
import type { ColumnModelItem } from './columnModelItem';
export declare function selectAllChildren(beans: BeanCollection, colTree: ColumnModelItem[], selectAllChecked: boolean, eventType: ColumnEventType): void;
export declare function setAllColumns(beans: BeanCollection, cols: AgColumn[], selectAllChecked: boolean, eventType: ColumnEventType): void;
export declare function updateColumns(beans: BeanCollection, params: {
    columns: AgColumn[];
    visibleState?: {
        [key: string]: boolean;
    };
    pivotState?: {
        [key: string]: {
            pivot?: boolean;
            rowGroup?: boolean;
            aggFunc?: string | IAggFunc | null;
        };
    };
    eventType: ColumnEventType;
}): void;
export declare function createPivotState(column: AgColumn): {
    pivot?: boolean;
    rowGroup?: boolean;
    aggFunc?: string | IAggFunc | null;
};
