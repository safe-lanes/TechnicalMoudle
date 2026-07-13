import { type AgColorType, type AgRadarAreaSeriesOptions, _ModuleSupport } from 'ag-charts-community';
import { RadarSeriesProperties } from '../radar/radarSeriesProperties';
export declare class RadarAreaSeriesProperties extends RadarSeriesProperties<AgRadarAreaSeriesOptions> {
    fill: AgColorType;
    readonly fillGradientDefaults: _ModuleSupport.FillGradientDefaults;
    readonly fillPatternDefaults: _ModuleSupport.FillPatternDefaults;
    readonly fillImageDefaults: _ModuleSupport.FillImageDefaults;
    fillOpacity: number;
}
