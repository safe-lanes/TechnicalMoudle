import type { AgColumn, DragAndDropIcon, GridDraggingEvent } from 'ag-grid-community';
import { BaseDropZonePanel } from './baseDropZonePanel';
export declare class ValuesDropZonePanel extends BaseDropZonePanel {
    constructor(horizontal: boolean);
    postConstruct(): void;
    protected getAriaLabel(): string;
    protected getIconName(): DragAndDropIcon;
    protected isItemDroppable(column: AgColumn, draggingEvent: GridDraggingEvent): boolean;
    protected updateItems(columns: AgColumn[]): void;
    protected getExistingItems(): AgColumn[];
}
