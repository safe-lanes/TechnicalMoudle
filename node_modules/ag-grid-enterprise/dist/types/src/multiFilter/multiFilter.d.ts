import type { FilterDisplayParams, FilterDisplayState, FilterHandler, FilterHandlerBaseParams, IDoesFilterPassParams, IFilter, IFilterComp, IFilterParams, IMultiFilter, IMultiFilterModel, MultiFilterParams, ProvidedFilterModel } from 'ag-grid-community';
import { AgPromise } from 'ag-grid-community';
import type { BaseFilterComponent } from './baseMultiFilter';
import { BaseMultiFilter } from './baseMultiFilter';
interface MultiFilterWrapper {
    filter: IFilterComp;
    comp: BaseFilterComponent;
    /** only set for handlers */
    filterParams?: FilterDisplayParams;
    handler?: FilterHandler;
    handlerParams?: FilterHandlerBaseParams;
    /** only set for handlers */
    model?: any;
    state?: FilterDisplayState;
}
export declare class MultiFilter extends BaseMultiFilter<MultiFilterWrapper> implements IFilterComp, IMultiFilter {
    readonly filterType: "multi";
    private params;
    private wrappers;
    private filterChangedCallback;
    private activeFilterIndices;
    private afterFiltersReadyFuncs;
    init(params: MultiFilterParams): AgPromise<void>;
    refresh(params: IFilterParams): boolean;
    isFilterActive(): boolean;
    getLastActiveFilterIndex(): number | null;
    doesFilterPass(params: IDoesFilterPassParams, indexToSkip?: number): boolean;
    getModelFromUi(): IMultiFilterModel | null;
    getModel(): ProvidedFilterModel | null;
    setModel(model: IMultiFilterModel | null): AgPromise<void>;
    applyModel(source?: 'api' | 'ui' | 'rowDataUpdated'): boolean;
    getChildFilterInstance<TFilter = IFilter>(index: number): TFilter | undefined;
    destroy(): void;
    protected getFilterWrappers(): (MultiFilterWrapper | null)[];
    protected getFilterFromWrapper(wrapper: MultiFilterWrapper): IFilterComp<any>;
    protected getCompFromWrapper(wrapper: MultiFilterWrapper): BaseFilterComponent;
    protected executeOnWrapper(wrapper: MultiFilterWrapper, name: 'onAnyFilterChanged' | 'onNewRowsLoaded'): void;
    private createFilter;
    private updateDisplayParams;
    private executeWhenAllFiltersReady;
    private updateActiveListForFilter;
    private updateActiveListForHandler;
    private updateActiveList;
    /** Only called for non-handlers */
    private onFilterModelChanged;
    private onHandlerModelChanged;
    private filterChanged;
    getModelAsString(model: IMultiFilterModel): string;
}
export {};
