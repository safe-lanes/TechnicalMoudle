import { type AgNightingaleSeriesOptions, _ModuleSupport } from 'ag-charts-community';
import type { RadialColumnNodeDatum } from '../radial-column/radialColumnSeriesBase';
import { RadialColumnSeriesBase } from '../radial-column/radialColumnSeriesBase';
import { RadialColumnSeriesBaseProperties } from '../radial-column/radialColumnSeriesBaseProperties';
export declare class NightingaleSeries extends RadialColumnSeriesBase<_ModuleSupport.Sector> {
    static readonly className = "NightingaleSeries";
    static readonly type: "nightingale";
    properties: RadialColumnSeriesBaseProperties<AgNightingaleSeriesOptions<any, unknown>>;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    setZIndex(zIndex: number): boolean;
    protected getStackId(): string;
    protected nodeFactory(): _ModuleSupport.Sector;
    protected updateItemPath(node: _ModuleSupport.Sector, datum: RadialColumnNodeDatum, highlight: boolean): void;
    protected getColumnTransitionFunctions(): {
        toFn: (_sect: _ModuleSupport.Sector<any>, datum: RadialColumnNodeDatum, status: _ModuleSupport.NodeUpdateState) => {
            innerRadius: number;
            outerRadius: number;
            startAngle: number;
            endAngle: number;
            clipSector: _ModuleSupport.SectorBox;
        };
        fromFn: (sect: _ModuleSupport.Sector<any>, datum: RadialColumnNodeDatum, status: _ModuleSupport.NodeUpdateState) => {
            innerRadius: number;
            outerRadius: number;
            startAngle: number;
            endAngle: number;
            clipSector: _ModuleSupport.SectorBox;
            phase: "end" | "remove" | "initial" | "none" | "update" | "add" | "trailing";
        };
    };
    protected hasItemStylers(): boolean;
}
