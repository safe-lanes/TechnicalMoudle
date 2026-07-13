import type { ColKey, IColumnCollectionService, NamedBean, PropertyValueChangedEvent, _ColumnCollections } from 'ag-grid-community';
import { AgColumn, BeanStub } from 'ag-grid-community';
export declare class AutoColService extends BeanStub implements NamedBean, IColumnCollectionService {
    beanName: "autoColSvc";
    /** Group auto columns */
    columns: _ColumnCollections | null;
    postConstruct(): void;
    addColumns(cols: _ColumnCollections): void;
    createColumns(cols: _ColumnCollections, updateOrders: (callback: (cols: AgColumn[] | null) => AgColumn[] | null) => void): void;
    updateColumns(event: PropertyValueChangedEvent<'autoGroupColumnDef'>): void;
    getColumn(key: ColKey): AgColumn | null;
    getColumns(): AgColumn[] | null;
    private generateAutoCols;
    private isSuppressAutoCol;
    private createOneAutoCol;
    /**
     * Refreshes an auto group col to load changes from defaultColDef or autoGroupColDef
     */
    private updateOneAutoCol;
    private createAutoColDef;
    private createBaseColDef;
    destroy(): void;
}
