import type { IStickyRowFeature, RowCtrl, RowNode } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class StickyRowFeature extends BeanStub implements IStickyRowFeature {
    private readonly createRowCon;
    private readonly destroyRowCtrls;
    stickyTopRowCtrls: RowCtrl[];
    stickyBottomRowCtrls: RowCtrl[];
    private gridBodyCtrl;
    private topContainerHeight;
    private bottomContainerHeight;
    private isClientSide;
    extraTopHeight: number;
    extraBottomHeight: number;
    constructor(createRowCon: (rowNode: RowNode, animate: boolean, afterScroll: boolean) => RowCtrl, destroyRowCtrls: (rowCtrlsMap: Record<string, RowCtrl> | null | undefined, animate: boolean) => void);
    postConstruct(): void;
    private setOffsetTop;
    private setOffsetBottom;
    resetOffsets(): void;
    /**
     * Get the last pixel of the group, this pixel is used to push the sticky node up out of the viewport.
     */
    private getLastPixelOfGroup;
    /**
     * Get the first pixel of the group, this pixel is used to push the sticky node down out of the viewport
     */
    private getFirstPixelOfGroup;
    private updateStickyRows;
    private areFooterRowsStickySuppressed;
    private canRowsBeSticky;
    private getStickyAncestors;
    checkStickyRows(): boolean;
    destroyStickyCtrls(): void;
    private resetStickyContainers;
    refreshStickyNode(stickRowNode: RowNode): void;
    /**
     * Destroy old ctrls and create new ctrls where necessary.
     */
    private refreshNodesAndContainerHeight;
    ensureRowHeightsValid(): boolean;
}
