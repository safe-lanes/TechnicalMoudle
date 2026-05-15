import type { MenuItemDef, NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class ChartMenuItemMapper extends BeanStub implements NamedBean {
    beanName: "chartMenuItemMapper";
    getChartItems(key: 'pivotChart' | 'chartRange'): MenuItemDef | null;
    private cleanInternals;
    private buildLookup;
    /**
     * Make the MenuItem match the charts provided and their ordering on the ChartGroupsDef config object as provided by the user.
     */
    private filterAndOrderChartMenu;
}
