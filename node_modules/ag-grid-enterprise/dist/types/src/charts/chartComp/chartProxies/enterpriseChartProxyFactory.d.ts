import type { BeanName, NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
import type { ChartProxy, ChartProxyParams } from './chartProxy';
export declare class EnterpriseChartProxyFactory extends BeanStub implements NamedBean {
    beanName: BeanName;
    createChartProxy(chartProxyParams: ChartProxyParams): ChartProxy | undefined;
}
