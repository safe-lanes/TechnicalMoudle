import type { AgColumn, BeanCollection, ColumnModel, RowNode } from 'ag-grid-community';
export declare function setRowNodeGroupValue(rowNode: RowNode, colModel: ColumnModel, colKey: string | AgColumn, newValue: any): void;
export declare function setRowNodeGroup(rowNode: RowNode, beans: BeanCollection, group: boolean): void;
export declare function isRowGroupColLocked(column: AgColumn | undefined | null, beans: BeanCollection): boolean;
