import { _ModuleSupport } from 'ag-charts-community';
export declare class ChartToolbar extends _ModuleSupport.BaseModuleInstance implements _ModuleSupport.ModuleInstance {
    private readonly ctx;
    enabled: boolean;
    private readonly toolbar;
    private readonly menu;
    constructor(ctx: _ModuleSupport.ModuleContext);
    private onLayoutStart;
    private onButtonPressed;
    private updateButton;
    private hidePopover;
    private setChartType;
    private getChartType;
}
