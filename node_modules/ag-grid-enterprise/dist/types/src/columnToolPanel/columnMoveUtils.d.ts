import type { AgColumn, AgProvidedColumnGroup, BeanCollection, ColumnPanelItemDragStartEvent, GridOptionsService } from 'ag-grid-community';
import type { VirtualListDragItem } from '../features/iVirtualListDragFeature';
import type { ToolPanelColumnComp } from './toolPanelColumnComp';
import { ToolPanelColumnGroupComp } from './toolPanelColumnGroupComp';
export declare const getCurrentColumnsBeingMoved: (column: AgColumn | AgProvidedColumnGroup | null) => AgColumn[];
export declare const isMoveBlocked: (gos: GridOptionsService, beans: BeanCollection, currentColumns: AgColumn[]) => boolean;
export declare const moveItem: (beans: BeanCollection, currentColumns: AgColumn[], lastHoveredListItem: VirtualListDragItem<ToolPanelColumnGroupComp | ToolPanelColumnComp> | null) => void;
export declare const getCurrentDragValue: (listItemDragStartEvent: ColumnPanelItemDragStartEvent) => AgColumn | AgProvidedColumnGroup;
