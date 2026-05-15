import type { IntegratedModule } from 'ag-charts-types';
import type { _ModuleWithoutApi } from 'ag-grid-community';
type AllEnterpriseModuleType = {
    with: (params: IntegratedModule) => _ModuleWithoutApi;
} & _ModuleWithoutApi;
/**
 * @feature All Enterprise and Community features
 * Registers all the Grid features: Community and Enterprise.
 * If using Integrated Charts or Sparklines then the relevant AG Charts module must be provided.
 * @example
 * // All Enterprise features
 * import { ModuleRegistry } from 'ag-grid-community';
 * import { AllEnterpriseModule } from 'ag-grid-enterprise';
 *
 * ModuleRegistry.registerModules([ AllEnterpriseModule ]);
 * @example
 * // All Enterprise features including Integrated Charts and Sparklines
 * import { ModuleRegistry } from 'ag-grid-community';
 * import { AgChartsEnterpriseModule } from 'ag-charts-enterprise';
 * import { AllEnterpriseModule } from 'ag-grid-enterprise';
 *
 * ModuleRegistry.registerModules([ AllEnterpriseModule.with(AgChartsEnterpriseModule) ]);
 *
 */
export declare const AllEnterpriseModule: AllEnterpriseModuleType;
export {};
