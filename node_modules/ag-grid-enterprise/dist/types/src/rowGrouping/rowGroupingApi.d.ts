import type { BeanCollection, ColDef, Column } from 'ag-grid-community';
export declare function setRowGroupColumns(beans: BeanCollection, colKeys: (string | ColDef | Column)[]): void;
export declare function removeRowGroupColumns(beans: BeanCollection, colKeys: (string | ColDef | Column)[]): void;
export declare function addRowGroupColumns(beans: BeanCollection, colKeys: (string | ColDef | Column)[]): void;
export declare function moveRowGroupColumn(beans: BeanCollection, fromIndex: number, toIndex: number): void;
export declare function getRowGroupColumns(beans: BeanCollection): Column[];
