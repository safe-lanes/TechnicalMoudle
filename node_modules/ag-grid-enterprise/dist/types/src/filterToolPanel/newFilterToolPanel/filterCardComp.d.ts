import type { FilterPanelFilterState } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
export declare class FilterCardComp extends Component {
    private readonly id;
    private readonly eTitle;
    private readonly eExpand;
    private readonly eDelete;
    private readonly eExpandIcon;
    private readonly eDeleteIcon;
    private readonly eEditing;
    private state?;
    private summaryComp?;
    private detailComp?;
    constructor(id: string);
    postConstruct(): void;
    refresh(newState: FilterPanelFilterState): void;
    private toggleExpand;
    private onFilterOpened;
    destroy(): void;
}
