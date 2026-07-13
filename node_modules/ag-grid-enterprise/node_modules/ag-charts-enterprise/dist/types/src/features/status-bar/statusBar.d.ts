import { _ModuleSupport } from 'ag-charts-community';
declare const BaseProperties: typeof _ModuleSupport.BaseProperties;
declare class StatusBarBackground extends BaseProperties {
    fill: string;
    fillOpacity: number;
}
export declare class StatusBar extends _ModuleSupport.BaseModuleInstance implements _ModuleSupport.ModuleInstance, _ModuleSupport.ScopeProvider {
    private readonly ctx;
    enabled: boolean;
    openKey?: string;
    highKey?: string;
    lowKey?: string;
    closeKey?: string;
    volumeKey?: string;
    readonly title: _ModuleSupport.Label<never, any>;
    readonly positive: _ModuleSupport.Label<never, any>;
    readonly negative: _ModuleSupport.Label<never, any>;
    readonly neutral: _ModuleSupport.Label<never, any>;
    readonly altNeutral: _ModuleSupport.Label<never, any>;
    readonly background: StatusBarBackground;
    layoutStyle: 'block' | 'overlay';
    readonly id = "status-bar";
    data?: any[];
    private readonly highlightManager;
    private readonly layer;
    private readonly labelGroup;
    private readonly backgroundNode;
    private readonly labels;
    constructor(ctx: _ModuleSupport.ModuleContext);
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    private startPerformLayout;
    private onLayoutComplete;
    private updateHighlight;
    private getChartType;
}
export {};
