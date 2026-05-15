import type { AgColumn, BeanCollection, FilterDisplayParams, IMultiFilterDef, IMultiFilterModel, IMultiFilterParams, SharedFilterUi } from 'ag-grid-community';
export declare function getMultiFilterDefs(params: IMultiFilterParams): IMultiFilterDef[];
export declare function forEachReverse<T>(list: T[] | null | undefined, action: (value: T, index: number) => void): void;
export declare function getFilterTitle(filter: SharedFilterUi, filterDef: IMultiFilterDef): string;
export declare function getUpdatedMultiFilterModel(existingModel: IMultiFilterModel | null, numFilters: number, newModel: any, index: number): IMultiFilterModel | null;
export declare function getFilterModelForIndex<TModel = any>(model: IMultiFilterModel | null, index: number): TModel | null;
export declare function updateGetValue(beans: BeanCollection, column: AgColumn, filterDef: IMultiFilterDef, existingGetValue: FilterDisplayParams['getValue']): FilterDisplayParams['getValue'];
