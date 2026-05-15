import type { FilterHandlerParams, ISetFilterParams, RowNode, SetFilterModel, SetFilterModelValue } from 'ag-grid-community';
import { AgPromise, BeanStub } from 'ag-grid-community';
import type { ClientSideValuesExtractor } from './clientSideValueExtractor';
type SetValueModelEvent = 'availableValuesChanged' | 'loadingStart' | 'loadingEnd' | 'destroyed';
declare enum SetFilterModelValuesType {
    PROVIDED_LIST = 0,
    PROVIDED_CALLBACK = 1,
    TAKEN_FROM_GRID_VALUES = 2
}
export default SetFilterModelValuesType;
interface SetValueModelParams<TValue> {
    handlerParams: FilterHandlerParams<any, any, SetFilterModel, ISetFilterParams<any, TValue>>;
    usingComplexObjects?: boolean;
}
export declare class SetValueModel<TValue> extends BeanStub<SetValueModelEvent> {
    private readonly clientSideValuesExtractor;
    private readonly caseFormat;
    private readonly createKey;
    private readonly isTreeDataOrGrouping;
    private params;
    /** Values can be loaded asynchronously, so wait on this promise if you need to ensure values have been loaded. */
    allKeys: AgPromise<(string | null)[]>;
    /** All possible values for the filter, sorted if required. */
    allValues: Map<string | null, TValue | null>;
    /** Remaining keys when filters from other columns have been applied. */
    availableKeys: Set<string | null>;
    valuesType: SetFilterModelValuesType;
    private keyComparator;
    private entryComparator;
    private compareByValue;
    private providedValues;
    private initialised;
    constructor(clientSideValuesExtractor: ClientSideValuesExtractor<TValue> | undefined, caseFormat: <T extends string | null>(valueToFormat: T) => T, createKey: (value: TValue | null | undefined, node?: RowNode) => string | null, isTreeDataOrGrouping: () => boolean, params: SetValueModelParams<TValue>);
    postConstruct(): void;
    refresh(params: SetValueModelParams<TValue>): void;
    private updateParams;
    updateAllValues(): AgPromise<(string | null)[]>;
    getAvailableValues(predicate: (node: RowNode) => boolean): (string | null)[];
    overrideValues(valuesToUse: (TValue | null)[]): AgPromise<void>;
    refreshAvailable(): AgPromise<boolean>;
    refreshAll(): AgPromise<void>;
    isLoading(): boolean;
    isInitialised(): boolean;
    getValueForFormatter(key: string | null): TValue | string | null;
    getAvailableKeys(values: SetFilterModelValue): SetFilterModelValue;
    private getParamsForValuesFromRows;
    private getValuesFromRows;
    private getValuesFromRowsAsync;
    private processAllValues;
    private uniqueValues;
    private validateProvidedValues;
    private sortKeys;
    private showAvailableOnly;
    private updateAvailableKeys;
}
