import type { IFloatingFilter, IFloatingFilterParams, SetFilterModel } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
export declare class SetFloatingFilterComp<V = string> extends Component implements IFloatingFilter {
    private readonly eFloatingFilterText;
    private params;
    private listenerAdded;
    private destroyListeners?;
    constructor();
    init(params: IFloatingFilterParams): void;
    private setParams;
    refresh(params: IFloatingFilterParams): void;
    onParentModelChanged(parentModel: SetFilterModel | null): void;
    private parentSetFilterInstance;
    private addAvailableValuesListener;
    private updateFloatingFilterText;
    destroy(): void;
}
