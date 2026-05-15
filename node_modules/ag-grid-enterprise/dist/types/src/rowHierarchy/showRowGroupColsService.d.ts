import { BeanStub } from 'ag-grid-community';
import type { AgColumn, IShowRowGroupColsService, NamedBean } from 'ag-grid-community';
export declare class ShowRowGroupColsService extends BeanStub implements NamedBean, IShowRowGroupColsService {
    beanName: "showRowGroupCols";
    private showRowGroupCols;
    private showRowGroupColsMap;
    refresh(): void;
    getShowRowGroupCols(): AgColumn[];
    getShowRowGroupCol(id: string): AgColumn | undefined;
    getSourceColumnsForGroupColumn(groupCol: AgColumn): AgColumn[] | null;
    isRowGroupDisplayed(column: AgColumn, colId: string): boolean;
}
