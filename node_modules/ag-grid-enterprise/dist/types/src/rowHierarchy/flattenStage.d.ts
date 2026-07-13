import type { ClientSideRowModelStage, GridOptions, IRowNodeStage, NamedBean, RowNode, StageExecuteParams } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class FlattenStage extends BeanStub implements IRowNodeStage<RowNode[]>, NamedBean {
    beanName: "flattenStage";
    refreshProps: Set<keyof GridOptions<any>>;
    step: ClientSideRowModelStage;
    execute(params: StageExecuteParams): RowNode[];
    private recursivelyAddToRowsToDisplay;
    private addRowNodeToRowsToDisplay;
}
