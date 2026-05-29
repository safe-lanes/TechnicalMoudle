import type { AgBaseRadarSeriesOptions, AgRadarSeriesLabelFormatterParams, AgRadarSeriesTooltipRendererParams, AgRadialSeriesOptionsKeys } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
export interface RadarNodeDatum extends _ModuleSupport.DataModelSeriesNodeDatum {
    readonly index: number;
    readonly label?: {
        text: string;
        x: number;
        y: number;
        textAlign: CanvasTextAlign;
        textBaseline: CanvasTextBaseline;
    };
    readonly point: Readonly<_ModuleSupport.SizedPoint>;
    readonly angleValue: any;
    readonly radiusValue: any;
}
declare const SeriesProperties: typeof _ModuleSupport.SeriesProperties;
export declare class RadarSeriesProperties<T extends AgBaseRadarSeriesOptions> extends SeriesProperties<T> {
    angleKey: string;
    radiusKey: string;
    angleName?: string;
    radiusName?: string;
    stroke: string;
    strokeWidth: number;
    strokeOpacity: number;
    lineDash: number[];
    lineDashOffset: number;
    rotation: number;
    readonly marker: _ModuleSupport.SeriesMarker<AgRadialSeriesOptionsKeys<any>>;
    readonly label: _ModuleSupport.Label<AgRadarSeriesLabelFormatterParams, any>;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgRadarSeriesTooltipRendererParams<any>, "context">>;
    connectMissingData: boolean;
}
export {};
