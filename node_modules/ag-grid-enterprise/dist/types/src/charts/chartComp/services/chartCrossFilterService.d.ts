import type { NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
export declare class ChartCrossFilterService extends BeanStub implements NamedBean {
    beanName: "chartCrossFilterSvc";
    filter(event: any, reset?: boolean): void;
    private updateFilters;
    private convertRawValue;
}
