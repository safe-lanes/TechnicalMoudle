import type { BeanCollection, StageExecuteParams } from 'ag-grid-community';
import { BeanStub, RowNode } from 'ag-grid-community';
import type { IRowGroupingStrategy } from '../../rowHierarchy/rowHierarchyUtils';
export declare class GroupStrategy extends BeanStub implements IRowGroupingStrategy {
    private colModel;
    private valueSvc;
    private selectionSvc?;
    private showRowGroupCols;
    wireBeans(beans: BeanCollection): void;
    private prevGroupCols;
    private prevShowGroupCols;
    getNode(id: string): RowNode | undefined;
    execute(params: StageExecuteParams): void;
    private positionLeafsAndGroups;
    private createGroupingDetails;
    private handleDeltaUpdate;
    private sortChildren;
    private orderGroups;
    private getExistingPathForNode;
    private moveNodeInWrongPath;
    private moveNode;
    private removeNodes;
    private forEachParentGroup;
    private removeNodesFromParents;
    private removeEmptyGroups;
    private removeFromParent;
    /**
     * This is idempotent, but relies on the `key` field being the same throughout a RowNode's lifetime
     */
    private addToParent;
    private checkAllGroupDataAfterColsChanged;
    private shotgunResetEverything;
    private noChangeInGroupingColumns;
    private insertNodes;
    private insertOneNode;
    private findParentForNode;
    private getOrCreateNextNode;
    private createGroup;
    private createGroupId;
    private setGroupData;
    private getChildrenMappedKey;
    private setExpandedInitialValue;
    private getGroupInfo;
}
