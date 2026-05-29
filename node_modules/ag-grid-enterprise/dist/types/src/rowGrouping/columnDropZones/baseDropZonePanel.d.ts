import type { AgColumn, ColumnEventType, DragItem, DraggingEvent, DropTarget } from 'ag-grid-community';
import { DragSourceType } from 'ag-grid-community';
import type { PillDropZonePanelParams } from '../../widgets/pillDropZonePanel';
import { PillDropZonePanel } from '../../widgets/pillDropZonePanel';
import { DropZoneColumnComp } from './dropZoneColumnComp';
export type TDropZone = 'rowGroup' | 'pivot' | 'aggregation';
export declare abstract class BaseDropZonePanel extends PillDropZonePanel<DropZoneColumnComp, AgColumn> {
    private dropZonePurpose;
    constructor(horizontal: boolean, dropZonePurpose: TDropZone);
    init(params: PillDropZonePanelParams): void;
    protected getItems(dragItem: DragItem): AgColumn[];
    protected isInterestedIn(type: DragSourceType): boolean;
    protected minimumAllowedNewInsertIndex(): number;
    private showOrHideColumnOnExit;
    protected handleDragEnterEnd(draggingEvent: DraggingEvent): void;
    protected handleDragLeaveEnd(draggingEvent: DraggingEvent): void;
    setColumnsVisible(columns: AgColumn[] | null | undefined, visible: boolean, source: ColumnEventType): void;
    private isRowGroupPanel;
    protected createPillComponent(column: AgColumn, dropTarget: DropTarget, ghost: boolean, horizontal: boolean): DropZoneColumnComp;
}
