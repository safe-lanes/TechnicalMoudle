import type { IntegratedModule } from 'ag-charts-types';
import type { _GridChartsGridApi, _ModuleWithApi } from 'ag-grid-community';
type IntegratedChartsModuleType = {
    with: (params: IntegratedModule) => _ModuleWithApi<_GridChartsGridApi>;
} & _ModuleWithApi<_GridChartsGridApi>;
/**
 * @deprecated v33 Deprecated as of v33, please use `IntegratedChartsModule` instead.
 */
export declare const GridChartsModule: _ModuleWithApi<_GridChartsGridApi>;
/**
 * @feature Integrated Charts
 * Requires the AG Charts library to be provided to this module via the `with` method.
 * The AG Charts module can be imported from either `ag-charts-community` or `ag-charts-enterprise`.
 * @example
 * import { AgChartsEnterpriseModule } from 'ag-charts-enterprise';
 * import { ModuleRegistry } from 'ag-grid-community';
 * import { IntegratedChartsModule } from 'ag-grid-enterprise';
 *
 * ModuleRegistry.registerModules([ IntegratedChartsModule.with(AgChartsEnterpriseModule) ]);
 */
export declare const IntegratedChartsModule: IntegratedChartsModuleType;
export {};
