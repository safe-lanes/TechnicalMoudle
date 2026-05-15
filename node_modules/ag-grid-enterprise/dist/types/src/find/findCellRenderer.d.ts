import type { ICellRenderer, ICellRendererParams } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
export declare class FindCellRenderer extends Component implements ICellRenderer {
    constructor();
    init(params: ICellRendererParams): void;
    refresh(params: ICellRendererParams): boolean;
}
