import type { AgColumn, BeanCollection, NamedBean, RowBounds } from 'ag-grid-community';
import { BeanStub, RowNode } from 'ag-grid-community';
export declare class BlockUtils extends BeanStub implements NamedBean {
    beanName: "ssrmBlockUtils";
    private valueSvc;
    private showRowGroupCols?;
    private nodeManager;
    private expansionSvc?;
    private serverSideRowModel;
    private storeFactory;
    wireBeans(beans: BeanCollection): void;
    createRowNode(params: {
        group: boolean;
        leafGroup: boolean;
        level: number;
        parent: RowNode;
        field: string;
        rowGroupColumn: AgColumn;
        rowHeight?: number;
    }): RowNode;
    destroyRowNode(rowNode: RowNode, preserveStore?: boolean): void;
    private setTreeGroupInfo;
    private setRowGroupInfo;
    private setMasterDetailInfo;
    updateDataIntoRowNode(rowNode: RowNode, data: any): void;
    private updateRowFooter;
    setDataIntoRowNode(rowNode: RowNode, data: any, defaultId: string, cachedRowHeight: number | undefined): void;
    private setChildCountIntoRowNode;
    private setGroupDataIntoRowNode;
    clearDisplayIndex(rowNode: RowNode): void;
    setDisplayIndex(rowNode: RowNode, displayIndexSeq: {
        value: number;
    }, nextRowTop: {
        value: number;
    }, uiLevel: number): void;
    extractRowBounds(rowNode: RowNode, index: number): RowBounds | undefined;
    private isPixelInNodeRange;
    getIndexAtPixel(rowNode: RowNode, pixel: number): number | null;
    createNodeIdPrefix(parentRowNode: RowNode): string | undefined;
    checkOpenByDefault(rowNode: RowNode): void;
}
