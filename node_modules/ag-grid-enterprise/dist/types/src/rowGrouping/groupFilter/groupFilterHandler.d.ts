import type { AgColumn, FilterHandler, FilterHandlerParams, IFilterParams } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
type GroupFilterHandlerEventType = 'sourceColumnsChanged' | 'selectedColumnChanged' | 'destroyed';
export declare class GroupFilterHandler extends BeanStub<GroupFilterHandlerEventType> implements FilterHandler<any, any, null, IFilterParams> {
    private params;
    selectedColumn: AgColumn | undefined;
    sourceColumns: AgColumn[];
    hasMultipleColumns: boolean;
    init(params: FilterHandlerParams<any, any, null, IFilterParams<any, any>>): void;
    refresh(params: FilterHandlerParams<any, any, null, IFilterParams<any, any>>): void;
    doesFilterPass(): boolean;
    setSelectedColumn(selectedColumn: AgColumn | undefined): void;
    private validateModel;
    private getSourceColumns;
    private updateColumns;
    private onFilterDestroyed;
}
export {};
