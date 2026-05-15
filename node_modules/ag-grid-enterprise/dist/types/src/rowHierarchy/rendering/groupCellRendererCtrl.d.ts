import type { GroupCellRendererParams, IGroupCellRenderer, IGroupCellRendererCtrl } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class GroupCellRendererCtrl extends BeanStub implements IGroupCellRendererCtrl {
    private params;
    private node;
    private displayedNode;
    private eGui;
    private eExpanded;
    private eContracted;
    private eCheckbox;
    private indentClass;
    private comp;
    private compClass;
    private cbComp?;
    init(comp: IGroupCellRenderer, eGui: HTMLElement, eCheckbox: HTMLElement, eExpanded: HTMLElement, eContracted: HTMLElement, compClass: any, params: GroupCellRendererParams): void;
    private initFooterCell;
    private initFullWidthCell;
    /**
     * Returns an aria "role" to place on full width group cells, or the parent wrapper.
     * @returns the aria role to place on the parent wrapper
     */
    getCellAriaRole(): string;
    /**
     * Determines if this cell should be rendered, as when using embeddedFullWidthRows
     * only one group cell should be rendered.
     *
     * if [enableRTL] all but pinned right cells should be skipped if available
     * otherwise prioritise pinned left cell if available
     * otherwise center viewport.
     *
     * @returns whether the cell should be skipped due to embedded full width rows
     */
    private isEmbeddedRowMismatch;
    /**
     * Displays the group value for the displayed node
     */
    private addGroupValue;
    /**
     * Sets up expand/collapse:
     * Chevron
     * Aria-expanded
     * Child count
     */
    private setupExpand;
    /**
     * Return the inner renderer details for the cell
     *
     * Prioritises:
     * 1. Group row renderer for group rows
     * 2. agFindCellRenderer for find results in group rows
     * 3. Provided innerRenderer (i.e, cellRendererParams.innerRenderer)
     * 4. Cell renderer of the grouped column
     * 5. Inner renderer of the grouped column
     * 6. agFindCellRenderer for find results
     */
    private getInnerCompDetails;
    /**
     * Get the allChildCount of a given node
     * @param node the node to return the count for
     * @returns 0 if the count should not be displayed, otherwise the count
     */
    private getChildCount;
    /**
     * Checks whether the current cell is expandable, either due to [groupHideOpenParent] control or otherwise.
     * @returns whether this cell is expandable
     */
    private isExpandable;
    /**
     * For full width group cells & single group column, indents child groups based on uiLevel
     */
    private setupIndent;
    /**
     * Selection checkboxes
     */
    private setupCheckbox;
    private addCheckbox;
    private destroyCheckbox;
    /**
     * Called when the expand / contract icon is clicked.
     */
    private onExpandClicked;
    /**
     * Called on cell key press - only handles 'Enter' key for expand/collapse
     */
    private onKeyDown;
    /**
     * Called on cell double click - only expands/collapses if the event is not on the expand / contract icon
     */
    private onCellDblClicked;
    /**
     * Called when expand or contract is attempted, to scroll the row and update the node state
     * @param e originating event
     */
    private onExpandOrContract;
    destroy(): void;
}
