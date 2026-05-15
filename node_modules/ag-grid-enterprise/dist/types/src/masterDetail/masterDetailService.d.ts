import type { BeanName, DetailGridInfo, IMasterDetailService, NamedBean, RefreshModelParams, RowCtrl } from 'ag-grid-community';
import { BeanStub, RowNode } from 'ag-grid-community';
export declare class MasterDetailService extends BeanStub implements NamedBean, IMasterDetailService {
    beanName: BeanName;
    store: {
        [id: string]: DetailGridInfo | undefined;
    };
    private enabled;
    private isEnabled;
    postConstruct(): void;
    private addEventListeners;
    refreshModel(params: RefreshModelParams): void;
    setMaster(row: RowNode, created: boolean, updated: boolean): void;
    private setMasters;
    /** Used by flatten stage to get or create a detail node from a master node */
    getDetail(masterNode: RowNode): RowNode | null;
    setupDetailRowAutoHeight(rowCtrl: RowCtrl, eDetailGui: HTMLElement): void;
    destroy(): void;
}
