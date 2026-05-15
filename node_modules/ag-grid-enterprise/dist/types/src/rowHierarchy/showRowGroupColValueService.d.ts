import type { AgColumn, IRowNode, IShowRowGroupColsValueService, NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
/**
 * Containers helper functions specific to row group col values.
 */
export declare class ShowRowGroupColValueService extends BeanStub implements NamedBean, IShowRowGroupColsValueService {
    beanName: "showRowGroupColValueSvc";
    /**
     * Get the value for format in the group column, also returns the displayedNode from which the value was
     * taken in cases of groupHideOpenParents and showOpenedGroup.
     */
    getGroupValue(node: IRowNode, column?: AgColumn): {
        displayedNode: IRowNode;
        value: any;
    } | null;
    /**
     * Formats a group col value, and prefixes it with the "Total" prefix if applicable
     */
    formatAndPrefixGroupColValue(groupValue: {
        displayedNode: IRowNode;
        value: any;
    }, column?: AgColumn, exporting?: boolean): string | null;
    /**
     * Formats the group col value using the underlying column's value formatter
     */
    private formatGroupColValue;
    /**
     * Checks if the node has a value to inherit from the parent node for display in the given column
     *
     * This is used when [groupHideOpenParents] or [showOpenedGroup] are enabled
     *
     * @param node node to check for preferential nodes to display
     * @param column column to get the displayed node for
     * @returns a parent node of node to display the value from, or undefined if no value will be inherited
     */
    getDisplayedNode(node: IRowNode, column: AgColumn, onlyHideOpenParents?: boolean): IRowNode | undefined;
}
