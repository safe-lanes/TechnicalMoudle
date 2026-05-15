import type { IStickyRowService, NamedBean, RowCtrl, RowNode } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
import { StickyRowFeature } from './stickyRowFeature';
export declare class StickyRowService extends BeanStub implements NamedBean, IStickyRowService {
    beanName: "stickyRowSvc";
    createStickyRowFeature(ctrl: BeanStub, createRowCon: (rowNode: RowNode, animate: boolean, afterScroll: boolean) => RowCtrl, destroyRowCtrls: (rowCtrlsMap: Record<string, RowCtrl> | null | undefined, animate: boolean) => void): StickyRowFeature | undefined;
}
