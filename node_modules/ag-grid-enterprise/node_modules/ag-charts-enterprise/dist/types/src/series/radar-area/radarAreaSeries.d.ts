import { _ModuleSupport } from 'ag-charts-community';
import { RadarSeries } from '../radar/radarSeries';
import { RadarAreaSeriesProperties } from './radarAreaSeriesProperties';
export declare class RadarAreaSeries extends RadarSeries {
    static readonly className = "RadarAreaSeries";
    static readonly type: "radar-area";
    properties: RadarAreaSeriesProperties;
    private readonly areaGroup;
    protected areaSelection: _ModuleSupport.Selection<_ModuleSupport.Path, boolean>;
    resetInvalidToZero: boolean;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    protected updatePathSelections(): void;
    protected getAreaNode(): _ModuleSupport.Path<any> | undefined;
    protected getMarkerFill(highlightedStyle?: _ModuleSupport.SeriesItemHighlightStyle): string | import("ag-charts-community").AgGradientColor | import("ag-charts-community").AgPatternColor | import("ag-charts-community").AgImageFill;
    protected updatePathNodes(): void;
    protected animatePaths(ratio: number): void;
    private getAreaPoints;
    protected hasItemStylers(): boolean;
    protected resetPaths(): void;
}
