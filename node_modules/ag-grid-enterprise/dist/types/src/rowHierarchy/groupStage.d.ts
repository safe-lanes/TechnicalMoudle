import type { ClientSideRowModelStage, GridOptions, IRowGroupStage, NamedBean, RowNode, StageExecuteParams } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class GroupStage<TData> extends BeanStub implements NamedBean, IRowGroupStage {
    beanName: "groupStage";
    refreshProps: Set<keyof GridOptions<any>>;
    step: ClientSideRowModelStage;
    private approach;
    private strategyBeanName;
    private strategy;
    /** Gets a filler row by id */
    getNode(id: string): RowNode<TData> | undefined;
    destroy(): void;
    execute(params: StageExecuteParams<TData>): boolean | undefined;
    private getStrategyBeanName;
    private changeApproach;
}
