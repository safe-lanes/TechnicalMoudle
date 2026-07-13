import type { FilterDisplayComp, FilterDisplayParams, IComponent, IMultiFilterModel, IMultiFilterParams, SharedFilterUi } from 'ag-grid-community';
import { AgPromise } from 'ag-grid-community';
import type { BaseFilterComponent } from './baseMultiFilter';
import { BaseMultiFilter } from './baseMultiFilter';
export declare class MultiFilterUi extends BaseMultiFilter<FilterDisplayComp> implements IComponent<IMultiFilterParams & FilterDisplayParams<any, any, IMultiFilterModel>> {
    readonly filterType: "multi";
    private params;
    private filters;
    private filterParams;
    private validity;
    private allState;
    init(params: IMultiFilterParams & FilterDisplayParams<any, any, IMultiFilterModel>): AgPromise<void>;
    refresh(params: IMultiFilterParams & FilterDisplayParams<any, any, IMultiFilterModel>): boolean;
    getLastActiveFilterIndex(): number | null;
    getChildFilterInstance(index: number): FilterDisplayComp | undefined;
    destroy(): void;
    protected getFilterWrappers(): (FilterDisplayComp | null)[];
    protected getFilterFromWrapper(wrapper: FilterDisplayComp): SharedFilterUi;
    protected getCompFromWrapper(wrapper: FilterDisplayComp): BaseFilterComponent;
    private createFilter;
    private updateParams;
    private updateActiveList;
    private getHandler;
    private onStateChange;
    getModelAsString(model: IMultiFilterModel): string;
}
