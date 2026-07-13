import { _ModuleSupport } from 'ag-charts-community';
import type { RadialColumnNodeDatum } from './radialColumnSeriesBase';
import { RadialColumnSeriesBase } from './radialColumnSeriesBase';
import { RadialColumnSeriesProperties } from './radialColumnSeriesProperties';
export declare class RadialColumnSeries extends RadialColumnSeriesBase<_ModuleSupport.RadialColumnShape> {
    static readonly className = "RadialColumnSeries";
    static readonly type: "radial-column";
    properties: RadialColumnSeriesProperties<import("ag-charts-community").AgBaseRadialColumnSeriesOptions<any, unknown>>;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    protected getStackId(): string;
    protected nodeFactory(): _ModuleSupport.RadialColumnShape;
    protected getColumnTransitionFunctions(): {
        toFn: (node: _ModuleSupport.RadialColumnShape<any>, datum: {
            innerRadius: number;
            outerRadius: number;
            columnWidth: number;
            axisInnerRadius: number;
            axisOuterRadius: number;
            startAngle: number;
            endAngle: number;
        }, status: _ModuleSupport.NodeUpdateState) => {
            innerRadius: number;
            outerRadius: number;
            columnWidth: number;
            axisInnerRadius: number;
            axisOuterRadius: number;
            startAngle: number;
            endAngle: number;
        };
        fromFn: (node: _ModuleSupport.RadialColumnShape<any>, datum: {
            innerRadius: number;
            outerRadius: number;
            columnWidth: number;
            axisInnerRadius: number;
            axisOuterRadius: number;
            startAngle: number;
            endAngle: number;
        }, status: _ModuleSupport.NodeUpdateState) => {
            innerRadius: number;
            outerRadius: number;
            columnWidth: number;
            axisInnerRadius: number;
            axisOuterRadius: number;
            startAngle: number;
            endAngle: number;
            phase: "end" | "remove" | "initial" | "none" | "update" | "add" | "trailing";
        };
    };
    protected isRadiusAxisCircle(): boolean;
    protected updateItemPath(node: _ModuleSupport.RadialColumnShape, datum: RadialColumnNodeDatum, highlight: boolean): void;
    protected getColumnWidth(startAngle: number, endAngle: number): number;
    protected hasItemStylers(): boolean;
}
