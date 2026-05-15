import type { IntegratedModule } from 'ag-charts-types';
import type { NamedBean } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
type ChartTypes = IntegratedModule;
/** Bean to expose the AG Charts apis from a single location and not require a code dependency on ag-charts-community */
export declare class AgChartsExports extends BeanStub implements NamedBean {
    beanName: "agChartsExports";
    isEnterprise: boolean;
    create: ChartTypes['create'];
    _Theme: ChartTypes['_Theme'];
    _Scene: ChartTypes['_Scene'];
    _Util: ChartTypes['_Util'];
    constructor(params: IntegratedModule);
}
export {};
