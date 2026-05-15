import type { IntegratedModule } from 'ag-charts-types';
import type { _ModuleWithoutApi } from 'ag-grid-community';
type SparklineChartsModuleType = {
    with: (params: IntegratedModule) => _ModuleWithoutApi;
} & _ModuleWithoutApi;
/**
 * @feature Sparklines
 * Requires the AG Charts library to be provided to this module via the `with` method.
 * The AG Charts module can be imported from either `ag-charts-community` or `ag-charts-enterprise`.
 * @example
 * import { AgChartsCommunityModule } from 'ag-charts-community';
 * import { ModuleRegistry } from 'ag-grid-community';
 * import { SparklinesModule } from 'ag-grid-enterprise';
 *
 * ModuleRegistry.registerModules([ SparklinesModule.with(AgChartsCommunityModule) ]);
 */
export declare const SparklinesModule: SparklineChartsModuleType;
export {};
