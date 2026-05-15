import type { INewFiltersToolPanel, IToolPanelComp, IToolPanelNewFiltersCompParams, IToolPanelParams, NewFiltersToolPanelState } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
interface ToolPanelNewFiltersCompParams<TData = any, TContext = any> extends IToolPanelParams<TData, TContext, NewFiltersToolPanelState>, IToolPanelNewFiltersCompParams {
}
export declare class WrapperToolPanel extends Component implements INewFiltersToolPanel, IToolPanelComp {
    private filterPanel;
    constructor();
    init(params: ToolPanelNewFiltersCompParams): void;
    getGui(): HTMLElement;
    refresh(params: ToolPanelNewFiltersCompParams): boolean | void;
    private updateParams;
    getState(): NewFiltersToolPanelState;
}
export {};
