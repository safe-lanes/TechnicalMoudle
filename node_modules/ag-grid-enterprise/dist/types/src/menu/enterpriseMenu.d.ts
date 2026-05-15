import type { AgColumn, AgProvidedColumnGroup, ContainerType, IMenuFactory, NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class EnterpriseMenuFactory extends BeanStub implements NamedBean, IMenuFactory {
    beanName: "enterpriseMenuFactory";
    private lastSelectedTab;
    private activeMenu;
    hideActiveMenu(): void;
    showMenuAfterMouseEvent(columnOrGroup: AgColumn | AgProvidedColumnGroup | undefined, mouseEvent: MouseEvent | Touch, containerType: ContainerType, onClosedCallback?: () => void, filtersOnly?: boolean): void;
    private splitColumnOrGroup;
    showMenuAfterButtonClick(columnOrGroup: AgColumn | AgProvidedColumnGroup | undefined, eventSource: HTMLElement, containerType: ContainerType, onClosedCallback?: () => void, filtersOnly?: boolean): void;
    private showMenu;
    private addStopAnchoring;
    private getMenuParams;
    private createMenu;
    private dispatchVisibleChangedEvent;
    isMenuEnabled(column: AgColumn): boolean;
    showMenuAfterContextMenuEvent(column: AgColumn | AgProvidedColumnGroup | undefined, mouseEvent?: MouseEvent | null, touchEvent?: TouchEvent | null): void;
}
