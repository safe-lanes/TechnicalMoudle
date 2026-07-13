import { _ModuleSupport } from 'ag-charts-community';
import { MiniChartGroup } from './shapes/miniChartGroup';
declare class MiniChartPadding {
    top: number;
    bottom: number;
}
export declare class MiniChart extends _ModuleSupport.BaseModuleInstance implements _ModuleSupport.ModuleInstance {
    private readonly ctx;
    enabled: boolean;
    inset: number;
    cornerRadius: number;
    readonly padding: MiniChartPadding;
    readonly root: _ModuleSupport.Group<unknown>;
    readonly seriesRoot: MiniChartGroup;
    readonly axisGridGroup: _ModuleSupport.Group<unknown>;
    readonly axisGroup: _ModuleSupport.Group<unknown>;
    readonly axisLabelGroup: _ModuleSupport.Group<unknown>;
    readonly axisCrosslineRangeGroup: _ModuleSupport.Group<unknown>;
    readonly axisCrosslineLineGroup: _ModuleSupport.Group<unknown>;
    readonly axisCrosslineLabelGroup: _ModuleSupport.Group<unknown>;
    data: any;
    private _destroyed;
    private miniChartAnimationPhase;
    axes: _ModuleSupport.ChartAxis[];
    series: _ModuleSupport.UnknownSeries[];
    constructor(ctx: _ModuleSupport.ModuleContext);
    destroy(): void;
    private onSeriesChange;
    protected destroySeries(allSeries: _ModuleSupport.UnknownSeries[]): void;
    protected assignSeriesToAxes(): void;
    protected assignAxesToSeries(): void;
    private findMatchingAxis;
    updateData(data: any): void;
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    computeAxisPadding(): _ModuleSupport.Padding;
    layout(width: number, height: number): Promise<void>;
    protected seriesRect?: _ModuleSupport.BBox;
}
export {};
