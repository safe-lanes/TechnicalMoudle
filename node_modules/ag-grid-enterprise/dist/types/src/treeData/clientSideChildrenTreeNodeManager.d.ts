import type { ClientSideNodeManagerUpdateRowDataResult, IChangedRowNodes, IClientSideNodeManager, NamedBean, RefreshModelParams, RowDataTransaction, RowNode } from 'ag-grid-community';
import { AbstractClientSideNodeManager } from 'ag-grid-community';
export declare class ClientSideChildrenTreeNodeManager<TData> extends AbstractClientSideNodeManager<TData> implements IClientSideNodeManager<TData>, NamedBean {
    beanName: "csrmChildrenTreeNodeSvc";
    private childrenGetter;
    destroy(): void;
    extractRowData(): TData[] | null | undefined;
    activate(rootNode: RowNode<TData>): void;
    deactivate(): void;
    updateRowData(_rowDataTran: RowDataTransaction<TData>, changedRowNodes: IChangedRowNodes<TData>): ClientSideNodeManagerUpdateRowDataResult<TData>;
    protected loadNewRowData(rowData: TData[]): void;
    setImmutableRowData(params: RefreshModelParams<TData>, rowData: TData[]): void;
}
