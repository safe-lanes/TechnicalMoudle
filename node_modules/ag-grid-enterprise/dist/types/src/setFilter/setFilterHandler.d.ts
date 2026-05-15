import type { DoesFilterPassParams, FilterHandler, FilterHandlerParams, SetFilterHandler as ISetFilterHandler, ISetFilterParams, SetFilterModel, SetFilterModelValue, ValueFormatterParams } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
import { SetValueModel } from './setValueModel';
type SetFilterHandlerEventType = 'anyFilterChanged' | 'dataChanged' | 'destroyed';
export declare class SetFilterHandler<TValue = string> extends BeanStub<SetFilterHandlerEventType> implements FilterHandler<any, any, SetFilterModel, ISetFilterParams<any, TValue>>, ISetFilterHandler<TValue> {
    /** Used to get the filter type for filter models. */
    readonly filterType: "set";
    params: FilterHandlerParams<any, any, SetFilterModel, ISetFilterParams<any, TValue>>;
    /**
     * Here we keep track of the keys that are currently being used for filtering.
     * In most cases, the filtering keys are the same as the selected keys,
     * but for the specific case when excelMode = 'windows' and the user has ticked 'Add current selection to filter',
     * the filtering keys can be different from the selected keys.
     */
    private appliedModel;
    valueModel: SetValueModel<TValue>;
    private createKey;
    private treeDataTreeList;
    private groupingTreeList;
    private caseSensitive;
    valueFormatter?: (params: ValueFormatterParams) => string;
    private noValueFormatterSupplied;
    init(params: FilterHandlerParams<any, any, SetFilterModel, ISetFilterParams<any, TValue>>): void;
    refresh(params: FilterHandlerParams<any, any, SetFilterModel, ISetFilterParams<any, TValue>>): void;
    private updateParams;
    doesFilterPass(params: DoesFilterPassParams<any, SetFilterModel>): boolean;
    private getFormattedValue;
    getModelAsString(model: SetFilterModel | null, source?: 'floating' | 'filterToolPanel'): string;
    onAnyFilterChanged(): void;
    onNewRowsLoaded(): void;
    setFilterValues(values: (TValue | null)[]): void;
    resetFilterValues(): void;
    /**
     * @param suppressAvailableValuesCheck when refreshing values via the API, the model will be reset if all available values are selected.
     * When refreshing due to internal changes, set this to `true` to do the reset check based on all values instead.
     */
    refreshFilterValues(suppressAvailableValuesCheck?: boolean): void;
    getFilterKeys(): SetFilterModelValue;
    getFilterValues(): (TValue | null)[];
    isTreeDataOrGrouping(): boolean;
    caseFormat<T extends string | number | null>(valueToFormat: T): T;
    private addEventListenersForDataChanges;
    private syncAfterDataChange;
    private validateModel;
    private isValuesTakenFromGrid;
    private doesFilterPassForTreeData;
    private doesFilterPassForGrouping;
    private generateCreateKey;
    private getKeyCreatorParams;
    private setValueFormatter;
    getCrossFilterModel(callback: (createKey: (value: TValue | null | undefined) => string | null, availableKeys: Set<string | null>, existingValues: SetFilterModelValue | undefined) => SetFilterModel): SetFilterModel;
    destroy(): void;
}
export {};
