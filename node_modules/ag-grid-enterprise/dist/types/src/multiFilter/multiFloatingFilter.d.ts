import type { FilterChangedEvent, IFloatingFilterComp, IFloatingFilterParams, IMultiFilterModel } from 'ag-grid-community';
import { AgPromise, Component } from 'ag-grid-community';
import { MultiFilter } from './multiFilter';
import { MultiFilterUi } from './multiFilterUi';
export declare class MultiFloatingFilterComp extends Component implements IFloatingFilterComp<MultiFilter | MultiFilterUi> {
    private floatingFilters;
    private compDetailsList;
    private params;
    constructor();
    init(params: IFloatingFilterParams<MultiFilter | MultiFilterUi>): AgPromise<void>;
    private setParams;
    refresh(params: IFloatingFilterParams<MultiFilter | MultiFilterUi>): void;
    private getCompDetailsList;
    onParentModelChanged(model: IMultiFilterModel, event: FilterChangedEvent): void;
    destroy(): void;
    private getCompDetails;
    private parentMultiFilterInstance;
}
