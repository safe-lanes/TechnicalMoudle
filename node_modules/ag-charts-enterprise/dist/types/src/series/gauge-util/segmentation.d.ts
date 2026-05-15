import { _ModuleSupport } from 'ag-charts-community';
declare const BaseProperties: typeof _ModuleSupport.BaseProperties;
declare class GaugeSegmentationIntervalProperties extends BaseProperties {
    values?: number[];
    step?: number;
    count?: number;
    getSegments(scale: _ModuleSupport.Scale<number, number>, maxTicks: number): number[];
}
export declare class GaugeSegmentationProperties extends BaseProperties {
    enabled: boolean;
    readonly interval: GaugeSegmentationIntervalProperties;
    spacing: number;
}
export {};
