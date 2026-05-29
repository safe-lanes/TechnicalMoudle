import { type AgRadialGaugeOptions, type TextAlign, type VerticalAlign, _ModuleSupport } from 'ag-charts-community';
import { LinearAngleScale } from '../../axes/angle-number/linearAngleScale';
import { DatumUnion } from '../gauge-util/datumUnion';
import { type RadialGaugeLabelDatum, type RadialGaugeNodeDatum, type RadialGaugeNodeDatumIndex, RadialGaugeSeriesProperties, type RadialGaugeTargetDatum } from './radialGaugeSeriesProperties';
interface RadialGaugeNeedleDatum {
    centerX: number;
    centerY: number;
    radius: number;
    angle: number;
    series: RadialGaugeSeries;
}
interface RadialGaugeTickDatum {
    index: number;
    value: number;
    text: string;
    width: number;
    height: number;
}
interface RadialGaugeNodeDataContext extends _ModuleSupport.SeriesNodeDataContext<RadialGaugeNodeDatumIndex, RadialGaugeNodeDatum, RadialGaugeLabelDatum> {
    needleData: RadialGaugeNeedleDatum[];
    targetData: RadialGaugeTargetDatum[];
    scaleData: RadialGaugeNodeDatum[];
    tickData: RadialGaugeTickDatum[];
}
export declare class RadialGaugeSeries extends _ModuleSupport.Series<RadialGaugeNodeDatumIndex, RadialGaugeNodeDatum, AgRadialGaugeOptions, RadialGaugeSeriesProperties, RadialGaugeLabelDatum, RadialGaugeNodeDataContext> implements _ModuleSupport.GaugeSeries {
    static readonly className = "RadialGaugeSeries";
    static readonly type: "radial-gauge";
    centerX: number;
    centerY: number;
    radius: number;
    textAlign: TextAlign;
    verticalAlign: VerticalAlign;
    properties: RadialGaugeSeriesProperties;
    scale: LinearAngleScale;
    private readonly scaleGroup;
    private readonly itemGroup;
    private readonly itemNeedleGroup;
    private readonly itemTargetGroup;
    private readonly itemTargetLabelGroup;
    private readonly itemLabelGroup;
    private readonly highlightTargetGroup;
    private readonly tickGroup;
    private scaleSelection;
    private datumSelection;
    private needleSelection;
    targetSelection: _ModuleSupport.Selection<_ModuleSupport.Marker, RadialGaugeTargetDatum>;
    private targetLabelSelection;
    private labelSelection;
    private highlightTargetSelection;
    private tickSelection;
    datumUnion: DatumUnion<_ModuleSupport.Sector, RadialGaugeNodeDatum>;
    private readonly animationState;
    contextNodeData?: RadialGaugeNodeDataContext;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    get hasData(): boolean;
    private nodeFactory;
    private markerFactory;
    processData(): void;
    private formatLabel;
    private layoutScale;
    private createConicGradient;
    protected getShapeFillBBox(): _ModuleSupport.BBox;
    private getTargets;
    private getTargetRadius;
    private getTargetLabel;
    createNodeData(): {
        itemId: string;
        nodeData: RadialGaugeNodeDatum[];
        needleData: RadialGaugeNeedleDatum[];
        targetData: RadialGaugeTargetDatum[];
        labelData: RadialGaugeLabelDatum[];
        scaleData: RadialGaugeNodeDatum[];
        tickData: RadialGaugeTickDatum[];
    };
    updateSelections(resize: boolean): void;
    private highlightDatum;
    update({ seriesRect }: {
        seriesRect?: _ModuleSupport.BBox;
    }): void;
    private updateDatumSelection;
    private updateDatumNodes;
    private updateScaleSelection;
    private updateScaleNodes;
    private updateNeedleSelection;
    private updateNeedleNodes;
    private updateTargetSelection;
    private updateTargetNodes;
    private updateTargetLabelSelection;
    private updateTargetLabelNodes;
    private updateLabelSelection;
    private updateLabelNodes;
    private updateTickSelection;
    private updateTickNodes;
    labelsHaveExplicitText(): boolean;
    formatLabelText(datum?: {
        label: number | undefined;
        secondaryLabel: number | undefined;
    }): void;
    protected resetAllAnimation(): void;
    resetAnimation(phase: _ModuleSupport.ChartAnimationPhase): void;
    private animateLabelText;
    animateEmptyUpdateReady(): void;
    animateWaitingUpdateReady(): void;
    protected animateReadyResize(): void;
    dataCount(): number;
    getSeriesDomain(): number[];
    getSeriesRange(_direction: _ModuleSupport.ChartAxisDirection, _visibleRange: [any, any]): [number, number];
    getLegendData(): _ModuleSupport.ChartLegendDatum<any>[];
    getTooltipContent(datumIndex: RadialGaugeNodeDatumIndex): _ModuleSupport.TooltipContent | undefined;
    pickNodeClosestDatum(point: _ModuleSupport.Point): _ModuleSupport.SeriesNodePickMatch | undefined;
    pickFocus(opts: _ModuleSupport.PickFocusInputs): _ModuleSupport.PickFocusOutputs | undefined;
    getCaptionText(): string;
    getCategoryValue(_datumIndex: RadialGaugeNodeDatumIndex): void;
    datumIndexForCategoryValue(_categoryValue: any): RadialGaugeNodeDatumIndex | undefined;
    protected hasItemStylers(): boolean;
}
export {};
