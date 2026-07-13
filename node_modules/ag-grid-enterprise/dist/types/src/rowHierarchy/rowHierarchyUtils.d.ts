import type { Bean, BeanCollection, GridOptionsService, GroupingApproach, IRowNode, RowNode, StageExecuteParams } from 'ag-grid-community';
export interface IRowGroupingStrategy<TData = any> extends Bean {
    execute(params: StageExecuteParams<TData>, approach: GroupingApproach): boolean | undefined | void;
    /** Called to reset the state when the strategy changes */
    reset?(): void;
    /** Gets a group or a filler node, as those nodes do not exists in ClientSideNodeManager */
    getNode(id: string): RowNode<TData> | undefined;
}
export interface GroupingRowNode<TData = any> extends RowNode<TData> {
    parent: this | null;
    allLeafChildren: this[] | null;
    childrenAfterGroup: this[] | null;
    treeParent: this | null;
    treeNodeFlags: number;
    sibling: this;
    sourceRowIndex: number;
}
/**
 * Returns if the node and all of its parents are all firstChild until ancestor node is reached
 * This is to check for [groupHideOpenParents] where we only show the expand controls for first child of a group
 *
 * @returns returns if node and all of its parents are first child until ancestor node is reached
 */
export declare function _isHiddenParent(node: RowNode, ancestor: RowNode, gos: GridOptionsService): boolean;
export declare const _getRowDefaultExpanded: (beans: BeanCollection, rowNode: IRowNode, level: number, group?: boolean | undefined) => boolean;
