import type { FilterPanelFilterState } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
interface SingleRefresh {
    id: string;
    state: FilterPanelFilterState;
}
interface MultiRefreshActive {
    activeId: string;
}
interface ActionRefresh {
    action: true;
}
export type FilterPanelRefreshParams = SingleRefresh | MultiRefreshActive | ActionRefresh;
export declare class FilterPanel extends Component {
    private readonly eContainer;
    private filters;
    private addFilterComp?;
    private buttonComp?;
    constructor();
    refresh(params?: FilterPanelRefreshParams): void;
    private refreshActions;
    destroy(): void;
}
export {};
