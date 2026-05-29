import type { RowCtrl, RowGroupOpenedEvent, RowNode } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare abstract class BaseExpansionService extends BeanStub {
    protected abstract dispatchExpandedEvent(event: RowGroupOpenedEvent, forceSync?: boolean): void;
    addExpandedCss(classes: string[], rowNode: RowNode): void;
    getRowExpandedListeners(rowCtrl: RowCtrl): {
        expandedChanged: () => void;
        hasChildrenChanged: () => void;
    };
    setExpanded(rowNode: RowNode, expanded: boolean, e?: MouseEvent | KeyboardEvent, forceSync?: boolean): void;
    isExpandable(rowNode: RowNode): boolean;
    private updateExpandedCss;
}
