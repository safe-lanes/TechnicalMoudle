import type { AgColumn, HeaderPosition, NamedBean, PopupEventParams } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
import type { CloseMenuEvent } from '../widgets/agMenuItemComponent';
export interface MenuRestoreFocusParams {
    column: AgColumn | undefined;
    headerPosition: HeaderPosition | null;
    columnIndex: number;
    eventSource?: HTMLElement;
}
export declare class MenuUtils extends BeanStub implements NamedBean {
    beanName: "menuUtils";
    restoreFocusOnClose(restoreFocusParams: MenuRestoreFocusParams, eComp: HTMLElement, e?: Event, restoreIfMouseEvent?: boolean): void;
    closePopupAndRestoreFocusOnSelect(hidePopupFunc: (popupParams?: PopupEventParams) => void, restoreFocusParams: MenuRestoreFocusParams, event?: CloseMenuEvent): void;
    onContextMenu(params: {
        mouseEvent: MouseEvent | null | undefined;
        touchEvent: TouchEvent | null | undefined;
        showMenuCallback: (eventOrTouch: MouseEvent | Touch) => boolean;
        source: 'api' | 'ui';
    }): void;
    private focusHeaderCell;
    private blockMiddleClickScrollsIfNeeded;
}
