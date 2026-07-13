import { _ModuleSupport } from 'ag-charts-community';
import type { AgChartLabelFormatterParams, AgGradientColorMode, AgLinearGaugeLabelPlacement, AgLinearGaugeMarkerShape, AgLinearGaugeOptions, AgLinearGaugeTargetPlacement, AgLinearGaugeTooltipRendererParams, FontStyle, FontWeight, Formatter, OverflowStrategy, TextWrap } from 'ag-charts-types';
import { GaugeSegmentationProperties } from '../gauge-util/segmentation';
import { AutoSizedLabel } from '../util/autoSizedLabel';
declare const BaseProperties: typeof _ModuleSupport.BaseProperties, SeriesProperties: typeof _ModuleSupport.SeriesProperties, Label: typeof _ModuleSupport.Label, AxisLabel: typeof _ModuleSupport.AxisLabel;
export declare enum NodeDataType {
    Node = 0,
    Target = 1
}
export type LinearGaugeNodeDatumIndex = {
    type: NodeDataType.Node;
} | {
    type: NodeDataType.Target;
    index: number;
};
export interface LinearGaugeNodeDatum extends _ModuleSupport.SeriesNodeDatum<LinearGaugeNodeDatumIndex> {
    type: NodeDataType.Node;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    clipX0: number | undefined;
    clipY0: number | undefined;
    clipX1: number | undefined;
    clipY1: number | undefined;
    topLeftCornerRadius: number;
    topRightCornerRadius: number;
    bottomRightCornerRadius: number;
    bottomLeftCornerRadius: number;
    fill: string | _ModuleSupport.ShapeColor | undefined;
    horizontalInset: number;
    verticalInset: number;
}
export interface LinearGaugeTargetDatumLabel {
    offsetX: number;
    offsetY: number;
    fill: string | undefined;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
    fontStyle: FontStyle | undefined;
    fontWeight: FontWeight | undefined;
    fontSize: number;
    fontFamily: string;
    lineHeight: number | undefined;
}
export interface LinearGaugeTargetDatum extends _ModuleSupport.SeriesNodeDatum<LinearGaugeNodeDatumIndex> {
    type: NodeDataType.Target;
    value: number;
    text: string | undefined;
    x: number;
    y: number;
    shape: AgLinearGaugeMarkerShape;
    size: number;
    rotation: number;
    fill: string;
    fillOpacity: number;
    stroke: string;
    strokeOpacity: number;
    strokeWidth: number;
    lineDash: number[];
    lineDashOffset: number;
    label: LinearGaugeTargetDatumLabel;
}
export type LinearGaugeLabelDatum = {
    placement: AgLinearGaugeLabelPlacement;
    avoidCollisions: boolean;
    spacing: number;
    text: string | undefined;
    value: number;
    fill: string | undefined;
    fontStyle: FontStyle | undefined;
    fontWeight: FontWeight | undefined;
    fontSize: number;
    minimumFontSize: number | undefined;
    fontFamily: string;
    lineHeight: number | undefined;
    wrapping: TextWrap;
    overflowStrategy: OverflowStrategy;
    formatter: Formatter<AgChartLabelFormatterParams<any>> | undefined;
};
declare class LinearGaugeDefaultTargetLabelProperties extends Label<never> {
    spacing: number | undefined;
}
export declare class LinearGaugeTargetProperties extends BaseProperties {
    text: string | undefined;
    value: number;
    shape: AgLinearGaugeMarkerShape | undefined;
    placement: AgLinearGaugeTargetPlacement | undefined;
    spacing: number | undefined;
    size: number | undefined;
    rotation: number | undefined;
    fill: string | undefined;
    fillOpacity: number | undefined;
    stroke: string | undefined;
    strokeWidth: number | undefined;
    strokeOpacity: number | undefined;
    lineDash: number[] | undefined;
    lineDashOffset: number | undefined;
    readonly label: LinearGaugeDefaultTargetLabelProperties;
}
declare class LinearGaugeBarProperties extends BaseProperties {
    enabled: boolean;
    thickness: number | undefined;
    thicknessRatio: number;
    fills: _ModuleSupport.PropertiesArray<_ModuleSupport.StopProperties>;
    fillMode: AgGradientColorMode;
    fill: string | undefined;
    fillOpacity: number;
    stroke: string;
    strokeWidth: number;
    strokeOpacity: number;
    lineDash: number[];
    lineDashOffset: number;
}
declare class LinearGaugeScaleIntervalProperties extends BaseProperties {
    values?: number[];
    step?: number;
    minSpacing: number;
    maxSpacing: number;
}
declare class LinearGaugeScaleLabelProperties extends AxisLabel {
    placement?: 'before' | 'after';
}
declare class LinearGaugeScaleProperties extends BaseProperties {
    min: number;
    max: number;
    fills: _ModuleSupport.PropertiesArray<_ModuleSupport.StopProperties>;
    fillMode: AgGradientColorMode;
    fill: string | undefined;
    fillOpacity: number;
    stroke: string;
    strokeWidth: number;
    strokeOpacity: number;
    lineDash: number[];
    lineDashOffset: number;
    defaultFill: string;
    readonly interval: LinearGaugeScaleIntervalProperties;
    readonly label: LinearGaugeScaleLabelProperties;
}
export declare class LinearGaugeLabelProperties extends AutoSizedLabel<unknown> {
    text?: string;
    placement: AgLinearGaugeLabelPlacement;
    avoidCollisions: boolean;
}
export declare class LinearGaugeSeriesProperties extends SeriesProperties<AgLinearGaugeOptions> {
    value: number;
    readonly segmentation: GaugeSegmentationProperties;
    defaultColorRange: string[];
    targets: _ModuleSupport.PropertiesArray<LinearGaugeTargetProperties>;
    defaultTarget: LinearGaugeTargetProperties;
    defaultScale: LinearGaugeScaleProperties;
    direction: 'horizontal' | 'vertical';
    thickness: number;
    cornerRadius: number;
    cornerMode: 'container' | 'item';
    margin: number;
    readonly scale: LinearGaugeScaleProperties;
    readonly bar: LinearGaugeBarProperties;
    readonly label: LinearGaugeLabelProperties;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgLinearGaugeTooltipRendererParams, "context">>;
}
export {};
