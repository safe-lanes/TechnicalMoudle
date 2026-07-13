import type { BeanCollection, ClientSideRowModelStage, GridOptions, IRowNodeStage, NamedBean, StageExecuteParams } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class AggregationStage extends BeanStub implements NamedBean, IRowNodeStage {
    beanName: "aggStage";
    refreshProps: Set<keyof GridOptions<any>>;
    step: ClientSideRowModelStage;
    private colModel;
    private valueSvc;
    private pivotColsSvc?;
    private valueColsSvc?;
    private pivotResultCols?;
    wireBeans(beans: BeanCollection): void;
    execute(params: StageExecuteParams): any;
    private createAggDetails;
    private isSuppressAggFilteredOnly;
    private recursivelyCreateAggData;
    private aggregateRowNode;
    private aggregateRowNodeUsingValuesAndPivot;
    private aggregateRowNodeUsingValuesOnly;
    private getValuesPivotNonLeaf;
    private getValuesFromMappedSet;
    private getValuesNormal;
    private setAggData;
}
