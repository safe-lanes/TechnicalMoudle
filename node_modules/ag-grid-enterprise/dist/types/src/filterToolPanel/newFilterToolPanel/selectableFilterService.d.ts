import type { AgColumn, IFilterDef, ISelectableFilterService, NamedBean, SelectableFilterDef, ValueGetterFunc } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class SelectableFilterService extends BeanStub implements ISelectableFilterService, NamedBean {
    readonly beanName: "selectableFilter";
    private selectedFilters;
    private valueGetters;
    getFilterValueGetter(colId: string): string | ValueGetterFunc | undefined;
    isSelectable(filterDef: IFilterDef): boolean;
    getFilterDef(column: AgColumn, filterDef: IFilterDef): IFilterDef;
    getDefs(column: AgColumn, filterDef: IFilterDef): {
        filterDefs: SelectableFilterDef[];
        activeFilterDef: SelectableFilterDef;
    } | undefined;
    setActive(colId: string, filterDefs: SelectableFilterDef[], activeFilterDef: SelectableFilterDef): void;
    clearActive(colId: string): void;
    destroy(): void;
    private getDefaultFilters;
}
