import type { IRowChildrenService, NamedBean, RowNode } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
/** handles row grouping and tree data logic */
export declare class SsrmRowChildrenService extends BeanStub implements NamedBean, IRowChildrenService {
    beanName: "rowChildrenSvc";
    getHasChildrenValue(rowNode: RowNode): boolean | null;
}
