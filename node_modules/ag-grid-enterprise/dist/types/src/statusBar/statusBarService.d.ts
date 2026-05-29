import type { IStatusPanelComp, NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class StatusBarService extends BeanStub implements NamedBean {
    beanName: "statusBarSvc";
    private comps;
    constructor();
    registerStatusPanel(key: string, component: IStatusPanelComp): void;
    unregisterStatusPanel(key: string): void;
    unregisterAllComponents(): void;
    getStatusPanel(key: string): IStatusPanelComp;
    destroy(): void;
}
