import type { Column, IFooterService, IRowNode, NamedBean, RowNode } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class FooterService extends BeanStub implements NamedBean, IFooterService {
    beanName: "footerSvc";
    addTotalRows(startIndex: number, node: RowNode, callback: (node: RowNode, index: number) => void, includeFooterNodes: boolean, isRootNode: boolean, position: 'top' | 'bottom'): number;
    getTopDisplayIndex(rowsToDisplay: RowNode[], topLevelIndex: number, childrenAfterSort: RowNode[], getDefaultIndex: (adjustedIndex: number) => number): number;
    doesCellShowTotalPrefix(node: IRowNode, col?: Column): boolean;
    applyTotalPrefix(value: any, formattedValue: string | null, node: IRowNode, column: Column): string;
    getTotalValue(value: any): string;
}
