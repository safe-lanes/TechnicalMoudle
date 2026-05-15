import type { AgColumn, ColumnEventType, IGroupFilterService, NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class GroupFilterService extends BeanStub implements NamedBean, IGroupFilterService {
    readonly beanName: "groupFilter";
    postConstruct(): void;
    isGroupFilter(column: AgColumn): boolean;
    isFilterAllowed(column: AgColumn): boolean;
    isFilterActive(column: AgColumn): boolean;
    getSourceColumns(column: AgColumn): AgColumn[] | null | undefined;
    updateFilterFlags(source: ColumnEventType, additionalEventAttributes?: any): void;
}
