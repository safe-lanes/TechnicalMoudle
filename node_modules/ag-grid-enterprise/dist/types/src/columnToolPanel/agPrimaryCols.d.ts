import type { ColDef, ColGroupDef, ColumnEventType } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
import type { ToolPanelColumnCompParams } from './columnToolPanel';
export declare class AgPrimaryCols extends Component {
    private readonly primaryColsHeaderPanel;
    private readonly primaryColsListPanel;
    private positionableFeature;
    constructor();
    init(allowDragging: boolean, params: ToolPanelColumnCompParams, eventType: ColumnEventType): void;
    toggleResizable(resizable: boolean): void;
    expandGroups(groupIds?: string[]): void;
    collapseGroups(groupIds?: string[]): void;
    setColumnLayout(colDefs: (ColDef | ColGroupDef)[]): void;
    syncLayoutWithGrid(): void;
    getExpandedGroups(): string[];
}
