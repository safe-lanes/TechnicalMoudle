import type { FilterAction, FilterPanelFilterState, IFilterPanelService, IToolPanelNewFiltersCompParams, NamedBean, NewFiltersToolPanelState, SelectableFilterDef } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class FilterPanelService extends BeanStub<'filterPanelStateChanged' | 'filterPanelStatesChanged'> implements IFilterPanelService, NamedBean {
    readonly beanName: "filterPanelSvc";
    private states;
    private orderedStates;
    private params?;
    private initialStateApplied;
    private initialState?;
    isActive: boolean;
    postConstruct(): void;
    getIds(): string[];
    getAvailable(): {
        id: string;
        name: string;
    }[];
    add(id: string): void;
    remove(id: string): void;
    getState<S extends FilterPanelFilterState>(id: string): S | undefined;
    private updateFilterState;
    expand(id: string, expanded: boolean): void;
    updateType(id: string, filterDef: SelectableFilterDef): void;
    getActions(): {
        actions: FilterAction[];
        canApply: boolean;
    } | undefined;
    doAction(action: FilterAction): void;
    updateParams(params: IToolPanelNewFiltersCompParams, initialState?: NewFiltersToolPanelState): void;
    getGridState(): NewFiltersToolPanelState;
    private createFilter;
    private createFilterStateWrapper;
    private updateFilterStates;
    private createFilterState;
    private onFilterDestroyed;
    private dispatchStatesUpdates;
    private applyInitialState;
    destroy(): void;
}
