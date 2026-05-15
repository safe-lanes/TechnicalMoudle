import type { InternalAgColorType } from 'ag-charts-core';
import type { AgBarSeriesItemStylerParams, AgBarSeriesLabelFormatterParams, AgBarSeriesLabelPlacement, AgBarSeriesOptions, AgBarSeriesStyle, AgBarSeriesStylerParams, AgBarSeriesTooltipRendererParams, PixelSize, Styler } from 'ag-charts-types';
import { DropShadow } from '../../../scene/dropShadow';
import { Label } from '../../label';
import { AbstractBarSeriesProperties } from './abstractBarSeries';
declare class BarSeriesLabel extends Label<AgBarSeriesLabelFormatterParams> {
    placement: AgBarSeriesLabelPlacement;
    spacing: PixelSize;
}
export declare class BarSeriesProperties extends AbstractBarSeriesProperties<AgBarSeriesOptions> {
    xKey: string;
    xName?: string;
    yKey: string;
    yName?: string;
    yFilterKey?: string;
    stackGroup?: string;
    normalizedTo?: number;
    fill: InternalAgColorType;
    fillOpacity: number;
    stroke: string;
    strokeWidth: number;
    strokeOpacity: number;
    lineDash: number[];
    lineDashOffset: number;
    cornerRadius: number;
    crisp?: boolean;
    styler?: Styler<AgBarSeriesStylerParams<unknown, unknown>, AgBarSeriesStyle>;
    itemStyler?: Styler<AgBarSeriesItemStylerParams<unknown>, AgBarSeriesStyle>;
    readonly shadow: DropShadow;
    readonly label: BarSeriesLabel;
    readonly tooltip: import("../seriesTooltip").SeriesTooltip<Omit<AgBarSeriesTooltipRendererParams<any, unknown>, "context">>;
    sparklineMode: boolean;
}
export {};
