import type { ComponentSelector, ISideBar, ISideBarService, NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class SideBarService extends BeanStub implements NamedBean, ISideBarService {
    beanName: "sideBar";
    comp: ISideBar;
    getSelector(): ComponentSelector;
}
