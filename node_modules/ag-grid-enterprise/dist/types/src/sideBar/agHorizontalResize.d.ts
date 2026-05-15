import { Component } from 'ag-grid-community';
export declare class AgHorizontalResize extends Component {
    private startingWidth;
    elementToResize: HTMLElement;
    inverted: boolean;
    minWidth: number;
    maxWidth: number | null;
    constructor();
    postConstruct(): void;
    private dispatchResizeEvent;
    private onResizeStart;
    private onResizeEnd;
    private onResizing;
}
