import type { BeanCollection, ColumnVO, NamedBean, RowNode, StoreRefreshAfterParams } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
import type { LazyStore } from './lazy/lazyStore';
export declare class StoreUtils extends BeanStub implements NamedBean {
    beanName: "ssrmStoreUtils";
    private colModel;
    private serverSideRowModel;
    private storeFactory;
    wireBeans(beans: BeanCollection): void;
    getChildStore(keys: string[], currentCache: LazyStore, findNodeFunc: (key: string) => RowNode | null): LazyStore | null;
    isServerRefreshNeeded(parentRowNode: RowNode, rowGroupCols: ColumnVO[], params: StoreRefreshAfterParams): boolean;
    getServerSideInitialRowCount(): number | null;
    isServerSideSortAllLevels(): boolean;
    isServerSideOnlyRefreshFilteredGroups(): boolean;
}
