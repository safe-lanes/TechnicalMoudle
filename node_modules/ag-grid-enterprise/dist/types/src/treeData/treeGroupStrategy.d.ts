import type { GroupingApproach, StageExecuteParams } from 'ag-grid-community';
import { RowNode } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
import type { IRowGroupingStrategy } from '../rowHierarchy/rowHierarchyUtils';
export declare class TreeGroupStrategy<TData = any> extends BeanStub implements IRowGroupingStrategy<TData> {
    private groupColsIds;
    private groupColsChanged;
    private parentIdGetter;
    private fillerNodesById;
    private nodesToUnselect;
    destroy(): void;
    reset(): void;
    getNode(id: string): RowNode<TData> | undefined;
    execute(params: StageExecuteParams<TData>, approach: GroupingApproach): boolean;
    private flagUpdatedNodes;
    private initRowsParents;
    private destroyFillerRows;
    private initRowsChildrenSize;
    private initRowChildrenSize;
    private preprocessRows;
    private traverseRoot;
    /**
     * After all the rows are initialized and treeParent is set and childrenAfterGroup is filled,
     * we traverse the tree to finalize it
     * @returns the number of leaf nodes processed, which is used to detect cycles in the tree, and a flag set if leaf children were changed.
     */
    private traverse;
    private updateAllLeafChildren;
    /** Handle cycles in a tree. Is not optimal for performance but this is an edge case that shouldn't happen as is a warning. */
    private handleCycles;
    private setGroupData;
    /** Load the tree structure for nested groups, aka children property */
    private loadNested;
    /** Load the tree structure for self-referencing data, aka parentId field */
    private loadSelfRef;
    private loadFlattened;
    /** Load the tree structure for data paths, aka getDataPath callback */
    private loadDataPath;
    private loadExistingDataPath;
    private duplicatedPath;
    private buildFromPaths;
    private processDuplicatePaths;
    private getOrCreateFiller;
    private deselectHiddenNodes;
    private hideRow;
    private checkGroupColsUpdated;
}
