import type { AgLineSeriesLabelFormatterParams, AgLineSeriesMarkerItemStylerParams, AgLineSeriesOptions, AgLineSeriesStylerParams, AgLineSeriesStylerResult, AgLineSeriesTooltipRendererParams, Styler } from 'ag-charts-types';
import { Label } from '../../label';
import { SeriesMarker } from '../seriesMarker';
import { CartesianSeriesProperties } from './cartesianSeries';
import { InterpolationProperties } from './interpolationProperties';
export declare class LineSeriesProperties extends CartesianSeriesProperties<AgLineSeriesOptions> {
    xKey: string;
    yKey: string;
    xName?: string;
    yName?: string;
    yFilterKey: string | undefined;
    stackGroup?: string;
    normalizedTo?: number;
    title?: string;
    stroke: string;
    strokeWidth: number;
    strokeOpacity: number;
    lineDash: number[];
    lineDashOffset: number;
    interpolation: InterpolationProperties;
    styler?: Styler<AgLineSeriesStylerParams<unknown, unknown>, AgLineSeriesStylerResult>;
    readonly marker: SeriesMarker<AgLineSeriesMarkerItemStylerParams<any, unknown>>;
    readonly label: Label<AgLineSeriesLabelFormatterParams, any>;
    readonly tooltip: import("../seriesTooltip").SeriesTooltip<Omit<AgLineSeriesTooltipRendererParams<any, unknown>, "context">>;
    connectMissingData: boolean;
    sparklineMode: boolean;
}
