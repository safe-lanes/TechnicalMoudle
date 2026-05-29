import type { AgColumn, AgProvidedColumnGroup, DefaultMenuItem, MenuItemDef, NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
import { AgMenuList } from '../widgets/agMenuList';
export declare class ColumnMenuFactory extends BeanStub implements NamedBean {
    beanName: "colMenuFactory";
    createMenu(parent: BeanStub<any>, menuItems: (DefaultMenuItem | MenuItemDef)[], column: AgColumn | undefined, sourceElement: () => HTMLElement): AgMenuList;
    getMenuItems(column?: AgColumn | null, columnGroup?: AgProvidedColumnGroup | null): (DefaultMenuItem | MenuItemDef)[];
    private getDefaultMenuOptions;
}
