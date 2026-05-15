import type { ILoadingCellRendererComp, ILoadingCellRendererParams } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
export declare class LoadingCellRenderer extends Component implements ILoadingCellRendererComp {
    private readonly eLoadingIcon;
    private readonly eLoadingText;
    constructor();
    init(params: ILoadingCellRendererParams): void;
    private setupFailed;
    private setupLoading;
    refresh(_params: ILoadingCellRendererParams): boolean;
}
