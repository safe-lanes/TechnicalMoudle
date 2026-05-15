import type { IServerSideGroupSelectionState, IServerSideSelectionState, ISetNodesSelectedParams, RowNode, RowRangeSelectionContext } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
import type { ISelectionStrategy } from './iSelectionStrategy';
export declare class DefaultStrategy extends BeanStub implements ISelectionStrategy {
    private readonly selectionCtx;
    private selectedState;
    /**
     * Whether select-all functionality has ever been used. Used only to print warnings in `getSelectedNodes` for users.
     * We print a warning even if not currently selecting all because we want users to be aware of the potential
     * for unexpected behaviour when these two features are used together.
     */
    private selectAllUsed;
    /** This is to prevent regressions, default selectionSvc retains reference of selected nodes. */
    private selectedNodes;
    constructor(selectionCtx: RowRangeSelectionContext);
    getSelectedState(): IServerSideSelectionState;
    setSelectedState(state: IServerSideSelectionState | IServerSideGroupSelectionState): void;
    deleteSelectionStateFromParent(parentPath: string[], removedNodeIds: string[]): boolean;
    setNodesSelected(params: ISetNodesSelectedParams): number;
    processNewRow(node: RowNode<any>): void;
    isNodeSelected(node: RowNode): boolean | undefined;
    getSelectedNodes(nullWhenSelectAll?: boolean, warnWhenSelectAll?: boolean): RowNode<any>[] | null;
    getSelectedRows(): any[];
    getSelectionCount(): number;
    isEmpty(): boolean;
    selectAllRowNodes(): void;
    deselectAllRowNodes(): void;
    private reset;
    getSelectAllState(): boolean | null;
}
