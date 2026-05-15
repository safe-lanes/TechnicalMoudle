import type { AgColumn, ColumnEventType, DefaultMenuItem, MenuItemDef, NamedBean, RowNode } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare const MENU_ITEM_SEPARATOR = "separator";
export declare function _removeRepeatsFromArray<T>(array: T[], object: T): void;
export declare class MenuItemMapper extends BeanStub implements NamedBean {
    beanName: "menuItemMapper";
    mapWithStockItems(originalList: (MenuItemDef | DefaultMenuItem)[], column: AgColumn | null, node: RowNode | null, sourceElement: () => HTMLElement, source: ColumnEventType): (MenuItemDef | 'separator')[];
}
