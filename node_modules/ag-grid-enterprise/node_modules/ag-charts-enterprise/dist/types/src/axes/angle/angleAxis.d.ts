import type { AgAngleAxisLabelOrientation } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
export interface AngleAxisLabelDatum {
    text: string;
    x: number;
    y: number;
    hidden: boolean;
    rotation: number;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
    box: _ModuleSupport.BBox | undefined;
}
interface AngleAxisTickDatum<TDatum> {
    value: TDatum;
    visible: boolean;
}
declare class AngleAxisLabel extends _ModuleSupport.AxisLabel {
    orientation: AgAngleAxisLabelOrientation;
}
export declare abstract class AngleAxis<TDomain, TScale extends _ModuleSupport.Scale<TDomain, any>> extends _ModuleSupport.PolarAxis<TScale> {
    protected static CrossLineConstructor: new () => _ModuleSupport.CrossLine<any>;
    startAngle: number;
    endAngle: number | undefined;
    protected tickLineGroupSelection: _ModuleSupport.Selection<_ModuleSupport.Line, AngleAxisTickDatum<TDomain>>;
    protected gridLineGroupSelection: _ModuleSupport.Selection<_ModuleSupport.Line, AngleAxisTickDatum<TDomain>>;
    protected labelData: AngleAxisLabelDatum[];
    protected tickData: AngleAxisTickDatum<TDomain>[];
    protected radiusLineGroup: _ModuleSupport.TransformableGroup;
    protected radiusLine: _ModuleSupport.Path;
    constructor(moduleCtx: _ModuleSupport.ModuleContext, scale: TScale);
    get direction(): _ModuleSupport.ChartAxisDirection;
    protected createLabel(): AngleAxisLabel;
    calculateRotations(): {
        rotation: number;
        parallelFlipRotation: number;
        regularFlipRotation: number;
    };
    calculateTickLayout(domain: TDomain[]): {
        niceDomain: any[];
        tickDomain: TDomain[];
        ticks: TDomain[];
        rawTickCount: number | undefined;
        fractionDigits: number;
        timeInterval: undefined;
        bbox: _ModuleSupport.BBox;
    };
    update(): void;
    private normalizedAngles;
    computeRange(): void;
    protected abstract generateAngleTicks(domain: TDomain[]): AngleAxisTickDatum<TDomain>[];
    protected updateSelections(): void;
    updatePosition(): void;
    protected updateRadiusLine(): void;
    getAxisLinePoints(): {
        points: ({
            x: number;
            y: number;
            moveTo: boolean;
            radius?: undefined;
            startAngle?: undefined;
            endAngle?: undefined;
            arc?: undefined;
        } | {
            x: number;
            y: number;
            radius: number;
            startAngle: number;
            endAngle: number;
            arc: boolean;
            moveTo: boolean;
        })[];
        closePath: boolean;
    };
    private updateGridLines;
    protected updateLabels(): void;
    private updateTickLines;
    protected createLabelNodeData(ticks: any[], options: {
        hideWhenNecessary: boolean;
    }, seriesRect: _ModuleSupport.BBox): AngleAxisLabelDatum[];
    protected abstract avoidLabelCollisions(labelData: AngleAxisLabelDatum[]): void;
    computeLabelsBBox(options: {
        hideWhenNecessary: boolean;
    }, seriesRect: _ModuleSupport.BBox): _ModuleSupport.BBox | null;
    protected getLabelOrientation(): AgAngleAxisLabelOrientation;
    protected getLabelRotation(tickAngle: number): number;
    protected getLabelAlign(tickAngle: number): {
        textAlign: "center" | "left" | "right";
        textBaseline: "bottom" | "middle" | "top";
    };
    protected updateCrossLines(): void;
}
export {};
