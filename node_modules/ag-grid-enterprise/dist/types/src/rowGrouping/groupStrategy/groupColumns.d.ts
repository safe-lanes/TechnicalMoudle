import type { AgColumn, ColDef } from 'ag-grid-community';
export interface GroupColumn {
    col: AgColumn;
    field: ColDef['field'];
    type: ColDef['type'];
    keyCreator: ColDef['keyCreator'];
    valueGetter: ColDef['valueGetter'];
}
export declare const makeGroupColumns: (columns: AgColumn[] | null | undefined) => GroupColumn[];
export declare const groupColumnsChanged: (groupColumns: GroupColumn[], columns: AgColumn[] | null | undefined) => boolean;
