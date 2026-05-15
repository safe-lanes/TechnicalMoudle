import { Component } from 'ag-grid-community';
import type { CellCtrl } from 'ag-grid-community';
export declare class AgRowNumbersRowResizer extends Component {
    private readonly cellCtrl;
    private node;
    private initialYPosition;
    private initialHeight;
    private dragging;
    private defaultRowHeight;
    constructor(cellCtrl: CellCtrl);
    postConstruct(): void;
    private onDragStart;
    private onDragging;
    private onDragStop;
    private onDragCancel;
    private clearDragDetails;
    destroy(): void;
}
