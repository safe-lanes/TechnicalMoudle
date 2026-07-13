import type { BeanCollection, IExpansionService, NamedBean, RowGroupOpenedEvent, RowNode } from 'ag-grid-community';
import { BaseExpansionService } from '../../rowHierarchy/baseExpansionService';
export declare class ServerSideExpansionService extends BaseExpansionService implements NamedBean, IExpansionService {
    beanName: "expansionSvc";
    private serverSideRowModel;
    wireBeans(beans: BeanCollection): void;
    private queuedRowIds;
    postConstruct(): void;
    checkOpenByDefault(rowNode: RowNode): void;
    expandRows(rowIdsToExpand: string[], rowIdsToCollapse?: string[]): void;
    expandAll(value: boolean): void;
    onGroupExpandedOrCollapsed(): void;
    protected dispatchExpandedEvent(event: RowGroupOpenedEvent): void;
}
