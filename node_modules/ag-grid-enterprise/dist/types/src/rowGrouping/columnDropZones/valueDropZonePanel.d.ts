import type { AgColumn, DragAndDropIcon, DraggingEvent } from 'ag-grid-community';
import { BaseDropZonePanel } from './baseDropZonePanel';
export declare class ValuesDropZonePanel extends BaseDropZonePanel {
    constructor(horizontal: boolean);
    postConstruct(): void;
    protected getAriaLabel(): string;
    protected getIconName(): DragAndDropIcon;
    protected isItemDroppable(column: AgColumn, draggingEvent: DraggingEvent): boolean;
    protected updateItems(columns: AgColumn[]): void;
    protected getExistingItems(): AgColumn[];
}
