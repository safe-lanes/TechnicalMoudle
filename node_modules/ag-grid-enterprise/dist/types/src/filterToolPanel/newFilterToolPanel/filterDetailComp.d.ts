import type { FilterPanelDetailState } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
export declare class FilterDetailComp extends Component<'filterTypeChanged'> {
    private readonly eFilterType;
    private state?;
    postConstruct(): void;
    refresh(newState: FilterPanelDetailState): void;
}
