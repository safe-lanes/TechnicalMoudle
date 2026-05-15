import type { AgColumn, DragAndDropIcon, GridDraggingEvent } from 'ag-grid-community';
import { BaseDropZonePanel } from './baseDropZonePanel';
export declare class RowGroupDropZonePanel extends BaseDropZonePanel {
    constructor(horizontal: boolean);
    postConstruct(): void;
    protected getAriaLabel(): string;
    protected isItemDroppable(column: AgColumn, draggingEvent: GridDraggingEvent): boolean;
    protected updateItems(columns: AgColumn[]): void;
    protected getIconName(): DragAndDropIcon;
    protected getExistingItems(): AgColumn[];
}
