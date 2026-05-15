import type { AgEvent, ComponentSelector, ToolPanelDef } from 'ag-grid-community';
import { Component } from 'ag-grid-community';
import { SideBarButtonComp } from './sideBarButtonComp';
export interface SideBarButtonClickedEvent extends AgEvent<'sideBarButtonClicked'> {
    toolPanelId: string;
}
type AgSideBarButtonsEvent = 'sideBarButtonClicked';
export declare class AgSideBarButtons extends Component<AgSideBarButtonsEvent> {
    private buttonComps;
    constructor();
    postConstruct(): void;
    private handleKeyDown;
    setActiveButton(id: string | undefined): void;
    addButtonComp(def: ToolPanelDef): SideBarButtonComp;
    clearButtons(): void;
    destroy(): void;
}
export declare const AgSideBarButtonsSelector: ComponentSelector;
export {};
