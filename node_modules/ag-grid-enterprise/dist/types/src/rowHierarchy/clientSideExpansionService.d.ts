import type { BeanCollection, IExpansionService, NamedBean, RowGroupOpenedEvent } from 'ag-grid-community';
import { BaseExpansionService } from './baseExpansionService';
export declare class ClientSideExpansionService extends BaseExpansionService implements NamedBean, IExpansionService {
    beanName: "expansionSvc";
    private rowModel;
    private events;
    private dispatchExpandedDebounced;
    wireBeans(beans: BeanCollection): void;
    expandRows(rowIdsToExpand: string[], rowIdsToCollapse?: string[]): void;
    expandAll(expand: boolean): void;
    onGroupExpandedOrCollapsed(): void;
    protected dispatchExpandedEvent(event: RowGroupOpenedEvent, forceSync?: boolean): void;
    private debounce;
}
