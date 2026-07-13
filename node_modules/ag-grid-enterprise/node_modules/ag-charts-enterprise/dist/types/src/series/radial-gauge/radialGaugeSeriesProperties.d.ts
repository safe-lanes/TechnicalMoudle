import { _ModuleSupport } from 'ag-charts-community';
import type { RequireOptional } from 'ag-charts-core';
import type { AgChartLabelFormatterParams, AgGradientColorMode, AgRadialGaugeLabelFormatterParams, AgRadialGaugeMarkerShape, AgRadialGaugeOptions, AgRadialGaugeTargetPlacement, AgRadialGaugeTooltipRendererParams, FontStyle, FontWeight, Formatter } from 'ag-charts-types';
import { GaugeSegmentationProperties } from '../gauge-util/segmentation';
import { AutoSizedLabel, AutoSizedSecondaryLabel } from '../util/autoSizedLabel';
declare const BaseProperties: typeof _ModuleSupport.BaseProperties, SeriesProperties: typeof _ModuleSupport.SeriesProperties, AxisLabel: typeof _ModuleSupport.AxisLabel, Label: typeof _ModuleSupport.Label;
export declare enum NodeDataType {
    Node = 0,
    Target = 1
}
export declare enum LabelType {
    Primary = "primary",
    Secondary = "secondary"
}
export type RadialGaugeNodeDatumIndex = {
    type: NodeDataType.Node;
} | {
    type: NodeDataType.Target;
    index: number;
};
export interface RadialGaugeNodeDatum extends _ModuleSupport.SeriesNodeDatum<RadialGaugeNodeDatumIndex> {
    type: NodeDataType.Node;
    centerX: number;
    centerY: number;
    innerRadius: number;
    outerRadius: number;
    startAngle: number;
    endAngle: number;
    clipStartAngle: number | undefined;
    clipEndAngle: number | undefined;
    startCornerRadius: number;
    endCornerRadius: number;
    fill: string | _ModuleSupport.ShapeColor | undefined;
}
export interface RadialGaugeTargetDatumLabel {
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
export interface RadialGaugeTargetDatum extends _ModuleSupport.SeriesNodeDatum<RadialGaugeNodeDatumIndex> {
    type: NodeDataType.Target;
    value: number;
    text: string | undefined;
    centerX: number;
    centerY: number;
    shape: AgRadialGaugeMarkerShape;
    radius: number;
    angle: number;
    size: number;
    rotation: number;
    fill: string;
    fillOpacity: number;
    stroke: string;
    strokeOpacity: number;
    strokeWidth: number;
    lineDash: number[];
    lineDashOffset: number;
    label: RadialGaugeTargetDatumLabel;
}
export type RadialGaugeLabelDatum = {
    label: LabelType;
    centerX: number;
    centerY: number;
    text: string | undefined;
    value: number;
    fill: string | undefined;
    fontStyle: FontStyle | undefined;
    fontWeight: FontWeight | undefined;
    fontSize: number;
    minimumFontSize: number | undefined;
    fontFamily: string;
    lineHeight: number | undefined;
    formatter: Formatter<AgChartLabelFormatterParams<any> & RequireOptional<AgRadialGaugeLabelFormatterParams>> | undefined;
};
declare class RadialGaugeDefaultTargetLabelProperties extends Label<never> {
    spacing: number | undefined;
}
export declare class RadialGaugeTargetProperties extends BaseProperties {
    text: string | undefined;
    value: number | undefined;
    shape: AgRadialGaugeMarkerShape | undefined;
    placement: AgRadialGaugeTargetPlacement | undefined;
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
    readonly label: RadialGaugeDefaultTargetLabelProperties;
}
declare class RadialGaugeBarProperties extends BaseProperties {
    enabled: boolean;
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
declare class RadialGaugeScaleIntervalProperties extends BaseProperties {
    values?: number[];
    step?: number;
    minSpacing: number;
    maxSpacing: number;
}
declare class RadialGaugeScaleLabelProperties extends AxisLabel {
}
declare class RadialGaugeScaleProperties extends BaseProperties {
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
    readonly interval: RadialGaugeScaleIntervalProperties;
    readonly label: RadialGaugeScaleLabelProperties;
}
declare class RadialGaugeNeedleProperties extends BaseProperties {
    enabled: boolean;
    radiusRatio?: number;
    spacing: number;
    fill: string;
    fillOpacity: number;
    stroke: string;
    strokeWidth: number;
    strokeOpacity: number;
    lineDash: number[];
    lineDashOffset: number;
}
declare class RadialGaugeLabelProperties extends AutoSizedLabel<AgRadialGaugeLabelFormatterParams> {
    text?: string;
}
declare class RadialGaugeSecondaryLabelProperties extends AutoSizedSecondaryLabel<AgRadialGaugeLabelFormatterParams> {
    text?: string;
}
export declare class RadialGaugeSeriesProperties extends SeriesProperties<AgRadialGaugeOptions> {
    value: number;
    startAngle: number;
    endAngle: number;
    readonly segmentation: GaugeSegmentationProperties;
    defaultColorRange: string[];
    targets: _ModuleSupport.PropertiesArray<RadialGaugeTargetProperties>;
    readonly defaultTarget: RadialGaugeTargetProperties;
    outerRadiusRatio: number;
    innerRadiusRatio: number;
    outerRadius: number | undefined;
    innerRadius: number | undefined;
    cornerRadius: number;
    cornerMode: 'container' | 'item';
    spacing: number;
    readonly scale: RadialGaugeScaleProperties;
    readonly bar: RadialGaugeBarProperties;
    readonly needle: RadialGaugeNeedleProperties;
    readonly label: RadialGaugeLabelProperties;
    readonly secondaryLabel: RadialGaugeSecondaryLabelProperties;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgRadialGaugeTooltipRendererParams, "context">>;
}
export {};
