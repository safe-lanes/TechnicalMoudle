import type { GetGroupIncludeFooterParams, GridOptions, GridOptionsService, RowNode, WithoutGridCommon } from 'ag-grid-community';
export interface FlattenDetails {
    hideOpenParents: boolean;
    groupHideParentOfSingleChild: GridOptions['groupHideParentOfSingleChild'];
    isGroupMultiAutoColumn: boolean;
    grandTotalRow: GridOptions['grandTotalRow'];
    groupTotalRow: (params: WithoutGridCommon<GetGroupIncludeFooterParams<any, any>>) => 'top' | 'bottom' | undefined;
}
export declare function _getFlattenDetails(gos: GridOptionsService): FlattenDetails;
export declare function _isRemovedSingleChildrenGroup(details: FlattenDetails, rowNode: RowNode, isParent: boolean): boolean;
export declare function _isRemovedLowestSingleChildrenGroup(details: FlattenDetails, rowNode: RowNode, isParent: boolean): boolean | undefined;
export declare function _shouldRowBeRendered(details: FlattenDetails, rowNode: RowNode, isParent: boolean, skipLeafNodes: boolean, isRemovedSingleChildrenGroup: boolean, isRemovedLowestSingleChildrenGroup: boolean | undefined): boolean;
