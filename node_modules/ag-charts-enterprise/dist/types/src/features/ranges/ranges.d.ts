import { _ModuleSupport } from 'ag-charts-community';
import { RangesButtonProperties } from './rangesButtonProperties';
export declare class Ranges extends _ModuleSupport.BaseModuleInstance implements _ModuleSupport.ModuleInstance {
    private readonly ctx;
    enabled: boolean;
    buttons: _ModuleSupport.PropertiesArray<RangesButtonProperties>;
    private readonly container;
    private readonly toolbar;
    private readonly verticalSpacing;
    constructor(ctx: _ModuleSupport.ModuleContext);
    private teardown;
    private onLayoutStart;
    private onZoomChanged;
    private onButtonPress;
}
