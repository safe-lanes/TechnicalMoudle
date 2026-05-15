import type { BeanCollection, NamedBean, RowNode } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
import type { SSRMParams } from '../serverSideRowModel';
import { LazyStore } from './lazy/lazyStore';
export declare class StoreFactory extends BeanStub implements NamedBean {
    beanName: "ssrmStoreFactory";
    private colModel;
    private rowGroupColsSvc?;
    private pivotColsSvc?;
    private rowAutoHeight?;
    wireBeans(beans: BeanCollection): void;
    createStore(ssrmParams: SSRMParams, parentNode: RowNode): LazyStore;
    private getStoreParams;
    private getMaxBlocksInCache;
    private getBlockSize;
    private getLevelSpecificParams;
}
