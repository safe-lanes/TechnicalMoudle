import type { FilterChangedEvent, IFloatingFilterComp, IFloatingFilterParams } from 'ag-grid-community';
import { AgPromise, Component } from 'ag-grid-community';
import type { GroupFilter } from './groupFilter';
export declare class GroupFloatingFilterComp extends Component implements IFloatingFilterComp<GroupFilter> {
    private readonly eFloatingFilter;
    private params;
    private eFloatingFilterText;
    private parentFilterInstance;
    private underlyingFloatingFilter;
    private showingUnderlyingFloatingFilter;
    private haveAddedColumnListeners;
    constructor();
    init(params: IFloatingFilterParams<GroupFilter>): AgPromise<void>;
    refresh(params: IFloatingFilterParams<GroupFilter>): void;
    private setParams;
    private addHandlerListeners;
    private setupReadOnlyFloatingFilterElement;
    private setupUnderlyingFloatingFilterElement;
    private getSelectedColumn;
    private onColumnVisibleChanged;
    private onColDefChanged;
    onParentModelChanged(_model: null, event: FilterChangedEvent): void;
    private updateDisplayedValue;
    private onColChange;
}
