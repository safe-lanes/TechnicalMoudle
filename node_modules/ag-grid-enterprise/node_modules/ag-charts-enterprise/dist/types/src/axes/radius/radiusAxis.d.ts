import { _ModuleSupport } from 'ag-charts-community';
declare class RadiusAxisLabel extends _ModuleSupport.AxisLabel {
    autoRotate?: boolean;
    autoRotateAngle: number;
}
export declare abstract class RadiusAxis<S extends _ModuleSupport.Scale<D, number, _ModuleSupport.TickInterval<S>> = _ModuleSupport.Scale<any, number, any>, D = any> extends _ModuleSupport.PolarAxis<S, D> {
    protected static CrossLineConstructor: new () => _ModuleSupport.CrossLine<any>;
    positionAngle: number;
    protected gridLineGroupSelection: _ModuleSupport.Selection<_ModuleSupport.Line, _ModuleSupport.TickDatum>;
    private readonly tickGenerator;
    private generatedTicks;
    protected readonly headingLabelGroup: _ModuleSupport.TransformableGroup;
    protected readonly lineNodeGroup: _ModuleSupport.TransformableGroup;
    protected readonly lineNode: _ModuleSupport.Line;
    protected readonly gridPathGroup: _ModuleSupport.Group<unknown>;
    protected gridPathSelection: _ModuleSupport.Selection<_ModuleSupport.Path<unknown>, any>;
    get direction(): _ModuleSupport.ChartAxisDirection;
    constructor(moduleCtx: _ModuleSupport.ModuleContext, scale: S);
    private getAxisTransform;
    update(): void;
    updatePosition(): void;
    calculateRotations(): {
        rotation: number;
        parallelFlipRotation: number;
        regularFlipRotation: number;
    };
    calculateTickLayout(domain: D[], niceMode: _ModuleSupport.NiceMode, _visibleRange: [number, number]): {
        niceDomain: D[];
        tickDomain: D[];
        ticks: D[];
        rawTickCount: number | undefined;
        fractionDigits: number;
        timeInterval: undefined;
    };
    protected abstract prepareGridPathTickData(tickData: _ModuleSupport.TickDatum[]): _ModuleSupport.TickDatum[];
    protected abstract getTickRadius(tickDatum: _ModuleSupport.TickDatum): number;
    protected updateSelections(): void;
    protected updateLabels(): void;
    private updateGridLines;
    private updateTitle;
    protected updateCrossLines(): void;
    protected createLabel(): RadiusAxisLabel;
    private getTickLabelProps;
}
export {};
