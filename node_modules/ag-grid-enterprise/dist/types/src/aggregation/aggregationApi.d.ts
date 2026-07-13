import type { BeanCollection, ColDef, Column, IAggFunc } from 'ag-grid-community';
export declare function addAggFuncs(beans: BeanCollection, aggFuncs: {
    [key: string]: IAggFunc;
}): void;
export declare function clearAggFuncs(beans: BeanCollection): void;
export declare function setColumnAggFunc(beans: BeanCollection, key: string | ColDef | Column, aggFunc: string | IAggFunc | null | undefined): void;
