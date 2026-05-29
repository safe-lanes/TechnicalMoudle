import type { BeanCollection, ClientSideRowModelStage, GridOptions, IRowNodeStage, NamedBean, StageExecuteParams } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class FilterAggregatesStage extends BeanStub implements NamedBean, IRowNodeStage {
    beanName: "filterAggStage";
    refreshProps: Set<keyof GridOptions<any>>;
    step: ClientSideRowModelStage;
    private filterManager?;
    wireBeans(beans: BeanCollection): void;
    execute(params: StageExecuteParams): void;
    /** for tree data, we include all children, groups and leafs */
    private setAllChildrenCountTreeData;
    private setAllChildrenCountGridGrouping;
    private setAllChildrenCount;
}
