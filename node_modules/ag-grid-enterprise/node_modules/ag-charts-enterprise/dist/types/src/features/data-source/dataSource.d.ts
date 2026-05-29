import { _ModuleSupport } from 'ag-charts-community';
import type { AgDataSourceCallbackParams } from 'ag-charts-types';
export declare class DataSource extends _ModuleSupport.BaseModuleInstance implements _ModuleSupport.ModuleInstance {
    enabled: boolean;
    getData: (params: AgDataSourceCallbackParams) => Promise<unknown>;
    requestThrottle?: number;
    updateThrottle?: number;
    updateDuringInteraction?: boolean;
    private readonly dataService;
    constructor(ctx: _ModuleSupport.ModuleContext);
    private updateCallback;
}
