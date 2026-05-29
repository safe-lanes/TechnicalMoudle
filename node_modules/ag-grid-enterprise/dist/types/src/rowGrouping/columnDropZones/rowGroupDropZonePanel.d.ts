import type { AgColumn, DragAndDropIcon, DraggingEvent } from 'ag-grid-community';
import { BaseDropZonePanel } from './baseDropZonePanel';
export declare class RowGroupDropZonePanel extends BaseDropZonePanel {
    constructor(horizontal: boolean);
    postConstruct(): void;
    protected getAriaLabel(): string;
    protected isItemDroppable(column: AgColumn, draggingEvent: DraggingEvent): boolean;
    protected updateItems(columns: AgColumn[]): void;
    protected getIconName(): DragAndDropIcon;
    protected getExistingItems(): AgColumn[];
}
