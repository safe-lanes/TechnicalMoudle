import type { AbstractColDef, AgColumn, ColumnModel } from 'ag-grid-community';
import { AgProvidedColumnGroup } from 'ag-grid-community';
export declare function toolPanelCreateColumnTree(colModel: ColumnModel, colDefs: AbstractColDef[]): (AgColumn | AgProvidedColumnGroup)[];
export declare function syncLayoutWithGrid(colModel: ColumnModel, syncLayoutCallback: (colDefs: AbstractColDef[]) => void): void;
