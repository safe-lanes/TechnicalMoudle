import type { InternalAgColorType } from 'ag-charts-core';
import type { AgAreaSeriesLabelFormatterParams, AgAreaSeriesMarkerItemStylerParams, AgAreaSeriesOptions, AgAreaSeriesStylerParams, AgAreaSeriesStylerResult, AgAreaSeriesTooltipRendererParams, Styler } from 'ag-charts-types';
import { DropShadow } from '../../../scene/dropShadow';
import { Label } from '../../label';
import { SeriesMarker } from '../seriesMarker';
import { CartesianSeriesProperties } from './cartesianSeries';
import { InterpolationProperties } from './interpolationProperties';
export declare class AreaSeriesProperties extends CartesianSeriesProperties<AgAreaSeriesOptions> {
    xKey: string;
    xName?: string;
    yKey: string;
    yName?: string;
    yFilterKey: string | undefined;
    normalizedTo?: number;
    fill: InternalAgColorType;
    fillOpacity: number;
    stroke: string;
    strokeWidth: number;
    strokeOpacity: number;
    lineDash: number[];
    lineDashOffset: number;
    interpolation: InterpolationProperties;
    styler?: Styler<AgAreaSeriesStylerParams<unknown, unknown>, AgAreaSeriesStylerResult>;
    readonly shadow: DropShadow;
    readonly marker: SeriesMarker<AgAreaSeriesMarkerItemStylerParams<any, unknown>>;
    readonly label: Label<AgAreaSeriesLabelFormatterParams, any>;
    readonly tooltip: import("../seriesTooltip").SeriesTooltip<Omit<AgAreaSeriesTooltipRendererParams<any, unknown>, "context">>;
    connectMissingData: boolean;
}
