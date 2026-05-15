import type { AgColumn, CellCtrl, EventShowContextMenuParams, IContextMenuService, NamedBean, RowCtrl, RowNode } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class ContextMenuService extends BeanStub implements NamedBean, IContextMenuService {
    beanName: "contextMenuSvc";
    private destroyLoadingSpinner;
    private lastPromise;
    private activeMenu;
    hideActiveMenu(): void;
    private getMenuItems;
    getContextMenuPosition(rowNode?: RowNode | null, column?: AgColumn | null): {
        x: number;
        y: number;
    };
    showContextMenu(params: EventShowContextMenuParams & {
        anchorToElement?: HTMLElement;
    }): void;
    handleContextMenuMouseEvent(mouseEvent: MouseEvent | undefined, touchEvent: TouchEvent | undefined, rowCtrl: RowCtrl | null, cellCtrl: CellCtrl): void;
    private showMenu;
    private createLoadingIcon;
    private createContextMenu;
    private dispatchVisibleChangedEvent;
    private getRowCtrl;
    private getCellGui;
    private getContextMenuAnchorElement;
    destroy(): void;
}
