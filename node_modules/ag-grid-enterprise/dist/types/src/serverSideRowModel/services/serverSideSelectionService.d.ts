import type { ISelectionService, ISetNodesSelectedParams, NamedBean, RowNode, SelectAllMode, SelectionEventSourceType, ServerSideRowGroupSelectionState, ServerSideRowSelectionState } from 'ag-grid-community';
import { BaseSelectionService } from 'ag-grid-community';
export declare class ServerSideSelectionService extends BaseSelectionService implements NamedBean, ISelectionService {
    beanName: "selectionSvc";
    private selectionStrategy;
    private selectionMode?;
    postConstruct(): void;
    handleSelectionEvent(event: MouseEvent | KeyboardEvent, rowNode: RowNode<any>, source: SelectionEventSourceType): number;
    getSelectionState(): string[] | ServerSideRowSelectionState | ServerSideRowGroupSelectionState | null;
    setSelectionState(state: string[] | ServerSideRowSelectionState | ServerSideRowGroupSelectionState | undefined, source: SelectionEventSourceType): void;
    setNodesSelected(params: ISetNodesSelectedParams): number;
    /**
     * Deletes the selection state for a set of nodes, for use after deleting nodes via
     * transaction. As this is designed for transactions, all nodes should belong to the same group.
     */
    deleteSelectionStateFromParent(storeRoute: string[], removedNodeIds: string[]): void;
    private shotgunResetNodeSelectionState;
    getSelectedNodes(): RowNode<any>[];
    getSelectedRows(): any[];
    getSelectionCount(): number;
    syncInRowNode(rowNode: RowNode<any>): void;
    reset(): void;
    isEmpty(): boolean;
    hasNodesToSelect(): boolean;
    selectAllRowNodes(params: {
        source: SelectionEventSourceType;
        selectAll?: SelectAllMode;
    }): void;
    deselectAllRowNodes(params: {
        source: SelectionEventSourceType;
        selectAll?: SelectAllMode;
    }): void;
    getSelectAllState(selectAll?: SelectAllMode): boolean | null;
    getBestCostNodeSelection(): RowNode<any>[] | undefined;
    /**
     * Updates the selectable state for a node by invoking isRowSelectable callback.
     * If the node is not selectable, it will be deselected.
     *
     * Callers:
     *  - property isRowSelectable changed
     *  - after grouping / treeData
     */
    protected updateSelectable(): void;
    private dispatchSelectionChanged;
    updateSelectableAfterGrouping(): void;
    refreshMasterNodeState(): void;
    setDetailSelectionState(): void;
}
