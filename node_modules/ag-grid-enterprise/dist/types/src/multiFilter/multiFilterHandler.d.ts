import type { DoesFilterPassParams, FilterHandler, FilterHandlerParams, MultiFilterHandler as IMultiFilterHandler, IMultiFilterModel, IMultiFilterParams } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class MultiFilterHandler extends BeanStub implements FilterHandler<any, any, IMultiFilterModel, IMultiFilterParams>, IMultiFilterHandler {
    /** Used to get the filter type for filter models. */
    readonly filterType: "multi";
    private params;
    private handlerWrappers;
    /** ui active. could still have null model */
    private activeFilterIndices;
    private filterDefs;
    init(params: FilterHandlerParams<any, any, IMultiFilterModel, IMultiFilterParams>): void;
    refresh(params: FilterHandlerParams<any, any, IMultiFilterModel> & IMultiFilterParams): void;
    private updateHandlerParams;
    doesFilterPass(params: DoesFilterPassParams<any, IMultiFilterModel>, indexToSkip?: number): boolean;
    private resetActiveList;
    updateActiveList<TModel>(index: number, childModel: TModel | null): void;
    getLastActiveFilterIndex(): number | null;
    getModelAsString(model: IMultiFilterModel | null, source?: 'floating' | 'filterToolPanel'): string;
    getHandler<TFilterHandler>(index: number): TFilterHandler | undefined;
    onAnyFilterChanged(): void;
    onNewRowsLoaded(): void;
    destroy(): void;
}
